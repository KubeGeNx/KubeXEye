import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/renderWithProviders';
import { Pods } from './Pods';
import { usePods, usePodMetrics, useDeployments, useStatefulSets, useDaemonSets } from '../hooks/useK8sResources';
import type { K8sPod, K8sDeployment } from '../types/k8s';

vi.mock('../hooks/useK8sResources', () => ({
  usePods: vi.fn(),
  usePodMetrics: vi.fn(),
  useDeployments: vi.fn(),
  useStatefulSets: vi.fn(),
  useDaemonSets: vi.fn(),
}));

function pod(name: string, namespace: string, labels: Record<string, string>, withResources = true): K8sPod {
  return {
    metadata: { name, namespace, labels },
    spec: {
      containers: [
        {
          name: 'app',
          image: 'nginx',
          resources: withResources ? { requests: { cpu: '100m' }, limits: { cpu: '200m' } } : undefined,
        },
      ],
    },
    status: { phase: 'Running', containerStatuses: [{ name: 'app', ready: true, restartCount: 0 }] },
  };
}

function deployment(name: string, namespace: string, matchLabels: Record<string, string>): K8sDeployment {
  return { metadata: { name, namespace }, spec: { selector: { matchLabels } } };
}

const emptyQuery = { data: [], isLoading: false, error: null } as any;

describe('Pods page', () => {
  it('shows every pod in the namespace when there is no workload filter', () => {
    vi.mocked(usePods).mockReturnValue({
      data: [pod('foo-abc', 'default', { app: 'foo' }), pod('bar-xyz', 'default', { app: 'bar' })],
      isLoading: false,
      error: null,
    } as any);
    vi.mocked(usePodMetrics).mockReturnValue(emptyQuery);
    vi.mocked(useDeployments).mockReturnValue(emptyQuery);
    vi.mocked(useStatefulSets).mockReturnValue(emptyQuery);
    vi.mocked(useDaemonSets).mockReturnValue(emptyQuery);

    renderWithProviders(<Pods />, { route: '/pods' });

    expect(screen.getByText('foo-abc')).toBeInTheDocument();
    expect(screen.getByText('bar-xyz')).toBeInTheDocument();
    expect(screen.queryByText(/Showing pods managed by/)).not.toBeInTheDocument();
  });

  it('filters to only the workload\'s pods when kind/name/namespace are in the URL, and clearing restores the full list', async () => {
    const user = userEvent.setup();
    vi.mocked(usePods).mockReturnValue({
      data: [pod('foo-abc', 'default', { app: 'foo' }), pod('bar-xyz', 'default', { app: 'bar' })],
      isLoading: false,
      error: null,
    } as any);
    vi.mocked(usePodMetrics).mockReturnValue(emptyQuery);
    vi.mocked(useDeployments).mockReturnValue({
      data: [deployment('foo', 'default', { app: 'foo' })],
      isLoading: false,
      error: null,
    } as any);
    vi.mocked(useStatefulSets).mockReturnValue(emptyQuery);
    vi.mocked(useDaemonSets).mockReturnValue(emptyQuery);

    renderWithProviders(<Pods />, { route: '/pods?kind=Deployment&name=foo&namespace=default' });

    expect(screen.getByText('Showing pods managed by Deployment/foo')).toBeInTheDocument();
    expect(screen.getByText('foo-abc')).toBeInTheDocument();
    expect(screen.queryByText('bar-xyz')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear filter' }));

    expect(screen.queryByText(/Showing pods managed by/)).not.toBeInTheDocument();
    expect(screen.getByText('foo-abc')).toBeInTheDocument();
    expect(screen.getByText('bar-xyz')).toBeInTheDocument();
  });

  it('flags a container missing resource requests/limits and still opens pod details on name click', async () => {
    const user = userEvent.setup();
    vi.mocked(usePods).mockReturnValue({
      data: [pod('no-limits-pod', 'default', {}, false)],
      isLoading: false,
      error: null,
    } as any);
    vi.mocked(usePodMetrics).mockReturnValue(emptyQuery);
    vi.mocked(useDeployments).mockReturnValue(emptyQuery);
    vi.mocked(useStatefulSets).mockReturnValue(emptyQuery);
    vi.mocked(useDaemonSets).mockReturnValue(emptyQuery);

    renderWithProviders(<Pods />, { route: '/pods' });

    expect(screen.getByLabelText('Missing resource requests/limits')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'no-limits-pod' }));

    expect(screen.getByText('Pod/default/no-limits-pod')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Logs' })).toBeInTheDocument();
  });
});

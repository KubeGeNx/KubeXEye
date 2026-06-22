import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/renderWithProviders';
import { Workloads } from './Workloads';
import { useDeployments, useStatefulSets, useDaemonSets } from '../hooks/useK8sResources';
import type { K8sDeployment } from '../types/k8s';

vi.mock('../hooks/useK8sResources', () => ({
  useDeployments: vi.fn(),
  useStatefulSets: vi.fn(),
  useDaemonSets: vi.fn(),
}));

const emptyQuery = { data: [], isLoading: false, error: null } as any;

function deployment(name: string, namespace: string, ready: number, desired: number): K8sDeployment {
  return {
    metadata: { name, namespace },
    spec: { replicas: desired, selector: { matchLabels: { app: name } } },
    status: { readyReplicas: ready, availableReplicas: ready, updatedReplicas: ready },
  };
}

describe('Workloads page', () => {
  it('renders the Deployments tab with status, ready count, and a Name link into the Pods page', () => {
    vi.mocked(useDeployments).mockReturnValue({ data: [deployment('web', 'default', 2, 2)], isLoading: false, error: null } as any);
    vi.mocked(useStatefulSets).mockReturnValue(emptyQuery);
    vi.mocked(useDaemonSets).mockReturnValue(emptyQuery);

    renderWithProviders(<Workloads />);

    expect(screen.getByText('Healthy')).toBeInTheDocument();
    expect(screen.getByText('2/2')).toBeInTheDocument();

    const nameLink = screen.getByRole('link', { name: 'web' });
    expect(nameLink).toHaveAttribute('href', expect.stringContaining('/pods?'));
    expect(nameLink.getAttribute('href')).toContain('kind=Deployment');
    expect(nameLink.getAttribute('href')).toContain('name=web');
    expect(nameLink.getAttribute('href')).toContain('namespace=default');
  });

  it('shows a degraded status with a reason tooltip when replicas are not all ready', () => {
    vi.mocked(useDeployments).mockReturnValue({ data: [deployment('web', 'default', 1, 2)], isLoading: false, error: null } as any);
    vi.mocked(useStatefulSets).mockReturnValue(emptyQuery);
    vi.mocked(useDaemonSets).mockReturnValue(emptyQuery);

    renderWithProviders(<Workloads />);

    expect(screen.getByText('Warning')).toBeInTheDocument();
  });

  it('still offers a YAML definition link next to the name now that there is no separate column', async () => {
    const user = userEvent.setup();
    vi.mocked(useDeployments).mockReturnValue({ data: [deployment('web', 'default', 2, 2)], isLoading: false, error: null } as any);
    vi.mocked(useStatefulSets).mockReturnValue(emptyQuery);
    vi.mocked(useDaemonSets).mockReturnValue(emptyQuery);

    renderWithProviders(<Workloads />);

    await user.click(screen.getByRole('button', { name: 'YAML' }));

    expect(screen.getByText('Deployment/default/web')).toBeInTheDocument();
  });

  it('has no Dependencies or Definition columns', () => {
    vi.mocked(useDeployments).mockReturnValue({ data: [deployment('web', 'default', 2, 2)], isLoading: false, error: null } as any);
    vi.mocked(useStatefulSets).mockReturnValue(emptyQuery);
    vi.mocked(useDaemonSets).mockReturnValue(emptyQuery);

    renderWithProviders(<Workloads />);

    expect(screen.queryByText('Dependencies')).not.toBeInTheDocument();
    expect(screen.queryByText('Definition')).not.toBeInTheDocument();
  });
});

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/renderWithProviders';
import { Services } from './Services';
import { useServices } from '../hooks/useK8sResources';
import type { K8sService } from '../types/k8s';

vi.mock('../hooks/useK8sResources', () => ({
  useServices: vi.fn(),
}));

function service(name: string, namespace: string): K8sService {
  return {
    metadata: { name, namespace },
    spec: {
      type: 'ClusterIP',
      clusterIP: '10.0.0.1',
      ports: [{ port: 80, protocol: 'TCP' }],
      selector: { app: 'web' },
    },
  };
}

describe('Services page', () => {
  it('renders each Service with its type, cluster IP, ports and selector', () => {
    vi.mocked(useServices).mockReturnValue({
      data: [service('web-svc', 'default')],
      isLoading: false,
      error: null,
    } as any);

    renderWithProviders(<Services />);

    expect(screen.getByText('web-svc')).toBeInTheDocument();
    expect(screen.getByText('ClusterIP')).toBeInTheDocument();
    expect(screen.getByText('10.0.0.1')).toBeInTheDocument();
    expect(screen.getByText('80/TCP')).toBeInTheDocument();
    expect(screen.getByText('app=web')).toBeInTheDocument();
  });

  it('still includes a Dependencies (Map) link per row', () => {
    vi.mocked(useServices).mockReturnValue({
      data: [service('web-svc', 'default')],
      isLoading: false,
      error: null,
    } as any);

    renderWithProviders(<Services />);

    expect(screen.getByRole('link', { name: 'Map' })).toBeInTheDocument();
  });

  it('opens the YAML definition when the name is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(useServices).mockReturnValue({
      data: [service('web-svc', 'default')],
      isLoading: false,
      error: null,
    } as any);

    renderWithProviders(<Services />);

    await user.click(screen.getByRole('button', { name: 'web-svc' }));

    expect(screen.getByText('Service/default/web-svc')).toBeInTheDocument();
  });

  it('shows a spinner while loading', () => {
    vi.mocked(useServices).mockReturnValue({ data: undefined, isLoading: true, error: null } as any);

    renderWithProviders(<Services />);

    expect(screen.getByLabelText('Loading resources')).toBeInTheDocument();
  });

  it('propagates a fetch error to the table', () => {
    vi.mocked(useServices).mockReturnValue({ data: undefined, isLoading: false, error: new Error('boom') } as any);

    renderWithProviders(<Services />);

    expect(screen.getByText('boom')).toBeInTheDocument();
  });
});

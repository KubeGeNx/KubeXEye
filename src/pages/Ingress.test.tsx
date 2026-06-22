import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/renderWithProviders';
import { Ingress } from './Ingress';
import { useIngresses } from '../hooks/useK8sResources';
import type { K8sIngress } from '../types/k8s';

vi.mock('../hooks/useK8sResources', () => ({
  useIngresses: vi.fn(),
}));

function ingress(name: string, namespace: string, host: string, serviceName: string): K8sIngress {
  return {
    metadata: { name, namespace },
    spec: {
      rules: [{ host, http: { paths: [{ backend: { service: { name: serviceName } } }] } }],
    },
  };
}

describe('Ingress page', () => {
  it('renders each ingress with its hosts and backend services', () => {
    vi.mocked(useIngresses).mockReturnValue({
      data: [ingress('my-ingress', 'default', 'example.com', 'my-service')],
      isLoading: false,
      error: null,
    } as any);

    renderWithProviders(<Ingress />);

    expect(screen.getByText('my-ingress')).toBeInTheDocument();
    expect(screen.getByText('example.com')).toBeInTheDocument();
    expect(screen.getByText('my-service')).toBeInTheDocument();
  });

  it('still includes a Dependencies (Map) link per row', () => {
    vi.mocked(useIngresses).mockReturnValue({
      data: [ingress('my-ingress', 'default', 'example.com', 'my-service')],
      isLoading: false,
      error: null,
    } as any);

    renderWithProviders(<Ingress />);

    expect(screen.getByRole('link', { name: 'Map' })).toBeInTheDocument();
  });

  it('opens the YAML definition when the name is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(useIngresses).mockReturnValue({
      data: [ingress('my-ingress', 'default', 'example.com', 'my-service')],
      isLoading: false,
      error: null,
    } as any);

    renderWithProviders(<Ingress />);

    await user.click(screen.getByRole('button', { name: 'my-ingress' }));

    expect(screen.getByText('Ingress/default/my-ingress')).toBeInTheDocument();
  });

  it('shows a spinner while loading', () => {
    vi.mocked(useIngresses).mockReturnValue({ data: undefined, isLoading: true, error: null } as any);

    renderWithProviders(<Ingress />);

    expect(screen.getByLabelText('Loading resources')).toBeInTheDocument();
  });

  it('propagates a fetch error to the table', () => {
    vi.mocked(useIngresses).mockReturnValue({ data: undefined, isLoading: false, error: new Error('boom') } as any);

    renderWithProviders(<Ingress />);

    expect(screen.getByText('boom')).toBeInTheDocument();
  });
});

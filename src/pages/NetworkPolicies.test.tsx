import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/renderWithProviders';
import { NetworkPolicies } from './NetworkPolicies';
import { useNetworkPolicies } from '../hooks/useK8sResources';
import type { K8sNetworkPolicy } from '../types/k8s';

vi.mock('../hooks/useK8sResources', () => ({
  useNetworkPolicies: vi.fn(),
}));

function networkPolicy(
  name: string,
  namespace: string,
  matchLabels: Record<string, string>,
  policyTypes: string[],
): K8sNetworkPolicy {
  return {
    metadata: { name, namespace },
    spec: { podSelector: { matchLabels }, policyTypes },
  };
}

describe('NetworkPolicies page', () => {
  it('renders each network policy with its pod selector and policy types', () => {
    vi.mocked(useNetworkPolicies).mockReturnValue({
      data: [networkPolicy('deny-all', 'default', { app: 'web' }, ['Ingress', 'Egress'])],
      isLoading: false,
      error: null,
    } as any);

    renderWithProviders(<NetworkPolicies />);

    expect(screen.getByText('deny-all')).toBeInTheDocument();
    expect(screen.getByText('app=web')).toBeInTheDocument();
    expect(screen.getByText('Ingress, Egress')).toBeInTheDocument();
  });

  it('opens the YAML definition when the name is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(useNetworkPolicies).mockReturnValue({
      data: [networkPolicy('deny-all', 'default', {}, ['Ingress'])],
      isLoading: false,
      error: null,
    } as any);

    renderWithProviders(<NetworkPolicies />);

    await user.click(screen.getByRole('button', { name: 'deny-all' }));

    expect(screen.getByText('NetworkPolicy/default/deny-all')).toBeInTheDocument();
  });

  it('shows a spinner while loading', () => {
    vi.mocked(useNetworkPolicies).mockReturnValue({ data: undefined, isLoading: true, error: null } as any);

    renderWithProviders(<NetworkPolicies />);

    expect(screen.getByLabelText('Loading resources')).toBeInTheDocument();
  });

  it('propagates a fetch error to the table', () => {
    vi.mocked(useNetworkPolicies).mockReturnValue({ data: undefined, isLoading: false, error: new Error('boom') } as any);

    renderWithProviders(<NetworkPolicies />);

    expect(screen.getByText('boom')).toBeInTheDocument();
  });
});

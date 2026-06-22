import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/renderWithProviders';
import { Namespaces } from './Namespaces';
import { useNamespaces } from '../hooks/useK8sResources';
import type { K8sNamespace } from '../types/k8s';

vi.mock('../hooks/useK8sResources', () => ({
  useNamespaces: vi.fn(),
}));

function namespace(name: string, phase: 'Active' | 'Terminating'): K8sNamespace {
  return { metadata: { name, creationTimestamp: '2024-01-01T00:00:00Z' }, status: { phase } };
}

describe('Namespaces page', () => {
  it('renders a row per namespace with its status', () => {
    vi.mocked(useNamespaces).mockReturnValue({
      data: [namespace('default', 'Active'), namespace('kube-system', 'Active')],
      isLoading: false,
      error: null,
    } as any);

    renderWithProviders(<Namespaces />);

    expect(screen.getByText('default')).toBeInTheDocument();
    expect(screen.getByText('kube-system')).toBeInTheDocument();
    expect(screen.getAllByText('Active')).toHaveLength(2);
  });

  it('shows a spinner while loading', () => {
    vi.mocked(useNamespaces).mockReturnValue({ data: undefined, isLoading: true, error: null } as any);

    renderWithProviders(<Namespaces />);

    expect(screen.getByLabelText('Loading resources')).toBeInTheDocument();
  });

  it('opens the YAML definition when a namespace name is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(useNamespaces).mockReturnValue({
      data: [namespace('default', 'Active')],
      isLoading: false,
      error: null,
    } as any);

    renderWithProviders(<Namespaces />);

    await user.click(screen.getByRole('button', { name: 'default' }));

    expect(screen.getByText('Namespace/default')).toBeInTheDocument();
  });
});

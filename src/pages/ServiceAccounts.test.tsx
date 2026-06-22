import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/renderWithProviders';
import { ServiceAccounts } from './ServiceAccounts';
import { useServiceAccounts } from '../hooks/useK8sResources';
import type { K8sServiceAccount } from '../types/k8s';

vi.mock('../hooks/useK8sResources', () => ({
  useServiceAccounts: vi.fn(),
}));

function serviceAccount(name: string, namespace: string, secrets: { name: string }[] = []): K8sServiceAccount {
  return { metadata: { name, namespace }, secrets };
}

describe('ServiceAccounts page', () => {
  it('renders each ServiceAccount with its mounted secret count', () => {
    vi.mocked(useServiceAccounts).mockReturnValue({
      data: [
        serviceAccount('build-bot', 'ci', [{ name: 'token-abc' }, { name: 'token-def' }]),
      ],
      isLoading: false,
      error: null,
    } as any);

    renderWithProviders(<ServiceAccounts />);

    expect(screen.getByText('build-bot')).toBeInTheDocument();
    expect(screen.getByText('ci')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('still includes a Dependencies (Map) link per row', () => {
    vi.mocked(useServiceAccounts).mockReturnValue({
      data: [serviceAccount('default', 'default')],
      isLoading: false,
      error: null,
    } as any);

    renderWithProviders(<ServiceAccounts />);

    expect(screen.getByRole('link', { name: 'Map' })).toBeInTheDocument();
  });

  it('opens the YAML definition when the name is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(useServiceAccounts).mockReturnValue({
      data: [serviceAccount('build-bot', 'ci')],
      isLoading: false,
      error: null,
    } as any);

    renderWithProviders(<ServiceAccounts />);

    await user.click(screen.getByRole('button', { name: 'build-bot' }));

    expect(screen.getByText('ServiceAccount/ci/build-bot')).toBeInTheDocument();
  });

  it('shows a spinner while loading', () => {
    vi.mocked(useServiceAccounts).mockReturnValue({ data: undefined, isLoading: true, error: null } as any);

    renderWithProviders(<ServiceAccounts />);

    expect(screen.getByLabelText('Loading resources')).toBeInTheDocument();
  });

  it('propagates a fetch error to the table', () => {
    vi.mocked(useServiceAccounts).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('boom'),
    } as any);

    renderWithProviders(<ServiceAccounts />);

    expect(screen.getByText('boom')).toBeInTheDocument();
  });
});

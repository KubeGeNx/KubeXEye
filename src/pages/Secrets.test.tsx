import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/renderWithProviders';
import { Secrets } from './Secrets';
import { useSecrets } from '../hooks/useK8sResources';
import type { K8sSecret } from '../types/k8s';

vi.mock('../hooks/useK8sResources', () => ({
  useSecrets: vi.fn(),
}));

function secret(name: string, namespace: string, data: Record<string, string>): K8sSecret {
  return { metadata: { name, namespace }, type: 'Opaque', data };
}

describe('Secrets page', () => {
  it('renders each Secret with its type and key count, without revealing values', () => {
    vi.mocked(useSecrets).mockReturnValue({
      data: [secret('db-creds', 'default', { username: 'super-secret-user', password: 'super-secret-pass' })],
      isLoading: false,
      error: null,
    } as any);

    renderWithProviders(<Secrets />);

    expect(screen.getByText('db-creds')).toBeInTheDocument();
    expect(screen.getByText('Opaque')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('username, password')).toBeInTheDocument();
    expect(screen.queryByText('super-secret-user')).not.toBeInTheDocument();
    expect(screen.queryByText('super-secret-pass')).not.toBeInTheDocument();
  });

  it('still includes a Dependencies (Map) link per row', () => {
    vi.mocked(useSecrets).mockReturnValue({
      data: [secret('db-creds', 'default', {})],
      isLoading: false,
      error: null,
    } as any);

    renderWithProviders(<Secrets />);

    expect(screen.getByRole('link', { name: 'Map' })).toBeInTheDocument();
  });

  it('opens the redacted definition with a redaction warning when the name is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(useSecrets).mockReturnValue({
      data: [secret('db-creds', 'default', { username: 'super-secret-user' })],
      isLoading: false,
      error: null,
    } as any);

    renderWithProviders(<Secrets />);

    await user.click(screen.getByRole('button', { name: 'db-creds' }));

    expect(screen.getByText('Secret/default/db-creds')).toBeInTheDocument();
    expect(screen.getByText('Values are redacted — only key names and type are shown.')).toBeInTheDocument();
    expect(screen.queryByText('super-secret-user')).not.toBeInTheDocument();
  });

  it('shows a spinner while loading', () => {
    vi.mocked(useSecrets).mockReturnValue({ data: undefined, isLoading: true, error: null } as any);

    renderWithProviders(<Secrets />);

    expect(screen.getByLabelText('Loading resources')).toBeInTheDocument();
  });

  it('propagates a fetch error to the table', () => {
    vi.mocked(useSecrets).mockReturnValue({ data: undefined, isLoading: false, error: new Error('boom') } as any);

    renderWithProviders(<Secrets />);

    expect(screen.getByText('boom')).toBeInTheDocument();
  });
});

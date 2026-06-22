import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConnectionProvider } from '../context/ConnectionContext';
import { Settings } from './Settings';
import { useNodes } from '../hooks/useK8sResources';
import type { K8sNode } from '../types/k8s';

vi.mock('../hooks/useK8sResources', () => ({
  useNodes: vi.fn(),
}));

const STORAGE_KEY = 'kubexeye.connection';

function node(name: string): K8sNode {
  return { metadata: { name } };
}

function renderSettings() {
  return render(
    <ConnectionProvider>
      <Settings />
    </ConnectionProvider>,
  );
}

describe('Settings page', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the current connection config in the form inputs', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ apiBase: 'https://example.test', token: 'abc123' }));
    vi.mocked(useNodes).mockReturnValue({ data: [node('node-1')], isLoading: false, error: null } as any);

    renderSettings();

    expect(screen.getByLabelText('API Base URL')).toHaveValue('https://example.test');
    expect(screen.getByLabelText('Bearer Token (optional)')).toHaveValue('abc123');
  });

  it('falls back to the default apiBase when nothing is persisted', () => {
    vi.mocked(useNodes).mockReturnValue({ data: [], isLoading: false, error: null } as any);

    renderSettings();

    expect(screen.getByLabelText('API Base URL')).toHaveValue('/k8s-api');
    expect(screen.getByLabelText('Bearer Token (optional)')).toHaveValue('');
  });

  it('persists a new apiBase/token to localStorage and shows a saved confirmation on submit', async () => {
    const user = userEvent.setup();
    vi.mocked(useNodes).mockReturnValue({ data: [], isLoading: false, error: null } as any);

    renderSettings();

    const apiBaseInput = screen.getByLabelText('API Base URL');
    const tokenInput = screen.getByLabelText('Bearer Token (optional)');

    await user.clear(apiBaseInput);
    await user.type(apiBaseInput, 'https://new-cluster:6443');
    await user.clear(tokenInput);
    await user.type(tokenInput, 'new-token');

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText('Saved')).toBeInTheDocument();
    expect(screen.getByText('Connection settings updated.')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({
      apiBase: 'https://new-cluster:6443',
      token: 'new-token',
    });
  });

  it('shows a checking indicator while the health check is loading', () => {
    vi.mocked(useNodes).mockReturnValue({ data: undefined, isLoading: true, error: null } as any);

    renderSettings();

    expect(screen.getByText('Checking connection...')).toBeInTheDocument();
  });

  it('shows a connected indicator with the node count on success', () => {
    vi.mocked(useNodes).mockReturnValue({
      data: [node('node-1'), node('node-2')],
      isLoading: false,
      error: null,
    } as any);

    renderSettings();

    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('Found 2 node(s).')).toBeInTheDocument();
  });

  it('shows a connection-failed indicator with the error message', () => {
    vi.mocked(useNodes).mockReturnValue({ data: undefined, isLoading: false, error: new Error('boom') } as any);

    renderSettings();

    expect(screen.getByText('Connection failed')).toBeInTheDocument();
    expect(screen.getByText('boom')).toBeInTheDocument();
  });
});

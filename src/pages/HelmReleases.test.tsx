import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/renderWithProviders';
import { HelmReleases } from './HelmReleases';
import { useHelmReleases } from '../hooks/useHelmReleases';
import type { HelmReleaseInfo } from '../types/helm';

vi.mock('../hooks/useHelmReleases', () => ({
  useHelmReleases: vi.fn(),
}));

function release(overrides: Partial<HelmReleaseInfo> = {}): HelmReleaseInfo {
  return {
    name: 'my-release',
    namespace: 'default',
    revision: 1,
    status: 'deployed',
    chartName: 'nginx',
    chartVersion: '1.2.3',
    appVersion: '1.25.0',
    lastDeployed: '2024-01-01T00:00:00Z',
    values: { replicaCount: 2 },
    ...overrides,
  };
}

describe('HelmReleases page', () => {
  it('renders a release row with its status label and chart details', () => {
    vi.mocked(useHelmReleases).mockReturnValue({
      data: [release()],
      isLoading: false,
      error: null,
    } as any);

    renderWithProviders(<HelmReleases />);

    expect(screen.getByText('my-release')).toBeInTheDocument();
    expect(screen.getByText('default')).toBeInTheDocument();
    expect(screen.getByText('deployed')).toBeInTheDocument();
    expect(screen.getByText('nginx')).toBeInTheDocument();
    expect(screen.getByText('1.2.3')).toBeInTheDocument();
    expect(screen.getByText('1.25.0')).toBeInTheDocument();
  });

  it('colors a failed release status distinctly from a deployed one', () => {
    vi.mocked(useHelmReleases).mockReturnValue({
      data: [release({ name: 'release-a', status: 'deployed' }), release({ name: 'release-b', status: 'failed' })],
      isLoading: false,
      error: null,
    } as any);

    renderWithProviders(<HelmReleases />);

    const deployedLabel = screen.getByText('deployed').closest('.pf-v6-c-label');
    const failedLabel = screen.getByText('failed').closest('.pf-v6-c-label');
    expect(deployedLabel?.className).toMatch(/pf-m-green/);
    expect(failedLabel?.className).toMatch(/pf-m-red/);
  });

  it('opens the values definition modal when the Values button is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(useHelmReleases).mockReturnValue({
      data: [release({ name: 'my-release', chartName: 'nginx' })],
      isLoading: false,
      error: null,
    } as any);

    renderWithProviders(<HelmReleases />);

    await user.click(screen.getByRole('button', { name: 'Values' }));

    expect(screen.getByText('Values: my-release (nginx)')).toBeInTheDocument();
  });

  it('shows a spinner while loading', () => {
    vi.mocked(useHelmReleases).mockReturnValue({ data: undefined, isLoading: true, error: null } as any);

    renderWithProviders(<HelmReleases />);

    expect(screen.getByLabelText('Loading resources')).toBeInTheDocument();
  });

  it('propagates a fetch error to the table', () => {
    vi.mocked(useHelmReleases).mockReturnValue({ data: undefined, isLoading: false, error: new Error('boom') } as any);

    renderWithProviders(<HelmReleases />);

    expect(screen.getByText('boom')).toBeInTheDocument();
  });

  it('falls back to an em dash when appVersion or lastDeployed are missing', () => {
    vi.mocked(useHelmReleases).mockReturnValue({
      data: [release({ appVersion: undefined, lastDeployed: undefined })],
      isLoading: false,
      error: null,
    } as any);

    renderWithProviders(<HelmReleases />);

    expect(screen.getAllByText('—')).toHaveLength(2);
  });
});

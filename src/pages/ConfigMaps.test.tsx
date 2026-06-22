import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/renderWithProviders';
import { ConfigMaps } from './ConfigMaps';
import { useConfigMaps } from '../hooks/useK8sResources';
import type { K8sConfigMap } from '../types/k8s';

vi.mock('../hooks/useK8sResources', () => ({
  useConfigMaps: vi.fn(),
}));

function configMap(name: string, namespace: string, data: Record<string, string>): K8sConfigMap {
  return { metadata: { name, namespace }, data };
}

describe('ConfigMaps page', () => {
  it('renders each ConfigMap with its key count and key names', () => {
    vi.mocked(useConfigMaps).mockReturnValue({
      data: [configMap('app-config', 'default', { 'app.yaml': 'x', 'log.yaml': 'y' })],
      isLoading: false,
      error: null,
    } as any);

    renderWithProviders(<ConfigMaps />);

    expect(screen.getByText('app-config')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('app.yaml, log.yaml')).toBeInTheDocument();
  });

  it('still includes a Dependencies (Map) link per row', () => {
    vi.mocked(useConfigMaps).mockReturnValue({
      data: [configMap('app-config', 'default', {})],
      isLoading: false,
      error: null,
    } as any);

    renderWithProviders(<ConfigMaps />);

    expect(screen.getByRole('link', { name: 'Map' })).toBeInTheDocument();
  });

  it('opens the YAML definition when the name is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(useConfigMaps).mockReturnValue({
      data: [configMap('app-config', 'default', {})],
      isLoading: false,
      error: null,
    } as any);

    renderWithProviders(<ConfigMaps />);

    await user.click(screen.getByRole('button', { name: 'app-config' }));

    expect(screen.getByText('ConfigMap/default/app-config')).toBeInTheDocument();
  });

  it('propagates a fetch error to the table', () => {
    vi.mocked(useConfigMaps).mockReturnValue({ data: undefined, isLoading: false, error: new Error('boom') } as any);

    renderWithProviders(<ConfigMaps />);

    expect(screen.getByText('boom')).toBeInTheDocument();
  });
});

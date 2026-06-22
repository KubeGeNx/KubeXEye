import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/renderWithProviders';
import { PersistentVolumeClaims } from './PersistentVolumeClaims';
import { usePersistentVolumeClaims } from '../hooks/useK8sResources';
import type { K8sPersistentVolumeClaim } from '../types/k8s';

vi.mock('../hooks/useK8sResources', () => ({
  usePersistentVolumeClaims: vi.fn(),
}));

function pvc(name: string, namespace: string): K8sPersistentVolumeClaim {
  return {
    metadata: { name, namespace },
    spec: { storageClassName: 'standard', accessModes: ['ReadWriteOnce'] },
    status: { phase: 'Bound', capacity: { storage: '10Gi' } },
  };
}

describe('PersistentVolumeClaims page', () => {
  it('renders each PVC with its status, capacity, storage class and access modes', () => {
    vi.mocked(usePersistentVolumeClaims).mockReturnValue({
      data: [pvc('data-pvc', 'default')],
      isLoading: false,
      error: null,
    } as any);

    renderWithProviders(<PersistentVolumeClaims />);

    expect(screen.getByText('data-pvc')).toBeInTheDocument();
    expect(screen.getByText('Bound')).toBeInTheDocument();
    expect(screen.getByText('10Gi')).toBeInTheDocument();
    expect(screen.getByText('standard')).toBeInTheDocument();
    expect(screen.getByText('ReadWriteOnce')).toBeInTheDocument();
  });

  it('still includes a Dependencies (Map) link per row', () => {
    vi.mocked(usePersistentVolumeClaims).mockReturnValue({
      data: [pvc('data-pvc', 'default')],
      isLoading: false,
      error: null,
    } as any);

    renderWithProviders(<PersistentVolumeClaims />);

    expect(screen.getByRole('link', { name: 'Map' })).toBeInTheDocument();
  });

  it('opens the YAML definition when the name is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(usePersistentVolumeClaims).mockReturnValue({
      data: [pvc('data-pvc', 'default')],
      isLoading: false,
      error: null,
    } as any);

    renderWithProviders(<PersistentVolumeClaims />);

    await user.click(screen.getByRole('button', { name: 'data-pvc' }));

    expect(screen.getByText('PVC/default/data-pvc')).toBeInTheDocument();
  });

  it('shows a spinner while loading', () => {
    vi.mocked(usePersistentVolumeClaims).mockReturnValue({ data: undefined, isLoading: true, error: null } as any);

    renderWithProviders(<PersistentVolumeClaims />);

    expect(screen.getByLabelText('Loading resources')).toBeInTheDocument();
  });

  it('propagates a fetch error to the table', () => {
    vi.mocked(usePersistentVolumeClaims).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('boom'),
    } as any);

    renderWithProviders(<PersistentVolumeClaims />);

    expect(screen.getByText('boom')).toBeInTheDocument();
  });
});

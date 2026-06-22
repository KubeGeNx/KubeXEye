import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/renderWithProviders';
import { StorageClasses } from './StorageClasses';
import { useStorageClasses } from '../hooks/useK8sResources';
import type { K8sStorageClass } from '../types/k8s';

vi.mock('../hooks/useK8sResources', () => ({
  useStorageClasses: vi.fn(),
}));

function storageClass(
  name: string,
  provisioner: string,
  reclaimPolicy: string,
  volumeBindingMode: string,
): K8sStorageClass {
  return { metadata: { name }, provisioner, reclaimPolicy, volumeBindingMode };
}

describe('StorageClasses page', () => {
  it('renders each storage class with its provisioner, reclaim policy, and binding mode', () => {
    vi.mocked(useStorageClasses).mockReturnValue({
      data: [storageClass('standard', 'kubernetes.io/aws-ebs', 'Delete', 'WaitForFirstConsumer')],
      isLoading: false,
      error: null,
    } as any);

    renderWithProviders(<StorageClasses />);

    expect(screen.getByText('standard')).toBeInTheDocument();
    expect(screen.getByText('kubernetes.io/aws-ebs')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.getByText('WaitForFirstConsumer')).toBeInTheDocument();
  });

  it('still includes a Dependencies (Map) link per row', () => {
    vi.mocked(useStorageClasses).mockReturnValue({
      data: [storageClass('standard', 'kubernetes.io/aws-ebs', 'Delete', 'WaitForFirstConsumer')],
      isLoading: false,
      error: null,
    } as any);

    renderWithProviders(<StorageClasses />);

    expect(screen.getByRole('link', { name: 'Map' })).toBeInTheDocument();
  });

  it('opens the YAML definition when the name is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(useStorageClasses).mockReturnValue({
      data: [storageClass('standard', 'kubernetes.io/aws-ebs', 'Delete', 'WaitForFirstConsumer')],
      isLoading: false,
      error: null,
    } as any);

    renderWithProviders(<StorageClasses />);

    await user.click(screen.getByRole('button', { name: 'standard' }));

    expect(screen.getByText('StorageClass/standard')).toBeInTheDocument();
  });

  it('shows a spinner while loading', () => {
    vi.mocked(useStorageClasses).mockReturnValue({ data: undefined, isLoading: true, error: null } as any);

    renderWithProviders(<StorageClasses />);

    expect(screen.getByLabelText('Loading resources')).toBeInTheDocument();
  });

  it('propagates a fetch error to the table', () => {
    vi.mocked(useStorageClasses).mockReturnValue({ data: undefined, isLoading: false, error: new Error('boom') } as any);

    renderWithProviders(<StorageClasses />);

    expect(screen.getByText('boom')).toBeInTheDocument();
  });
});

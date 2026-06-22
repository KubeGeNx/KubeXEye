import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../test/renderWithProviders';
import { Images } from './Images';
import { usePods } from '../hooks/useK8sResources';
import type { K8sPod } from '../types/k8s';

vi.mock('../hooks/useK8sResources', () => ({
  usePods: vi.fn(),
}));

type PodPhase = 'Pending' | 'Running' | 'Succeeded' | 'Failed' | 'Unknown';

function pod(name: string, namespace: string, image: string, phase: PodPhase = 'Running'): K8sPod {
  return {
    metadata: { name, namespace },
    spec: { containers: [{ name: 'app', image }] },
    status: { phase },
  };
}

describe('Images page', () => {
  it('groups pods by image within a namespace, counting pods and distinguishing distinct images', () => {
    vi.mocked(usePods).mockReturnValue({
      data: [
        pod('web-1', 'default', 'nginx:1.25'),
        pod('web-2', 'default', 'nginx:1.25'),
        pod('worker-1', 'default', 'busybox:latest'),
      ],
      isLoading: false,
      error: null,
    } as any);

    renderWithProviders(<Images />);

    expect(screen.getByText('nginx:1.25')).toBeInTheDocument();
    expect(screen.getByText('busybox:latest')).toBeInTheDocument();

    // nginx:1.25 row: 2 pods, both running
    expect(screen.getByText('2/2 Running')).toBeInTheDocument();
    // busybox:latest row: 1 pod, running
    expect(screen.getByText('1/1 Running')).toBeInTheDocument();

    // Pod names are surfaced per image row.
    expect(screen.getByText('web-1, web-2')).toBeInTheDocument();
    expect(screen.getByText('worker-1')).toBeInTheDocument();
  });

  it('marks an image as not running when none of its pods are in the Running phase', () => {
    vi.mocked(usePods).mockReturnValue({
      data: [pod('pending-1', 'default', 'redis:7', 'Pending')],
      isLoading: false,
      error: null,
    } as any);

    renderWithProviders(<Images />);

    expect(screen.getByText('redis:7')).toBeInTheDocument();
    expect(screen.getByText('0/1 Running')).toBeInTheDocument();
  });

  it('propagates a fetch error to the table', () => {
    vi.mocked(usePods).mockReturnValue({ data: undefined, isLoading: false, error: new Error('boom') } as any);

    renderWithProviders(<Images />);

    expect(screen.getByText('boom')).toBeInTheDocument();
  });
});

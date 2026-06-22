import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../test/renderWithProviders';
import { PanicPage } from './PanicPage';
import { useNodes, useClusterTopology, useEvents } from '../hooks/useK8sResources';
import type { K8sNode } from '../types/k8s';
import type { ClusterTopologyInput } from '../graph/buildResourceGraph';

vi.mock('../hooks/useK8sResources', () => ({
  useNodes: vi.fn(),
  useClusterTopology: vi.fn(),
  useEvents: vi.fn(),
}));

function emptyTopology(overrides: Partial<ClusterTopologyInput> = {}): ClusterTopologyInput & { isLoading: boolean } {
  return {
    isLoading: false,
    pods: [],
    configMaps: [],
    secrets: [],
    serviceAccounts: [],
    deployments: [],
    statefulSets: [],
    daemonSets: [],
    services: [],
    ingresses: [],
    pvcs: [],
    storageClasses: [],
    roles: [],
    roleBindings: [],
    clusterRoles: [],
    clusterRoleBindings: [],
    ...overrides,
  };
}

function notReadyNode(name: string): K8sNode {
  return {
    metadata: { name },
    status: { conditions: [{ type: 'Ready', status: 'False', reason: 'KubeletNotReady', message: 'kubelet has not posted status' }] },
  };
}

function readyNode(name: string): K8sNode {
  return { metadata: { name }, status: { conditions: [{ type: 'Ready', status: 'True' }] } };
}

const emptyEvents = { data: [], isLoading: false, error: null } as any;

describe('PanicPage', () => {
  it('surfaces a node-not-ready issue with its severity', () => {
    vi.mocked(useNodes).mockReturnValue({ data: [notReadyNode('node-1')], isLoading: false, error: null } as any);
    vi.mocked(useClusterTopology).mockReturnValue(emptyTopology());
    vi.mocked(useEvents).mockReturnValue(emptyEvents);

    renderWithProviders(<PanicPage />);

    expect(screen.getByText('Node node-1 is not Ready')).toBeInTheDocument();
    expect(screen.getAllByText('Critical').length).toBeGreaterThan(0);
    expect(screen.queryByText('No active issues detected. Everything looks healthy.')).not.toBeInTheDocument();
  });

  it('shows the all-clear empty state when nothing is wrong', () => {
    vi.mocked(useNodes).mockReturnValue({ data: [readyNode('node-1')], isLoading: false, error: null } as any);
    vi.mocked(useClusterTopology).mockReturnValue(emptyTopology());
    vi.mocked(useEvents).mockReturnValue(emptyEvents);

    renderWithProviders(<PanicPage />);

    expect(screen.getByText('No active issues detected. Everything looks healthy.')).toBeInTheDocument();
    expect(screen.getByText('No recent warning events.')).toBeInTheDocument();
  });
});

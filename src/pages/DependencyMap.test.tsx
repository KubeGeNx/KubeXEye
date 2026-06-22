import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../test/renderWithProviders';
import { DependencyMap } from './DependencyMap';
import { useNamespaces, useClusterTopology } from '../hooks/useK8sResources';
import type { K8sNamespace, K8sPod, K8sConfigMap, PodVolume } from '../types/k8s';
import type { ClusterTopologyInput } from '../graph/buildResourceGraph';

vi.mock('../hooks/useK8sResources', () => ({
  useNamespaces: vi.fn(),
  useClusterTopology: vi.fn(),
}));

// echarts doesn't run cleanly in jsdom — stub the chart itself, since DependencyMap
// only cares that it renders, not what echarts does internally.
vi.mock('../components/charts/DependencyGraphChart', () => ({
  DependencyGraphChart: () => null,
}));

function namespace(name: string): K8sNamespace {
  return { metadata: { name } };
}

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

function pod(name: string, namespaceName: string, volumes: PodVolume[]): K8sPod {
  return {
    metadata: { name, namespace: namespaceName },
    spec: { containers: [{ name: 'app', image: 'nginx' }], volumes },
    status: { phase: 'Running', containerStatuses: [{ name: 'app', ready: true, restartCount: 0 }] },
  };
}

function configMap(name: string, namespaceName: string): K8sConfigMap {
  return { metadata: { name, namespace: namespaceName }, data: {} };
}

describe('DependencyMap page', () => {
  it('shows the empty state when no resource is selected in the URL', () => {
    vi.mocked(useNamespaces).mockReturnValue({ data: [namespace('default')], isLoading: false, error: null } as any);
    vi.mocked(useClusterTopology).mockReturnValue(emptyTopology());

    renderWithProviders(<DependencyMap />, { route: '/dependency-map' });

    expect(screen.getByText('Pick a resource above to view its dependency map.')).toBeInTheDocument();
  });

  it('shows the breadcrumb and forward dependency for a resource selected via the URL', () => {
    vi.mocked(useNamespaces).mockReturnValue({ data: [namespace('default')], isLoading: false, error: null } as any);
    vi.mocked(useClusterTopology).mockReturnValue(
      emptyTopology({
        pods: [pod('foo', 'default', [{ name: 'cfg', configMap: { name: 'app-config' } }])],
        configMaps: [configMap('app-config', 'default')],
      }),
    );

    renderWithProviders(<DependencyMap />, { route: '/dependency-map?kind=Pod&name=foo&namespace=default' });

    expect(screen.getByText('Pod/foo')).toBeInTheDocument();
    expect(screen.getByText('ConfigMap/app-config')).toBeInTheDocument();
    expect(screen.getByText('(mounts-configmap)')).toBeInTheDocument();
    expect(screen.getByText('Nothing references this resource.')).toBeInTheDocument();
  });
});

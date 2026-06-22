import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../test/renderWithProviders';
import { Dashboard } from './Dashboard';
import { useNodes, usePods, useNamespaces, useDeployments, useNodeMetrics } from '../hooks/useK8sResources';
import type { K8sNode, K8sPod, K8sNamespace, K8sDeployment, NodeMetrics } from '../types/k8s';

vi.mock('../hooks/useK8sResources', () => ({
  useNodes: vi.fn(),
  usePods: vi.fn(),
  useNamespaces: vi.fn(),
  useDeployments: vi.fn(),
  useNodeMetrics: vi.fn(),
}));

// echarts doesn't run cleanly in jsdom — stub the chart components themselves, since Dashboard
// only cares that it renders, not what echarts does internally.
vi.mock('../components/charts/UsageGaugeChart', () => ({
  UsageGaugeChart: () => null,
}));
vi.mock('../components/charts/DistributionPieChart', () => ({
  DistributionPieChart: () => null,
}));
vi.mock('../components/charts/TopUsageBarChart', () => ({
  TopUsageBarChart: () => null,
}));

function node(name: string, cpu: string, memory: string): K8sNode {
  return { metadata: { name }, status: { allocatable: { cpu, memory } } };
}

function pod(name: string, phase: NonNullable<K8sPod['status']>['phase']): K8sPod {
  return { metadata: { name, namespace: 'default' }, status: { phase } };
}

function namespace(name: string): K8sNamespace {
  return { metadata: { name } };
}

function deployment(name: string): K8sDeployment {
  return { metadata: { name, namespace: 'default' } };
}

function nodeMetrics(name: string, cpu: string, memory: string): NodeMetrics {
  return { metadata: { name }, timestamp: '2024-01-01T00:00:00Z', window: '30s', usage: { cpu, memory } };
}

function mockAll(overrides: {
  nodes?: K8sNode[];
  pods?: K8sPod[];
  namespaces?: K8sNamespace[];
  deployments?: K8sDeployment[];
  metrics?: NodeMetrics[];
  isLoading?: boolean;
} = {}) {
  const isLoading = overrides.isLoading ?? false;
  vi.mocked(useNodes).mockReturnValue({ data: overrides.nodes, isLoading, error: null } as any);
  vi.mocked(usePods).mockReturnValue({ data: overrides.pods, isLoading, error: null } as any);
  vi.mocked(useNamespaces).mockReturnValue({ data: overrides.namespaces, isLoading, error: null } as any);
  vi.mocked(useDeployments).mockReturnValue({ data: overrides.deployments, isLoading, error: null } as any);
  vi.mocked(useNodeMetrics).mockReturnValue({ data: overrides.metrics, isLoading, error: null } as any);
}

describe('Dashboard page', () => {
  it('shows summary counts derived from the mocked hook data', () => {
    mockAll({
      nodes: [node('node-1', '4', '16Gi'), node('node-2', '4', '16Gi')],
      pods: [pod('pod-1', 'Running'), pod('pod-2', 'Pending'), pod('pod-3', 'Running'), pod('pod-4', 'Running')],
      namespaces: [namespace('default'), namespace('kube-system'), namespace('kube-public')],
      deployments: [deployment('app-1')],
      metrics: [nodeMetrics('node-1', '500m', '2Gi'), nodeMetrics('node-2', '1', '4Gi')],
    });

    renderWithProviders(<Dashboard />);

    // Counts: 2 nodes, 3 namespaces, 4 pods, 1 deployment — all distinct so each card's value
    // can be asserted unambiguously by scoping to that card.
    const nodesCard = screen.getByText('Nodes').closest('.pf-v6-c-card');
    const namespacesCard = screen.getByText('Namespaces').closest('.pf-v6-c-card');
    const podsCard = screen.getByText('Pods').closest('.pf-v6-c-card');
    const deploymentsCard = screen.getByText('Deployments').closest('.pf-v6-c-card');

    expect(nodesCard).toHaveTextContent('2');
    expect(namespacesCard).toHaveTextContent('3');
    expect(podsCard).toHaveTextContent('4');
    expect(deploymentsCard).toHaveTextContent('1');
  });

  it('renders without throwing while loading (no data yet)', () => {
    mockAll({ isLoading: true });

    renderWithProviders(<Dashboard />);

    expect(screen.getByText('Nodes')).toBeInTheDocument();
    // Summary cards fall back to an em dash while data is undefined.
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('does not throw with empty arrays for all hooks (zero nodes/pods edge case)', () => {
    mockAll({
      nodes: [],
      pods: [],
      namespaces: [],
      deployments: [],
      metrics: [],
    });

    expect(() => renderWithProviders(<Dashboard />)).not.toThrow();

    // All four summary cards should show 0.
    expect(screen.getAllByText('0').length).toBe(4);
    // metrics-server alert appears because metrics resolved to an empty (non-loading) array.
    expect(screen.getByText('metrics-server not detected')).toBeInTheDocument();
  });
});

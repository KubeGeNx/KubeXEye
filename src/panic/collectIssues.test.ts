import { describe, it, expect } from 'vitest';
import {
  collectDependencyIssues,
  collectNodeIssues,
  collectPodIssues,
  collectStorageIssues,
  collectWorkloadIssues,
} from './collectIssues';
import { buildResourceGraph, type ClusterTopologyInput } from '../graph/buildResourceGraph';
import type { K8sNode, K8sPod } from '../types/k8s';

function emptyTopology(overrides: Partial<ClusterTopologyInput> = {}): ClusterTopologyInput {
  return {
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

describe('collectNodeIssues', () => {
  it('flags a node whose Ready condition is not True, with blast radius = scheduled pod count', () => {
    const node: K8sNode = {
      metadata: { name: 'worker-1' },
      status: { conditions: [{ type: 'Ready', status: 'False', message: 'kubelet stopped posting' }] },
    };
    const pods: K8sPod[] = [
      { metadata: { name: 'p1', namespace: 'default' }, spec: { nodeName: 'worker-1', containers: [] } },
      { metadata: { name: 'p2', namespace: 'default' }, spec: { nodeName: 'worker-1', containers: [] } },
      { metadata: { name: 'p3', namespace: 'default' }, spec: { nodeName: 'other-node', containers: [] } },
    ];

    const issues = collectNodeIssues([node], pods);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('Critical');
    expect(issues[0].blastRadius).toBe(2);
  });

  it('does not flag a Ready node', () => {
    const node: K8sNode = { metadata: { name: 'worker-1' }, status: { conditions: [{ type: 'Ready', status: 'True' }] } };
    expect(collectNodeIssues([node], [])).toHaveLength(0);
  });
});

describe('collectPodIssues', () => {
  it('flags a Failed pod as Critical', () => {
    const pod: K8sPod = { metadata: { name: 'p1', namespace: 'default' }, status: { phase: 'Failed' } };
    const graph = buildResourceGraph(emptyTopology());
    const issues = collectPodIssues([pod], graph);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('Critical');
  });

  it('does not flag a healthy Running pod', () => {
    const pod: K8sPod = {
      metadata: { name: 'p1', namespace: 'default' },
      status: { phase: 'Running', containerStatuses: [{ name: 'app', ready: true, restartCount: 0 }] },
    };
    const graph = buildResourceGraph(emptyTopology());
    expect(collectPodIssues([pod], graph)).toHaveLength(0);
  });

  it('escalates a long-Pending pod to High severity as "stuck"', () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60_000).toISOString();
    const pod: K8sPod = {
      metadata: { name: 'p1', namespace: 'default', creationTimestamp: tenMinutesAgo },
      status: { phase: 'Pending' },
    };
    const graph = buildResourceGraph(emptyTopology());
    const issues = collectPodIssues([pod], graph);
    expect(issues[0].severity).toBe('High');
    expect(issues[0].title).toContain('stuck');
  });

  it('keeps a freshly-Pending pod at Medium severity (not yet stuck)', () => {
    const pod: K8sPod = { metadata: { name: 'p1', namespace: 'default', creationTimestamp: new Date().toISOString() }, status: { phase: 'Pending' } };
    const graph = buildResourceGraph(emptyTopology());
    expect(collectPodIssues([pod], graph)[0].severity).toBe('Medium');
  });
});

describe('collectWorkloadIssues', () => {
  it('flags an unavailable Deployment as Critical with blast radius from managed pods', () => {
    const pod: K8sPod = {
      metadata: { name: 'web-1', namespace: 'default', labels: { app: 'web' } },
      spec: { containers: [] },
    };
    const topology = emptyTopology({
      pods: [pod],
      deployments: [
        { metadata: { name: 'web', namespace: 'default' }, spec: { replicas: 1, selector: { matchLabels: { app: 'web' } } }, status: { readyReplicas: 0 } },
      ],
    });
    const graph = buildResourceGraph(topology);
    const issues = collectWorkloadIssues(topology.deployments, [], [], graph);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('Critical');
    expect(issues[0].blastRadius).toBe(1);
  });

  it('does not flag a fully-ready Deployment', () => {
    const topology = emptyTopology({
      deployments: [{ metadata: { name: 'web', namespace: 'default' }, spec: { replicas: 2 }, status: { readyReplicas: 2 } }],
    });
    const graph = buildResourceGraph(topology);
    expect(collectWorkloadIssues(topology.deployments, [], [], graph)).toHaveLength(0);
  });
});

describe('collectStorageIssues', () => {
  it('flags a Lost PVC as Critical', () => {
    const topology = emptyTopology({ pvcs: [{ metadata: { name: 'data', namespace: 'default' }, status: { phase: 'Lost' } }] });
    const graph = buildResourceGraph(topology);
    const issues = collectStorageIssues(topology.pvcs, graph);
    expect(issues[0].severity).toBe('Critical');
  });

  it('does not flag a Bound PVC', () => {
    const topology = emptyTopology({ pvcs: [{ metadata: { name: 'data', namespace: 'default' }, status: { phase: 'Bound' } }] });
    const graph = buildResourceGraph(topology);
    expect(collectStorageIssues(topology.pvcs, graph)).toHaveLength(0);
  });
});

describe('collectDependencyIssues', () => {
  it('groups multiple references to the same missing resource into a single issue with summed blast radius', () => {
    const podA: K8sPod = {
      metadata: { name: 'a', namespace: 'default' },
      spec: { containers: [{ name: 'app', image: 'i', envFrom: [{ configMapRef: { name: 'shared-config' } }] }] },
    };
    const podB: K8sPod = {
      metadata: { name: 'b', namespace: 'default' },
      spec: { containers: [{ name: 'app', image: 'i', envFrom: [{ configMapRef: { name: 'shared-config' } }] }] },
    };
    // Every pod implicitly references a "default" ServiceAccount unless one is specified — provide
    // it so the only broken reference left is the shared, intentionally-missing ConfigMap.
    const graph = buildResourceGraph(
      emptyTopology({ pods: [podA, podB], serviceAccounts: [{ metadata: { name: 'default', namespace: 'default' } }] }),
    );

    const issues = collectDependencyIssues(graph);
    expect(issues).toHaveLength(1);
    expect(issues[0].blastRadius).toBe(2);
    expect(issues[0].severity).toBe('Critical'); // ConfigMap is in the high-impact kind set
  });

  it('produces no issues when nothing references a nonexistent resource', () => {
    const graph = buildResourceGraph(emptyTopology());
    expect(collectDependencyIssues(graph)).toHaveLength(0);
  });
});

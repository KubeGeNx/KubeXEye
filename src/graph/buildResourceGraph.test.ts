import { describe, it, expect } from 'vitest';
import { buildResourceGraph, type ClusterTopologyInput } from './buildResourceGraph';
import { refId } from './types';
import type { K8sPod } from '../types/k8s';

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

describe('buildResourceGraph', () => {
  it('links a pod to its configmap, secret, and service account', () => {
    const pod: K8sPod = {
      metadata: { name: 'app-1', namespace: 'default' },
      spec: {
        serviceAccountName: 'app-sa',
        containers: [{ name: 'app', image: 'app:1' }],
        volumes: [{ name: 'cfg', configMap: { name: 'app-config' } }, { name: 'sec', secret: { secretName: 'app-secret' } }],
      },
    };

    const graph = buildResourceGraph(
      emptyTopology({
        pods: [pod],
        configMaps: [{ metadata: { name: 'app-config', namespace: 'default' } }],
        secrets: [{ metadata: { name: 'app-secret', namespace: 'default' } }],
        serviceAccounts: [{ metadata: { name: 'app-sa', namespace: 'default' } }],
      }),
    );

    const podRef = { kind: 'Pod' as const, name: 'app-1', namespace: 'default' };
    const relations = graph.edges.filter((e) => refId(e.from) === refId(podRef)).map((e) => e.relation);

    expect(relations).toContain('uses-serviceaccount');
    expect(relations).toContain('mounts-configmap');
    expect(relations).toContain('mounts-secret');
    expect(graph.edges.every((e) => !e.broken)).toBe(true);
  });

  it('flags a reference to a configmap that does not exist as broken, and adds a synthetic missing node', () => {
    const pod: K8sPod = {
      metadata: { name: 'app-1', namespace: 'default' },
      spec: {
        containers: [{ name: 'app', image: 'app:1', envFrom: [{ configMapRef: { name: 'does-not-exist' } }] }],
      },
    };

    const graph = buildResourceGraph(emptyTopology({ pods: [pod] }));

    const brokenEdge = graph.edges.find((e) => e.to.name === 'does-not-exist');
    expect(brokenEdge?.broken).toBe(true);

    const missingNode = graph.nodes.get(refId({ kind: 'ConfigMap', name: 'does-not-exist', namespace: 'default' }));
    expect(missingNode?.missing).toBe(true);
    expect(missingNode?.status).toBe('Error');
  });

  it('links a Deployment to the pods matched by its label selector', () => {
    const pod: K8sPod = {
      metadata: { name: 'web-abc123', namespace: 'default', labels: { app: 'web' } },
      spec: { containers: [{ name: 'web', image: 'web:1' }] },
    };

    const graph = buildResourceGraph(
      emptyTopology({
        pods: [pod],
        deployments: [
          {
            metadata: { name: 'web', namespace: 'default' },
            spec: { replicas: 1, selector: { matchLabels: { app: 'web' } } },
          },
        ],
      }),
    );

    const deploymentRef = { kind: 'Deployment' as const, name: 'web', namespace: 'default' };
    const managed = graph.edges.filter((e) => refId(e.from) === refId(deploymentRef) && e.relation === 'manages-pods');
    expect(managed).toHaveLength(1);
    expect(managed[0].to.name).toBe('web-abc123');
  });

  it('does not link a Deployment to pods in a different namespace even with matching labels', () => {
    const pod: K8sPod = {
      metadata: { name: 'web-abc123', namespace: 'other-ns', labels: { app: 'web' } },
      spec: { containers: [{ name: 'web', image: 'web:1' }] },
    };

    const graph = buildResourceGraph(
      emptyTopology({
        pods: [pod],
        deployments: [
          {
            metadata: { name: 'web', namespace: 'default' },
            spec: { replicas: 1, selector: { matchLabels: { app: 'web' } } },
          },
        ],
      }),
    );

    const deploymentRef = { kind: 'Deployment' as const, name: 'web', namespace: 'default' };
    const managed = graph.edges.filter((e) => refId(e.from) === refId(deploymentRef) && e.relation === 'manages-pods');
    expect(managed).toHaveLength(0);
  });

  it('links a Service to the pods matched by its selector', () => {
    const pod: K8sPod = {
      metadata: { name: 'web-abc123', namespace: 'default', labels: { app: 'web' } },
      spec: { containers: [{ name: 'web', image: 'web:1' }] },
    };

    const graph = buildResourceGraph(
      emptyTopology({
        pods: [pod],
        services: [{ metadata: { name: 'web-svc', namespace: 'default' }, spec: { selector: { app: 'web' } } }],
      }),
    );

    const svcRef = { kind: 'Service' as const, name: 'web-svc', namespace: 'default' };
    const selects = graph.edges.filter((e) => refId(e.from) === refId(svcRef) && e.relation === 'selects-pods');
    expect(selects).toHaveLength(1);
  });

  it('links an Ingress to its backend Service, including the default backend', () => {
    const graph = buildResourceGraph(
      emptyTopology({
        services: [{ metadata: { name: 'web-svc', namespace: 'default' } }],
        ingresses: [
          {
            metadata: { name: 'web-ingress', namespace: 'default' },
            spec: {
              rules: [{ host: 'example.com', http: { paths: [{ path: '/', backend: { service: { name: 'web-svc' } } }] } }],
            },
          },
        ],
      }),
    );

    const ingressRef = { kind: 'Ingress' as const, name: 'web-ingress', namespace: 'default' };
    const routes = graph.edges.filter((e) => refId(e.from) === refId(ingressRef) && e.relation === 'routes-to-service');
    expect(routes).toHaveLength(1);
    expect(routes[0].to.name).toBe('web-svc');
    expect(routes[0].broken).toBe(false);
  });

  it('links a PVC to its StorageClass', () => {
    const graph = buildResourceGraph(
      emptyTopology({
        pvcs: [{ metadata: { name: 'data', namespace: 'default' }, spec: { storageClassName: 'fast-ssd' } }],
        storageClasses: [{ metadata: { name: 'fast-ssd' }, provisioner: 'kubernetes.io/aws-ebs' }],
      }),
    );

    const pvcRef = { kind: 'PersistentVolumeClaim' as const, name: 'data', namespace: 'default' };
    const edge = graph.edges.find((e) => refId(e.from) === refId(pvcRef));
    expect(edge?.relation).toBe('pvc-bound-to-storageclass');
    expect(edge?.to.name).toBe('fast-ssd');
    expect(edge?.broken).toBe(false);
  });
});

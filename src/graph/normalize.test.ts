import { describe, it, expect } from 'vitest';
import { normalizeDaemonSet, normalizeDeployment, normalizePod, normalizePvc, normalizeStatefulSet } from './normalize';
import type { K8sDaemonSet, K8sDeployment, K8sPod, K8sPersistentVolumeClaim, K8sStatefulSet } from '../types/k8s';

describe('normalizePod', () => {
  const base = { metadata: { name: 'p', namespace: 'default' } };

  it('is Healthy when Running with all containers ready', () => {
    const pod: K8sPod = {
      ...base,
      status: { phase: 'Running', containerStatuses: [{ name: 'app', ready: true, restartCount: 0 }] },
    };
    expect(normalizePod(pod).status).toBe('Healthy');
  });

  it('is Warning when Running but a container is not ready', () => {
    const pod: K8sPod = {
      ...base,
      status: { phase: 'Running', containerStatuses: [{ name: 'app', ready: false, restartCount: 3 }] },
    };
    const result = normalizePod(pod);
    expect(result.status).toBe('Warning');
    expect(result.statusReason).toContain('1/1');
  });

  it('is Pending while scheduling', () => {
    const pod: K8sPod = { ...base, status: { phase: 'Pending' } };
    expect(normalizePod(pod).status).toBe('Pending');
  });

  it('is Error when Failed', () => {
    const pod: K8sPod = { ...base, status: { phase: 'Failed' } };
    expect(normalizePod(pod).status).toBe('Error');
  });

  it('is Healthy when Succeeded (e.g. a completed Job pod)', () => {
    const pod: K8sPod = { ...base, status: { phase: 'Succeeded' } };
    expect(normalizePod(pod).status).toBe('Healthy');
  });
});

describe('replica-based workload normalization', () => {
  it('Deployment is Healthy when ready replicas meet desired', () => {
    const d: K8sDeployment = { metadata: { name: 'd', namespace: 'ns' }, spec: { replicas: 3 }, status: { readyReplicas: 3 } };
    expect(normalizeDeployment(d).status).toBe('Healthy');
  });

  it('Deployment is Error when zero replicas are ready', () => {
    const d: K8sDeployment = { metadata: { name: 'd', namespace: 'ns' }, spec: { replicas: 3 }, status: { readyReplicas: 0 } };
    expect(normalizeDeployment(d).status).toBe('Error');
  });

  it('Deployment is Warning when partially ready', () => {
    const d: K8sDeployment = { metadata: { name: 'd', namespace: 'ns' }, spec: { replicas: 3 }, status: { readyReplicas: 1 } };
    expect(normalizeDeployment(d).status).toBe('Warning');
  });

  it('StatefulSet follows the same readyReplicas/replicas logic', () => {
    const s: K8sStatefulSet = { metadata: { name: 's', namespace: 'ns' }, spec: { replicas: 2 }, status: { readyReplicas: 2 } };
    expect(normalizeStatefulSet(s).status).toBe('Healthy');
  });

  it('DaemonSet uses numberReady/desiredNumberScheduled', () => {
    const ds: K8sDaemonSet = {
      metadata: { name: 'ds', namespace: 'ns' },
      status: { desiredNumberScheduled: 3, numberReady: 0 },
    };
    expect(normalizeDaemonSet(ds).status).toBe('Error');
  });
});

describe('normalizePvc', () => {
  it('is Healthy when Bound', () => {
    const pvc: K8sPersistentVolumeClaim = { metadata: { name: 'pvc', namespace: 'ns' }, status: { phase: 'Bound' } };
    expect(normalizePvc(pvc).status).toBe('Healthy');
  });

  it('is Pending while unbound', () => {
    const pvc: K8sPersistentVolumeClaim = { metadata: { name: 'pvc', namespace: 'ns' }, status: { phase: 'Pending' } };
    expect(normalizePvc(pvc).status).toBe('Pending');
  });

  it('is Error when Lost', () => {
    const pvc: K8sPersistentVolumeClaim = { metadata: { name: 'pvc', namespace: 'ns' }, status: { phase: 'Lost' } };
    expect(normalizePvc(pvc).status).toBe('Error');
  });
});

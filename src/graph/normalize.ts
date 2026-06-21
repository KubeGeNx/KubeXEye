import type {
  K8sPod,
  K8sDeployment,
  K8sStatefulSet,
  K8sDaemonSet,
  K8sConfigMap,
  K8sSecret,
  K8sServiceAccount,
  K8sService,
  K8sIngress,
  K8sPersistentVolumeClaim,
  K8sStorageClass,
} from '../types/k8s';
import type { HealthStatus, NormalizedResource } from './types';

function base(
  kind: NormalizedResource['ref']['kind'],
  obj: { metadata: { name: string; namespace?: string; uid?: string; labels?: Record<string, string>; creationTimestamp?: string } },
): Pick<NormalizedResource, 'ref' | 'uid' | 'labels' | 'createdAt'> {
  return {
    ref: { kind, name: obj.metadata.name, namespace: obj.metadata.namespace },
    uid: obj.metadata.uid,
    labels: obj.metadata.labels,
    createdAt: obj.metadata.creationTimestamp,
  };
}

export function normalizePod(pod: K8sPod): NormalizedResource {
  const phase = pod.status?.phase ?? 'Unknown';
  const containers = pod.status?.containerStatuses ?? [];
  const unready = containers.filter((c) => !c.ready).length;
  let status: HealthStatus = 'Unknown';
  let statusReason: string | undefined;
  if (phase === 'Running' && unready === 0) status = 'Healthy';
  else if (phase === 'Running' && unready > 0) {
    status = 'Warning';
    statusReason = `${unready}/${containers.length} containers not ready`;
  } else if (phase === 'Pending') {
    status = 'Pending';
  } else if (phase === 'Failed') {
    status = 'Error';
    statusReason = 'Pod failed';
  } else if (phase === 'Succeeded') {
    status = 'Healthy';
  }
  return { ...base('Pod', pod), status, statusReason };
}

function replicaStatus(ready: number, desired: number): { status: HealthStatus; reason?: string } {
  if (desired === 0) return { status: 'Unknown' };
  if (ready >= desired) return { status: 'Healthy' };
  if (ready === 0) return { status: 'Error', reason: `0/${desired} replicas ready` };
  return { status: 'Warning', reason: `${ready}/${desired} replicas ready` };
}

export function normalizeDeployment(d: K8sDeployment): NormalizedResource {
  const desired = d.spec?.replicas ?? 0;
  const ready = d.status?.readyReplicas ?? 0;
  const { status, reason } = replicaStatus(ready, desired);
  return { ...base('Deployment', d), status, statusReason: reason };
}

export function normalizeStatefulSet(s: K8sStatefulSet): NormalizedResource {
  const desired = s.spec?.replicas ?? 0;
  const ready = s.status?.readyReplicas ?? 0;
  const { status, reason } = replicaStatus(ready, desired);
  return { ...base('StatefulSet', s), status, statusReason: reason };
}

export function normalizeDaemonSet(d: K8sDaemonSet): NormalizedResource {
  const desired = d.status?.desiredNumberScheduled ?? 0;
  const ready = d.status?.numberReady ?? 0;
  const { status, reason } = replicaStatus(ready, desired);
  return { ...base('DaemonSet', d), status, statusReason: reason };
}

export function normalizeConfigMap(cm: K8sConfigMap): NormalizedResource {
  return { ...base('ConfigMap', cm), status: 'Healthy' };
}

export function normalizeSecret(s: K8sSecret): NormalizedResource {
  return { ...base('Secret', s), status: 'Healthy' };
}

export function normalizeServiceAccount(sa: K8sServiceAccount): NormalizedResource {
  return { ...base('ServiceAccount', sa), status: 'Healthy' };
}

export function normalizeService(svc: K8sService): NormalizedResource {
  return { ...base('Service', svc), status: 'Healthy' };
}

export function normalizeIngress(ing: K8sIngress): NormalizedResource {
  return { ...base('Ingress', ing), status: 'Healthy' };
}

export function normalizePvc(pvc: K8sPersistentVolumeClaim): NormalizedResource {
  const phase = pvc.status?.phase ?? 'Pending';
  const status: HealthStatus = phase === 'Bound' ? 'Healthy' : phase === 'Lost' ? 'Error' : 'Pending';
  return { ...base('PersistentVolumeClaim', pvc), status, statusReason: phase !== 'Bound' ? phase : undefined };
}

export function normalizeStorageClass(sc: K8sStorageClass): NormalizedResource {
  return { ...base('StorageClass', sc), status: 'Healthy' };
}

export type ResourceKind =
  | 'Pod'
  | 'Deployment'
  | 'StatefulSet'
  | 'DaemonSet'
  | 'ConfigMap'
  | 'Secret'
  | 'ServiceAccount'
  | 'Service'
  | 'Ingress'
  | 'PersistentVolumeClaim'
  | 'StorageClass';

export interface ResourceRef {
  kind: ResourceKind;
  name: string;
  namespace?: string;
}

export type HealthStatus = 'Healthy' | 'Warning' | 'Error' | 'Pending' | 'Unknown';

export interface NormalizedResource {
  ref: ResourceRef;
  uid?: string;
  status: HealthStatus;
  statusReason?: string;
  labels?: Record<string, string>;
  createdAt?: string;
  /** True when this node was only inferred from a reference and never found in the cluster. */
  missing?: boolean;
}

export type RelationKind =
  | 'mounts-configmap'
  | 'mounts-secret'
  | 'uses-serviceaccount'
  | 'mounts-pvc'
  | 'pulls-image-with-secret'
  | 'pvc-bound-to-storageclass'
  | 'selects-pods'
  | 'routes-to-service'
  | 'manages-pods';

export interface GraphEdge {
  from: ResourceRef;
  to: ResourceRef;
  relation: RelationKind;
  /** True when `to` does not resolve to an actual resource found in the cluster. */
  broken: boolean;
}

export function refId(ref: ResourceRef): string {
  return `${ref.kind}/${ref.namespace ?? '_cluster'}/${ref.name}`;
}

export interface ResourceGraph {
  nodes: Map<string, NormalizedResource>;
  edges: GraphEdge[];
}

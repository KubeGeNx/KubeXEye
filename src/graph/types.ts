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
  | 'StorageClass'
  | 'Role'
  | 'RoleBinding'
  | 'ClusterRole'
  | 'ClusterRoleBinding';

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
  | 'manages-pods'
  | 'binds-role'
  | 'grants-to-subject';

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
  /** Edges keyed by refId(edge.from), for O(1) forward-dependency lookups. */
  outgoing: Map<string, GraphEdge[]>;
  /** Edges keyed by refId(edge.to), for O(1) reverse-dependency lookups. */
  incoming: Map<string, GraphEdge[]>;
}

/** Builds the outgoing/incoming adjacency indexes for a completed edge list. */
export function buildAdjacency(edges: GraphEdge[]): { outgoing: Map<string, GraphEdge[]>; incoming: Map<string, GraphEdge[]> } {
  const outgoing = new Map<string, GraphEdge[]>();
  const incoming = new Map<string, GraphEdge[]>();
  for (const edge of edges) {
    const fromId = refId(edge.from);
    const toId = refId(edge.to);
    (outgoing.get(fromId) ?? outgoing.set(fromId, []).get(fromId)!).push(edge);
    (incoming.get(toId) ?? incoming.set(toId, []).get(toId)!).push(edge);
  }
  return { outgoing, incoming };
}

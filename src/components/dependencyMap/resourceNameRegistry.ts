import type { ClusterTopologyInput } from '../../graph/buildResourceGraph';
import type { ResourceKind } from '../../graph/types';

/** Maps each pickable resource kind to how its instance names are read off the topology. */
const NAMES_BY_KIND: Record<ResourceKind, (topology: ClusterTopologyInput) => string[]> = {
  Pod: (t) => t.pods.map((r) => r.metadata.name),
  Deployment: (t) => t.deployments.map((r) => r.metadata.name),
  StatefulSet: (t) => t.statefulSets.map((r) => r.metadata.name),
  DaemonSet: (t) => t.daemonSets.map((r) => r.metadata.name),
  Service: (t) => t.services.map((r) => r.metadata.name),
  Ingress: (t) => t.ingresses.map((r) => r.metadata.name),
  ConfigMap: (t) => t.configMaps.map((r) => r.metadata.name),
  Secret: (t) => t.secrets.map((r) => r.metadata.name),
  ServiceAccount: (t) => t.serviceAccounts.map((r) => r.metadata.name),
  PersistentVolumeClaim: (t) => t.pvcs.map((r) => r.metadata.name),
  StorageClass: (t) => t.storageClasses.map((r) => r.metadata.name),
  Role: (t) => t.roles.map((r) => r.metadata.name),
  RoleBinding: (t) => t.roleBindings.map((r) => r.metadata.name),
  ClusterRole: (t) => t.clusterRoles.map((r) => r.metadata.name),
  ClusterRoleBinding: (t) => t.clusterRoleBindings.map((r) => r.metadata.name),
};

export function namesForKind(kind: ResourceKind, topology: ClusterTopologyInput): string[] {
  return NAMES_BY_KIND[kind]?.(topology) ?? [];
}

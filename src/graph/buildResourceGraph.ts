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
  K8sRole,
  K8sRoleBinding,
  LabelSelector,
} from '../types/k8s';
import {
  normalizeClusterRole,
  normalizeClusterRoleBinding,
  normalizeConfigMap,
  normalizeDaemonSet,
  normalizeDeployment,
  normalizeIngress,
  normalizePod,
  normalizePvc,
  normalizeRole,
  normalizeRoleBinding,
  normalizeSecret,
  normalizeService,
  normalizeServiceAccount,
  normalizeStatefulSet,
  normalizeStorageClass,
} from './normalize';
import { buildAdjacency, refId, type GraphEdge, type NormalizedResource, type RelationKind, type ResourceGraph, type ResourceRef } from './types';
import { matchesSelector } from '../utils/labelSelector';

export interface ClusterTopologyInput {
  pods: K8sPod[];
  configMaps: K8sConfigMap[];
  secrets: K8sSecret[];
  serviceAccounts: K8sServiceAccount[];
  deployments: K8sDeployment[];
  statefulSets: K8sStatefulSet[];
  daemonSets: K8sDaemonSet[];
  services: K8sService[];
  ingresses: K8sIngress[];
  pvcs: K8sPersistentVolumeClaim[];
  storageClasses: K8sStorageClass[];
  roles: K8sRole[];
  roleBindings: K8sRoleBinding[];
  clusterRoles: K8sRole[];
  clusterRoleBindings: K8sRoleBinding[];
}

export function buildResourceGraph(input: ClusterTopologyInput): ResourceGraph {
  const nodes = new Map<string, NormalizedResource>();
  const edges: GraphEdge[] = [];

  const add = (n: NormalizedResource) => nodes.set(refId(n.ref), n);

  input.configMaps.forEach((cm) => add(normalizeConfigMap(cm)));
  input.secrets.forEach((s) => add(normalizeSecret(s)));
  input.serviceAccounts.forEach((sa) => add(normalizeServiceAccount(sa)));
  input.services.forEach((svc) => add(normalizeService(svc)));
  input.ingresses.forEach((ing) => add(normalizeIngress(ing)));
  input.pvcs.forEach((pvc) => add(normalizePvc(pvc)));
  input.storageClasses.forEach((sc) => add(normalizeStorageClass(sc)));
  input.pods.forEach((p) => add(normalizePod(p)));
  input.deployments.forEach((d) => add(normalizeDeployment(d)));
  input.statefulSets.forEach((s) => add(normalizeStatefulSet(s)));
  input.daemonSets.forEach((d) => add(normalizeDaemonSet(d)));
  input.roles.forEach((r) => add(normalizeRole(r)));
  input.roleBindings.forEach((b) => add(normalizeRoleBinding(b)));
  input.clusterRoles.forEach((r) => add(normalizeClusterRole(r)));
  input.clusterRoleBindings.forEach((b) => add(normalizeClusterRoleBinding(b)));

  function link(from: ResourceRef, to: ResourceRef, relation: RelationKind) {
    const targetId = refId(to);
    let node = nodes.get(targetId);
    if (!node) {
      // Not just "missing on first sight" — once a target is known to be missing, every
      // subsequent edge to it must also be broken, not just the one that discovered it.
      node = { ref: to, status: 'Error', statusReason: 'Referenced but not found', missing: true };
      nodes.set(targetId, node);
    }
    edges.push({ from, to, relation, broken: node.missing === true });
  }

  for (const pod of input.pods) {
    const podRef: ResourceRef = { kind: 'Pod', name: pod.metadata.name, namespace: pod.metadata.namespace };
    const ns = pod.metadata.namespace;

    const saName = pod.spec?.serviceAccountName || 'default';
    link(podRef, { kind: 'ServiceAccount', name: saName, namespace: ns }, 'uses-serviceaccount');

    for (const pullSecret of pod.spec?.imagePullSecrets ?? []) {
      link(podRef, { kind: 'Secret', name: pullSecret.name, namespace: ns }, 'pulls-image-with-secret');
    }

    for (const volume of pod.spec?.volumes ?? []) {
      if (volume.configMap) link(podRef, { kind: 'ConfigMap', name: volume.configMap.name, namespace: ns }, 'mounts-configmap');
      if (volume.secret) link(podRef, { kind: 'Secret', name: volume.secret.secretName, namespace: ns }, 'mounts-secret');
      if (volume.persistentVolumeClaim)
        link(podRef, { kind: 'PersistentVolumeClaim', name: volume.persistentVolumeClaim.claimName, namespace: ns }, 'mounts-pvc');
    }

    for (const container of pod.spec?.containers ?? []) {
      for (const envFrom of container.envFrom ?? []) {
        if (envFrom.configMapRef) link(podRef, { kind: 'ConfigMap', name: envFrom.configMapRef.name, namespace: ns }, 'mounts-configmap');
        if (envFrom.secretRef) link(podRef, { kind: 'Secret', name: envFrom.secretRef.name, namespace: ns }, 'mounts-secret');
      }
      for (const env of container.env ?? []) {
        const cmRef = env.valueFrom?.configMapKeyRef;
        const secretRef = env.valueFrom?.secretKeyRef;
        if (cmRef) link(podRef, { kind: 'ConfigMap', name: cmRef.name, namespace: ns }, 'mounts-configmap');
        if (secretRef) link(podRef, { kind: 'Secret', name: secretRef.name, namespace: ns }, 'mounts-secret');
      }
    }
  }

  for (const pvc of input.pvcs) {
    if (pvc.spec?.storageClassName) {
      link(
        { kind: 'PersistentVolumeClaim', name: pvc.metadata.name, namespace: pvc.metadata.namespace },
        { kind: 'StorageClass', name: pvc.spec.storageClassName },
        'pvc-bound-to-storageclass',
      );
    }
  }

  function linkWorkloadToPods(workloadRef: ResourceRef, selector: LabelSelector | undefined) {
    const matchLabels = selector?.matchLabels;
    if (!matchLabels) return;
    for (const pod of input.pods) {
      if (pod.metadata.namespace !== workloadRef.namespace) continue;
      if (matchesSelector(pod.metadata.labels, matchLabels)) {
        link(workloadRef, { kind: 'Pod', name: pod.metadata.name, namespace: pod.metadata.namespace }, 'manages-pods');
      }
    }
  }

  for (const d of input.deployments) {
    linkWorkloadToPods({ kind: 'Deployment', name: d.metadata.name, namespace: d.metadata.namespace }, d.spec?.selector);
  }
  for (const s of input.statefulSets) {
    linkWorkloadToPods({ kind: 'StatefulSet', name: s.metadata.name, namespace: s.metadata.namespace }, s.spec?.selector);
  }
  for (const d of input.daemonSets) {
    linkWorkloadToPods({ kind: 'DaemonSet', name: d.metadata.name, namespace: d.metadata.namespace }, d.spec?.selector);
  }

  for (const svc of input.services) {
    const svcRef: ResourceRef = { kind: 'Service', name: svc.metadata.name, namespace: svc.metadata.namespace };
    const selector = svc.spec?.selector;
    if (!selector) continue;
    for (const pod of input.pods) {
      if (pod.metadata.namespace !== svc.metadata.namespace) continue;
      if (matchesSelector(pod.metadata.labels, selector)) {
        link(svcRef, { kind: 'Pod', name: pod.metadata.name, namespace: pod.metadata.namespace }, 'selects-pods');
      }
    }
  }

  for (const ing of input.ingresses) {
    const ingRef: ResourceRef = { kind: 'Ingress', name: ing.metadata.name, namespace: ing.metadata.namespace };
    const backends = [
      ing.spec?.defaultBackend,
      ...(ing.spec?.rules ?? []).flatMap((r) => r.http?.paths.map((p) => p.backend) ?? []),
    ];
    for (const backend of backends) {
      if (backend?.service) {
        link(ingRef, { kind: 'Service', name: backend.service.name, namespace: ing.metadata.namespace }, 'routes-to-service');
      }
    }
  }

  for (const binding of input.roleBindings) {
    const bindingRef: ResourceRef = { kind: 'RoleBinding', name: binding.metadata.name, namespace: binding.metadata.namespace };
    const roleKind = binding.roleRef.kind === 'ClusterRole' ? 'ClusterRole' : 'Role';
    link(
      bindingRef,
      { kind: roleKind, name: binding.roleRef.name, namespace: roleKind === 'Role' ? binding.metadata.namespace : undefined },
      'binds-role',
    );
    for (const subject of binding.subjects ?? []) {
      if (subject.kind !== 'ServiceAccount') continue;
      link(
        bindingRef,
        { kind: 'ServiceAccount', name: subject.name, namespace: subject.namespace ?? binding.metadata.namespace },
        'grants-to-subject',
      );
    }
  }

  for (const binding of input.clusterRoleBindings) {
    const bindingRef: ResourceRef = { kind: 'ClusterRoleBinding', name: binding.metadata.name };
    link(bindingRef, { kind: 'ClusterRole', name: binding.roleRef.name }, 'binds-role');
    for (const subject of binding.subjects ?? []) {
      if (subject.kind !== 'ServiceAccount') continue;
      link(bindingRef, { kind: 'ServiceAccount', name: subject.name, namespace: subject.namespace }, 'grants-to-subject');
    }
  }

  const { outgoing, incoming } = buildAdjacency(edges);
  return { nodes, edges, outgoing, incoming };
}

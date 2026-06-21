import type { K8sNode, K8sPod, K8sDeployment, K8sStatefulSet, K8sDaemonSet, K8sPersistentVolumeClaim } from '../types/k8s';
import { normalizeDaemonSet, normalizeDeployment, normalizePod, normalizePvc, normalizeStatefulSet } from '../graph/normalize';
import { getForwardDependencies, getReverseDependencies } from '../graph/neighborhood';
import type { ResourceGraph, ResourceRef } from '../graph/types';
import type { PanicIssue } from './types';

const STUCK_THRESHOLD_MS = 5 * 60 * 1000;

function ageMs(createdAt?: string): number {
  if (!createdAt) return 0;
  return Date.now() - new Date(createdAt).getTime();
}

export function collectNodeIssues(nodes: K8sNode[], pods: K8sPod[]): PanicIssue[] {
  const issues: PanicIssue[] = [];
  for (const node of nodes) {
    const ready = node.status?.conditions?.find((c) => c.type === 'Ready');
    if (ready?.status === 'True') continue;
    const scheduled = pods.filter((p) => p.spec?.nodeName === node.metadata.name).length;
    issues.push({
      id: `node/${node.metadata.name}`,
      severity: 'Critical',
      category: 'Node',
      title: `Node ${node.metadata.name} is not Ready`,
      detail: ready?.message ?? ready?.reason ?? 'Ready condition is not True',
      blastRadius: scheduled,
    });
  }
  return issues;
}

export function collectPodIssues(pods: K8sPod[], graph: ResourceGraph): PanicIssue[] {
  const issues: PanicIssue[] = [];
  for (const pod of pods) {
    const normalized = normalizePod(pod);
    if (normalized.status === 'Healthy') continue;
    const ref = normalized.ref;
    const stuck = normalized.status === 'Pending' && ageMs(pod.metadata.creationTimestamp) > STUCK_THRESHOLD_MS;
    const severity =
      normalized.status === 'Error' ? 'Critical' : normalized.status === 'Warning' || stuck ? 'High' : 'Medium';
    const reverse = getReverseDependencies(graph, ref).length;
    issues.push({
      id: `pod/${ref.namespace}/${ref.name}`,
      severity,
      category: 'Pod',
      title: `Pod ${ref.namespace}/${ref.name} is ${normalized.status.toLowerCase()}${stuck ? ' (stuck)' : ''}`,
      detail: normalized.statusReason,
      ref,
      blastRadius: 1 + reverse,
    });
  }
  return issues;
}

function workloadIssue(
  kind: 'Deployment' | 'StatefulSet' | 'DaemonSet',
  ref: ResourceRef,
  status: 'Healthy' | 'Warning' | 'Error' | 'Pending' | 'Unknown',
  reason: string | undefined,
  graph: ResourceGraph,
): PanicIssue | null {
  if (status === 'Healthy') return null;
  const managedPods = getForwardDependencies(graph, ref).filter((e) => e.relation === 'manages-pods').length;
  return {
    id: `${kind.toLowerCase()}/${ref.namespace}/${ref.name}`,
    severity: status === 'Error' ? 'Critical' : 'High',
    category: 'Workload',
    title: `${kind} ${ref.namespace}/${ref.name} is not healthy`,
    detail: reason,
    ref,
    blastRadius: managedPods,
  };
}

export function collectWorkloadIssues(
  deployments: K8sDeployment[],
  statefulSets: K8sStatefulSet[],
  daemonSets: K8sDaemonSet[],
  graph: ResourceGraph,
): PanicIssue[] {
  const issues: PanicIssue[] = [];
  for (const d of deployments) {
    const n = normalizeDeployment(d);
    const issue = workloadIssue('Deployment', n.ref, n.status, n.statusReason, graph);
    if (issue) issues.push(issue);
  }
  for (const s of statefulSets) {
    const n = normalizeStatefulSet(s);
    const issue = workloadIssue('StatefulSet', n.ref, n.status, n.statusReason, graph);
    if (issue) issues.push(issue);
  }
  for (const d of daemonSets) {
    const n = normalizeDaemonSet(d);
    const issue = workloadIssue('DaemonSet', n.ref, n.status, n.statusReason, graph);
    if (issue) issues.push(issue);
  }
  return issues;
}

export function collectStorageIssues(pvcs: K8sPersistentVolumeClaim[], graph: ResourceGraph): PanicIssue[] {
  const issues: PanicIssue[] = [];
  for (const pvc of pvcs) {
    const n = normalizePvc(pvc);
    if (n.status === 'Healthy') continue;
    const stuck = n.status === 'Pending' && ageMs(pvc.metadata.creationTimestamp) > STUCK_THRESHOLD_MS;
    const severity = n.status === 'Error' ? 'Critical' : stuck ? 'High' : 'Medium';
    const reverse = getReverseDependencies(graph, n.ref).length;
    issues.push({
      id: `pvc/${n.ref.namespace}/${n.ref.name}`,
      severity,
      category: 'Storage',
      title: `PVC ${n.ref.namespace}/${n.ref.name} is ${n.statusReason?.toLowerCase() ?? 'not bound'}${stuck ? ' (stuck)' : ''}`,
      ref: n.ref,
      blastRadius: reverse,
    });
  }
  return issues;
}

export function collectDependencyIssues(graph: ResourceGraph): PanicIssue[] {
  const brokenByTarget = new Map<string, { ref: ResourceRef; count: number; sources: string[] }>();
  for (const edge of graph.edges) {
    if (!edge.broken) continue;
    const key = `${edge.to.kind}/${edge.to.namespace ?? '_cluster'}/${edge.to.name}`;
    const entry = brokenByTarget.get(key) ?? { ref: edge.to, count: 0, sources: [] };
    entry.count += 1;
    entry.sources.push(`${edge.from.kind}/${edge.from.name}`);
    brokenByTarget.set(key, entry);
  }

  const issues: PanicIssue[] = [];
  for (const [key, entry] of brokenByTarget) {
    const highImpact = entry.ref.kind === 'ServiceAccount' || entry.ref.kind === 'Secret' || entry.ref.kind === 'ConfigMap';
    issues.push({
      id: `broken/${key}`,
      severity: highImpact ? 'Critical' : 'High',
      category: 'Dependency',
      title: `${entry.ref.kind} ${entry.ref.name} is referenced but does not exist`,
      detail: `Referenced by: ${entry.sources.slice(0, 5).join(', ')}${entry.sources.length > 5 ? `, +${entry.sources.length - 5} more` : ''}`,
      ref: entry.ref,
      blastRadius: entry.count,
    });
  }
  return issues;
}

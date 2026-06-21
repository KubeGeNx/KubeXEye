import type { K8sPod } from '../types/k8s';

/** Flags containers with no resources.requests/limits defined — a common, actionable gap to surface. */
export function describeMissingResourceSpecs(pod: K8sPod): string | undefined {
  const issues: string[] = [];
  for (const container of pod.spec?.containers ?? []) {
    const requests = container.resources?.requests;
    const limits = container.resources?.limits;
    const missing: string[] = [];
    if (!requests || Object.keys(requests).length === 0) missing.push('requests');
    if (!limits || Object.keys(limits).length === 0) missing.push('limits');
    if (missing.length > 0) {
      issues.push(`Container "${container.name}" has no resource ${missing.join(' or ')} defined.`);
    }
  }
  return issues.length > 0 ? issues.join(' ') : undefined;
}

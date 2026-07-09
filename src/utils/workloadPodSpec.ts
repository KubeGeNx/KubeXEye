/** Kubernetes object kinds whose pod template lives at `spec.template.spec` rather than `spec`
 * itself. `CronJob` is handled separately below since its template is nested one level deeper. */
export const TEMPLATED_WORKLOAD_KINDS = new Set(['Deployment', 'StatefulSet', 'DaemonSet', 'Job', 'ReplicaSet']);

export interface WorkloadPodSpec {
  kind: string;
  /** Dot-path from the manifest root to the pod spec, for building YAML-path references. */
  yamlPrefix: string;
  podSpec: Record<string, any> | undefined;
}

/** Locates a workload manifest's pod spec and the YAML path prefix to it, covering `Pod`,
 * `CronJob`'s nested job template, and every kind in `TEMPLATED_WORKLOAD_KINDS`. Returns `undefined`
 * for kinds with no pod template (Service, ConfigMap, Role, etc.).
 *
 * Single source of truth shared by the Resource Analyser's best-practice checks
 * (`manifestRecommendations.ts`) and the Security Analyzer's rule engine (`securityAnalysis.ts`) —
 * keeping it in one place avoids the two drifting out of sync on which kinds are supported. */
export function resolveWorkloadPodSpec(manifest: Record<string, any>): WorkloadPodSpec | undefined {
  const kind = manifest.kind;
  if (kind === 'Pod') return { kind, yamlPrefix: 'spec', podSpec: manifest.spec };
  if (kind === 'CronJob') {
    return { kind, yamlPrefix: 'spec.jobTemplate.spec.template.spec', podSpec: manifest.spec?.jobTemplate?.spec?.template?.spec };
  }
  if (kind && TEMPLATED_WORKLOAD_KINDS.has(kind)) {
    return { kind, yamlPrefix: 'spec.template.spec', podSpec: manifest.spec?.template?.spec };
  }
  return undefined;
}

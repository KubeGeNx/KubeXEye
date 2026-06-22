export type RecommendationSeverity = 'danger' | 'warning' | 'info';

export interface Recommendation {
  severity: RecommendationSeverity;
  message: string;
}

interface ContainerLike {
  name?: string;
  image?: string;
  resources?: { requests?: Record<string, string>; limits?: Record<string, string> };
  livenessProbe?: unknown;
  readinessProbe?: unknown;
  securityContext?: { privileged?: boolean; runAsNonRoot?: boolean };
}

interface PodSpecLike {
  containers?: ContainerLike[];
  hostNetwork?: boolean;
  hostPID?: boolean;
  hostIPC?: boolean;
}

/** Workload kinds whose pod template lives at `spec.template.spec` rather than `spec` itself. */
const TEMPLATED_WORKLOAD_KINDS = new Set(['Deployment', 'StatefulSet', 'DaemonSet', 'Job']);

function extractPodSpec(manifest: Record<string, any>): PodSpecLike | undefined {
  const kind = manifest.kind;
  if (kind === 'Pod') return manifest.spec;
  if (kind === 'CronJob') return manifest.spec?.jobTemplate?.spec?.template?.spec;
  if (kind && TEMPLATED_WORKLOAD_KINDS.has(kind)) return manifest.spec?.template?.spec;
  return undefined;
}

function checkContainers(containers: ContainerLike[]): Recommendation[] {
  const recs: Recommendation[] = [];
  for (const c of containers) {
    const label = c.name ? `Container "${c.name}"` : 'A container';
    const requests = c.resources?.requests;
    const limits = c.resources?.limits;
    if (!requests || Object.keys(requests).length === 0) {
      recs.push({ severity: 'warning', message: `${label} has no resource requests — the scheduler can't reason about its footprint.` });
    }
    if (!limits || Object.keys(limits).length === 0) {
      recs.push({ severity: 'warning', message: `${label} has no resource limits — it can consume unbounded CPU/memory on its node.` });
    }
    if (!c.image || c.image.endsWith(':latest') || !c.image.includes(':')) {
      recs.push({ severity: 'warning', message: `${label} uses a "latest" or untagged image — pin an explicit, immutable tag (or digest) for repeatable rollouts.` });
    }
    if (!c.readinessProbe) {
      recs.push({ severity: 'info', message: `${label} has no readinessProbe — traffic may reach it before it's actually ready.` });
    }
    if (!c.livenessProbe) {
      recs.push({ severity: 'info', message: `${label} has no livenessProbe — a hung process won't be automatically restarted.` });
    }
    if (c.securityContext?.privileged) {
      recs.push({ severity: 'danger', message: `${label} runs privileged — it has full access to the host; avoid unless absolutely required.` });
    }
    if (c.securityContext?.runAsNonRoot !== true) {
      recs.push({ severity: 'info', message: `${label} doesn't set securityContext.runAsNonRoot — consider forcing non-root execution.` });
    }
  }
  return recs;
}

function checkWorkloadShape(manifest: Record<string, any>): Recommendation[] {
  const recs: Recommendation[] = [];
  const kind = manifest.kind;
  if (kind === 'Deployment' || kind === 'StatefulSet') {
    const replicas = manifest.spec?.replicas;
    if (typeof replicas === 'number' && replicas <= 1) {
      recs.push({ severity: 'info', message: `replicas is ${replicas} — a single replica has no failover if that pod is evicted or its node fails.` });
    }
  }
  const podSpec = extractPodSpec(manifest);
  if (podSpec?.hostNetwork) recs.push({ severity: 'warning', message: 'hostNetwork is true — this pod shares the node\'s network namespace, bypassing network policy isolation.' });
  if (podSpec?.hostPID) recs.push({ severity: 'warning', message: 'hostPID is true — this pod can see and signal every process on the node.' });
  if (podSpec?.hostIPC) recs.push({ severity: 'warning', message: 'hostIPC is true — this pod shares the node\'s IPC namespace.' });
  if (podSpec?.containers?.length) recs.push(...checkContainers(podSpec.containers));
  return recs;
}

function checkConfigOrSecret(manifest: Record<string, any>): Recommendation[] {
  const recs: Recommendation[] = [];
  if (manifest.kind === 'Secret' && !manifest.type) {
    recs.push({ severity: 'info', message: 'No `type` set — defaults to Opaque; set it explicitly (e.g. kubernetes.io/tls) if this secret has a specific shape.' });
  }
  if ((manifest.kind === 'ConfigMap' || manifest.kind === 'Secret') && !manifest.metadata?.labels) {
    recs.push({ severity: 'info', message: 'No labels set — labels make this resource discoverable by selectors and dashboards.' });
  }
  return recs;
}

function checkNetworking(manifest: Record<string, any>): Recommendation[] {
  const recs: Recommendation[] = [];
  if (manifest.kind === 'Service') {
    if (!manifest.spec?.selector || Object.keys(manifest.spec.selector).length === 0) {
      recs.push({ severity: 'warning', message: 'No spec.selector — this Service has no pods to route to.' });
    }
    if (manifest.spec?.type === 'LoadBalancer') {
      recs.push({ severity: 'info', message: 'type: LoadBalancer provisions a cloud load balancer — confirm that cost/quota is intended versus ClusterIP + Ingress.' });
    }
  }
  if (manifest.kind === 'Ingress' && !manifest.spec?.tls) {
    recs.push({ severity: 'warning', message: 'No spec.tls — traffic to this Ingress is unencrypted HTTP.' });
  }
  return recs;
}

function checkStorage(manifest: Record<string, any>): Recommendation[] {
  const recs: Recommendation[] = [];
  if (manifest.kind === 'PersistentVolumeClaim') {
    if (!manifest.spec?.storageClassName) {
      recs.push({ severity: 'info', message: 'No storageClassName — this will use the cluster\'s default StorageClass; set one explicitly if that\'s not intended.' });
    }
    if (manifest.spec?.accessModes?.includes('ReadWriteMany')) {
      recs.push({ severity: 'info', message: 'ReadWriteMany requested — confirm the target StorageClass\'s provisioner actually supports it.' });
    }
  }
  return recs;
}

function checkMetadata(manifest: Record<string, any>): Recommendation[] {
  const recs: Recommendation[] = [];
  if (!manifest.metadata?.name) {
    recs.push({ severity: 'danger', message: 'metadata.name is missing — every object needs a name.' });
  }
  return recs;
}

/** Runs a small set of best-practice checks against a parsed manifest, covering workloads
 * (Deployment/StatefulSet/DaemonSet/Job/CronJob/Pod), ConfigMaps/Secrets, Services/Ingress, and
 * PVCs. Deliberately heuristic and non-exhaustive — it flags common, actionable gaps rather than
 * attempting full policy enforcement. */
export function analyzeManifest(manifest: unknown): Recommendation[] {
  if (!manifest || typeof manifest !== 'object') return [];
  const obj = manifest as Record<string, any>;
  return [
    ...checkMetadata(obj),
    ...checkWorkloadShape(obj),
    ...checkConfigOrSecret(obj),
    ...checkNetworking(obj),
    ...checkStorage(obj),
  ];
}

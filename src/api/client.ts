import type { ConnectionConfig } from '../context/ConnectionContext';
import type { K8sStatus } from '../types/k8s';

export class K8sApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'K8sApiError';
  }
}

/** Returns a new headers object with the kubeconfig-context selection header added when a context
 * is set. Pure function — does not mutate the input. */
function withContextHeader(config: ConnectionConfig, headers: Record<string, string>): Record<string, string> {
  if (!config.context) return headers;
  return { ...headers, 'X-Kube-Context': config.context };
}

/** GET an arbitrary Kubernetes API path (e.g. "/api/v1/pods") and return the parsed JSON body. */
export async function k8sGet<T>(config: ConnectionConfig, path: string): Promise<T> {
  const url = `${config.apiBase}${path}`;
  const baseHeaders: Record<string, string> = { Accept: 'application/json' };
  if (config.token) baseHeaders.Authorization = `Bearer ${config.token}`;
  const headers = withContextHeader(config, baseHeaders);

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as K8sStatus | null;
    throw new K8sApiError(res.status, body?.message ?? `${res.status} ${res.statusText} for ${path}`);
  }
  return res.json() as Promise<T>;
}

/** GET an arbitrary Kubernetes API path and return the raw text body — used for endpoints like pod
 * logs that return plain text rather than a JSON resource. */
export async function k8sGetText(config: ConnectionConfig, path: string): Promise<string> {
  const url = `${config.apiBase}${path}`;
  const baseHeaders: Record<string, string> = {};
  if (config.token) baseHeaders.Authorization = `Bearer ${config.token}`;
  const headers = withContextHeader(config, baseHeaders);

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new K8sApiError(res.status, body || `${res.status} ${res.statusText} for ${path}`);
  }
  return res.text();
}

/** Server-side-apply `manifest` against `path` (a single-resource path, e.g.
 * "/apis/apps/v1/namespaces/default/deployments/my-app") with dryRun=All — the API server runs
 * full validation/admission but never persists anything to etcd. `force` is set so dry-running a
 * manifest doesn't spuriously fail with a field-manager conflict against whatever's already there;
 * since nothing is actually written, "forcing" here carries none of the risk it would on a real apply.
 * Requires `manifest.metadata.name` — server-side apply always targets a named object. */
export async function k8sApplyDryRun(config: ConnectionConfig, path: string, manifest: unknown): Promise<unknown> {
  const url = `${config.apiBase}${path}?fieldManager=kubexeye&force=true&dryRun=All`;
  const baseHeaders: Record<string, string> = {
    // Server-side apply requires this content type; the API server accepts JSON text under it
    // (valid JSON is valid YAML), so there's no need to actually emit YAML here.
    'Content-Type': 'application/apply-patch+yaml',
    Accept: 'application/json',
  };
  if (config.token) baseHeaders.Authorization = `Bearer ${config.token}`;
  const headers = withContextHeader(config, baseHeaders);

  const res = await fetch(url, { method: 'PATCH', headers, body: JSON.stringify(manifest) }); // `headers` already includes X-Kube-Context
  const body = (await res.json().catch(() => null)) as (K8sStatus & Record<string, unknown>) | null;
  if (!res.ok) {
    throw new K8sApiError(res.status, body?.message ?? `${res.status} ${res.statusText} for ${path}`);
  }
  return body;
}

/** Builds the collection path for a namespaced resource, honoring the "all namespaces" sentinel. */
export function namespacedPath(
  apiPrefix: string,
  namespace: string | undefined,
  plural: string,
): string {
  if (!namespace) return `${apiPrefix}/${plural}`;
  return `${apiPrefix}/namespaces/${namespace}/${plural}`;
}

// API group/version prefixes used across the app.
export const API = {
  core: '/api/v1',
  apps: '/apis/apps/v1',
  rbac: '/apis/rbac.authorization.k8s.io/v1',
  networking: '/apis/networking.k8s.io/v1',
  storage: '/apis/storage.k8s.io/v1',
  apiextensions: '/apis/apiextensions.k8s.io/v1',
  metrics: '/apis/metrics.k8s.io/v1beta1',
  events: '/apis/events.k8s.io/v1',
} as const;

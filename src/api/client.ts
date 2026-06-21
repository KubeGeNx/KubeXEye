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

/** GET an arbitrary Kubernetes API path (e.g. "/api/v1/pods") and return the parsed JSON body. */
export async function k8sGet<T>(config: ConnectionConfig, path: string): Promise<T> {
  const url = `${config.apiBase}${path}`;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (config.token) headers.Authorization = `Bearer ${config.token}`;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as K8sStatus | null;
    throw new K8sApiError(res.status, body?.message ?? `${res.status} ${res.statusText} for ${path}`);
  }
  return res.json() as Promise<T>;
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

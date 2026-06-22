import type { RequestOptions } from 'node:https';
import { KubeConfig } from '@kubernetes/client-node';

export interface ContextAuth {
  contextName: string;
  /** Base URL of the cluster's API server, e.g. "https://127.0.0.1:6443". */
  server: string;
  /** TLS + auth options resolved for this context (ca/cert/key/Authorization header/exec-plugin
   * token, etc.) — ready to spread into an https.request() call. */
  httpsOptions: RequestOptions;
}

let defaultConfig: KubeConfig | null = null;

function loadDefaultConfig(): KubeConfig {
  if (!defaultConfig) {
    defaultConfig = new KubeConfig();
    defaultConfig.loadFromDefault();
  }
  return defaultConfig;
}

/** Every context defined in the user's kubeconfig — the seam multi-cluster management would
 * build on. Only the current context is ever used today; this just makes "what else is
 * available" answerable without restructuring anything later. */
export function listContexts(): string[] {
  return loadDefaultConfig()
    .getContexts()
    .map((c) => c.name);
}

/** The kubeconfig's current-context name — used to mark which entry in `listContexts()` is the
 * default when no explicit context has been selected yet. */
export function getCurrentContextName(): string {
  return loadDefaultConfig().getCurrentContext();
}

async function resolveAuth(kc: KubeConfig, contextName: string): Promise<ContextAuth> {
  const cluster = kc.getCurrentCluster();
  if (!cluster) throw new Error(`Context "${contextName}" has no associated cluster in kubeconfig.`);
  const httpsOptions: RequestOptions = {};
  await kc.applyToHTTPSOptions(httpsOptions);
  return { contextName, server: cluster.server, httpsOptions };
}

/** Resolves the server URL and authenticated request options for a kubeconfig context —
 * everything a reverse proxy needs to forward a request to that cluster. Defaults to the
 * kubeconfig's current-context, which is all this app uses today (one proxy, one cluster).
 * Passing `contextName` resolves a *different* context from the same kubeconfig without
 * touching the default — that's the seam a future multi-cluster feature would call into,
 * one cluster connection per context rather than a rewrite of this function. */
export async function resolveContextAuth(contextName?: string): Promise<ContextAuth> {
  const defaultKc = loadDefaultConfig();
  if (!contextName || contextName === defaultKc.getCurrentContext()) {
    return resolveAuth(defaultKc, defaultKc.getCurrentContext());
  }
  // A private KubeConfig instance for the override, so concurrent requests against the default
  // context are never affected by switching context on a shared, cached instance.
  const scoped = new KubeConfig();
  scoped.loadFromDefault();
  scoped.setCurrentContext(contextName);
  return resolveAuth(scoped, contextName);
}

import { ungzip } from 'pako';
import type { K8sSecret } from '../types/k8s';
import type { HelmReleaseInfo } from '../types/helm';

// Helm v3 stores release state as a Secret (type "helm.sh/release.v1") whose `release` key holds
// base64(gzip(JSON)) — and the k8s API base64-encodes that string again as the Secret's `data` value,
// so decoding takes two base64 passes before gunzip. Chart/status metadata and the user-supplied
// values (`release.config`) are extracted — `release.manifest` is intentionally never parsed, since
// the rendered manifest can embed other resources' (e.g. chart-created Secrets) literal data.
export function decodeHelmReleaseSecret(secret: K8sSecret): HelmReleaseInfo | null {
  if (secret.type !== 'helm.sh/release.v1') return null;
  const raw = secret.data?.release;
  if (!raw) return null;

  try {
    const innerBase64 = atob(raw);
    const binaryGzip = atob(innerBase64);
    const gzipBytes = Uint8Array.from(binaryGzip, (c) => c.charCodeAt(0));
    const jsonBytes = ungzip(gzipBytes);
    const jsonStr = new TextDecoder('utf-8').decode(jsonBytes);
    const release = JSON.parse(jsonStr) as {
      name: string;
      namespace: string;
      version: number;
      info?: { status?: string; description?: string; last_deployed?: string };
      chart?: { metadata?: { name?: string; version?: string; appVersion?: string } };
      config?: Record<string, unknown>;
    };

    return {
      name: release.name,
      namespace: release.namespace,
      revision: release.version,
      status: release.info?.status ?? 'unknown',
      chartName: release.chart?.metadata?.name ?? 'unknown',
      chartVersion: release.chart?.metadata?.version ?? '—',
      appVersion: release.chart?.metadata?.appVersion,
      description: release.info?.description,
      lastDeployed: release.info?.last_deployed,
      values: release.config ?? {},
    };
  } catch {
    return null;
  }
}

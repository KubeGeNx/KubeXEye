import { describe, it, expect } from 'vitest';
import { gzip } from 'pako';
import { decodeHelmReleaseSecret } from './helmRelease';
import type { K8sSecret } from '../types/k8s';

/** Mirrors how Helm itself encodes a release into a Secret's `data.release` field. */
function encodeHelmRelease(release: unknown): string {
  const json = JSON.stringify(release);
  const gzipped = gzip(json);
  const binaryStr = Array.from(gzipped, (b) => String.fromCharCode(b)).join('');
  const innerBase64 = btoa(binaryStr);
  return btoa(innerBase64);
}

function helmSecret(release: unknown): K8sSecret {
  return {
    metadata: { name: 'sh.helm.release.v1.metrics-server.v1', namespace: 'kube-system' },
    type: 'helm.sh/release.v1',
    data: { release: encodeHelmRelease(release) },
  };
}

describe('decodeHelmReleaseSecret', () => {
  it('decodes chart metadata, status, and revision', () => {
    const release = {
      name: 'metrics-server',
      namespace: 'kube-system',
      version: 3,
      info: { status: 'deployed', description: 'Upgrade complete', last_deployed: '2026-06-22T00:07:25Z' },
      chart: { metadata: { name: 'metrics-server', version: '3.13.0', appVersion: '0.8.0' } },
      config: { defaultArgs: ['--kubelet-insecure-tls'] },
      manifest: 'apiVersion: v1\nkind: Secret\ndata:\n  password: dG90YWxseS1zZWNyZXQ=\n',
    };

    const result = decodeHelmReleaseSecret(helmSecret(release));

    expect(result).toEqual({
      name: 'metrics-server',
      namespace: 'kube-system',
      revision: 3,
      status: 'deployed',
      chartName: 'metrics-server',
      chartVersion: '3.13.0',
      appVersion: '0.8.0',
      description: 'Upgrade complete',
      lastDeployed: '2026-06-22T00:07:25Z',
      values: { defaultArgs: ['--kubelet-insecure-tls'] },
    });
  });

  it('never surfaces the rendered manifest, even though it is present in the underlying release', () => {
    const release = {
      name: 'r',
      namespace: 'ns',
      version: 1,
      info: { status: 'deployed' },
      chart: { metadata: { name: 'c', version: '1.0.0' } },
      manifest: 'kind: Secret\ndata:\n  password: dG90YWxseS1zZWNyZXQ=\n',
    };

    const result = decodeHelmReleaseSecret(helmSecret(release));

    expect(JSON.stringify(result)).not.toContain('dG90YWxseS1zZWNyZXQ');
    expect(result).not.toHaveProperty('manifest');
  });

  it('defaults values to an empty object when config is absent', () => {
    const release = { name: 'r', namespace: 'ns', version: 1, chart: { metadata: { name: 'c' } } };
    const result = decodeHelmReleaseSecret(helmSecret(release));
    expect(result?.values).toEqual({});
  });

  it('returns null for secrets that are not Helm releases', () => {
    const secret: K8sSecret = { metadata: { name: 'x', namespace: 'ns' }, type: 'Opaque', data: { foo: 'YmFy' } };
    expect(decodeHelmReleaseSecret(secret)).toBeNull();
  });

  it('returns null instead of throwing on corrupt release data', () => {
    const secret: K8sSecret = {
      metadata: { name: 'x', namespace: 'ns' },
      type: 'helm.sh/release.v1',
      data: { release: 'not-valid-base64-gzip!!' },
    };
    expect(decodeHelmReleaseSecret(secret)).toBeNull();
  });
});

import { useMemo } from 'react';
import { useSecrets } from './useK8sResources';
import { decodeHelmReleaseSecret } from '../utils/helmRelease';
import type { HelmReleaseInfo } from '../types/helm';

/** One row per release (namespace+name), keeping only its highest-revision secret — mirrors `helm list`. */
export function useHelmReleases(namespace: string) {
  const secrets = useSecrets(namespace);

  const releases = useMemo<HelmReleaseInfo[]>(() => {
    const latestByKey = new Map<string, HelmReleaseInfo>();
    for (const secret of secrets.data ?? []) {
      const release = decodeHelmReleaseSecret(secret);
      if (!release) continue;
      const key = `${release.namespace}/${release.name}`;
      const existing = latestByKey.get(key);
      if (!existing || release.revision > existing.revision) {
        latestByKey.set(key, release);
      }
    }
    return Array.from(latestByKey.values());
  }, [secrets.data]);

  return { ...secrets, data: releases };
}

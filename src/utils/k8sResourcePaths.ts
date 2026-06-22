/** Identifies a REST resource type — enough to build both its collection and single-object paths. */
export interface ResourceTypeInfo {
  group: string;
  version: string;
  kind: string;
  plural: string;
  namespaced: boolean;
}

/** Splits a manifest's `apiVersion` ("v1" or "apps/v1") into group/version, matching how the API
 * server itself distinguishes the core group (empty string) from named groups. */
export function parseApiVersion(apiVersion: string): { group: string; version: string } {
  const slash = apiVersion.indexOf('/');
  if (slash === -1) return { group: '', version: apiVersion };
  return { group: apiVersion.slice(0, slash), version: apiVersion.slice(slash + 1) };
}

/** Builds the single-object REST path for a resource — e.g. (apps, v1, deployments, true, 'default', 'web')
 * -> "/apis/apps/v1/namespaces/default/deployments/web". `namespace` is ignored for cluster-scoped kinds. */
export function resourceObjectPath(type: ResourceTypeInfo, namespace: string | undefined, name: string): string {
  const prefix = type.group ? `/apis/${type.group}/${type.version}` : `/api/${type.version}`;
  const collection = type.namespaced && namespace ? `${prefix}/namespaces/${namespace}/${type.plural}` : `${prefix}/${type.plural}`;
  return `${collection}/${name}`;
}

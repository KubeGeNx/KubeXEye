import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { API, k8sGet, k8sGetText, namespacedPath } from '../api/client';
import { useConnection } from '../context/ConnectionContext';
import { ALL_NAMESPACES } from '../context/NamespaceContext';
import type {
  K8sList,
  K8sNode,
  K8sPod,
  K8sNamespace,
  K8sEvent,
  K8sConfigMap,
  K8sSecret,
  K8sServiceAccount,
  K8sDeployment,
  K8sStatefulSet,
  K8sDaemonSet,
  K8sRole,
  K8sRoleBinding,
  K8sNetworkPolicy,
  K8sCustomResourceDefinition,
  CustomResource,
  NodeMetrics,
  PodMetrics,
  K8sService,
  K8sIngress,
  K8sPersistentVolumeClaim,
  K8sStorageClass,
  APIResourceList,
  APIGroupList,
} from '../types/k8s';
import type { ResourceTypeInfo } from '../utils/k8sResourcePaths';

const RESOURCE_REFRESH_MS = 10_000;
const METRICS_REFRESH_MS = 5_000;

/** Resolves the "all namespaces" sentinel to undefined for path building. */
function resolveNs(namespace: string): string | undefined {
  return namespace === ALL_NAMESPACES ? undefined : namespace;
}

function useList<T>(key: unknown[], path: string, refetchInterval = RESOURCE_REFRESH_MS, enabled = true): UseQueryResult<T[]> {
  const { config } = useConnection();
  return useQuery({
    queryKey: [...key, config],
    queryFn: async () => {
      const list = await k8sGet<K8sList<T>>(config, path);
      return list.items;
    },
    refetchInterval,
    enabled,
  });
}

/** Like useList, but treats 404 (resource/CRD/metrics-server not installed) as an empty, non-error result. */
function useOptionalList<T>(key: unknown[], path: string, refetchInterval = RESOURCE_REFRESH_MS): UseQueryResult<T[]> {
  const { config } = useConnection();
  return useQuery({
    queryKey: [...key, config],
    queryFn: async () => {
      try {
        const list = await k8sGet<K8sList<T>>(config, path);
        return list.items;
      } catch (err) {
        if ((err as { status?: number }).status === 404) return [];
        throw err;
      }
    },
    refetchInterval,
    retry: 1,
  });
}

// ---- Core ----

export const useNodes = () => useList<K8sNode>(['nodes'], `${API.core}/nodes`);

export const usePods = (namespace: string) =>
  useList<K8sPod>(['pods', namespace], namespacedPath(API.core, resolveNs(namespace), 'pods'));

export const useNamespaces = () => useList<K8sNamespace>(['namespaces'], `${API.core}/namespaces`);

interface UsePodLogsOptions {
  tailLines?: number;
  /** Polling interval in ms, or false to fetch once and only refresh on manual refetch(). */
  refetchIntervalMs?: number | false;
}

export function usePodLogs(namespace: string, name: string, container: string | undefined, options: UsePodLogsOptions): UseQueryResult<string> {
  const { config } = useConnection();
  const tailLines = options.tailLines ?? 1000;
  const params = new URLSearchParams({ tailLines: String(tailLines) });
  if (container) params.set('container', container);
  const path = `${API.core}/namespaces/${namespace}/pods/${name}/log?${params.toString()}`;

  return useQuery({
    queryKey: ['pod-logs', namespace, name, container, tailLines, config],
    queryFn: () => k8sGetText(config, path),
    enabled: Boolean(namespace && name),
    refetchInterval: options.refetchIntervalMs ?? false,
    retry: 1,
  });
}

export const useEvents = (namespace: string) =>
  useList<K8sEvent>(
    ['events', namespace],
    namespacedPath(API.core, resolveNs(namespace), 'events'),
  );

export const useConfigMaps = (namespace: string) =>
  useList<K8sConfigMap>(
    ['configmaps', namespace],
    namespacedPath(API.core, resolveNs(namespace), 'configmaps'),
  );

export const useSecrets = (namespace: string) =>
  useList<K8sSecret>(['secrets', namespace], namespacedPath(API.core, resolveNs(namespace), 'secrets'));

export const useServiceAccounts = (namespace: string) =>
  useList<K8sServiceAccount>(
    ['serviceaccounts', namespace],
    namespacedPath(API.core, resolveNs(namespace), 'serviceaccounts'),
  );

export const useServices = (namespace: string) =>
  useList<K8sService>(['services', namespace], namespacedPath(API.core, resolveNs(namespace), 'services'));

export const usePersistentVolumeClaims = (namespace: string) =>
  useList<K8sPersistentVolumeClaim>(
    ['pvcs', namespace],
    namespacedPath(API.core, resolveNs(namespace), 'persistentvolumeclaims'),
  );

export const useStorageClasses = () =>
  useList<K8sStorageClass>(['storageclasses'], `${API.storage}/storageclasses`);

// ---- Apps ----

export const useDeployments = (namespace: string, enabled = true) =>
  useList<K8sDeployment>(
    ['deployments', namespace],
    namespacedPath(API.apps, resolveNs(namespace), 'deployments'),
    RESOURCE_REFRESH_MS,
    enabled,
  );

export const useStatefulSets = (namespace: string, enabled = true) =>
  useList<K8sStatefulSet>(
    ['statefulsets', namespace],
    namespacedPath(API.apps, resolveNs(namespace), 'statefulsets'),
    RESOURCE_REFRESH_MS,
    enabled,
  );

export const useDaemonSets = (namespace: string, enabled = true) =>
  useList<K8sDaemonSet>(
    ['daemonsets', namespace],
    namespacedPath(API.apps, resolveNs(namespace), 'daemonsets'),
    RESOURCE_REFRESH_MS,
    enabled,
  );

// ---- RBAC ----

export const useRoles = (namespace: string) =>
  useList<K8sRole>(['roles', namespace], namespacedPath(API.rbac, resolveNs(namespace), 'roles'));

export const useRoleBindings = (namespace: string) =>
  useList<K8sRoleBinding>(
    ['rolebindings', namespace],
    namespacedPath(API.rbac, resolveNs(namespace), 'rolebindings'),
  );

export const useClusterRoles = () => useList<K8sRole>(['clusterroles'], `${API.rbac}/clusterroles`);

export const useClusterRoleBindings = () =>
  useList<K8sRoleBinding>(['clusterrolebindings'], `${API.rbac}/clusterrolebindings`);

// ---- Networking ----

export const useNetworkPolicies = (namespace: string) =>
  useList<K8sNetworkPolicy>(
    ['networkpolicies', namespace],
    namespacedPath(API.networking, resolveNs(namespace), 'networkpolicies'),
  );

export const useIngresses = (namespace: string) =>
  useList<K8sIngress>(['ingresses', namespace], namespacedPath(API.networking, resolveNs(namespace), 'ingresses'));

// ---- CRDs & custom resources ----

export const useCustomResourceDefinitions = () =>
  useList<K8sCustomResourceDefinition>(
    ['crds'],
    `${API.apiextensions}/customresourcedefinitions`,
  );

/** Discovers every creatable resource type the API server actually offers — the live equivalent of
 * `kubectl api-resources` — by reading the core (/api/v1) and every group's preferred-version
 * resource list (/apis/<group>/<version>). Subresources (e.g. "pods/status") and types the caller
 * can't create are filtered out, since this only feeds "create a new X" pickers. Discovery rarely
 * changes, so it's fetched once and not polled. */
export function useApiResources(): UseQueryResult<ResourceTypeInfo[]> {
  const { config } = useConnection();
  return useQuery({
    queryKey: ['api-resources', config],
    queryFn: async () => {
      const toTypes = (list: APIResourceList | null, group: string, version: string): ResourceTypeInfo[] =>
        (list?.resources ?? [])
          .filter((r) => !r.name.includes('/') && r.verbs.includes('create'))
          .map((r) => ({ group, version, kind: r.kind, plural: r.name, namespaced: r.namespaced }));

      const [core, groupList] = await Promise.all([
        k8sGet<APIResourceList>(config, '/api/v1'),
        k8sGet<APIGroupList>(config, '/apis'),
      ]);

      const groupResourceLists = await Promise.all(
        groupList.groups.map((g) =>
          k8sGet<APIResourceList>(config, `/apis/${g.preferredVersion.groupVersion}`).catch(() => null),
        ),
      );

      const fromGroups = groupList.groups.flatMap((g, i) => toTypes(groupResourceLists[i], g.name, g.preferredVersion.version));
      return [...toTypes(core, '', 'v1'), ...fromGroups];
    },
    staleTime: 5 * 60_000,
    refetchInterval: false,
  });
}

export function useCustomResources(
  crd: K8sCustomResourceDefinition | undefined,
  namespace: string,
): UseQueryResult<CustomResource[]> {
  const { config } = useConnection();
  const version = crd?.spec.versions.find((v) => v.storage)?.name ?? crd?.spec.versions[0]?.name;
  const apiPrefix = crd ? `/apis/${crd.spec.group}/${version}` : '';
  const ns = crd?.spec.scope === 'Namespaced' ? resolveNs(namespace) : undefined;
  const path = crd ? namespacedPath(apiPrefix, ns, crd.spec.names.plural) : '';

  return useQuery({
    queryKey: ['customresources', crd?.metadata.uid, namespace, config],
    queryFn: async () => {
      const list = await k8sGet<K8sList<CustomResource>>(config, path);
      return list.items;
    },
    enabled: Boolean(crd),
    refetchInterval: RESOURCE_REFRESH_MS,
  });
}

// ---- Cluster (kubeconfig context) selection ----

interface KubeContexts {
  current: string;
  contexts: string[];
}

/** Lists the kubeconfig contexts the bundled kube-proxy can target — backs the cluster switcher.
 * Rarely changes within a session, so it's fetched once and not polled. */
export function useKubeContexts(): UseQueryResult<KubeContexts> {
  const { config } = useConnection();
  return useQuery({
    queryKey: ['kube-contexts', config.apiBase, config.token],
    queryFn: () => k8sGet<KubeContexts>(config, '/__kubexeye/contexts'),
    staleTime: 5 * 60_000,
    refetchInterval: false,
  });
}

// ---- Metrics (metrics-server may not be installed — degrade gracefully) ----

export const useNodeMetrics = () =>
  useOptionalList<NodeMetrics>(['node-metrics'], `${API.metrics}/nodes`, METRICS_REFRESH_MS);

export const usePodMetrics = (namespace: string) =>
  useOptionalList<PodMetrics>(
    ['pod-metrics', namespace],
    namespacedPath(API.metrics, resolveNs(namespace), 'pods'),
    METRICS_REFRESH_MS,
  );

// ---- Combined fetch for the dependency graph (single namespace's worth of relationship sources) ----

export function useClusterTopology(namespace: string) {
  const pods = usePods(namespace);
  const configMaps = useConfigMaps(namespace);
  const secrets = useSecrets(namespace);
  const serviceAccounts = useServiceAccounts(namespace);
  const deployments = useDeployments(namespace);
  const statefulSets = useStatefulSets(namespace);
  const daemonSets = useDaemonSets(namespace);
  const services = useServices(namespace);
  const ingresses = useIngresses(namespace);
  const pvcs = usePersistentVolumeClaims(namespace);
  const storageClasses = useStorageClasses();
  const roles = useRoles(namespace);
  const roleBindings = useRoleBindings(namespace);
  const clusterRoles = useClusterRoles();
  const clusterRoleBindings = useClusterRoleBindings();

  const isLoading = [
    pods,
    configMaps,
    secrets,
    serviceAccounts,
    deployments,
    statefulSets,
    daemonSets,
    services,
    ingresses,
    pvcs,
    storageClasses,
    roles,
    roleBindings,
    clusterRoles,
    clusterRoleBindings,
  ].some((q) => q.isLoading);

  return {
    isLoading,
    pods: pods.data ?? [],
    configMaps: configMaps.data ?? [],
    secrets: secrets.data ?? [],
    serviceAccounts: serviceAccounts.data ?? [],
    deployments: deployments.data ?? [],
    statefulSets: statefulSets.data ?? [],
    daemonSets: daemonSets.data ?? [],
    services: services.data ?? [],
    ingresses: ingresses.data ?? [],
    pvcs: pvcs.data ?? [],
    storageClasses: storageClasses.data ?? [],
    roles: roles.data ?? [],
    roleBindings: roleBindings.data ?? [],
    clusterRoles: clusterRoles.data ?? [],
    clusterRoleBindings: clusterRoleBindings.data ?? [],
  };
}

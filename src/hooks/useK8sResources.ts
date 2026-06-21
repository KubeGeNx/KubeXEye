import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { API, k8sGet, namespacedPath } from '../api/client';
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
} from '../types/k8s';

const RESOURCE_REFRESH_MS = 10_000;
const METRICS_REFRESH_MS = 5_000;

/** Resolves the "all namespaces" sentinel to undefined for path building. */
function resolveNs(namespace: string): string | undefined {
  return namespace === ALL_NAMESPACES ? undefined : namespace;
}

function useList<T>(key: unknown[], path: string, refetchInterval = RESOURCE_REFRESH_MS): UseQueryResult<T[]> {
  const { config } = useConnection();
  return useQuery({
    queryKey: [...key, config],
    queryFn: async () => {
      const list = await k8sGet<K8sList<T>>(config, path);
      return list.items;
    },
    refetchInterval,
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

export const useDeployments = (namespace: string) =>
  useList<K8sDeployment>(
    ['deployments', namespace],
    namespacedPath(API.apps, resolveNs(namespace), 'deployments'),
  );

export const useStatefulSets = (namespace: string) =>
  useList<K8sStatefulSet>(
    ['statefulsets', namespace],
    namespacedPath(API.apps, resolveNs(namespace), 'statefulsets'),
  );

export const useDaemonSets = (namespace: string) =>
  useList<K8sDaemonSet>(
    ['daemonsets', namespace],
    namespacedPath(API.apps, resolveNs(namespace), 'daemonsets'),
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
  };
}

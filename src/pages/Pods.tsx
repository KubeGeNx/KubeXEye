import React, { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageSection, Tooltip, Alert, AlertActionLink } from '@patternfly/react-core';
import { ExclamationTriangleIcon } from '@patternfly/react-icons';
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table';
import { ResourceTable } from '../components/table/ResourceTable';
import { StatusLabel } from '../components/StatusLabel';
import { PodDetailButton } from '../components/PodDetailButton';
import { PageTitle } from '../components/PageTitle';
import { NAV_ICONS } from '../components/layout/navIcons';
import { usePods, usePodMetrics, useDeployments, useStatefulSets, useDaemonSets } from '../hooks/useK8sResources';
import { useNamespace } from '../context/NamespaceContext';
import { cpuToCores, memoryToBytes, formatBytes, formatCores } from '../utils/resourceUnits';
import { describeMissingResourceSpecs } from '../utils/podResourceChecks';
import { matchesSelector } from '../utils/labelSelector';
import type { ResourceKind } from '../graph/types';
import type { K8sPod } from '../types/k8s';

interface PodRow {
  name: string;
  namespace: string;
  phase: string;
  ready: string;
  restarts: number;
  node: string;
  cpuCores: number;
  memBytes: number;
  age: string;
  raw: K8sPod;
  missingResourceSpec?: string;
}

const columnHelper = createColumnHelper<PodRow>();

function age(timestamp?: string): string {
  if (!timestamp) return '—';
  const ms = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/** Reads the workload drill-down target from the URL (set by the Workloads page's Name links) —
 * `kind`/`name`/`namespace` identify a Deployment/StatefulSet/DaemonSet whose pods this page
 * should filter down to, via that workload's label selector. */
function useWorkloadFilterParams(): { kind: ResourceKind; name: string; namespace: string } | null {
  const [searchParams] = useSearchParams();
  const kind = searchParams.get('kind') as ResourceKind | null;
  const name = searchParams.get('name');
  const namespace = searchParams.get('namespace');
  if (!kind || !name || !namespace) return null;
  return { kind, name, namespace };
}

export const Pods: React.FC = () => {
  const { namespace, setNamespace } = useNamespace();
  const [, setSearchParams] = useSearchParams();
  const workloadFilter = useWorkloadFilterParams();
  // While a workload filter is present, its namespace is authoritative for data fetching —
  // computed directly from the URL so the very first render already fetches the right namespace,
  // rather than fetching the previous global namespace for one frame until an effect catches up.
  const effectiveNamespace = workloadFilter?.namespace ?? namespace;

  // Keep the toolbar's namespace selector visually in sync with the drill-down target. Cosmetic
  // only — data fetching above already uses effectiveNamespace regardless of this.
  useEffect(() => {
    if (workloadFilter && workloadFilter.namespace !== namespace) setNamespace(workloadFilter.namespace);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-sync only when the drill-down target itself changes
  }, [workloadFilter?.kind, workloadFilter?.name, workloadFilter?.namespace]);

  const deployments = useDeployments(effectiveNamespace, workloadFilter?.kind === 'Deployment');
  const statefulSets = useStatefulSets(effectiveNamespace, workloadFilter?.kind === 'StatefulSet');
  const daemonSets = useDaemonSets(effectiveNamespace, workloadFilter?.kind === 'DaemonSet');

  const workloadQuery =
    workloadFilter?.kind === 'Deployment'
      ? deployments
      : workloadFilter?.kind === 'StatefulSet'
        ? statefulSets
        : workloadFilter?.kind === 'DaemonSet'
          ? daemonSets
          : null;

  const matchLabels = useMemo(() => {
    if (!workloadFilter || !workloadQuery) return undefined;
    const workload = workloadQuery.data?.find((w) => w.metadata.name === workloadFilter.name);
    return workload?.spec?.selector?.matchLabels;
  }, [workloadFilter, workloadQuery]);

  const pods = usePods(effectiveNamespace);
  const metrics = usePodMetrics(effectiveNamespace);

  const filteredPods = useMemo(() => {
    const all = pods.data ?? [];
    if (!workloadFilter) return all;
    return all.filter((p) => matchesSelector(p.metadata.labels, matchLabels));
  }, [pods.data, workloadFilter, matchLabels]);

  const rows = useMemo<PodRow[]>(() => {
    const metricsByKey = new Map(
      (metrics.data ?? []).map((m) => [`${m.metadata.namespace}/${m.metadata.name}`, m]),
    );
    return filteredPods.map((pod) => {
      const containers = pod.status?.containerStatuses ?? [];
      const readyCount = containers.filter((c) => c.ready).length;
      const restarts = containers.reduce((sum, c) => sum + c.restartCount, 0);
      const m = metricsByKey.get(`${pod.metadata.namespace}/${pod.metadata.name}`);
      const cpuCores = m ? m.containers.reduce((sum, c) => sum + cpuToCores(c.usage.cpu), 0) : 0;
      const memBytes = m ? m.containers.reduce((sum, c) => sum + memoryToBytes(c.usage.memory), 0) : 0;
      return {
        name: pod.metadata.name,
        namespace: pod.metadata.namespace ?? '—',
        phase: pod.status?.phase ?? 'Unknown',
        ready: `${readyCount}/${containers.length}`,
        restarts,
        node: pod.spec?.nodeName ?? '—',
        cpuCores,
        memBytes,
        age: age(pod.metadata.creationTimestamp),
        raw: pod,
        missingResourceSpec: describeMissingResourceSpecs(pod),
      };
    });
  }, [filteredPods, metrics.data]);

  const columns: ColumnDef<PodRow, any>[] = [
    columnHelper.accessor('name', {
      header: 'Name',
      // Clicking the name opens the pod detail view (Definition + Logs tabs) — its Logs tab
      // already handles multi-container pods via a container selector, so this drill-down gets
      // that for free too.
      cell: (c) => (
        <>
          <PodDetailButton pod={c.row.original.raw} label={c.getValue()} warning={c.row.original.missingResourceSpec} />
          {c.row.original.missingResourceSpec && (
            <Tooltip content={c.row.original.missingResourceSpec}>
              <ExclamationTriangleIcon color="#F0A028" style={{ marginLeft: 6 }} aria-label="Missing resource requests/limits" />
            </Tooltip>
          )}
        </>
      ),
    }),
    columnHelper.accessor('namespace', { header: 'Namespace' }),
    columnHelper.accessor('phase', { header: 'Status', cell: (c) => <StatusLabel status={c.getValue()} /> }),
    columnHelper.accessor('ready', { header: 'Ready' }),
    columnHelper.accessor('restarts', { header: 'Restarts' }),
    columnHelper.accessor('cpuCores', { header: 'CPU', cell: (c) => formatCores(c.getValue()) }),
    columnHelper.accessor('memBytes', { header: 'Memory', cell: (c) => formatBytes(c.getValue()) }),
    columnHelper.accessor('node', { header: 'Node' }),
    columnHelper.accessor('age', { header: 'Age' }),
  ];

  const isResolvingFilter = Boolean(workloadFilter) && Boolean(workloadQuery?.isLoading);

  return (
    <PageSection>
      <PageTitle icon={NAV_ICONS.pods}>Pods</PageTitle>
      {workloadFilter && (
        <Alert
          variant="info"
          isInline
          title={`Showing pods managed by ${workloadFilter.kind}/${workloadFilter.name}`}
          actionLinks={<AlertActionLink onClick={() => setSearchParams({})}>Clear filter</AlertActionLink>}
          style={{ marginBottom: '1rem' }}
        />
      )}
      <ResourceTable
        data={rows}
        columns={columns}
        isLoading={pods.isLoading || isResolvingFilter}
        error={pods.error as Error | null}
        searchPlaceholder="Find by name or namespace..."
        getRowId={(row) => `${row.namespace}/${row.name}`}
      />
    </PageSection>
  );
};

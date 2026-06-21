import React, { useMemo } from 'react';
import { PageSection, Tooltip } from '@patternfly/react-core';
import { ExclamationTriangleIcon } from '@patternfly/react-icons';
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table';
import { ResourceTable } from '../components/table/ResourceTable';
import { StatusLabel } from '../components/StatusLabel';
import { ViewMapLink } from '../components/ViewMapLink';
import { ResourceDefinitionButton } from '../components/ResourceDefinitionButton';
import { PageTitle } from '../components/PageTitle';
import { NAV_ICONS } from '../components/layout/navIcons';
import { usePods, usePodMetrics } from '../hooks/useK8sResources';
import { useNamespace } from '../context/NamespaceContext';
import { cpuToCores, memoryToBytes, formatBytes, formatCores } from '../utils/resourceUnits';
import { describeMissingResourceSpecs } from '../utils/podResourceChecks';
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

export const Pods: React.FC = () => {
  const { namespace } = useNamespace();
  const pods = usePods(namespace);
  const metrics = usePodMetrics(namespace);

  const rows = useMemo<PodRow[]>(() => {
    const metricsByKey = new Map(
      (metrics.data ?? []).map((m) => [`${m.metadata.namespace}/${m.metadata.name}`, m]),
    );
    return (pods.data ?? []).map((pod) => {
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
  }, [pods.data, metrics.data]);

  const columns: ColumnDef<PodRow, any>[] = [
    columnHelper.accessor('name', {
      header: 'Name',
      cell: (c) => (
        <>
          {c.getValue()}
          {c.row.original.missingResourceSpec && (
            <Tooltip content={c.row.original.missingResourceSpec}>
              <ExclamationTriangleIcon color="#f0ab00" style={{ marginLeft: 6 }} aria-label="Missing resource requests/limits" />
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
    columnHelper.display({
      id: 'map',
      header: 'Dependencies',
      cell: (c) => <ViewMapLink kind="Pod" name={c.row.original.name} namespace={c.row.original.namespace} />,
    }),
    columnHelper.display({
      id: 'definition',
      header: 'Definition',
      cell: (c) => (
        <ResourceDefinitionButton
          resource={c.row.original.raw}
          title={`Pod/${c.row.original.namespace}/${c.row.original.name}`}
          warning={c.row.original.missingResourceSpec}
        />
      ),
    }),
  ];

  return (
    <PageSection>
      <PageTitle icon={NAV_ICONS.pods}>Pods</PageTitle>
      <ResourceTable
        data={rows}
        columns={columns}
        isLoading={pods.isLoading}
        error={pods.error as Error | null}
        searchPlaceholder="Find by name or namespace..."
        getRowId={(row) => `${row.namespace}/${row.name}`}
      />
    </PageSection>
  );
};

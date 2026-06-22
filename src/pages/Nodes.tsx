import React, { useMemo } from 'react';
import { PageSection } from '@patternfly/react-core';
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table';
import { ResourceTable } from '../components/table/ResourceTable';
import { StatusLabel } from '../components/StatusLabel';
import { ResourceDefinitionButton } from '../components/ResourceDefinitionButton';
import { PageTitle } from '../components/PageTitle';
import { NAV_ICONS } from '../components/layout/navIcons';
import { useNodes, useNodeMetrics } from '../hooks/useK8sResources';
import type { K8sNode } from '../types/k8s';
import { cpuToCores, memoryToBytes, formatBytes, formatCores, percent } from '../utils/resourceUnits';

interface NodeRow {
  name: string;
  ready: string;
  roles: string;
  cpuUsedCores: number;
  cpuAllocCores: number;
  memUsedBytes: number;
  memAllocBytes: number;
  podCapacity: string;
  version: string;
  raw: K8sNode;
}

const columnHelper = createColumnHelper<NodeRow>();

export const Nodes: React.FC = () => {
  const nodes = useNodes();
  const metrics = useNodeMetrics();

  const rows = useMemo<NodeRow[]>(() => {
    const metricsByName = new Map((metrics.data ?? []).map((m) => [m.metadata.name, m]));
    return (nodes.data ?? []).map((node: K8sNode) => {
      const readyCondition = node.status?.conditions?.find((c) => c.type === 'Ready');
      const roles = Object.keys(node.metadata.labels ?? {})
        .filter((label) => label.startsWith('node-role.kubernetes.io/'))
        .map((label) => label.replace('node-role.kubernetes.io/', ''))
        .join(', ') || 'worker';
      const m = metricsByName.get(node.metadata.name);
      return {
        name: node.metadata.name,
        ready: readyCondition?.status === 'True' ? 'Ready' : 'Unknown',
        roles,
        cpuUsedCores: m ? cpuToCores(m.usage.cpu) : 0,
        cpuAllocCores: cpuToCores(node.status?.allocatable?.cpu),
        memUsedBytes: m ? memoryToBytes(m.usage.memory) : 0,
        memAllocBytes: memoryToBytes(node.status?.allocatable?.memory),
        podCapacity: node.status?.allocatable?.pods ?? '—',
        version: node.status?.nodeInfo?.kubeletVersion ?? '—',
        raw: node,
      };
    });
  }, [nodes.data, metrics.data]);

  const columns: ColumnDef<NodeRow, any>[] = [
    columnHelper.accessor('name', {
      header: 'Name',
      cell: (c) => <ResourceDefinitionButton resource={c.row.original.raw} title={`Node/${c.row.original.name}`} label={c.getValue()} />,
    }),
    columnHelper.accessor('ready', { header: 'Status', cell: (c) => <StatusLabel status={c.getValue()} /> }),
    columnHelper.accessor('roles', { header: 'Roles' }),
    columnHelper.accessor('cpuUsedCores', {
      header: 'CPU',
      cell: (c) => {
        const pct = percent(c.getValue(), c.row.original.cpuAllocCores);
        const color = pct >= 85 ? '#E25A5A' : pct >= 65 ? '#F0A028' : undefined;
        return (
          <span style={color ? { color, fontWeight: 500 } : undefined}>
            {`${formatCores(c.getValue())} / ${formatCores(c.row.original.cpuAllocCores)} (${pct.toFixed(0)}%)`}
          </span>
        );
      },
    }),
    columnHelper.accessor('memUsedBytes', {
      header: 'Memory',
      cell: (c) => {
        const pct = percent(c.getValue(), c.row.original.memAllocBytes);
        const color = pct >= 85 ? '#E25A5A' : pct >= 65 ? '#F0A028' : undefined;
        return (
          <span style={color ? { color, fontWeight: 500 } : undefined}>
            {`${formatBytes(c.getValue())} / ${formatBytes(c.row.original.memAllocBytes)} (${pct.toFixed(0)}%)`}
          </span>
        );
      },
    }),
    columnHelper.accessor('podCapacity', { header: 'Pod Capacity' }),
    columnHelper.accessor('version', { header: 'Kubelet Version' }),
  ];

  return (
    <PageSection>
      <PageTitle icon={NAV_ICONS.nodes}>Nodes</PageTitle>
      <ResourceTable
        data={rows}
        columns={columns}
        isLoading={nodes.isLoading}
        error={nodes.error as Error | null}
        searchPlaceholder="Find by name..."
        getRowId={(row) => row.name}
      />
    </PageSection>
  );
};

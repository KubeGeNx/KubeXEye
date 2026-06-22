import React, { useMemo } from 'react';
import { PageSection } from '@patternfly/react-core';
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table';
import { ResourceTable } from '../components/table/ResourceTable';
import { StatusLabel } from '../components/StatusLabel';
import { ResourceDefinitionButton } from '../components/ResourceDefinitionButton';
import { PageTitle } from '../components/PageTitle';
import { NAV_ICONS } from '../components/layout/navIcons';
import { useEvents } from '../hooks/useK8sResources';
import { useNamespace } from '../context/NamespaceContext';
import type { K8sEvent } from '../types/k8s';

interface EventRow {
  key: string;
  type: string;
  reason: string;
  object: string;
  message: string;
  count: number;
  lastSeen: string;
  raw: K8sEvent;
}

const columnHelper = createColumnHelper<EventRow>();

export const Events: React.FC = () => {
  const { namespace } = useNamespace();
  const query = useEvents(namespace);

  const rows = useMemo<EventRow[]>(() => {
    const sorted = [...(query.data ?? [])].sort((a, b) => {
      const at = a.lastTimestamp ? new Date(a.lastTimestamp).getTime() : 0;
      const bt = b.lastTimestamp ? new Date(b.lastTimestamp).getTime() : 0;
      return bt - at;
    });
    return sorted.map((e) => ({
      key: e.metadata.uid ?? `${e.metadata.namespace}/${e.metadata.name}`,
      type: e.type ?? 'Normal',
      reason: e.reason ?? '—',
      object: `${e.involvedObject?.kind ?? ''}/${e.involvedObject?.name ?? ''}`,
      message: e.message ?? '—',
      count: e.count ?? 1,
      lastSeen: e.lastTimestamp ?? e.firstTimestamp ?? '—',
      raw: e,
    }));
  }, [query.data]);

  const columns: ColumnDef<EventRow, any>[] = [
    columnHelper.accessor('type', { header: 'Type', cell: (c) => <StatusLabel status={c.getValue()} /> }),
    columnHelper.accessor('reason', {
      header: 'Reason',
      // Events have no name of their own to click — Reason is the most identifying column, so it
      // doubles as the trigger for viewing the event's definition.
      cell: (c) => (
        <ResourceDefinitionButton resource={c.row.original.raw} title={`Event/${c.row.original.key}`} label={c.getValue()} />
      ),
    }),
    columnHelper.accessor('object', { header: 'Object' }),
    columnHelper.accessor('message', { header: 'Message' }),
    columnHelper.accessor('count', { header: 'Count' }),
    columnHelper.accessor('lastSeen', { header: 'Last Seen' }),
  ];

  return (
    <PageSection>
      <PageTitle icon={NAV_ICONS.events}>Events</PageTitle>
      <ResourceTable
        data={rows}
        columns={columns}
        isLoading={query.isLoading}
        error={query.error as Error | null}
        searchPlaceholder="Find by reason, object, or message..."
        emptyMessage="No recent events."
        getRowId={(row) => row.key}
      />
    </PageSection>
  );
};

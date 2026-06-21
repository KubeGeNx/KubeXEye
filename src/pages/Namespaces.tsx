import React, { useMemo } from 'react';
import { PageSection } from '@patternfly/react-core';
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table';
import { ResourceTable } from '../components/table/ResourceTable';
import { StatusLabel } from '../components/StatusLabel';
import { ResourceDefinitionButton } from '../components/ResourceDefinitionButton';
import { PageTitle } from '../components/PageTitle';
import { NAV_ICONS } from '../components/layout/navIcons';
import { useNamespaces } from '../hooks/useK8sResources';
import type { K8sNamespace } from '../types/k8s';

interface NamespaceRow {
  name: string;
  status: string;
  age?: string;
  raw: K8sNamespace;
}

const columnHelper = createColumnHelper<NamespaceRow>();

export const Namespaces: React.FC = () => {
  const query = useNamespaces();

  const rows = useMemo<NamespaceRow[]>(
    () =>
      (query.data ?? []).map((ns) => ({
        name: ns.metadata.name,
        status: ns.status?.phase ?? 'Unknown',
        age: ns.metadata.creationTimestamp,
        raw: ns,
      })),
    [query.data],
  );

  const columns: ColumnDef<NamespaceRow, any>[] = [
    columnHelper.accessor('name', { header: 'Name' }),
    columnHelper.accessor('status', { header: 'Status', cell: (c) => <StatusLabel status={c.getValue()} /> }),
    columnHelper.accessor('age', { header: 'Created', cell: (c) => c.getValue() ?? '—' }),
    columnHelper.display({
      id: 'definition',
      header: 'Definition',
      cell: (c) => <ResourceDefinitionButton resource={c.row.original.raw} title={`Namespace/${c.row.original.name}`} />,
    }),
  ];

  return (
    <PageSection>
      <PageTitle icon={NAV_ICONS.namespaces}>Namespaces</PageTitle>
      <ResourceTable
        data={rows}
        columns={columns}
        isLoading={query.isLoading}
        error={query.error as Error | null}
        searchPlaceholder="Find by name..."
        getRowId={(row) => row.name}
      />
    </PageSection>
  );
};

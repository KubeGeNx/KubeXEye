import React, { useMemo } from 'react';
import { PageSection } from '@patternfly/react-core';
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table';
import { ResourceTable } from '../components/table/ResourceTable';
import { StatusLabel } from '../components/StatusLabel';
import { ViewMapLink } from '../components/ViewMapLink';
import { ResourceDefinitionButton } from '../components/ResourceDefinitionButton';
import { PageTitle } from '../components/PageTitle';
import { NAV_ICONS } from '../components/layout/navIcons';
import { usePersistentVolumeClaims } from '../hooks/useK8sResources';
import { useNamespace } from '../context/NamespaceContext';
import type { K8sPersistentVolumeClaim } from '../types/k8s';

interface Row {
  name: string;
  namespace: string;
  status: string;
  capacity: string;
  storageClass: string;
  accessModes: string;
  raw: K8sPersistentVolumeClaim;
}

const columnHelper = createColumnHelper<Row>();

export const PersistentVolumeClaims: React.FC = () => {
  const { namespace } = useNamespace();
  const query = usePersistentVolumeClaims(namespace);

  const rows = useMemo<Row[]>(
    () =>
      (query.data ?? []).map((pvc) => ({
        name: pvc.metadata.name,
        namespace: pvc.metadata.namespace ?? '—',
        status: pvc.status?.phase ?? 'Pending',
        capacity: pvc.status?.capacity?.storage ?? '—',
        storageClass: pvc.spec?.storageClassName ?? '(default)',
        accessModes: pvc.spec?.accessModes?.join(', ') ?? '—',
        raw: pvc,
      })),
    [query.data],
  );

  const columns: ColumnDef<Row, any>[] = [
    columnHelper.accessor('name', { header: 'Name' }),
    columnHelper.accessor('namespace', { header: 'Namespace' }),
    columnHelper.accessor('status', { header: 'Status', cell: (c) => <StatusLabel status={c.getValue()} /> }),
    columnHelper.accessor('capacity', { header: 'Capacity' }),
    columnHelper.accessor('storageClass', { header: 'Storage Class' }),
    columnHelper.accessor('accessModes', { header: 'Access Modes' }),
    columnHelper.display({
      id: 'map',
      header: 'Dependencies',
      cell: (c) => <ViewMapLink kind="PersistentVolumeClaim" name={c.row.original.name} namespace={c.row.original.namespace} />,
    }),
    columnHelper.display({
      id: 'definition',
      header: 'Definition',
      cell: (c) => (
        <ResourceDefinitionButton resource={c.row.original.raw} title={`PVC/${c.row.original.namespace}/${c.row.original.name}`} />
      ),
    }),
  ];

  return (
    <PageSection>
      <PageTitle icon={NAV_ICONS.pvc}>Persistent Volume Claims</PageTitle>
      <ResourceTable
        data={rows}
        columns={columns}
        isLoading={query.isLoading}
        error={query.error as Error | null}
        searchPlaceholder="Find by name..."
        getRowId={(row) => `${row.namespace}/${row.name}`}
      />
    </PageSection>
  );
};

import React, { useMemo } from 'react';
import { PageSection } from '@patternfly/react-core';
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table';
import { ResourceTable } from '../components/table/ResourceTable';
import { ViewMapLink } from '../components/ViewMapLink';
import { ResourceDefinitionButton } from '../components/ResourceDefinitionButton';
import { PageTitle } from '../components/PageTitle';
import { NAV_ICONS } from '../components/layout/navIcons';
import { useStorageClasses } from '../hooks/useK8sResources';
import type { K8sStorageClass } from '../types/k8s';

interface Row {
  name: string;
  provisioner: string;
  reclaimPolicy: string;
  volumeBindingMode: string;
  raw: K8sStorageClass;
}

const columnHelper = createColumnHelper<Row>();

export const StorageClasses: React.FC = () => {
  const query = useStorageClasses();

  const rows = useMemo<Row[]>(
    () =>
      (query.data ?? []).map((sc) => ({
        name: sc.metadata.name,
        provisioner: sc.provisioner,
        reclaimPolicy: sc.reclaimPolicy ?? '—',
        volumeBindingMode: sc.volumeBindingMode ?? '—',
        raw: sc,
      })),
    [query.data],
  );

  const columns: ColumnDef<Row, any>[] = [
    columnHelper.accessor('name', { header: 'Name' }),
    columnHelper.accessor('provisioner', { header: 'Provisioner' }),
    columnHelper.accessor('reclaimPolicy', { header: 'Reclaim Policy' }),
    columnHelper.accessor('volumeBindingMode', { header: 'Volume Binding Mode' }),
    columnHelper.display({
      id: 'map',
      header: 'Dependencies',
      cell: (c) => <ViewMapLink kind="StorageClass" name={c.row.original.name} />,
    }),
    columnHelper.display({
      id: 'definition',
      header: 'Definition',
      cell: (c) => <ResourceDefinitionButton resource={c.row.original.raw} title={`StorageClass/${c.row.original.name}`} />,
    }),
  ];

  return (
    <PageSection>
      <PageTitle icon={NAV_ICONS.storageClasses}>Storage Classes</PageTitle>
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

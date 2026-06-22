import React, { useMemo } from 'react';
import { PageSection } from '@patternfly/react-core';
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table';
import { ResourceTable } from '../components/table/ResourceTable';
import { ViewMapLink } from '../components/ViewMapLink';
import { ResourceDefinitionButton } from '../components/ResourceDefinitionButton';
import { PageTitle } from '../components/PageTitle';
import { NAV_ICONS } from '../components/layout/navIcons';
import { useConfigMaps } from '../hooks/useK8sResources';
import { useNamespace } from '../context/NamespaceContext';
import type { K8sConfigMap } from '../types/k8s';

interface Row {
  name: string;
  namespace: string;
  keys: string;
  dataItems: number;
  raw: K8sConfigMap;
}

const columnHelper = createColumnHelper<Row>();

export const ConfigMaps: React.FC = () => {
  const { namespace } = useNamespace();
  const query = useConfigMaps(namespace);

  const rows = useMemo<Row[]>(
    () =>
      (query.data ?? []).map((cm) => {
        const keys = Object.keys(cm.data ?? {});
        return {
          name: cm.metadata.name,
          namespace: cm.metadata.namespace ?? '—',
          keys: keys.join(', ') || '—',
          dataItems: keys.length,
          raw: cm,
        };
      }),
    [query.data],
  );

  const columns: ColumnDef<Row, any>[] = [
    columnHelper.accessor('name', {
      header: 'Name',
      cell: (c) => (
        <ResourceDefinitionButton
          resource={c.row.original.raw}
          title={`ConfigMap/${c.row.original.namespace}/${c.row.original.name}`}
          label={c.getValue()}
        />
      ),
    }),
    columnHelper.accessor('namespace', { header: 'Namespace' }),
    columnHelper.accessor('dataItems', { header: 'Data Items' }),
    columnHelper.accessor('keys', { header: 'Keys' }),
    columnHelper.display({
      id: 'map',
      header: 'Dependencies',
      cell: (c) => <ViewMapLink kind="ConfigMap" name={c.row.original.name} namespace={c.row.original.namespace} />,
    }),
  ];

  return (
    <PageSection>
      <PageTitle icon={NAV_ICONS.configMaps}>ConfigMaps</PageTitle>
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

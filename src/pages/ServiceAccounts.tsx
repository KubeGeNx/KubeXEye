import React, { useMemo } from 'react';
import { PageSection } from '@patternfly/react-core';
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table';
import { ResourceTable } from '../components/table/ResourceTable';
import { ViewMapLink } from '../components/ViewMapLink';
import { ResourceDefinitionButton } from '../components/ResourceDefinitionButton';
import { PageTitle } from '../components/PageTitle';
import { NAV_ICONS } from '../components/layout/navIcons';
import { useServiceAccounts } from '../hooks/useK8sResources';
import { useNamespace } from '../context/NamespaceContext';
import type { K8sServiceAccount } from '../types/k8s';

interface Row {
  name: string;
  namespace: string;
  secretCount: number;
  raw: K8sServiceAccount;
}

const columnHelper = createColumnHelper<Row>();

export const ServiceAccounts: React.FC = () => {
  const { namespace } = useNamespace();
  const query = useServiceAccounts(namespace);

  const rows = useMemo<Row[]>(
    () =>
      (query.data ?? []).map((sa) => ({
        name: sa.metadata.name,
        namespace: sa.metadata.namespace ?? '—',
        secretCount: sa.secrets?.length ?? 0,
        raw: sa,
      })),
    [query.data],
  );

  const columns: ColumnDef<Row, any>[] = [
    columnHelper.accessor('name', { header: 'Name' }),
    columnHelper.accessor('namespace', { header: 'Namespace' }),
    columnHelper.accessor('secretCount', { header: 'Mounted Secrets' }),
    columnHelper.display({
      id: 'map',
      header: 'Dependencies',
      cell: (c) => <ViewMapLink kind="ServiceAccount" name={c.row.original.name} namespace={c.row.original.namespace} />,
    }),
    columnHelper.display({
      id: 'definition',
      header: 'Definition',
      cell: (c) => (
        <ResourceDefinitionButton
          resource={c.row.original.raw}
          title={`ServiceAccount/${c.row.original.namespace}/${c.row.original.name}`}
        />
      ),
    }),
  ];

  return (
    <PageSection>
      <PageTitle icon={NAV_ICONS.serviceAccounts}>Service Accounts</PageTitle>
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

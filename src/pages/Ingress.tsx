import React, { useMemo } from 'react';
import { PageSection } from '@patternfly/react-core';
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table';
import { ResourceTable } from '../components/table/ResourceTable';
import { ViewMapLink } from '../components/ViewMapLink';
import { ResourceDefinitionButton } from '../components/ResourceDefinitionButton';
import { PageTitle } from '../components/PageTitle';
import { NAV_ICONS } from '../components/layout/navIcons';
import { useIngresses } from '../hooks/useK8sResources';
import { useNamespace } from '../context/NamespaceContext';
import type { K8sIngress } from '../types/k8s';

interface Row {
  name: string;
  namespace: string;
  hosts: string;
  backends: string;
  raw: K8sIngress;
}

const columnHelper = createColumnHelper<Row>();

export const Ingress: React.FC = () => {
  const { namespace } = useNamespace();
  const query = useIngresses(namespace);

  const rows = useMemo<Row[]>(
    () =>
      (query.data ?? []).map((ing) => {
        const hosts = (ing.spec?.rules ?? []).map((r) => r.host).filter(Boolean) as string[];
        const backends = [
          ing.spec?.defaultBackend,
          ...(ing.spec?.rules ?? []).flatMap((r) => r.http?.paths.map((p) => p.backend) ?? []),
        ]
          .filter((b) => b?.service)
          .map((b) => b!.service!.name);
        return {
          name: ing.metadata.name,
          namespace: ing.metadata.namespace ?? '—',
          hosts: hosts.join(', ') || '*',
          backends: Array.from(new Set(backends)).join(', ') || '—',
          raw: ing,
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
          title={`Ingress/${c.row.original.namespace}/${c.row.original.name}`}
          label={c.getValue()}
        />
      ),
    }),
    columnHelper.accessor('namespace', { header: 'Namespace' }),
    columnHelper.accessor('hosts', { header: 'Hosts' }),
    columnHelper.accessor('backends', { header: 'Backend Services' }),
    columnHelper.display({
      id: 'map',
      header: 'Dependencies',
      cell: (c) => <ViewMapLink kind="Ingress" name={c.row.original.name} namespace={c.row.original.namespace} />,
    }),
  ];

  return (
    <PageSection>
      <PageTitle icon={NAV_ICONS.ingress}>Ingress</PageTitle>
      <ResourceTable
        data={rows}
        columns={columns}
        isLoading={query.isLoading}
        error={query.error as Error | null}
        searchPlaceholder="Find by name or host..."
        getRowId={(row) => `${row.namespace}/${row.name}`}
      />
    </PageSection>
  );
};

import React, { useMemo } from 'react';
import { PageSection } from '@patternfly/react-core';
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table';
import { ResourceTable } from '../components/table/ResourceTable';
import { ViewMapLink } from '../components/ViewMapLink';
import { ResourceDefinitionButton } from '../components/ResourceDefinitionButton';
import { PageTitle } from '../components/PageTitle';
import { NAV_ICONS } from '../components/layout/navIcons';
import { useServices } from '../hooks/useK8sResources';
import { useNamespace } from '../context/NamespaceContext';
import type { K8sService } from '../types/k8s';

interface Row {
  name: string;
  namespace: string;
  type: string;
  clusterIP: string;
  ports: string;
  selector: string;
  raw: K8sService;
}

const columnHelper = createColumnHelper<Row>();

export const Services: React.FC = () => {
  const { namespace } = useNamespace();
  const query = useServices(namespace);

  const rows = useMemo<Row[]>(
    () =>
      (query.data ?? []).map((svc) => ({
        name: svc.metadata.name,
        namespace: svc.metadata.namespace ?? '—',
        type: svc.spec?.type ?? 'ClusterIP',
        clusterIP: svc.spec?.clusterIP ?? '—',
        ports: svc.spec?.ports?.map((p) => `${p.port}${p.protocol ? `/${p.protocol}` : ''}`).join(', ') || '—',
        selector:
          Object.entries(svc.spec?.selector ?? {})
            .map(([k, v]) => `${k}=${v}`)
            .join(', ') || '—',
        raw: svc,
      })),
    [query.data],
  );

  const columns: ColumnDef<Row, any>[] = [
    columnHelper.accessor('name', {
      header: 'Name',
      cell: (c) => (
        <ResourceDefinitionButton
          resource={c.row.original.raw}
          title={`Service/${c.row.original.namespace}/${c.row.original.name}`}
          label={c.getValue()}
        />
      ),
    }),
    columnHelper.accessor('namespace', { header: 'Namespace' }),
    columnHelper.accessor('type', { header: 'Type' }),
    columnHelper.accessor('clusterIP', { header: 'Cluster IP' }),
    columnHelper.accessor('ports', { header: 'Ports' }),
    columnHelper.accessor('selector', { header: 'Selector' }),
    columnHelper.display({
      id: 'map',
      header: 'Dependencies',
      cell: (c) => <ViewMapLink kind="Service" name={c.row.original.name} namespace={c.row.original.namespace} />,
    }),
  ];

  return (
    <PageSection>
      <PageTitle icon={NAV_ICONS.services}>Services</PageTitle>
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

import React, { useMemo } from 'react';
import { PageSection } from '@patternfly/react-core';
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table';
import { ResourceTable } from '../components/table/ResourceTable';
import { ResourceDefinitionButton } from '../components/ResourceDefinitionButton';
import { PageTitle } from '../components/PageTitle';
import { NAV_ICONS } from '../components/layout/navIcons';
import { useNetworkPolicies } from '../hooks/useK8sResources';
import { useNamespace } from '../context/NamespaceContext';
import type { K8sNetworkPolicy } from '../types/k8s';

interface Row {
  name: string;
  namespace: string;
  podSelector: string;
  policyTypes: string;
  raw: K8sNetworkPolicy;
}

const columnHelper = createColumnHelper<Row>();

export const NetworkPolicies: React.FC = () => {
  const { namespace } = useNamespace();
  const query = useNetworkPolicies(namespace);

  const rows = useMemo<Row[]>(
    () =>
      (query.data ?? []).map((np) => ({
        name: np.metadata.name,
        namespace: np.metadata.namespace ?? '—',
        podSelector:
          Object.entries(np.spec?.podSelector?.matchLabels ?? {})
            .map(([k, v]) => `${k}=${v}`)
            .join(', ') || '(all pods)',
        policyTypes: np.spec?.policyTypes?.join(', ') ?? '—',
        raw: np,
      })),
    [query.data],
  );

  const columns: ColumnDef<Row, any>[] = [
    columnHelper.accessor('name', {
      header: 'Name',
      cell: (c) => (
        <ResourceDefinitionButton
          resource={c.row.original.raw}
          title={`NetworkPolicy/${c.row.original.namespace}/${c.row.original.name}`}
          label={c.getValue()}
        />
      ),
    }),
    columnHelper.accessor('namespace', { header: 'Namespace' }),
    columnHelper.accessor('podSelector', { header: 'Pod Selector' }),
    columnHelper.accessor('policyTypes', { header: 'Policy Types' }),
  ];

  return (
    <PageSection>
      <PageTitle icon={NAV_ICONS.networkPolicies}>Network Policies</PageTitle>
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

import React, { useMemo } from 'react';
import { PageSection, Alert } from '@patternfly/react-core';
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table';
import { ResourceTable } from '../components/table/ResourceTable';
import { ViewMapLink } from '../components/ViewMapLink';
import { ResourceDefinitionButton } from '../components/ResourceDefinitionButton';
import { PageTitle } from '../components/PageTitle';
import { NAV_ICONS } from '../components/layout/navIcons';
import { useSecrets } from '../hooks/useK8sResources';
import { useNamespace } from '../context/NamespaceContext';
import { redactSecretForDisplay } from '../utils/redact';
import type { K8sSecret } from '../types/k8s';

interface Row {
  name: string;
  namespace: string;
  type: string;
  keys: string;
  keyCount: number;
  raw: K8sSecret;
}

const columnHelper = createColumnHelper<Row>();

// Secret values are intentionally never decoded or rendered here — only key names and type.
export const Secrets: React.FC = () => {
  const { namespace } = useNamespace();
  const query = useSecrets(namespace);

  const rows = useMemo<Row[]>(
    () =>
      (query.data ?? []).map((secret) => {
        const keys = Object.keys(secret.data ?? {});
        return {
          name: secret.metadata.name,
          namespace: secret.metadata.namespace ?? '—',
          type: secret.type ?? 'Opaque',
          keys: keys.join(', ') || '—',
          keyCount: keys.length,
          raw: redactSecretForDisplay(secret),
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
          title={`Secret/${c.row.original.namespace}/${c.row.original.name}`}
          label={c.getValue()}
          warning="Values are redacted — only key names and type are shown."
        />
      ),
    }),
    columnHelper.accessor('namespace', { header: 'Namespace' }),
    columnHelper.accessor('type', { header: 'Type' }),
    columnHelper.accessor('keyCount', { header: 'Keys' }),
    columnHelper.accessor('keys', { header: 'Key Names' }),
    columnHelper.display({
      id: 'map',
      header: 'Dependencies',
      cell: (c) => <ViewMapLink kind="Secret" name={c.row.original.name} namespace={c.row.original.namespace} />,
    }),
  ];

  return (
    <PageSection>
      <PageTitle icon={NAV_ICONS.secrets}>Secrets</PageTitle>
      <Alert variant="warning" isInline title="Values are never shown" style={{ marginBottom: '1rem' }}>
        Only secret names, types, and key names are displayed. Decoded values are never fetched into the UI.
      </Alert>
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

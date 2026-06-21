import React, { useMemo } from 'react';
import { PageSection, Alert } from '@patternfly/react-core';
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table';
import { ResourceTable } from '../components/table/ResourceTable';
import { StatusLabel } from '../components/StatusLabel';
import { ResourceDefinitionButton } from '../components/ResourceDefinitionButton';
import { PageTitle } from '../components/PageTitle';
import { NAV_ICONS } from '../components/layout/navIcons';
import { useHelmReleases } from '../hooks/useHelmReleases';
import { useNamespace } from '../context/NamespaceContext';
import type { HelmReleaseInfo } from '../types/helm';

const columnHelper = createColumnHelper<HelmReleaseInfo>();

export const HelmReleases: React.FC = () => {
  const { namespace } = useNamespace();
  const query = useHelmReleases(namespace);

  const rows = useMemo(() => query.data ?? [], [query.data]);

  const columns: ColumnDef<HelmReleaseInfo, any>[] = [
    columnHelper.accessor('name', { header: 'Release' }),
    columnHelper.accessor('namespace', { header: 'Namespace' }),
    columnHelper.accessor('status', { header: 'Status', cell: (c) => <StatusLabel status={c.getValue()} /> }),
    columnHelper.accessor('chartName', { header: 'Chart' }),
    columnHelper.accessor('chartVersion', { header: 'Chart Version' }),
    columnHelper.accessor('appVersion', { header: 'App Version', cell: (c) => c.getValue() ?? '—' }),
    columnHelper.accessor('revision', { header: 'Revision' }),
    columnHelper.accessor('lastDeployed', { header: 'Last Deployed', cell: (c) => c.getValue() ?? '—' }),
    columnHelper.display({
      id: 'values',
      header: 'Values',
      cell: (c) => (
        <ResourceDefinitionButton
          resource={c.row.original.values}
          title={`Values: ${c.row.original.name} (${c.row.original.chartName})`}
          label="Values"
          warning="These are the values supplied at install/upgrade time (-f/--set). Some charts accept credentials directly as values — treat this the same as a config file that might contain secrets."
        />
      ),
    }),
  ];

  return (
    <PageSection>
      <PageTitle icon={NAV_ICONS.helmReleases}>Helm Releases</PageTitle>
      <Alert variant="info" isInline title="How this is detected" style={{ marginBottom: '1rem' }}>
        Releases are detected by reading Helm's own <code>helm.sh/release.v1</code> Secrets, decoding
        chart/status metadata and the values supplied at install/upgrade time. The rendered manifest
        is intentionally never parsed, since it can embed other resources' (e.g. chart-created
        Secrets') literal data. Select a namespace above (or "All Namespaces") to find releases
        installed there.
      </Alert>
      <ResourceTable
        data={rows}
        columns={columns}
        isLoading={query.isLoading}
        error={query.error as Error | null}
        searchPlaceholder="Find by release or chart name..."
        emptyMessage="No Helm releases found. If you just installed one, make sure the right namespace is selected above."
        getRowId={(row) => `${row.namespace}/${row.name}`}
      />
    </PageSection>
  );
};

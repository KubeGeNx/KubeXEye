import React, { useMemo, useState } from 'react';
import { PageSection, Tabs, Tab, TabTitleText } from '@patternfly/react-core';
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table';
import { ResourceTable } from '../components/table/ResourceTable';
import { ViewMapLink } from '../components/ViewMapLink';
import { ResourceDefinitionButton } from '../components/ResourceDefinitionButton';
import { PageTitle } from '../components/PageTitle';
import { NAV_ICONS } from '../components/layout/navIcons';
import { useDeployments, useStatefulSets, useDaemonSets } from '../hooks/useK8sResources';
import { useNamespace } from '../context/NamespaceContext';
import type { K8sDeployment, K8sStatefulSet, K8sDaemonSet } from '../types/k8s';

const columnHelper = createColumnHelper<any>();

function DeploymentsTable() {
  const { namespace } = useNamespace();
  const query = useDeployments(namespace);

  const rows = useMemo(
    () =>
      (query.data ?? []).map((d: K8sDeployment) => ({
        name: d.metadata.name,
        namespace: d.metadata.namespace,
        ready: `${d.status?.readyReplicas ?? 0}/${d.spec?.replicas ?? 0}`,
        upToDate: d.status?.updatedReplicas ?? 0,
        available: d.status?.availableReplicas ?? 0,
        raw: d,
      })),
    [query.data],
  );

  const columns: ColumnDef<any, any>[] = [
    columnHelper.accessor('name', { header: 'Name' }),
    columnHelper.accessor('namespace', { header: 'Namespace' }),
    columnHelper.accessor('ready', { header: 'Ready' }),
    columnHelper.accessor('upToDate', { header: 'Up-to-date' }),
    columnHelper.accessor('available', { header: 'Available' }),
    columnHelper.display({
      id: 'map',
      header: 'Dependencies',
      cell: (c) => <ViewMapLink kind="Deployment" name={c.row.original.name} namespace={c.row.original.namespace} />,
    }),
    columnHelper.display({
      id: 'definition',
      header: 'Definition',
      cell: (c) => (
        <ResourceDefinitionButton resource={c.row.original.raw} title={`Deployment/${c.row.original.namespace}/${c.row.original.name}`} />
      ),
    }),
  ];

  return (
    <ResourceTable
      data={rows}
      columns={columns}
      isLoading={query.isLoading}
      error={query.error as Error | null}
      getRowId={(r) => `${r.namespace}/${r.name}`}
    />
  );
}

function StatefulSetsTable() {
  const { namespace } = useNamespace();
  const query = useStatefulSets(namespace);

  const rows = useMemo(
    () =>
      (query.data ?? []).map((s: K8sStatefulSet) => ({
        name: s.metadata.name,
        namespace: s.metadata.namespace,
        ready: `${s.status?.readyReplicas ?? 0}/${s.spec?.replicas ?? 0}`,
        updated: s.status?.updatedReplicas ?? 0,
        raw: s,
      })),
    [query.data],
  );

  const columns: ColumnDef<any, any>[] = [
    columnHelper.accessor('name', { header: 'Name' }),
    columnHelper.accessor('namespace', { header: 'Namespace' }),
    columnHelper.accessor('ready', { header: 'Ready' }),
    columnHelper.accessor('updated', { header: 'Updated' }),
    columnHelper.display({
      id: 'map',
      header: 'Dependencies',
      cell: (c) => <ViewMapLink kind="StatefulSet" name={c.row.original.name} namespace={c.row.original.namespace} />,
    }),
    columnHelper.display({
      id: 'definition',
      header: 'Definition',
      cell: (c) => (
        <ResourceDefinitionButton resource={c.row.original.raw} title={`StatefulSet/${c.row.original.namespace}/${c.row.original.name}`} />
      ),
    }),
  ];

  return (
    <ResourceTable
      data={rows}
      columns={columns}
      isLoading={query.isLoading}
      error={query.error as Error | null}
      getRowId={(r) => `${r.namespace}/${r.name}`}
    />
  );
}

function DaemonSetsTable() {
  const { namespace } = useNamespace();
  const query = useDaemonSets(namespace);

  const rows = useMemo(
    () =>
      (query.data ?? []).map((d: K8sDaemonSet) => ({
        name: d.metadata.name,
        namespace: d.metadata.namespace,
        desired: d.status?.desiredNumberScheduled ?? 0,
        ready: d.status?.numberReady ?? 0,
        available: d.status?.numberAvailable ?? 0,
        raw: d,
      })),
    [query.data],
  );

  const columns: ColumnDef<any, any>[] = [
    columnHelper.accessor('name', { header: 'Name' }),
    columnHelper.accessor('namespace', { header: 'Namespace' }),
    columnHelper.accessor('desired', { header: 'Desired' }),
    columnHelper.accessor('ready', { header: 'Ready' }),
    columnHelper.accessor('available', { header: 'Available' }),
    columnHelper.display({
      id: 'map',
      header: 'Dependencies',
      cell: (c) => <ViewMapLink kind="DaemonSet" name={c.row.original.name} namespace={c.row.original.namespace} />,
    }),
    columnHelper.display({
      id: 'definition',
      header: 'Definition',
      cell: (c) => (
        <ResourceDefinitionButton resource={c.row.original.raw} title={`DaemonSet/${c.row.original.namespace}/${c.row.original.name}`} />
      ),
    }),
  ];

  return (
    <ResourceTable
      data={rows}
      columns={columns}
      isLoading={query.isLoading}
      error={query.error as Error | null}
      getRowId={(r) => `${r.namespace}/${r.name}`}
    />
  );
}

export const Workloads: React.FC = () => {
  const [activeKey, setActiveKey] = useState<string | number>(0);

  return (
    <PageSection>
      <PageTitle icon={NAV_ICONS.workloads}>Workloads</PageTitle>
      <Tabs activeKey={activeKey} onSelect={(_e, key) => setActiveKey(key)}>
        <Tab eventKey={0} title={<TabTitleText>Deployments</TabTitleText>}>
          <DeploymentsTable />
        </Tab>
        <Tab eventKey={1} title={<TabTitleText>StatefulSets</TabTitleText>}>
          <StatefulSetsTable />
        </Tab>
        <Tab eventKey={2} title={<TabTitleText>DaemonSets</TabTitleText>}>
          <DaemonSetsTable />
        </Tab>
      </Tabs>
    </PageSection>
  );
};

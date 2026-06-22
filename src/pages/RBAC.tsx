import React, { useMemo, useState } from 'react';
import { PageSection, Tabs, Tab, TabTitleText } from '@patternfly/react-core';
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table';
import { ResourceTable } from '../components/table/ResourceTable';
import { ResourceDefinitionButton } from '../components/ResourceDefinitionButton';
import { PageTitle } from '../components/PageTitle';
import { NAV_ICONS } from '../components/layout/navIcons';
import {
  useRoles,
  useRoleBindings,
  useClusterRoles,
  useClusterRoleBindings,
} from '../hooks/useK8sResources';
import { useNamespace } from '../context/NamespaceContext';
import type { K8sRole, K8sRoleBinding } from '../types/k8s';

const columnHelper = createColumnHelper<any>();

function summarizeRules(role: K8sRole): string {
  return (
    role.rules
      ?.map((r) => `${(r.resources ?? ['*']).join('/')}: ${r.verbs.join(',')}`)
      .join('; ') || '—'
  );
}

function RolesTable() {
  const { namespace } = useNamespace();
  const query = useRoles(namespace);
  const rows = useMemo(
    () =>
      (query.data ?? []).map((r: K8sRole) => ({
        name: r.metadata.name,
        namespace: r.metadata.namespace,
        rules: summarizeRules(r),
        raw: r,
      })),
    [query.data],
  );
  const columns: ColumnDef<any, any>[] = [
    columnHelper.accessor('name', {
      header: 'Name',
      cell: (c) => (
        <ResourceDefinitionButton
          resource={c.row.original.raw}
          title={`Role/${c.row.original.namespace}/${c.row.original.name}`}
          label={c.getValue()}
        />
      ),
    }),
    columnHelper.accessor('namespace', { header: 'Namespace' }),
    columnHelper.accessor('rules', { header: 'Rules' }),
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

function bindingSummary(binding: K8sRoleBinding): { roleRef: string; subjects: string } {
  return {
    roleRef: `${binding.roleRef.kind}/${binding.roleRef.name}`,
    subjects: binding.subjects?.map((s) => `${s.kind}:${s.name}`).join(', ') || '—',
  };
}

function RoleBindingsTable() {
  const { namespace } = useNamespace();
  const query = useRoleBindings(namespace);
  const rows = useMemo(
    () =>
      (query.data ?? []).map((b: K8sRoleBinding) => ({
        name: b.metadata.name,
        namespace: b.metadata.namespace,
        ...bindingSummary(b),
        raw: b,
      })),
    [query.data],
  );
  const columns: ColumnDef<any, any>[] = [
    columnHelper.accessor('name', {
      header: 'Name',
      cell: (c) => (
        <ResourceDefinitionButton
          resource={c.row.original.raw}
          title={`RoleBinding/${c.row.original.namespace}/${c.row.original.name}`}
          label={c.getValue()}
        />
      ),
    }),
    columnHelper.accessor('namespace', { header: 'Namespace' }),
    columnHelper.accessor('roleRef', { header: 'Role Ref' }),
    columnHelper.accessor('subjects', { header: 'Subjects' }),
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

function ClusterRolesTable() {
  const query = useClusterRoles();
  const rows = useMemo(
    () =>
      (query.data ?? []).map((r: K8sRole) => ({
        name: r.metadata.name,
        rules: summarizeRules(r),
        raw: r,
      })),
    [query.data],
  );
  const columns: ColumnDef<any, any>[] = [
    columnHelper.accessor('name', {
      header: 'Name',
      cell: (c) => (
        <ResourceDefinitionButton resource={c.row.original.raw} title={`ClusterRole/${c.row.original.name}`} label={c.getValue()} />
      ),
    }),
    columnHelper.accessor('rules', { header: 'Rules' }),
  ];
  return (
    <ResourceTable
      data={rows}
      columns={columns}
      isLoading={query.isLoading}
      error={query.error as Error | null}
      getRowId={(r) => r.name}
    />
  );
}

function ClusterRoleBindingsTable() {
  const query = useClusterRoleBindings();
  const rows = useMemo(
    () =>
      (query.data ?? []).map((b: K8sRoleBinding) => ({
        name: b.metadata.name,
        ...bindingSummary(b),
        raw: b,
      })),
    [query.data],
  );
  const columns: ColumnDef<any, any>[] = [
    columnHelper.accessor('name', {
      header: 'Name',
      cell: (c) => (
        <ResourceDefinitionButton
          resource={c.row.original.raw}
          title={`ClusterRoleBinding/${c.row.original.name}`}
          label={c.getValue()}
        />
      ),
    }),
    columnHelper.accessor('roleRef', { header: 'Role Ref' }),
    columnHelper.accessor('subjects', { header: 'Subjects' }),
  ];
  return (
    <ResourceTable
      data={rows}
      columns={columns}
      isLoading={query.isLoading}
      error={query.error as Error | null}
      getRowId={(r) => r.name}
    />
  );
}

export const RBAC: React.FC = () => {
  const [activeKey, setActiveKey] = useState<string | number>(0);

  return (
    <PageSection>
      <PageTitle icon={NAV_ICONS.rbac}>RBAC</PageTitle>
      <Tabs activeKey={activeKey} onSelect={(_e, key) => setActiveKey(key)}>
        <Tab eventKey={0} title={<TabTitleText>Roles</TabTitleText>}>
          <RolesTable />
        </Tab>
        <Tab eventKey={1} title={<TabTitleText>RoleBindings</TabTitleText>}>
          <RoleBindingsTable />
        </Tab>
        <Tab eventKey={2} title={<TabTitleText>ClusterRoles</TabTitleText>}>
          <ClusterRolesTable />
        </Tab>
        <Tab eventKey={3} title={<TabTitleText>ClusterRoleBindings</TabTitleText>}>
          <ClusterRoleBindingsTable />
        </Tab>
      </Tabs>
    </PageSection>
  );
};

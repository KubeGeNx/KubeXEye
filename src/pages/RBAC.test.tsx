import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/renderWithProviders';
import { RBAC } from './RBAC';
import {
  useRoles,
  useRoleBindings,
  useClusterRoles,
  useClusterRoleBindings,
} from '../hooks/useK8sResources';
import type { K8sRole, K8sRoleBinding } from '../types/k8s';

vi.mock('../hooks/useK8sResources', () => ({
  useRoles: vi.fn(),
  useRoleBindings: vi.fn(),
  useClusterRoles: vi.fn(),
  useClusterRoleBindings: vi.fn(),
}));

function role(name: string, namespace: string): K8sRole {
  return {
    metadata: { name, namespace },
    rules: [{ resources: ['pods'], verbs: ['get', 'list'] }],
  };
}

function roleBinding(name: string, namespace: string): K8sRoleBinding {
  return {
    metadata: { name, namespace },
    roleRef: { kind: 'Role', name: 'pod-reader', apiGroup: 'rbac.authorization.k8s.io' },
    subjects: [{ kind: 'User', name: 'alice' }],
  };
}

function clusterRole(name: string): K8sRole {
  return {
    metadata: { name },
    rules: [{ resources: ['nodes'], verbs: ['get', 'watch'] }],
  };
}

function clusterRoleBinding(name: string): K8sRoleBinding {
  return {
    metadata: { name },
    roleRef: { kind: 'ClusterRole', name: 'cluster-admin', apiGroup: 'rbac.authorization.k8s.io' },
    subjects: [{ kind: 'Group', name: 'admins' }],
  };
}

describe('RBAC page', () => {
  it('renders rows with derived Rules text in the Roles sub-table (default active tab)', () => {
    setAllHooks({ roleName: 'pod-reader-role' });

    renderWithProviders(<RBAC />);

    expect(screen.getByText('pod-reader-role')).toBeInTheDocument();
    expect(screen.getByText('pods: get,list')).toBeInTheDocument();
  });

  it('renders rows with derived Role Ref / Subjects text in the RoleBindings sub-table', async () => {
    const user = userEvent.setup();
    setAllHooks({ roleBindingName: 'pod-reader-binding' });

    renderWithProviders(<RBAC />);
    await user.click(screen.getByRole('tab', { name: 'RoleBindings' }));

    expect(screen.getByText('pod-reader-binding')).toBeInTheDocument();
    expect(screen.getByText('Role/pod-reader')).toBeInTheDocument();
    expect(screen.getByText('User:alice')).toBeInTheDocument();
  });

  it('renders rows with derived Rules text in the ClusterRoles sub-table', async () => {
    const user = userEvent.setup();
    setAllHooks({ clusterRoleName: 'node-viewer-clusterrole' });

    renderWithProviders(<RBAC />);
    await user.click(screen.getByRole('tab', { name: 'ClusterRoles' }));

    expect(screen.getByText('node-viewer-clusterrole')).toBeInTheDocument();
    expect(screen.getByText('nodes: get,watch')).toBeInTheDocument();
  });

  it('renders rows with derived Role Ref / Subjects text in the ClusterRoleBindings sub-table', async () => {
    const user = userEvent.setup();
    setAllHooks({ clusterRoleBindingName: 'admin-clusterrolebinding' });

    renderWithProviders(<RBAC />);
    await user.click(screen.getByRole('tab', { name: 'ClusterRoleBindings' }));

    expect(screen.getByText('admin-clusterrolebinding')).toBeInTheDocument();
    expect(screen.getByText('ClusterRole/cluster-admin')).toBeInTheDocument();
    expect(screen.getByText('Group:admins')).toBeInTheDocument();
  });

  it('opens the Role definition when its name is clicked', async () => {
    const user = userEvent.setup();
    setAllHooks({ roleName: 'pod-reader-role' });

    renderWithProviders(<RBAC />);

    await user.click(screen.getByRole('button', { name: 'pod-reader-role' }));

    expect(screen.getByText('Role/default/pod-reader-role')).toBeInTheDocument();
  });

  it('opens the RoleBinding definition when its name is clicked', async () => {
    const user = userEvent.setup();
    setAllHooks({ roleBindingName: 'pod-reader-binding' });

    renderWithProviders(<RBAC />);
    await user.click(screen.getByRole('tab', { name: 'RoleBindings' }));

    await user.click(screen.getByRole('button', { name: 'pod-reader-binding' }));

    expect(screen.getByText('RoleBinding/default/pod-reader-binding')).toBeInTheDocument();
  });

  it('opens the ClusterRole definition when its name is clicked', async () => {
    const user = userEvent.setup();
    setAllHooks({ clusterRoleName: 'node-viewer-clusterrole' });

    renderWithProviders(<RBAC />);
    await user.click(screen.getByRole('tab', { name: 'ClusterRoles' }));

    await user.click(screen.getByRole('button', { name: 'node-viewer-clusterrole' }));

    expect(screen.getByText('ClusterRole/node-viewer-clusterrole')).toBeInTheDocument();
  });

  it('opens the ClusterRoleBinding definition when its name is clicked', async () => {
    const user = userEvent.setup();
    setAllHooks({ clusterRoleBindingName: 'admin-clusterrolebinding' });

    renderWithProviders(<RBAC />);
    await user.click(screen.getByRole('tab', { name: 'ClusterRoleBindings' }));

    await user.click(screen.getByRole('button', { name: 'admin-clusterrolebinding' }));

    expect(screen.getByText('ClusterRoleBinding/admin-clusterrolebinding')).toBeInTheDocument();
  });
});

interface HookNames {
  roleName?: string;
  roleBindingName?: string;
  clusterRoleName?: string;
  clusterRoleBindingName?: string;
}

function setAllHooks({ roleName, roleBindingName, clusterRoleName, clusterRoleBindingName }: HookNames) {
  vi.mocked(useRoles).mockReturnValue({
    data: roleName ? [role(roleName, 'default')] : [],
    isLoading: false,
    error: null,
  } as any);
  vi.mocked(useRoleBindings).mockReturnValue({
    data: roleBindingName ? [roleBinding(roleBindingName, 'default')] : [],
    isLoading: false,
    error: null,
  } as any);
  vi.mocked(useClusterRoles).mockReturnValue({
    data: clusterRoleName ? [clusterRole(clusterRoleName)] : [],
    isLoading: false,
    error: null,
  } as any);
  vi.mocked(useClusterRoleBindings).mockReturnValue({
    data: clusterRoleBindingName ? [clusterRoleBinding(clusterRoleBindingName)] : [],
    isLoading: false,
    error: null,
  } as any);
}

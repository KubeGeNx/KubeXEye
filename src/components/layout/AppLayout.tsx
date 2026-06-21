import React, { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Page,
  Masthead,
  MastheadMain,
  MastheadBrand,
  MastheadToggle,
  MastheadContent,
  PageToggleButton,
  PageSidebar,
  PageSidebarBody,
  Nav,
  NavList,
  NavItem,
  NavExpandable,
  PageSection,
  Brand,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  Flex,
  FlexItem,
} from '@patternfly/react-core';
import { BarsIcon } from '@patternfly/react-icons';
import { NamespaceSelector } from './NamespaceSelector';
import { Logo } from './Logo';
import { NAV_ICONS, K8S_BLUE, type NavIcon } from './navIcons';

const navSections: { title: string; items: { to: string; label: string; icon: NavIcon }[] }[] = [
  {
    title: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', icon: NAV_ICONS.dashboard },
      { to: '/panic', label: 'Panic Dashboard', icon: NAV_ICONS.panic },
      { to: '/dependency-map', label: 'Dependency Map', icon: NAV_ICONS.dependencyMap },
    ],
  },
  {
    title: 'Workloads',
    items: [
      { to: '/pods', label: 'Pods', icon: NAV_ICONS.pods },
      { to: '/workloads', label: 'Deployments / StatefulSets / DaemonSets', icon: NAV_ICONS.workloads },
    ],
  },
  {
    title: 'Cluster',
    items: [
      { to: '/nodes', label: 'Nodes', icon: NAV_ICONS.nodes },
      { to: '/namespaces', label: 'Namespaces', icon: NAV_ICONS.namespaces },
      { to: '/events', label: 'Events', icon: NAV_ICONS.events },
    ],
  },
  {
    title: 'Networking',
    items: [
      { to: '/services', label: 'Services', icon: NAV_ICONS.services },
      { to: '/ingress', label: 'Ingress', icon: NAV_ICONS.ingress },
      { to: '/network-policies', label: 'Network Policies', icon: NAV_ICONS.networkPolicies },
    ],
  },
  {
    title: 'Storage',
    items: [
      { to: '/persistent-volume-claims', label: 'Persistent Volume Claims', icon: NAV_ICONS.pvc },
      { to: '/storage-classes', label: 'Storage Classes', icon: NAV_ICONS.storageClasses },
    ],
  },
  {
    title: 'Configuration & Secrets',
    items: [
      { to: '/configmaps', label: 'ConfigMaps', icon: NAV_ICONS.configMaps },
      { to: '/secrets', label: 'Secrets', icon: NAV_ICONS.secrets },
      { to: '/serviceaccounts', label: 'Service Accounts', icon: NAV_ICONS.serviceAccounts },
    ],
  },
  {
    title: 'Access Control',
    items: [{ to: '/rbac', label: 'RBAC', icon: NAV_ICONS.rbac }],
  },
  {
    title: 'Extensions',
    items: [
      { to: '/custom-resources', label: 'Custom Resources (CRDs)', icon: NAV_ICONS.customResources },
      { to: '/helm-releases', label: 'Helm Releases', icon: NAV_ICONS.helmReleases },
    ],
  },
  {
    title: 'Administration',
    items: [{ to: '/settings', label: 'Cluster Connection', icon: NAV_ICONS.settings }],
  },
];

export const AppLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();

  const sidebar = (
    <PageSidebar isSidebarOpen={sidebarOpen}>
      <PageSidebarBody>
        <Nav>
          <NavList>
            {navSections.map((section) => (
              <NavExpandable key={section.title} title={section.title} isExpanded>
                {section.items.map((item) => (
                  <NavItem key={item.to} itemId={item.to} isActive={location.pathname === item.to}>
                    <NavLink to={item.to} end>
                      <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsSm' }}>
                        <FlexItem>
                          <item.icon style={{ color: K8S_BLUE }} />
                        </FlexItem>
                        <FlexItem>{item.label}</FlexItem>
                      </Flex>
                    </NavLink>
                  </NavItem>
                ))}
              </NavExpandable>
            ))}
          </NavList>
        </Nav>
      </PageSidebarBody>
    </PageSidebar>
  );

  const masthead = (
    <Masthead>
      <MastheadMain>
        <MastheadToggle>
          <PageToggleButton
            variant="plain"
            aria-label="Global navigation"
            isSidebarOpen={sidebarOpen}
            onSidebarToggle={() => setSidebarOpen((open) => !open)}
          >
            <BarsIcon />
          </PageToggleButton>
        </MastheadToggle>
        <MastheadBrand>
          <Brand alt="KubeXEye">
            <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsSm' }}>
              <FlexItem>
                <Logo />
              </FlexItem>
              <FlexItem>
                <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'white', letterSpacing: '0.02em' }}>
                  KubeXEye
                </span>
              </FlexItem>
            </Flex>
          </Brand>
        </MastheadBrand>
      </MastheadMain>
      <MastheadContent>
        <Toolbar>
          <ToolbarContent>
            <ToolbarItem>
              <NamespaceSelector />
            </ToolbarItem>
          </ToolbarContent>
        </Toolbar>
      </MastheadContent>
    </Masthead>
  );

  return (
    <Page masthead={masthead} sidebar={sidebar} isManagedSidebar={false}>
      <PageSection>
        <Outlet />
      </PageSection>
    </Page>
  );
};

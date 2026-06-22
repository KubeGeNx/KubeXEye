import React, { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useIsFetching } from '@tanstack/react-query';
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
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  Flex,
  FlexItem,
  Spinner,
  Tooltip,
} from '@patternfly/react-core';
import { BarsIcon, SearchIcon } from '@patternfly/react-icons';
import { NamespaceSelector } from './NamespaceSelector';
import { ClusterSelector } from './ClusterSelector';
import { Logo } from './Logo';
import { NAV_ICONS, K8S_BLUE, type NavIcon } from './navIcons';
import { GlobalSearch } from '../GlobalSearch';

const navSections: { title: string; items: { to: string; label: string; icon: NavIcon }[] }[] = [
  {
    title: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', icon: NAV_ICONS.dashboard },
    ],
  },
  {
    title: 'Workloads',
    items: [
      { to: '/pods', label: 'Pods', icon: NAV_ICONS.pods },
      { to: '/workloads', label: 'Controllers/Applications', icon: NAV_ICONS.workloads },
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
    ],
  },
  {
    title: 'Administration',
    items: [{ to: '/settings', label: 'Cluster Connection', icon: NAV_ICONS.settings }],
  },
  {
    title: 'Feature',
    items: [
      { to: '/panic', label: 'Panic Dashboard', icon: NAV_ICONS.panic },
      { to: '/images', label: 'Running Images', icon: NAV_ICONS.images },
      { to: '/helm-releases', label: 'Helm Releases', icon: NAV_ICONS.helmReleases },
      { to: '/dependency-map', label: 'Dependency Map', icon: NAV_ICONS.dependencyMap },
      { to: '/resource-analyser', label: 'Resource Analyser', icon: NAV_ICONS.resourceAnalyser },
    ],
  },
];

const SIDEBAR_WIDTH_KEY = 'kubexeye.sidebarWidth';
const SIDEBAR_MIN_WIDTH = 200;
const SIDEBAR_MAX_WIDTH = 560;
const SIDEBAR_DEFAULT_WIDTH = 290;

export const AppLayout: React.FC = () => {
  const isFetching = useIsFetching();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const stored = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
    return stored >= SIDEBAR_MIN_WIDTH && stored <= SIDEBAR_MAX_WIDTH ? stored : SIDEBAR_DEFAULT_WIDTH;
  });
  const [isResizing, setIsResizing] = useState(false);
  const resizeStart = useRef({ x: 0, width: SIDEBAR_DEFAULT_WIDTH });
  const location = useLocation();

  const handleResizePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      resizeStart.current = { x: event.clientX, width: sidebarWidth };
      setIsResizing(true);
    },
    [sidebarWidth],
  );

  useEffect(() => {
    if (!isResizing) return;

    const handlePointerMove = (event: PointerEvent) => {
      const delta = event.clientX - resizeStart.current.x;
      const nextWidth = Math.min(
        SIDEBAR_MAX_WIDTH,
        Math.max(SIDEBAR_MIN_WIDTH, resizeStart.current.width + delta),
      );
      setSidebarWidth(nextWidth);
    };
    const handlePointerUp = () => setIsResizing(false);

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isResizing]);

  useEffect(() => {
    if (isResizing) return;
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth));
  }, [sidebarWidth, isResizing]);

  const sidebar = (
    <PageSidebar
      isSidebarOpen={sidebarOpen}
      style={{ position: 'relative' }}
    >
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
      {sidebarOpen && (
        <div
          onPointerDown={handleResizePointerDown}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize navigation sidebar"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            right: -3,
            width: 6,
            cursor: 'col-resize',
            zIndex: 1,
            background: isResizing ? 'var(--pf-t--global--color--brand--default)' : 'transparent',
          }}
        />
      )}
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
          <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsSm' }}>
            <FlexItem>
              <Logo />
            </FlexItem>
            <FlexItem>
              <span style={{ fontSize: '1.25rem', fontWeight: 500, color: '#F0EEE8', letterSpacing: '0.02em' }}>
                KubeXEye
              </span>
            </FlexItem>
          </Flex>
        </MastheadBrand>
      </MastheadMain>
      <MastheadContent>
        <Toolbar>
          <ToolbarContent>
            <ToolbarItem>
              <ClusterSelector />
            </ToolbarItem>
            <ToolbarItem>
              <NamespaceSelector />
            </ToolbarItem>
            {/* Cmd+K hint button */}
            <ToolbarItem>
              <Tooltip content="Global search  (⌘K)">
                <button
                  aria-label="Open global search (⌘K)"
                  onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 6,
                    padding: '0.25rem 0.625rem',
                    color: '#7B7970',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                  }}
                >
                  <SearchIcon />
                  <span>Search</span>
                  <kbd style={{ fontFamily: 'monospace', fontSize: '0.7rem', background: 'rgba(255,255,255,0.08)', borderRadius: 3, padding: '0 4px' }}>⌘K</kbd>
                </button>
              </Tooltip>
            </ToolbarItem>
            {/* Background-refetch indicator — shows when any query is in flight */}
            {isFetching > 0 && (
              <ToolbarItem>
                <Tooltip content={`Refreshing data… (${isFetching} request${isFetching > 1 ? 's' : ''} in flight)`}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: '#7EB6F0', fontSize: '0.8rem' }}>
                    <Spinner size="sm" aria-label="Refreshing" style={{ '--pf-v6-c-spinner--Color': '#7EB6F0' } as React.CSSProperties} />
                    <span>Refreshing</span>
                  </span>
                </Tooltip>
              </ToolbarItem>
            )}
          </ToolbarContent>
        </Toolbar>
      </MastheadContent>
    </Masthead>
  );

  return (
    <Page
      masthead={masthead}
      sidebar={sidebar}
      isManagedSidebar={false}
      style={{ '--pf-v6-c-page__sidebar--Width': `${sidebarWidth}px` } as React.CSSProperties}
    >
      {/* GlobalSearch mounts once here — its Cmd+K listener is always active */}
      <GlobalSearch />
      <PageSection>
        <Outlet />
      </PageSection>
    </Page>
  );
};

/**
 * GlobalSearch — Cmd+K / Ctrl+K command palette.
 *
 * Searches two sources simultaneously:
 *  1. Page navigation (always available — no network needed)
 *  2. Live K8s resources already loaded in the React Query cache
 *     (pods, nodes, deployments, services, etc.)
 *
 * Selecting a navigation item goes straight to that page.
 * Selecting a resource item goes to that page and sets the table filter
 * to the resource name via the URL search param ?search=<name>.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Modal,
  ModalBody,
  SearchInput,
  Divider,
} from '@patternfly/react-core';
import {
  CubeIcon,
  ServerIcon,
  NetworkIcon,
  KeyIcon,
  RouteIcon,
} from '@patternfly/react-icons';
import type { K8sPod, K8sNode } from '../types/k8s';

// ── Page index ────────────────────────────────────────────────────────────────

interface PageEntry {
  kind: 'page';
  label: string;
  path: string;
  description: string;
}

const PAGES: PageEntry[] = [
  { kind: 'page', label: 'Dashboard', path: '/', description: 'Cluster overview & health' },
  { kind: 'page', label: 'Pods', path: '/pods', description: 'Running pods' },
  { kind: 'page', label: 'Workloads', path: '/workloads', description: 'Deployments, StatefulSets, DaemonSets, Jobs' },
  { kind: 'page', label: 'Nodes', path: '/nodes', description: 'Cluster nodes' },
  { kind: 'page', label: 'Namespaces', path: '/namespaces', description: 'Kubernetes namespaces' },
  { kind: 'page', label: 'Events', path: '/events', description: 'Cluster events & warnings' },
  { kind: 'page', label: 'Services', path: '/services', description: 'ClusterIP, NodePort, LoadBalancer services' },
  { kind: 'page', label: 'Ingress', path: '/ingress', description: 'Ingress resources' },
  { kind: 'page', label: 'Network Policies', path: '/network-policies', description: 'Network access policies' },
  { kind: 'page', label: 'Persistent Volume Claims', path: '/persistent-volume-claims', description: 'PVCs' },
  { kind: 'page', label: 'Storage Classes', path: '/storage-classes', description: 'Storage class definitions' },
  { kind: 'page', label: 'ConfigMaps', path: '/configmaps', description: 'ConfigMap resources' },
  { kind: 'page', label: 'Secrets', path: '/secrets', description: 'Secret resources' },
  { kind: 'page', label: 'Service Accounts', path: '/serviceaccounts', description: 'Service account resources' },
  { kind: 'page', label: 'RBAC', path: '/rbac', description: 'Roles, bindings, cluster roles' },
  { kind: 'page', label: 'Custom Resources', path: '/custom-resources', description: 'CRD instances' },
  { kind: 'page', label: 'Helm Releases', path: '/helm-releases', description: 'Helm-deployed releases' },
  { kind: 'page', label: 'Dependency Map', path: '/dependency-map', description: 'Visual resource dependency graph' },
  { kind: 'page', label: 'Panic Dashboard', path: '/panic', description: 'Issues requiring immediate attention' },
  { kind: 'page', label: 'Running Images', path: '/images', description: 'Container images in use' },
  { kind: 'page', label: 'Resource Analyser', path: '/resource-analyser', description: 'CPU & memory usage analysis' },
  { kind: 'page', label: 'Cluster Connection', path: '/settings', description: 'Configure kubectl proxy / cluster URL' },
];

// ── Resource extraction from React Query cache ────────────────────────────────

interface ResourceEntry {
  kind: 'resource';
  label: string;
  subLabel: string;   // namespace or node type
  path: string;
  search: string;     // value to pre-fill in the table filter
  icon: React.ReactNode;
}

/** Known query-key prefixes and where they navigate to. */
const RESOURCE_MAP: Array<{
  prefix: string;
  path: string;
  icon: React.ReactNode;
  getName: (item: unknown) => string | null;
  getSub: (item: unknown) => string;
}> = [
  {
    prefix: 'pods',
    path: '/pods',
    icon: <CubeIcon style={{ color: '#7EB6F0' }} />,
    getName: (i) => (i as K8sPod)?.metadata?.name ?? null,
    getSub: (i) => (i as K8sPod)?.metadata?.namespace ?? '',
  },
  {
    prefix: 'nodes',
    path: '/nodes',
    icon: <ServerIcon style={{ color: '#3ABE82' }} />,
    getName: (i) => (i as K8sNode)?.metadata?.name ?? null,
    getSub: () => 'node',
  },
  {
    prefix: 'services',
    path: '/services',
    icon: <NetworkIcon style={{ color: '#F0A028' }} />,
    getName: (i) => (i as any)?.metadata?.name ?? null,
    getSub: (i) => (i as any)?.metadata?.namespace ?? '',
  },
  {
    prefix: 'ingress',
    path: '/ingress',
    icon: <RouteIcon style={{ color: '#C678DD' }} />,
    getName: (i) => (i as any)?.metadata?.name ?? null,
    getSub: (i) => (i as any)?.metadata?.namespace ?? '',
  },
  {
    prefix: 'secrets',
    path: '/secrets',
    icon: <KeyIcon style={{ color: '#E25A5A' }} />,
    getName: (i) => (i as any)?.metadata?.name ?? null,
    getSub: (i) => (i as any)?.metadata?.namespace ?? '',
  },
];

function useResourceEntries(): ResourceEntry[] {
  const qc = useQueryClient();
  return useMemo(() => {
    const entries: ResourceEntry[] = [];
    for (const { prefix, path, icon, getName, getSub } of RESOURCE_MAP) {
      // React Query caches data under array keys; grab any query whose first
      // element starts with our prefix string.
      const all = qc.getQueriesData<{ items?: unknown[] } | unknown[]>({ queryKey: [prefix] });
      for (const [, data] of all) {
        if (!data) continue;
        const items: unknown[] = Array.isArray(data) ? data : (data as any)?.items ?? [];
        for (const item of items) {
          const name = getName(item);
          if (!name) continue;
          entries.push({
            kind: 'resource',
            label: name,
            subLabel: getSub(item),
            path,
            search: name,
            icon,
          });
        }
      }
    }
    return entries;
  }, [qc]);
}

// ── Result rendering ──────────────────────────────────────────────────────────

type SearchEntry = PageEntry | ResourceEntry;

const itemStyle = (active: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  padding: '0.5rem 0.75rem',
  borderRadius: 6,
  cursor: 'pointer',
  background: active ? 'rgba(126,182,240,0.12)' : 'transparent',
  border: active ? '1px solid rgba(126,182,240,0.3)' : '1px solid transparent',
  transition: 'background 0.1s',
});

const labelStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
};

// ── Component ─────────────────────────────────────────────────────────────────

export const GlobalSearch: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const navigate = useNavigate();
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const resourceEntries = useResourceEntries();

  // Open on Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Focus search when modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 50);
      setQuery('');
      setActiveIdx(0);
    }
  }, [open]);

  const results = useMemo<SearchEntry[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return PAGES.slice(0, 8);
    }
    const pages = PAGES.filter(
      (p) => p.label.toLowerCase().includes(q) || p.description.toLowerCase().includes(q),
    );
    const resources = resourceEntries.filter((r) => r.label.toLowerCase().includes(q));
    // Deduplicate resource entries by label+path
    const seen = new Set<string>();
    const uniqueResources = resources.filter((r) => {
      const key = `${r.path}:${r.label}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return [...pages, ...uniqueResources].slice(0, 20);
  }, [query, resourceEntries]);

  // Reset active index when results change
  useEffect(() => setActiveIdx(0), [results]);

  const select = useCallback(
    (entry: SearchEntry) => {
      if (entry.kind === 'page') {
        navigate(entry.path);
      } else {
        navigate(`${entry.path}?search=${encodeURIComponent(entry.search)}`);
      }
      setOpen(false);
    },
    [navigate],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[activeIdx]) {
      select(results[activeIdx]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  // Scroll active item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const activeEl = list.querySelector<HTMLDivElement>('[data-active="true"]');
    activeEl?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  if (!open) return null;

  return (
    <Modal
      isOpen={open}
      onClose={() => setOpen(false)}
      aria-label="Global search"
      variant="small"
      style={{ '--pf-v6-c-modal-box--Width': '560px' } as React.CSSProperties}
    >
      <ModalBody style={{ padding: 0 }}>
        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <SearchInput
            ref={searchRef}
            placeholder="Search pages and resources…"
            value={query}
            onChange={(_e, v) => setQuery(v)}
            onClear={() => setQuery('')}
            onKeyDown={handleKeyDown}
            aria-label="Global search input"
            style={{ width: '100%' }}
          />
        </div>

        <div
          ref={listRef}
          style={{ maxHeight: 420, overflowY: 'auto', padding: '0.5rem' }}
          role="listbox"
          aria-label="Search results"
        >
          {results.length === 0 ? (
            <p style={{ color: '#7B7970', textAlign: 'center', padding: '1.5rem', margin: 0, fontSize: '0.875rem' }}>
              No results for "{query}"
            </p>
          ) : (
            <>
              {/* Pages section */}
              {results.some((r) => r.kind === 'page') && (
                <>
                  <p style={{ color: '#7B7970', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0.25rem 0.5rem 0.25rem' }}>
                    Pages
                  </p>
                  {results
                    .map((r, i) => ({ r, i }))
                    .filter(({ r }) => r.kind === 'page')
                    .map(({ r, i }) => (
                      <div
                        key={`page-${(r as PageEntry).path}`}
                        role="option"
                        aria-selected={activeIdx === i}
                        data-active={activeIdx === i}
                        style={itemStyle(activeIdx === i)}
                        onClick={() => select(r)}
                        onMouseEnter={() => setActiveIdx(i)}
                      >
                        <RouteIcon style={{ color: '#7EB6F0', flexShrink: 0 }} />
                        <span style={labelStyle}>
                          <span style={{ color: '#F0EEE8', fontSize: '0.875rem' }}>{(r as PageEntry).label}</span>
                          <span style={{ color: '#7B7970', fontSize: '0.75rem' }}>{(r as PageEntry).description}</span>
                        </span>
                      </div>
                    ))}
                </>
              )}

              {/* Resources section */}
              {results.some((r) => r.kind === 'resource') && (
                <>
                  <Divider style={{ margin: '0.5rem 0' }} />
                  <p style={{ color: '#7B7970', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0.25rem 0.5rem 0.25rem' }}>
                    Resources
                  </p>
                  {results
                    .map((r, i) => ({ r, i }))
                    .filter(({ r }) => r.kind === 'resource')
                    .map(({ r, i }) => {
                      const res = r as ResourceEntry;
                      return (
                        <div
                          key={`res-${res.path}-${res.label}`}
                          role="option"
                          aria-selected={activeIdx === i}
                          data-active={activeIdx === i}
                          style={itemStyle(activeIdx === i)}
                          onClick={() => select(r)}
                          onMouseEnter={() => setActiveIdx(i)}
                        >
                          <span style={{ flexShrink: 0 }}>{res.icon}</span>
                          <span style={labelStyle}>
                            <span style={{ color: '#F0EEE8', fontSize: '0.875rem' }}>{res.label}</span>
                            {res.subLabel && (
                              <span style={{ color: '#7B7970', fontSize: '0.75rem' }}>{res.subLabel}</span>
                            )}
                          </span>
                        </div>
                      );
                    })}
                </>
              )}
            </>
          )}
        </div>

        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.08)',
          padding: '0.4rem 1rem',
          display: 'flex',
          gap: '1rem',
          fontSize: '0.7rem',
          color: '#7B7970',
        }}>
          <span><kbd style={{ fontFamily: 'monospace' }}>↑↓</kbd> navigate</span>
          <span><kbd style={{ fontFamily: 'monospace' }}>↵</kbd> open</span>
          <span><kbd style={{ fontFamily: 'monospace' }}>Esc</kbd> close</span>
          <span style={{ marginLeft: 'auto' }}><kbd style={{ fontFamily: 'monospace' }}>⌘K</kbd> to reopen</span>
        </div>
      </ModalBody>
    </Modal>
  );
};

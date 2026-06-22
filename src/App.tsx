import React, { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Bullseye, Spinner } from '@patternfly/react-core';
import { ConnectionProvider } from './context/ConnectionContext';
import { NamespaceProvider } from './context/NamespaceContext';
import { DefinitionViewerProvider } from './context/DefinitionViewerContext';
import { PodDetailProvider } from './context/PodDetailContext';
import { AppLayout } from './components/layout/AppLayout';
import { ErrorBoundary } from './components/ErrorBoundary';

// Route-level code splitting — each page loads only when first navigated to,
// keeping the initial bundle small and improving time-to-interactive.
const Dashboard           = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Nodes               = lazy(() => import('./pages/Nodes').then(m => ({ default: m.Nodes })));
const Pods                = lazy(() => import('./pages/Pods').then(m => ({ default: m.Pods })));
const Images              = lazy(() => import('./pages/Images').then(m => ({ default: m.Images })));
const Workloads           = lazy(() => import('./pages/Workloads').then(m => ({ default: m.Workloads })));
const Namespaces          = lazy(() => import('./pages/Namespaces').then(m => ({ default: m.Namespaces })));
const Events              = lazy(() => import('./pages/Events').then(m => ({ default: m.Events })));
const ConfigMaps          = lazy(() => import('./pages/ConfigMaps').then(m => ({ default: m.ConfigMaps })));
const Secrets             = lazy(() => import('./pages/Secrets').then(m => ({ default: m.Secrets })));
const ServiceAccounts     = lazy(() => import('./pages/ServiceAccounts').then(m => ({ default: m.ServiceAccounts })));
const RBAC                = lazy(() => import('./pages/RBAC').then(m => ({ default: m.RBAC })));
const NetworkPolicies     = lazy(() => import('./pages/NetworkPolicies').then(m => ({ default: m.NetworkPolicies })));
const CustomResources     = lazy(() => import('./pages/CustomResources').then(m => ({ default: m.CustomResources })));
const Settings            = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const Services            = lazy(() => import('./pages/Services').then(m => ({ default: m.Services })));
const Ingress             = lazy(() => import('./pages/Ingress').then(m => ({ default: m.Ingress })));
const PersistentVolumeClaims = lazy(() => import('./pages/PersistentVolumeClaims').then(m => ({ default: m.PersistentVolumeClaims })));
const StorageClasses      = lazy(() => import('./pages/StorageClasses').then(m => ({ default: m.StorageClasses })));
const DependencyMap       = lazy(() => import('./pages/DependencyMap').then(m => ({ default: m.DependencyMap })));
const HelmReleases        = lazy(() => import('./pages/HelmReleases').then(m => ({ default: m.HelmReleases })));
const PanicPage           = lazy(() => import('./pages/PanicPage').then(m => ({ default: m.PanicPage })));
const ResourceAnalyser    = lazy(() => import('./pages/ResourceAnalyser').then(m => ({ default: m.ResourceAnalyser })));

const PageSpinner = () => (
  <Bullseye style={{ minHeight: 320 }}>
    <Spinner size="lg" aria-label="Loading page" />
  </Bullseye>
);

// Smarter retry: never retry 4xx (resource doesn't exist / not authorised),
// retry up to 2× on network or 5xx errors.
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;
  const status = (error as { status?: number })?.status;
  if (status && status >= 400 && status < 500) return false;
  return true;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetry,
      refetchOnWindowFocus: false,
      // Data is kept fresh by per-hook refetchIntervals; staleTime 0 means React
      // Query won't suppress a background refetch when a component remounts.
      staleTime: 0,
      // Keep unused cache entries for 5 minutes so navigating back to a page
      // shows instant data while a background refresh completes.
      gcTime: 5 * 60_000,
      // Run fetches even when the browser reports offline — necessary for
      // localhost kubectl-proxy setups that look "online" to the browser but
      // talk to a local process, not the public internet.
      networkMode: 'always',
    },
  },
});

export const App: React.FC = () => (
  <QueryClientProvider client={queryClient}>
    <ConnectionProvider>
      <NamespaceProvider>
        <DefinitionViewerProvider>
          <PodDetailProvider>
            <BrowserRouter>
              {/* Top-level boundary: catches crashes in providers / layout itself */}
              <ErrorBoundary label="Application shell">
                <Routes>
                  <Route element={<AppLayout />}>
                    {/* Each route gets its own boundary — a bad CRD or malformed
                        API response on one page won't black-screen the whole app */}
                    <Route path="/" element={<ErrorBoundary label="Dashboard"><Suspense fallback={<PageSpinner />}><Dashboard /></Suspense></ErrorBoundary>} />
                    <Route path="/nodes" element={<ErrorBoundary label="Nodes"><Suspense fallback={<PageSpinner />}><Nodes /></Suspense></ErrorBoundary>} />
                    <Route path="/pods" element={<ErrorBoundary label="Pods"><Suspense fallback={<PageSpinner />}><Pods /></Suspense></ErrorBoundary>} />
                    <Route path="/images" element={<ErrorBoundary label="Images"><Suspense fallback={<PageSpinner />}><Images /></Suspense></ErrorBoundary>} />
                    <Route path="/workloads" element={<ErrorBoundary label="Workloads"><Suspense fallback={<PageSpinner />}><Workloads /></Suspense></ErrorBoundary>} />
                    <Route path="/namespaces" element={<ErrorBoundary label="Namespaces"><Suspense fallback={<PageSpinner />}><Namespaces /></Suspense></ErrorBoundary>} />
                    <Route path="/events" element={<ErrorBoundary label="Events"><Suspense fallback={<PageSpinner />}><Events /></Suspense></ErrorBoundary>} />
                    <Route path="/configmaps" element={<ErrorBoundary label="ConfigMaps"><Suspense fallback={<PageSpinner />}><ConfigMaps /></Suspense></ErrorBoundary>} />
                    <Route path="/secrets" element={<ErrorBoundary label="Secrets"><Suspense fallback={<PageSpinner />}><Secrets /></Suspense></ErrorBoundary>} />
                    <Route path="/serviceaccounts" element={<ErrorBoundary label="Service Accounts"><Suspense fallback={<PageSpinner />}><ServiceAccounts /></Suspense></ErrorBoundary>} />
                    <Route path="/rbac" element={<ErrorBoundary label="RBAC"><Suspense fallback={<PageSpinner />}><RBAC /></Suspense></ErrorBoundary>} />
                    <Route path="/network-policies" element={<ErrorBoundary label="Network Policies"><Suspense fallback={<PageSpinner />}><NetworkPolicies /></Suspense></ErrorBoundary>} />
                    <Route path="/services" element={<ErrorBoundary label="Services"><Suspense fallback={<PageSpinner />}><Services /></Suspense></ErrorBoundary>} />
                    <Route path="/ingress" element={<ErrorBoundary label="Ingress"><Suspense fallback={<PageSpinner />}><Ingress /></Suspense></ErrorBoundary>} />
                    <Route path="/persistent-volume-claims" element={<ErrorBoundary label="Persistent Volume Claims"><Suspense fallback={<PageSpinner />}><PersistentVolumeClaims /></Suspense></ErrorBoundary>} />
                    <Route path="/storage-classes" element={<ErrorBoundary label="Storage Classes"><Suspense fallback={<PageSpinner />}><StorageClasses /></Suspense></ErrorBoundary>} />
                    <Route path="/dependency-map" element={<ErrorBoundary label="Dependency Map"><Suspense fallback={<PageSpinner />}><DependencyMap /></Suspense></ErrorBoundary>} />
                    <Route path="/panic" element={<ErrorBoundary label="Panic Dashboard"><Suspense fallback={<PageSpinner />}><PanicPage /></Suspense></ErrorBoundary>} />
                    <Route path="/helm-releases" element={<ErrorBoundary label="Helm Releases"><Suspense fallback={<PageSpinner />}><HelmReleases /></Suspense></ErrorBoundary>} />
                    <Route path="/custom-resources" element={<ErrorBoundary label="Custom Resources"><Suspense fallback={<PageSpinner />}><CustomResources /></Suspense></ErrorBoundary>} />
                    <Route path="/settings" element={<ErrorBoundary label="Settings"><Suspense fallback={<PageSpinner />}><Settings /></Suspense></ErrorBoundary>} />
                    <Route path="/resource-analyser" element={<ErrorBoundary label="Resource Analyser"><Suspense fallback={<PageSpinner />}><ResourceAnalyser /></Suspense></ErrorBoundary>} />
                  </Route>
                </Routes>
              </ErrorBoundary>
            </BrowserRouter>
          </PodDetailProvider>
        </DefinitionViewerProvider>
      </NamespaceProvider>
    </ConnectionProvider>
  </QueryClientProvider>
);

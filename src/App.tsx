import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ConnectionProvider } from './context/ConnectionContext';
import { NamespaceProvider } from './context/NamespaceContext';
import { DefinitionViewerProvider } from './context/DefinitionViewerContext';
import { AppLayout } from './components/layout/AppLayout';
import { Dashboard } from './pages/Dashboard';
import { Nodes } from './pages/Nodes';
import { Pods } from './pages/Pods';
import { Workloads } from './pages/Workloads';
import { Namespaces } from './pages/Namespaces';
import { Events } from './pages/Events';
import { ConfigMaps } from './pages/ConfigMaps';
import { Secrets } from './pages/Secrets';
import { ServiceAccounts } from './pages/ServiceAccounts';
import { RBAC } from './pages/RBAC';
import { NetworkPolicies } from './pages/NetworkPolicies';
import { CustomResources } from './pages/CustomResources';
import { Settings } from './pages/Settings';
import { Services } from './pages/Services';
import { Ingress } from './pages/Ingress';
import { PersistentVolumeClaims } from './pages/PersistentVolumeClaims';
import { StorageClasses } from './pages/StorageClasses';
import { DependencyMap } from './pages/DependencyMap';
import { HelmReleases } from './pages/HelmReleases';
import { PanicPage } from './pages/PanicPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export const App: React.FC = () => (
  <QueryClientProvider client={queryClient}>
    <ConnectionProvider>
      <NamespaceProvider>
        <DefinitionViewerProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/nodes" element={<Nodes />} />
                <Route path="/pods" element={<Pods />} />
                <Route path="/workloads" element={<Workloads />} />
                <Route path="/namespaces" element={<Namespaces />} />
                <Route path="/events" element={<Events />} />
                <Route path="/configmaps" element={<ConfigMaps />} />
                <Route path="/secrets" element={<Secrets />} />
                <Route path="/serviceaccounts" element={<ServiceAccounts />} />
                <Route path="/rbac" element={<RBAC />} />
                <Route path="/network-policies" element={<NetworkPolicies />} />
                <Route path="/services" element={<Services />} />
                <Route path="/ingress" element={<Ingress />} />
                <Route path="/persistent-volume-claims" element={<PersistentVolumeClaims />} />
                <Route path="/storage-classes" element={<StorageClasses />} />
                <Route path="/dependency-map" element={<DependencyMap />} />
                <Route path="/panic" element={<PanicPage />} />
                <Route path="/helm-releases" element={<HelmReleases />} />
                <Route path="/custom-resources" element={<CustomResources />} />
                <Route path="/settings" element={<Settings />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </DefinitionViewerProvider>
      </NamespaceProvider>
    </ConnectionProvider>
  </QueryClientProvider>
);

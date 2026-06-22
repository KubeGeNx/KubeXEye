import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Modal, ModalVariant, ModalHeader, ModalBody, Tabs, Tab, TabTitleText, Alert } from '@patternfly/react-core';
import { ResourceYamlView } from '../components/ResourceYamlView';
import { PodLogsPanel } from '../components/PodLogsPanel';
import type { K8sPod } from '../types/k8s';

interface PodDetailPayload {
  pod: K8sPod;
  /** Shown as an inline warning above the tabs, e.g. for pods missing resource requests/limits. */
  warning?: string;
}

interface PodDetailContextValue {
  openPodDetail: (pod: K8sPod, warning?: string) => void;
}

const PodDetailContext = createContext<PodDetailContextValue | null>(null);

// Mounted once, at the app root, mirroring DefinitionViewerProvider — a poll-driven table refetch
// must not silently close this while the user has a pod's logs open.
export const PodDetailProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [viewing, setViewing] = useState<PodDetailPayload | null>(null);
  const [activeTab, setActiveTab] = useState<'definition' | 'logs'>('definition');

  const openPodDetail = useCallback((pod: K8sPod, warning?: string) => {
    setViewing({ pod, warning });
    setActiveTab('definition');
  }, []);

  const value = useMemo(() => ({ openPodDetail }), [openPodDetail]);
  const pod = viewing?.pod ?? null;

  return (
    <PodDetailContext.Provider value={value}>
      {children}
      <Modal variant={ModalVariant.large} isOpen={pod !== null} onClose={() => setViewing(null)}>
        <ModalHeader title={pod ? `Pod/${pod.metadata.namespace}/${pod.metadata.name}` : ''} />
        <ModalBody>
          {viewing?.warning && <Alert variant="warning" isInline title={viewing.warning} style={{ marginBottom: '1rem' }} />}
          <Tabs activeKey={activeTab} onSelect={(_e, key) => setActiveTab(key as 'definition' | 'logs')}>
            <Tab eventKey="definition" title={<TabTitleText>Definition</TabTitleText>} />
            <Tab eventKey="logs" title={<TabTitleText>Logs</TabTitleText>} />
          </Tabs>
          {pod && activeTab === 'definition' && <ResourceYamlView resource={pod} />}
          {pod && activeTab === 'logs' && <PodLogsPanel key={pod.metadata.uid ?? pod.metadata.name} pod={pod} />}
        </ModalBody>
      </Modal>
    </PodDetailContext.Provider>
  );
};

export function usePodDetail(): PodDetailContextValue {
  const ctx = useContext(PodDetailContext);
  if (!ctx) throw new Error('usePodDetail must be used within PodDetailProvider');
  return ctx;
}

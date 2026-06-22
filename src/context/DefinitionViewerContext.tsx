import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Modal, ModalVariant, ModalHeader, ModalBody, Alert } from '@patternfly/react-core';
import { ResourceYamlView } from '../components/ResourceYamlView';

interface DefinitionPayload {
  resource: unknown;
  title: string;
  warning?: string;
}

interface DefinitionViewerContextValue {
  openDefinition: (payload: DefinitionPayload) => void;
}

const DefinitionViewerContext = createContext<DefinitionViewerContextValue | null>(null);

// Mounted once, at the app root — not inside any resource table. Resource tables refetch on a
// poll interval, which previously remounted each row's own Modal/state and silently closed
// whatever the user had open. A single, stable viewer here can't be affected by that, and
// `openDefinition` takes a snapshot of `resource` at click time rather than re-reading it
// reactively, so the displayed content doesn't change while the modal is open either.
export const DefinitionViewerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [viewing, setViewing] = useState<DefinitionPayload | null>(null);

  const openDefinition = useCallback((payload: DefinitionPayload) => {
    setViewing(payload);
  }, []);

  const value = useMemo(() => ({ openDefinition }), [openDefinition]);

  return (
    <DefinitionViewerContext.Provider value={value}>
      {children}
      <Modal variant={ModalVariant.large} isOpen={viewing !== null} onClose={() => setViewing(null)}>
        <ModalHeader title={viewing?.title ?? ''} />
        <ModalBody>
          {viewing?.warning && <Alert variant="warning" isInline title={viewing.warning} style={{ marginBottom: '1rem' }} />}
          {viewing && <ResourceYamlView resource={viewing.resource} />}
        </ModalBody>
      </Modal>
    </DefinitionViewerContext.Provider>
  );
};

export function useDefinitionViewer(): DefinitionViewerContextValue {
  const ctx = useContext(DefinitionViewerContext);
  if (!ctx) throw new Error('useDefinitionViewer must be used within DefinitionViewerProvider');
  return ctx;
}

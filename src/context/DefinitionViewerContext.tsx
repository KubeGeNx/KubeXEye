import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { stringify as toYaml } from 'yaml';
import {
  Modal,
  ModalVariant,
  ModalHeader,
  ModalBody,
  Tabs,
  Tab,
  TabTitleText,
  CodeBlock,
  CodeBlockAction,
  CodeBlockCode,
  ClipboardCopy,
  Alert,
} from '@patternfly/react-core';
import { highlightYamlLines, YAML_COLORS } from '../utils/yamlHighlight';

// A dark backdrop gives the syntax colors below enough contrast to actually read as "syntax
// highlighting" rather than a handful of barely-different grey-on-white tones.
const CODE_BLOCK_DARK_STYLE: React.CSSProperties = { backgroundColor: '#1e1e1e' };
const CODE_TEXT_STYLE: React.CSSProperties = { color: YAML_COLORS.punctuation };

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
  const [activeTab, setActiveTab] = useState<'yaml' | 'json'>('yaml');

  const openDefinition = useCallback((payload: DefinitionPayload) => {
    setViewing(payload);
    setActiveTab('yaml');
  }, []);

  const value = useMemo(() => ({ openDefinition }), [openDefinition]);

  const yamlText = useMemo(() => (viewing ? toYaml(viewing.resource) : ''), [viewing]);
  const jsonText = useMemo(() => (viewing ? JSON.stringify(viewing.resource, null, 2) : ''), [viewing]);
  const yamlLines = useMemo(() => highlightYamlLines(yamlText), [yamlText]);
  const text = activeTab === 'yaml' ? yamlText : jsonText;

  return (
    <DefinitionViewerContext.Provider value={value}>
      {children}
      <Modal variant={ModalVariant.large} isOpen={viewing !== null} onClose={() => setViewing(null)}>
        <ModalHeader title={viewing?.title ?? ''} />
        <ModalBody>
          {viewing?.warning && <Alert variant="warning" isInline title={viewing.warning} style={{ marginBottom: '1rem' }} />}
          <Tabs activeKey={activeTab} onSelect={(_e, key) => setActiveTab(key as 'yaml' | 'json')}>
            <Tab eventKey="yaml" title={<TabTitleText>YAML</TabTitleText>} />
            <Tab eventKey="json" title={<TabTitleText>JSON</TabTitleText>} />
          </Tabs>
          <CodeBlock
            style={CODE_BLOCK_DARK_STYLE}
            actions={
              <CodeBlockAction>
                <ClipboardCopy hoverTip="Copy" clickTip="Copied" variant="inline-compact" isCode>
                  {text}
                </ClipboardCopy>
              </CodeBlockAction>
            }
          >
            <CodeBlockCode style={CODE_TEXT_STYLE}>
              {activeTab === 'yaml'
                ? yamlLines.map((tokens, i) => (
                    <div key={i}>
                      {tokens.length === 0
                        ? ' '
                        : tokens.map((token, j) => (
                            <span key={j} style={token.color ? { color: token.color, fontStyle: token.italic ? 'italic' : undefined } : undefined}>
                              {token.text}
                            </span>
                          ))}
                    </div>
                  ))
                : jsonText}
            </CodeBlockCode>
          </CodeBlock>
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

import React, { useMemo, useState } from 'react';
import { stringify as toYaml } from 'yaml';
import { Tabs, Tab, TabTitleText, CodeBlock, CodeBlockAction, CodeBlockCode, ClipboardCopy } from '@patternfly/react-core';
import { highlightYamlLines, highlightJsonLines, YAML_COLORS } from '../utils/yamlHighlight';

// A dark backdrop gives the syntax colors below enough contrast to actually read as "syntax
// highlighting" rather than a handful of barely-different grey-on-white tones.
const CODE_BLOCK_DARK_STYLE: React.CSSProperties = { backgroundColor: '#1e1e1e' };
const CODE_TEXT_STYLE: React.CSSProperties = { color: YAML_COLORS.punctuation, fontFamily: 'monospace', fontSize: '0.85rem' };

export const ResourceYamlView: React.FC<{ resource: unknown }> = ({ resource }) => {
  const [activeTab, setActiveTab] = useState<'yaml' | 'json'>('yaml');

  const yamlText = useMemo(() => toYaml(resource), [resource]);
  const jsonText = useMemo(() => JSON.stringify(resource, null, 2), [resource]);
  const yamlLines = useMemo(() => highlightYamlLines(yamlText), [yamlText]);
  const jsonLines = useMemo(() => highlightJsonLines(jsonText), [jsonText]);
  const text = activeTab === 'yaml' ? yamlText : jsonText;

  return (
    <>
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
                    ? ' '
                    : tokens.map((token, j) => (
                        <span key={j} style={token.color ? { color: token.color, fontStyle: token.italic ? 'italic' : undefined } : undefined}>
                          {token.text}
                        </span>
                      ))}
                </div>
              ))
            : jsonLines.map((tokens, i) => (
                <div key={i}>
                  {tokens.length === 0
                    ? ' '
                    : tokens.map((token, j) => (
                        <span key={j} style={token.color ? { color: token.color } : undefined}>
                          {token.text}
                        </span>
                      ))}
                </div>
              ))}
        </CodeBlockCode>
      </CodeBlock>
    </>
  );
};

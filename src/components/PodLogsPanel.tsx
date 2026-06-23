import React, { useState } from 'react';
import {
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  Select,
  SelectOption,
  SelectList,
  MenuToggle,
  type MenuToggleElement,
  Switch,
  NumberInput,
  Button,
  CodeBlock,
  CodeBlockCode,
  Bullseye,
  Spinner,
  Alert,
} from '@patternfly/react-core';
import { SyncAltIcon } from '@patternfly/react-icons';
import { usePodLogs } from '../hooks/useK8sResources';
import type { K8sPod } from '../types/k8s';

const DEFAULT_INTERVAL_SECONDS = 5;
const MIN_INTERVAL_SECONDS = 1;
const MAX_INTERVAL_SECONDS = 300;

const LOG_AREA_STYLE: React.CSSProperties = { backgroundColor: '#1e1e1e', maxHeight: 480, overflow: 'auto' };
const LOG_BASE_STYLE: React.CSSProperties = { whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.85rem' };

// ANSI SGR color map — keyed on the numeric code string
const ANSI_COLORS: Record<string, string> = {
  '30': '#7B7970', '31': '#E25A5A', '32': '#3ABE82', '33': '#F0A028',
  '34': '#7EB6F0', '35': '#C678DD', '36': '#56B6C2', '37': '#F0EEE8',
  '90': '#4A4D52', '91': '#FF7A7A', '92': '#89D185', '93': '#FFD700',
  '94': '#A8D0F5', '95': '#DA8FFF', '96': '#7EC8D0', '97': '#FFFFFF',
};

interface AnsiToken { text: string; color?: string; bold?: boolean }

function parseAnsi(line: string): AnsiToken[] {
  const tokens: AnsiToken[] = [];
  // ESC (\x1b) is the literal control char that begins every ANSI SGR sequence — matching it here
  // is intentional, so the control-char-in-regex lint rule doesn't apply.
  // eslint-disable-next-line no-control-regex
  const RE = /\x1b\[([\d;]*)m/g;
  let pos = 0;
  let color: string | undefined;
  let bold = false;

  let m: RegExpExecArray | null;
  while ((m = RE.exec(line)) !== null) {
    if (m.index > pos) tokens.push({ text: line.slice(pos, m.index), color, bold });
    const codes = m[1].split(';').filter(Boolean);
    if (!codes.length || codes[0] === '0') { color = undefined; bold = false; }
    else for (const c of codes) {
      if (c === '1') bold = true;
      else if (c === '0') { color = undefined; bold = false; }
      else if (ANSI_COLORS[c]) color = ANSI_COLORS[c];
    }
    pos = m.index + m[0].length;
  }
  if (pos < line.length) tokens.push({ text: line.slice(pos), color, bold });
  return tokens;
}

interface PodLogsPanelProps {
  pod: K8sPod;
}

export const PodLogsPanel: React.FC<PodLogsPanelProps> = ({ pod }) => {
  const containers = pod.spec?.containers ?? [];
  const [container, setContainer] = useState<string | undefined>(containers[0]?.name);
  const [containerOpen, setContainerOpen] = useState(false);
  const [autoSync, setAutoSync] = useState(true);
  const [intervalSeconds, setIntervalSeconds] = useState(DEFAULT_INTERVAL_SECONDS);

  const logs = usePodLogs(pod.metadata.namespace ?? '', pod.metadata.name, container, {
    refetchIntervalMs: autoSync ? intervalSeconds * 1000 : false,
  });

  return (
    <>
      <Toolbar>
        <ToolbarContent>
          {containers.length > 1 && (
            <ToolbarItem>
              <Select
                isOpen={containerOpen}
                onOpenChange={setContainerOpen}
                selected={container}
                onSelect={(_e, v) => {
                  setContainer(String(v));
                  setContainerOpen(false);
                }}
                toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                  <MenuToggle ref={toggleRef} onClick={() => setContainerOpen((o) => !o)} isExpanded={containerOpen}>
                    {container}
                  </MenuToggle>
                )}
              >
                <SelectList>
                  {containers.map((c) => (
                    <SelectOption key={c.name} value={c.name}>
                      {c.name}
                    </SelectOption>
                  ))}
                </SelectList>
              </Select>
            </ToolbarItem>
          )}
          <ToolbarItem>
            <Switch
              id={`pod-logs-autosync-${pod.metadata.uid ?? pod.metadata.name}`}
              label="Auto sync"
              isChecked={autoSync}
              onChange={(_e, checked) => setAutoSync(checked)}
            />
          </ToolbarItem>
          <ToolbarItem>
            <NumberInput
              value={intervalSeconds}
              min={MIN_INTERVAL_SECONDS}
              max={MAX_INTERVAL_SECONDS}
              unit="sec"
              isDisabled={!autoSync}
              inputAriaLabel="Sync interval in seconds"
              onMinus={() => setIntervalSeconds((s) => Math.max(MIN_INTERVAL_SECONDS, s - 1))}
              onPlus={() => setIntervalSeconds((s) => Math.min(MAX_INTERVAL_SECONDS, s + 1))}
              onChange={(e) => {
                const v = Number((e.target as HTMLInputElement).value);
                if (!Number.isNaN(v)) setIntervalSeconds(Math.min(MAX_INTERVAL_SECONDS, Math.max(MIN_INTERVAL_SECONDS, v)));
              }}
              widthChars={3}
            />
          </ToolbarItem>
          <ToolbarItem>
            <Button variant="secondary" icon={<SyncAltIcon />} onClick={() => logs.refetch()} isLoading={logs.isFetching}>
              Refresh now
            </Button>
          </ToolbarItem>
        </ToolbarContent>
      </Toolbar>

      {logs.isLoading ? (
        <Bullseye>
          <Spinner size="lg" aria-label="Loading logs" />
        </Bullseye>
      ) : logs.error ? (
        <Alert variant="danger" title="Failed to load logs">
          {(logs.error as Error).message}
        </Alert>
      ) : (
        <CodeBlock style={LOG_AREA_STYLE}>
          <CodeBlockCode style={LOG_BASE_STYLE}>
            {(logs.data || '(no log output)').split('\n').map((line, i) => {
              const tokens = parseAnsi(line);
              const hasColor = tokens.some((t) => t.color || t.bold);
              return (
                <div key={i}>
                  {hasColor
                    ? tokens.map((t, j) => (
                        <span key={j} style={{ color: t.color ?? '#C8C5BB', fontWeight: t.bold ? 700 : undefined }}>
                          {t.text}
                        </span>
                      ))
                    : <span style={{ color: '#C8C5BB' }}>{line || ' '}</span>}
                </div>
              );
            })}
          </CodeBlockCode>
        </CodeBlock>
      )}
    </>
  );
};

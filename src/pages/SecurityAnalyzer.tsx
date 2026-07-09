import React, { useMemo, useState } from 'react';
import { parse as parseYaml, stringify as toYaml } from 'yaml';
import {
  PageSection,
  Card,
  CardTitle,
  CardBody,
  Grid,
  GridItem,
  Button,
  TextArea,
  Alert,
  List,
  ListItem,
  Label,
  Title,
  Content,
  ExpandableSection,
  DescriptionList,
  DescriptionListGroup,
  DescriptionListTerm,
  DescriptionListDescription,
  Split,
  SplitItem,
  Flex,
  FlexItem,
  Select,
  SelectOption,
  SelectList,
  MenuToggle,
  type MenuToggleElement,
  Bullseye,
  Spinner,
} from '@patternfly/react-core';
import {
  analyzeManifestSecurity,
  scoreToGrade,
  type SecurityFinding,
  type Severity,
  type Grade,
  type RiskLevel,
} from '../utils/securityAnalysis';
import { PageTitle } from '../components/PageTitle';
import { NAV_ICONS } from '../components/layout/navIcons';
import { usePods } from '../hooks/useK8sResources';
import { useNamespace, ALL_NAMESPACES } from '../context/NamespaceContext';
import type { K8sPod } from '../types/k8s';

const TEXTAREA_STYLE: React.CSSProperties = { fontFamily: 'monospace', fontSize: '0.85rem' };

function podKey(pod: K8sPod): string {
  return `${pod.metadata.namespace}/${pod.metadata.name}`;
}

/** Strips the huge, security-irrelevant managedFields blob so the loaded YAML stays readable, and
 * fills in apiVersion/kind — individual items in a List response omit both, but the analyzer keys
 * off manifest.kind to know it's looking at a Pod. */
function toAnalyzableYaml(pod: K8sPod): string {
  const { metadata, apiVersion, kind, ...rest } = pod as Record<string, any>;
  const cleanMetadata = { ...metadata };
  delete cleanMetadata.managedFields;
  return toYaml({ apiVersion: apiVersion ?? 'v1', kind: kind ?? 'Pod', ...rest, metadata: cleanMetadata });
}

const SEVERITY_COLOR: Record<Severity, 'red' | 'orange' | 'yellow' | 'blue' | 'grey'> = {
  Critical: 'red',
  High: 'orange',
  Medium: 'yellow',
  Low: 'blue',
  Informational: 'grey',
};

const GRADE_COLOR: Record<Grade, string> = {
  'A+': '#3ABE82',
  A: '#3ABE82',
  B: '#7EB6F0',
  C: '#E8B830',
  D: '#F0A028',
  F: '#E25A5A',
};

const RISK_COLOR: Record<RiskLevel, string> = {
  Low: '#3ABE82',
  Moderate: '#E8B830',
  High: '#F0A028',
  Critical: '#E25A5A',
};

const SAMPLE_MANIFEST = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: sample-web
  namespace: default
spec:
  replicas: 2
  selector:
    matchLabels:
      app: sample-web
  template:
    metadata:
      labels:
        app: sample-web
    spec:
      hostNetwork: true
      containers:
        - name: web
          image: myapp:latest
          securityContext:
            privileged: false
            capabilities:
              add: ["SYS_ADMIN"]
          env:
            - name: DB_PASSWORD
              value: "hunter2"
            - name: API_TOKEN
              valueFrom:
                secretKeyRef:
                  name: app-creds
                  key: token
          ports:
            - containerPort: 8080
              hostPort: 8080
`;

const FindingCard: React.FC<{ finding: SecurityFinding; isExpanded: boolean; onToggle: () => void }> = ({ finding, isExpanded, onToggle }) => (
  <ExpandableSection
    isExpanded={isExpanded}
    onToggle={onToggle}
    toggleContent={
      <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsSm' }}>
        <FlexItem>
          <Label color={SEVERITY_COLOR[finding.severity]} isCompact>
            {finding.severity}
          </Label>
        </FlexItem>
        <FlexItem>
          <code style={{ fontSize: '0.8rem', color: '#7B7970' }}>{finding.ruleId}</code>
        </FlexItem>
        <FlexItem>{finding.title}</FlexItem>
        <FlexItem align={{ default: 'alignRight' }}>
          <span style={{ color: '#7B7970', fontSize: '0.8rem' }}>
            {finding.pointsDeducted > 0 ? `-${finding.pointsDeducted} pts` : 'informational'}
          </span>
        </FlexItem>
      </Flex>
    }
    style={{ marginBottom: '0.5rem', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '0.25rem 0.75rem' }}
  >
    <DescriptionList isCompact style={{ marginTop: '0.5rem' }}>
      <DescriptionListGroup>
        <DescriptionListTerm>Category</DescriptionListTerm>
        <DescriptionListDescription>{finding.category}</DescriptionListDescription>
      </DescriptionListGroup>
      <DescriptionListGroup>
        <DescriptionListTerm>Description</DescriptionListTerm>
        <DescriptionListDescription>{finding.description}</DescriptionListDescription>
      </DescriptionListGroup>
      <DescriptionListGroup>
        <DescriptionListTerm>Impact</DescriptionListTerm>
        <DescriptionListDescription>{finding.impact}</DescriptionListDescription>
      </DescriptionListGroup>
      <DescriptionListGroup>
        <DescriptionListTerm>YAML Path</DescriptionListTerm>
        <DescriptionListDescription><code>{finding.yamlPath}</code></DescriptionListDescription>
      </DescriptionListGroup>
      <DescriptionListGroup>
        <DescriptionListTerm>Current</DescriptionListTerm>
        <DescriptionListDescription><code>{finding.current}</code></DescriptionListDescription>
      </DescriptionListGroup>
      <DescriptionListGroup>
        <DescriptionListTerm>Expected</DescriptionListTerm>
        <DescriptionListDescription><code>{finding.expected}</code></DescriptionListDescription>
      </DescriptionListGroup>
      <DescriptionListGroup>
        <DescriptionListTerm>Recommendation</DescriptionListTerm>
        <DescriptionListDescription>{finding.recommendation}</DescriptionListDescription>
      </DescriptionListGroup>
      {finding.cis && (
        <DescriptionListGroup>
          <DescriptionListTerm>CIS Benchmark</DescriptionListTerm>
          <DescriptionListDescription>{finding.cis}</DescriptionListDescription>
        </DescriptionListGroup>
      )}
      {finding.owasp && (
        <DescriptionListGroup>
          <DescriptionListTerm>OWASP Kubernetes Top 10</DescriptionListTerm>
          <DescriptionListDescription>{finding.owasp}</DescriptionListDescription>
        </DescriptionListGroup>
      )}
      <DescriptionListGroup>
        <DescriptionListTerm>Points Deducted</DescriptionListTerm>
        <DescriptionListDescription>{finding.pointsDeducted}</DescriptionListDescription>
      </DescriptionListGroup>
    </DescriptionList>
  </ExpandableSection>
);

export const SecurityAnalyzer: React.FC = () => {
  const [manifestText, setManifestText] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [podPickerOpen, setPodPickerOpen] = useState(false);
  const [selectedPodKey, setSelectedPodKey] = useState<string | undefined>();

  const { namespace } = useNamespace();
  const pods = usePods(namespace);

  const podOptions = useMemo(
    () => [...(pods.data ?? [])].sort((a, b) => podKey(a).localeCompare(podKey(b))),
    [pods.data],
  );
  const selectedPod = podOptions.find((p) => podKey(p) === selectedPodKey);

  const loadPod = (pod: K8sPod) => {
    setSelectedPodKey(podKey(pod));
    setManifestText(toAnalyzableYaml(pod));
  };

  const parsed = useMemo((): { value: unknown; error?: string } => {
    if (!manifestText.trim()) return { value: undefined };
    try {
      return { value: parseYaml(manifestText) };
    } catch (err) {
      return { value: undefined, error: (err as Error).message };
    }
  }, [manifestText]);

  const report = useMemo(() => (parsed.value ? analyzeManifestSecurity(parsed.value) : undefined), [parsed.value]);

  const toggleFinding = (ruleId: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(ruleId)) next.delete(ruleId);
      else next.add(ruleId);
      return next;
    });

  const cisGroups = useMemo(() => {
    if (!report) return [];
    const map = new Map<string, SecurityFinding[]>();
    for (const f of report.findings) {
      if (!f.cis) continue;
      map.set(f.cis, [...(map.get(f.cis) ?? []), f]);
    }
    return [...map.entries()];
  }, [report]);

  const owaspGroups = useMemo(() => {
    if (!report) return [];
    const map = new Map<string, SecurityFinding[]>();
    for (const f of report.findings) {
      if (!f.owasp) continue;
      map.set(f.owasp, [...(map.get(f.owasp) ?? []), f]);
    }
    return [...map.entries()];
  }, [report]);

  const severityOrder: Severity[] = ['Critical', 'High', 'Medium', 'Low', 'Informational'];

  return (
    <PageSection>
      <PageTitle icon={NAV_ICONS.securityAnalyzer}>Kubernetes Security Analyzer</PageTitle>
      <Content component="p" style={{ marginBottom: '1rem' }}>
        Select a running pod from this cluster, or paste a Pod, Deployment, StatefulSet, DaemonSet, Job, CronJob (or
        Role/ClusterRole/ServiceAccount) manifest, to get a deterministic security assessment scored against Pod Security
        Standards, the CIS Kubernetes Benchmark, and the OWASP Kubernetes Top 10 — entirely client-side, nothing is sent
        anywhere.
      </Content>

      <Grid hasGutter>
        <GridItem span={6}>
          <Card>
            <CardTitle>
              <Split hasGutter>
                <SplitItem isFilled>Manifest</SplitItem>
                <SplitItem>
                  <Button variant="secondary" size="sm" onClick={() => setManifestText(SAMPLE_MANIFEST)}>
                    Load example manifest
                  </Button>
                </SplitItem>
              </Split>
            </CardTitle>
            <CardBody>
              <Split hasGutter style={{ marginBottom: '0.75rem' }}>
                <SplitItem isFilled>
                  {pods.error ? (
                    <Alert variant="warning" isInline title="Couldn't load pods from this cluster">
                      {(pods.error as Error).message}
                    </Alert>
                  ) : (
                    <Select
                      isOpen={podPickerOpen}
                      onOpenChange={setPodPickerOpen}
                      selected={selectedPodKey}
                      onSelect={(_e, value) => {
                        const pod = podOptions.find((p) => podKey(p) === String(value));
                        if (pod) loadPod(pod);
                        setPodPickerOpen(false);
                      }}
                      toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                        <MenuToggle
                          ref={toggleRef}
                          onClick={() => setPodPickerOpen((o) => !o)}
                          isExpanded={podPickerOpen}
                          style={{ minWidth: 320 }}
                          isDisabled={pods.isLoading || podOptions.length === 0}
                        >
                          {selectedPod
                            ? podKey(selectedPod)
                            : pods.isLoading
                              ? 'Loading pods...'
                              : podOptions.length === 0
                                ? (namespace === ALL_NAMESPACES ? 'No pods found in this cluster' : 'No pods found in this namespace')
                                : `Select a pod (${namespace === ALL_NAMESPACES ? 'all namespaces' : namespace})...`}
                        </MenuToggle>
                      )}
                    >
                      <SelectList>
                        {podOptions.map((p) => (
                          <SelectOption key={podKey(p)} value={podKey(p)}>
                            {podKey(p)}
                          </SelectOption>
                        ))}
                      </SelectList>
                    </Select>
                  )}
                </SplitItem>
                {pods.isLoading && (
                  <SplitItem>
                    <Bullseye>
                      <Spinner size="md" aria-label="Loading pods" />
                    </Bullseye>
                  </SplitItem>
                )}
              </Split>
              <Content component="small" style={{ color: '#7B7970', display: 'block', marginBottom: '0.5rem' }}>
                Lists pods in the namespace selected in the toolbar above ("All Namespaces" lists every pod in the cluster). Selecting
                a pod loads its live manifest below — edit it freely before analyzing, nothing is written back to the cluster.
              </Content>
              <TextArea
                aria-label="Manifest YAML"
                value={manifestText}
                onChange={(_e, v) => {
                  setManifestText(v);
                  setSelectedPodKey(undefined);
                }}
                rows={24}
                resizeOrientation="vertical"
                style={TEXTAREA_STYLE}
                placeholder="Paste a Kubernetes manifest (YAML or JSON), or select a pod above, to analyze..."
              />
              {parsed.error && (
                <Alert variant="danger" isInline title="YAML parse error" style={{ marginTop: '0.75rem' }}>
                  {parsed.error}
                </Alert>
              )}
            </CardBody>
          </Card>
        </GridItem>

        <GridItem span={6}>
          {!report ? (
            <Card>
              <CardBody>
                <em>Enter or load a manifest to see its security assessment.</em>
              </CardBody>
            </Card>
          ) : !report.applicable ? (
            <Alert variant="warning" isInline title="Not applicable">
              {report.unsupportedMessage}
            </Alert>
          ) : (
            <Card>
              <CardBody>
                <Flex spaceItems={{ default: 'spaceItemsLg' }} alignItems={{ default: 'alignItemsCenter' }}>
                  <FlexItem>
                    <Title headingLevel="h1" size="4xl" style={{ color: GRADE_COLOR[report.grade] }}>
                      {report.score}
                      <span style={{ fontSize: '1.25rem', color: '#7B7970' }}>/100</span>
                    </Title>
                  </FlexItem>
                  <FlexItem>
                    <Label color={report.grade === 'F' || report.grade === 'D' ? 'red' : report.grade === 'C' ? 'yellow' : 'green'} style={{ fontSize: '1rem', padding: '0.25rem 0.75rem' }}>
                      Grade {report.grade}
                    </Label>
                  </FlexItem>
                  <FlexItem>
                    <span style={{ color: RISK_COLOR[report.riskLevel], fontWeight: 600 }}>{report.riskLevel} Risk</span>
                  </FlexItem>
                </Flex>
                <Content component="p" style={{ marginTop: '1rem' }}>
                  {report.executiveSummary}
                </Content>
              </CardBody>
            </Card>
          )}
        </GridItem>
      </Grid>

      {report?.applicable && (
        <>
          <Grid hasGutter style={{ marginTop: '1rem' }}>
            <GridItem span={12}>
              <Card>
                <CardTitle>Findings ({report.findings.length})</CardTitle>
                <CardBody>
                  {report.findings.length === 0 ? (
                    <Alert variant="success" isInline title="No issues found — every evaluated check passed." />
                  ) : (
                    report.findings.map((f, i) => (
                      <FindingCard key={`${f.ruleId}-${i}`} finding={f} isExpanded={expanded.has(`${f.ruleId}-${i}`)} onToggle={() => toggleFinding(`${f.ruleId}-${i}`)} />
                    ))
                  )}
                </CardBody>
              </Card>
            </GridItem>
          </Grid>

          <Grid hasGutter style={{ marginTop: '1rem' }}>
            <GridItem span={6}>
              <Card>
                <CardTitle>Passed Checks ({report.passedChecks.length})</CardTitle>
                <CardBody>
                  {report.passedChecks.length === 0 ? (
                    <em>No checks passed.</em>
                  ) : (
                    <List isPlain>
                      {report.passedChecks.map((c, i) => (
                        <ListItem key={`${c.ruleId}-${i}`}>
                          <code style={{ color: '#7B7970', marginRight: 6 }}>{c.ruleId}</code>
                          {c.title}
                        </ListItem>
                      ))}
                    </List>
                  )}
                </CardBody>
              </Card>
            </GridItem>
            <GridItem span={6}>
              <Card>
                <CardTitle>Failed Checks ({report.findings.length})</CardTitle>
                <CardBody>
                  {report.findings.length === 0 ? (
                    <em>No failed checks.</em>
                  ) : (
                    <List isPlain>
                      {report.findings.map((f, i) => (
                        <ListItem key={`${f.ruleId}-fail-${i}`}>
                          <Label color={SEVERITY_COLOR[f.severity]} isCompact style={{ marginRight: 6 }}>
                            {f.severity}
                          </Label>
                          <code style={{ color: '#7B7970', marginRight: 6 }}>{f.ruleId}</code>
                          {f.title}
                        </ListItem>
                      ))}
                    </List>
                  )}
                </CardBody>
              </Card>
            </GridItem>
          </Grid>

          <Card style={{ marginTop: '1rem' }}>
            <CardTitle>Pod Security Standards Compliance</CardTitle>
            <CardBody>
              <DescriptionList isHorizontal>
                <DescriptionListGroup>
                  <DescriptionListTerm>Privileged</DescriptionListTerm>
                  <DescriptionListDescription>
                    <Label color="green" isCompact>Compliant</Label> — the Privileged standard imposes no restrictions.
                  </DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                  <DescriptionListTerm>Baseline</DescriptionListTerm>
                  <DescriptionListDescription>
                    <Label color={report.podSecurityStandards.baseline.compliant ? 'green' : 'red'} isCompact>
                      {report.podSecurityStandards.baseline.compliant ? 'Compliant' : 'Non-compliant'}
                    </Label>
                    {report.podSecurityStandards.baseline.violations.length > 0 && (
                      <List isPlain style={{ marginTop: '0.5rem' }}>
                        {report.podSecurityStandards.baseline.violations.map((v, i) => (
                          <ListItem key={i}>{v}</ListItem>
                        ))}
                      </List>
                    )}
                  </DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                  <DescriptionListTerm>Restricted</DescriptionListTerm>
                  <DescriptionListDescription>
                    <Label color={report.podSecurityStandards.restricted.compliant ? 'green' : 'red'} isCompact>
                      {report.podSecurityStandards.restricted.compliant ? 'Compliant' : 'Non-compliant'}
                    </Label>
                    {report.podSecurityStandards.restricted.violations.length > 0 && (
                      <List isPlain style={{ marginTop: '0.5rem' }}>
                        {report.podSecurityStandards.restricted.violations.map((v, i) => (
                          <ListItem key={i}>{v}</ListItem>
                        ))}
                      </List>
                    )}
                  </DescriptionListDescription>
                </DescriptionListGroup>
              </DescriptionList>
            </CardBody>
          </Card>

          <Grid hasGutter style={{ marginTop: '1rem' }}>
            <GridItem span={6}>
              <Card>
                <CardTitle>CIS Kubernetes Benchmark Mapping</CardTitle>
                <CardBody>
                  {cisGroups.length === 0 ? (
                    <em>No findings map to a specific CIS Benchmark recommendation.</em>
                  ) : (
                    <List isPlain>
                      {cisGroups.map(([cis, findings]) => (
                        <ListItem key={cis}>
                          <strong>{cis}</strong>
                          <List isPlain>
                            {findings.map((f, i) => (
                              <ListItem key={i}>
                                <Label color={SEVERITY_COLOR[f.severity]} isCompact style={{ marginRight: 6 }}>{f.severity}</Label>
                                {f.title} <code style={{ color: '#7B7970' }}>({f.ruleId})</code>
                              </ListItem>
                            ))}
                          </List>
                        </ListItem>
                      ))}
                    </List>
                  )}
                </CardBody>
              </Card>
            </GridItem>
            <GridItem span={6}>
              <Card>
                <CardTitle>OWASP Kubernetes Top 10 Mapping</CardTitle>
                <CardBody>
                  {owaspGroups.length === 0 ? (
                    <em>No findings map to an OWASP Kubernetes Top 10 risk.</em>
                  ) : (
                    <List isPlain>
                      {owaspGroups.map(([owasp, findings]) => (
                        <ListItem key={owasp}>
                          <strong>{owasp}</strong>
                          <List isPlain>
                            {findings.map((f, i) => (
                              <ListItem key={i}>
                                <Label color={SEVERITY_COLOR[f.severity]} isCompact style={{ marginRight: 6 }}>{f.severity}</Label>
                                {f.title} <code style={{ color: '#7B7970' }}>({f.ruleId})</code>
                              </ListItem>
                            ))}
                          </List>
                        </ListItem>
                      ))}
                    </List>
                  )}
                </CardBody>
              </Card>
            </GridItem>
          </Grid>

          <Card style={{ marginTop: '1rem' }}>
            <CardTitle>Recommended Remediation Order</CardTitle>
            <CardBody>
              {report.remediationOrder.length === 0 ? (
                <em>Nothing to remediate.</em>
              ) : (
                severityOrder.map((sev) => {
                  const group = report.remediationOrder.filter((f) => f.severity === sev);
                  if (group.length === 0) return null;
                  return (
                    <div key={sev} style={{ marginBottom: '0.75rem' }}>
                      <Label color={SEVERITY_COLOR[sev]} isCompact style={{ marginBottom: '0.375rem' }}>
                        {sev} ({group.length})
                      </Label>
                      <List isPlain>
                        {group.map((f, i) => (
                          <ListItem key={i}>
                            <code style={{ color: '#7B7970', marginRight: 6 }}>{f.ruleId}</code>
                            {f.title} — <code>{f.yamlPath}</code>
                          </ListItem>
                        ))}
                      </List>
                    </div>
                  );
                })
              )}
              <Content component="p" style={{ marginTop: '0.75rem' }}>
                Estimated score after applying all recommendations: <strong>{report.estimatedScoreAfterRemediation}/100</strong> (
                {scoreToGrade(report.estimatedScoreAfterRemediation)})
              </Content>
            </CardBody>
          </Card>

          <Card style={{ marginTop: '1rem', marginBottom: '1rem' }}>
            <CardTitle>Overall Verdict</CardTitle>
            <CardBody>
              <Alert
                variant={report.productionReady ? 'success' : 'danger'}
                isInline
                title={report.productionReady ? 'This workload is production-ready.' : 'This workload is not production-ready.'}
                style={{ marginBottom: '0.75rem' }}
              />
              <Alert
                variant={report.admissionRecommended ? 'success' : 'warning'}
                isInline
                title={
                  report.admissionRecommended
                    ? 'Admission into a production cluster is recommended.'
                    : 'Admission into a production cluster is not recommended until Critical/High findings are resolved.'
                }
                style={{ marginBottom: '0.75rem' }}
              />
              <Title headingLevel="h4" size="md" style={{ marginBottom: '0.5rem' }}>
                Top {report.topImprovements.length} improvements to raise the score most
              </Title>
              <List>
                {report.topImprovements.map((t, i) => (
                  <ListItem key={i}>{t}</ListItem>
                ))}
              </List>
            </CardBody>
          </Card>
        </>
      )}
    </PageSection>
  );
};

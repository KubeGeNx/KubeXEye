import React, { useMemo, useState } from 'react';
import { parse as parseYaml } from 'yaml';
import { useMutation } from '@tanstack/react-query';
import {
  PageSection,
  Card,
  CardTitle,
  CardBody,
  Grid,
  GridItem,
  Select,
  SelectOption,
  SelectList,
  MenuToggle,
  type MenuToggleElement,
  Button,
  TextArea,
  Alert,
  List,
  ListItem,
  Label,
  Split,
  SplitItem,
  Bullseye,
  Spinner,
  Content,
} from '@patternfly/react-core';
import { useApiResources, useCustomResourceDefinitions } from '../hooks/useK8sResources';
import { useConnection } from '../context/ConnectionContext';
import { useNamespace, ALL_NAMESPACES } from '../context/NamespaceContext';
import { k8sApplyDryRun } from '../api/client';
import { parseApiVersion, resourceObjectPath, type ResourceTypeInfo } from '../utils/k8sResourcePaths';
import { buildManifestTemplate } from '../utils/manifestTemplates';
import { analyzeManifest, type Recommendation } from '../utils/manifestRecommendations';
import { ResourceYamlView } from '../components/ResourceYamlView';
import { PageTitle } from '../components/PageTitle';
import { NAV_ICONS } from '../components/layout/navIcons';

const SEVERITY_COLOR: Record<Recommendation['severity'], 'red' | 'orange' | 'blue'> = {
  danger: 'red',
  warning: 'orange',
  info: 'blue',
};

const TEXTAREA_STYLE: React.CSSProperties = { fontFamily: 'monospace', fontSize: '0.85rem' };

function typeKey(t: { group: string; kind: string }): string {
  return `${t.group}/${t.kind}`;
}

export const ResourceAnalyser: React.FC = () => {
  const { config } = useConnection();
  const { namespace } = useNamespace();
  const apiResources = useApiResources();
  const crds = useCustomResourceDefinitions();

  // CRDs are merged in directly from their own spec (group/version/plural/scope are already known)
  // rather than via /apis discovery — discovery would tell us the same thing, just less directly.
  const resourceTypes = useMemo<ResourceTypeInfo[]>(() => {
    const fromCrds: ResourceTypeInfo[] = (crds.data ?? []).map((crd) => ({
      group: crd.spec.group,
      version: crd.spec.versions.find((v) => v.storage)?.name ?? crd.spec.versions[0]?.name ?? 'v1',
      kind: crd.spec.names.kind,
      plural: crd.spec.names.plural,
      namespaced: crd.spec.scope === 'Namespaced',
    }));
    const seen = new Set<string>();
    const merged = [...(apiResources.data ?? []), ...fromCrds];
    return merged
      .filter((t) => {
        const key = typeKey(t);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => a.kind.localeCompare(b.kind));
  }, [apiResources.data, crds.data]);

  const [kindOpen, setKindOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | undefined>();
  const selectedType = resourceTypes.find((t) => typeKey(t) === selectedKey);

  const [manifestText, setManifestText] = useState('');

  const parsed = useMemo((): { value: unknown; error?: string } => {
    if (!manifestText.trim()) return { value: undefined };
    try {
      return { value: parseYaml(manifestText) };
    } catch (err) {
      return { value: undefined, error: (err as Error).message };
    }
  }, [manifestText]);

  const recommendations = useMemo(() => (parsed.value ? analyzeManifest(parsed.value) : []), [parsed.value]);

  const dryRun = useMutation({
    mutationFn: async () => {
      if (!parsed.value || typeof parsed.value !== 'object') throw new Error('Enter a valid YAML/JSON manifest first.');
      const obj = parsed.value as Record<string, any>;
      if (!obj.apiVersion || !obj.kind) throw new Error('Manifest needs both apiVersion and kind.');
      if (!obj.metadata?.name) throw new Error('Manifest needs metadata.name — server-side apply always targets a named object.');

      const { group, version } = parseApiVersion(obj.apiVersion);
      const type = resourceTypes.find((t) => t.group === group && t.version === version && t.kind === obj.kind);
      if (!type) {
        throw new Error(
          `${obj.apiVersion}/${obj.kind} isn't being served by this cluster — check the spelling, or that the CRD is installed.`,
        );
      }

      const ns = obj.metadata?.namespace ?? (namespace !== ALL_NAMESPACES ? namespace : 'default');
      const path = resourceObjectPath(type, type.namespaced ? ns : undefined, obj.metadata.name);
      return k8sApplyDryRun(config, path, obj);
    },
  });

  return (
    <PageSection>
      <PageTitle icon={NAV_ICONS.resourceAnalyser}>Resource Analyser</PageTitle>
      <Content component="p" style={{ marginBottom: '1rem' }}>
        Author a Kubernetes manifest, validate it against this cluster's live API server with a dry run (nothing is ever
        persisted), and get best-practice feedback before you apply it for real.
      </Content>

      <Card style={{ marginBottom: '1rem' }}>
        <CardTitle>Start from a template</CardTitle>
        <CardBody>
          {apiResources.error ? (
            <Alert variant="warning" isInline title="Couldn't discover API resources">
              {(apiResources.error as Error).message}
            </Alert>
          ) : (
            <Split hasGutter>
              <SplitItem isFilled>
                <Select
                  isOpen={kindOpen}
                  onOpenChange={setKindOpen}
                  selected={selectedKey}
                  onSelect={(_e, v) => {
                    setSelectedKey(String(v));
                    setKindOpen(false);
                  }}
                  toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                    <MenuToggle
                      ref={toggleRef}
                      onClick={() => setKindOpen((o) => !o)}
                      isExpanded={kindOpen}
                      style={{ minWidth: 320 }}
                      isDisabled={apiResources.isLoading || crds.isLoading}
                    >
                      {selectedType ? `${selectedType.kind} (${selectedType.group || 'core'}/${selectedType.version})` : 'Choose a resource kind...'}
                    </MenuToggle>
                  )}
                >
                  <SelectList>
                    {resourceTypes.map((t) => (
                      <SelectOption key={typeKey(t)} value={typeKey(t)}>
                        {t.kind} ({t.group || 'core'}/{t.version})
                      </SelectOption>
                    ))}
                  </SelectList>
                </Select>
              </SplitItem>
              <SplitItem>
                <Button isDisabled={!selectedType} onClick={() => selectedType && setManifestText(buildManifestTemplate(selectedType))}>
                  Insert template
                </Button>
              </SplitItem>
              {(apiResources.isLoading || crds.isLoading) && (
                <SplitItem>
                  <Bullseye>
                    <Spinner size="md" aria-label="Loading resource types" />
                  </Bullseye>
                </SplitItem>
              )}
            </Split>
          )}
        </CardBody>
      </Card>

      <Grid hasGutter>
        <GridItem span={7}>
          <Card>
            <CardTitle>Definition</CardTitle>
            <CardBody>
              <TextArea
                aria-label="Manifest YAML"
                value={manifestText}
                onChange={(_e, v) => setManifestText(v)}
                rows={24}
                resizeOrientation="vertical"
                style={TEXTAREA_STYLE}
                placeholder="Paste a manifest, or pick a kind above and click Insert template..."
              />
              {parsed.error && (
                <Alert variant="danger" isInline title="YAML parse error" style={{ marginTop: '0.75rem' }}>
                  {parsed.error}
                </Alert>
              )}
              <Button
                variant="primary"
                style={{ marginTop: '0.75rem' }}
                onClick={() => dryRun.mutate()}
                isLoading={dryRun.isPending}
                isDisabled={!manifestText.trim() || Boolean(parsed.error) || dryRun.isPending}
              >
                Dry Run
              </Button>
              {dryRun.isError && (
                <Alert variant="danger" isInline title="Dry run failed" style={{ marginTop: '0.75rem' }}>
                  {(dryRun.error as Error).message}
                </Alert>
              )}
              {dryRun.isSuccess && (
                <>
                  <Alert variant="success" isInline title="Dry run succeeded — this definition is valid." style={{ marginTop: '0.75rem' }} />
                  <div style={{ marginTop: '0.75rem' }}>
                    <ResourceYamlView resource={dryRun.data} />
                  </div>
                </>
              )}
            </CardBody>
          </Card>
        </GridItem>

        <GridItem span={5}>
          <Card>
            <CardTitle>Best Practice Recommendations</CardTitle>
            <CardBody>
              {!parsed.value ? (
                <em>Enter or generate a manifest to see recommendations.</em>
              ) : recommendations.length === 0 ? (
                <Alert variant="success" isInline title="No issues found." />
              ) : (
                <List isPlain>
                  {recommendations.map((r, i) => (
                    <ListItem key={i}>
                      <Label color={SEVERITY_COLOR[r.severity]} isCompact style={{ marginRight: 6 }}>
                        {r.severity}
                      </Label>
                      {r.message}
                    </ListItem>
                  ))}
                </List>
              )}
            </CardBody>
          </Card>
        </GridItem>
      </Grid>
    </PageSection>
  );
};

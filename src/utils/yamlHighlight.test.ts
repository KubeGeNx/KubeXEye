import { describe, it, expect } from 'vitest';
import { stringify } from 'yaml';
import { highlightYamlLines, YAML_COLORS } from './yamlHighlight';

function lineText(tokens: { text: string }[]): string {
  return tokens.map((t) => t.text).join('');
}

function findToken(tokens: { text: string; color?: string }[], substring: string) {
  return tokens.find((t) => t.text.includes(substring));
}

describe('highlightYamlLines', () => {
  it('round-trips the rendered text exactly (no characters lost or added)', () => {
    const yamlText = stringify({
      apiVersion: 'v1',
      kind: 'ResourceQuota',
      metadata: { name: 'example', namespace: 'default' },
      spec: { hard: { pods: '4', 'requests.cpu': '1', 'requests.memory': '1Gi' } },
    });
    const lines = highlightYamlLines(yamlText);
    expect(lines.map(lineText).join('\n')).toBe(yamlText);
  });

  it('colors keys distinctly from values, matching the ResourceQuota reference example', () => {
    const yamlText = ['apiVersion: v1', 'kind: ResourceQuota', "  pods: '4'"].join('\n');
    const lines = highlightYamlLines(yamlText);

    const apiVersionLine = lines[0];
    expect(findToken(apiVersionLine, 'apiVersion')?.color).toBe(YAML_COLORS.key);
    expect(findToken(apiVersionLine, 'v1')?.color).toBe(YAML_COLORS.scalar);

    const podsLine = lines[2];
    expect(findToken(podsLine, 'pods')?.color).toBe(YAML_COLORS.key);
    expect(findToken(podsLine, "'4'")?.color).toBe(YAML_COLORS.string);
  });

  it('flags an explicit null value in red', () => {
    const lines = highlightYamlLines('terminationGracePeriodSeconds: null');
    expect(findToken(lines[0], 'null')?.color).toBe(YAML_COLORS.undefined);
  });

  it('flags an empty string value in red', () => {
    const lines = highlightYamlLines("description: ''");
    expect(findToken(lines[0], "''")?.color).toBe(YAML_COLORS.undefined);
  });

  it('flags an empty object value in red', () => {
    const lines = highlightYamlLines('nodeSelector: {}');
    expect(findToken(lines[0], '{}')?.color).toBe(YAML_COLORS.undefined);
  });

  it('flags an empty array value in red', () => {
    const lines = highlightYamlLines('tolerations: []');
    expect(findToken(lines[0], '[]')?.color).toBe(YAML_COLORS.undefined);
  });

  it('flags a key with nothing after the colon and no following children as undefined', () => {
    const lines = highlightYamlLines('replicas:');
    const colorOf = lines[0].find((t) => t.text === ':')?.color;
    expect(colorOf).toBe(YAML_COLORS.undefined);
  });

  it('does NOT flag a key with nothing after the colon when a nested block follows', () => {
    const yamlText = ['metadata:', '  name: example'].join('\n');
    const lines = highlightYamlLines(yamlText);
    const colonColor = lines[0].find((t) => t.text === ':')?.color;
    expect(colonColor).not.toBe(YAML_COLORS.undefined);
  });

  it('colors quoted scalars green and unquoted scalars blue', () => {
    const yamlText = ["requests.cpu: '1'", 'requests.memory: 1Gi'].join('\n');
    const lines = highlightYamlLines(yamlText);
    expect(findToken(lines[0], "'1'")?.color).toBe(YAML_COLORS.string);
    expect(findToken(lines[1], '1Gi')?.color).toBe(YAML_COLORS.scalar);
  });

  it('handles "- key: value" sequence-of-mappings entries', () => {
    const yamlText = ['containers:', '  - name: app', '    image: app:1'].join('\n');
    const lines = highlightYamlLines(yamlText);
    expect(findToken(lines[1], 'name')?.color).toBe(YAML_COLORS.key);
    expect(findToken(lines[1], 'app')?.color).toBe(YAML_COLORS.scalar);
  });

  it('treats block scalar content as literal text, not as keys', () => {
    const yamlText = ['Corefile: |', '    key: not.a.real.key', '    other line'].join('\n');
    const lines = highlightYamlLines(yamlText);
    // the block scalar's own content lines should not be parsed as key/value pairs
    expect(lines[1].every((t) => t.color === YAML_COLORS.string || t.color === undefined)).toBe(true);
  });

  it('preserves blank lines without throwing', () => {
    const lines = highlightYamlLines('a: 1\n\nb: 2');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toEqual([]);
  });
});

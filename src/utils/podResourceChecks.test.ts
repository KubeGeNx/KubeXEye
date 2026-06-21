import { describe, it, expect } from 'vitest';
import { describeMissingResourceSpecs } from './podResourceChecks';
import type { K8sPod, PodSpecContainer } from '../types/k8s';

function pod(containers: PodSpecContainer[]): K8sPod {
  return { metadata: { name: 'p', namespace: 'default' }, spec: { containers } };
}

describe('describeMissingResourceSpecs', () => {
  it('flags a container with no resources object at all', () => {
    const result = describeMissingResourceSpecs(pod([{ name: 'app', image: 'app:1' }]));
    expect(result).toContain('"app"');
    expect(result).toContain('requests or limits');
  });

  it('flags a container with empty requests/limits objects', () => {
    const result = describeMissingResourceSpecs(pod([{ name: 'app', image: 'app:1', resources: { requests: {}, limits: {} } }]));
    expect(result).toContain('requests or limits');
  });

  it('flags only the missing half when one of requests/limits is set', () => {
    const result = describeMissingResourceSpecs(
      pod([{ name: 'app', image: 'app:1', resources: { requests: { cpu: '100m' } } }]),
    );
    expect(result).toContain('limits');
    expect(result).not.toContain('requests or limits');
  });

  it('returns undefined when both requests and limits are set', () => {
    const result = describeMissingResourceSpecs(
      pod([{ name: 'app', image: 'app:1', resources: { requests: { cpu: '100m' }, limits: { cpu: '200m' } } }]),
    );
    expect(result).toBeUndefined();
  });

  it('reports each offending container separately for multi-container pods', () => {
    const result = describeMissingResourceSpecs(
      pod([
        { name: 'app', image: 'app:1', resources: { requests: { cpu: '100m' }, limits: { cpu: '200m' } } },
        { name: 'sidecar', image: 'sidecar:1' },
      ]),
    );
    expect(result).toContain('"sidecar"');
    expect(result).not.toContain('"app"');
  });
});

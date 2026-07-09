import { describe, it, expect } from 'vitest';
import { analyzeManifest } from './manifestRecommendations';

describe('analyzeManifest', () => {
  it('flags a Deployment container missing resources, probes, and a pinned image tag', () => {
    const recs = analyzeManifest({
      kind: 'Deployment',
      metadata: { name: 'web' },
      spec: { replicas: 1, template: { spec: { containers: [{ name: 'app', image: 'nginx' }] } } },
    });

    const messages = recs.map((r) => r.message);
    expect(messages.some((m) => m.includes('resource requests'))).toBe(true);
    expect(messages.some((m) => m.includes('resource limits'))).toBe(true);
    expect(messages.some((m) => m.includes('latest'))).toBe(true);
    expect(messages.some((m) => m.includes('readinessProbe'))).toBe(true);
    expect(messages.some((m) => m.includes('livenessProbe'))).toBe(true);
    expect(messages.some((m) => m.includes('replicas is 1'))).toBe(true);
  });

  it('flags a ReplicaSet the same way as a Deployment (shared workload-kind resolution with securityAnalysis.ts)', () => {
    const recs = analyzeManifest({
      kind: 'ReplicaSet',
      metadata: { name: 'rs' },
      spec: { template: { spec: { containers: [{ name: 'app', image: 'nginx' }] } } },
    });

    const messages = recs.map((r) => r.message);
    expect(messages.some((m) => m.includes('resource requests'))).toBe(true);
    expect(messages.some((m) => m.includes('latest'))).toBe(true);
  });

  it('flags a privileged container as danger severity', () => {
    const recs = analyzeManifest({
      kind: 'Pod',
      metadata: { name: 'p' },
      spec: { containers: [{ name: 'app', image: 'nginx:1.25', securityContext: { privileged: true } }] },
    });

    const privileged = recs.find((r) => r.message.includes('privileged'));
    expect(privileged?.severity).toBe('danger');
  });

  it('has no complaints about a well-formed, fully-specified container', () => {
    const recs = analyzeManifest({
      kind: 'Deployment',
      metadata: { name: 'web', labels: { app: 'web' } },
      spec: {
        replicas: 3,
        template: {
          spec: {
            containers: [
              {
                name: 'app',
                image: 'nginx:1.25',
                resources: { requests: { cpu: '100m', memory: '128Mi' }, limits: { cpu: '200m', memory: '256Mi' } },
                readinessProbe: { httpGet: { path: '/', port: 80 } },
                livenessProbe: { httpGet: { path: '/', port: 80 } },
                securityContext: { runAsNonRoot: true },
              },
            ],
          },
        },
      },
    });

    expect(recs).toEqual([]);
  });

  it('flags a Service with no selector and a Secret with no type', () => {
    expect(analyzeManifest({ kind: 'Service', metadata: { name: 'svc' }, spec: {} })[0]).toMatchObject({
      severity: 'warning',
      message: expect.stringContaining('No spec.selector'),
    });

    expect(analyzeManifest({ kind: 'Secret', metadata: { name: 's' } })[0]).toMatchObject({
      severity: 'info',
      message: expect.stringContaining('No `type` set'),
    });
  });

  it('flags a missing metadata.name as a danger-severity issue', () => {
    const recs = analyzeManifest({ kind: 'ConfigMap', metadata: {} });
    expect(recs[0]).toEqual({ severity: 'danger', message: 'metadata.name is missing — every object needs a name.' });
  });

  it('returns no recommendations for non-object input', () => {
    expect(analyzeManifest(null)).toEqual([]);
    expect(analyzeManifest(undefined)).toEqual([]);
    expect(analyzeManifest('not an object')).toEqual([]);
  });
});

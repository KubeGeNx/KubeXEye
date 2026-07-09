import { describe, it, expect } from 'vitest';
import { resolveWorkloadPodSpec } from './workloadPodSpec';

describe('resolveWorkloadPodSpec', () => {
  it('resolves a Pod\'s spec directly', () => {
    const podSpec = { containers: [{ name: 'app' }] };
    expect(resolveWorkloadPodSpec({ kind: 'Pod', spec: podSpec })).toEqual({
      kind: 'Pod',
      yamlPrefix: 'spec',
      podSpec,
    });
  });

  it.each(['Deployment', 'StatefulSet', 'DaemonSet', 'Job', 'ReplicaSet'])(
    'resolves %s\'s pod template at spec.template.spec',
    (kind) => {
      const podSpec = { containers: [{ name: 'app' }] };
      expect(resolveWorkloadPodSpec({ kind, spec: { template: { spec: podSpec } } })).toEqual({
        kind,
        yamlPrefix: 'spec.template.spec',
        podSpec,
      });
    },
  );

  it('resolves a CronJob\'s nested job template', () => {
    const podSpec = { containers: [{ name: 'app' }] };
    expect(
      resolveWorkloadPodSpec({ kind: 'CronJob', spec: { jobTemplate: { spec: { template: { spec: podSpec } } } } }),
    ).toEqual({
      kind: 'CronJob',
      yamlPrefix: 'spec.jobTemplate.spec.template.spec',
      podSpec,
    });
  });

  it('returns undefined for kinds with no pod template', () => {
    expect(resolveWorkloadPodSpec({ kind: 'ConfigMap', data: {} })).toBeUndefined();
    expect(resolveWorkloadPodSpec({})).toBeUndefined();
  });
});

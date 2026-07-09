import { describe, it, expect } from 'vitest';
import { analyzeManifestSecurity } from './securityAnalysis';

function insecurePod() {
  return {
    apiVersion: 'v1',
    kind: 'Pod',
    metadata: { name: 'bad-pod' },
    spec: {
      hostNetwork: true,
      hostPID: true,
      containers: [
        {
          name: 'app',
          image: 'nginx',
          securityContext: {
            privileged: true,
            capabilities: { add: ['SYS_ADMIN'] },
          },
          env: [
            { name: 'DB_PASSWORD', value: 'hunter2' },
            { name: 'API_TOKEN', valueFrom: { secretKeyRef: { name: 'creds', key: 'token' } } },
          ],
        },
      ],
    },
  };
}

function hardenedPod() {
  return {
    apiVersion: 'v1',
    kind: 'Pod',
    metadata: { name: 'good-pod' },
    spec: {
      serviceAccountName: 'app-sa',
      automountServiceAccountToken: false,
      terminationGracePeriodSeconds: 30,
      containers: [
        {
          name: 'app',
          image: 'gcr.io/my-org/app@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          securityContext: {
            runAsNonRoot: true,
            runAsUser: 10001,
            runAsGroup: 10001,
            allowPrivilegeEscalation: false,
            readOnlyRootFilesystem: true,
            seccompProfile: { type: 'RuntimeDefault' },
            capabilities: { drop: ['ALL'] },
          },
          resources: {
            requests: { cpu: '100m', memory: '128Mi' },
            limits: { cpu: '200m', memory: '256Mi', 'ephemeral-storage': '1Gi' },
          },
          livenessProbe: { httpGet: { path: '/healthz', port: 8080 } },
          readinessProbe: { httpGet: { path: '/ready', port: 8080 } },
          startupProbe: { httpGet: { path: '/startup', port: 8080 } },
        },
      ],
    },
  };
}

describe('analyzeManifestSecurity', () => {
  it('flags an insecure pod with critical findings and a low score', () => {
    const report = analyzeManifestSecurity(insecurePod());
    expect(report.applicable).toBe(true);
    expect(report.score).toBeLessThan(60);
    expect(report.grade).toBe('F');
    expect(report.findings.some((f) => f.ruleId === 'POD-004')).toBe(true); // privileged
    expect(report.findings.some((f) => f.ruleId === 'POD-007')).toBe(true); // SYS_ADMIN
    expect(report.findings.some((f) => f.ruleId === 'NET-001')).toBe(true); // hostNetwork
    expect(report.findings.some((f) => f.ruleId === 'NET-002')).toBe(true); // hostPID
    expect(report.findings.some((f) => f.ruleId === 'SEC-004')).toBe(true); // plaintext credential
    expect(report.findings.some((f) => f.ruleId === 'SEC-003')).toBe(true); // secret via env
    expect(report.podSecurityStandards.baseline.compliant).toBe(false);
    expect(report.podSecurityStandards.restricted.compliant).toBe(false);
    expect(report.productionReady).toBe(false);
    expect(report.admissionRecommended).toBe(false);
  });

  it('scores a hardened pod highly and finds no critical/high issues', () => {
    const report = analyzeManifestSecurity(hardenedPod());
    expect(report.applicable).toBe(true);
    const critOrHigh = report.findings.filter((f) => f.severity === 'Critical' || f.severity === 'High');
    expect(critOrHigh).toEqual([]);
    expect(report.score).toBeGreaterThanOrEqual(80);
    expect(report.podSecurityStandards.restricted.compliant).toBe(true);
    expect(report.productionReady).toBe(true);
  });

  it('marks non-workload kinds without a pod template as not applicable', () => {
    const report = analyzeManifestSecurity({ apiVersion: 'v1', kind: 'ConfigMap', metadata: { name: 'cm' }, data: {} });
    expect(report.applicable).toBe(false);
    expect(report.unsupportedMessage).toMatch(/ConfigMap/);
  });

  it('flags wildcard RBAC rules on a ClusterRole', () => {
    const report = analyzeManifestSecurity({
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'ClusterRole',
      metadata: { name: 'god-mode' },
      rules: [{ apiGroups: ['*'], resources: ['*'], verbs: ['*'] }],
    });
    expect(report.applicable).toBe(true);
    expect(report.findings.some((f) => f.ruleId === 'SEC-005')).toBe(true);
  });

  it('handles invalid input gracefully', () => {
    const report = analyzeManifestSecurity(null);
    expect(report.applicable).toBe(false);
  });
});

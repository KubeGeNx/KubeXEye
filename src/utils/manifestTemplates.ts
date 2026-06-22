import { stringify as toYaml } from 'yaml';
import type { ResourceTypeInfo } from './k8sResourcePaths';

function apiVersionOf(type: ResourceTypeInfo): string {
  return type.group ? `${type.group}/${type.version}` : type.version;
}

function baseMetadata(type: ResourceTypeInfo, name: string) {
  return type.namespaced ? { name, namespace: 'default' } : { name };
}

const exampleContainer = {
  name: 'app',
  image: 'nginx:1.27',
  ports: [{ containerPort: 80 }],
  resources: { requests: { cpu: '100m', memory: '128Mi' }, limits: { cpu: '250m', memory: '256Mi' } },
  readinessProbe: { httpGet: { path: '/', port: 80 }, initialDelaySeconds: 5 },
  livenessProbe: { httpGet: { path: '/', port: 80 }, initialDelaySeconds: 15 },
};

// Batch workloads (Job/CronJob) run to completion rather than serving traffic, so HTTP
// readiness/liveness probes don't apply the way they do for long-running workloads.
const batchContainer = {
  name: 'app',
  image: 'busybox:1.36',
  resources: { requests: { cpu: '100m', memory: '128Mi' }, limits: { cpu: '250m', memory: '256Mi' } },
  command: ['echo', 'hello'],
};

/** Hand-written starter skeletons for the kinds people actually author by hand most often.
 * Anything not listed here (including CRDs) falls back to a minimal generic skeleton. */
const BUILDERS: Record<string, (type: ResourceTypeInfo) => Record<string, unknown>> = {
  Pod: (type) => ({
    apiVersion: apiVersionOf(type),
    kind: type.kind,
    metadata: baseMetadata(type, 'example-pod'),
    spec: { containers: [exampleContainer] },
  }),
  Deployment: (type) => ({
    apiVersion: apiVersionOf(type),
    kind: type.kind,
    metadata: { ...baseMetadata(type, 'example-app'), labels: { app: 'example-app' } },
    spec: {
      replicas: 2,
      selector: { matchLabels: { app: 'example-app' } },
      template: { metadata: { labels: { app: 'example-app' } }, spec: { containers: [exampleContainer] } },
    },
  }),
  StatefulSet: (type) => ({
    apiVersion: apiVersionOf(type),
    kind: type.kind,
    metadata: { ...baseMetadata(type, 'example-app'), labels: { app: 'example-app' } },
    spec: {
      serviceName: 'example-app',
      replicas: 2,
      selector: { matchLabels: { app: 'example-app' } },
      template: { metadata: { labels: { app: 'example-app' } }, spec: { containers: [exampleContainer] } },
    },
  }),
  DaemonSet: (type) => ({
    apiVersion: apiVersionOf(type),
    kind: type.kind,
    metadata: { ...baseMetadata(type, 'example-agent'), labels: { app: 'example-agent' } },
    spec: {
      selector: { matchLabels: { app: 'example-agent' } },
      template: { metadata: { labels: { app: 'example-agent' } }, spec: { containers: [exampleContainer] } },
    },
  }),
  Job: (type) => ({
    apiVersion: apiVersionOf(type),
    kind: type.kind,
    metadata: baseMetadata(type, 'example-job'),
    spec: { template: { spec: { containers: [batchContainer], restartPolicy: 'OnFailure' } } },
  }),
  CronJob: (type) => ({
    apiVersion: apiVersionOf(type),
    kind: type.kind,
    metadata: baseMetadata(type, 'example-cronjob'),
    spec: {
      schedule: '*/5 * * * *',
      jobTemplate: {
        spec: { template: { spec: { containers: [batchContainer], restartPolicy: 'OnFailure' } } },
      },
    },
  }),
  Service: (type) => ({
    apiVersion: apiVersionOf(type),
    kind: type.kind,
    metadata: baseMetadata(type, 'example-app'),
    spec: { selector: { app: 'example-app' }, ports: [{ port: 80, targetPort: 80 }], type: 'ClusterIP' },
  }),
  ConfigMap: (type) => ({
    apiVersion: apiVersionOf(type),
    kind: type.kind,
    metadata: baseMetadata(type, 'example-config'),
    data: { 'key.txt': 'value' },
  }),
  Secret: (type) => ({
    apiVersion: apiVersionOf(type),
    kind: type.kind,
    metadata: baseMetadata(type, 'example-secret'),
    type: 'Opaque',
    stringData: { password: 'change-me' },
  }),
  Ingress: (type) => ({
    apiVersion: apiVersionOf(type),
    kind: type.kind,
    metadata: baseMetadata(type, 'example-app'),
    spec: {
      tls: [{ hosts: ['example.com'], secretName: 'example-tls' }],
      rules: [{ host: 'example.com', http: { paths: [{ path: '/', pathType: 'Prefix', backend: { service: { name: 'example-app', port: { number: 80 } } } }] } }],
    },
  }),
  PersistentVolumeClaim: (type) => ({
    apiVersion: apiVersionOf(type),
    kind: type.kind,
    metadata: baseMetadata(type, 'example-data'),
    spec: { accessModes: ['ReadWriteOnce'], resources: { requests: { storage: '1Gi' } } },
  }),
  ServiceAccount: (type) => ({
    apiVersion: apiVersionOf(type),
    kind: type.kind,
    metadata: baseMetadata(type, 'example-sa'),
  }),
  Namespace: (type) => ({
    apiVersion: apiVersionOf(type),
    kind: type.kind,
    metadata: { name: 'example-namespace' },
  }),
  NetworkPolicy: (type) => ({
    apiVersion: apiVersionOf(type),
    kind: type.kind,
    metadata: baseMetadata(type, 'example-netpol'),
    spec: { podSelector: { matchLabels: { app: 'example-app' } }, policyTypes: ['Ingress'] },
  }),
};

function genericTemplate(type: ResourceTypeInfo): Record<string, unknown> {
  return {
    apiVersion: apiVersionOf(type),
    kind: type.kind,
    metadata: baseMetadata(type, `example-${type.kind.toLowerCase()}`),
    spec: {},
  };
}

/** Returns a starter YAML manifest for the given resource type, with a leading comment. Falls
 * back to a minimal generic skeleton (apiVersion/kind/metadata/spec) for anything without a
 * hand-written builder — including every CRD, since their shape comes from an arbitrary schema. */
export function buildManifestTemplate(type: ResourceTypeInfo): string {
  const builder = BUILDERS[type.kind] ?? genericTemplate;
  const obj = builder(type);
  const comment = BUILDERS[type.kind]
    ? `# Starter ${type.kind} — fill in the placeholders, then Dry Run to validate.\n`
    : `# Minimal ${type.kind} skeleton — check this resource's schema/CRD for the fields spec needs.\n`;
  return comment + toYaml(obj);
}

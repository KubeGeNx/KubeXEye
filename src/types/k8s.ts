// Minimal Kubernetes object types — only the fields this app reads.
// Intentionally not exhaustive; extend as new fields are needed.

export interface ObjectMeta {
  name: string;
  namespace?: string;
  uid?: string;
  creationTimestamp?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  resourceVersion?: string;
  ownerReferences?: { kind: string; name: string }[];
}

export interface ListMeta {
  resourceVersion?: string;
  continue?: string;
}

export interface K8sList<T> {
  kind: string;
  apiVersion: string;
  metadata: ListMeta;
  items: T[];
}

export interface K8sObject {
  kind?: string;
  apiVersion?: string;
  metadata: ObjectMeta;
}

export interface K8sStatus {
  kind: 'Status';
  status: 'Success' | 'Failure';
  message?: string;
  reason?: string;
  code?: number;
}

// ---- Core v1 ----

export interface NodeCondition {
  type: string;
  status: 'True' | 'False' | 'Unknown';
  reason?: string;
  message?: string;
  lastTransitionTime?: string;
}

export interface K8sNode extends K8sObject {
  spec?: {
    taints?: { key: string; value?: string; effect: string }[];
    unschedulable?: boolean;
  };
  status?: {
    capacity?: Record<string, string>;
    allocatable?: Record<string, string>;
    conditions?: NodeCondition[];
    nodeInfo?: { kubeletVersion?: string; osImage?: string; architecture?: string };
  };
}

export interface ContainerStatus {
  name: string;
  ready: boolean;
  restartCount: number;
  state?: Record<string, unknown>;
  image?: string;
}

export interface EnvFromSource {
  configMapRef?: { name: string };
  secretRef?: { name: string };
}

export interface EnvVar {
  name: string;
  valueFrom?: {
    configMapKeyRef?: { name: string; key: string };
    secretKeyRef?: { name: string; key: string };
  };
}

export interface PodSpecContainer {
  name: string;
  image: string;
  envFrom?: EnvFromSource[];
  env?: EnvVar[];
  resources?: {
    requests?: Record<string, string>;
    limits?: Record<string, string>;
  };
}

export interface PodVolume {
  name: string;
  configMap?: { name: string };
  secret?: { secretName: string };
  persistentVolumeClaim?: { claimName: string };
}

export interface K8sPod extends K8sObject {
  spec?: {
    nodeName?: string;
    serviceAccountName?: string;
    containers: PodSpecContainer[];
    volumes?: PodVolume[];
    imagePullSecrets?: { name: string }[];
  };
  status?: {
    phase?: 'Pending' | 'Running' | 'Succeeded' | 'Failed' | 'Unknown';
    podIP?: string;
    startTime?: string;
    containerStatuses?: ContainerStatus[];
  };
}

export interface K8sNamespace extends K8sObject {
  status?: { phase?: 'Active' | 'Terminating' };
}

export interface K8sEvent extends K8sObject {
  type?: 'Normal' | 'Warning';
  reason?: string;
  message?: string;
  count?: number;
  involvedObject?: { kind: string; name: string; namespace?: string };
  firstTimestamp?: string;
  lastTimestamp?: string;
  source?: { component?: string };
}

export interface K8sConfigMap extends K8sObject {
  data?: Record<string, string>;
}

export interface K8sSecret extends K8sObject {
  type?: string;
  data?: Record<string, string>;
}

export interface K8sServiceAccount extends K8sObject {
  secrets?: { name: string }[];
}

// ---- apps/v1 ----

export interface DeploymentCondition {
  type: string;
  status: string;
}

export interface LabelSelector {
  matchLabels?: Record<string, string>;
}

export interface K8sDeployment extends K8sObject {
  spec?: { replicas?: number; selector?: LabelSelector };
  status?: {
    replicas?: number;
    readyReplicas?: number;
    availableReplicas?: number;
    updatedReplicas?: number;
    conditions?: DeploymentCondition[];
  };
}

export interface K8sStatefulSet extends K8sObject {
  spec?: { replicas?: number; selector?: LabelSelector };
  status?: { replicas?: number; readyReplicas?: number; updatedReplicas?: number };
}

export interface K8sDaemonSet extends K8sObject {
  spec?: { selector?: LabelSelector };
  status?: {
    desiredNumberScheduled?: number;
    currentNumberScheduled?: number;
    numberReady?: number;
    numberAvailable?: number;
  };
}

// ---- rbac.authorization.k8s.io/v1 ----

export interface PolicyRule {
  apiGroups?: string[];
  resources?: string[];
  verbs: string[];
}

export interface K8sRole extends K8sObject {
  rules?: PolicyRule[];
}

export interface RoleRef {
  kind: string;
  name: string;
  apiGroup: string;
}

export interface Subject {
  kind: string;
  name: string;
  namespace?: string;
}

export interface K8sRoleBinding extends K8sObject {
  roleRef: RoleRef;
  subjects?: Subject[];
}

// ---- core v1: Services, PersistentVolumeClaims, StorageClasses ----

export interface K8sService extends K8sObject {
  spec?: {
    type?: 'ClusterIP' | 'NodePort' | 'LoadBalancer' | 'ExternalName';
    selector?: Record<string, string>;
    clusterIP?: string;
    ports?: { name?: string; port: number; targetPort?: number | string; protocol?: string }[];
  };
}

export interface K8sPersistentVolumeClaim extends K8sObject {
  spec?: {
    storageClassName?: string;
    accessModes?: string[];
    resources?: { requests?: Record<string, string> };
    volumeName?: string;
  };
  status?: {
    phase?: 'Pending' | 'Bound' | 'Lost';
    capacity?: Record<string, string>;
  };
}

// ---- storage.k8s.io/v1 ----

export interface K8sStorageClass extends K8sObject {
  provisioner: string;
  reclaimPolicy?: string;
  volumeBindingMode?: string;
}

// ---- networking.k8s.io/v1 ----

export interface K8sNetworkPolicy extends K8sObject {
  spec?: {
    podSelector?: { matchLabels?: Record<string, string> };
    policyTypes?: string[];
    ingress?: unknown[];
    egress?: unknown[];
  };
}

export interface IngressBackend {
  service?: { name: string; port?: { number?: number; name?: string } };
}

export interface K8sIngress extends K8sObject {
  spec?: {
    rules?: {
      host?: string;
      http?: { paths: { path?: string; backend: IngressBackend }[] };
    }[];
    defaultBackend?: IngressBackend;
  };
}

// ---- apiextensions.k8s.io/v1 ----

export interface CRDVersion {
  name: string;
  served: boolean;
  storage: boolean;
}

export interface K8sCustomResourceDefinition extends K8sObject {
  spec: {
    group: string;
    scope: 'Namespaced' | 'Cluster';
    names: { plural: string; singular?: string; kind: string; shortNames?: string[] };
    versions: CRDVersion[];
  };
  status?: {
    conditions?: { type: string; status: string }[];
  };
}

// Any custom resource instance — shape is defined by its CRD schema.
export interface CustomResource extends K8sObject {
  [key: string]: unknown;
}

// ---- metrics.k8s.io/v1beta1 ----

export interface MetricsUsage {
  cpu: string;
  memory: string;
}

export interface NodeMetrics extends K8sObject {
  timestamp: string;
  window: string;
  usage: MetricsUsage;
}

export interface PodMetrics extends K8sObject {
  timestamp: string;
  window: string;
  containers: { name: string; usage: MetricsUsage }[];
}

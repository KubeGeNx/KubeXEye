/**
 * Kubernetes Security Analyzer — a deterministic, rule-based static assessment of a single
 * workload manifest against Pod Security Standards, the CIS Kubernetes Benchmark, the OWASP
 * Kubernetes Top 10, and general production security best practices.
 *
 * Everything here is a pure function of the parsed manifest: same input always produces the same
 * findings and score. Missing/absent configuration is always treated as "not configured" rather
 * than assumed safe.
 */

import { resolveWorkloadPodSpec, type WorkloadPodSpec } from './workloadPodSpec';

export type Severity = 'Critical' | 'High' | 'Medium' | 'Low' | 'Informational';

export const SEVERITY_POINTS: Record<Severity, number> = {
  Critical: 10,
  High: 7,
  Medium: 4,
  Low: 2,
  Informational: 0,
};

const SEVERITY_RANK: Record<Severity, number> = {
  Critical: 4,
  High: 3,
  Medium: 2,
  Low: 1,
  Informational: 0,
};

export type Grade = 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
export type RiskLevel = 'Low' | 'Moderate' | 'High' | 'Critical';

export type Category =
  | 'Identity & Privileges'
  | 'Runtime Security'
  | 'Filesystem'
  | 'Networking'
  | 'Image Security'
  | 'Secrets & Identity'
  | 'Resource Management'
  | 'Operational Best Practices';

export interface SecurityFinding {
  ruleId: string;
  title: string;
  severity: Severity;
  category: Category;
  description: string;
  impact: string;
  yamlPath: string;
  current: string;
  expected: string;
  recommendation: string;
  pointsDeducted: number;
  cis?: string;
  owasp?: string;
}

export interface PassedCheck {
  ruleId: string;
  title: string;
  category: Category;
}

export interface PssResult {
  compliant: boolean;
  violations: string[];
}

export interface PodSecurityStandardsResult {
  restricted: PssResult;
  baseline: PssResult;
  privileged: PssResult;
}

export interface SecurityReport {
  applicable: boolean;
  unsupportedMessage?: string;
  kind?: string;
  name?: string;
  score: number;
  grade: Grade;
  riskLevel: RiskLevel;
  findings: SecurityFinding[];
  passedChecks: PassedCheck[];
  podSecurityStandards: PodSecurityStandardsResult;
  executiveSummary: string;
  remediationOrder: SecurityFinding[];
  estimatedScoreAfterRemediation: number;
  productionReady: boolean;
  admissionRecommended: boolean;
  topImprovements: string[];
}

// ---------------------------------------------------------------------------
// Rule catalogue — static metadata shared by every instance of a given rule.
// ---------------------------------------------------------------------------

interface RuleDef {
  ruleId: string;
  title: string;
  severity: Severity;
  category: Category;
  description: string;
  impact: string;
  recommendation: string;
  cis?: string;
  owasp?: string;
}

const RULES = {
  POD_001: {
    ruleId: 'POD-001',
    title: 'Container may run as root',
    severity: 'Critical',
    category: 'Identity & Privileges',
    description: 'runAsNonRoot is not set to true at the pod or container level.',
    impact: 'A compromised process running as root (UID 0) can trivially escalate to full control of the container and pursue host/node compromise.',
    recommendation: 'Set securityContext.runAsNonRoot=true and specify a non-root runAsUser at the pod or container level.',
    cis: 'CIS Kubernetes Benchmark 5.2.6 — Minimize the admission of root containers',
    owasp: 'OWASP K01: Insecure Workload Configurations',
  },
  POD_002: {
    ruleId: 'POD-002',
    title: 'runAsUser not configured',
    severity: 'Medium',
    category: 'Identity & Privileges',
    description: 'No explicit numeric runAsUser is set, so the container falls back to whatever user is baked into the image.',
    impact: 'Without an explicit UID, the effective user is controlled entirely by the image author and may be root.',
    recommendation: 'Set securityContext.runAsUser to a fixed, non-zero UID.',
    cis: 'CIS Kubernetes Benchmark 5.2.6',
    owasp: 'OWASP K01: Insecure Workload Configurations',
  },
  POD_003: {
    ruleId: 'POD-003',
    title: 'runAsGroup not configured',
    severity: 'Low',
    category: 'Identity & Privileges',
    description: 'No explicit runAsGroup is set for the container.',
    impact: 'The container falls back to the image-defined primary group, reducing control over filesystem/IPC access.',
    recommendation: 'Set securityContext.runAsGroup to a fixed, non-zero GID.',
    cis: 'CIS Kubernetes Benchmark 5.2.6',
    owasp: 'OWASP K01: Insecure Workload Configurations',
  },
  POD_004: {
    ruleId: 'POD-004',
    title: 'Privileged container',
    severity: 'Critical',
    category: 'Identity & Privileges',
    description: 'securityContext.privileged is set to true.',
    impact: 'A privileged container has essentially unrestricted access to the host, including all devices, kernel capabilities, and the host filesystem — a compromise here is a full node compromise.',
    recommendation: 'Remove privileged: true. If specific host access is required, grant only the exact capability needed instead.',
    cis: 'CIS Kubernetes Benchmark 5.2.1 — Minimize the admission of privileged containers',
    owasp: 'OWASP K01: Insecure Workload Configurations',
  },
  POD_005: {
    ruleId: 'POD-005',
    title: 'allowPrivilegeEscalation not disabled',
    severity: 'High',
    category: 'Identity & Privileges',
    description: 'allowPrivilegeEscalation is not explicitly set to false.',
    impact: 'A process in the container can gain more privileges than its parent (e.g. via setuid binaries), undermining any non-root configuration.',
    recommendation: 'Set securityContext.allowPrivilegeEscalation=false.',
    cis: 'CIS Kubernetes Benchmark 5.2.5 — Minimize the admission of containers with allowPrivilegeEscalation',
    owasp: 'OWASP K01: Insecure Workload Configurations',
  },
  POD_006: {
    ruleId: 'POD-006',
    title: 'Linux capabilities not dropped',
    severity: 'High',
    category: 'Identity & Privileges',
    description: 'The container does not drop ALL default Linux capabilities before adding back only what it needs.',
    impact: 'Default container capabilities (e.g. NET_RAW, CHOWN, SETUID) remain available, widening the kernel attack surface available to a compromised process.',
    recommendation: 'Set securityContext.capabilities.drop=["ALL"], then add back only the specific capabilities the workload actually requires.',
    cis: 'CIS Kubernetes Benchmark 5.2.9 — Minimize the admission of containers with capabilities assigned',
    owasp: 'OWASP K01: Insecure Workload Configurations',
  },
  POD_007: {
    ruleId: 'POD-007',
    title: 'CAP_SYS_ADMIN capability granted',
    severity: 'Critical',
    category: 'Identity & Privileges',
    description: 'The container explicitly adds the SYS_ADMIN capability.',
    impact: 'SYS_ADMIN is one of the most powerful Linux capabilities and is broadly equivalent to root on the host in many scenarios (mount, namespace manipulation, etc.).',
    recommendation: 'Remove SYS_ADMIN from securityContext.capabilities.add. Identify the specific, narrower capability actually required.',
    cis: 'CIS Kubernetes Benchmark 5.2.9',
    owasp: 'OWASP K01: Insecure Workload Configurations',
  },
  POD_008: {
    ruleId: 'POD-008',
    title: 'Unnecessary Linux capabilities added',
    severity: 'Medium',
    category: 'Identity & Privileges',
    description: 'The container adds one or more Linux capabilities beyond the minimal set typically required.',
    impact: 'Each added capability increases the kernel attack surface reachable from inside the container.',
    recommendation: 'Review each added capability and remove any not strictly required by the application.',
    cis: 'CIS Kubernetes Benchmark 5.2.9',
    owasp: 'OWASP K01: Insecure Workload Configurations',
  },
  RUN_001: {
    ruleId: 'RUN-001',
    title: 'seccompProfile not configured',
    severity: 'Medium',
    category: 'Runtime Security',
    description: 'No seccompProfile is set at the pod or container level.',
    impact: 'Without a seccomp profile, the container can invoke the full set of syscalls available to the container runtime, including many never needed by ordinary application code.',
    recommendation: 'Set securityContext.seccompProfile.type=RuntimeDefault (or a stricter Localhost profile).',
    cis: 'CIS Kubernetes Benchmark 5.7.2 — Ensure that the seccomp profile is set to docker/default or runtime/default',
    owasp: 'OWASP K01: Insecure Workload Configurations',
  },
  RUN_002: {
    ruleId: 'RUN-002',
    title: 'seccomp profile not RuntimeDefault/Localhost',
    severity: 'High',
    category: 'Runtime Security',
    description: 'seccompProfile.type is set to Unconfined (or another non-default value), disabling syscall filtering.',
    impact: 'Unconfined seccomp removes syscall filtering entirely, meaningfully increasing the kernel attack surface exposed to the container.',
    recommendation: 'Change seccompProfile.type to RuntimeDefault, or a specific Localhost profile if the workload needs additional syscalls.',
    cis: 'CIS Kubernetes Benchmark 5.7.2',
    owasp: 'OWASP K01: Insecure Workload Configurations',
  },
  RUN_003: {
    ruleId: 'RUN-003',
    title: 'AppArmor profile not configured',
    severity: 'Low',
    category: 'Runtime Security',
    description: 'No AppArmor profile is set for the container (securityContext.appArmorProfile, or the equivalent annotation).',
    impact: 'Without an AppArmor profile, the container relies solely on the runtime default (if any), reducing mandatory access control depth.',
    recommendation: 'Set securityContext.appArmorProfile.type=RuntimeDefault (or a custom profile), where the node/runtime supports AppArmor.',
    cis: 'CIS Kubernetes Benchmark 5.7.3',
    owasp: 'OWASP K01: Insecure Workload Configurations',
  },
  RUN_004: {
    ruleId: 'RUN-004',
    title: 'SELinux options not configured',
    severity: 'Informational',
    category: 'Runtime Security',
    description: 'No seLinuxOptions are set for the pod or container.',
    impact: 'On SELinux-enforcing nodes, the container runs under the runtime default label rather than a workload-specific, more restrictive one.',
    recommendation: 'Where the cluster runs SELinux-enforcing nodes, set securityContext.seLinuxOptions to a dedicated, restrictive type.',
    cis: 'CIS Kubernetes Benchmark 5.7.4',
    owasp: 'OWASP K01: Insecure Workload Configurations',
  },
  RUN_005: {
    ruleId: 'RUN-005',
    title: 'RuntimeClass not used',
    severity: 'Informational',
    category: 'Runtime Security',
    description: 'No spec.runtimeClassName is set.',
    impact: 'The workload uses the cluster default container runtime rather than a hardened sandbox (e.g. gVisor, Kata Containers), which matters most for untrusted or multi-tenant workloads.',
    recommendation: 'For workloads running less-trusted code, set spec.runtimeClassName to a sandboxed runtime class if the cluster provides one.',
    owasp: 'OWASP K01: Insecure Workload Configurations',
  },
  FS_001: {
    ruleId: 'FS-001',
    title: 'Root filesystem is writable',
    severity: 'High',
    category: 'Filesystem',
    description: 'readOnlyRootFilesystem is not set to true.',
    impact: 'A compromised process can write to, modify, or replace files anywhere on the container filesystem, including binaries, aiding persistence.',
    recommendation: 'Set securityContext.readOnlyRootFilesystem=true and mount writable emptyDir volumes only for directories that genuinely need to be written to.',
    owasp: 'OWASP K01: Insecure Workload Configurations',
  },
  FS_002: {
    ruleId: 'FS-002',
    title: 'hostPath volume in use',
    severity: 'High',
    category: 'Filesystem',
    description: 'The pod spec defines one or more hostPath volumes.',
    impact: 'hostPath volumes bind-mount a path from the underlying node into the container, breaking container isolation and allowing interaction with node-local state.',
    recommendation: 'Avoid hostPath volumes. Use a PersistentVolumeClaim, ConfigMap, Secret, or emptyDir instead.',
    cis: 'CIS Kubernetes Benchmark 5.2 — Pod Security Standards (Baseline restricts hostPath volumes)',
    owasp: 'OWASP K01: Insecure Workload Configurations',
  },
  FS_003: {
    ruleId: 'FS-003',
    title: 'Writable hostPath mount',
    severity: 'Critical',
    category: 'Filesystem',
    description: 'A hostPath volume is mounted without readOnly: true.',
    impact: 'The container can write back to the node filesystem, enabling node persistence, tampering with node binaries, or full host compromise depending on the path.',
    recommendation: 'Set readOnly: true on the volumeMount, or remove the hostPath volume entirely.',
    owasp: 'OWASP K01: Insecure Workload Configurations',
  },
  FS_004: {
    ruleId: 'FS-004',
    title: 'Sensitive host path mounted',
    severity: 'Critical',
    category: 'Filesystem',
    description: 'A hostPath volume points at a sensitive system path (e.g. /, /etc, /var/run/docker.sock, /proc, /root).',
    impact: 'Sensitive host paths commonly grant a direct path to container-escape or full node/cluster compromise (e.g. the Docker/CRI socket grants root-equivalent access to the node).',
    recommendation: 'Remove this mount entirely. If host interaction is required, use a narrowly-scoped, purpose-built mechanism instead.',
    owasp: 'OWASP K01: Insecure Workload Configurations',
  },
  NET_001: {
    ruleId: 'NET-001',
    title: 'hostNetwork enabled',
    severity: 'Critical',
    category: 'Networking',
    description: 'spec.hostNetwork is set to true.',
    impact: 'The pod shares the node\'s network namespace, bypassing NetworkPolicy isolation and exposing every node-local network interface and listening service.',
    recommendation: 'Remove hostNetwork: true. Use a Service/Ingress for any traffic the pod needs to receive.',
    cis: 'CIS Kubernetes Benchmark 5.2.4 — Minimize the admission of containers wishing to share the host network namespace',
    owasp: 'OWASP K07: Missing Network Segmentation Controls',
  },
  NET_002: {
    ruleId: 'NET-002',
    title: 'hostPID enabled',
    severity: 'Critical',
    category: 'Networking',
    description: 'spec.hostPID is set to true.',
    impact: 'The pod can see and signal every process on the node, including processes belonging to other pods — a severe isolation break.',
    recommendation: 'Remove hostPID: true.',
    cis: 'CIS Kubernetes Benchmark 5.2.2 — Minimize the admission of containers wishing to share the host process ID namespace',
    owasp: 'OWASP K07: Missing Network Segmentation Controls',
  },
  NET_003: {
    ruleId: 'NET-003',
    title: 'hostIPC enabled',
    severity: 'High',
    category: 'Networking',
    description: 'spec.hostIPC is set to true.',
    impact: 'The pod shares the node\'s IPC namespace, allowing access to shared memory segments and semaphores belonging to other processes on the node.',
    recommendation: 'Remove hostIPC: true.',
    cis: 'CIS Kubernetes Benchmark 5.2.3 — Minimize the admission of containers wishing to share the host IPC namespace',
    owasp: 'OWASP K07: Missing Network Segmentation Controls',
  },
  NET_004: {
    ruleId: 'NET-004',
    title: 'Host port(s) bound',
    severity: 'Medium',
    category: 'Networking',
    description: 'A container port defines a hostPort, binding directly to a port on the node.',
    impact: 'Host ports bypass Service-based load balancing, create port conflicts between pods on the same node, and expose the workload directly on every node\'s network interface.',
    recommendation: 'Remove hostPort and expose the container via a Service instead.',
    owasp: 'OWASP K07: Missing Network Segmentation Controls',
  },
  NET_005: {
    ruleId: 'NET-005',
    title: 'NetworkPolicy coverage cannot be verified',
    severity: 'Informational',
    category: 'Networking',
    description: 'A manifest for a single workload cannot confirm whether a NetworkPolicy restricts its ingress/egress traffic in the target cluster.',
    impact: 'Without a NetworkPolicy, this workload can typically send and receive traffic to/from every other pod in the cluster by default.',
    recommendation: 'Apply a default-deny NetworkPolicy in this namespace and explicitly allow only required traffic to/from this workload.',
    cis: 'CIS Kubernetes Benchmark 5.3.2 — Ensure that all Namespaces have Network Policies defined',
    owasp: 'OWASP K07: Missing Network Segmentation Controls',
  },
  IMG_001: {
    ruleId: 'IMG-001',
    title: 'Image not pinned by digest',
    severity: 'Low',
    category: 'Image Security',
    description: 'The image reference uses a tag rather than an immutable @sha256 digest.',
    impact: 'A tag can be moved to point at different image content at any time, so the exact code running cannot be guaranteed to match what was reviewed/scanned.',
    recommendation: 'Reference the image by digest, e.g. myimage@sha256:<digest>, for fully reproducible, tamper-evident deployments.',
    owasp: 'OWASP K02: Supply Chain Vulnerabilities',
  },
  IMG_002: {
    ruleId: 'IMG-002',
    title: 'Image uses "latest" or no tag',
    severity: 'High',
    category: 'Image Security',
    description: 'The image reference has no tag (implicitly "latest") or explicitly uses the "latest" tag.',
    impact: '"latest" is mutable and non-reproducible — the same manifest can pull entirely different, unreviewed image content over time, and rollbacks become unreliable.',
    recommendation: 'Pin to an explicit, immutable version tag (or better, a digest).',
    owasp: 'OWASP K02: Supply Chain Vulnerabilities',
  },
  IMG_003: {
    ruleId: 'IMG-003',
    title: 'Image resolves to an unqualified/public registry',
    severity: 'Medium',
    category: 'Image Security',
    description: 'The image reference has no explicit registry host, so it resolves to the public Docker Hub by default.',
    impact: 'Pulling from a public, unqualified registry increases exposure to typosquatting, unexpected upstream changes, and rate limiting, and provides no organizational control over image provenance.',
    recommendation: 'Reference images from a trusted, organization-controlled registry (private registry or a vetted mirror) with an explicit registry host.',
    owasp: 'OWASP K02: Supply Chain Vulnerabilities',
  },
  IMG_004: {
    ruleId: 'IMG-004',
    title: 'Base image minimality cannot be verified',
    severity: 'Informational',
    category: 'Image Security',
    description: 'Base image contents cannot be determined from the manifest alone.',
    impact: 'A large, general-purpose base image (e.g. a full OS) carries far more attack surface — extra packages, shells, package managers — than a minimal or distroless image.',
    recommendation: 'Prefer a minimal or distroless base image with only the runtime dependencies the application actually needs.',
    owasp: 'OWASP K02: Supply Chain Vulnerabilities',
  },
  IMG_005: {
    ruleId: 'IMG-005',
    title: 'Image signing cannot be verified',
    severity: 'Informational',
    category: 'Image Security',
    description: 'The manifest provides no evidence of image signature verification (e.g. cosign/Sigstore, Notary) at the admission layer.',
    impact: 'Without signature verification, the cluster cannot cryptographically confirm that the image was produced by a trusted build pipeline before running it.',
    recommendation: 'Sign images in CI and enforce signature verification at admission (e.g. via an admission controller such as Kyverno or Connaisseur).',
    owasp: 'OWASP K02: Supply Chain Vulnerabilities',
  },
  IMG_006: {
    ruleId: 'IMG-006',
    title: 'Vulnerability scanning cannot be verified',
    severity: 'Informational',
    category: 'Image Security',
    description: 'The manifest provides no evidence that this image has been scanned for known vulnerabilities.',
    impact: 'Unscanned images may contain known-exploitable CVEs in OS packages or language dependencies.',
    recommendation: 'Scan images in CI (e.g. Trivy, Grype) and block deployment of images with unresolved Critical/High vulnerabilities.',
    owasp: 'OWASP K02: Supply Chain Vulnerabilities',
  },
  SEC_001: {
    ruleId: 'SEC-001',
    title: 'Default ServiceAccount in use',
    severity: 'Medium',
    category: 'Secrets & Identity',
    description: 'No dedicated serviceAccountName is set (or it explicitly uses "default").',
    impact: 'The default ServiceAccount is often shared across many workloads in a namespace; any RBAC permissions bound to it are implicitly granted to all of them.',
    recommendation: 'Create and reference a dedicated ServiceAccount scoped to exactly this workload\'s needs.',
    cis: 'CIS Kubernetes Benchmark 5.1.5 — Ensure that default service accounts are not actively used',
    owasp: 'OWASP K03: Overly Permissive RBAC Configurations',
  },
  SEC_002: {
    ruleId: 'SEC-002',
    title: 'automountServiceAccountToken not disabled',
    severity: 'Medium',
    category: 'Secrets & Identity',
    description: 'automountServiceAccountToken is not explicitly set to false.',
    impact: 'The pod is issued a Kubernetes API token automatically, even when it never calls the API server — a compromised container can use that token to talk to the API server.',
    recommendation: 'Set automountServiceAccountToken=false unless the workload genuinely needs to call the Kubernetes API.',
    cis: 'CIS Kubernetes Benchmark 5.1.6 — Ensure that Service Account Tokens are only mounted where necessary',
    owasp: 'OWASP K03: Overly Permissive RBAC Configurations',
  },
  SEC_003: {
    ruleId: 'SEC-003',
    title: 'Secret exposed through an environment variable',
    severity: 'High',
    category: 'Secrets & Identity',
    description: 'A container environment variable is sourced from a Secret (secretKeyRef or envFrom.secretRef).',
    impact: 'Environment variables are visible via /proc/<pid>/environ, container inspect/describe output, crash dumps, and are frequently leaked into logs — all of which are avoided by mounting secrets as files.',
    recommendation: 'Mount the Secret as a volume instead and have the application read it from the filesystem.',
    cis: 'CIS Kubernetes Benchmark 5.4.1 — Prefer using secrets as files over secrets as environment variables',
    owasp: 'OWASP K08: Secrets Management Failures',
  },
  SEC_004: {
    ruleId: 'SEC-004',
    title: 'Plaintext credential in environment variable',
    severity: 'Critical',
    category: 'Secrets & Identity',
    description: 'A container environment variable whose name suggests a credential (password/token/key/secret) has a plaintext literal value in the manifest.',
    impact: 'The credential is stored in cleartext in the manifest/version control and is visible to anyone who can read the Pod spec or its events.',
    recommendation: 'Move this value into a Secret and reference it via secretKeyRef (or, better, a mounted Secret volume), never as a literal in the manifest.',
    owasp: 'OWASP K08: Secrets Management Failures',
  },
  SEC_005: {
    ruleId: 'SEC-005',
    title: 'RBAC wildcard permission',
    severity: 'Critical',
    category: 'Secrets & Identity',
    description: 'A Role/ClusterRole rule grants "*" for apiGroups, resources, or verbs.',
    impact: 'Wildcard RBAC rules grant far more access than almost any workload needs, turning a single compromised pod\'s credentials into a path to broad cluster compromise.',
    recommendation: 'Enumerate the exact apiGroups, resources, and verbs actually required and remove the wildcard.',
    cis: 'CIS Kubernetes Benchmark 5.1.3 — Minimize wildcard use in Roles and ClusterRoles',
    owasp: 'OWASP K03: Overly Permissive RBAC Configurations',
  },
  RES_001: {
    ruleId: 'RES-001',
    title: 'No CPU request',
    severity: 'Medium',
    category: 'Resource Management',
    description: 'resources.requests.cpu is not set.',
    impact: 'The scheduler cannot reason about this container\'s CPU footprint, which can lead to node overcommitment and noisy-neighbor contention.',
    recommendation: 'Set resources.requests.cpu to a realistic baseline value.',
    owasp: 'OWASP K01: Insecure Workload Configurations',
  },
  RES_002: {
    ruleId: 'RES-002',
    title: 'No CPU limit',
    severity: 'Medium',
    category: 'Resource Management',
    description: 'resources.limits.cpu is not set.',
    impact: 'The container can consume unbounded CPU on its node, starving co-located workloads.',
    recommendation: 'Set resources.limits.cpu to cap worst-case usage.',
    owasp: 'OWASP K01: Insecure Workload Configurations',
  },
  RES_003: {
    ruleId: 'RES-003',
    title: 'No memory request',
    severity: 'Medium',
    category: 'Resource Management',
    description: 'resources.requests.memory is not set.',
    impact: 'The scheduler cannot reason about this container\'s memory footprint, risking poor bin-packing and node memory pressure.',
    recommendation: 'Set resources.requests.memory to a realistic baseline value.',
    owasp: 'OWASP K01: Insecure Workload Configurations',
  },
  RES_004: {
    ruleId: 'RES-004',
    title: 'No memory limit',
    severity: 'High',
    category: 'Resource Management',
    description: 'resources.limits.memory is not set.',
    impact: 'A memory leak or runaway process in this container can exhaust node memory, triggering the kernel OOM killer against unrelated workloads on the same node.',
    recommendation: 'Set resources.limits.memory to a value the application should never legitimately exceed.',
    owasp: 'OWASP K01: Insecure Workload Configurations',
  },
  RES_005: {
    ruleId: 'RES-005',
    title: 'No ephemeral storage limit',
    severity: 'Low',
    category: 'Resource Management',
    description: 'resources.limits["ephemeral-storage"] is not set.',
    impact: 'Uncontrolled log growth, temp files, or a filling emptyDir can exhaust the node\'s local disk, evicting other pods.',
    recommendation: 'Set resources.limits["ephemeral-storage"] to bound local disk usage.',
    owasp: 'OWASP K01: Insecure Workload Configurations',
  },
  OPS_001: {
    ruleId: 'OPS-001',
    title: 'No liveness probe',
    severity: 'Medium',
    category: 'Operational Best Practices',
    description: 'No livenessProbe is configured.',
    impact: 'A hung or deadlocked process will not be automatically detected and restarted, degrading availability silently.',
    recommendation: 'Configure a livenessProbe appropriate to the application (HTTP, TCP, or exec).',
    owasp: 'OWASP K01: Insecure Workload Configurations',
  },
  OPS_002: {
    ruleId: 'OPS-002',
    title: 'No readiness probe',
    severity: 'Medium',
    category: 'Operational Best Practices',
    description: 'No readinessProbe is configured.',
    impact: 'Traffic can be routed to the pod before it is actually able to serve requests, and it stays in rotation during transient downstream failures.',
    recommendation: 'Configure a readinessProbe appropriate to the application.',
    owasp: 'OWASP K01: Insecure Workload Configurations',
  },
  OPS_003: {
    ruleId: 'OPS-003',
    title: 'No startup probe',
    severity: 'Low',
    category: 'Operational Best Practices',
    description: 'No startupProbe is configured.',
    impact: 'For slow-starting applications, liveness/readiness probes may fire (and restart the container) before it has finished initializing.',
    recommendation: 'Add a startupProbe for applications with variable or slow startup time, to give them a longer initial grace period.',
    owasp: 'OWASP K01: Insecure Workload Configurations',
  },
  OPS_004: {
    ruleId: 'OPS-004',
    title: 'terminationGracePeriodSeconds not explicitly set',
    severity: 'Informational',
    category: 'Operational Best Practices',
    description: 'spec.terminationGracePeriodSeconds is not explicitly configured (falls back to the cluster default of 30s).',
    impact: 'Applications that need longer to drain in-flight work (or that shut down faster) get a one-size-fits-all grace period rather than one tuned to their behavior.',
    recommendation: 'Set terminationGracePeriodSeconds explicitly to a value that matches how long the application needs to shut down gracefully.',
    owasp: 'OWASP K01: Insecure Workload Configurations',
  },
  OPS_005: {
    ruleId: 'OPS-005',
    title: 'restartPolicy not appropriate for workload kind',
    severity: 'Medium',
    category: 'Operational Best Practices',
    description: 'Job/CronJob pod templates must set restartPolicy to OnFailure or Never — Always is not valid for run-to-completion workloads.',
    impact: 'A Job configured this way will be rejected by the API server, or (if bypassed) will never be recognized as complete.',
    recommendation: 'Set spec.template.spec.restartPolicy to OnFailure or Never.',
    owasp: 'OWASP K01: Insecure Workload Configurations',
  },
} as const satisfies Record<string, RuleDef>;

// ---------------------------------------------------------------------------
// Manifest shape helpers (deliberately loose — mirrors utils/manifestRecommendations.ts)
// ---------------------------------------------------------------------------

type Manifest = Record<string, any>;

const SENSITIVE_HOST_PATHS = [
  '/',
  '/etc',
  '/var/run/docker.sock',
  '/run/docker.sock',
  '/var/run',
  '/run',
  '/proc',
  '/root',
  '/boot',
  '/sys',
  '/home',
  '/var/lib/kubelet',
  '/etc/kubernetes',
];

const ALLOWED_BASELINE_CAPABILITIES = new Set([
  'AUDIT_WRITE',
  'CHOWN',
  'DAC_OVERRIDE',
  'FOWNER',
  'FSETID',
  'KILL',
  'MKNOD',
  'NET_BIND_SERVICE',
  'SETFCAP',
  'SETGID',
  'SETPCAP',
  'SETUID',
  'SYS_CHROOT',
]);

const CREDENTIAL_NAME_PATTERN = /PASSWORD|SECRET|TOKEN|API[-_]?KEY|PRIVATE[-_]?KEY|ACCESS[-_]?KEY|CREDENTIAL|PASSWD/i;

function effectiveSecurityField(podSpec: Manifest, container: Manifest, field: string): unknown {
  return container?.securityContext?.[field] ?? podSpec?.securityContext?.[field];
}

function parseImageRef(image: string): { hasDigest: boolean; tag?: string; registryQualified: boolean } {
  const hasDigest = image.includes('@sha256:');
  const withoutDigest = image.split('@')[0];
  const firstSlash = withoutDigest.indexOf('/');
  const beforeFirstSlash = firstSlash === -1 ? '' : withoutDigest.slice(0, firstSlash);
  const registryQualified = beforeFirstSlash.includes('.') || beforeFirstSlash.includes(':') || beforeFirstSlash === 'localhost';
  const pathAndTag = firstSlash === -1 ? withoutDigest : withoutDigest.slice(firstSlash + 1);
  const lastColon = pathAndTag.lastIndexOf(':');
  const tag = lastColon === -1 ? undefined : pathAndTag.slice(lastColon + 1);
  return { hasDigest, tag, registryQualified };
}

// ---------------------------------------------------------------------------
// Check engine
// ---------------------------------------------------------------------------

class Analyzer {
  findings: SecurityFinding[] = [];
  passed: PassedCheck[] = [];

  fail(rule: RuleDef, opts: { yamlPath: string; current: string; expected: string }) {
    this.findings.push({
      ...rule,
      yamlPath: opts.yamlPath,
      current: opts.current,
      expected: opts.expected,
      pointsDeducted: SEVERITY_POINTS[rule.severity],
    });
  }

  pass(rule: RuleDef) {
    this.passed.push({ ruleId: rule.ruleId, title: rule.title, category: rule.category });
  }
}

function checkContainerIdentity(a: Analyzer, podSpec: Manifest, container: Manifest, path: string) {
  const sc = container.securityContext;

  const runAsNonRoot = effectiveSecurityField(podSpec, container, 'runAsNonRoot');
  if (runAsNonRoot !== true) {
    a.fail(RULES.POD_001, { yamlPath: `${path}.securityContext.runAsNonRoot`, current: String(runAsNonRoot ?? 'not set'), expected: 'true' });
  } else {
    a.pass(RULES.POD_001);
  }

  const runAsUser = effectiveSecurityField(podSpec, container, 'runAsUser');
  if (runAsUser === undefined || runAsUser === null) {
    a.fail(RULES.POD_002, { yamlPath: `${path}.securityContext.runAsUser`, current: 'not set', expected: 'a fixed non-zero UID' });
  } else {
    a.pass(RULES.POD_002);
  }

  const runAsGroup = effectiveSecurityField(podSpec, container, 'runAsGroup');
  if (runAsGroup === undefined || runAsGroup === null) {
    a.fail(RULES.POD_003, { yamlPath: `${path}.securityContext.runAsGroup`, current: 'not set', expected: 'a fixed non-zero GID' });
  } else {
    a.pass(RULES.POD_003);
  }

  if (sc?.privileged === true) {
    a.fail(RULES.POD_004, { yamlPath: `${path}.securityContext.privileged`, current: 'true', expected: 'false' });
  } else {
    a.pass(RULES.POD_004);
  }

  if (sc?.allowPrivilegeEscalation !== false) {
    a.fail(RULES.POD_005, {
      yamlPath: `${path}.securityContext.allowPrivilegeEscalation`,
      current: String(sc?.allowPrivilegeEscalation ?? 'not set'),
      expected: 'false',
    });
  } else {
    a.pass(RULES.POD_005);
  }

  const drop: string[] = sc?.capabilities?.drop ?? [];
  const add: string[] = sc?.capabilities?.add ?? [];
  const dropsAll = drop.map((c) => c.toUpperCase()).includes('ALL');
  if (!dropsAll) {
    a.fail(RULES.POD_006, { yamlPath: `${path}.securityContext.capabilities.drop`, current: drop.length ? drop.join(', ') : 'not set', expected: '["ALL"]' });
  } else {
    a.pass(RULES.POD_006);
  }

  const addUpper = add.map((c) => c.toUpperCase());
  if (addUpper.includes('SYS_ADMIN')) {
    a.fail(RULES.POD_007, { yamlPath: `${path}.securityContext.capabilities.add`, current: add.join(', '), expected: 'SYS_ADMIN removed' });
  } else {
    a.pass(RULES.POD_007);
  }

  const excessive = addUpper.filter((c) => c !== 'SYS_ADMIN' && !ALLOWED_BASELINE_CAPABILITIES.has(c));
  if (excessive.length > 0) {
    a.fail(RULES.POD_008, { yamlPath: `${path}.securityContext.capabilities.add`, current: excessive.join(', '), expected: 'only capabilities strictly required (ideally none beyond NET_BIND_SERVICE)' });
  } else {
    a.pass(RULES.POD_008);
  }
}

function checkContainerRuntime(a: Analyzer, podSpec: Manifest, container: Manifest, path: string) {
  const seccompType = effectiveSecurityField(podSpec, container, 'seccompProfile') as { type?: string } | undefined;
  if (!seccompType?.type) {
    a.fail(RULES.RUN_001, { yamlPath: `${path}.securityContext.seccompProfile`, current: 'not set', expected: 'type: RuntimeDefault' });
  } else {
    a.pass(RULES.RUN_001);
    if (seccompType.type === 'Unconfined') {
      a.fail(RULES.RUN_002, { yamlPath: `${path}.securityContext.seccompProfile.type`, current: 'Unconfined', expected: 'RuntimeDefault or Localhost' });
    } else {
      a.pass(RULES.RUN_002);
    }
  }

  const appArmor = effectiveSecurityField(podSpec, container, 'appArmorProfile');
  if (!appArmor) {
    a.fail(RULES.RUN_003, { yamlPath: `${path}.securityContext.appArmorProfile`, current: 'not set', expected: 'type: RuntimeDefault (or a custom profile)' });
  } else {
    a.pass(RULES.RUN_003);
  }

  const seLinux = effectiveSecurityField(podSpec, container, 'seLinuxOptions');
  if (!seLinux) {
    a.fail(RULES.RUN_004, { yamlPath: `${path}.securityContext.seLinuxOptions`, current: 'not set', expected: 'a dedicated, restrictive SELinux type' });
  } else {
    a.pass(RULES.RUN_004);
  }
}

function checkContainerFilesystem(a: Analyzer, container: Manifest, path: string, hostPathVolumeNames: Set<string>) {
  const sc = container.securityContext;
  if (sc?.readOnlyRootFilesystem !== true) {
    a.fail(RULES.FS_001, { yamlPath: `${path}.securityContext.readOnlyRootFilesystem`, current: String(sc?.readOnlyRootFilesystem ?? 'not set'), expected: 'true' });
  } else {
    a.pass(RULES.FS_001);
  }

  const mounts: Manifest[] = container.volumeMounts ?? [];
  for (const mount of mounts) {
    if (!hostPathVolumeNames.has(mount.name)) continue;
    if (mount.readOnly !== true) {
      a.fail(RULES.FS_003, { yamlPath: `${path}.volumeMounts[name=${mount.name}].readOnly`, current: String(mount.readOnly ?? 'not set'), expected: 'true (or remove the hostPath volume)' });
    } else {
      a.pass(RULES.FS_003);
    }
  }
}

function isSensitiveHostPath(p: string): boolean {
  return SENSITIVE_HOST_PATHS.some((s) => p === s || p.startsWith(s + '/'));
}

function checkPodFilesystem(a: Analyzer, podSpec: Manifest, prefix: string): Set<string> {
  const volumes: Manifest[] = podSpec.volumes ?? [];
  const hostPathVolumes = volumes.filter((v) => v.hostPath);
  if (hostPathVolumes.length === 0) {
    a.pass(RULES.FS_002);
    a.pass(RULES.FS_004);
    return new Set();
  }
  for (const v of hostPathVolumes) {
    a.fail(RULES.FS_002, { yamlPath: `${prefix}.volumes[name=${v.name}].hostPath.path`, current: v.hostPath.path, expected: 'no hostPath volume' });
    if (isSensitiveHostPath(v.hostPath.path)) {
      a.fail(RULES.FS_004, { yamlPath: `${prefix}.volumes[name=${v.name}].hostPath.path`, current: v.hostPath.path, expected: 'do not mount sensitive host paths' });
    } else {
      a.pass(RULES.FS_004);
    }
  }
  return new Set(hostPathVolumes.map((v) => v.name));
}

function checkPodNetworking(a: Analyzer, podSpec: Manifest, containers: Manifest[], prefix: string) {
  if (podSpec.hostNetwork === true) {
    a.fail(RULES.NET_001, { yamlPath: `${prefix}.hostNetwork`, current: 'true', expected: 'false' });
  } else {
    a.pass(RULES.NET_001);
  }
  if (podSpec.hostPID === true) {
    a.fail(RULES.NET_002, { yamlPath: `${prefix}.hostPID`, current: 'true', expected: 'false' });
  } else {
    a.pass(RULES.NET_002);
  }
  if (podSpec.hostIPC === true) {
    a.fail(RULES.NET_003, { yamlPath: `${prefix}.hostIPC`, current: 'true', expected: 'false' });
  } else {
    a.pass(RULES.NET_003);
  }

  const hostPorts = containers.flatMap((c) => (c.ports ?? []).filter((p: Manifest) => p.hostPort));
  if (hostPorts.length > 0) {
    a.fail(RULES.NET_004, {
      yamlPath: `${prefix}.containers[*].ports[*].hostPort`,
      current: hostPorts.map((p: Manifest) => p.hostPort).join(', '),
      expected: 'no hostPort — expose via a Service instead',
    });
  } else {
    a.pass(RULES.NET_004);
  }

  // Cannot be verified from a single manifest — always surfaced as an informational finding.
  a.fail(RULES.NET_005, { yamlPath: `${prefix}`, current: 'unknown (cluster-scoped)', expected: 'a NetworkPolicy scoping this workload\'s traffic' });
}

function checkImage(a: Analyzer, container: Manifest, path: string) {
  const image: string | undefined = container.image;
  if (!image) return;
  const { hasDigest, tag, registryQualified } = parseImageRef(image);

  if (hasDigest) {
    a.pass(RULES.IMG_001);
  } else {
    a.fail(RULES.IMG_001, { yamlPath: `${path}.image`, current: image, expected: 'image@sha256:<digest>' });
  }

  if (!hasDigest && (!tag || tag === 'latest')) {
    a.fail(RULES.IMG_002, { yamlPath: `${path}.image`, current: image, expected: 'an explicit, immutable version tag' });
  } else {
    a.pass(RULES.IMG_002);
  }

  if (!registryQualified) {
    a.fail(RULES.IMG_003, { yamlPath: `${path}.image`, current: image, expected: 'an explicit, trusted registry host' });
  } else {
    a.pass(RULES.IMG_003);
  }

  // Always unverifiable from a static manifest.
  a.fail(RULES.IMG_004, { yamlPath: `${path}.image`, current: image, expected: 'confirmed minimal/distroless base image' });
  a.fail(RULES.IMG_005, { yamlPath: `${path}.image`, current: image, expected: 'signature verification enforced at admission' });
  a.fail(RULES.IMG_006, { yamlPath: `${path}.image`, current: image, expected: 'confirmed vulnerability scan with no unresolved Critical/High findings' });
}

function checkSecretsIdentity(a: Analyzer, podSpec: Manifest, containers: Manifest[], prefix: string) {
  const serviceAccountName = podSpec.serviceAccountName ?? podSpec.serviceAccount;
  if (!serviceAccountName || serviceAccountName === 'default') {
    a.fail(RULES.SEC_001, { yamlPath: `${prefix}.serviceAccountName`, current: serviceAccountName ?? 'not set (default)', expected: 'a dedicated ServiceAccount' });
  } else {
    a.pass(RULES.SEC_001);
  }

  if (podSpec.automountServiceAccountToken !== false) {
    a.fail(RULES.SEC_002, { yamlPath: `${prefix}.automountServiceAccountToken`, current: String(podSpec.automountServiceAccountToken ?? 'not set'), expected: 'false (unless the workload calls the Kubernetes API)' });
  } else {
    a.pass(RULES.SEC_002);
  }

  let sawEnvSecretRef = false;
  let sawPlaintextCredential = false;
  for (const c of containers) {
    for (const e of c.env ?? []) {
      if (e.valueFrom?.secretKeyRef) {
        sawEnvSecretRef = true;
        a.fail(RULES.SEC_003, { yamlPath: `${prefix}.containers[name=${c.name}].env[name=${e.name}].valueFrom.secretKeyRef`, current: `env var "${e.name}" from Secret "${e.valueFrom.secretKeyRef.name}"`, expected: 'mount the Secret as a volume instead' });
      }
      if (typeof e.value === 'string' && CREDENTIAL_NAME_PATTERN.test(e.name ?? '')) {
        sawPlaintextCredential = true;
        a.fail(RULES.SEC_004, { yamlPath: `${prefix}.containers[name=${c.name}].env[name=${e.name}].value`, current: `${e.name}=<plaintext value>`, expected: 'reference a Secret instead of a literal value' });
      }
    }
    for (const ef of c.envFrom ?? []) {
      if (ef.secretRef) {
        sawEnvSecretRef = true;
        a.fail(RULES.SEC_003, { yamlPath: `${prefix}.containers[name=${c.name}].envFrom.secretRef`, current: `entire Secret "${ef.secretRef.name}" injected as env vars`, expected: 'mount the Secret as a volume instead' });
      }
    }
  }
  if (!sawEnvSecretRef) a.pass(RULES.SEC_003);
  if (!sawPlaintextCredential) a.pass(RULES.SEC_004);
}

function checkResources(a: Analyzer, container: Manifest, path: string) {
  const requests = container.resources?.requests ?? {};
  const limits = container.resources?.limits ?? {};

  if (!requests.cpu) a.fail(RULES.RES_001, { yamlPath: `${path}.resources.requests.cpu`, current: 'not set', expected: 'a realistic CPU request' });
  else a.pass(RULES.RES_001);

  if (!limits.cpu) a.fail(RULES.RES_002, { yamlPath: `${path}.resources.limits.cpu`, current: 'not set', expected: 'a CPU limit' });
  else a.pass(RULES.RES_002);

  if (!requests.memory) a.fail(RULES.RES_003, { yamlPath: `${path}.resources.requests.memory`, current: 'not set', expected: 'a realistic memory request' });
  else a.pass(RULES.RES_003);

  if (!limits.memory) a.fail(RULES.RES_004, { yamlPath: `${path}.resources.limits.memory`, current: 'not set', expected: 'a memory limit' });
  else a.pass(RULES.RES_004);

  if (!limits['ephemeral-storage']) a.fail(RULES.RES_005, { yamlPath: `${path}.resources.limits.ephemeral-storage`, current: 'not set', expected: 'an ephemeral-storage limit' });
  else a.pass(RULES.RES_005);
}

function checkOperational(a: Analyzer, container: Manifest, path: string) {
  if (!container.livenessProbe) a.fail(RULES.OPS_001, { yamlPath: `${path}.livenessProbe`, current: 'not set', expected: 'a configured livenessProbe' });
  else a.pass(RULES.OPS_001);

  if (!container.readinessProbe) a.fail(RULES.OPS_002, { yamlPath: `${path}.readinessProbe`, current: 'not set', expected: 'a configured readinessProbe' });
  else a.pass(RULES.OPS_002);

  if (!container.startupProbe) a.fail(RULES.OPS_003, { yamlPath: `${path}.startupProbe`, current: 'not set', expected: 'a configured startupProbe (for slow-starting apps)' });
  else a.pass(RULES.OPS_003);
}

function checkPodOperational(a: Analyzer, kind: string, podSpec: Manifest, prefix: string) {
  if (podSpec.terminationGracePeriodSeconds === undefined) {
    a.fail(RULES.OPS_004, { yamlPath: `${prefix}.terminationGracePeriodSeconds`, current: 'not set (defaults to 30s)', expected: 'an explicit value tuned to this workload' });
  } else {
    a.pass(RULES.OPS_004);
  }

  if (kind === 'Job' || kind === 'CronJob') {
    const rp = podSpec.restartPolicy;
    if (rp !== 'OnFailure' && rp !== 'Never') {
      a.fail(RULES.OPS_005, { yamlPath: `${prefix}.restartPolicy`, current: rp ?? 'not set', expected: 'OnFailure or Never' });
    } else {
      a.pass(RULES.OPS_005);
    }
  }
}

function checkRbac(a: Analyzer, manifest: Manifest) {
  const rules: Manifest[] = manifest.rules ?? [];
  if (rules.length === 0) return;
  let sawWildcard = false;
  rules.forEach((rule, i) => {
    const wildcard =
      (rule.apiGroups ?? []).includes('*') || (rule.resources ?? []).includes('*') || (rule.verbs ?? []).includes('*');
    if (wildcard) {
      sawWildcard = true;
      a.fail(RULES.SEC_005, {
        yamlPath: `rules[${i}]`,
        current: JSON.stringify({ apiGroups: rule.apiGroups, resources: rule.resources, verbs: rule.verbs }),
        expected: 'explicit, minimal apiGroups/resources/verbs — no "*"',
      });
    }
  });
  if (!sawWildcard) a.pass(RULES.SEC_005);
}

// ---------------------------------------------------------------------------
// Pod Security Standards
// ---------------------------------------------------------------------------

function evaluatePodSecurityStandards(podSpec: Manifest, containers: Manifest[]): PodSecurityStandardsResult {
  const baselineViolations: string[] = [];
  const restrictedViolations: string[] = [];

  if (podSpec.hostNetwork) baselineViolations.push('hostNetwork is true');
  if (podSpec.hostPID) baselineViolations.push('hostPID is true');
  if (podSpec.hostIPC) baselineViolations.push('hostIPC is true');
  const hostPathVols = (podSpec.volumes ?? []).filter((v: Manifest) => v.hostPath);
  if (hostPathVols.length > 0) baselineViolations.push(`hostPath volume(s) present: ${hostPathVols.map((v: Manifest) => v.name).join(', ')}`);
  const hostPorts = containers.flatMap((c) => (c.ports ?? []).filter((p: Manifest) => p.hostPort));
  if (hostPorts.length > 0) baselineViolations.push('one or more containers define a hostPort');

  for (const c of containers) {
    const sc = c.securityContext;
    if (sc?.privileged) baselineViolations.push(`container "${c.name}" is privileged`);
    const add: string[] = (sc?.capabilities?.add ?? []).map((x: string) => x.toUpperCase());
    const disallowed = add.filter((cap) => !ALLOWED_BASELINE_CAPABILITIES.has(cap));
    if (disallowed.length > 0) baselineViolations.push(`container "${c.name}" adds disallowed capabilities: ${disallowed.join(', ')}`);
    const seccompType = effectiveSecurityField(podSpec, c, 'seccompProfile') as { type?: string } | undefined;
    if (seccompType?.type === 'Unconfined') baselineViolations.push(`container "${c.name}" runs with an Unconfined seccomp profile`);
  }

  for (const c of containers) {
    const sc = c.securityContext;
    const runAsNonRoot = effectiveSecurityField(podSpec, c, 'runAsNonRoot');
    if (runAsNonRoot !== true) restrictedViolations.push(`container "${c.name}" does not set runAsNonRoot=true`);
    if (sc?.allowPrivilegeEscalation !== false) restrictedViolations.push(`container "${c.name}" does not set allowPrivilegeEscalation=false`);
    const drop: string[] = (sc?.capabilities?.drop ?? []).map((x: string) => x.toUpperCase());
    if (!drop.includes('ALL')) restrictedViolations.push(`container "${c.name}" does not drop ALL capabilities`);
    const add: string[] = (sc?.capabilities?.add ?? []).map((x: string) => x.toUpperCase());
    const disallowedRestricted = add.filter((cap) => cap !== 'NET_BIND_SERVICE');
    if (disallowedRestricted.length > 0) restrictedViolations.push(`container "${c.name}" adds capabilities beyond NET_BIND_SERVICE: ${disallowedRestricted.join(', ')}`);
    const seccompType = effectiveSecurityField(podSpec, c, 'seccompProfile') as { type?: string } | undefined;
    if (seccompType?.type !== 'RuntimeDefault' && seccompType?.type !== 'Localhost') {
      restrictedViolations.push(`container "${c.name}" does not use a RuntimeDefault/Localhost seccomp profile`);
    }
    const runAsUser = effectiveSecurityField(podSpec, c, 'runAsUser');
    if (runAsUser === 0) restrictedViolations.push(`container "${c.name}" explicitly sets runAsUser: 0`);
  }

  return {
    privileged: { compliant: true, violations: [] },
    baseline: { compliant: baselineViolations.length === 0, violations: baselineViolations },
    restricted: { compliant: baselineViolations.length === 0 && restrictedViolations.length === 0, violations: [...baselineViolations, ...restrictedViolations] },
  };
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export function scoreToGrade(score: number): Grade {
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

export function scoreToRiskLevel(score: number): RiskLevel {
  if (score >= 90) return 'Low';
  if (score >= 70) return 'Moderate';
  if (score >= 60) return 'High';
  return 'Critical';
}

function buildExecutiveSummary(kind: string, score: number, grade: Grade, riskLevel: RiskLevel, findings: SecurityFinding[]): string {
  const criticalCount = findings.filter((f) => f.severity === 'Critical').length;
  const highCount = findings.filter((f) => f.severity === 'High').length;
  const byCategory = new Map<Category, number>();
  for (const f of findings) byCategory.set(f.category, (byCategory.get(f.category) ?? 0) + f.pointsDeducted);
  const topCategories = [...byCategory.entries()]
    .filter(([, pts]) => pts > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([cat]) => cat);

  if (criticalCount === 0 && highCount === 0) {
    return `This ${kind} scores ${score}/100 (${grade}), placing it at ${riskLevel} risk. No critical or high-severity issues were found; remaining gaps are lower-severity hardening opportunities${topCategories.length ? ` mostly in ${topCategories.join(' and ')}` : ''}.`;
  }
  return `This ${kind} scores ${score}/100 (${grade}), placing it at ${riskLevel} risk. ${criticalCount} critical and ${highCount} high-severity issue${criticalCount + highCount === 1 ? '' : 's'} were found, concentrated in ${topCategories.join(' and ') || 'multiple areas'}. These should be remediated before this workload is considered for a production cluster.`;
}

/** Runs the full Kubernetes Security Analyzer rule set against a parsed manifest. Returns
 * `applicable: false` for kinds this analyzer doesn't have a meaningful pod-spec or RBAC-based
 * assessment for. */
export function analyzeManifestSecurity(manifest: unknown): SecurityReport {
  if (!manifest || typeof manifest !== 'object') {
    return emptyReport(false, 'Enter a valid Kubernetes manifest (YAML or JSON) to analyze.');
  }
  const obj = manifest as Manifest;
  const kind: string | undefined = obj.kind;
  const name: string | undefined = obj.metadata?.name;

  if (kind === 'Role' || kind === 'ClusterRole') {
    const a = new Analyzer();
    checkRbac(a, obj);
    return finalizeReport(a, kind, name, undefined);
  }

  if (kind === 'ServiceAccount') {
    const a = new Analyzer();
    if (obj.automountServiceAccountToken !== false) {
      a.fail(RULES.SEC_002, { yamlPath: 'automountServiceAccountToken', current: String(obj.automountServiceAccountToken ?? 'not set'), expected: 'false (unless every consuming pod needs API access)' });
    } else {
      a.pass(RULES.SEC_002);
    }
    return finalizeReport(a, kind, name, undefined);
  }

  const workload: WorkloadPodSpec | undefined = resolveWorkloadPodSpec(obj);
  if (!workload || !workload.podSpec) {
    return emptyReport(
      false,
      `"${kind ?? 'this resource'}" doesn't define a pod template. The Security Analyzer evaluates Pod, Deployment, StatefulSet, DaemonSet, Job, CronJob, ReplicaSet, Role/ClusterRole, and ServiceAccount manifests.`,
    );
  }

  const { podSpec, yamlPrefix, kind: workloadKind } = workload;
  const containers: Manifest[] = podSpec.containers ?? [];
  const a = new Analyzer();

  const hostPathVolumeNames = checkPodFilesystem(a, podSpec, yamlPrefix);
  checkPodNetworking(a, podSpec, containers, yamlPrefix);
  checkSecretsIdentity(a, podSpec, containers, yamlPrefix);
  checkPodOperational(a, workloadKind, podSpec, yamlPrefix);

  containers.forEach((c, i) => {
    const path = `${yamlPrefix}.containers[${i}]${c.name ? ` (${c.name})` : ''}`;
    checkContainerIdentity(a, podSpec, c, path);
    checkContainerRuntime(a, podSpec, c, path);
    checkContainerFilesystem(a, c, path, hostPathVolumeNames);
    checkImage(a, c, path);
    checkResources(a, c, path);
    checkOperational(a, c, path);
  });

  if (containers.length === 0) {
    a.fail(
      { ...RULES.OPS_001, ruleId: 'OPS-000', title: 'No containers defined' },
      { yamlPath: `${yamlPrefix}.containers`, current: 'empty', expected: 'at least one container' },
    );
  }

  const pss = evaluatePodSecurityStandards(podSpec, containers);
  return finalizeReport(a, workloadKind, name, pss);
}

function emptyReport(applicable: boolean, message: string): SecurityReport {
  return {
    applicable,
    unsupportedMessage: message,
    score: 0,
    grade: 'F',
    riskLevel: 'Critical',
    findings: [],
    passedChecks: [],
    podSecurityStandards: {
      restricted: { compliant: false, violations: [] },
      baseline: { compliant: false, violations: [] },
      privileged: { compliant: true, violations: [] },
    },
    executiveSummary: message,
    remediationOrder: [],
    estimatedScoreAfterRemediation: 0,
    productionReady: false,
    admissionRecommended: false,
    topImprovements: [],
  };
}

function finalizeReport(a: Analyzer, kind: string | undefined, name: string | undefined, pss: PodSecurityStandardsResult | undefined): SecurityReport {
  const totalDeducted = a.findings.reduce((sum, f) => sum + f.pointsDeducted, 0);
  const score = Math.max(0, Math.min(100, 100 - totalDeducted));
  const grade = scoreToGrade(score);
  const riskLevel = scoreToRiskLevel(score);

  const remediationOrder = [...a.findings].sort((x, y) => SEVERITY_RANK[y.severity] - SEVERITY_RANK[x.severity] || y.pointsDeducted - x.pointsDeducted);

  const criticalCount = a.findings.filter((f) => f.severity === 'Critical').length;
  const highCount = a.findings.filter((f) => f.severity === 'High').length;

  const topImprovements: string[] = [];
  const seenTitles = new Set<string>();
  for (const f of remediationOrder) {
    if (seenTitles.has(f.title)) continue;
    seenTitles.add(f.title);
    topImprovements.push(f.title);
    if (topImprovements.length >= 5) break;
  }

  return {
    applicable: true,
    kind,
    name,
    score,
    grade,
    riskLevel,
    findings: a.findings,
    passedChecks: a.passed,
    podSecurityStandards:
      pss ?? {
        restricted: { compliant: false, violations: [] },
        baseline: { compliant: false, violations: [] },
        privileged: { compliant: true, violations: [] },
      },
    executiveSummary: buildExecutiveSummary(kind ?? 'workload', score, grade, riskLevel, a.findings),
    remediationOrder,
    estimatedScoreAfterRemediation: Math.min(100, score + totalDeducted),
    productionReady: (grade === 'A+' || grade === 'A' || grade === 'B') && criticalCount === 0,
    admissionRecommended: criticalCount === 0 && highCount === 0,
    topImprovements,
  };
}

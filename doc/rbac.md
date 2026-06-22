# Required RBAC

KubeXEye only reads from the Kubernetes API — it never writes, patches, or deletes resources.
The credentials you use (via `kubectl proxy` or a bearer token in Cluster Connection) need
`get` and `list` access to the resource types you want to view.

## Minimum required permissions

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: kubexeye-reader
rules:
  # Core workloads
  - apiGroups: [""]
    resources:
      - nodes
      - pods
      - pods/log
      - namespaces
      - events
      - configmaps
      - secrets
      - serviceaccounts
      - services
      - persistentvolumeclaims
      - persistentvolumes
    verbs: ["get", "list"]

  # Apps workloads
  - apiGroups: ["apps"]
    resources:
      - deployments
      - statefulsets
      - daemonsets
      - replicasets
    verbs: ["get", "list"]

  # Batch
  - apiGroups: ["batch"]
    resources:
      - jobs
      - cronjobs
    verbs: ["get", "list"]

  # Networking
  - apiGroups: ["networking.k8s.io"]
    resources:
      - ingresses
      - networkpolicies
    verbs: ["get", "list"]

  # Storage
  - apiGroups: ["storage.k8s.io"]
    resources:
      - storageclasses
    verbs: ["get", "list"]

  # RBAC inspection
  - apiGroups: ["rbac.authorization.k8s.io"]
    resources:
      - roles
      - rolebindings
      - clusterroles
      - clusterrolebindings
    verbs: ["get", "list"]

  # CRDs + CRD instances (Custom Resources page)
  - apiGroups: ["apiextensions.k8s.io"]
    resources:
      - customresourcedefinitions
    verbs: ["get", "list"]

  # Metrics (Dashboard gauges and Resource Analyser) — requires metrics-server
  - apiGroups: ["metrics.k8s.io"]
    resources:
      - nodes
      - pods
    verbs: ["get", "list"]
```

### CRD instances

The Custom Resources page fetches instances of whichever CRDs are installed. To see instances of a
specific CRD group (e.g. `argoproj.io`), add that group to the rule list:

```yaml
  - apiGroups: ["argoproj.io"]
    resources: ["*"]
    verbs: ["get", "list"]
```

### Helm Releases

Helm stores release state in `helm.sh/release.v1` Secrets in the release namespace. The Secrets
`get`/`list` rule above is sufficient — KubeXEye decodes the Helm metadata client-side.

### Pod logs

Pod log streaming requires `pods/log` get access (included above). If `pods/log` is omitted the
Logs tab on the pod detail panel will show a permission error.

## Binding the role

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: kubexeye-reader-binding
subjects:
  - kind: User
    name: your-username
    apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: ClusterRole
  name: kubexeye-reader
  apiGroup: rbac.authorization.k8s.io
```

Replace `your-username` with the user identity that `kubectl proxy` (or your bearer token) presents
to the API server. For service account tokens, change `kind: User` to `kind: ServiceAccount` and
add the `namespace` field.

## Scoped access

If you want to restrict KubeXEye to specific namespaces, use a `Role` + `RoleBinding` per
namespace instead of a `ClusterRole` + `ClusterRoleBinding`. Note that cluster-scoped resources
(nodes, namespaces, CRDs, ClusterRoles, ClusterRoleBindings, PersistentVolumes) are only visible
with cluster-level permissions regardless of namespace bindings.

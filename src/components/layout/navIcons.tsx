import {
  TachometerAltIcon,
  BellIcon,
  TopologyIcon,
  CubeIcon,
  ReplicatorIcon,
  ServerIcon,
  FolderIcon,
  HistoryIcon,
  ShareAltIcon,
  RouteIcon,
  ShieldAltIcon,
  DatabaseIcon,
  HddIcon,
  FileCodeIcon,
  KeyIcon,
  UserShieldIcon,
  LockIcon,
  PuzzlePieceIcon,
  PackageIcon,
  CogIcon,
  ImagesIcon,
  FlaskIcon,
} from '@patternfly/react-icons';
import type { SVGIconProps } from '@patternfly/react-icons/dist/esm/createIcon';
import type { ComponentClass } from 'react';

/** Kubernetes' own brand blue — used consistently for every nav/page icon and the logo. */
export const K8S_BLUE = '#326CE5';

export type NavIcon = ComponentClass<SVGIconProps>;

// Icon choices lean on names already idiomatic in the k8s/OpenShift console ecosystem where one
// exists — TopologyIcon is literally what the OpenShift console uses for its dependency-graph view,
// ReplicatorIcon names the ReplicaSet/replication-controller concept behind Deployments, PackageIcon
// matches Helm's own "the package manager for Kubernetes" framing, RouteIcon mirrors the
// Ingress/Route concept, etc.
export const NAV_ICONS = {
  dashboard: TachometerAltIcon,
  panic: BellIcon,
  dependencyMap: TopologyIcon,
  pods: CubeIcon,
  images: ImagesIcon,
  workloads: ReplicatorIcon,
  nodes: ServerIcon,
  namespaces: FolderIcon,
  events: HistoryIcon,
  services: ShareAltIcon,
  ingress: RouteIcon,
  networkPolicies: ShieldAltIcon,
  pvc: DatabaseIcon,
  storageClasses: HddIcon,
  configMaps: FileCodeIcon,
  secrets: KeyIcon,
  serviceAccounts: UserShieldIcon,
  rbac: LockIcon,
  customResources: PuzzlePieceIcon,
  helmReleases: PackageIcon,
  resourceAnalyser: FlaskIcon,
  settings: CogIcon,
} satisfies Record<string, NavIcon>;

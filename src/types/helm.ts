export interface HelmReleaseInfo {
  name: string;
  namespace: string;
  revision: number;
  status: string;
  chartName: string;
  chartVersion: string;
  appVersion?: string;
  description?: string;
  lastDeployed?: string;
  /** User-supplied values (-f/--set) used at install/upgrade — not the chart's full computed values.yaml. */
  values: Record<string, unknown>;
}

import type { ResourceRef } from '../graph/types';

export type IssueSeverity = 'Critical' | 'High' | 'Medium' | 'Low';
export type IssueCategory = 'Node' | 'Workload' | 'Pod' | 'Storage' | 'Dependency';

export interface PanicIssue {
  id: string;
  severity: IssueSeverity;
  category: IssueCategory;
  title: string;
  detail?: string;
  /** Present for anything that's a node in the dependency graph — lets the UI deep-link to it. */
  ref?: ResourceRef;
  /** Rough estimate of how many other resources are affected (e.g. pods on a dead node, dependents of a missing ConfigMap). */
  blastRadius: number;
}

export const SEVERITY_WEIGHT: Record<IssueSeverity, number> = {
  Critical: 4,
  High: 3,
  Medium: 2,
  Low: 1,
};

import type { K8sSecret } from '../types/k8s';

/** Replaces every secret value with a placeholder, keeping keys/type/metadata — values are never decoded or shown. */
export function redactSecretForDisplay(secret: K8sSecret): K8sSecret {
  if (!secret.data) return secret;
  const redactedData = Object.fromEntries(Object.keys(secret.data).map((key) => [key, '<redacted>']));
  return { ...secret, data: redactedData };
}

import { describe, it, expect } from 'vitest';
import { redactSecretForDisplay } from './redact';
import type { K8sSecret } from '../types/k8s';

describe('redactSecretForDisplay', () => {
  it('replaces every value with a placeholder while keeping the keys', () => {
    const secret: K8sSecret = {
      metadata: { name: 'db-creds', namespace: 'default' },
      type: 'Opaque',
      data: { username: 'YWRtaW4=', password: 'czNjcjN0' },
    };

    const redacted = redactSecretForDisplay(secret);

    expect(Object.keys(redacted.data ?? {})).toEqual(['username', 'password']);
    expect(redacted.data?.username).toBe('<redacted>');
    expect(redacted.data?.password).toBe('<redacted>');
  });

  it('never mutates the original secret object', () => {
    const secret: K8sSecret = {
      metadata: { name: 'db-creds', namespace: 'default' },
      data: { password: 'czNjcjN0' },
    };

    redactSecretForDisplay(secret);

    expect(secret.data?.password).toBe('czNjcjN0');
  });

  it('passes through secrets with no data untouched', () => {
    const secret: K8sSecret = { metadata: { name: 'empty', namespace: 'default' } };
    expect(redactSecretForDisplay(secret)).toBe(secret);
  });
});

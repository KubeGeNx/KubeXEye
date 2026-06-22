import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';

export interface ConnectionConfig {
  /** Base URL the browser calls. Defaults to the Vite dev proxy at /k8s-api. */
  apiBase: string;
  /** Optional bearer token, needed when connecting straight to an API server (skip when using `kubectl proxy`). */
  token: string;
  /** Kubeconfig context to target, forwarded as the X-Kube-Context header. Undefined/empty
   * means "the kube-proxy's current-context" (unchanged single-cluster behavior). */
  context?: string;
}

const STORAGE_KEY = 'kubexeye.connection';

function loadConfig(): ConnectionConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as ConnectionConfig;
  } catch {
    // ignore corrupt storage
  }
  return { apiBase: '/k8s-api', token: '' };
}

interface ConnectionContextValue {
  config: ConnectionConfig;
  setConfig: (config: ConnectionConfig) => void;
}

const ConnectionContext = createContext<ConnectionContextValue | null>(null);

export const ConnectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfigState] = useState<ConnectionConfig>(loadConfig);

  const setConfig = useCallback((next: ConnectionConfig) => {
    setConfigState(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const value = useMemo(() => ({ config, setConfig }), [config, setConfig]);

  return <ConnectionContext.Provider value={value}>{children}</ConnectionContext.Provider>;
};

export function useConnection(): ConnectionContextValue {
  const ctx = useContext(ConnectionContext);
  if (!ctx) throw new Error('useConnection must be used within ConnectionProvider');
  return ctx;
}

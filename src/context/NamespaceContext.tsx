import React, { createContext, useContext, useMemo, useState } from 'react';

export const ALL_NAMESPACES = '__all__';

interface NamespaceContextValue {
  namespace: string;
  setNamespace: (ns: string) => void;
}

const NamespaceContext = createContext<NamespaceContextValue | null>(null);

export const NamespaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [namespace, setNamespace] = useState<string>(ALL_NAMESPACES);
  const value = useMemo(() => ({ namespace, setNamespace }), [namespace]);
  return <NamespaceContext.Provider value={value}>{children}</NamespaceContext.Provider>;
};

export function useNamespace(): NamespaceContextValue {
  const ctx = useContext(NamespaceContext);
  if (!ctx) throw new Error('useNamespace must be used within NamespaceProvider');
  return ctx;
}

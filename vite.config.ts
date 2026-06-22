import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Dev-time proxy so the browser can talk to the Kubernetes API server without hitting CORS or
// cert-trust issues. Defaults to the bundled kube-proxy replacement (`npm run server` / `make
// proxy`, server/proxyServer.ts), which reads the local kubeconfig directly via
// @kubernetes/client-node — no `kubectl` binary required. KUBE_PROXY_TARGET can still point at
// plain `kubectl proxy` or any other already-authenticated endpoint instead.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.KUBE_PROXY_TARGET || 'http://localhost:8001';

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/k8s-api': {
          target,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/k8s-api/, ''),
        },
      },
    },
  };
});

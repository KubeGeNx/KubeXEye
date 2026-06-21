import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Dev-time proxy so the browser can talk to the Kubernetes API server
// without hitting CORS. Point KUBE_PROXY_TARGET at `kubectl proxy`
// (default http://localhost:8001) or directly at an API server.
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

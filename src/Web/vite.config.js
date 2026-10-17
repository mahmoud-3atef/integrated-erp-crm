import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
// Dev: the API runs on :5080 and Vite proxies /api so the browser sees one origin (session cookie works).
// Build: output goes to the API host's wwwroot and is served from the same origin in every environment.
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        strictPort: true,
        proxy: { '/api': { target: 'http://localhost:5080', changeOrigin: false } },
    },
    build: {
        outDir: '../Hosts/IntegratedErp.Api/wwwroot',
        emptyOutDir: true,
        sourcemap: false,
    },
    test: {
        environment: 'jsdom',
        globals: true,
    },
});

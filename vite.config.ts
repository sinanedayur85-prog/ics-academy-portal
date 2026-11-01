import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'disable-vite-hmr-ws',
        enforce: 'post',
        transform(code, id) {
          if (id.includes('vite/dist/client/client.mjs')) {
            return code
              .replace('console.debug("[vite] connecting...");', '')
              .replace('transport.connect(createHMRHandler(handleMessage));', '')
              .replace('setupForwardConsoleHandler(transport, forwardConsole);', '');
          }
          return null;
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
        'next/image': path.resolve(import.meta.dirname, './shims/next-image.tsx'),
        'next/link': path.resolve(import.meta.dirname, './shims/next-link.tsx'),
      },
    },
    server: {
      // HMR is disabled in AI Studio preview environments.
      hmr: false,
      ws: false,
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

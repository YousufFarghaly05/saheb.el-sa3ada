import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

function disableHmrClientWebSocketPlugin(): Plugin {
  let disabled = false;
  return {
    name: 'disable-hmr-client-websocket',
    apply: 'serve',
    enforce: 'post',
    configResolved(config) {
      disabled = config.server.hmr === false || config.server.ws === false;
    },
    transform(code, id) {
      if (!disabled) return;
      if (id.includes('vite/dist/client/client.mjs') || id.includes('@vite/client')) {
        return code
          .replace(
            'transport.connect(createHMRHandler(handleMessage));',
            '/* WebSocket disabled (HMR off) */'
          )
          .replace(
            'else throw new SendBeforeConnectError("send was called before connect");',
            'else return;'
          )
          .replace(
            'else throw new SendBeforeConnectError("invoke was called before connect");',
            'else return;'
          )
          .replace(
            'wsTransport.send(data);',
            'try { wsTransport.send(data); } catch {}'
          );
      }
      if (id.includes('pwa-entry-point-loaded')) {
        return code.replace(
          "import.meta.hot.send('vite-pwa-plugin:dev-ready');",
          "if (import.meta.hot) { Promise.resolve(import.meta.hot.send('vite-pwa-plugin:dev-ready')).catch(() => {}); }"
        );
      }
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      disableHmrClientWebSocketPlugin(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'icon.svg',
          'icon-maskable.svg',
          'apple-touch-icon.png',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
        ],
        manifest: {
          id: '/',
          name: 'مطعم وكافيه صاحب السعادة | Saheb El-Saada',
          short_name: 'صاحب السعادة',
          description:
            'القائمة الرقمية التفاعلية وحجوزات مطعم وكافيه صاحب السعادة مع دعم التصفح بدون إنترنت.',
          theme_color: '#121212',
          background_color: '#121212',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          lang: 'ar',
          dir: 'rtl',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp,woff,woff2}'],
          globIgnores: ['**/Moez_Menu_*', '**/*.pdf'],
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//, /^\/uploads\//],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          runtimeCaching: [
            {
              urlPattern: /\/api\/store/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'restaurant-store-api',
                networkTimeoutSeconds: 3,
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 7,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 15,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /\/(?:assets|uploads)\/.*\.(?:png|jpg|jpeg|webp|svg|gif)$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'restaurant-media-cache',
                expiration: {
                  maxEntries: 120,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
          navigateFallback: 'index.html',
          resolveTempFolder: () => path.resolve(__dirname, 'node_modules/.vite-pwa'),
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: false as const,
      ws: false as const,
      watch: null,
    },
  };
});

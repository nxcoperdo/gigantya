import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    // ─── PWA instalable ────────────────────────────────────────────────
    // Genera el service worker (Workbox) + manifest para que Gigantya se
    // pueda instalar en el celular y abrir en pantalla completa.
    //
    // registerType 'prompt': NO recarga solo. Cuando hay una versión nueva
    // se avisa al usuario con un toast (PWAUpdatePrompt) y él decide cuándo
    // actualizar. Clave en una app de pedidos: no queremos recargar a
    // alguien a mitad de un checkout.
    VitePWA({
      registerType: 'prompt',
      // Assets estáticos que van al precache además de los del build.
      includeAssets: ['favicon.jpg', 'apple-touch-icon.png', 'robots.txt'],
      manifest: {
        name: 'Gigantya — Pedidos a Domicilio en Gigante',
        short_name: 'Gigantya',
        description:
          'Pedí comida, panadería, mercados y más a domicilio en Gigante, Huila. Locales de tu pueblo con envío a tu casa.',
        lang: 'es-CO',
        dir: 'ltr',
        theme_color: '#c94b3b',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        categories: ['food', 'shopping'],
        icons: [
          { src: 'icons/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell: precachea el JS/CSS/HTML del build para arranque offline.
        globPatterns: ['**/*.{js,css,html,ico,png,jpg,svg,woff2}'],
        // SPA: cualquier navegación desconocida cae en index.html...
        navigateFallback: '/index.html',
        // ...MENOS el API, los sockets y los archivos servidos por el backend.
        // Nunca queremos que el SW sirva un index.html en lugar de una
        // respuesta real del API (menús, precios, estado del pedido).
        navigateFallbackDenylist: [/^\/api/, /^\/socket\.io/, /^\/uploads/, /^\/media/],
        // Imágenes de productos/locales/banners: cache-first (cambian poco
        // y pesan). El API NO se cachea en ningún caso.
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.pathname.startsWith('/uploads') || url.pathname.startsWith('/media'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'gigantya-imagenes',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
              // statuses [0, 200]: 0 permite respuestas opacas (cross-origin).
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        cleanupOutdatedCaches: true,
      },
      // Sin SW en `npm run dev` para no ensuciar el flujo de desarrollo
      // (hot-reload + service worker se pelean). Solo se activa en build.
      devOptions: { enabled: false },
    }),
  ],
  server: {
    port: 5173,
    // `host: true` permite acceder desde otras IPs de la red local
    // (ej. http://192.168.x.x:5173 desde un celular en la misma WiFi).
    // Útil para probar Places/Maps en dispositivos móviles sin desplegar.
    host: true,
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // Compresión moderna (gzip + brotli ready)
    cssCodeSplit: true,
    // Eliminar console.log y debugger en producción
    minify: 'esbuild',
    // Chunks manuales para mejor caching
    rollupOptions: {
      output: {
        // Separar dependencias de vendor en su propio chunk (mejora cache)
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'icons-vendor': ['lucide-react'],
          'http-vendor': ['axios', 'socket.io-client'],
        },
        // Nombres de chunks con hash basado en contenido (mejor cache busting)
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: ({ name }) => {
          if (name.endsWith('.css')) return 'assets/css/[name]-[hash][extname]'
          if (/\.(png|jpe?g|gif|svg|webp|avif)$/.test(name)) return 'assets/images/[name]-[hash][extname]'
          if (/\.(woff2?|ttf|eot)$/.test(name)) return 'assets/fonts/[name]-[hash][extname]'
          return 'assets/[name]-[hash][extname]'
        }
      }
    },
    // Umbral para generar chunks (aumentado para reducir requests en producción)
    chunkSizeWarningLimit: 600,
    // Targer ES2018 (soporte amplio + features modernas)
    target: 'es2018'
  },
  // Optimizar dependencias en dev
  optimizeDeps: {
    // react-rnd y re-resizable referencian `process.env.NODE_ENV` en runtime.
    // Incluirlas aquí fuerza a Vite a pre-bundlearlas con esbuild, que sí
    // reemplaza esos accesos por shims que no rompen en el navegador.
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'axios',
      'lucide-react',
      'socket.io-client',
      'react-rnd',
      're-resizable',
    ]
  },
  esbuild: {
    // Eliminar console.log y debugger solo en producción
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : []
  }
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
    // Incluirlas acá fuerza a Vite a pre-bundlearlas con esbuild, que sí
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

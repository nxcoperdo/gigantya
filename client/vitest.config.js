import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    // Excluir los specs de Playwright del runner de vitest. Esos tests
    // usan la API `test` de @playwright/test (no la de vitest) y solo
    // funcionan con `npx playwright test`. Si los dejamos entrar aquí,
    // vitest intenta ejecutar `test(...)` fuera del contexto de Playwright
    // y tira "did not expect test() to be called here".
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/tests/e2e/**',
    ],
  },
});

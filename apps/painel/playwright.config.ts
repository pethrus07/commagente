import { defineConfig, devices } from '@playwright/test'

// E2E do painel — roda contra o app já servido (dev :5173 com proxy /api → API :3000).
// Pré-requisitos p/ rodar local:
//   1) DB up + migrações aplicadas (docker + `prisma migrate deploy`)
//   2) API:  cd apps/api    && npm run dev        (IA_PROVIDER=duble → sem OpenAI)
//   3) Painel: cd apps/painel && npm run dev
//   4) Browsers: PLAYWRIGHT_BROWSERS_PATH apontando p/ o ms-playwright (reuso do qa-parresia)
// Login usado nos testes: demo@zapagente.local / demo123 (semeado fora de produção).
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 40_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'off',
    actionTimeout: 10_000,
  },
  // Desktop e Mobile — as duas formas de uso que importam pro produto.
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],
})

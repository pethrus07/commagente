// Configuração da suíte E2E de fluxo. Roda em SÉRIE e com 1 worker de propósito: os testes
// compartilham o banco de desenvolvimento e a mesma sessão, então paralelismo geraria
// interferência entre eles, não velocidade.
import { defineConfig, devices } from '@playwright/test'

// QA E2E do Commagente — dirige o painel (:5173), que fala com a API (:3000) via proxy do Vite.
export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.ts',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // compartilham DB de dev + sessão → serial
  workers: 1,
  // toasts têm auto-dismiss e podem empilhar (UI de timing) → 2 retries absorvem flakes transientes
  retries: 2,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    locale: 'pt-BR',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 10_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})

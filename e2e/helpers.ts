import { test as base, expect, type Page } from '@playwright/test'

// Fixture que coleta exceções de runtime (pageerror) durante o teste — sinal forte de QA.
export const test = base.extend<{ erros: string[] }>({
  erros: async ({ page }, use) => {
    const erros: string[] = []
    page.on('pageerror', (e) => erros.push(String(e)))
    await use(erros)
  },
})
export { expect }

// clica um item do menu lateral pelo rótulo
export async function irPara(page: Page, label: string) {
  await page.locator('aside').getByRole('button', { name: label }).first().click()
}

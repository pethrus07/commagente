import { test, expect } from '@playwright/test'
import { login, navegar } from './helpers'

// Confere o tema CLARO (só faz sentido no desktop — o toggle mora na sidebar).
test('tema claro: dashboard, DNA e campanhas', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'checagem de tema no desktop')
  await login(page)
  await page.getByRole('button', { name: /Tema claro/ }).click()
  await expect(page.getByText('Missões ativas')).toBeVisible() // espera o conteúdo assentar
  await page.screenshot({ path: 'e2e/__screens__/light/dashboard.png', fullPage: true })
  await navegar(page, 'DNA')
  await expect(page.getByText('Força do DNA')).toBeVisible()
  await page.screenshot({ path: 'e2e/__screens__/light/dna.png', fullPage: true })
  await navegar(page, 'Campanhas')
  await expect(page.getByRole('button', { name: /Nova campanha/ }).first()).toBeVisible()
  await page.waitForTimeout(200)
  await page.screenshot({ path: 'e2e/__screens__/light/campanhas.png', fullPage: true })
})

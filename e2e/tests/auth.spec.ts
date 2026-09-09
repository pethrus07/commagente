// E2E: autenticação e o que cada PAPEL enxerga — credencial errada não entra, o admin de
// tenant não vê a aba Tenants e o super-admin vê. É o teste de isolamento visto pela UI.
import { test, expect } from '../helpers'

// Login/logout via UI (sem storageState — testa o fluxo de verdade).
test.describe('Autenticação', () => {
  test('login inválido não entra e mostra erro', async ({ page }) => {
    await page.goto('/')
    await page.getByPlaceholder('voce@empresa.com').fill('naoexiste@zapagente.local')
    await page.getByPlaceholder('••••••••').fill('senhaerrada')
    await page.getByRole('button', { name: 'Entrar' }).click()
    // continua na tela de login (não autenticou)
    await expect(page.getByPlaceholder('voce@empresa.com')).toBeVisible()
    // aparece um toast de erro
    await expect(page.getByText(/expirad|inválid|incorret|erro|senha/i).first()).toBeVisible()
  })

  test('tenant demo entra, vê o Dashboard e NÃO vê Tenants', async ({ page }) => {
    await page.goto('/')
    await page.getByPlaceholder('voce@empresa.com').fill('demo@zapagente.local')
    await page.getByPlaceholder('••••••••').fill('demo123')
    await page.getByRole('button', { name: 'Entrar' }).click()
    // 1º acesso (UX nova): aceite de termos bloqueia até aceitar — só aparece até aceitar
    const btnAceitar = page.getByRole('button', { name: 'Aceitar e continuar' })
    await btnAceitar.or(page.getByRole('heading', { name: 'Dashboard', level: 1 })).first().waitFor()
    if (await btnAceitar.isVisible()) {
      await expect(page.getByRole('heading', { name: /termos de uso/i })).toBeVisible()
      await page.getByRole('checkbox').check()
      await btnAceitar.click()
    }
    await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible()
    await expect(page.locator('aside').getByRole('button', { name: 'Tenants' })).toHaveCount(0)
    // logout volta pro login
    await page.getByTitle('Sair').click()
    await expect(page.getByPlaceholder('voce@empresa.com')).toBeVisible()
  })

  test('super-admin entra e vê Tenants', async ({ page }) => {
    await page.goto('/')
    await page.getByPlaceholder('voce@empresa.com').fill('admin@zapagente.local')
    await page.getByPlaceholder('••••••••').fill('zapagente123')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.locator('aside').getByRole('button', { name: 'Tenants' })).toBeVisible()
  })
})

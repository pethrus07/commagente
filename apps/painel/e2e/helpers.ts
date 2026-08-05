import { type Page, expect } from '@playwright/test'

export const LOGIN = { email: 'demo@zapagente.local', senha: 'demo123' }

// Faz login e espera cair no Dashboard.
export async function login(page: Page, email = LOGIN.email, senha = LOGIN.senha) {
  await page.goto('/')
  await page.locator('input[type=email]').fill(email)
  await page.locator('input[type=password]').fill(senha)
  await page.getByRole('button', { name: 'Entrar' }).click()
  // 1º acesso de tenant → modal de termos bloqueia o painel; aceita.
  const termos = page.getByRole('heading', { name: /termos de uso/i })
  if (await termos.isVisible({ timeout: 4000 }).catch(() => false)) {
    await page.locator('input[type=checkbox]').first().check()
    await page.getByRole('button', { name: /Aceitar e continuar/ }).click()
  }
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
}

// No mobile a sidebar é um drawer — abre pelo hambúrguer antes de navegar. No desktop, no-op.
export async function abrirMenuSeMobile(page: Page) {
  const menu = page.getByRole('button', { name: 'Abrir menu' })
  if (await menu.isVisible().catch(() => false)) {
    await menu.click()
    await page.waitForTimeout(250) // animação do drawer
  }
}

// Navega por uma aba da sidebar pelo rótulo.
export async function navegar(page: Page, rotulo: string | RegExp) {
  await abrirMenuSeMobile(page)
  await page.getByRole('button', { name: rotulo }).first().click()
}

// nome de arquivo seguro a partir do rótulo (Missões → missoes)
export const slug = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()

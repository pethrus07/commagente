import { test, expect } from '@playwright/test'
import { login, navegar } from './helpers'

const shot = (info: { project: { name: string } }, nome: string) =>
  `e2e/__screens__/${info.project.name}/x-${nome}.png`.replace(/\.png\.png$/, '.png')

test('DNA: lista clicável abre o editor focado de categoria', async ({ page }, info) => {
  await login(page)
  await navegar(page, 'DNA')
  await expect(page.getByText('Força do DNA')).toBeVisible()
  await page.getByRole('button', { name: /A empresa/ }).first().click()
  // modal do editor de categoria (textarea + anexar documento + colar link)
  await expect(page.getByRole('heading', { name: 'A empresa' })).toBeVisible()
  await expect(page.getByRole('button', { name: /anexar documento/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /colar link/ })).toBeVisible()
  await page.screenshot({ path: shot(info, 'dna-editor-categoria.png') })
})

test('Campanha: builder mostra o DNA por categoria (3 modos) + a biblioteca', async ({ page }, info) => {
  await login(page)
  await navegar(page, 'Campanhas')
  await page.getByRole('button', { name: /Nova campanha/ }).first().click()
  await expect(page.getByRole('heading', { name: 'Nova campanha' })).toBeVisible()
  // expande o "DNA desta campanha" (§9 Fase B)
  await page.getByRole('button', { name: /DNA desta campanha/ }).click()
  await page.waitForTimeout(250)
  // aparece o toggle Herdar/Combinar/Substituir por categoria
  await expect(page.getByRole('button', { name: 'Substituir' }).first()).toBeVisible()
  // e o seletor de mídia da campanha
  await expect(page.getByText(/Mídias da campanha/)).toBeVisible()
  await page.screenshot({ path: shot(info, 'campanha-builder-dna-midia.png'), fullPage: true })
})

test('mobile: hambúrguer abre o drawer da sidebar', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'só faz sentido no mobile')
  await login(page)
  await page.getByRole('button', { name: 'Abrir menu' }).click()
  await page.waitForTimeout(300)
  await expect(page.getByText('assistente WhatsApp')).toBeVisible()
  await page.screenshot({ path: shot(info, 'mobile-drawer.png') })
})

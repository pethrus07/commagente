// E2E do painel: as interações que o smoke não cobre — wizards, editores e o drawer do celular.
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

test('Campanha: wizard em passos (Definição → Personalização → Contatos)', async ({ page }, info) => {
  await login(page)
  // pré-requisito: um número. Cria via API se o tenant não tiver nenhum (idempotente entre projetos).
  const token = await page.evaluate(() => localStorage.getItem('zap_token'))
  const auth = { authorization: `Bearer ${token}` }
  const ns = await (await page.request.get('/api/numeros', { headers: auth })).json().catch(() => [])
  if (!Array.isArray(ns) || ns.length === 0) {
    await page.request.post('/api/numeros', { headers: auth, data: { telefone: '5599000009999', apelido: 'E2E' } })
  }

  await navegar(page, 'Campanhas')
  await page.getByRole('button', { name: /Nova campanha/ }).first().click()
  await expect(page.getByRole('heading', { name: 'Nova campanha' })).toBeVisible()
  // passo 1 — Modelo (mesmo padrão do assistente de missão)
  await expect(page.getByText('Modelo', { exact: true })).toBeVisible()
  await expect(page.getByText('Ajustar', { exact: true })).toBeVisible()
  await page.screenshot({ path: shot(info, 'campanha-wizard-1-modelo'), fullPage: true })
  await page.getByRole('button', { name: /Prospecção/ }).click() // escolhe um modelo → vai pro Ajustar

  // passo 2 — Ajustar: nome + config (objetivo pré-preenchido) + mídia + DNA + perfil
  await page.getByPlaceholder(/Cobrança julho/).fill('Campanha E2E')
  await expect(page.getByText(/Mídias da campanha/)).toBeVisible()
  await page.getByRole('button', { name: /DNA desta campanha/ }).click()
  await expect(page.getByRole('button', { name: 'Substituir' }).first()).toBeVisible()
  await page.screenshot({ path: shot(info, 'campanha-wizard-2-ajustar'), fullPage: true })
  await page.getByRole('button', { name: 'Avançar' }).click()

  // passo 3 — contatos + resumo
  await expect(page.getByText('Resumo')).toBeVisible()
  await page.screenshot({ path: shot(info, 'campanha-wizard-3-contatos'), fullPage: true })
})

test('mobile: hambúrguer abre o drawer da sidebar', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'só faz sentido no mobile')
  await login(page)
  await page.getByRole('button', { name: 'Abrir menu' }).click()
  await page.waitForTimeout(300)
  await expect(page.getByText('assistente WhatsApp')).toBeVisible()
  await page.screenshot({ path: shot(info, 'mobile-drawer.png') })
})

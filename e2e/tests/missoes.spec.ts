import { test, expect, irPara } from '../helpers'

test.use({ storageState: '.auth/super.json' })

// Cria uma missão pelo ASSISTENTE (wizard 3 passos + modelo pronto).
// A missão nasce 'configurada' (NÃO dispara envio/OpenAI) → seguro pro QA.
test('assistente cria missão a partir de um modelo', async ({ page, erros }) => {
  await page.goto('/')
  await irPara(page, 'Missões')
  await page.getByRole('button', { name: 'Nova missão' }).first().click()

  // passo 1 — modelo
  await expect(page.getByRole('heading', { name: 'Assistente de missão' })).toBeVisible()
  await page.getByText('Prospecção (lead novo)').click()

  // passo 2 — objetivo veio pré-preenchido pelo modelo
  await expect(page.getByText('Objetivo — o que a IA deve alcançar')).toBeVisible()
  await page.getByRole('button', { name: 'Avançar' }).click()

  // passo 3 — cola 1 contato QA e cria
  await page.getByPlaceholder('5583999998888, Fornecedor A').fill('5599000010003, QA Missao Prospec')
  await page.getByRole('button', { name: 'Criar missão' }).click()

  await expect(page.getByText(/Missão criada|missões criadas/)).toBeVisible()
  // o card aparece no board (coluna Configurada), com o nome do contato
  // .first(): missões QA podem se acumular no DB de dev entre runs (nome não é único)
  await expect(page.getByText('QA Missao Prospec').first()).toBeVisible()
  expect(erros, erros.join('\n')).toEqual([])
})

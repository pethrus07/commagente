import { test, expect, irPara } from '../helpers'

test.use({ storageState: '.auth/super.json' })

// Feature nova (27/07): Identidade da IA (persona no nível do tenant) na tela Conhecimento.
// Define a voz da marca uma vez → toda missão herda no prompt.
test('define a Identidade da IA (persona) e salva', async ({ page, erros }) => {
  await page.goto('/')
  await irPara(page, 'Conhecimento')

  await expect(page.getByRole('heading', { name: 'Identidade da IA' })).toBeVisible()
  const ta = page.getByPlaceholder(/Você é o atendente/)
  await ta.fill('Você é a Bia, atende de forma informal e trata por você.')
  // um chip de sugestão adiciona texto à identidade
  await page.getByRole('button', { name: /Use no máximo 1 emoji/ }).click()
  await expect(ta).toHaveValue(/1 emoji/)

  await page.getByRole('button', { name: 'Salvar identidade' }).click()
  await expect(page.getByText(/Identidade da IA salva/)).toBeVisible()

  // persiste: recarrega (a rota é por estado → volta pro Dashboard) e reabre Conhecimento
  await page.reload()
  await irPara(page, 'Conhecimento')
  await expect(page.getByPlaceholder(/Você é o atendente/)).toHaveValue(/Bia/)

  expect(erros, erros.join('\n')).toEqual([])
})

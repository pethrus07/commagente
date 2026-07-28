import { test, expect, irPara } from '../helpers'

test.use({ storageState: '.auth/super.json' })

// Feature (28/07): Identidade & Estilo da IA na tela Conhecimento — persona (voz da marca)
// + controles estruturados de COMO ESCREVER (formalidade/emoji/abreviação/travessão/bolhas)
// com presets prontos. Define uma vez → toda missão herda no prompt.
test('define identidade + estilo (preset + bolhas) e salva', async ({ page, erros }) => {
  await page.goto('/')
  await irPara(page, 'Conhecimento')

  await expect(page.getByRole('heading', { name: /Identidade .* estilo da IA/ })).toBeVisible()

  // aplica um preset pronto → carrega a persona sugerida + liga o estilo (bolhas etc.)
  await page.getByRole('button', { name: /Vendedor humano/ }).click()
  await expect(page.getByText(/preset "Vendedor humano" carregado/i)).toBeVisible()
  // preview vivo mostra as BOLHAS (estilo bolhas ligado pelo preset)
  await expect(page.getByText('te mando os detalhes ja ja')).toBeVisible()

  // ajusta a persona e usa um chip de sugestão
  const ta = page.getByPlaceholder(/Você é o atendente/)
  await ta.fill('Você é a Bia, atende de forma informal e trata por você.')
  await page.getByRole('button', { name: /Seja direto e objetivo/ }).click()
  await expect(ta).toHaveValue(/direto e objetivo/)

  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(page.getByText(/Identidade e estilo salvos/)).toBeVisible()

  // persiste: recarrega (rota por estado → volta pro Dashboard) e reabre Conhecimento
  await page.reload()
  await irPara(page, 'Conhecimento')
  await expect(page.getByPlaceholder(/Você é o atendente/)).toHaveValue(/Bia/)
  // o estilo persistiu → o preview segue em bolhas
  await expect(page.getByText('te mando os detalhes ja ja')).toBeVisible()

  expect(erros, erros.join('\n')).toEqual([])
})

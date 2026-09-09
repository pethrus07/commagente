// E2E: define a identidade da IA e o estilo padrão (bolhas) e salva. Cobre a tela mais nova,
// que é a que ainda não tem quilometragem de uso.
import { test, expect, irPara } from '../helpers'

test.use({ storageState: '.auth/super.json' })

// Feature (28/07): Identidade & Estilo da IA na tela Conhecimento — persona (voz da marca)
// + o estilo PADRÃO da casa (formalidade/emoji/abreviação/travessão/bolhas), que cada missão
// pode sobrescrever com o próprio perfil. Aqui testamos o padrão do tenant.
test('define identidade + estilo padrão (bolhas) e salva', async ({ page, erros }) => {
  await page.goto('/')
  await irPara(page, 'Conhecimento')

  await expect(page.getByRole('heading', { name: /Identidade .* estilo da IA/ })).toBeVisible()

  // liga "quebrar em bolhas" → o preview vivo passa a mostrar mensagens separadas
  await page.getByRole('button', { name: /Quebrar em bolhas/ }).click()
  await expect(page.getByText('já te mando os detalhes')).toBeVisible()

  // define a persona e usa um chip de sugestão
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
  await expect(page.getByText('já te mando os detalhes')).toBeVisible()

  expect(erros, erros.join('\n')).toEqual([])
})

import { test, expect, irPara } from '../helpers'

test.use({ storageState: '.auth/super.json' })

// Percorre TODAS as páginas e falha se qualquer uma lançar exceção de runtime.
const PAGINAS: [string, string][] = [
  ['Dashboard', 'Dashboard'],
  ['Missões', 'Missões'],
  ['Campanhas', 'Campanhas'],
  ['Escalados', 'Escalados'],
  ['Contatos', 'Contatos'],
  ['Conhecimento', 'Conhecimento'],
  ['Números', 'Números'],
  ['Tenants', 'Tenants'],
]

test('navega por todas as páginas sem erro de runtime', async ({ page, erros }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible()
  for (const [nav, titulo] of PAGINAS) {
    await irPara(page, nav)
    await expect(page.getByRole('heading', { name: titulo, level: 1 })).toBeVisible()
    await page.waitForTimeout(250) // deixa os fetches assíncronos resolverem
  }
  expect(erros, `exceções de runtime:\n${erros.join('\n')}`).toEqual([])
})

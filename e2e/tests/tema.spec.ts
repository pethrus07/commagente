// E2E: alterna claro/escuro e navega nos dois sem erro de runtime.
import { test, expect, irPara } from '../helpers'

test.use({ storageState: '.auth/super.json' })

const tema = (page: import('@playwright/test').Page) =>
  page.evaluate(() => document.documentElement.dataset.theme)

test('alterna tema claro/escuro e navega sem erro nos dois', async ({ page, erros }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible()
  expect(await tema(page)).toBe('dark') // padrão

  // alterna para CLARO
  await page.getByRole('button', { name: 'Tema claro' }).click()
  expect(await tema(page)).toBe('light')

  // navega em páginas que eram hard-coded dark — devem renderizar no claro
  for (const [nav, titulo] of [
    ['Missões', 'Missões'],
    ['Números', 'Números'],
    ['Contatos', 'Contatos'],
    ['Programadas', 'Programadas'],
  ] as const) {
    await irPara(page, nav)
    await expect(page.getByRole('heading', { name: titulo, level: 1 })).toBeVisible()
    await page.waitForTimeout(200)
  }

  // volta para ESCURO
  await page.getByRole('button', { name: 'Tema escuro' }).click()
  expect(await tema(page)).toBe('dark')

  expect(erros, `exceções de runtime:\n${erros.join('\n')}`).toEqual([])
})

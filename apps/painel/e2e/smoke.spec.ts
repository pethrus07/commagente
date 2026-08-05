import { test, expect } from '@playwright/test'
import { login, navegar, slug } from './helpers'

// Todas as abas do painel (rótulo na sidebar → título no header).
const PAGINAS: { label: string; titulo: string | RegExp }[] = [
  { label: 'Dashboard', titulo: 'Dashboard' },
  { label: 'Inteligência', titulo: 'Inteligência' },
  { label: 'Missões', titulo: 'Missões' },
  { label: 'Campanhas', titulo: 'Campanhas' },
  { label: 'Programadas', titulo: 'Programadas' },
  { label: 'Escalados', titulo: 'Escalados' },
  { label: 'Contatos', titulo: 'Contatos' },
  { label: 'Tags', titulo: 'Tags' },
  { label: 'DNA', titulo: 'DNA' },
  { label: 'Voz & estilo', titulo: 'Voz & estilo' },
  { label: 'Biblioteca', titulo: 'Biblioteca' },
  { label: 'Números', titulo: 'Números' },
]

test('percorre todas as páginas, valida o header e tira screenshot', async ({ page }, info) => {
  await login(page)
  const proj = info.project.name
  await page.screenshot({ path: `e2e/__screens__/${proj}/00-dashboard.png`, fullPage: true })

  for (const [i, p] of PAGINAS.entries()) {
    await navegar(page, p.label)
    // o header (h1) reflete a página — fonte da verdade do roteamento (level:1 evita colidir com títulos de card h3)
    await expect(page.getByRole('heading', { name: p.titulo, level: 1 })).toBeVisible()
    await page.waitForTimeout(350) // deixa listas/spinners assentarem
    await page.screenshot({ path: `e2e/__screens__/${proj}/${String(i + 1).padStart(2, '0')}-${slug(p.label)}.png`, fullPage: true })
  }
})

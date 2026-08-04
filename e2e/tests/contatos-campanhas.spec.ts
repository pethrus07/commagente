import { test, expect, irPara } from '../helpers'

test.use({ storageState: '.auth/super.json' })

// Cria contatos QA, valida a busca, e cria uma campanha usando "Selecionar todos"
// (filtrado, pra pegar SÓ os contatos QA — seguro). As missões nascem 'configurada'.
test('contatos + campanha com selecionar-todos', async ({ page, erros }) => {
  await page.goto('/')
  await irPara(page, 'Contatos')

  // cria 2 contatos QA
  for (const [nome, tel] of [['QA Contato Um', '5599000010001'], ['QA Contato Dois', '5599000010002']]) {
    await page.getByRole('button', { name: 'Novo' }).first().click()
    await expect(page.getByRole('heading', { name: 'Novo contato' })).toBeVisible()
    await page.getByPlaceholder('Fulano').fill(nome)
    await page.getByPlaceholder('5583999998888').fill(tel)
    await page.getByRole('button', { name: 'Salvar' }).click()
    // .first(): dois toasts "Contato salvo." podem se empilhar (2 contatos em sequência)
    await expect(page.getByText('Contato salvo.').first()).toBeVisible()
  }

  // busca encontra os dois
  await page.getByPlaceholder('Buscar por nome ou telefone…').fill('QA Contato')
  await expect(page.getByText('QA Contato Um')).toBeVisible()
  await expect(page.getByText('QA Contato Dois')).toBeVisible()

  // campanha com "selecionar todos do filtro"
  await irPara(page, 'Campanhas')
  await page.getByRole('button', { name: 'Nova campanha' }).first().click()
  await page.getByPlaceholder(/Cobrança julho/).fill('QA Campanha E2E')
  await page.getByPlaceholder('O que a IA deve fazer em cada conversa').fill('Falar com os fornecedores QA')
  // dentro do SeletorContatos: filtra, espera a lista carregar, e seleciona todos do filtro
  await page.getByPlaceholder('Buscar contato…').fill('QA Contato')
  await expect(page.getByText('QA Contato Um')).toBeVisible()
  await expect(page.getByText('QA Contato Dois')).toBeVisible()
  await page.getByRole('button', { name: 'Selecionar todos do filtro' }).click()
  await expect(page.getByText('2 no total')).toBeVisible()
  // botão agora reflete o "Disparar agora" (default ligado): "Criar e disparar (2)"
  await page.getByRole('button', { name: /Criar e disparar/ }).click()

  await expect(page.getByText(/Campanha criada/)).toBeVisible()
  // .first(): campanhas QA podem se acumular no DB de dev entre runs (nome não é único)
  await expect(page.getByText('QA Campanha E2E').first()).toBeVisible()

  // abre o RELATÓRIO da campanha e confere que a tela consolida abre (header estático)
  await page.getByRole('button', { name: 'Relatório' }).first().click()
  await expect(page.getByRole('heading', { name: /Relatório ·/ })).toBeVisible()
  expect(erros, erros.join('\n')).toEqual([])
})

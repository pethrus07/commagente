// E2E: o liga/desliga do suporte reativo no número — a chave que faz um chip atender sozinho
// quem escreve. Vale testar na UI porque o efeito é grande e o controle é um toggle só.
import { test, expect, irPara } from '../helpers'

test.use({ storageState: '.auth/super.json' })

// Liga o suporte reativo pelo assistente (sem contatos) → selo em Números → desliga.
test('ativa suporte reativo e desliga pela página de Números', async ({ page }) => {
  await page.goto('/')
  await irPara(page, 'Missões')
  await page.getByRole('button', { name: 'Nova missão' }).first().click()

  // modelo Suporte → toggle 24/7 já vem ligado
  await page.getByText('Suporte / dúvidas').click()
  await expect(page.getByText('Atender quem entrar em contato (24/7)')).toBeVisible()
  await page.getByRole('button', { name: 'Avançar' }).click()

  // sem contatos → botão vira "Ativar suporte reativo"
  await page.getByRole('button', { name: 'Ativar suporte reativo' }).click()
  await expect(page.getByText(/Suporte reativo ativado/)).toBeVisible()

  // Números mostra o selo
  await irPara(page, 'Números')
  await expect(page.getByText('suporte reativo ativo').first()).toBeVisible()

  // desliga pelo modal de config (anti-bloqueio) — deixa o número limpo.
  // (getByRole button evita casar o selo de Saúde, cujo title contém "anti-bloqueio")
  await page.getByRole('button', { name: 'Anti-bloqueio' }).first().click()
  // o header do modal virou o apelido/telefone do número (item 2); confirma pelo subtítulo estável
  await expect(page.getByText(/ritmo humano do chip/)).toBeVisible()
  await page.getByRole('button', { name: /Suporte reativo/ }).click()
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText('Configuração salva.')).toBeVisible()
  await expect(page.getByText('suporte reativo ativo')).toHaveCount(0)
})

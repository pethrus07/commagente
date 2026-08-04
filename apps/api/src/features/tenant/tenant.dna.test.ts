// Testes do domínio do DNA — defaults-first, orçamento de contexto e Regras de Negócio à parte.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { compilarDna, lerDna } from './tenant.dna'

test('DNA vazio → nada entra no prompt (defaults-first)', () => {
  assert.deepEqual(compilarDna(null), { regras: null, conhecimento: null })
  assert.deepEqual(compilarDna({}), { regras: null, conhecimento: null })
  assert.deepEqual(compilarDna({ empresa: '   ' }), { regras: null, conhecimento: null })
})

test('lerDna descarta categorias vazias e chaves desconhecidas', () => {
  const d = lerDna({ empresa: 'Retífica X', produtos: '', naoExiste: 'ignora', precos: '  R$100  ' })
  assert.deepEqual(d, { empresa: 'Retífica X', precos: 'R$100' })
})

test('Regras de Negócio saem à parte (prioridade), fora do bloco de conhecimento', () => {
  const c = compilarDna({ empresa: 'Somos a Retífica X', regrasNegocio: 'Nunca dê desconto acima de 10%' })
  assert.equal(c.regras, 'Nunca dê desconto acima de 10%')
  assert.match(c.conhecimento ?? '', /A empresa: Somos a Retífica X/)
  assert.doesNotMatch(c.conhecimento ?? '', /desconto/) // regra não vaza pro conhecimento
})

test('categorias preenchidas viram bullets rotulados', () => {
  const c = compilarDna({ produtos: 'Motores', precos: 'R$ 500' })
  assert.match(c.conhecimento ?? '', /• Produtos e serviços: Motores/)
  assert.match(c.conhecimento ?? '', /• Preços e condições: R\$ 500/)
})

test('orçamento de contexto: categoria gigante é truncada com reticências', () => {
  const gigante = 'x'.repeat(5000)
  const c = compilarDna({ empresa: gigante })
  const linha = c.conhecimento ?? ''
  assert.ok(linha.endsWith('…'), 'deve truncar com …')
  // rótulo (~15) + até 1200 do conteúdo + reticências — bem menor que os 5000 originais
  assert.ok(linha.length < 1300, `linha deveria caber no orçamento, tem ${linha.length}`)
})

test('só Regras de Negócio → conhecimento fica null', () => {
  const c = compilarDna({ regrasNegocio: 'Não atender fora do horário comercial' })
  assert.equal(c.conhecimento, null)
  assert.equal(c.regras, 'Não atender fora do horário comercial')
})

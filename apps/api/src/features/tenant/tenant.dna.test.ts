// Testes do domínio do DNA — defaults-first, orçamento de contexto e Regras de Negócio à parte.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { compilarDna, compilarDnaComCamadas, lerCamadaDna, lerDna, resolverDna } from './tenant.dna.js'

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

// ── DNA hierárquico (#9 Fase B): camadas Herdar/Combinar/Substituir ──
test('lerCamadaDna: descarta modo sem texto, chave desconhecida e texto vazio', () => {
  const c = lerCamadaDna({
    precos: { modo: 'substituir', texto: '  R$ 90 na campanha  ' },
    publicoAlvo: { modo: 'combinar', texto: '   ' }, // texto vazio → fora
    naoExiste: { modo: 'substituir', texto: 'ignora' },
  })
  assert.deepEqual(c, { precos: { modo: 'substituir', texto: 'R$ 90 na campanha' } })
})

test('resolverDna Herdar: categoria ausente na camada mantém o tenant', () => {
  const base = { empresa: 'Retífica X', precos: 'R$ 100' }
  const r = resolverDna(base, { publicoAlvo: { modo: 'substituir', texto: 'Frotistas' } })
  assert.equal(r.empresa, 'Retífica X')
  assert.equal(r.precos, 'R$ 100') // herdado
  assert.equal(r.publicoAlvo, 'Frotistas')
})

test('resolverDna Substituir troca; Combinar soma ao herdado', () => {
  const base = { precos: 'R$ 100', diferenciais: 'Entrega rápida' }
  const r = resolverDna(base, {
    precos: { modo: 'substituir', texto: 'R$ 90 (campanha)' },
    diferenciais: { modo: 'combinar', texto: 'Frete grátis na campanha' },
  })
  assert.equal(r.precos, 'R$ 90 (campanha)') // substituído
  assert.equal(r.diferenciais, 'Entrega rápida\nFrete grátis na campanha') // combinado
})

test('resolverDna Combinar sem base vira só o texto da camada', () => {
  const r = resolverDna({}, { publicoAlvo: { modo: 'combinar', texto: 'Só na campanha' } })
  assert.equal(r.publicoAlvo, 'Só na campanha')
})

test('compilarDnaComCamadas: a camada da campanha reflete no prompt compilado', () => {
  const tenant = { precos: 'R$ 100' }
  const campanha = { precos: { modo: 'substituir', texto: 'R$ 90 promo' } }
  const c = compilarDnaComCamadas(tenant, campanha)
  assert.match(c.conhecimento ?? '', /• Preços e condições: R\$ 90 promo/)
  assert.doesNotMatch(c.conhecimento ?? '', /R\$ 100/) // o preço do tenant foi substituído
})

test('compilarDnaComCamadas sem camada = compilarDna do tenant (compat)', () => {
  const tenant = { empresa: 'Retífica X', precos: 'R$ 100' }
  assert.deepEqual(compilarDnaComCamadas(tenant), compilarDna(tenant))
  assert.deepEqual(compilarDnaComCamadas(tenant, null, undefined), compilarDna(tenant))
})

test('3 camadas (#9 Fase C): missão vence campanha vence tenant', () => {
  const tenant = { precos: 'R$ 100 (empresa)' }
  const campanha = { precos: { modo: 'substituir', texto: 'R$ 90 (campanha)' } }
  const missao = { precos: { modo: 'substituir', texto: 'R$ 80 (missão)' } }
  // ordem crescente de prioridade: tenant(base), campanha, missão → a missão vence
  const r = resolverDna(lerDna(tenant), lerCamadaDna(campanha), lerCamadaDna(missao))
  assert.equal(r.precos, 'R$ 80 (missão)')
  // sem a camada da missão, a campanha prevalece sobre o tenant
  const semMissao = resolverDna(lerDna(tenant), lerCamadaDna(campanha))
  assert.equal(semMissao.precos, 'R$ 90 (campanha)')
})

test('3 camadas Combinar acumula tenant + campanha + missão na ordem', () => {
  const r = resolverDna(
    { diferenciais: 'Entrega rápida' },
    lerCamadaDna({ diferenciais: { modo: 'combinar', texto: 'Frete grátis' } }),
    lerCamadaDna({ diferenciais: { modo: 'combinar', texto: 'Brinde' } }),
  )
  assert.equal(r.diferenciais, 'Entrega rápida\nFrete grátis\nBrinde')
})

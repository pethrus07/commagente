import assert from 'node:assert/strict'
import { test } from 'node:test'
import { montarFicha } from './memoria.montador'

// missão mínima só com o que o montador lê
const base = {
  tipo: 'vender',
  objetivo: 'vender o sistema',
  contexto: null,
  criterioConclusao: null,
  tom: null,
  informacoes: null,
  estado: 'configurada' as const,
  resumo: null,
  fatos: null,
  contato: null,
  tenant: { persona: null },
  campanha: null,
  mensagens: [] as { direcao: 'in' | 'out'; conteudo: string }[],
}

test('saudação: sem sinais, nenhuma diretriz de saudação entra no prompt', () => {
  const ctx = montarFicha(base)
  assert.ok(!ctx.persona.includes('CONTINUIDADE'))
  assert.ok(!ctx.persona.toLowerCase().includes('horário de brasília'))
})

test('saudação: já conversou antes → manda NÃO recomeçar com saudação', () => {
  const ctx = montarFicha(base, null, null, { jaConversouAntes: true, periodo: 'manhã' })
  assert.ok(ctx.persona.includes('CONTINUIDADE'))
  assert.ok(ctx.persona.includes('NÃO recomece'))
  // continuidade vence: não injeta a diretriz de horário quando já se falou
  assert.ok(!ctx.persona.toLowerCase().includes('horário de brasília'))
})

test('saudação: 1º contato → diretriz de horário (período correto)', () => {
  const ctx = montarFicha(base, null, null, { jaConversouAntes: false, periodo: 'noite' })
  assert.ok(ctx.persona.toLowerCase().includes('de noite'))
  assert.ok(ctx.persona.toLowerCase().includes('horário de brasília'))
  assert.ok(!ctx.persona.includes('CONTINUIDADE'))
})

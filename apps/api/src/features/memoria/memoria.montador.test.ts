// Testes do Montador de Contexto: o que entra — e o que NÃO entra — no prompt.
// Regra pura, sem banco. Rode: npx tsx --test src/features/memoria/memoria.montador.test.ts
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

// ── MODO ROTEIRO: a fiação campanha.roteiro → ctx.roteiro (herança ao vivo) ──
const roteiroCampanha = {
  resumoFinal: true,
  passos: [
    { tipo: 'pergunta', texto: 'Como posso te chamar?', campo: 'nome' },
    {
      tipo: 'menu',
      texto: 'Você é empresa ou profissional?',
      opcoes: [
        { rotulo: 'Empresa', passos: [{ tipo: 'pergunta', texto: 'Qual o ramo?', campo: 'ramo' }] },
        { rotulo: 'Profissional', passos: [{ tipo: 'pergunta', texto: 'Sua especialidade?', campo: 'esp' }] },
      ],
    },
  ],
}

test('roteiro: sem roteiro na campanha → ctx.roteiro é null (conversa livre intocada)', () => {
  assert.equal(montarFicha(base).roteiro, null)
  assert.equal(montarFicha({ ...base, campanha: { dna: null } }).roteiro, null)
})

test('roteiro: campanha COM roteiro e estado inicial → injeta o passo 0 (com próxima emendada)', () => {
  const ctx = montarFicha({ ...base, campanha: { roteiro: roteiroCampanha }, roteiroEstado: null })
  assert.ok(ctx.roteiro, 'ctx.roteiro deve existir')
  assert.match(ctx.roteiro!.instrucao, /Como posso te chamar/)
  assert.equal(ctx.roteiro!.menu, undefined) // passo 0 é pergunta, não menu
})

test('roteiro: estado no MENU → injeta os rótulos das opções', () => {
  const ctx = montarFicha({ ...base, campanha: { roteiro: roteiroCampanha }, roteiroEstado: { ramo: null, idx: 1 } })
  assert.deepEqual(ctx.roteiro!.menu, ['Empresa', 'Profissional'])
  assert.match(ctx.roteiro!.instrucao, /opcao_roteiro/)
})

test('roteiro: dentro de um ramo → injeta o passo daquela opção', () => {
  const ctx = montarFicha({ ...base, campanha: { roteiro: roteiroCampanha }, roteiroEstado: { ramo: 'Profissional', idx: 0 } })
  assert.match(ctx.roteiro!.instrucao, /especialidade/)
})

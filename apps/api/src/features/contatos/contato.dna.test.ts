// Testes do domínio do DNA do contato — defaults-first + orçamento + só personalização.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { compilarDnaContato, lerDnaContato } from './contato.dna.js'

test('DNA de contato vazio → null (defaults-first)', () => {
  assert.equal(compilarDnaContato(null), null)
  assert.equal(compilarDnaContato({}), null)
  assert.equal(compilarDnaContato({ perfil: '   ' }), null)
})

test('lerDnaContato descarta vazias e chaves desconhecidas', () => {
  const d = lerDnaContato({ perfil: 'Comprador técnico', comunicacao: '', xpto: 'ignora', historico: ' comprou 2x ' })
  assert.deepEqual(d, { perfil: 'Comprador técnico', historico: 'comprou 2x' })
})

test('categorias preenchidas viram bullets rotulados', () => {
  const b = compilarDnaContato({ perfil: 'Dono da oficina', comunicacao: 'Direto, sem enrolação' })
  assert.match(b ?? '', /• Perfil: Dono da oficina/)
  assert.match(b ?? '', /• Comunicação: Direto, sem enrolação/)
})

test('orçamento de contexto: categoria gigante é truncada', () => {
  const b = compilarDnaContato({ observacoes: 'y'.repeat(3000) })
  assert.ok((b ?? '').endsWith('…'))
  assert.ok((b ?? '').length < 700, `deve caber no orçamento, tem ${(b ?? '').length}`)
})

test('orçamento total limita o bloco inteiro', () => {
  const g = 'z'.repeat(2000)
  const b = compilarDnaContato({ perfil: g, comunicacao: g, historico: g, observacoes: g })
  assert.ok((b ?? '').length <= 1700, `bloco total deve respeitar o teto, tem ${(b ?? '').length}`)
})

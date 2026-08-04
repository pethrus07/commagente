// Testes do domínio de recorrência (regra pura). Rode: npx tsx --test src/features/agendamentos/agendamentos.dominio.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cicloRef, ehDiaDeDisparo, horarioJaChegou, type AgDatas } from './agendamentos.dominio'

// data BR estável (meio-dia -03:00) a partir de "YYYY-MM-DD"
const d = (ymd: string) => new Date(`${ymd}T12:00:00-03:00`)
const base: AgDatas = {
  recorrencia: 'diario',
  diaDoMes: null,
  dataUnica: null,
  intervalo: null,
  diasSemana: null,
  dataInicio: null,
  dataFim: null,
}
// referência de dias da semana: 2026-01-01 = quinta; 01-04 domingo; 01-05 segunda; 01-06 terça
const ehDia = (ag: Partial<AgDatas>, ymd: string) => ehDiaDeDisparo({ ...base, ...ag }, ymd)

test('uma_vez: só na data', () => {
  assert.equal(ehDia({ recorrencia: 'uma_vez', dataUnica: d('2026-01-10') }, '2026-01-10'), true)
  assert.equal(ehDia({ recorrencia: 'uma_vez', dataUnica: d('2026-01-10') }, '2026-01-11'), false)
})

test('diario: todo dia', () => {
  assert.equal(ehDia({ recorrencia: 'diario' }, '2026-01-05'), true)
  assert.equal(ehDia({ recorrencia: 'diario' }, '2026-01-04'), true)
})

test('dias_uteis: seg-sex', () => {
  assert.equal(ehDia({ recorrencia: 'dias_uteis' }, '2026-01-05'), true) // segunda
  assert.equal(ehDia({ recorrencia: 'dias_uteis' }, '2026-01-04'), false) // domingo
})

test('fim_de_semana: sáb/dom', () => {
  assert.equal(ehDia({ recorrencia: 'fim_de_semana' }, '2026-01-04'), true) // domingo
  assert.equal(ehDia({ recorrencia: 'fim_de_semana' }, '2026-01-05'), false) // segunda
})

test('semanal: nos dias escolhidos', () => {
  const ag = { recorrencia: 'semanal', diasSemana: '1,3' } // seg e qua
  assert.equal(ehDia(ag, '2026-01-05'), true) // segunda
  assert.equal(ehDia(ag, '2026-01-06'), false) // terça
})

test('a_cada_dias: intervalo a partir da âncora', () => {
  const ag = { recorrencia: 'a_cada_dias', intervalo: 3, dataInicio: d('2026-01-01') }
  assert.equal(ehDia(ag, '2026-01-01'), true) // dia 0
  assert.equal(ehDia(ag, '2026-01-04'), true) // dia 3
  assert.equal(ehDia(ag, '2026-01-02'), false) // dia 1
})

test('a_cada_semanas: semana alinhada + dia da semana', () => {
  const ag = { recorrencia: 'a_cada_semanas', intervalo: 2, diasSemana: '1', dataInicio: d('2026-01-01') }
  assert.equal(ehDia(ag, '2026-01-05'), true) // semana 0, segunda
  assert.equal(ehDia(ag, '2026-01-19'), true) // semana 2, segunda
  assert.equal(ehDia(ag, '2026-01-12'), false) // semana 1, segunda
})

test('mensal: dia do mês (com clamp no mês curto)', () => {
  assert.equal(ehDia({ recorrencia: 'mensal', diaDoMes: 10 }, '2026-01-10'), true)
  assert.equal(ehDia({ recorrencia: 'mensal', diaDoMes: 10 }, '2026-01-11'), false)
  assert.equal(ehDia({ recorrencia: 'mensal', diaDoMes: 31 }, '2026-02-28'), true) // fev → último dia
})

test('a_cada_meses: mês alinhado + dia', () => {
  const ag = { recorrencia: 'a_cada_meses', intervalo: 2, diaDoMes: 15, dataInicio: d('2026-01-01') }
  assert.equal(ehDia(ag, '2026-01-15'), true) // mês 0
  assert.equal(ehDia(ag, '2026-02-15'), false) // mês 1
  assert.equal(ehDia(ag, '2026-03-15'), true) // mês 2
})

test('anual: mesmo dia+mês', () => {
  const ag = { recorrencia: 'anual', dataUnica: d('2026-01-10') }
  assert.equal(ehDia(ag, '2027-01-10'), true)
  assert.equal(ehDia(ag, '2027-01-11'), false)
})

test('janela: não dispara antes do início nem depois do fim', () => {
  const ag = { recorrencia: 'diario', dataInicio: d('2026-01-05'), dataFim: d('2026-01-10') }
  assert.equal(ehDia(ag, '2026-01-04'), false)
  assert.equal(ehDia(ag, '2026-01-05'), true)
  assert.equal(ehDia(ag, '2026-01-10'), true)
  assert.equal(ehDia(ag, '2026-01-11'), false)
})

test('cicloRef: granularidade por tipo', () => {
  assert.equal(cicloRef({ ...base, recorrencia: 'mensal' }, '2026-01-05'), '2026-01')
  assert.equal(cicloRef({ ...base, recorrencia: 'a_cada_meses' }, '2026-01-05'), '2026-01')
  assert.equal(cicloRef({ ...base, recorrencia: 'anual' }, '2026-01-05'), '2026')
  assert.equal(cicloRef({ ...base, recorrencia: 'diario' }, '2026-01-05'), '2026-01-05')
})

test('horarioJaChegou: sem horário sempre; com horário respeita o BR', () => {
  assert.equal(horarioJaChegou(null, d('2026-01-05')), true)
  assert.equal(horarioJaChegou('08:00', new Date('2026-01-05T18:00:00-03:00')), true)
  assert.equal(horarioJaChegou('20:00', new Date('2026-01-05T18:00:00-03:00')), false)
})

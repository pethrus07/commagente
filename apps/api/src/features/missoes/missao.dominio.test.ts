// Blindagem: transições que ATIVAM a missão são só do sistema (Iniciar/resposta), não da mão.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ehTransicaoSoSistema, podeTransicionar, validarTransicao } from './missao.dominio'

test('validarTransicao (MANUAL) bloqueia configurada → na_fila com dica do Iniciar', () => {
  assert.throws(() => validarTransicao('configurada', 'na_fila'), /Iniciar/)
})

test('validarTransicao (MANUAL) bloqueia na_fila → em_conversa (só o sistema move)', () => {
  assert.throws(() => validarTransicao('na_fila', 'em_conversa'), /sistema/)
})

test('validarTransicao permite as transições manuais legítimas', () => {
  assert.doesNotThrow(() => validarTransicao('configurada', 'descartada'))
  assert.doesNotThrow(() => validarTransicao('configurada', 'arquivada'))
  assert.doesNotThrow(() => validarTransicao('em_conversa', 'concluida'))
  assert.doesNotThrow(() => validarTransicao('em_conversa', 'em_conversa')) // mesmo-estado = no-op
})

test('o fluxo INTERNO (podeTransicionar) segue livre — a blindagem é só do manual', () => {
  // iniciarMissao/processarTurno usam podeTransicionar/atualizarEstado, NÃO validarTransicao
  assert.equal(podeTransicionar('configurada', 'na_fila'), true)
  assert.equal(podeTransicionar('na_fila', 'em_conversa'), true)
})

test('ehTransicaoSoSistema marca só as que ativam', () => {
  assert.equal(ehTransicaoSoSistema('configurada', 'na_fila'), true)
  assert.equal(ehTransicaoSoSistema('na_fila', 'em_conversa'), true)
  assert.equal(ehTransicaoSoSistema('sem_resposta', 'na_fila'), true)
  assert.equal(ehTransicaoSoSistema('em_conversa', 'concluida'), false)
  assert.equal(ehTransicaoSoSistema('configurada', 'arquivada'), false)
})

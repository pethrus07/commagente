// Regressão do bug "importar do WhatsApp volta 0": v2.3.1 tem id=CUID e o JID em remoteJid.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mapearContatosEvolution } from './evolution.client.js'

test('v2.3.1: usa remoteJid (id é CUID interno) — NÃO descarta o contato', () => {
  const r = mapearContatosEvolution([
    { id: 'cms64j3t20vhcq94dapj7lp52', remoteJid: '5583999990000@s.whatsapp.net', pushName: 'João' },
  ])
  assert.deepEqual(r, [{ telefone: '5583999990000', nome: 'João' }])
})

test('versão antiga: id ERA o JID (fallback continua funcionando)', () => {
  const r = mapearContatosEvolution([{ id: '5583988887777@s.whatsapp.net', pushName: 'Maria' }])
  assert.deepEqual(r, [{ telefone: '5583988887777', nome: 'Maria' }])
})

test('ignora grupos, broadcast e jids sem telefone', () => {
  const r = mapearContatosEvolution([
    { remoteJid: '123456@g.us', pushName: 'Grupo' },
    { remoteJid: 'status@broadcast' },
    { remoteJid: '5511999998888@s.whatsapp.net', pushName: 'Ana' },
  ])
  assert.deepEqual(r, [{ telefone: '5511999998888', nome: 'Ana' }])
})

test('remoteJid com sufixo de device (:12) → só o número', () => {
  const r = mapearContatosEvolution([{ remoteJid: '5511988887777:12@s.whatsapp.net' }])
  assert.deepEqual(r, [{ telefone: '5511988887777', nome: undefined }])
})

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { normalizarEvento } from './webhook.dominio'

function upsert(key: Record<string, unknown>, message: Record<string, unknown>, pushName?: string) {
  return normalizarEvento({ event: 'messages.upsert', instance: 'zap-1', data: { key, message, pushName } })
}

test('@lid: preserva o JID completo em telefone e marca ehLid', () => {
  const ev = upsert(
    { remoteJid: '121539001372880@lid', id: 'ABC', fromMe: true },
    { conversation: 'oi, quero um orçamento' },
    'Desbravando Expedição',
  )
  assert.equal(ev.tipo, 'mensagem')
  if (ev.tipo !== 'mensagem') return
  assert.equal(ev.ehLid, true)
  assert.equal(ev.telefone, '121539001372880@lid') // JID completo → responde no destino certo
  assert.equal(ev.fromMe, true)
  assert.equal(ev.conteudo, 'oi, quero um orçamento')
})

test('número normal (@s.whatsapp.net): telefone é só o número, ehLid false', () => {
  const ev = upsert(
    { remoteJid: '5511900000002@s.whatsapp.net', id: 'X', fromMe: false },
    { conversation: 'bom dia' },
  )
  assert.equal(ev.tipo, 'mensagem')
  if (ev.tipo !== 'mensagem') return
  assert.equal(ev.ehLid, false)
  assert.equal(ev.telefone, '5511900000002')
})

test('grupo @g.us continua ignorado', () => {
  const ev = upsert({ remoteJid: '123@g.us', id: 'G', fromMe: false }, { conversation: 'x' })
  assert.equal(ev.tipo, 'ignorado')
})

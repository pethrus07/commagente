/**
 * Avisos efêmeros (sucesso/erro) num store minúsculo fora do React, com um hook para assinar.
 * É global de propósito: qualquer página avisa sem precisar de contexto nem prop drilling, e o
 * toaster fica montado no App — inclusive na tela de login.
 */
import { useEffect, useState } from 'react'

export type Toast = { id: number; msg: string; tipo: 'ok' | 'erro' }

let toasts: Toast[] = []
let seq = 0
const listeners = new Set<(t: Toast[]) => void>()

function emit() {
  for (const l of listeners) l(toasts)
}

export function toast(msg: string, tipo: 'ok' | 'erro' = 'ok') {
  const t: Toast = { id: ++seq, msg, tipo }
  toasts = [...toasts, t]
  emit()
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== t.id)
    emit()
  }, 4000)
}

export function useToasts(): Toast[] {
  const [estado, setEstado] = useState<Toast[]>(toasts)
  useEffect(() => {
    listeners.add(setEstado)
    return () => {
      listeners.delete(setEstado)
    }
  }, [])
  return estado
}

import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { api } from '../lib/api'
import { auth, type UsuarioSessao } from '../lib/auth'
import { toast } from '../lib/toast'
import { Button, Card, cn } from '../lib/ui'

// Aceite obrigatório no 1º acesso (LGPD/uso de dados + responsabilidade do número).
// Bloqueia o painel até aceitar (ou sair). Só aparece p/ usuários de tenant (não super-admin).
export function TermosModal({
  onAceitar,
  onSair,
}: {
  onAceitar: (u: UsuarioSessao) => void
  onSair: () => void
}) {
  const [ok, setOk] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const aceitar = async () => {
    if (!ok) return
    setEnviando(true)
    try {
      await api.aceitarTermos()
      const u = auth.marcarTermosAceitos()
      if (u) onAceitar(u)
    } catch (e) {
      toast((e as Error).message, 'erro')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-lg p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-500/15 text-indigo-300"><ShieldCheck className="h-5 w-5" /></div>
          <h3 className="text-base font-semibold text-content">Antes de começar — termos de uso</h3>
        </div>
        <div className="space-y-3 text-sm text-muted">
          <p className="rounded-xl bg-surface2 p-3">
            <b className="text-content">1. Uso de dados.</b> As conversas e contatos processados na plataforma podem ser usados, de forma agregada, para operar e melhorar o serviço e a IA, conforme a LGPD. Não insira dados de terceiros sem base legal.
          </p>
          <p className="rounded-xl bg-surface2 p-3">
            <b className="text-content">2. Responsabilidade do número.</b> Você é responsável pelo número de WhatsApp conectado e pelo uso adequado dele. Enviar mensagens para números frios/sem consentimento pode levar ao <b className="text-content">bloqueio do número pela Meta</b> — o risco é seu. Respeite o opt-out e a legislação.
          </p>
        </div>
        <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm text-content">
          <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} className="mt-0.5 h-4 w-4 accent-indigo-500" />
          <span>Li e concordo com os termos acima.</span>
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onSair}>Sair</Button>
          <Button onClick={aceitar} loading={enviando} className={cn(!ok && 'pointer-events-none opacity-50')}>
            Aceitar e continuar
          </Button>
        </div>
      </Card>
    </div>
  )
}

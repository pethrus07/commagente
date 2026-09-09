/**
 * Diálogo de confirmação das ações destrutivas (excluir campanha, remover número, apagar tag).
 * Segura o estado de "processando" enquanto o onConfirmar roda e só fecha quando termina — sem
 * isso o usuário clicava duas vezes achando que não tinha funcionado.
 */
import { useState, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button, Card } from '../lib/ui'

export function ConfirmDialog({
  titulo,
  mensagem,
  confirmarLabel = 'Confirmar',
  onConfirmar,
  onFechar,
}: {
  titulo: string
  mensagem: ReactNode
  confirmarLabel?: string
  onConfirmar: () => Promise<void> | void
  onFechar: () => void
}) {
  const [processando, setProcessando] = useState(false)
  const confirmar = async () => {
    setProcessando(true)
    try {
      await onConfirmar()
    } finally {
      setProcessando(false)
    }
  }
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={() => !processando && onFechar()}
    >
      <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <Card className="p-6">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-500/15 text-rose-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-content">{titulo}</h3>
              <div className="mt-1 text-sm text-muted">{mensagem}</div>
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={onFechar} disabled={processando}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={confirmar} loading={processando}>
              {confirmarLabel}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}

import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import type { EstadoMissao, StatusConexao } from './types'

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

// ─── tokens por estado da missão ─────────────────────────────
export const ESTADO_INFO: Record<
  EstadoMissao,
  { label: string; badge: string; dot: string }
> = {
  configurada: { label: 'Configurada', badge: 'bg-slate-500/15 text-slate-600 ring-slate-500/30 dark:text-slate-300', dot: 'bg-slate-400' },
  na_fila: { label: 'Na fila', badge: 'bg-amber-500/15 text-amber-700 ring-amber-500/30 dark:text-amber-300', dot: 'bg-amber-400' },
  em_conversa: { label: 'Em conversa', badge: 'bg-indigo-500/15 text-indigo-700 ring-indigo-500/30 dark:text-indigo-300', dot: 'bg-indigo-400' },
  concluida: { label: 'Concluída', badge: 'bg-emerald-500/15 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300', dot: 'bg-emerald-400' },
  descartada: { label: 'Descartada', badge: 'bg-rose-500/15 text-rose-700 ring-rose-500/30 dark:text-rose-300', dot: 'bg-rose-400' },
  escalada: { label: 'Escalada', badge: 'bg-orange-500/15 text-orange-700 ring-orange-500/30 dark:text-orange-300', dot: 'bg-orange-400' },
  sem_resposta: { label: 'Sem resposta', badge: 'bg-zinc-500/15 text-zinc-600 ring-zinc-500/30 dark:text-zinc-300', dot: 'bg-zinc-400' },
  arquivada: { label: 'Arquivada', badge: 'bg-neutral-500/15 text-neutral-600 ring-neutral-500/30 dark:text-neutral-400', dot: 'bg-neutral-500' },
}

export const CONEXAO_INFO: Record<
  StatusConexao,
  { label: string; badge: string; dot: string; pulse: boolean }
> = {
  conectado: { label: 'Conectado', badge: 'bg-emerald-500/15 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300', dot: 'bg-emerald-400', pulse: false },
  conectando: { label: 'Conectando', badge: 'bg-amber-500/15 text-amber-700 ring-amber-500/30 dark:text-amber-300', dot: 'bg-amber-400', pulse: true },
  desconectado: { label: 'Desconectado', badge: 'bg-rose-500/15 text-rose-700 ring-rose-500/30 dark:text-rose-300', dot: 'bg-rose-400', pulse: false },
}

// ─── componentes ─────────────────────────────────────────────
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-2xl border border-line bg-surface', className)}>
      {children}
    </div>
  )
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset', className)}>
      {children}
    </span>
  )
}

export function Dot({ className, pulse }: { className?: string; pulse?: boolean }) {
  return <span className={cn('h-1.5 w-1.5 rounded-full', className, pulse && 'animate-pulse-dot')} />
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger' | 'subtle'
  loading?: boolean
}
export function Button({ variant = 'primary', loading, children, className, disabled, ...rest }: BtnProps) {
  const styles = {
    primary: 'bg-indigo-500 text-white hover:bg-indigo-400 shadow-lg shadow-indigo-500/20',
    danger: 'bg-rose-500/90 text-white hover:bg-rose-500',
    ghost: 'bg-surface2 text-content hover:brightness-110 ring-1 ring-inset ring-line',
    subtle: 'text-muted hover:text-content hover:bg-surface2',
  }[variant]
  return (
    <button
      className={cn('inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed', styles, className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-subtle', className)} />
}

export function EmptyState({ icon, titulo, texto, acao }: { icon: ReactNode; titulo: string; texto?: string; acao?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line-strong px-6 py-16 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-surface2 text-muted">{icon}</div>
      <div>
        <p className="font-medium text-content">{titulo}</p>
        {texto && <p className="mt-1 text-sm text-muted">{texto}</p>}
      </div>
      {acao}
    </div>
  )
}

// formata "há X" a partir de um ISO
export function tempoRelativo(iso: string): string {
  const d = new Date(iso).getTime()
  const s = Math.floor((Date.now() - d) / 1000)
  if (s < 60) return 'agora'
  if (s < 3600) return `há ${Math.floor(s / 60)} min`
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`
  return `há ${Math.floor(s / 86400)} d`
}

export function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

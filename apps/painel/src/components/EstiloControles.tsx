/**
 * Os controles de COMO A IA ESCREVE (formalidade, emoji, abreviações, travessão, bolhas), com
 * preview vivo. Compartilhado entre o assistente de missão e a configuração do tenant, porque a
 * mesma decisão existe em dois níveis: padrão da casa e perfil desta missão.
 */
import { MessagesSquare } from 'lucide-react'
import type { EstiloConversa } from '../lib/types'
import { cn } from '../lib/ui'

// controle segmentado (formalidade)
function Segmento<T extends string>({
  valor,
  opcoes,
  onChange,
}: {
  valor: T
  opcoes: { v: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="inline-flex rounded-lg border border-line bg-surface2 p-0.5">
      {opcoes.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={cn(
            'rounded-md px-2.5 py-1 text-xs font-medium transition',
            valor === o.v ? 'bg-indigo-500 text-white' : 'text-muted hover:text-content',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// interruptor liga/desliga
function Toggle({
  ativo,
  onChange,
  label,
  hint,
}: {
  ativo: boolean
  onChange: (v: boolean) => void
  label: string
  hint?: string
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!ativo)}
      className="flex w-full items-center justify-between gap-3 rounded-lg border border-line bg-surface2 px-3 py-2 text-left transition hover:border-indigo-500/40"
    >
      <span className="min-w-0">
        <span className="block text-xs font-medium text-content">{label}</span>
        {hint && <span className="mt-0.5 block text-[11px] leading-snug text-subtle">{hint}</span>}
      </span>
      <span className={cn('relative h-5 w-9 shrink-0 rounded-full transition', ativo ? 'bg-indigo-500' : 'bg-line')}>
        <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all', ativo ? 'left-[18px]' : 'left-0.5')} />
      </span>
    </button>
  )
}

// amostra de como uma resposta sai com o estilo atual (preview vivo)
function amostra(e: EstiloConversa): string[] {
  const emoji = e.emoji ? ' 👍' : ''
  if (e.formalidade === 'formal') {
    const b = ['Olá! Tudo bem?', 'Consigo sim ajudar com isso.', 'Já lhe envio os detalhes.']
    return e.bolhas ? b : [b.join(' ')]
  }
  if (e.abreviacoes || e.formalidade === 'informal') {
    const b = ['opa, tudo certo?', 'consigo sim' + emoji, 'te mando os detalhes ja ja']
    return e.bolhas ? b : ['opa, tudo certo? consigo sim' + emoji + ', te mando os detalhes ja ja']
  }
  const b = ['Oi, tudo bem?', 'Consigo sim' + emoji, 'já te mando os detalhes']
  return e.bolhas ? b : ['Oi, tudo bem? Consigo sim' + emoji + ', já te mando os detalhes.']
}

// Controles do PERFIL DE CONVERSA (formalidade/emoji/abreviação/travessão/bolhas) + preview vivo.
// Reusado no padrão do tenant (Conhecimento) e por missão (Assistente de missão).
// Mexer num controle marca o estilo como "Personalizado" (descola do perfil de origem).
export function EstiloControles({
  estilo,
  onChange,
}: {
  estilo: EstiloConversa
  onChange: (e: EstiloConversa) => void
}) {
  function set<K extends keyof EstiloConversa>(k: K, v: EstiloConversa[K]) {
    onChange({ ...estilo, [k]: v, perfil: null }) // ajuste manual → personalizado
  }
  const bolhasPreview = amostra(estilo)

  return (
    <div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <div className="flex items-center justify-between gap-2 sm:col-span-2">
          <span className="text-xs font-medium text-muted">Formalidade</span>
          <Segmento
            valor={estilo.formalidade}
            onChange={(v) => set('formalidade', v)}
            opcoes={[
              { v: 'informal', label: 'Informal' },
              { v: 'equilibrado', label: 'Equilibrado' },
              { v: 'formal', label: 'Formal' },
            ]}
          />
        </div>
        <Toggle ativo={estilo.emoji} onChange={(v) => set('emoji', v)} label="Usar emoji" hint="com moderação, nunca de cara" />
        <Toggle ativo={estilo.abreviacoes} onChange={(v) => set('abreviacoes', v)} label="Abreviações de WhatsApp" hint="vc, pra, tá, hj" />
        <Toggle ativo={estilo.travessaoProibido} onChange={(v) => set('travessaoProibido', v)} label="Proibir travessão (—)" hint="a maior marca de robô" />
        <Toggle ativo={estilo.bolhas} onChange={(v) => set('bolhas', v)} label="Quebrar em bolhas" hint="2-3 mensagens curtas, ritmo humano" />
      </div>

      <div className="mt-3 rounded-xl border border-line bg-surface2 p-3">
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-muted"><MessagesSquare className="h-3.5 w-3.5" /> Como fica</div>
        <div className="space-y-1.5">
          {bolhasPreview.map((b, i) => (
            <div key={i} className="w-fit max-w-[85%] rounded-2xl rounded-bl-md bg-emerald-500/15 px-3 py-1.5 text-sm text-content">{b}</div>
          ))}
        </div>
      </div>
    </div>
  )
}

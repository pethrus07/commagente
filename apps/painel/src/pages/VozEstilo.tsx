/**
 * Como a IA FALA — separado do que ela sabe (isso é o DNA): a persona/voz da marca e os
 * controles de estilo que valem como padrão da casa. Uma missão pode sobrescrever o estilo;
 * a voz do tenant entra sempre.
 */
import { useEffect, useState } from 'react'
import { Bot } from 'lucide-react'
import { EstiloControles } from '../components/EstiloControles'
import { api } from '../lib/api'
import { ESTILO_PADRAO } from '../lib/estilos-conversa'
import { toast } from '../lib/toast'
import type { EstiloConversa } from '../lib/types'
import { Button, Card, Spinner, cn } from '../lib/ui'

const campo = 'w-full rounded-xl border border-line bg-surface2 px-4 py-2 text-sm text-content placeholder:text-subtle focus:border-indigo-500/50 focus:outline-none'

const CHIPS_PERSONA = [
  'Trate o cliente por "você".',
  'Seja direto e objetivo.',
  'Nunca seja insistente ou agressivo.',
  'Sempre termine com uma pergunta.',
]

// Voz & estilo (nível TENANT): a voz da marca (persona) + o estilo PADRÃO da casa. É o FALLBACK —
// cada missão pode ter o seu perfil; quando não define, herda este. Como a IA FALA (o DNA é o que ela SABE).
export function VozEstilo() {
  const [persona, setPersona] = useState('')
  const [estilo, setEstilo] = useState<EstiloConversa>(ESTILO_PADRAO)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    api.tenant.obter()
      .then((c) => { setPersona(c.persona ?? ''); setEstilo(c.estilo ?? ESTILO_PADRAO) })
      .catch((e) => toast((e as Error).message, 'erro'))
      .finally(() => setCarregando(false))
  }, [])

  const inserir = (frag: string) => setPersona((t) => (t.trim() ? `${t.trim()} ${frag}` : frag))
  const salvar = async () => {
    setSalvando(true)
    try {
      await api.tenant.salvar({ persona: persona.trim() || null, estilo })
      toast('Voz e estilo salvos — valem já no próximo turno.', 'ok')
    } catch (e) {
      toast((e as Error).message, 'erro')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-500/15 text-indigo-300"><Bot className="h-4 w-4" /></div>
          <div>
            <h3 className="text-sm font-semibold text-content">Voz &amp; estilo <span className="text-[11px] font-normal text-subtle">(padrão da casa)</span></h3>
            <p className="text-[11px] text-muted">Como a IA <b>fala</b> em todas as missões (o <b>DNA</b> é o que ela <b>sabe</b>). Cada missão pode ter o seu perfil — quando não tem, herda este.</p>
          </div>
        </div>

        {carregando ? (
          <div className="grid place-items-center py-6"><Spinner className="h-5 w-5" /></div>
        ) : (
          <>
            <EstiloControles estilo={estilo} onChange={setEstilo} />
            <div className="mt-4">
              <label className="mb-1 block text-xs font-medium text-muted">Voz da marca (persona)</label>
              <textarea
                value={persona}
                onChange={(e) => setPersona(e.target.value)}
                rows={3}
                placeholder={'Ex.: Você é o atendente da [Empresa]. Trate por "você", seja simpático e direto. Nunca pressione o cliente.'}
                className={cn(campo, 'resize-none')}
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {CHIPS_PERSONA.map((c) => (
                  <button key={c} type="button" onClick={() => inserir(c)} className="rounded-full border border-line px-2.5 py-1 text-[11px] text-muted transition hover:border-indigo-500/40 hover:text-content">+ {c}</button>
                ))}
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-[11px] leading-snug text-subtle">O estilo governa o <b>jeito de escrever</b>; a regra anti-invenção de preço continua valendo por cima.</p>
              <Button onClick={salvar} loading={salvando}>Salvar</Button>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}

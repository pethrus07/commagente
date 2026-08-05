import { useState } from 'react'
import { ChevronDown, Dna } from 'lucide-react'
import { CATEGORIAS_DNA, type CamadaDna, type ChaveDna, type ModoDna } from '../lib/dna'
import { cn } from '../lib/ui'

const campo =
  'w-full rounded-xl border border-line bg-surface2 px-4 py-2 text-sm text-content placeholder:text-subtle focus:border-indigo-500/50 focus:outline-none'

const MODOS: { id: 'herdar' | ModoDna; rotulo: string; dica: string }[] = [
  { id: 'herdar', rotulo: 'Herdar', dica: 'Usa o DNA da empresa (padrão).' },
  { id: 'combinar', rotulo: 'Combinar', dica: 'Soma este texto ao da empresa.' },
  { id: 'substituir', rotulo: 'Substituir', dica: 'Troca só nesta campanha.' },
]

/**
 * Editor da camada de DNA da campanha (§9 Fase B). Por padrão TUDO é "Herdar" (a campanha usa o
 * DNA da empresa). O usuário muda só o que for diferente nesta campanha: Combinar (soma) ou
 * Substituir (troca). Produz o objeto {categoria: {modo, texto}} — só categorias não-Herdar.
 */
export function EditorDnaCampanha({
  valor,
  onChange,
}: {
  valor: CamadaDna
  onChange: (dna: CamadaDna) => void
}) {
  const [aberto, setAberto] = useState(false)
  const ativas = Object.keys(valor).length

  const setModo = (chave: ChaveDna, modo: 'herdar' | ModoDna) => {
    const prox = { ...valor }
    if (modo === 'herdar') delete prox[chave]
    else prox[chave] = { modo, texto: valor[chave]?.texto ?? '' }
    onChange(prox)
  }
  const setTexto = (chave: ChaveDna, texto: string) => {
    const atual = valor[chave]
    if (!atual) return
    onChange({ ...valor, [chave]: { ...atual, texto } })
  }

  return (
    <div className="rounded-xl border border-line bg-surface/40">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left"
      >
        <span className="flex items-center gap-2">
          <Dna className="h-4 w-4 text-indigo-300" />
          <span className="text-xs font-medium text-content">DNA desta campanha</span>
          {ativas > 0 && (
            <span className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-[10px] font-medium text-indigo-200">
              {ativas} ajuste{ativas === 1 ? '' : 's'}
            </span>
          )}
        </span>
        <ChevronDown className={cn('h-4 w-4 text-muted transition', aberto && 'rotate-180')} />
      </button>

      {aberto && (
        <div className="space-y-2 border-t border-line px-3 py-3">
          <p className="text-[11px] leading-snug text-muted">
            Por padrão a campanha usa o DNA da <b>empresa</b>. Mude aqui só o que for diferente nesta
            campanha — ex.: um <b>público-alvo</b> ou <b>preço</b> promocional só dela.
          </p>
          {CATEGORIAS_DNA.map((c) => {
            const atual = valor[c.chave]
            const modo: 'herdar' | ModoDna = atual?.modo ?? 'herdar'
            return (
              <div key={c.chave} className="rounded-lg border border-line bg-surface2/60 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-content">{c.titulo}</span>
                  <div className="flex gap-1">
                    {MODOS.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        title={m.dica}
                        onClick={() => setModo(c.chave, m.id)}
                        className={cn(
                          'rounded-md px-2 py-1 text-[11px] font-medium ring-1 ring-inset transition',
                          modo === m.id
                            ? 'bg-indigo-500/20 text-indigo-200 ring-indigo-500/40'
                            : 'text-muted ring-line hover:text-content',
                        )}
                      >
                        {m.rotulo}
                      </button>
                    ))}
                  </div>
                </div>
                {modo !== 'herdar' && (
                  <textarea
                    value={atual?.texto ?? ''}
                    onChange={(e) => setTexto(c.chave, e.target.value)}
                    rows={2}
                    placeholder={
                      modo === 'substituir'
                        ? `Troca "${c.titulo}" só nesta campanha…`
                        : `Soma ao "${c.titulo}" da empresa nesta campanha…`
                    }
                    className={cn(campo, 'mt-2 resize-none')}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

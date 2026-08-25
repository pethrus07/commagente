import { useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Eye,
  GitBranch,
  MessageCircle,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react'
import {
  contarPassos,
  limparRoteiro,
  MODELOS_ROTEIRO,
  novaPergunta,
  novoMenu,
  type OpcaoMenu,
  type Passo,
  type PassoMenu,
  type PassoPergunta,
  type Roteiro,
} from '../lib/roteiro'
import { cn } from '../lib/ui'

const campo =
  'w-full rounded-xl border border-line bg-surface2 px-3 py-2 text-sm text-content placeholder:text-subtle focus:border-indigo-500/50 focus:outline-none'
const campoMini =
  'rounded-lg border border-line bg-surface2 px-2.5 py-1.5 text-xs text-content placeholder:text-subtle focus:border-indigo-500/50 focus:outline-none'
const iconBtn =
  'grid h-7 w-7 place-items-center rounded-md text-muted ring-1 ring-inset ring-line transition hover:text-content disabled:opacity-30 disabled:hover:text-muted'

/**
 * Editor do MODO ROTEIRO (§FactoryHub) — a "sequência guiada" que a campanha segue.
 * Objetivo de UX: MUITO lúdico e fácil. Dois modos: Conversa livre (padrão) e Roteiro. No roteiro,
 * a pessoa monta uma lista de passos (o que a IA pergunta) e, se quiser, um Menu que ramifica o
 * caminho. Produz um Roteiro (ou null = livre). Herança ao vivo: editar aqui reflete nas missões.
 */
export function EditorRoteiro({
  valor,
  onChange,
}: {
  valor: Roteiro | null
  onChange: (r: Roteiro | null) => void
}) {
  const [aberto, setAberto] = useState(false)
  const [modo, setModo] = useState<'livre' | 'roteiro'>(valor && valor.passos.length ? 'roteiro' : 'livre')
  const [r, setR] = useState<Roteiro>(valor && valor.passos.length ? valor : { passos: [] })
  const [preview, setPreview] = useState(false)

  const total = useMemo(() => contarPassos(modo === 'roteiro' ? r : null), [modo, r])

  // toda mudança atualiza o rascunho local E propaga a versão limpa (null = livre)
  const up = (next: Roteiro) => {
    setR(next)
    onChange(limparRoteiro(next))
  }
  const irLivre = () => {
    setModo('livre')
    setPreview(false)
    onChange(null)
  }
  const irRoteiro = () => {
    // vazio → fica no estado vazio (mostra os modelos pra escolher); com passos → mantém
    setModo('roteiro')
    onChange(limparRoteiro(r))
  }
  const usarModelo = (roteiro: Roteiro) => {
    setModo('roteiro')
    up(structuredClone(roteiro))
  }

  // ── operações imutáveis sobre a lista de passos ──
  const setPasso = (i: number, p: Passo) => up({ ...r, passos: r.passos.map((x, k) => (k === i ? p : x)) })
  const delPasso = (i: number) => up({ ...r, passos: r.passos.filter((_, k) => k !== i) })
  const movePasso = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= r.passos.length) return
    const passos = [...r.passos]
    ;[passos[i], passos[j]] = [passos[j], passos[i]]
    up({ ...r, passos })
  }
  const addPergunta = () => up({ ...r, passos: [...r.passos, novaPergunta()] })
  const addMenu = () => up({ ...r, passos: [...r.passos, novoMenu()] })
  const temMenu = r.passos.some((p) => p.tipo === 'menu')

  return (
    <div className="rounded-xl border border-line bg-surface/40">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left"
      >
        <span className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-indigo-300" />
          <span className="text-xs font-medium text-content">Roteiro da conversa</span>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-medium',
              modo === 'roteiro'
                ? 'bg-indigo-500/15 text-indigo-200'
                : 'bg-surface2 text-muted',
            )}
          >
            {modo === 'roteiro' ? `${total} passo${total === 1 ? '' : 's'}` : 'conversa livre'}
          </span>
        </span>
        <ChevronDown className={cn('h-4 w-4 text-muted transition', aberto && 'rotate-180')} />
      </button>

      {aberto && (
        <div className="space-y-3 border-t border-line px-3 py-3">
          {/* seletor de modo — os dois cartões grandes */}
          <div className="grid grid-cols-2 gap-2">
            <ModoCard
              ativo={modo === 'livre'}
              onClick={irLivre}
              icon={<MessageCircle className="h-4 w-4" />}
              titulo="Conversa livre"
              dica="A IA conduz do jeito dela, guiada pelo DNA e pelo objetivo."
            />
            <ModoCard
              ativo={modo === 'roteiro'}
              onClick={irRoteiro}
              icon={<ClipboardList className="h-4 w-4" />}
              titulo="Seguir um roteiro"
              dica="A IA faz as perguntas na ordem que você definir, com a voz da marca."
            />
          </div>

          {modo === 'livre' && (
            <p className="rounded-lg bg-surface2/60 px-3 py-2 text-[11px] leading-snug text-muted">
              A IA vai conversar naturalmente pra atingir o objetivo da campanha. Quer que ela siga
              uma sequência fixa de perguntas (ex.: um cadastro)? Toque em <b>Seguir um roteiro</b>.
            </p>
          )}

          {modo === 'roteiro' && (
            <>
              {/* modelos prontos — só quando ainda está vazio */}
              {r.passos.length === 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium text-muted">Comece com um modelo:</p>
                  <div className="grid gap-1.5">
                    {MODELOS_ROTEIRO.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => usarModelo(m.roteiro)}
                        className="flex items-start gap-2.5 rounded-lg border border-line bg-surface2/60 px-3 py-2 text-left transition hover:border-indigo-500/40"
                      >
                        <span className="text-lg leading-none">{m.emoji}</span>
                        <span>
                          <span className="block text-xs font-medium text-content">{m.nome}</span>
                          <span className="block text-[11px] leading-snug text-muted">{m.descricao}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* abertura fixa (opcional) */}
              {r.passos.length > 0 && (
                <Chave
                  ligado={r.aberturaFixa !== undefined}
                  onToggle={(v) => up({ ...r, aberturaFixa: v ? '' : undefined })}
                  titulo="Começar com uma abertura fixa"
                >
                  {r.aberturaFixa !== undefined && (
                    <input
                      value={r.aberturaFixa}
                      onChange={(e) => up({ ...r, aberturaFixa: e.target.value })}
                      placeholder="Ex.: Oi! Aqui é da FactoryHub 👋"
                      className={cn(campo, 'mt-2')}
                    />
                  )}
                </Chave>
              )}

              {/* a lista de passos */}
              <div className="space-y-2">
                {r.passos.map((p, i) =>
                  p.tipo === 'menu' ? (
                    <CartaoMenu
                      key={i}
                      passo={p}
                      indice={i}
                      total={r.passos.length}
                      onChange={(np) => setPasso(i, np)}
                      onRemove={() => delPasso(i)}
                      onMover={(d) => movePasso(i, d)}
                    />
                  ) : (
                    <CartaoPergunta
                      key={i}
                      passo={p}
                      indice={i}
                      total={r.passos.length}
                      onChange={(np) => setPasso(i, np)}
                      onRemove={() => delPasso(i)}
                      onMover={(d) => movePasso(i, d)}
                    />
                  ),
                )}
              </div>

              {/* adicionar */}
              {r.passos.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={addPergunta} className={botaoAdd}>
                    <Plus className="h-3.5 w-3.5" /> Adicionar passo
                  </button>
                  {!temMenu && (
                    <button type="button" onClick={addMenu} className={botaoAdd}>
                      <GitBranch className="h-3.5 w-3.5" /> Adicionar menu (ramificar)
                    </button>
                  )}
                </div>
              )}

              {/* resumo final + ver como fica */}
              {r.passos.length > 0 && (
                <>
                  <Chave
                    ligado={!!r.resumoFinal}
                    onToggle={(v) => up({ ...r, resumoFinal: v || undefined })}
                    titulo="Terminar com resumo e confirmação"
                  />
                  <button
                    type="button"
                    onClick={() => setPreview((v) => !v)}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-xs font-medium text-indigo-200 transition hover:bg-indigo-500/15"
                  >
                    <Eye className="h-4 w-4" /> {preview ? 'Esconder' : 'Ver como fica'}
                  </button>
                  {preview && <Previsao roteiro={r} />}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

const botaoAdd =
  'inline-flex items-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-1.5 text-xs font-medium text-muted transition hover:border-indigo-500/40 hover:text-content'

function ModoCard({
  ativo,
  onClick,
  icon,
  titulo,
  dica,
}: {
  ativo: boolean
  onClick: () => void
  icon: React.ReactNode
  titulo: string
  dica: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-xl border px-3 py-2.5 text-left transition',
        ativo
          ? 'border-indigo-500/50 bg-indigo-500/10'
          : 'border-line bg-surface2/40 hover:border-line/80',
      )}
    >
      <span className={cn('flex items-center gap-1.5 text-xs font-semibold', ativo ? 'text-indigo-200' : 'text-content')}>
        {icon} {titulo}
      </span>
      <span className="mt-1 block text-[11px] leading-snug text-muted">{dica}</span>
    </button>
  )
}

// chavinha (toggle) reutilizável com filhos opcionais que aparecem quando ligada
function Chave({
  ligado,
  onToggle,
  titulo,
  children,
}: {
  ligado: boolean
  onToggle: (v: boolean) => void
  titulo: string
  children?: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-line bg-surface2/40 px-3 py-2">
      <label className="flex cursor-pointer items-center justify-between gap-2">
        <span className="text-xs font-medium text-content">{titulo}</span>
        <button
          type="button"
          role="switch"
          aria-checked={ligado}
          onClick={() => onToggle(!ligado)}
          className={cn(
            'relative h-5 w-9 shrink-0 rounded-full transition',
            ligado ? 'bg-indigo-500' : 'bg-surface2 ring-1 ring-inset ring-line',
          )}
        >
          <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all', ligado ? 'left-4' : 'left-0.5')} />
        </button>
      </label>
      {children}
    </div>
  )
}

// cartão de um passo do tipo PERGUNTA
function CartaoPergunta({
  passo,
  indice,
  total,
  onChange,
  onRemove,
  onMover,
}: {
  passo: PassoPergunta
  indice: number
  total: number
  onChange: (p: PassoPergunta) => void
  onRemove: () => void
  onMover: (d: -1 | 1) => void
}) {
  const [guardar, setGuardar] = useState(!!passo.campo)
  return (
    <div className="rounded-lg border border-line bg-surface2/60 p-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-indigo-500/15 text-[10px] font-bold text-indigo-200">
            {indice + 1}
          </span>
          A IA pergunta
        </span>
        <div className="flex items-center gap-1">
          <button type="button" className={iconBtn} disabled={indice === 0} onClick={() => onMover(-1)} title="Subir">
            <ChevronUp className="h-4 w-4" />
          </button>
          <button type="button" className={iconBtn} disabled={indice === total - 1} onClick={() => onMover(1)} title="Descer">
            <ChevronDown className="h-4 w-4" />
          </button>
          <button type="button" className={cn(iconBtn, 'hover:text-rose-300')} onClick={onRemove} title="Remover">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <textarea
        value={passo.texto}
        onChange={(e) => onChange({ ...passo, texto: e.target.value })}
        rows={2}
        placeholder="Ex.: Como posso te chamar?"
        className={cn(campo, 'resize-none')}
      />
      <div className="mt-1.5">
        {guardar || passo.campo ? (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted">💾 Guardar como</span>
            <input
              value={passo.campo ?? ''}
              onChange={(e) => onChange({ ...passo, campo: e.target.value.replace(/\s+/g, '_').toLowerCase() })}
              placeholder="nome"
              className={cn(campoMini, 'w-32')}
            />
            <button
              type="button"
              onClick={() => {
                setGuardar(false)
                onChange({ ...passo, campo: '' })
              }}
              className="text-[11px] text-subtle hover:text-muted"
            >
              remover
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setGuardar(true)}
            className="text-[11px] text-subtle transition hover:text-indigo-200"
          >
            + guardar a resposta num campo
          </button>
        )}
      </div>
    </div>
  )
}

// cartão de um passo do tipo MENU (ramifica em caminhos — 1 nível)
function CartaoMenu({
  passo,
  indice,
  total,
  onChange,
  onRemove,
  onMover,
}: {
  passo: PassoMenu
  indice: number
  total: number
  onChange: (p: PassoMenu) => void
  onRemove: () => void
  onMover: (d: -1 | 1) => void
}) {
  const [aba, setAba] = useState(0)
  const setOpcao = (k: number, o: OpcaoMenu) => onChange({ ...passo, opcoes: passo.opcoes.map((x, j) => (j === k ? o : x)) })
  const addOpcao = () => {
    onChange({ ...passo, opcoes: [...passo.opcoes, { rotulo: '', passos: [novaPergunta()] }] })
    setAba(passo.opcoes.length)
  }
  const delOpcao = (k: number) => {
    if (passo.opcoes.length <= 2) return
    onChange({ ...passo, opcoes: passo.opcoes.filter((_, j) => j !== k) })
    setAba(0)
  }
  const opcao = passo.opcoes[aba] ?? passo.opcoes[0]

  const setSub = (k: number, p: PassoPergunta) =>
    setOpcao(aba, { ...opcao, passos: opcao.passos.map((x, j) => (j === k ? p : x)) })
  const delSub = (k: number) => setOpcao(aba, { ...opcao, passos: opcao.passos.filter((_, j) => j !== k) })
  const addSub = () => setOpcao(aba, { ...opcao, passos: [...opcao.passos, novaPergunta()] })

  return (
    <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/[0.06] p-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-indigo-200">
          <GitBranch className="h-3.5 w-3.5" /> Menu — o cliente escolhe um caminho
        </span>
        <div className="flex items-center gap-1">
          <button type="button" className={iconBtn} disabled={indice === 0} onClick={() => onMover(-1)} title="Subir">
            <ChevronUp className="h-4 w-4" />
          </button>
          <button type="button" className={iconBtn} disabled={indice === total - 1} onClick={() => onMover(1)} title="Descer">
            <ChevronDown className="h-4 w-4" />
          </button>
          <button type="button" className={cn(iconBtn, 'hover:text-rose-300')} onClick={onRemove} title="Remover">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <textarea
        value={passo.texto}
        onChange={(e) => onChange({ ...passo, texto: e.target.value })}
        rows={2}
        placeholder="Ex.: Você está por aqui como empresa ou como profissional?"
        className={cn(campo, 'resize-none')}
      />

      {/* abas das opções */}
      <div className="mt-2 flex flex-wrap items-center gap-1">
        {passo.opcoes.map((o, k) => (
          <button
            key={k}
            type="button"
            onClick={() => setAba(k)}
            className={cn(
              'rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset transition',
              k === aba ? 'bg-indigo-500/20 text-indigo-100 ring-indigo-500/40' : 'text-muted ring-line hover:text-content',
            )}
          >
            {o.rotulo?.trim() || `Opção ${k + 1}`}
          </button>
        ))}
        <button type="button" onClick={addOpcao} className={cn(iconBtn, 'h-6 w-6')} title="Adicionar opção">
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* editor da opção ativa */}
      <div className="mt-2 space-y-2 rounded-lg border border-line bg-surface/40 p-2.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-muted">Nome do caminho</span>
          <input
            value={opcao.rotulo}
            onChange={(e) => setOpcao(aba, { ...opcao, rotulo: e.target.value })}
            placeholder="Empresa"
            className={cn(campoMini, 'w-40')}
          />
          {passo.opcoes.length > 2 && (
            <button type="button" onClick={() => delOpcao(aba)} className="ml-auto text-[11px] text-subtle hover:text-rose-300">
              excluir opção
            </button>
          )}
        </div>
        <p className="text-[11px] text-subtle">Se o cliente escolher isto, a IA segue com:</p>
        {opcao.passos.map((sp, k) => (
          <div key={k} className="rounded-md border border-line bg-surface2/60 p-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] font-medium text-muted">Pergunta {k + 1}</span>
              <button
                type="button"
                className={cn(iconBtn, 'h-6 w-6 hover:text-rose-300')}
                onClick={() => delSub(k)}
                disabled={opcao.passos.length <= 1}
                title="Remover"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <textarea
              value={sp.texto}
              onChange={(e) => setSub(k, { ...sp, texto: e.target.value })}
              rows={2}
              placeholder="Ex.: Qual o nome da empresa e o ramo dela?"
              className={cn(campo, 'resize-none')}
            />
            <div className="mt-1 flex items-center gap-1.5">
              <span className="text-[11px] text-muted">💾</span>
              <input
                value={sp.campo ?? ''}
                onChange={(e) => setSub(k, { ...sp, campo: e.target.value.replace(/\s+/g, '_').toLowerCase() })}
                placeholder="campo (opcional)"
                className={cn(campoMini, 'w-40')}
              />
            </div>
          </div>
        ))}
        <button type="button" onClick={addSub} className={botaoAdd}>
          <Plus className="h-3.5 w-3.5" /> passo neste caminho
        </button>
      </div>
    </div>
  )
}

// ── "Ver como fica": simula a conversa (determinístico, sem IA) ──
type Bolha = { de: 'ia' | 'cliente'; texto: string; pills?: string[] }

function simular(roteiro: Roteiro): Bolha[] {
  const bolhas: Bolha[] = []
  const r = limparRoteiro(roteiro)
  if (!r) return bolhas
  if (r.aberturaFixa) bolhas.push({ de: 'ia', texto: r.aberturaFixa })
  const perguntar = (p: PassoPergunta) => {
    bolhas.push({ de: 'ia', texto: p.texto })
    bolhas.push({ de: 'cliente', texto: p.campo ? `(responde — vira "${p.campo}")` : '(responde)' })
  }
  for (const p of r.passos) {
    if (p.tipo === 'menu') {
      bolhas.push({ de: 'ia', texto: p.texto, pills: p.opcoes.map((o) => o.rotulo) })
      const escolhida = p.opcoes[0]
      bolhas.push({ de: 'cliente', texto: `${escolhida.rotulo}` })
      escolhida.passos.forEach(perguntar)
    } else {
      perguntar(p)
    }
  }
  if (r.resumoFinal) bolhas.push({ de: 'ia', texto: 'Deixa eu confirmar os dados que você me passou… está tudo certo? ✅' })
  return bolhas
}

function Previsao({ roteiro }: { roteiro: Roteiro }) {
  const bolhas = useMemo(() => simular(roteiro), [roteiro])
  const temMenu = roteiro.passos.some((p) => p.tipo === 'menu')
  return (
    <div className="rounded-xl border border-line bg-surface2/40 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-muted">
        <Sparkles className="h-3.5 w-3.5 text-indigo-300" /> Prévia da conversa
        {temMenu && <span className="text-subtle">(mostrando o 1º caminho do menu)</span>}
      </p>
      <div className="space-y-1.5">
        {bolhas.map((b, i) => (
          <div key={i} className={cn('flex', b.de === 'ia' ? 'justify-start' : 'justify-end')}>
            <div
              className={cn(
                'max-w-[80%] rounded-2xl px-3 py-1.5 text-xs leading-snug',
                b.de === 'ia'
                  ? 'rounded-tl-sm bg-indigo-500/15 text-indigo-50'
                  : 'rounded-tr-sm bg-surface2 text-subtle italic',
              )}
            >
              {b.texto || <span className="text-subtle">(passo em branco)</span>}
              {b.pills && (
                <span className="mt-1 flex flex-wrap gap-1">
                  {b.pills.map((p, k) => (
                    <span key={k} className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] text-indigo-100">
                      {p || `opção ${k + 1}`}
                    </span>
                  ))}
                </span>
              )}
            </div>
          </div>
        ))}
        {bolhas.length === 0 && <p className="text-[11px] text-subtle">Adicione passos pra ver a prévia.</p>}
      </div>
    </div>
  )
}

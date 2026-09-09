/**
 * Só para o super-admin: os clientes da plataforma. Lista com monitoramento ao vivo (chips
 * conectados, mensagens hoje, missões ativas, última atividade, custo de IA acumulado) e a
 * criação de um tenant já com o usuário admin dele.
 */
import { useEffect, useState } from 'react'
import { Building2, LogIn, Plus, Users, Wallet, X } from 'lucide-react'
import { api } from '../lib/api'
import type { TenantSel } from '../lib/auth'
import { toast } from '../lib/toast'
import type { TenantResumo } from '../lib/types'
import { Button, Card, EmptyState, Spinner, cn, tempoRelativo } from '../lib/ui'

function NovoTenantModal({ onFechar }: { onFechar: (criou: boolean) => void }) {
  const [form, setForm] = useState({ nome: '', adminEmail: '', adminSenha: '' })
  const [salvando, setSalvando] = useState(false)

  const criar = async () => {
    if (!form.nome.trim()) return toast('Informe o nome do tenant.', 'erro')
    if (!/.+@.+\..+/.test(form.adminEmail)) return toast('E-mail do admin inválido.', 'erro')
    if (form.adminSenha.length < 6) return toast('Senha do admin: mínimo 6 caracteres.', 'erro')
    setSalvando(true)
    try {
      await api.admin.criarTenant({
        nome: form.nome.trim(),
        adminEmail: form.adminEmail.trim(),
        adminSenha: form.adminSenha,
      })
      toast('Tenant criado com o admin. 🎉', 'ok')
      onFechar(true)
    } catch (e) {
      toast((e as Error).message, 'erro')
    } finally {
      setSalvando(false)
    }
  }

  const campo = 'w-full rounded-xl border border-line bg-surface2 px-4 py-2 text-sm text-content placeholder:text-subtle focus:border-indigo-500/50 focus:outline-none'

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-md p-6">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-semibold text-content">Novo tenant (cliente)</h3>
          <button onClick={() => onFechar(false)} className="text-muted hover:text-content"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-muted">Nome do cliente</label>
            <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Retífica Granato" className={campo} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">E-mail do admin</label>
            <input value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} placeholder="admin@cliente.com" className={campo} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Senha do admin</label>
            <input type="password" value={form.adminSenha} onChange={(e) => setForm({ ...form, adminSenha: e.target.value })} placeholder="mínimo 6 caracteres" className={campo} />
          </div>
          <p className="text-[11px] leading-snug text-muted">
            Cria o tenant + o usuário administrador dele. O cliente entra com esse login e vê só os dados dele.
          </p>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onFechar(false)}>Cancelar</Button>
          <Button onClick={criar} loading={salvando}>Criar tenant</Button>
        </div>
      </Card>
    </div>
  )
}

export function Tenants({ onVerTenant }: { onVerTenant: (t: TenantSel) => void }) {
  const [tenants, setTenants] = useState<TenantResumo[] | null>(null)
  const [modal, setModal] = useState(false)

  const carregar = () =>
    api.admin.tenants().then(setTenants).catch((e) => toast((e as Error).message, 'erro'))
  useEffect(() => {
    carregar()
    const id = setInterval(carregar, 15000) // monitoramento ao vivo (§8.10): atualiza sozinho a cada 15s
    return () => clearInterval(id)
  }, [])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm text-muted">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> ao vivo
          </span>
          Cada cliente com dados isolados — atualiza a cada 15s.
        </p>
        <Button onClick={() => setModal(true)}><Plus className="h-4 w-4" /> Novo tenant</Button>
      </div>

      {tenants === null ? (
        <div className="grid place-items-center py-20"><Spinner className="h-6 w-6" /></div>
      ) : tenants.length === 0 ? (
        <EmptyState icon={<Building2 className="h-6 w-6" />} titulo="Nenhum tenant" texto="Crie o primeiro cliente." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tenants.map((t) => (
            <Card key={t.id} className="p-5">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-500/15 text-indigo-300">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium text-content">{t.nome}</p>
                  <p className="text-xs text-muted">criado {tempoRelativo(t.criadoEm)}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <Metric n={t.totalMissoes} label="missões" />
                <Metric n={t.totalContatos} label="contatos" />
                <Metric n={t.totalNumeros} label="números" />
              </div>
              {/* ao vivo (§8.10): estado atual + atividade de hoje */}
              <div className="mt-3 rounded-lg border border-line bg-surface2 px-2.5 py-2 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-medium text-content">
                    <span className={cn('h-1.5 w-1.5 rounded-full', t.numerosConectados > 0 ? 'animate-pulse bg-emerald-400' : 'bg-subtle')} /> ao vivo
                  </span>
                  <span className="text-subtle">{t.ultimaAtividade ? `ativo ${tempoRelativo(t.ultimaAtividade)}` : 'sem atividade'}</span>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-muted tabular-nums">
                  <span title="chips conectados / total"><b className={cn(t.numerosConectados > 0 ? 'text-emerald-500' : 'text-subtle')}>{t.numerosConectados}</b>/{t.totalNumeros} conectados</span>
                  <span title="mensagens hoje"><b className="text-content">{t.mensagensHoje}</b> msg hoje</span>
                  <span title="missões em conversa / na fila"><b className="text-content">{t.missoesAtivas}</b> ativas</span>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-xs text-muted">
                <Users className="h-3.5 w-3.5" /> {t.totalUsuarios} usuário{t.totalUsuarios === 1 ? '' : 's'}
              </div>
              <div className={cn('mt-1.5 flex items-center gap-1.5 text-xs', t.custoAlto ? 'font-medium text-rose-300' : 'text-muted')} title="Custo de IA acumulado (OpenAI). Alerta quando passa do teto — protege a key compartilhada.">
                <Wallet className="h-3.5 w-3.5" /> IA: R$ {t.custoBrl.toFixed(2)}{t.custoAlto && ' · ⚠️ alto'}
              </div>
              <Button variant="ghost" className="mt-4 w-full" onClick={() => onVerTenant({ id: t.id, nome: t.nome })}>
                <LogIn className="h-4 w-4" /> Abrir painel deste cliente
              </Button>
            </Card>
          ))}
        </div>
      )}

      {modal && (
        <NovoTenantModal
          onFechar={(criou) => {
            setModal(false)
            if (criou) carregar()
          }}
        />
      )}
    </div>
  )
}

function Metric({ n, label }: { n: number; label: string }) {
  return (
    <div className={cn('rounded-lg bg-surface2 py-2')}>
      <p className="text-sm font-semibold text-content">{n}</p>
      <p className="text-[11px] text-muted">{label}</p>
    </div>
  )
}

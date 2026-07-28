// ⚙️ Worker — reconciliador de status de conexão dos números (backstop de "chip caído").
// O evento connection.update chega pelo MESMO webhook que pode ser bloqueado (ufw) ou perdido;
// sem um backstop, um chip que cai fica "conectado" pra sempre no painel (invisível) e o worker
// segue tentando enviar. Aqui, a cada N min, consultamos o estado REAL na Evolution e persistimos.
import { db } from '../../core/db'
import { whatsapp } from '../../core/evolution'
import { numerosRepo } from './numeros.repo'

async function reconciliar() {
  const numeros = await db.numeroWhatsapp.findMany({
    select: { id: true, telefone: true, instanciaEvolution: true, statusConexao: true, tenantId: true },
  })
  for (const n of numeros) {
    try {
      const real = await whatsapp.statusConexao(n.instanciaEvolution)
      if (real !== n.statusConexao) {
        await numerosRepo.atualizarStatus(n.id, real)
        if (n.statusConexao === 'conectado' && real !== 'conectado') {
          console.error(`[reconciliador] CHIP CAIU: +${n.telefone} (${n.statusConexao} → ${real})`)
          await db.evento
            .create({
              data: {
                tenantId: n.tenantId,
                tipo: 'chip_desconectado',
                dados: { telefone: n.telefone, de: n.statusConexao, para: real },
              },
            })
            .catch(() => {})
        }
      }
    } catch (e) {
      // Evolution fora/instável → NÃO altera o status (evita marcar falso-desconectado)
      console.error('[reconciliador] falha ao checar', n.instanciaEvolution, (e as Error)?.message)
    }
  }
}

export function iniciarReconciliadorNumeros(intervaloMs = 5 * 60_000) {
  reconciliar().catch((e) => console.error('[reconciliador] boot falhou (ignorado):', e))
  setInterval(() => {
    reconciliar().catch((e) => console.error('[reconciliador] tick falhou (ignorado):', e))
  }, intervaloMs)
}

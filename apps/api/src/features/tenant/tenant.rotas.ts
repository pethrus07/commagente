// 🖥️ Apresentação — configuração do tenant atual (persona/identidade da IA).
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { definirPersona, obterConfigTenant } from './tenant.caso-uso'

export async function tenantRotas(app: FastifyInstance) {
  app.get('/tenant', async () => obterConfigTenant())

  // define/limpa a persona (identidade da IA) do tenant — reflete no próximo turno
  app.patch('/tenant', async (req) => {
    const { persona } = z
      .object({ persona: z.string().max(4000).nullable() })
      .parse(req.body)
    return definirPersona(persona)
  })
}

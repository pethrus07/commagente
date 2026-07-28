// 🖥️ Apresentação — configuração do tenant atual (persona + estilo de conversa da IA).
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { definirEstilo, definirPersona, obterConfigTenant } from './tenant.caso-uso'
import { estiloSchema } from './tenant.estilo'

export async function tenantRotas(app: FastifyInstance) {
  app.get('/tenant', async () => obterConfigTenant())

  // define/limpa a persona e/ou o estilo (identidade da IA) — reflete no próximo turno.
  // Aceita os dois juntos ou cada um isolado; devolve a config final.
  app.patch('/tenant', async (req) => {
    const body = z
      .object({
        persona: z.string().max(12000).nullish(), // personas ricas (guia de atendimento completo) cabem
        estilo: estiloSchema.optional(),
      })
      .parse(req.body)

    let config = await obterConfigTenant()
    if (body.persona !== undefined) config = await definirPersona(body.persona ?? null)
    if (body.estilo !== undefined) config = await definirEstilo(body.estilo)
    return config
  })
}

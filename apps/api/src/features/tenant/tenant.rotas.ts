// 🖥️ Apresentação — configuração do tenant atual (DNA + persona/voz + estilo de conversa da IA).
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { definirDna, definirEstilo, definirPersona, obterConfigTenant } from './tenant.caso-uso'
import { dnaSchema } from './tenant.dna'
import { estiloSchema } from './tenant.estilo'

export async function tenantRotas(app: FastifyInstance) {
  app.get('/tenant', async () => obterConfigTenant())

  // define/limpa a persona, o estilo e/ou o DNA (identidade da IA) — reflete no próximo turno.
  // Aceita os três juntos ou cada um isolado; devolve a config final.
  app.patch('/tenant', async (req) => {
    const body = z
      .object({
        persona: z.string().max(12000).nullish(), // personas ricas (guia de atendimento completo) cabem
        estilo: estiloSchema.optional(),
        dna: dnaSchema.partial().optional(), // conhecimento categorizado da empresa
      })
      .parse(req.body)

    let config = await obterConfigTenant()
    if (body.persona !== undefined) config = await definirPersona(body.persona ?? null)
    if (body.estilo !== undefined) config = await definirEstilo(body.estilo)
    if (body.dna !== undefined) config = await definirDna(body.dna)
    return config
  })
}

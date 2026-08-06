// 🖥️ Apresentação — rotas HTTP de conexão de número.
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  atualizarConfigNumero,
  cadastrarNumero,
  conectarNumero,
  enviarAvisoTeste,
  listarNumeros,
  statusNumero,
} from './numeros.caso-uso'

const corpoCadastro = z.object({
  telefone: z.string().min(8),
  instancia: z.string().min(1).optional(),
  apelido: z.string().max(60).nullish(),
})

const corpoConfig = z.object({
  apelido: z.string().max(60).nullish(),
  janelaInicio: z.string().optional(),
  janelaFim: z.string().optional(),
  budgetDiario: z.number().int().optional(),
  aquecimentoEstagio: z.number().int().min(1).max(5).optional(),
  maxConversasAtivas: z.number().int().optional(),
  suporteReativo: z.boolean().optional(),
  suporteObjetivo: z.string().nullish(),
  suporteTom: z.string().nullish(),
  suporteInformacoes: z.string().nullish(),
  suporteCriterio: z.string().nullish(),
  suporteModo: z.enum(['auto', 'copilot']).optional(),
  avisarEscalonamento: z.boolean().optional(),
  numeroAviso: z.string().nullish(),
})

const paramsId = z.object({ id: z.string().uuid() })

export async function numerosRotas(app: FastifyInstance) {
  // lista os números do tenant
  app.get('/numeros', async () => listarNumeros())

  // cadastra um número (chip) que depois será conectado
  app.post('/numeros', async (req, reply) => {
    const { telefone, instancia, apelido } = corpoCadastro.parse(req.body)
    const numero = await cadastrarNumero(telefone, instancia, apelido)
    reply.code(201)
    return {
      id: numero.id,
      telefone: numero.telefone,
      apelido: numero.apelido,
      instancia: numero.instanciaEvolution,
    }
  })

  // edita os knobs anti-bloqueio (janela, budget diário, cap de conversas ativas)
  app.patch('/numeros/:id', async (req) => {
    const { id } = paramsId.parse(req.params)
    const patch = corpoConfig.parse(req.body)
    return atualizarConfigNumero(id, patch)
  })

  // inicia a conexão → devolve o QR pra escanear no celular
  app.post('/numeros/:id/conectar', async (req) => {
    const { id } = paramsId.parse(req.params)
    return conectarNumero(id)
  })

  // estado atual da sessão (desconectado | conectando | conectado)
  app.get('/numeros/:id/status', async (req) => {
    const { id } = paramsId.parse(req.params)
    return statusNumero(id)
  })

  // testa o aviso de escalonamento (manda uma msg de exemplo pro destino)
  app.post('/numeros/:id/testar-aviso', async (req) => {
    const { id } = paramsId.parse(req.params)
    return enviarAvisoTeste(id)
  })
}

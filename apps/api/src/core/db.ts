import { PrismaClient } from '@prisma/client'

// Adapter Prisma da camada Infraestrutura.
// O Domínio nunca importa isto direto — fala com portas (ex.: RepositorioDeMissao).
export const db = new PrismaClient()

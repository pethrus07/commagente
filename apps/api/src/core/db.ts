// 🔌 Infraestrutura — o PrismaClient, instanciado UMA vez para o processo inteiro.
// Um client por processo é o que mantém o pool de conexões sob controle: o worker acorda a
// cada 3s, e criar um client por chamada estouraria o Postgres.
// O Domínio nunca importa isto direto — fala com portas (ex.: RepositorioDeMissao) e com os
// repositórios (*.repo.ts), que são os únicos que conhecem o Prisma.
import { PrismaClient } from '@prisma/client'

export const db = new PrismaClient()

// Backfill do RAG: indexa (chunks + embeddings) todo o conhecimento APROVADO que
// ainda não tem chunks. Rode UMA vez após ativar o RAG (ou em cada deploy novo):
//   npx tsx scripts/backfill-rag.mts
// Idempotente: só toca em itens sem chunks. Exige EMBEDDINGS_PROVIDER=openai (ou IA_PROVIDER=openai).
import 'dotenv/config'
import { db } from '../src/core/db'
import { embeddings } from '../src/core/embeddings'
import { reindexar } from '../src/features/conhecimento/conhecimento.caso-uso'

if (!embeddings.semantico) {
  console.error(
    `Provider de embeddings "${embeddings.nome}" não é semântico — defina EMBEDDINGS_PROVIDER=openai antes do backfill.`,
  )
  process.exit(1)
}

const aprovados = await db.conhecimento.findMany({
  where: { status: 'aprovado' },
  select: { id: true, titulo: true, _count: { select: { chunks: true } } },
})
const pendentes = aprovados.filter((c) => c._count.chunks === 0)
console.log(`Aprovados: ${aprovados.length} | sem chunks: ${pendentes.length}`)

let ok = 0
let falhas = 0
for (const c of pendentes) {
  try {
    await reindexar(c.id)
    const n = await db.conhecimentoChunk.count({ where: { conhecimentoId: c.id } })
    console.log(`  ✓ ${c.titulo.slice(0, 50)} → ${n} chunks`)
    ok++
  } catch (e) {
    console.log(`  ✗ ${c.titulo.slice(0, 50)}: ${(e as Error).message.slice(0, 100)}`)
    falhas++
  }
}
console.log(`Backfill concluído: ${ok} indexados, ${falhas} falhas.`)
process.exit(falhas > 0 ? 1 : 0)

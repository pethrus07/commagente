// Backfill do RAG: indexa (chunks + embeddings) o conhecimento APROVADO que ainda não
// tem chunks OU cujos chunks estão numa dimensão diferente da do provider atual (ex.:
// foram gerados sob o dublê/64-dim e agora o provider é OpenAI/1536-dim).
// Rode UMA vez após ativar o RAG, em cada deploy novo, ou após trocar o provider:
//   npx tsx scripts/backfill-rag.mts
// Idempotente: só toca no que precisa. Exige EMBEDDINGS_PROVIDER=openai (ou IA_PROVIDER=openai).
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

// dimensão esperada pelo provider atual (uma chamada de sonda)
const [sonda] = await embeddings.gerar(['dimensão'])
const DIM = sonda?.length ?? 0
console.log(`Provider "${embeddings.nome}" → dimensão ${DIM}`)

const aprovados = await db.conhecimento.findMany({
  where: { status: 'aprovado' },
  select: { id: true, titulo: true },
})

let ok = 0
let falhas = 0
let pulados = 0
for (const c of aprovados) {
  // decide se precisa reindexar: sem chunk, ou chunk numa dimensão diferente da atual
  const amostra = await db.conhecimentoChunk.findFirst({
    where: { conhecimentoId: c.id },
    select: { embedding: true },
  })
  const precisa = !amostra || amostra.embedding.length !== DIM
  if (!precisa) {
    pulados++
    continue
  }
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
console.log(`Backfill: ${ok} indexados, ${pulados} já ok, ${falhas} falhas (de ${aprovados.length} aprovados).`)
process.exit(falhas > 0 ? 1 : 0)

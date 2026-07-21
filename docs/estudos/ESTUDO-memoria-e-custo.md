# Estudo — Memória de IA e Custo (o impasse do histórico com o parceiro)

_Projeto: [[assistente-ia-whatsapp]] · Data: 2026-07-19 · Objetivo: dominar o assunto pra decidir o melhor caminho e argumentar com o parceiro._

---

## 0. A dúvida do parceiro (traduzida)

Do áudio de 19/07 (09:01) + prints:

> "Cada chat de IA tem um **ID** e guarda o histórico. Abro um chat de 3 meses atrás, pergunto, e ele responde certinho sem eu re-explicar. **Via API não tem isso também?** Abrir um canal/instância, gerar um ID, e chamar esse ID pra continuar a conversa a qualquer momento?"

E o medo por trás (prints 14:39 / 20:38):

> "A maior parte do crédito não vai ser conversar, e sim **ler o histórico** pra saber como está. Toda vez que inicia a conversa **fica caro**."

**Duas afirmações dentro disso — uma certa, uma errada:**
1. ✅ "Existe ID de conversa via API" → **VERDADE** (hoje existe).
2. ❌ "Logo, o histórico fica no servidor e a IA não precisa reler (então não paga de novo)" → **FALSO**.

---

## 1. O fato que decide tudo (fonte oficial)

A OpenAI **tem** estado de conversa no servidor hoje: a **Responses API** (`previous_response_id`) e a **Conversations API** (objeto de conversa com ID durável, sem TTL de 30 dias). Você cria um ID e continua a conversa depois — exatamente o que o parceiro imaginou.

**MAS**, direto da doc de _Conversation state_ da OpenAI:

> **"Even when using `previous_response_id`, all previous input tokens for responses in the chain are billed as input tokens in the API."**
> _(Mesmo usando o ID da resposta anterior, todos os tokens de entrada anteriores da cadeia são cobrados como tokens de entrada.)_

Traduzindo: guardar a conversa no servidor é **conveniência**, não **economia**. O modelo **relê o histórico inteiro a cada turno** e **cobra** por isso. O "ID" só evita você ter que _reenviar_ o texto — o custo de _processar_ continua.

> **Por quê?** Um LLM é **stateless** (sem estado). Ele não "lembra" nada entre chamadas. A cada chamada ele recebe um bloco de texto (o *context window*), lê tudo do zero e responde. "Memória" = alguém (você ou a OpenAI) **remontar e reenviar** o contexto toda vez. Não existe memória mágica dentro do modelo.

### Por que o ChatGPT "lembra" de um chat de 3 meses?
Porque o **app** ChatGPT guarda a thread e **reinjeta** o histórico (ou um resumo dele) a cada mensagem — e paga por isso nos bastidores. Além disso o ChatGPT tem um recurso separado de "Memory" que **extrai fatos** e reinjeta só os fatos. Não é o modelo lembrando; é engenharia de contexto por cima. Passou do tamanho do context window? Ele **trunca/resume** o começo. Ou seja: o próprio ChatGPT **já faz** o que a gente vai fazer (memória em banco + reinjeção), só que escondido.

---

## 2. Como "memória" realmente funciona (o mapa mental correto)

O que a IA sabe numa chamada = **só o que cabe na context window daquela chamada**. Existem 3 camadas (analogia de "sistema operacional", que é como o [[Letta]]/MemGPT organiza):

| Camada | Analogia | O que é | Onde vive |
|---|---|---|---|
| **Contexto ativo** | RAM | O que vai NO prompt agora (persona + estado + últimas msgs) | Enviado a cada chamada (custa tokens) |
| **Memória de recall** | Cache/SSD | Histórico buscável quando precisa | Banco de dados (só puxa o relevante) |
| **Memória de arquivo** | HD | Tudo que já rolou, ilimitado | Banco de dados (quase nunca relido inteiro) |

A arte é manter a **RAM pequena e certeira**, deixando o resto no banco e trazendo só o necessário. Isso é **exatamente** o que você chamou de "esquema de grafo: nome-projeto-status".

---

## 3. As estratégias de memória (trade-offs)

| Estratégia | Como funciona | Custo/turno | Escala? | Veredito |
|---|---|---|---|---|
| **A. Histórico cru completo** | Reenvia tudo sempre | Cresce sem parar (o medo do parceiro) | ❌ estoura context window | Só serve p/ conversa curtíssima |
| **B. Janela deslizante** | Só as últimas N msgs | Baixo e fixo | ⚠️ esquece o começo | Simples, mas perde contexto antigo |
| **C. Resumo rolante** | Resume o antigo, mantém recente | Baixo e fixo | ✅ | Ótimo p/ conversa longa |
| **D. Estado estruturado** | Guarda campos (status, missão, fatos) e injeta só isso | **Mínimo** | ✅✅ | **A base do nosso caso** |
| **E. RAG / busca** | Embedda o histórico, puxa só trechos relevantes | Baixo | ✅ | Bom p/ base de conhecimento grande |
| **F. Grafo de conhecimento** | Entidades + relações + tempo (quem, o quê, quando) | Baixo | ✅✅ | Sofisticação (Fase 2) — [[aprender-a-pensar-em-grafo]] |

**O medo do parceiro só se realiza na estratégia A.** Da B em diante o custo por turno fica **fixo** (não cresce com a idade da conversa). É esse o pulo do gato que ele não sabe.

---

## 4. Prompt caching — a alavanca de custo que ninguém citou

As APIs cacheiam automaticamente o **prefixo repetido** do prompt (persona, instruções fixas) por alguns minutos:
- **Automático**, sem mexer no código, para prefixos **> 1.024 tokens**.
- Desconto de **50%** (modelos antigos) até **90%** (modelos novos) nos tokens de entrada cacheados.
- **Dura de 5–60 minutos** de inatividade (alguns modelos já têm cache de até 24h).

**Consequência importante pro argumento:** o cache ajuda **durante** uma conversa ativa (mensagens seguidas), mas **NÃO** ajuda ao reabrir uma conversa de 3 meses — aí o histórico é reprocessado a preço cheio. Por isso, quanto **menor** o que a gente reinjeta (estado estruturado, não histórico cru), **mais barato** reabrir conversas antigas. Reforça a estratégia D/C.

---

## 5. A CONTA (números pra argumentar)

Premissas: modelo **GPT-4o mini** (barato e ótimo pra isso) — **US$0,15 / 1M** tokens de entrada, **US$0,60 / 1M** de saída, entrada cacheada **US$0,075 / 1M**. Câmbio ≈ **R$5,50/US$** (aprox.). Mensagens de WhatsApp são curtas (~25 tokens cada).

**Cenário: uma conversa de lead de 30 mensagens.**

- **Estratégia A (histórico cru, o pior caso):** o histórico cresce a cada turno. Total da conversa inteira ≈ **~30 mil tokens de entrada** → **≈ US$0,004 ≈ R$0,02**. Dois centavos pela conversa **inteira**.
- **Estratégia D (estado estruturado):** contexto **fixo** de ~900 tokens/turno, não importa se a conversa tem 30 ou 3.000 mensagens ou 3 meses. Custo parecido ou menor, e **não cresce**.

**Escala:** falar com **30 leads/dia**, cada um chegando a 30 msgs → **~R$0,70/dia ≈ R$15–20/mês** de IA. Mesmo com **centenas** de leads, fica em dezenas de reais.

> **Quando o medo do parceiro vira real?** Só em 3 casos: **(1)** usar modelo _frontier_ caro (GPT-5 / topo de linha) em vez de um mini; **(2)** histórico **gigante** reenviado cru (estratégia A com centenas de msgs); **(3)** reabrir conversas antigas sem memória compacta (sem cache, reprocessa tudo). **A memória estruturada + modelo mini + caching mata os três.**

Ou seja: você **concorda** com o parceiro que reler histórico custa — mas mostra que, **feito certo**, o custo é de **centavos**, e que a forma que ele imaginou (ID no servidor) **não economiza nada** (a doc prova).

---

## 6. O CAMINHO RECOMENDADO (best path pra este projeto)

**Memória híbrida, começando simples:**

1. **Banco de dados como fonte da verdade** (não a IA). Por lead: `status`, `missão`, `fatos extraídos`, `resumo`, `últimas N mensagens`. → liga em [[bancos-de-dados]].
2. **Montagem de contexto por turno (o "harness"):** persona (cacheada) + estado estruturado + resumo rolante + últimas msgs. RAM pequena e certeira. → liga em [[harness-engineering]].
3. **Modelo mini** (GPT-4o mini / equivalente) pra 95% das conversas; modelo caro só se uma missão exigir raciocínio pesado.
4. **Prompt caching automático** ligado (é de graça, só manter a persona no início do prompt).
5. **Conversations API é opcional** — use pela conveniência de não gerenciar histórico, sabendo que **não economiza token**. Pra ter controle de custo de verdade, gerenciar o contexto na mão (estado estruturado) é melhor.
6. **Fase 2 — grafo de memória:** [[Zep]] (grafo temporal) ou [[mem0]] transformam a memória num **grafo de entidades e relações no tempo** (lead → pediu orçamento → de chapa → em 12/07). É [[aprender-a-pensar-em-grafo]] aplicado à IA. Fica pra depois de validar o MVP.

**Decisão de modelo/API:** **NÃO** construir sobre a Assistants API — ela **será desligada em 26/08/2026**. Ir direto de **Responses + Conversations API** (ou Chat Completions + memória própria).

---

## 7. Ligações com a trilha de estudo (aplicar de verdade)

- [[aprender-a-pensar-em-grafo]] — memória de IA de ponta É um grafo (Zep/mem0). O que você já estuda pro PKM é o mesmo conceito da memória do agente.
- [[bancos-de-dados]] — a memória vive aqui: índices pra recall, o resumo/estado como colunas, histórico como tabela.
- [[harness-engineering]] — "harness" = a engenharia que monta o contexto e orquestra o LLM (é literalmente o que MemGPT/[[Letta]] chamam de memory OS). Central neste projeto.
- [[design-de-backend]] · [[multilayer-architecture]] · [[vertical-slice]] — onde a camada de memória encaixa no backend Node.

---

## 8. Munição pra argumentar com o parceiro (sem bater de frente)

- **Concorde primeiro:** "Você tem razão, existe ID de conversa via API hoje (Responses/Conversations API) — bom ponto."
- **Corrija o custo com fato:** "Só que a própria doc da OpenAI diz: mesmo com o ID, **todos os tokens do histórico são cobrados a cada turno**. O ID poupa trabalho, não dinheiro."
- **Reposicione o barato:** "O jeito barato não é guardar o chat inteiro — é guardar **status + fatos + resumo** no banco e mandar só isso. Isso é mais barato E dá **mais** contexto certo que jogar o histórico cru."
- **Traga números:** "Com modelo mini + memória estruturada, falar com 30 leads/dia custa uns **R$15–20/mês** de IA. O medo de 'ficar caro' só acontece se a gente fizer do jeito errado (histórico cru num modelo caro)."
- **Analogia:** "É a diferença entre, toda vez que abre o CRM, **reler todos os e-mails** do cliente (caro e lento) vs. bater o olho na **ficha-resumo** dele (barato e melhor). A gente faz a ficha."
- **Fecha alinhado:** "Então a gente está falando a mesma coisa — memória num banco. Só que ela mora no **nosso** banco (barato, sob controle), não 'dentro da IA'."

---

## Fontes
- OpenAI — Conversation state (cobrança com `previous_response_id`): https://developers.openai.com/api/docs/guides/conversation-state
- OpenAI — Prompt caching: https://openai.com/index/api-prompt-caching/ · https://developers.openai.com/api/docs/guides/prompt-caching
- OpenAI — Deprecations (Assistants API sunset 26/08/2026): https://developers.openai.com/api/docs/deprecations
- OpenAI — Pricing: https://developers.openai.com/api/docs/pricing
- Agent memory frameworks (2026): https://jobsbyculture.com/blog/ai-agent-memory-systems-guide-2026 · https://atlan.com/know/best-ai-agent-memory-frameworks-2026/

# Arquitetura Técnica — Assistente de IA no WhatsApp

_Projeto: [[assistente-ia-whatsapp]] · Data: 2026-07-19 · Baseado nas decisões travadas de hoje._

## Stack travado
| Camada | Escolha | Nota |
|---|---|---|
| WhatsApp | **Evolution API** (Baileys / não-oficial) | risco de ban aceito; número dedicado + aquecimento |
| Backend | **Node + Fastify + TypeScript** | perf + validação por schema |
| Banco | **PostgreSQL** (Docker) | `pgvector` reservado p/ memória em grafo (fase futura) |
| IA | **OpenAI (modelo mini)**, camada **provider-agnostic** | trocar provider = 1 arquivo |
| Fila/agenda | **Fila no Postgres + worker** | Redis/BullMQ só quando escalar |
| Painel | **React + Vite** | MVP simples |
| Orquestração | **Node puro** (sem n8n no core) | n8n opcional só na borda |
| Deploy | **Docker Compose na VPS do parceiro** | padrão leve; single-tenant, mas `tenant_id`-ready |

---

## 1. Componentes (os 7 blocos do backend)

1. **Ingestor de webhook** — recebe eventos da Evolution (mensagem recebida, status de entrega), normaliza e grava.
2. **Montador de contexto (memória)** — monta a "ficha" do lead: persona + objetivo + contexto + fatos extraídos + resumo + últimas N mensagens.
3. **Cérebro IA** — chama o LLM com *structured output*; recebe `{resposta, novo_estado, categoria, fatos_novos, precisa_humano}`.
4. **Máquina de estados da missão** — aplica a transição de estado e dispara eventos.
5. **Fila + rate-limit + agendador** — o motor anti-bloqueio; controla ritmo, budget por número, rotinas (cron).
6. **Executor de envio** — tira da fila, simula digitação, envia via Evolution, registra.
7. **API do painel** — CRUD de missões/contatos/números + leitura de status/histórico.

---

## 2. Modelo de dados (Postgres)

> Todas as tabelas com `tenant_id uuid` (single-tenant hoje, white-label sem refatorar depois).

```sql
tenants(id, nome, criado_em)

numeros_whatsapp(id, tenant_id, telefone, instancia_evolution,
  status_conexao, aquecimento_estagio, budget_diario, enviados_hoje,
  janela_inicio, janela_fim, criado_em)

contatos(id, tenant_id, telefone, nome, dados jsonb, origem, criado_em)

missao_templates(id, tenant_id, nome, objetivo, persona_prompt, tom,
  criterio_conclusao, categorias jsonb, guardrails, criado_em)   -- reutilizável = "botão"

missoes(id, tenant_id, contato_id, template_id?, numero_id,
  objetivo, contexto, estado, categoria_resultado,
  resumo, fatos jsonb, iniciada_em, concluida_em, criado_em)      -- instância

mensagens(id, tenant_id, missao_id, contato_id, direcao,          -- in|out
  conteudo, status_envio, provider_msg_id, criada_em, enviada_em)

fila_envio(id, tenant_id, missao_id, contato_id, payload,
  agendado_para, tentativas, status, criado_em)                   -- pendente|enviando|ok|erro

eventos(id, tenant_id, missao_id, tipo, dados jsonb, criado_em)   -- auditoria/timeline
```

**Relações:** `contato 1—N missões` · `template 1—N missões` · `missão 1—1 conversa (N mensagens)` · `número 1—N missões`.

---

## 3. Máquina de estados da missão

```
CONFIGURADA → NA_FILA → EM_CONVERSA ─┬─► CONCLUÍDA     (critério batido)
                                     ├─► SEM_RESPOSTA  (timeout)
                                     ├─► DESCARTADA    (não interessado)
                                     └─► ESCALADA      (guardrail / precisa humano)
                                                 ↓
                                            ARQUIVADA
```
- **NA_FILA** pode estar aguardando **janela de envio** (rate-limit) — não é erro.
- **EM_CONVERSA** alterna entre *aguardando lead* e *IA precisa responder*.
- **ESCALADA** aparece no painel pra humano assumir.

---

## 4. Fluxos

**Inbound (lead respondeu):**
```
WhatsApp → Evolution → webhook → Ingestor grava msg
   → Montador puxa ficha do lead (memória)
   → Cérebro IA (structured output)
   → Máquina de estados aplica novo_estado + salva fatos/resumo
   → resposta entra na FILA (com atraso humano)
   → Executor simula digitação e envia → Evolution → WhatsApp
```

**Outbound (iniciar missão — Modo A):**
```
Painel cria missão → estado NA_FILA
   → agendador respeita budget do número + janela + jitter
   → Executor envia 1ª mensagem → estado EM_CONVERSA
```

---

## 5. Motor anti-bloqueio (o coração)

Loop do worker a cada poucos segundos:
1. **Budget por número (aquecimento):** semana 1 = uso manual/baixíssimo; semana 2 = 10–20 msgs/dia; semana 3+ = +20% a cada poucos dias. Conta `enviados_hoje` vs `budget_diario`.
2. **Janela de horário:** só envia em horário configurável (ex.: 8h–20h).
3. **Cap de conversas ativas simultâneas:** ~4.
4. **Atrasos com jitter:** ~8s ± entre contatos novos; ~4–6s ± dentro de conversa ativa.
5. **Variação de mensagem:** nunca texto idêntico em massa (a IA gera; nada de copy-paste).
6. **Simular digitação:** enviar presença "composing" por alguns segundos proporcionais ao tamanho antes de mandar.
7. Ao enviar: `enviados_hoje++`, grava `mensagens`, atualiza estado.

---

## 6. Memória + chamada de IA

**Contexto por turno (enxuto, custo fixo — ver `ESTUDO-memoria-e-custo.md`):**
`persona (cacheada) + objetivo + contexto + fatos + resumo + últimas ~8 msgs`.

**Structured output esperado do LLM:**
```json
{
  "resposta": "texto (pode ser 1–2 bolhas)",
  "novo_estado": "em_conversa | concluida | descartada | escalada | sem_resposta",
  "categoria": "interessado | ja_tem_software | sem_fit | ...",
  "fatos_novos": { "usa_software": true, "n_funcionarios": 60 },
  "precisa_humano": false,
  "motivo_escala": null
}
```
Depois: mescla `fatos_novos` em `missoes.fatos`, atualiza `resumo` (rolante), aplica `novo_estado`, enfileira `resposta`.

---

## 7. Estrutura do repositório (vertical-slice)

```
/apps
  /api                      # Fastify + TS
    /src
      /features
        /webhook            # ingestor Evolution
        /conversa           # montar contexto + IA + enfileirar resposta
        /missoes            # criar/listar/mudar estado
        /contatos
        /fila               # worker de envio + rate-limit + cron
        /numeros            # aquecimento, budget
      /core                 # db, config, ia-provider, evolution-client
      server.ts
  /painel                   # React + Vite
/infra
  docker-compose.yml
```

---

## 8. Deploy (Docker Compose, padrão leve)

Serviços: `postgres`, `evolution-api`, `api` (Node), `painel` (estático/nginx).
Envs principais: `DATABASE_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_URL`, `OPENAI_API_KEY`, `TZ=America/Sao_Paulo`.
Webhook da Evolution → `https://<vps>/webhook`. Alvo de recurso: ~2 vCPU / 4 GB (folga confortável).

---

## Pendências técnicas
- [ ] Specs reais da VPS do parceiro (confirmar RAM/CPU).
- [ ] Escolher modelo mini específico da OpenAI + estimar custo real do piloto.
- [ ] Definir N de mensagens no contexto e política de resumo rolante.
- [ ] Estratégia de aquecimento do número dedicado (cronograma).

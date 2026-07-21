# Assistente de IA no WhatsApp — Estrutura Base da Ideia

> **Nome:** provisório / a definir (white-label). Candidatos: "Assistente", "Super-Secretária IA", nome comercial da Celiware.
> **Origem:** conversa Pedro (Pethrus) × parceiro (Celiware) em **17/07/2026** (12 prints + 19 áudios de voz do parceiro).
> **Status:** ideia em consolidação. Pedro fecha **base técnica + valor amanhã (18/07)**.
> **Fontes:** `docs/transcricoes-audios-parceiro-2026-07-17.md` + prints do WhatsApp.

---

## 1. Resumo executivo — o que é DE VERDADE

Não é (só) um "chatbot de prospecção". É um **assistente autônomo de IA que opera várias conversas de WhatsApp ao mesmo tempo, cada uma com uma "missão" definida**, executando ao longo do dia como se fosse uma secretária/pessoa humana.

Você cadastra um número, dá um **objetivo/missão + contexto + tom**, e a IA conduz a conversa (durante horas/dias) até cumprir a missão, registrando tudo e classificando o contato num pipeline. Uma pessoa configura de manhã e "solta" a assistente para falar com 30–50 pessoas no dia.

Frase do parceiro que resume: *"muitos vão ver como uma pessoa que não existe e vão pagar quase o valor de uma pessoa"* (áudio 15).

---

## 2. Conceito central: "missão por número"

Unidade básica do sistema = **(número de WhatsApp) + (missão)**.

Cada missão carrega:
- **Objetivo** — vender, qualificar, pedir orçamento, buscar fornecedor, cobrar, pesquisar, marcar reunião, dar suporte, tarefa pessoal, etc.
- **Contexto/observações** — dados da pessoa, o que já se sabe, tema da conversa.
- **Tom/sentimento** desejado da conversa.
- **Resposta esperada / critério de conclusão** — o que caracteriza "missão cumprida".
- **Categorias de saída** — ex.: interessado / já tem app / +X funcionários / não interessado.

A IA conversa sobre aquele tema pré-acordado, tenta chegar ao ponto, e marca no banco: *"estou falando com essa pessoa, status é X, já consegui estas informações, estágio concluído/não quer/não se interessa/quer parceria"* (áudio 01).

---

## 3. Modos de operação

| Modo | Descrição | Prioridade do parceiro |
|---|---|---|
| **A) Missão dirigida** | Eu escolho um contato e dou um tema/missão; a IA toca a conversa ao longo do dia. Contatos que EU já tenho/busquei. | ⭐ **1ª aplicação** (áudio 07) |
| **B) Funil automático (lead)** | Lead cai no sistema (indicação/lista) → entra no "modo automático" → funil de qualificação. | 2ª etapa |
| **C) Tarefa 1-clique** | Botão que dispara uma missão pré-configurada e recorrente (ex.: pedir água, pedir marmita, cobrar relatório). | Evolução |
| **D) Rotina agendada** | Mensagens em dias/horários fixos (ex.: seg/qua/sex 09h pedir relatório aos líderes) e volta recorrente a um contato. | Evolução |

---

## 4. Casos de uso levantados (dos áudios)

**Vendas / prospecção**
- Prospectar fabricantes de máquina: descobrir se usam app, se integram CLP/IoT, chegar ao responsável, qualificar por categoria (áudios 05, 07).
- Vender a própria plataforma ("bota ela pra vender ela mesma") — venda consultiva (áudios 16, 18).

**Compras / orçamentos**
- "Peça orçamento de chapa para este contato"; "busque fornecedor de X"; junta preços/peças, monta lista no fim do dia (áudio 09).

**Gestão / equipe**
- Cobrar relatório dos líderes seg/qua/sex em horário fixo; consolidar respostas para o gestor só ler (áudio 17).
- Acompanhar projetos em campo, cobrar pessoas, falar com o contador (áudio 13).

**Suporte**
- Cliente pedindo atendimento → IA entende a dor/problema e retorna (áudio 09).

**Rotinas / pessoal**
- 1-clique: pedir galão d'água, pedir marmita (escolhe no cardápio + endereço de entrega) (áudio 11).
- Missão pessoal: "marca um churrasco domingo com o fulano" (usa nome da esposa/filha como contexto) (áudio 08).

---

## 5. Pipeline / estágios do lead

`Novo` → `Em conversa` → `Interessado` / `Não interessado` / `Quer parceria` / `Cliente convertido` / `Sem resposta`
→ e por fim **`Missão concluída / Arquivado`** (objetivo alcançado, ciclo fechado — áudio 05).

Além do estágio, cada contato tem **categorias configuráveis por missão** (a IA separa os contatos conforme o critério definido).

---

## 6. Regras anti-bloqueio (crítico) ⚠️

Prospecção fria fora da API oficial bloqueia o chip rápido. O diferencial do produto é **controlar os números** (Pedro tem métricas de trabalho anterior; parceiro concorda no comportamento humano):

- **Mensagens diferentes** (variar texto, nunca disparo idêntico em massa).
- **~8 s** entre contatos novos.
- **~4–6 s** por mensagem alternando entre conversas ativas (digita um, pausa, troca, responde outro, volta — simula humano, áudios 03/04).
- **~4** conversas ativas simultâneas.
- Ao longo do dia: falar com 10–20–30–40 pessoas "como um humano faria".

---

## 7. Arquitetura técnica

**Recomendada (Pedro): backend Node puro, sem n8n**
```
Painel Web  →  WhatsApp (Evolution API)  →  Backend Node (Express/Fastify)  →  IA (OpenAI)  →  Banco de Dados
```
- **Evolution API** — ponte com o WhatsApp Web (sem API oficial, sem custo/msg; método "unofficial/unwrap": sessão logada via navegador, JS lê/envia/responde — áudio 02).
- **Backend Node** — orquestra tudo: inicia conversas, agenda, controla ritmo anti-bloqueio, chama a IA, atualiza status dos leads, gerencia retornos, dispara missões/botões/rotinas.
- **OpenAI** — cérebro das conversas (agentes/personas por missão).
- **Banco de dados** — leads, missões, mensagens, status, categorias, agendamentos.
- **Painel Web** — cadastrar números, criar missões, botões de tarefa, ver lista de leads e acompanhamento.

**Alternativa: com n8n** (parceiro já tem n8n na Hostinger)
```
Painel → Lista de Leads → Evolution API → n8n (orquestra) → IA (OpenAI) → Banco
```
n8n só orquestra (recebe msg, aciona IA, coleta resposta, grava). Útil se quiser integrar fácil com outros sistemas. Pedro prefere Node puro; n8n opcional.

**Infra/custo:** parceiro já tem VPS/servidor → hospedar Evolution + (n8n) local, sem custo extra. **Único custo recorrente garantido = IA.**

---

## 8. Multi-agentes / personas

- Cada missão usa um **agente = prompt pré-definido** (ex.: agente de vendas, agente de orçamentos).
- Evolução: **múltiplos agentes atuando juntos** — "como contratar mais de uma persona / especialista em várias áreas" (prints).
- Configuração de uma missão vira **botão reutilizável** (sempre inicia com o mesmo pedido/jeito — áudio 12).

---

## 9. Modelo de dados (esboço inicial)

- **contatos/leads** — número, nome, dados, categoria, estágio atual, origem (indicação/manual/lista).
- **missões** — objetivo, prompt/agente, contexto, tom, critério de conclusão, categorias de saída, recorrência/agenda.
- **conversas/mensagens** — histórico por contato (enviadas/recebidas, timestamps p/ controle de ritmo).
- **status/eventos** — mudanças de estágio, resultados extraídos, "missão cumprida".
- **agendamentos** — rotinas (dias/horários/temas), fila de disparos respeitando limites anti-bloqueio.

*(parceiro citou "arquivo JSON" no áudio 01 — mas o certo é banco relacional; JSON serve só p/ protótipo.)*

---

## 10. Ecossistema (visão de longo prazo)

Este assistente se encaixa num ecossistema maior que Pedro/parceiro já constroem (áudio 14):
- **Sistema de captação** de clientes.
- **Sistema de pontuação para quem indica** (indicação).
- **CRM inteligente** forte em vendas.
- → integrar com **"Projeto Primeiro"** / CRM Celiware / Expert Work (white-label: troca o nome, entrega logado com o "card"/sistema do cliente).

---

## 11. Modelo de negócio & precificação

- **Sociedade**: parceiro paga o desenvolvimento **e** quer dividir o produto com Pedro — vender junto, crescer junto (áudios 09, 12). "Somos o maior piloto de teste disso."
- **Alvo de preço**: **[valor-alvo] por empresa** (parceiro acha que consegue, se entregar valor de "uma pessoa/secretária") — áudios 10, 11.
- **Benchmark**: plataformas parecidas cobram R$200–300/mês, mas "como usuário; nós vamos FABRICAR" (áudio 17).
- **Go-to-market**: usar a própria plataforma para se vender (venda consultiva: entender a dor, mostrar encaixe, mensalidade mais cara, reter e evoluir). Meta: 10 → 20 → 30 mensalistas (áudios 16, 18).
- **Precificação de dev**: "um pouquinho acima" do trivial, mas parceiro pede **não cobrar caro demais no início** senão trava o começo (áudio 14). Consolidar valor justo pros dois lados.

---

## 12. MVP proposto (para validar rápido)

Escopo mínimo que prova a tese (Modo A + anti-bloqueio):
1. Painel: cadastrar número + criar missão (objetivo, contexto, tom, critério).
2. Evolution API conectada (sessão logada) — enviar/receber.
3. Loop de conversa com IA respeitando ritmo humano (4–8s, msgs variadas, ~4 ativas).
4. Estágios do lead + categorias, persistidos no banco.
5. Lista de leads com status/histórico e "missão concluída".
6. Piloto real: rodar numa empresa conhecida do parceiro, com telefone/orçamentos reais.

Depois: botões 1-clique, rotinas agendadas, funil automático de indicações, multi-agentes, integração com o CRM/ecossistema.

---

## 13. Pendências / decisões em aberto

- [ ] **Valor**: mensalidade (IA + infra) e valor de desenvolvimento — Pedro fecha 18/07.
- [ ] Arquitetura definitiva: **Node puro × n8n**.
- [ ] Banco: Postgres × SQLite (protótipo) — decidir.
- [ ] Modelo de IA/custo: OpenAI (qual modelo) × alternativas.
- [ ] Formato da sociedade Pedro × parceiro (divisão, papéis, IP).
- [ ] Nome/marca do produto (white-label).
- [ ] Escopo travado do MVP (só Modo A? já com botões?).
- [ ] Estratégia jurídica/risco de bloqueio de chip (número dedicado, aquecimento).

---

## 14. Próximos passos

1. **Amanhã (18/07)** — Pedro levanta a base técnica + custos e consolida um **valor** (dev + mensalidade). parceiro aguarda a resposta pra decidir e "já contar com isso no próximo projeto".
2. Fechar escopo do MVP e arquitetura.
3. Montar repositório base a partir deste doc.

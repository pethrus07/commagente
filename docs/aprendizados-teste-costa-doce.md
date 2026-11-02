# Aprendizados do teste ao vivo — Expedição Costa Doce (testador)

> Teste real 2026-07-22: agente de IA (tenant **PEDRO**, chip <número de teste>, modo **auto**)
> conduzindo um lead (contato de teste) para a **Expedição Costa Doce · Dezembro**:
> apresentar infos + enviar o PDF (fonte da verdade = docs do Mini Drive) + coletar documentos
> (nome, CPF, telefone, tipo, camiseta) + tirar dúvidas. ~56 mensagens trocadas.

## Veredito geral
A IA foi **muito bem no núcleo**: respondeu roteiro, datas, cegonha, eventos, hospedagem, voo,
suporte mecânico, tamanho da equipe e "quem somos" **com precisão** (tudo da fonte da verdade),
**escalou corretamente no preço** (não inventou), **enviou o PDF de verdade** e **coletou/lembrou**
nome e CPF. As falhas foram de **borda** (repetição, alucinação em detalhes fora da base) e de
**infra/anti-ban** (mal-entendidos meus na leitura), além da limitação conhecida da API não-oficial.

---

## ✅ Já corrigido (código feito nesta sessão — commit pendente)
1. **Timeout no `fetch` da Evolution** (`core/evolution/evolution.client.ts`) — um request pendurado não
   segura mais o `tick` do worker.
2. **Watchdog no worker** (`features/fila/fila.worker.ts`) — se um `tick` passar de 90s, o próximo
   destrava (`rodando`) sozinho. Self-healing contra qualquer hang.
3. **Envio de arquivo/PDF** (`sendMedia`) — porta `PortaWhatsApp.enviarDocumento` + client + executor
   + ramo no worker. A IA anexa documento de verdade.

## 🔧 A corrigir (comportamento / UX)
4. **Teto efetivo enganoso no painel.** Mostra `enviadosHoje/budgetDiario` (ex.: "20/30"), mas o
   limite real é `min(budgetDiario, tetoDiarioPorEstagio(estagio))`. Com estágio 1 (teto 20), "20/30"
   já é o teto — parece que há folga. **Fix:** exibir o teto EFETIVO (e talvez o estágio) no card do número.
5. **Duplo-texto.** Cada inbound vira um turno; quando o lead manda 2 mensagens rápidas em sequência,
   a IA responde 2x (às vezes quase idêntico). **Fix:** debounce/agrupar mensagens próximas num turno só.
6. **Guardrail frouxo fora do preço.** No preço a IA escalou certo, mas **alucinou** política de
   divisão de quartos e tamanhos de camiseta (dados que NÃO estão nas informações autorizadas).
   **Fix:** reforçar o prompt/persona — *só afirmar o que está nas informações autorizadas; para
   QUALQUER detalhe fora disso, deferir ("confirmo com a equipe") ou escalar — nunca improvisar.*
7. **Rastreio de campos coletados intermitente.** Uma vez re-pediu o nome que acabara de receber
   (depois se recuperou). **Fix:** o harness deve informar à IA o que JÁ foi coletado (dos `fatos`)
   e o que falta, de forma explícita.
8. **`sendPresence` 400 intermitente.** A chamada de presença ("digitando…") às vezes retorna
   `400 Bad Request` (payload). **Fix:** investigar o corpo esperado pela Evolution v2; tornar a
   presença best-effort (não deixar um 400 na presença abortar o envio do texto).

---

## 📱 "Aguardando esta mensagem" — item de ESTUDO e correção

### Sintoma
No **celular** do destinatário (testador), várias mensagens ficam com o reloginho + *"Aguardando
esta mensagem. Isso pode demorar um pouco."* e **não carregam** mesmo após minutos. No **PC/WhatsApp
Web** aparece tudo normal.

### Diagnóstico (não é a nossa aplicação/API)
- Do nosso lado: **todas as 22 saídas ficaram com status `ok`** (o servidor do WhatsApp **aceitou**),
  a instância Evolution estava **`open`** (conectada). O app entregou.
- "Aguardando mensagem" = o aparelho do destinatário **recebeu o texto cifrado mas não consegue
  DECIFRAR** — **dessincronização da sessão de criptografia (Signal / E2E)** do WhatsApp.
- Isso acontece **depois** de tudo que controlamos, na camada **não-oficial (Evolution/Baileys)**.
  Nosso `status = ok` vem de **SERVER_ACK** — que **NÃO garante** que o destinatário decifrou/entregou.

### O que agrava
- **Rajada de mensagens** — mandamos muitas em pouco tempo (22, com duplo-texto). Rajada atropela a
  troca de chaves Signal → o destinatário "perde" a chave da sessão → não decifra. (maior fator no
  nosso controle → liga direto com o item #5)
- **Chip novo / sessão frágil** e o **celular do chip offline/dessincronizado** (sessão multi-device).

### Hipóteses a investigar (correção)
1. **Retry receipt do Baileys.** O WhatsApp tem um mecanismo em que o destinatário pede o reenvio
   cifrado de uma mensagem que não decifrou ("retry receipt"). O Baileys resolve isso SE mantiver o
   cache de chaves (`msgRetryCounterCache`) e a store de sessão íntegros. **Investigar** se a Evolution
   v2.3.1 está tratando retry receipts / se há config de sessão/store a ajustar.
2. **Reduzir rajada** (nosso lado): rate-limit conversacional + agrupar inbounds (item #5) → menos
   mensagens, menos chance de perder chave.
3. **Saúde da sessão:** manter o celular do chip online; re-parear (novo QR) reseta a sessão Signal.
4. **Aquecimento do chip:** sessões de chip novo são instáveis; volume gradual (estágios 20→50→120…).
5. **Versão do Baileys/Evolution:** versões mais novas trazem correções de sessão/decrypt.

### Correção definitiva
**API oficial (WhatsApp Cloud API).** A Meta gerencia a criptografia e a entrega; esse problema de
"aguardando mensagem" **não existe**. É exatamente o argumento da **[escada pra API oficial](escada-api-oficial.md)**
— e agora com evidência real de campo.

---

## 📌 Nota positiva (vale pro pitch)
O que pareceu "travamento" era o **motor anti-ban funcionando**: chip em estágio 1 tem teto de
**20 envios/dia**; ao atingir 20, o worker **pausou sozinho** para proteger o número. Ou seja, o
diferencial anti-bloqueio que vendemos **funciona de verdade** — só faltou o painel deixar o teto claro (#4).

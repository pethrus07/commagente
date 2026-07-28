# Commagente — guia de apresentação

> Um panorama de tudo que o sistema faz. Serve como roteiro pra apresentar pro parceiro
> (ou pra qualquer cliente). Linguagem de benefício, mas cobrindo todas as funcionalidades.

---

## 1. A ideia em uma frase
Um **assistente de IA que opera várias conversas de WhatsApp ao mesmo tempo**, cada uma com uma **"missão"** (vender, qualificar, cobrar, dar suporte…). Ele **inicia o contato sozinho**, conduz a conversa até o objetivo, **passa pra um humano** quando precisa — tudo no **ritmo humano** pra não bloquear o número.

## 2. Por que é diferente (o fosso)
No mercado, cada ferramenta faz um pedaço. O Commagente é o único que junta os **5 atributos** ao mesmo tempo:
1. **Proativo** — a IA começa a conversa (não fica só respondendo).
2. **Missão variável** — cada conversa tem um objetivo próprio.
3. **Multi-conversa** — dezenas em paralelo.
4. **Escala pra humano** — entrega pro operador na hora certa.
5. **WhatsApp BR, barato** — pra PMEs.

E o pulo do gato: **memória coletiva** — a IA **aprende com os atendimentos** e fica melhor com o tempo. Isso quase ninguém tem.

## 3. Como funciona (o ciclo)
**Missão criada → a IA abre a conversa → conduz** (responde, tira dúvidas, coleta dados, contorna objeções) **→ cumpre o objetivo OU escala pra você → aprende pra próxima.**

---

## 4. Funcionalidades (o guia completo)

### 🎯 A. Conversas com IA ("missões")
- **Tipos de missão:** vender, qualificar, orçar, **cobrar**, suporte, ou livre. Cada tipo muda o comportamento da IA.
- **Proativa** (a IA inicia o contato) **ou reativa** (suporte 24/7: qualquer um que mandar mensagem é atendido na hora).
- **Auto vs Co-pilot:** a IA envia sozinha, **ou** escreve o rascunho e **você aprova** antes de mandar.
- **Guardrail anti-alucinação:** a IA só afirma o que está **autorizado** (preço, prazo, condições). Se não sabe, ela diz que vai confirmar e retornar — **nunca inventa**.
- **Critério de conclusão + resultado:** você define quando a missão está cumprida; a IA registra o desfecho (ex.: "reunião agendada quinta 15h", "pagamento confirmado").
- **Áudio:** entende **notas de voz** (transcreve e responde normalmente).
- **Assistente de criação em 3 passos:** modelos prontos (prospecção, follow-up, cobrança…) que já vêm preenchidos — é só ajustar.

### 🛡️ B. Anti-bloqueio (sobrevivência do chip)
O ponto mais crítico de operar WhatsApp em escala. O sistema protege o número:
- **Ritmo humano:** simula "digitando…", respeita horário comercial, espaça os envios, adiciona variação aleatória.
- **Aquecimento por estágio:** começa com poucos envios/dia e vai subindo o teto conforme o chip amadurece.
- **Saúde do número:** mede a taxa de resposta; se cair muito (sinal de risco de ban), **pausa novas iniciações automaticamente**.
- **Opt-out/opt-in (LGPD):** quem responde "PARAR" é bloqueado na hora; todo consentimento fica registrado.
- **Limite por contato:** não fica insistindo na mesma pessoa.

### 🤝 C. Escala pra humano
- Quando a IA precisa de um humano (negociação, reclamação, algo fora do escopo), ela **pausa e cai no inbox "Escalados"** com um **resumo pronto** da conversa.
- Você **assume**, responde na mão pelo painel, e depois **devolve pra IA** continuar.

### 🧠 D. Memória (a IA fica mais inteligente)
- **Individual (por contato):** lembra do que já falou com cada pessoa, entre conversas.
- **Coletiva (por empresa):** aprende objeções comuns e boas respostas; **você aprova** o que entra na base (curadoria).
- **Conhecimento por documento:** o cliente **sobe os próprios materiais** (PDF/DOCX/TXT — catálogo, cardápio, roteiro da expedição) e a IA passa a usar como **fonte da verdade**.
- **Busca inteligente (RAG):** a IA puxa só o **trecho relevante** do material pra cada pergunta — barato e escala mesmo com muita informação.

### 👥 E. CRM de contatos
- Base de leads/clientes com **importar CSV**, **importar a agenda do WhatsApp**, e **exportar**.
- **Tags:** rotular contatos (ex.: `costa-doce`, `lead-quente`, `inadimplente`) e **disparar campanha/missão pra "todos da tag X"** de uma vez.

### 📣 F. Campanhas + disparo em lote
- A **mesma missão** para N contatos (cada um vira uma conversa independente).
- Dá pra **adicionar mais contatos** a uma campanha já em andamento.

### 📅 G. Missões programadas (recorrência)
- Dispara **sozinho na data** — ex.: **cobrança mensal**, cada cliente no seu dia.
- Botão **"pago / pular este mês"**; a IA conduz ou manda um texto fixo, você escolhe.

### 🖥️ H. Painel de controle
- **Dashboard:** indicadores, funil por estágio, placar (cumpridas/perdidas), gráfico de atividade.
- **Missões em Kanban ou lista**, com o detalhe de cada conversa em **bolhas** (como o WhatsApp).
- **Números:** conectar o chip via **QR code**, ajustar os controles anti-bloqueio.
- **Tema claro e escuro.**

### 🏢 I. Multi-tenant (revenda / white-label)
- **Vários clientes na mesma plataforma, totalmente isolados** — cada um só enxerga o seu.
- **Super-admin** gerencia todos e pode "entrar" como qualquer cliente pra dar suporte.
- **Custo de IA por conversa** (visível só pro super-admin) — pra precificar a revenda com margem clara.

### ⚙️ J. Base técnica (o que dá solidez)
- **Trocável por baixo:** dá pra trocar de IA (OpenAI → outra) ou de WhatsApp (não-oficial → **API oficial**) sem reescrever o sistema.
- **Segurança de produção:** cabeçalhos seguros, limite de requisições, webhook protegido, segredos fora do código.
- **Anti-queda:** o motor de envio e o agendador se recuperam sozinhos de erros.

---

## 5. Números pra ter na ponta da língua
- **Custo de IA:** ~**R$0,06** por conversa longa (~27 trocas) → ~**R$60 a cada 1.000 conversas**. A IA é barata; o custo real é infraestrutura + chip.
- **Servidor:** ~**R$45/mês** (Hetzner) pra rodar tudo 24/7.

## 6. Onde estamos e o próximo passo
- **Pronto e testado ao vivo:** tudo acima. A IA já **vendeu numa demo real** e conduziu um atendimento completo (Costa Doce) sozinha.
- **Próximo:** **colocar no ar** (servidor 24/7) e montar a **camada comercial** (planos/cobrança) pra começar a **revender**.

---

> **Frase de efeito pra fechar:** "Não é um chatbot que responde. É um **vendedor/atendente de IA** que trabalha sozinho no WhatsApp, várias conversas ao mesmo tempo, sem bloquear o número, e chama você só quando precisa."

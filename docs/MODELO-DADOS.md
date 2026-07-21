# zapagente — Modelo de Dados

> A camada 💛 **Domínio** virando 🔌 **persistência**. Expresso concretamente em **Prisma** (`apps/api/prisma/schema.prisma`).
> Base: [ARQUITETURA-TÉCNICA §2](estudos/ARQUITETURA-TECNICA.md). Regra transversal: **toda tabela tem `tenant_id`** (single-tenant hoje, white-label sem refatorar).

## Diagrama entidade-relacionamento (ERD)

```mermaid
erDiagram
    TENANT ||--o{ NUMERO_WHATSAPP : tem
    TENANT ||--o{ CONTATO : tem
    TENANT ||--o{ MISSAO_TEMPLATE : tem
    TENANT ||--o{ MISSAO : tem
    CONTATO ||--o{ MISSAO : "é alvo de"
    MISSAO_TEMPLATE ||--o{ MISSAO : "instanciado em"
    NUMERO_WHATSAPP ||--o{ MISSAO : "conduz por"
    MISSAO ||--o{ MENSAGEM : registra
    CONTATO ||--o{ MENSAGEM : troca
    MISSAO ||--o{ FILA_ENVIO : gera
    MISSAO ||--o{ EVENTO : audita

    TENANT {
        uuid id PK
        string nome
    }
    NUMERO_WHATSAPP {
        uuid id PK
        uuid tenant_id FK
        string telefone
        string instancia_evolution
        int aquecimento_estagio
        int budget_diario
        int enviados_hoje
        string janela_inicio
        string janela_fim
    }
    CONTATO {
        uuid id PK
        uuid tenant_id FK
        string telefone
        string nome
        json dados
        string origem
    }
    MISSAO_TEMPLATE {
        uuid id PK
        uuid tenant_id FK
        string nome
        string objetivo
        string persona_prompt
        string tom
        json categorias
    }
    MISSAO {
        uuid id PK
        uuid tenant_id FK
        uuid contato_id FK
        uuid template_id FK
        uuid numero_id FK
        enum estado
        string categoria_resultado
        string resumo
        json fatos
    }
    MENSAGEM {
        uuid id PK
        uuid missao_id FK
        uuid contato_id FK
        enum direcao
        string conteudo
        enum status_envio
    }
    FILA_ENVIO {
        uuid id PK
        uuid missao_id FK
        json payload
        datetime agendado_para
        enum status
    }
    EVENTO {
        uuid id PK
        uuid missao_id FK
        string tipo
        json dados
    }
```

## As 8 tabelas (o porquê de cada uma)

| Tabela | Papel | Ligações |
|---|---|---|
| **tenants** | Cliente/empresa dona dos dados (white-label). | raiz de tudo |
| **numeros_whatsapp** | Cada chip conectado + seu estado de **aquecimento/budget** (o que o motor anti-bloqueio lê). | tenant · missões |
| **contatos** | O lead: telefone, nome, `dados` livres (`jsonb`), origem. | tenant · missões · mensagens |
| **missao_templates** | Missão **reutilizável** ("botão"): objetivo, persona, tom, categorias. | tenant · missões |
| **missoes** | A **instância viva**: contato + número + estado + `fatos`/`resumo` (a memória). | contato · template · número |
| **mensagens** | Histórico por conversa (`in`/`out`, status, timestamps p/ ritmo). | missão · contato |
| **fila_envio** | O que está pra sair, **com atraso** (`agendado_para`) — o coração anti-bloqueio. | missão · contato |
| **eventos** | Trilha de auditoria/timeline (mudança de estado, escalada…). | missão |

**Relações-chave:** `contato 1—N missões` · `template 1—N missões` · `missão 1—N mensagens` · `número 1—N missões`.

## Aplicando o Prisma

O schema está em [`apps/api/prisma/schema.prisma`](../apps/api/prisma/schema.prisma). Convenção adotada:
- **Models em PascalCase**, **campos em camelCase**, mapeados pra colunas `snake_case` via `@map`/`@@map` (banco em português, código idiomático).
- **Enums** pro que é fechado: `EstadoMissao`, `Direcao`, `StatusEnvio`, `StatusConexao` — o banco valida o estado, não só a aplicação.
- **`Json`** pro que é flexível (`dados`, `fatos`, `categorias`, `payload`).
- **Índices** onde a fila e o pipeline consultam (`status + agendado_para`, `tenant_id + estado`).

Comandos (rodar de `apps/api/`, depois que o Postgres estiver de pé via Docker):
```bash
npm install
npx prisma migrate dev --name init   # cria as tabelas + gera o client
npx prisma studio                     # inspeciona os dados no navegador
```

> O `prisma migrate` só roda com um Postgres acessível — ele chega na **fatia 1 (Fundação)** junto do `docker-compose.yml`. Por ora, o schema é a fonte da verdade do modelo.

## Onde isso encaixa nas camadas

O Prisma Client é um **detalhe de Infraestrutura**. O Domínio não o importa direto: ele fala com **portas** (ex.: `RepositorioDeMissao`), e um adapter Prisma implementa a porta. Trocar Prisma por outra coisa um dia = reescrever só o adapter (ver [ARQUITETURA §1.1](ARQUITETURA.md)).

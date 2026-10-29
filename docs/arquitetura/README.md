# Arquitetura

Três vistas do sistema, cada uma numa notação padrão.

| Vista | Notação | Responde |
|---|---|---|
| 1. Casos de uso | UML | Quem usa e para quê |
| 2. Processo | BPMN 2.0 | Como o trabalho anda, com uma raia para cada quem executa |
| 3. Arquitetura | C4, nível 2 | De que partes o sistema é feito e com quem conversa |

## Commagente · agentes de IA no WhatsApp

Plataforma multi-tenant white-label do Pedro com o parceiro: cada conversa no WhatsApp é uma missão (vender, qualificar, orçar, cobrar, suporte), a IA conduz no ritmo anti-bloqueio e escala para um humano quando precisa.

### 1. Quem usa e para quê

![Casos de uso de Commagente](./commagente-1-casos-de-uso.svg)

### 2. Da mensagem recebida à resposta no ritmo

![Processo de Commagente](./commagente-2-processo.svg)

### 3. Arquitetura

![Arquitetura de Commagente](./commagente-3-arquitetura.svg)

Para editar: [commagente.excalidraw](./commagente.excalidraw), que abre em [excalidraw.com](https://excalidraw.com) ou na extensão Excalidraw do VS Code.

## De onde vêm

Os diagramas são gerados a partir do Sinapse, o vault onde o Pedro organiza notas e projetos. Mudança feita direto aqui some na próxima publicação: o lugar de mudar é a especificação no Sinapse.

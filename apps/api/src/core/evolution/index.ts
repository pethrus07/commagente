// Seleção do provider de WhatsApp ativo (provider-agnostic), por WHATSAPP_PROVIDER — o "seam"
// da escada pra API oficial (ver docs/escada-api-oficial.md). Os dois adapters já existem:
// `evolution` (Baileys, não-oficial, permite abrir conversa fria) e `cloud` (Meta oficial,
// degrau 1 — escrito e compilando, mas nunca rodado em produção). Trocar é mudar a env: as
// features importam { whatsapp }, nunca o cliente concreto.
import { cloudApiClient } from './cloud-api.client'
import { evolutionClient } from './evolution.client'
import type { PortaWhatsApp } from './porta-whatsapp'

const PROVEDORES: Record<string, PortaWhatsApp> = {
  evolution: evolutionClient,
  cloud: cloudApiClient, // degrau 1 — WhatsApp Cloud API oficial (Meta)
}

const escolhido = process.env.WHATSAPP_PROVIDER ?? 'evolution'
export const whatsapp: PortaWhatsApp = PROVEDORES[escolhido] ?? evolutionClient

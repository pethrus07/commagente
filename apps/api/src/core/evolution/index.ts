// Seleção do provider de WhatsApp ativo (provider-agnostic) — o "seam" da escada
// pra API oficial (ver docs/escada-api-oficial.md). Hoje só o Evolution (não-oficial);
// o adapter oficial (Cloud API) pluga aqui por env, sem tocar nas features.
import { cloudApiClient } from './cloud-api.client'
import { evolutionClient } from './evolution.client'
import type { PortaWhatsApp } from './porta-whatsapp'

const PROVEDORES: Record<string, PortaWhatsApp> = {
  evolution: evolutionClient,
  cloud: cloudApiClient, // degrau 1 — WhatsApp Cloud API oficial (Meta)
}

const escolhido = process.env.WHATSAPP_PROVIDER ?? 'evolution'
export const whatsapp: PortaWhatsApp = PROVEDORES[escolhido] ?? evolutionClient

// 💛 Domínio (puro) — regras de data das missões programadas. Sem I/O.
import { config } from '../../core/config'

// data "YYYY-MM-DD" no fuso configurado (America/Sao_Paulo) para uma dada instante.
export function ymd(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: config.tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

// último dia do mês (mes: 1-12)
export function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate()
}

// dia efetivo de disparo mensal: dia 31 em mês curto cai no último dia do mês.
export function diaDeDisparoMensal(diaDoMes: number, ano: number, mes: number): number {
  return Math.min(diaDoMes, ultimoDiaDoMes(ano, mes))
}

export interface AgDatas {
  recorrencia: string
  diaDoMes: number | null
  dataUnica: Date | null
}

// o agendamento deve disparar em `hojeYMD` ("YYYY-MM-DD" no fuso BR)?
export function ehDiaDeDisparo(ag: AgDatas, hojeYMD: string): boolean {
  const [ano, mes, dia] = hojeYMD.split('-').map(Number)
  if (ag.recorrencia === 'mensal') {
    if (!ag.diaDoMes) return false
    return dia === diaDeDisparoMensal(ag.diaDoMes, ano, mes)
  }
  if (ag.recorrencia === 'uma_vez') {
    return ag.dataUnica != null && ymd(ag.dataUnica) === hojeYMD
  }
  return false
}

// referência do ciclo (idempotência + "pular este mês"):
// mensal → "YYYY-MM"; uma_vez → a própria data "YYYY-MM-DD".
export function cicloRef(ag: AgDatas, hojeYMD: string): string {
  return ag.recorrencia === 'mensal' ? hojeYMD.slice(0, 7) : hojeYMD
}

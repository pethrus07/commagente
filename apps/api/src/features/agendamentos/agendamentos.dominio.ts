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

// dia da semana (0=domingo … 6=sábado) de uma data de calendário "YYYY-MM-DD".
function diaDaSemanaYMD(hojeYMD: string): number {
  const [a, m, d] = hojeYMD.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay()
}

// nº de dias de calendário entre "YYYY-MM-DD" a e b (b - a).
function diasEntre(aYMD: string, bYMD: string): number {
  const [a1, a2, a3] = aYMD.split('-').map(Number)
  const [b1, b2, b3] = bYMD.split('-').map(Number)
  return Math.round((Date.UTC(b1, b2 - 1, b3) - Date.UTC(a1, a2 - 1, a3)) / 86_400_000)
}

// o CSV de dias-da-semana ("1,3,5") inclui `dow`?
function diasSemanaInclui(csv: string | null, dow: number): boolean {
  if (!csv) return false
  return csv
    .split(',')
    .map((s) => Number(s.trim()))
    .includes(dow)
}

export interface AgDatas {
  recorrencia: string
  diaDoMes: number | null
  dataUnica: Date | null
  intervalo: number | null
  diasSemana: string | null
  dataInicio: Date | null
  dataFim: Date | null
}

// o agendamento deve disparar em `hojeYMD` ("YYYY-MM-DD" no fuso BR)?
export function ehDiaDeDisparo(ag: AgDatas, hojeYMD: string): boolean {
  const [ano, mes, dia] = hojeYMD.split('-').map(Number)
  const dow = diaDaSemanaYMD(hojeYMD)

  // janela de vigência (não dispara antes do início nem depois do fim)
  if (ag.dataInicio && hojeYMD < ymd(ag.dataInicio)) return false
  if (ag.dataFim && hojeYMD > ymd(ag.dataFim)) return false

  switch (ag.recorrencia) {
    case 'uma_vez':
      return ag.dataUnica != null && ymd(ag.dataUnica) === hojeYMD
    case 'diario':
      return true
    case 'dias_uteis':
      return dow >= 1 && dow <= 5
    case 'fim_de_semana':
      return dow === 0 || dow === 6
    case 'semanal':
      return diasSemanaInclui(ag.diasSemana, dow)
    case 'a_cada_dias': {
      if (!ag.intervalo || ag.intervalo < 1 || !ag.dataInicio) return false
      const dd = diasEntre(ymd(ag.dataInicio), hojeYMD)
      return dd >= 0 && dd % ag.intervalo === 0
    }
    case 'a_cada_semanas': {
      if (!ag.intervalo || ag.intervalo < 1 || !ag.dataInicio) return false
      if (!diasSemanaInclui(ag.diasSemana, dow)) return false
      const semanas = Math.floor(diasEntre(ymd(ag.dataInicio), hojeYMD) / 7)
      return semanas >= 0 && semanas % ag.intervalo === 0
    }
    case 'mensal':
      return ag.diaDoMes != null && dia === diaDeDisparoMensal(ag.diaDoMes, ano, mes)
    case 'a_cada_meses': {
      if (!ag.intervalo || ag.intervalo < 1 || !ag.dataInicio || ag.diaDoMes == null) return false
      if (dia !== diaDeDisparoMensal(ag.diaDoMes, ano, mes)) return false
      const [ia, im] = ymd(ag.dataInicio).split('-').map(Number)
      const meses = (ano - ia) * 12 + (mes - im)
      return meses >= 0 && meses % ag.intervalo === 0
    }
    case 'anual':
      // dataUnica guarda o dia+mês de referência; compara MM-DD
      return ag.dataUnica != null && ymd(ag.dataUnica).slice(5) === hojeYMD.slice(5)
    default:
      return false
  }
}

// já passou o horário do dia (HH:mm no fuso BR)? Sem horário → sempre true.
export function horarioJaChegou(horario: string | null, agora: Date): boolean {
  if (!horario) return true
  const hm = new Intl.DateTimeFormat('en-GB', {
    timeZone: config.tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(agora)
  return hm >= horario
}

// referência do ciclo (idempotência + "pular este ciclo"):
// mensal/a_cada_meses → "YYYY-MM"; anual → "YYYY"; demais → o dia "YYYY-MM-DD".
export function cicloRef(ag: AgDatas, hojeYMD: string): string {
  if (ag.recorrencia === 'mensal' || ag.recorrencia === 'a_cada_meses') return hojeYMD.slice(0, 7)
  if (ag.recorrencia === 'anual') return hojeYMD.slice(0, 4)
  return hojeYMD
}

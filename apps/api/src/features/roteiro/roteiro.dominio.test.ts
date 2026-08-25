import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  lerRoteiro,
  passoAtual,
  avancar,
  instrucaoRoteiro,
  ROTEIRO_INICIO,
  type Roteiro,
} from './roteiro.dominio'

const linear: Roteiro = {
  passos: [
    { tipo: 'pergunta', texto: 'Qual seu nome?', campo: 'nome' },
    { tipo: 'pergunta', texto: 'Qual seu ramo?', campo: 'ramo' },
    { tipo: 'pergunta', texto: 'Obrigado! Posso te enviar o catálogo?' }, // sem campo (fala)
  ],
}

test('lerRoteiro: descarta passos vazios e devolve null quando não sobra nada', () => {
  assert.equal(lerRoteiro(null), null)
  assert.equal(lerRoteiro({ passos: [] }), null)
  assert.equal(lerRoteiro({ passos: [{ tipo: 'pergunta', texto: '   ' }] }), null)
  const r = lerRoteiro({ passos: [{ tipo: 'pergunta', texto: 'Oi?', campo: ' nome ' }, { tipo: 'lixo' }] })
  assert.equal(r?.passos.length, 1)
  assert.equal(r?.passos[0].texto, 'Oi?')
  assert.equal((r?.passos[0] as { campo?: string }).campo, 'nome') // trim
})

test('passoAtual: caminha do início ao fim (null no fim)', () => {
  assert.equal(passoAtual(linear, { ramo: null, idx: 0 })?.passo.texto, 'Qual seu nome?')
  assert.equal(passoAtual(linear, { ramo: null, idx: 2 })?.ehUltimo, true)
  assert.equal(passoAtual(linear, { ramo: null, idx: 3 }), null) // acabou
})

test('avancar: pergunta com campo NÃO avança se o dado não foi capturado (desvio→fica)', () => {
  const est = { ramo: null, idx: 0 }
  assert.deepEqual(avancar(linear, est, { fatos: {}, opcaoRoteiro: null }), est) // desviou
  assert.deepEqual(avancar(linear, est, { fatos: { nome: '' }, opcaoRoteiro: null }), est) // vazio não conta
  assert.deepEqual(avancar(linear, est, { fatos: { nome: 'Pedro' }, opcaoRoteiro: null }), { ramo: null, idx: 1 })
})

test('avancar: pergunta SEM campo avança após enviar', () => {
  assert.deepEqual(avancar(linear, { ramo: null, idx: 2 }, { fatos: {}, opcaoRoteiro: null }), { ramo: null, idx: 3 })
})

const comMenu: Roteiro = {
  passos: [
    { tipo: 'pergunta', texto: 'Oi! Você é empresa ou profissional?', campo: 'perfil' },
    {
      tipo: 'menu',
      texto: 'O que você procura?',
      opcoes: [
        { rotulo: 'Contratar', passos: [{ tipo: 'pergunta', texto: 'Que serviço?', campo: 'servico' }] },
        { rotulo: 'Oferecer', passos: [{ tipo: 'pergunta', texto: 'Qual sua especialidade?', campo: 'especialidade' }] },
      ],
    },
  ],
}

test('avancar: menu roteia pro ramo escolhido (idx=0 do ramo)', () => {
  const noMenu = { ramo: null, idx: 1 }
  assert.deepEqual(avancar(comMenu, noMenu, { fatos: {}, opcaoRoteiro: 'Oferecer' }), { ramo: 'Oferecer', idx: 0 })
  // casamento por conteúdo (a IA respondeu "contratar alguém")
  assert.deepEqual(avancar(comMenu, noMenu, { fatos: {}, opcaoRoteiro: 'contratar' }), { ramo: 'Contratar', idx: 0 })
  // sem escolha clara → repete o menu
  assert.deepEqual(avancar(comMenu, noMenu, { fatos: {}, opcaoRoteiro: null }), noMenu)
})

test('avancar: FALLBACK — a IA esqueceu opcao_roteiro, casa pelo texto do cliente', () => {
  const noMenu = { ramo: null, idx: 1 }
  // "quero oferecer meus serviços" → contém "Oferecer"
  assert.deepEqual(
    avancar(comMenu, noMenu, { fatos: {}, opcaoRoteiro: null, textoCliente: 'quero oferecer meus serviços' }),
    { ramo: 'Oferecer', idx: 0 },
  )
  // frase cita AS DUAS opções → ambíguo → NÃO roteia (repete o menu)
  assert.deepEqual(
    avancar(comMenu, noMenu, { fatos: {}, opcaoRoteiro: null, textoCliente: 'não quero contratar, quero oferecer' }),
    noMenu,
  )
})

test('passoAtual: dentro do ramo escolhido lê a sub-lista da opção', () => {
  assert.equal(passoAtual(comMenu, { ramo: 'Oferecer', idx: 0 })?.passo.texto, 'Qual sua especialidade?')
  assert.equal(passoAtual(comMenu, { ramo: 'Oferecer', idx: 1 }), null) // fim do ramo
  assert.equal(passoAtual(comMenu, { ramo: 'inexistente', idx: 0 }), null) // ramo desconhecido = fim
})

test('instrucaoRoteiro: pergunta pede captura; menu lista rótulos; fim usa resumo se ligado', () => {
  const passo0 = instrucaoRoteiro(linear, ROTEIRO_INICIO)
  assert.match(passo0!.instrucao, /Qual seu nome/)
  assert.match(passo0!.instrucao, /fatos_novos\["nome"\]/)
  assert.equal(passo0!.menu, undefined)

  const menu = instrucaoRoteiro(comMenu, { ramo: null, idx: 1 })
  assert.deepEqual(menu!.menu, ['Contratar', 'Oferecer'])
  assert.match(menu!.instrucao, /opcao_roteiro/)
  assert.match(menu!.instrucao, /fatos_novos/) // instrui a NÃO usar fatos_novos pra escolha

  // fim sem resumo = null; com resumo = instrução de fechamento
  assert.equal(instrucaoRoteiro(linear, { ramo: null, idx: 3 }), null)
  const comResumo: Roteiro = { ...linear, resumoFinal: true }
  assert.match(instrucaoRoteiro(comResumo, { ramo: null, idx: 3 })!.instrucao, /RESUMO/)
})

test('instrucaoRoteiro: encadeia a PRÓXIMA pergunta (evita a mensagem sem saída)', () => {
  // no passo 0 (nome), a instrução já emenda a próxima pergunta (ramo)
  const i0 = instrucaoRoteiro(linear, ROTEIRO_INICIO)!
  assert.match(i0.instrucao, /Qual seu ramo/) // próxima pergunta embutida
  // no penúltimo passo cujo próximo NÃO é pergunta (é fala sem campo), não força emenda literal
  const i1 = instrucaoRoteiro(linear, { ramo: null, idx: 1 })!
  assert.match(i1.instrucao, /Qual seu ramo/) // pergunta atual
})

test('instrucaoRoteiro: abertura fixa só entra no primeiro passo', () => {
  const r: Roteiro = { aberturaFixa: 'Olá, aqui é da FactoryHub!', passos: linear.passos }
  assert.match(instrucaoRoteiro(r, ROTEIRO_INICIO)!.instrucao, /FactoryHub/)
  assert.doesNotMatch(instrucaoRoteiro(r, { ramo: null, idx: 1 })!.instrucao, /FactoryHub/)
})

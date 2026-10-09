// Dados fictícios da demonstração.
//
// Todos os nomes de funcionários (exceto os perfis informados pela empresa), placas,
// quilometragens, valores e fornecedores são INVENTADOS. Nenhum número representa
// dados reais da Vieira Serviços e Transportes.
//
// Em vez de gravar registros prontos, o gerador "opera" o sistema em ordem
// cronológica usando as mesmas funções de serviço da interface. Assim, saldos de
// estoque, despesas, históricos e situação dos veículos ficam sempre consistentes.
// As datas são relativas ao dia em que os dados são gerados (últimos ~100 dias).

import { VERSAO_DADOS } from "./constants.js";
import { store } from "./storage.js";
import { definirRelogio } from "./services/core.js";
import * as S from "./services/index.js";
import { isoData, somarDias, arred } from "./utils.js";

export const errosGeracao = [];

export function estadoVazio() {
  return {
    versao: VERSAO_DADOS,
    geradoEm: null,
    sessao: { usuarioId: "USR-07" },
    seq: {},
    usuarios: [],
    veiculos: [],
    solicitacoes: [],
    ordens: [],
    compras: [],
    materiais: [],
    unidades: [],
    movimentos: [],
    destinacoes: [],
    abastecimentos: [],
    leituras: [],
    despesas: [],
    auditoria: [],
  };
}

function criarAleatorio(semente) {
  let a = semente >>> 0;
  const rnd = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    entre: (min, max) => min + rnd() * (max - min),
    inteiro: (min, max) => Math.floor(min + rnd() * (max - min + 1)),
    escolher: (lista) => lista[Math.floor(rnd() * lista.length)],
    chance: (p) => rnd() < p,
  };
}

// ---------------------------------------------------------------------------
// Cadastros base
// ---------------------------------------------------------------------------

const USUARIOS = [
  {
    id: "USR-01",
    nome: "Antônio Batista",
    funcao: "Chefe de oficina",
    setor: "Oficina",
    perfil: "oficina",
    cidade: "teresina",
    demo: true,
  },
  {
    id: "USR-02",
    nome: "Gabriel",
    funcao: "Comprador",
    setor: "Compras",
    perfil: "comprador",
    cidade: "teresina",
    demo: true,
  },
  {
    id: "USR-03",
    nome: "Luiz Henrique",
    funcao: "Gerente",
    setor: "Gerência operacional",
    perfil: "gerente",
    cidade: "teresina",
    demo: true,
  },
  {
    id: "USR-04",
    nome: "Daniele",
    funcao: "Financeiro",
    setor: "Financeiro",
    perfil: "financeiro",
    cidade: "teresina",
    demo: true,
  },
  {
    id: "USR-05",
    nome: "Pedro",
    funcao: "Fiscal",
    setor: "Fiscalização de frota",
    perfil: "fiscal",
    cidade: "teresina",
    demo: true,
  },
  {
    id: "USR-06",
    nome: "Márcia",
    funcao: "Operacional",
    setor: "Operações",
    perfil: "operacional",
    cidade: "teresina",
    demo: true,
  },
  {
    id: "USR-07",
    nome: "Diretor Vieira",
    funcao: "Diretor",
    setor: "Diretoria",
    perfil: "diretor",
    cidade: "teresina",
    demo: true,
  },
  {
    id: "USR-08",
    nome: "Rafael Moura",
    funcao: "Fiscal (segundo fiscal)",
    setor: "Fiscalização de frota",
    perfil: "fiscal",
    cidade: "oeiras",
    demo: true,
  },
  {
    id: "USR-09",
    nome: "José Ribamar Lima",
    funcao: "Mecânico",
    setor: "Oficina",
    perfil: "mecanico",
    cidade: "teresina",
    demo: false,
  },
  {
    id: "USR-10",
    nome: "Francisco das Chagas",
    funcao: "Mecânico",
    setor: "Oficina",
    perfil: "mecanico",
    cidade: "oeiras",
    demo: false,
  },
  {
    id: "USR-11",
    nome: "Joaquim Alves",
    funcao: "Eletricista automotivo",
    setor: "Oficina",
    perfil: "mecanico",
    cidade: "teresina",
    demo: false,
  },
  {
    id: "USR-12",
    nome: "Valdir Santos",
    funcao: "Mecânico",
    setor: "Oficina",
    perfil: "mecanico",
    cidade: "angical",
    demo: false,
  },
];

const MODELOS = {
  fh: {
    tipo: "Cavalo mecânico",
    modelo: "Volvo FH 460",
    combustivel: "Diesel S10",
    kml: 2.45,
    kmDia: [180, 260],
    intervalo: [4, 6],
    anos: [2016, 2023],
    kmAno: [95000, 125000],
  },
  scania: {
    tipo: "Cavalo mecânico",
    modelo: "Scania R 450",
    combustivel: "Diesel S10",
    kml: 2.55,
    kmDia: [180, 260],
    intervalo: [4, 6],
    anos: [2017, 2024],
    kmAno: [95000, 125000],
  },
  atego: {
    tipo: "Caminhão",
    modelo: "Mercedes-Benz Atego 2430",
    combustivel: "Diesel S10",
    kml: 3.3,
    kmDia: [110, 180],
    intervalo: [6, 9],
    anos: [2015, 2023],
    kmAno: [50000, 75000],
  },
  constellation: {
    tipo: "Caminhão",
    modelo: "Volkswagen Constellation 24.280",
    combustivel: "Diesel S10",
    kml: 3.1,
    kmDia: [110, 180],
    intervalo: [6, 9],
    anos: [2015, 2022],
    kmAno: [50000, 75000],
  },
  axor: {
    tipo: "Caminhão basculante",
    modelo: "Mercedes-Benz Axor 3131",
    combustivel: "Diesel S10",
    kml: 2.7,
    kmDia: [80, 140],
    intervalo: [6, 9],
    anos: [2014, 2021],
    kmAno: [35000, 55000],
  },
  delivery: {
    tipo: "Caminhão leve",
    modelo: "Volkswagen Delivery 11.180",
    combustivel: "Diesel S10",
    kml: 5.4,
    kmDia: [90, 150],
    intervalo: [7, 10],
    anos: [2018, 2024],
    kmAno: [35000, 50000],
  },
  volare: {
    tipo: "Micro-ônibus",
    modelo: "Volare W9",
    combustivel: "Diesel S10",
    kml: 6.2,
    kmDia: [110, 180],
    intervalo: [6, 9],
    anos: [2017, 2023],
    kmAno: [40000, 60000],
  },
  master: {
    tipo: "Van",
    modelo: "Renault Master",
    combustivel: "Diesel S10",
    kml: 9.2,
    kmDia: [80, 140],
    intervalo: [7, 10],
    anos: [2019, 2024],
    kmAno: [30000, 45000],
  },
  hilux: {
    tipo: "Picape",
    modelo: "Toyota Hilux",
    combustivel: "Diesel S10",
    kml: 9.8,
    kmDia: [70, 130],
    intervalo: [7, 11],
    anos: [2018, 2024],
    kmAno: [28000, 42000],
  },
  strada: {
    tipo: "Picape",
    modelo: "Fiat Strada",
    combustivel: "Gasolina",
    kml: 11.6,
    kmDia: [50, 100],
    intervalo: [8, 12],
    anos: [2019, 2024],
    kmAno: [22000, 35000],
  },
  fiorino: {
    tipo: "Utilitário",
    modelo: "Fiat Fiorino",
    combustivel: "Gasolina",
    kml: 11.2,
    kmDia: [50, 95],
    intervalo: [8, 12],
    anos: [2018, 2023],
    kmAno: [22000, 35000],
  },
};

// Frota 101–140, distribuída entre as quatro cidades.
const DISTRIBUICAO = [
  [
    "teresina",
    [
      "fh",
      "fh",
      "fh",
      "scania",
      "scania",
      "atego",
      "atego",
      "atego",
      "constellation",
      "constellation",
      "delivery",
      "master",
      "hilux",
      "hilux",
      "strada",
    ],
  ],
  [
    "oeiras",
    [
      "scania",
      "atego",
      "atego",
      "axor",
      "axor",
      "volare",
      "hilux",
      "strada",
      "fiorino",
    ],
  ],
  [
    "jatoba",
    [
      "fh",
      "constellation",
      "constellation",
      "axor",
      "axor",
      "delivery",
      "master",
      "hilux",
      "strada",
    ],
  ],
  [
    "angical",
    ["atego", "atego", "constellation", "axor", "volare", "hilux", "fiorino"],
  ],
];

// [código, nome, categoria, unidade, mínimo, custo, depósito, rastreável, saldo inicial]
const MATERIAIS = [
  [
    "PNE-225R",
    "Pneu 295/80 R22.5 recapado",
    "pneus",
    "un",
    8,
    1120,
    "teresina",
    true,
    12,
  ],
  [
    "PNE-225N",
    "Pneu 295/80 R22.5 novo",
    "pneus",
    "un",
    4,
    2890,
    "teresina",
    true,
    6,
  ],
  [
    "PNE-R17",
    "Pneu 265/65 R17 (picapes)",
    "pneus",
    "un",
    4,
    890,
    "teresina",
    false,
    8,
  ],
  [
    "BAT-150",
    "Bateria 150 Ah (veículos pesados)",
    "baterias",
    "un",
    4,
    960,
    "teresina",
    true,
    5,
  ],
  [
    "BAT-060",
    "Bateria 60 Ah (veículos leves)",
    "baterias",
    "un",
    3,
    510,
    "teresina",
    true,
    4,
  ],
  [
    "FIL-OLP",
    "Filtro de óleo (pesados)",
    "filtros",
    "un",
    10,
    76,
    "teresina",
    false,
    14,
  ],
  [
    "FIL-OLL",
    "Filtro de óleo (leves)",
    "filtros",
    "un",
    6,
    38,
    "teresina",
    false,
    16,
  ],
  [
    "FIL-COMB",
    "Filtro de combustível diesel",
    "filtros",
    "un",
    10,
    92,
    "teresina",
    false,
    13,
  ],
  [
    "FIL-AR",
    "Filtro de ar primário",
    "filtros",
    "un",
    6,
    210,
    "teresina",
    false,
    9,
  ],
  [
    "FIL-SEP",
    "Filtro separador de água",
    "filtros",
    "un",
    6,
    118,
    "teresina",
    false,
    6,
  ],
  [
    "LUB-15W40",
    "Óleo de motor 15W40",
    "lubrificantes",
    "L",
    120,
    24.2,
    "teresina",
    false,
    260,
  ],
  [
    "LUB-80W90",
    "Óleo de câmbio 80W90",
    "lubrificantes",
    "L",
    40,
    32,
    "teresina",
    false,
    60,
  ],
  [
    "LUB-GRX",
    "Graxa de chassi",
    "lubrificantes",
    "kg",
    20,
    21,
    "teresina",
    false,
    45,
  ],
  [
    "LUB-ARLA",
    "ARLA 32",
    "lubrificantes",
    "L",
    200,
    3.85,
    "oeiras",
    false,
    380,
  ],
  [
    "LUB-ARREF",
    "Aditivo de arrefecimento",
    "lubrificantes",
    "L",
    30,
    18,
    "teresina",
    false,
    46,
  ],
  [
    "PEC-PAST",
    "Pastilha de freio dianteira (leves)",
    "pecas",
    "jogo",
    4,
    155,
    "teresina",
    false,
    3,
  ],
  [
    "PEC-LONA",
    "Lona de freio (pesados)",
    "pecas",
    "jogo",
    4,
    410,
    "teresina",
    false,
    3,
  ],
  [
    "PEC-TAMB",
    "Tambor de freio traseiro",
    "pecas",
    "un",
    2,
    680,
    "teresina",
    false,
    2,
  ],
  [
    "PEC-CORR",
    "Correia do alternador",
    "pecas",
    "un",
    4,
    140,
    "teresina",
    false,
    5,
  ],
  [
    "PEC-AMORT",
    "Amortecedor traseiro (pesados)",
    "pecas",
    "un",
    4,
    520,
    "teresina",
    false,
    3,
  ],
  [
    "PEC-EMBR",
    "Kit de embreagem (pesados)",
    "pecas",
    "kit",
    1,
    3800,
    "teresina",
    false,
    0,
  ],
  ["PEC-CRUZ", "Cruzeta do cardã", "pecas", "un", 2, 260, "teresina", false, 4],
  [
    "ELE-LAMP",
    "Lâmpada H7 24V",
    "eletrica",
    "un",
    10,
    21,
    "teresina",
    false,
    14,
  ],
  [
    "ELE-REL",
    "Relé auxiliar 24V",
    "eletrica",
    "un",
    5,
    34,
    "teresina",
    false,
    5,
  ],
  [
    "ELE-MOTP",
    "Motor de partida recondicionado",
    "eletrica",
    "un",
    1,
    1450,
    "teresina",
    false,
    2,
  ],
  [
    "OUT-ABR",
    "Abraçadeira metálica",
    "outros",
    "un",
    50,
    2.8,
    "teresina",
    false,
    120,
  ],
  ["OUT-FITA", "Fita isolante", "outros", "un", 10, 7.5, "teresina", false, 24],
  ["OUT-PANO", "Estopa (pacote)", "outros", "pct", 10, 12, "oeiras", false, 8],
];

// Pneus e baterias já instalados quando o controle individual foi implantado.
const IMPLANTADOS = [
  [101, "BAT-150", ["Bateria 1", "Bateria 2"]],
  [103, "PNE-225R", ["Dianteiro esquerdo", "Dianteiro direito"]],
  [103, "BAT-150", ["Bateria 1", "Bateria 2"]],
  [105, "BAT-150", ["Bateria 1", "Bateria 2"]],
  [110, "BAT-150", ["Bateria 1", "Bateria 2"]],
  [117, "BAT-150", ["Bateria 1", "Bateria 2"]],
  [128, "PNE-225R", ["Tração direito externo", "Tração direito interno"]],
  [132, "BAT-060", ["Bateria 1"]],
];

// ---------------------------------------------------------------------------
// Cenários de manutenção (n = dias atrás em que a solicitação foi aberta)
// ---------------------------------------------------------------------------

const MANUTENCOES = [
  {
    k: "m1",
    frota: 102,
    n: 88,
    prio: "media",
    sol: "USR-06",
    mec: "USR-09",
    fim: "concluida",
    dur: 1,
    desc: "Revisão preventiva programada: troca de óleo, filtros e verificação geral.",
    diag: "Revisão preventiva conforme plano do fabricante.",
    pecas: [
      ["FIL-OLP", 1],
      ["FIL-COMB", 2],
      ["FIL-AR", 1],
      ["LUB-15W40", 40],
    ],
    servico:
      "Troca de óleo do motor e dos filtros de óleo, combustível e ar; inspeção de freios e suspensão.",
    est: 450,
    custo: 380,
  },
  {
    k: "m2",
    frota: 117,
    n: 81,
    prio: "alta",
    sol: "USR-08",
    mec: "USR-10",
    fim: "concluida",
    dur: 2,
    desc: "Ruído metálico no freio traseiro ao frear com o veículo carregado.",
    diag: "Lonas no limite de desgaste e tambor traseiro esquerdo riscado.",
    pecas: [
      ["PEC-LONA", 1],
      ["PEC-TAMB", 1],
    ],
    servico:
      "Substituição das lonas traseiras e do tambor esquerdo; regulagem do freio.",
    est: 600,
    custo: 520,
  },
  {
    k: "m3",
    frota: 132,
    n: 76,
    prio: "media",
    sol: "USR-05",
    mec: "USR-11",
    fim: "concluida",
    dur: 0,
    desc: "Bateria não segura carga; veículo não liga pela manhã.",
    diag: "Bateria com célula danificada. Alternador testado e aprovado.",
    pecas: [["BAT-060", 1, "Bateria 1"]],
    retirar: { codigo: "BAT-060", destino: "descarte" },
    servico: "Substituição da bateria e teste do sistema de carga.",
    est: 0,
    custo: 0,
  },
  {
    k: "m4",
    frota: 106,
    n: 70,
    prio: "alta",
    sol: "USR-01",
    mec: "USR-09",
    fim: "concluida",
    dur: 2,
    desc: "Vazamento de óleo no cárter identificado durante inspeção de pátio.",
    diag: "Junta do cárter ressecada e abraçadeiras soltas.",
    pecas: [
      ["LUB-15W40", 20],
      ["OUT-ABR", 4],
    ],
    servico: "Troca da junta do cárter, reaperto e reposição do óleo.",
    est: 500,
    custo: 450,
  },
  {
    k: "m5",
    frota: 119,
    n: 63,
    prio: "alta",
    sol: "USR-08",
    mec: "USR-10",
    fim: "concluida",
    dur: 3,
    desc: "Superaquecimento do motor em subidas com carga.",
    diag: "Radiador parcialmente obstruído e correia com folga.",
    pecas: [
      ["LUB-ARREF", 20],
      ["PEC-CORR", 1],
    ],
    servico:
      "Limpeza do radiador em oficina externa, troca da correia e do aditivo.",
    est: 800,
    custo: 690,
    cat: "servicos_externos",
  },
  {
    k: "m6",
    frota: 137,
    n: 55,
    prio: "media",
    sol: "USR-08",
    mec: "USR-09",
    fim: "concluida",
    dur: 1,
    desc: "Pneus de tração com desgaste irregular.",
    diag: "Desgaste irregular por desalinhamento do eixo de tração.",
    pecas: [
      ["PNE-225R", 1, "Tração esquerdo externo"],
      ["PNE-225R", 1, "Tração esquerdo interno"],
    ],
    servico:
      "Substituição de dois pneus de tração, alinhamento e balanceamento.",
    est: 250,
    custo: 180,
  },
  {
    k: "m7",
    frota: 109,
    n: 47,
    prio: "media",
    sol: "USR-06",
    mec: "USR-11",
    fim: "concluida",
    dur: 1,
    desc: "Luz de injeção eletrônica acesa no painel.",
    diag: "Relé auxiliar com mau contato; diagnóstico eletrônico em oficina parceira.",
    pecas: [["ELE-REL", 1]],
    servico: "Diagnóstico eletrônico externo e substituição do relé auxiliar.",
    est: 400,
    custo: 350,
    cat: "servicos_externos",
  },
  {
    k: "m8",
    frota: 121,
    n: 40,
    prio: "baixa",
    sol: "USR-08",
    mec: "USR-11",
    fim: "concluida",
    dur: 4,
    desc: "Ar-condicionado do micro-ônibus sem refrigeração.",
    diag: "Vazamento no condensador; necessária recarga de gás.",
    pecas: [],
    servico:
      "Reparo do condensador e recarga do sistema de ar-condicionado (serviço externo).",
    est: 900,
    custo: 780,
    cat: "servicos_externos",
  },
  {
    k: "m9",
    frota: 104,
    n: 33,
    prio: "media",
    sol: "USR-05",
    mec: "USR-09",
    fim: "concluida",
    dur: 1,
    desc: "Revisão preventiva: troca de óleo, filtros e lubrificação do chassi.",
    diag: "Revisão preventiva conforme plano do fabricante.",
    pecas: [
      ["FIL-OLP", 1],
      ["FIL-COMB", 2],
      ["FIL-SEP", 1],
      ["LUB-15W40", 38],
      ["LUB-GRX", 4],
    ],
    servico: "Troca de óleo, filtros e lubrificação geral do chassi.",
    est: 480,
    custo: 420,
  },
  {
    k: "m10",
    frota: 129,
    n: 26,
    prio: "alta",
    sol: "USR-05",
    mec: "USR-09",
    fim: "concluida",
    dur: 3,
    desc: "Folga na direção e ruído na suspensão traseira.",
    diag: "Amortecedores traseiros sem carga e terminal de direção com folga.",
    pecas: [["PEC-AMORT", 2]],
    servico: "Substituição dos amortecedores traseiros e ajuste da direção.",
    est: 700,
    custo: 640,
  },
  {
    k: "m11",
    frota: 113,
    n: 19,
    prio: "media",
    sol: "USR-06",
    mec: "USR-09",
    fim: "concluida",
    dur: 0,
    desc: "Pastilhas de freio dianteiras gastas (aviso sonoro).",
    diag: "Pastilhas no limite; discos em bom estado.",
    pecas: [["PEC-PAST", 1]],
    servico: "Substituição das pastilhas dianteiras.",
    est: 180,
    custo: 150,
  },
  {
    k: "m12",
    frota: 135,
    n: 12,
    prio: "baixa",
    sol: "USR-08",
    mec: "USR-10",
    fim: "concluida",
    dur: 0,
    desc: "Lâmpadas da sinalização traseira queimadas.",
    diag: "Quatro lâmpadas queimadas; chicote sem avarias.",
    pecas: [["ELE-LAMP", 4]],
    servico: "Substituição das lâmpadas de sinalização.",
    est: 0,
    custo: 0,
  },
  {
    k: "m13",
    frota: 110,
    n: 8,
    prio: "baixa",
    sol: "USR-06",
    mec: "USR-09",
    fim: "concluida",
    dur: 1,
    desc: "Troca de óleo programada por quilometragem.",
    diag: "Troca de óleo e filtro conforme quilometragem.",
    pecas: [
      ["FIL-OLP", 1],
      ["LUB-15W40", 32],
    ],
    servico: "Troca de óleo do motor e do filtro de óleo.",
    est: 200,
    custo: 180,
  },
  {
    k: "m14",
    frota: 114,
    n: 30,
    prio: "baixa",
    sol: "USR-06",
    fim: "cancelada",
    desc: "Barulho no painel ao passar em trechos irregulares.",
    motivoCancel:
      "Solicitação duplicada; ruído resolvido com fixação simples pelo motorista.",
  },
  {
    k: "m15",
    frota: 103,
    n: 6,
    prio: "critica",
    sol: "USR-05",
    mec: "USR-09",
    fim: "execucao",
    desc: "Vazamento no sistema de ar do freio pneumático; pressão cai com o veículo parado.",
    diag: "Vazamento na válvula do pedal e em conexões da linha de ar.",
    pecas: [["OUT-ABR", 6]],
    est: 950,
    obs: [
      [
        5,
        "USR-09",
        "Identificado vazamento na válvula do pedal; aguardando teste de estanqueidade.",
      ],
    ],
  },
  {
    k: "m16",
    frota: 108,
    n: 16,
    prio: "alta",
    sol: "USR-06",
    mec: "USR-09",
    fim: "aguardando_pecas",
    desc: "Embreagem patinando quando o veículo está carregado.",
    diag: "Disco de embreagem no fim da vida útil; necessário kit completo.",
    pecas: [],
    est: 4600,
    obsPecas: "Kit de embreagem sem saldo no estoque; compra solicitada.",
    obs: [
      [
        12,
        "USR-01",
        "Fornecedor informou entrega do kit de embreagem em até 15 dias.",
      ],
    ],
  },
  {
    k: "m17",
    frota: 118,
    n: 4,
    prio: "alta",
    sol: "USR-08",
    mec: "USR-10",
    fim: "execucao",
    desc: "Trinca na longarina próxima ao suporte da mola traseira.",
    diag: "Trinca de 12 cm; reparo com solda e reforço estrutural.",
    pecas: [],
    est: 1800,
  },
  {
    k: "m18",
    frota: 126,
    n: 3,
    prio: "critica",
    sol: "USR-05",
    mec: "USR-11",
    fim: "execucao",
    desc: "Falha no motor de partida; veículo parado em Jatobá.",
    diag: "Motor de partida com induzido danificado.",
    pecas: [["ELE-MOTP", 1]],
    est: 1700,
  },
  {
    k: "m19",
    frota: 134,
    n: 9,
    prio: "media",
    sol: "USR-08",
    mec: "USR-10",
    fim: "aguardando_pecas",
    desc: "Amortecedores traseiros com vazamento de óleo.",
    diag: "Dois amortecedores traseiros vazando; saldo em estoque insuficiente.",
    pecas: [],
    est: 1300,
    obsPecas:
      "Saldo de amortecedores insuficiente; aguardando aprovação da compra.",
  },
  {
    k: "m20",
    frota: 112,
    n: 2,
    prio: "alta",
    sol: "USR-06",
    mec: "USR-11",
    fim: "execucao",
    desc: "Correia do alternador com ruído e bateria descarregando.",
    diag: "Correia ressecada; tensor com folga.",
    pecas: [["PEC-CORR", 1]],
    est: 380,
  },
  {
    k: "m21",
    frota: 127,
    n: 5,
    prio: "media",
    sol: "USR-05",
    fim: "analise",
    desc: "Consumo de combustível acima do normal nas últimas semanas.",
    obs: [
      [
        4,
        "USR-01",
        "Programar teste dos bicos injetores e verificação do filtro de ar.",
      ],
    ],
  },
  {
    k: "m22",
    frota: 105,
    n: 3,
    prio: "baixa",
    sol: "USR-06",
    fim: "analise",
    desc: "Revisão preventiva por quilometragem a programar.",
  },
  {
    k: "m23",
    frota: 116,
    n: 1,
    prio: "alta",
    sol: "USR-08",
    fim: "aberta",
    desc: "Ruído anormal no diferencial em velocidade de cruzeiro.",
  },
  {
    k: "m24",
    frota: 139,
    n: 1,
    prio: "baixa",
    sol: "USR-08",
    fim: "aberta",
    desc: "Para-brisa com trinca no lado do passageiro.",
  },
  {
    k: "m25",
    frota: 101,
    n: 0,
    prio: "baixa",
    sol: "USR-05",
    fim: "aberta",
    desc: "Lâmpada do farol baixo esquerdo queimada.",
  },
];

// [chave, n, cidade, itens [código, qtd, valor unit.], justificativa, decisão, pedido, recebimento, despesa]
const COMPRAS = [
  {
    k: "sc1",
    n: 88,
    cidade: "teresina",
    itens: [
      ["FIL-OLP", 20, 76],
      ["LUB-15W40", 200, 24.2],
    ],
    just: "Reposição programada para as revisões preventivas do trimestre.",
    aprova: [87, ""],
    pedido: [86, "Lubrificantes Delta", 82],
    receb: [83, "USR-05"],
    despesa: [82, 0.98],
  },
  {
    k: "sc2",
    n: 80,
    cidade: "teresina",
    itens: [["PNE-225R", 10, 1120]],
    just: "Substituição de pneus de tração com desgaste nos cavalos mecânicos.",
    aprova: [79, "Aprovado. Priorizar recapadora local."],
    pedido: [78, "Recapadora Nordeste", 72],
    receb: [73, "USR-05"],
    despesa: [72, 1],
  },
  {
    k: "sc3",
    n: 74,
    cidade: "teresina",
    itens: [["PNE-225N", 12, 2890]],
    just: "Renovação completa dos pneus dos cavalos mecânicos 101 a 105.",
    rejeita: [
      72,
      "Priorizar recapagem neste trimestre; reavaliar a compra de pneus novos no próximo ciclo.",
    ],
  },
  {
    k: "sc4",
    n: 66,
    cidade: "teresina",
    itens: [["BAT-150", 4, 960]],
    just: "Baterias com mais de três anos de uso nos caminhões de Teresina.",
    aprova: [65, ""],
    pedido: [64, "Baterias Forte", 60],
    receb: [61, "USR-02"],
    despesa: [60, 1],
  },
  {
    k: "sc5",
    n: 58,
    cidade: "oeiras",
    itens: [
      ["PEC-LONA", 4, 410],
      ["PEC-TAMB", 2, 680],
    ],
    just: "Reposição após manutenção do sistema de freios em Oeiras.",
    aprova: [57, ""],
    pedido: [56, "Central Autopeças", 52],
    receb: [52, "USR-08"],
    despesa: [51, 0.97],
  },
  {
    k: "sc6",
    n: 50,
    cidade: "oeiras",
    itens: [["LUB-ARLA", 400, 3.85]],
    just: "Reposição de ARLA 32 para a base de Oeiras.",
    aprova: [49, ""],
    pedido: [49, "Lubrificantes Delta", 46],
    receb: [46, "USR-08"],
    despesa: [45, 1],
  },
  {
    k: "sc7",
    n: 41,
    cidade: "teresina",
    itens: [["ELE-MOTP", 2, 1450]],
    just: "Estoque de segurança de motores de partida recondicionados.",
    rejeita: [
      40,
      "Valor acima do previsto. Solicitar nova cotação com pelo menos três fornecedores.",
    ],
  },
  {
    k: "sc8",
    n: 35,
    cidade: "teresina",
    itens: [
      ["PEC-PAST", 6, 155],
      ["PEC-CORR", 4, 140],
    ],
    just: "Reposição de itens de desgaste da frota leve e média.",
    aprova: [34, ""],
    pedido: [33, "Central Autopeças", 30],
    receb: [29, "USR-05"],
  },
  {
    k: "sc9",
    n: 28,
    cidade: "jatoba",
    itens: [["PNE-225R", 8, 1150]],
    just: "Pneus recapados para os caminhões basculantes de Jatobá.",
    aprova: [27, "Aprovado conforme orçamento apresentado."],
    pedido: [26, "Recapadora Nordeste", 22],
    receb: [21, "USR-05"],
    despesa: [20, 1],
  },
  {
    k: "sc10",
    n: 15,
    cidade: "teresina",
    sm: "m16",
    itens: [["PEC-EMBR", 1, 3800]],
    just: "Kit de embreagem para o veículo 108, parado aguardando a peça.",
    aprova: [14, "Aprovado com urgência: veículo parado."],
    pedido: [13, "Diesel Parts Distribuidora", -2],
  },
  {
    k: "sc11",
    n: 11,
    cidade: "teresina",
    itens: [
      ["ELE-LAMP", 20, 21],
      ["ELE-REL", 10, 34],
    ],
    just: "Reposição de itens elétricos próximos ou abaixo do estoque mínimo.",
    aprova: [10, ""],
  },
  {
    k: "sc12",
    n: 7,
    cidade: "teresina",
    itens: [["BAT-060", 4, 510]],
    just: "Baterias de reserva para a frota leve (picapes, vans e utilitários).",
    aprova: [6, ""],
    pedido: [5, "Baterias Forte", 1],
  },
  {
    k: "sc13",
    n: 4,
    cidade: "teresina",
    itens: [
      ["FIL-SEP", 20, 118],
      ["FIL-COMB", 20, 92],
    ],
    just: "Filtros abaixo do estoque mínimo, necessários para as próximas revisões preventivas.",
  },
  {
    k: "sc14",
    n: 2,
    cidade: "angical",
    sm: "m19",
    itens: [["PEC-AMORT", 4, 520]],
    just: "Amortecedores para o veículo 134, parado aguardando peças em Angical.",
  },
  {
    k: "sc15",
    n: 1,
    cidade: "oeiras",
    itens: [
      ["LUB-ARREF", 60, 18],
      ["OUT-FITA", 12, 7.5],
    ],
    just: "Reposição de aditivo de arrefecimento e materiais de consumo da oficina.",
  },
];

// Destinações de peças por placa: [n, usuário, tipo, frota, código, qtd, posição, retirar {posição, destino}, observação]
const DESTINACOES = [
  {
    n: 84,
    u: "USR-05",
    tipo: "instalacao",
    frota: 101,
    codigo: "PNE-225R",
    posicao: "Tração esquerdo externo",
    obs: "Montagem após inspeção de rodagem.",
  },
  {
    n: 84,
    u: "USR-05",
    tipo: "instalacao",
    frota: 101,
    codigo: "PNE-225R",
    posicao: "Tração esquerdo interno",
    obs: "Montagem após inspeção de rodagem.",
  },
  {
    n: 71,
    u: "USR-05",
    tipo: "substituicao",
    frota: 103,
    codigo: "PNE-225R",
    posicao: "Dianteiro direito",
    retirar: { posicao: "Dianteiro direito", destino: "recapagem" },
    obs: "Pneu anterior com banda gasta.",
  },
  {
    n: 69,
    u: "USR-08",
    tipo: "reposicao",
    frota: 116,
    codigo: "LUB-15W40",
    qtd: 12,
    obs: "Complemento de nível após viagem longa.",
  },
  {
    n: 60,
    u: "USR-05",
    tipo: "substituicao",
    frota: 105,
    codigo: "BAT-150",
    posicao: "Bateria 1",
    retirar: { posicao: "Bateria 1", destino: "descarte" },
    obs: "Bateria anterior reprovada no teste de carga.",
  },
  {
    n: 59,
    u: "USR-05",
    tipo: "substituicao",
    frota: 105,
    codigo: "BAT-150",
    posicao: "Bateria 2",
    retirar: { posicao: "Bateria 2", destino: "descarte" },
    obs: "Substituição do par de baterias.",
  },
  {
    n: 52,
    u: "USR-08",
    tipo: "reposicao",
    frota: 119,
    codigo: "LUB-ARLA",
    qtd: 60,
    obs: "Abastecimento de ARLA 32.",
  },
  {
    n: 44,
    u: "USR-08",
    tipo: "reposicao",
    frota: 116,
    codigo: "LUB-ARLA",
    qtd: 80,
    obs: "Abastecimento de ARLA 32.",
  },
  {
    n: 38,
    u: "USR-05",
    tipo: "instalacao",
    frota: 125,
    codigo: "PNE-225R",
    posicao: "Estepe",
    obs: "Estepe ausente identificado na inspeção.",
  },
  {
    n: 31,
    u: "USR-01",
    tipo: "reposicao",
    frota: 107,
    codigo: "LUB-80W90",
    qtd: 8,
    obs: "Complemento de óleo de câmbio.",
  },
  {
    n: 20,
    u: "USR-05",
    tipo: "substituicao",
    frota: 128,
    codigo: "PNE-225R",
    posicao: "Tração direito externo",
    retirar: { posicao: "Tração direito externo", destino: "recapagem" },
    obs: "Pneu anterior enviado para recapagem.",
  },
  {
    n: 19,
    u: "USR-05",
    tipo: "substituicao",
    frota: 128,
    codigo: "PNE-225R",
    posicao: "Tração direito interno",
    retirar: { posicao: "Tração direito interno", destino: "descarte" },
    obs: "Carcaça sem condição de recapagem.",
  },
  {
    n: 14,
    u: "USR-08",
    tipo: "reposicao",
    frota: 120,
    codigo: "LUB-ARLA",
    qtd: 70,
    obs: "Abastecimento de ARLA 32.",
  },
  {
    n: 9,
    u: "USR-05",
    tipo: "substituicao",
    frota: 110,
    codigo: "BAT-150",
    posicao: "Bateria 1",
    retirar: { posicao: "Bateria 1", destino: "estoque" },
    obs: "Bateria retirada em bom estado, mantida como reserva.",
  },
  {
    n: 5,
    u: "USR-08",
    tipo: "reposicao",
    frota: 136,
    codigo: "LUB-15W40",
    qtd: 10,
    obs: "Complemento de nível.",
  },
];

// Despesas lançadas manualmente pelo financeiro: [n, descrição, categoria, cidade, frota, valor, fornecedor]
const DESPESAS = [
  [
    86,
    "Serviço de guincho — veículo 126 (Jatobá a Teresina)",
    "servicos_externos",
    "jatoba",
    126,
    1450,
    "Guincho terceirizado",
  ],
  [
    82,
    "Alinhamento e balanceamento da frota leve",
    "servicos_externos",
    "teresina",
    null,
    640,
    "Centro automotivo local",
  ],
  [
    77,
    "Lavagem completa de caminhões",
    "outras",
    "oeiras",
    null,
    520,
    "Lava-jato local",
  ],
  [
    71,
    "Recapagem de 4 pneus 22.5",
    "pneus_baterias",
    "teresina",
    null,
    1880,
    "Recapadora Nordeste",
  ],
  [
    64,
    "Aferição de tacógrafo — 3 veículos",
    "outras",
    "teresina",
    null,
    690,
    "Posto de aferição credenciado",
  ],
  [
    57,
    "Conserto de pneu (borracharia) — veículo 129",
    "pneus_baterias",
    "jatoba",
    129,
    120,
    "Borracharia local",
  ],
  [
    52,
    "Retífica de cabeçote — oficina terceirizada",
    "servicos_externos",
    "oeiras",
    119,
    4200,
    "Retífica parceira",
  ],
  [
    45,
    "Estacionamento e pernoite de carreta",
    "outras",
    "teresina",
    104,
    180,
    "Pátio de apoio",
  ],
  [
    45,
    "Estacionamento e pernoite de carreta",
    "outras",
    "teresina",
    104,
    180,
    "Pátio de apoio",
    "Lançamento em duplicidade.",
  ],
  [
    39,
    "Higienização do ar-condicionado — micro-ônibus",
    "servicos_externos",
    "angical",
    138,
    260,
    "Climatização automotiva",
  ],
  [
    33,
    "Lavagem completa de caminhões",
    "outras",
    "angical",
    null,
    430,
    "Lava-jato local",
  ],
  [
    27,
    "Serviço de eletricista externo — chicote elétrico",
    "servicos_externos",
    "jatoba",
    130,
    380,
    "Autoelétrica parceira",
  ],
  [
    22,
    "Recapagem de 6 pneus 22.5",
    "pneus_baterias",
    "jatoba",
    null,
    2820,
    "Recapadora Nordeste",
  ],
  [
    15,
    "Serviço de guincho — veículo 108",
    "servicos_externos",
    "teresina",
    108,
    650,
    "Guincho terceirizado",
  ],
  [
    10,
    "Lavagem completa de caminhões",
    "outras",
    "teresina",
    null,
    610,
    "Lava-jato local",
  ],
  [
    6,
    "Alinhamento e balanceamento — veículo 137",
    "servicos_externos",
    "angical",
    137,
    220,
    "Centro automotivo local",
  ],
  [
    3,
    "Aferição de tacógrafo — veículo 116",
    "outras",
    "oeiras",
    116,
    230,
    "Posto de aferição credenciado",
  ],
  [
    1,
    "Conserto de pneu (borracharia) — veículo 133",
    "pneus_baterias",
    "jatoba",
    133,
    90,
    "Borracharia local",
  ],
];

const POSTOS_CIDADE = {
  teresina: ["Posto Rota 316", "Posto Avenida Sul"],
  oeiras: ["Posto Canindé"],
  jatoba: ["Posto Serra Azul"],
  angical: ["Posto Trevo Norte"],
};
const PRECO_BASE = {
  teresina: 6.19,
  oeiras: 6.36,
  jatoba: 6.42,
  angical: 6.29,
};
const FISCAL_CIDADE = {
  teresina: "USR-05",
  jatoba: "USR-05",
  oeiras: "USR-08",
  angical: "USR-08",
};

// ---------------------------------------------------------------------------
// Geração
// ---------------------------------------------------------------------------

function executar(data, hora, usuarioId, descricao, fn) {
  definirRelogio(new Date(`${data}T${hora}:00`));
  store.state.sessao.usuarioId = usuarioId;
  try {
    return fn();
  } catch (erro) {
    errosGeracao.push(`${data} ${hora} · ${descricao}: ${erro.message}`);
    console.error("[dados de demonstração]", descricao, erro);
    return null;
  }
}

export function gerarDadosIniciais(referencia = new Date()) {
  errosGeracao.length = 0;
  const T = isoData(referencia);
  const dia = (n) => somarDias(T, -n);
  const R = criarAleatorio(20261009);
  const estado = estadoVazio();
  estado.geradoEm = T;
  estado.usuarios = USUARIOS.map((u) => ({ ...u, ativo: true }));
  store.substituir(estado);

  const ref = { veic: {}, mat: {}, sm: {}, os: {}, sc: {} };
  const meta = {};
  const eventos = [];
  const agendar = (n, hora, usuarioId, descricao, fn) =>
    eventos.push({
      data: dia(n),
      hora,
      usuarioId,
      descricao,
      fn,
      ordem: eventos.length,
    });
  const hora = (min, max) =>
    `${String(R.inteiro(min, max)).padStart(2, "0")}:${String(R.inteiro(0, 59)).padStart(2, "0")}`;
  const veic = (frota) => ref.veic[frota];
  const mat = (codigo) => ref.mat[codigo];
  const disponiveis = (codigo, qtd) =>
    estado.unidades
      .filter((u) => u.materialId === mat(codigo) && u.status === "estoque")
      .slice(0, qtd)
      .map((u) => u.id);
  const instalada = (frota, codigo, posicao) =>
    estado.unidades.find(
      (u) =>
        u.status === "instalado" &&
        u.veiculoId === veic(frota) &&
        u.materialId === mat(codigo) &&
        (!posicao || u.posicao === posicao),
    );

  store.emSilencio(() => {
    // 1) Cadastro da frota (implantação do sistema, ~100 dias atrás).
    executar(dia(100), "08:00", "USR-06", "cadastro da frota", () => {
      const placas = new Set();
      const letras = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      const anoAtual = Number(T.slice(0, 4));
      let frota = 101;
      for (const [cidade, modelos] of DISTRIBUICAO) {
        for (const chave of modelos) {
          const m = MODELOS[chave];
          let placa;
          do {
            placa = `${R.escolher(letras)}${R.escolher(letras)}${R.escolher(letras)}${R.inteiro(0, 9)}${R.escolher(letras)}${R.inteiro(0, 9)}${R.inteiro(0, 9)}`;
          } while (placas.has(placa));
          placas.add(placa);
          const ano = R.inteiro(m.anos[0], m.anos[1]);
          const km =
            Math.round(
              ((anoAtual - ano + R.entre(0.4, 0.9)) *
                R.entre(m.kmAno[0], m.kmAno[1])) /
                10,
            ) * 10;
          const v = S.salvarVeiculo({
            frota: String(frota),
            placa,
            modelo: m.modelo,
            tipo: m.tipo,
            ano,
            cidade,
            combustivel: m.combustivel,
            km,
            situacao: "operacao",
          });
          ref.veic[frota] = v.id;
          meta[v.id] = { modelo: m, fator: R.entre(0.95, 1.05), frota };
          frota += 1;
        }
      }
    });

    // 2) Catálogo de materiais com saldo de implantação.
    executar(dia(100), "09:00", "USR-02", "cadastro de materiais", () => {
      for (const [
        codigo,
        nome,
        categoria,
        unidade,
        minimo,
        custoUnitario,
        deposito,
        rastreavel,
        inicial,
      ] of MATERIAIS) {
        const m = S.cadastrarMaterial({
          codigo,
          nome,
          categoria,
          unidade,
          minimo,
          custoUnitario,
          deposito,
          rastreavel,
          quantidadeInicial: inicial,
        });
        ref.mat[codigo] = m.id;
      }
    });

    // 3) Unidades rastreáveis já instaladas na implantação.
    executar(
      dia(100),
      "10:00",
      "USR-05",
      "implantação de pneus e baterias",
      () => {
        for (const [frota, codigo, posicoes] of IMPLANTADOS) {
          const material = S.material(mat(codigo));
          for (const posicao of posicoes) {
            S.criarUnidade(material, {
              status: "instalado",
              veiculoId: veic(frota),
              posicao,
              dataInstalacao: dia(100),
              descricao:
                "Unidade registrada na implantação do controle individual",
            });
          }
        }
      },
    );

    // 4) Manutenção.
    const janelas = {}; // veículo -> [{inicio, fim}] em "dias atrás", sem abastecimento
    const paradas = {}; // veículo -> dia (dias atrás) a partir do qual não abastece mais

    for (const c of MANUTENCOES) {
      const vid = veic(c.frota);
      agendar(
        c.n,
        c.n === 0 ? "06:40" : hora(7, 8),
        c.sol,
        `solicitação ${c.k}`,
        () => {
          ref.sm[c.k] = S.abrirSolicitacao({
            veiculoId: vid,
            descricao: c.desc,
            prioridade: c.prio,
          }).id;
        },
      );
      if (c.fim === "aberta") continue;
      if (c.fim === "cancelada") {
        agendar(c.n - 1, "10:00", "USR-01", `cancelamento ${c.k}`, () =>
          S.atualizarSolicitacao(ref.sm[c.k], {
            status: "cancelada",
            observacao: c.motivoCancel,
          }),
        );
        continue;
      }
      agendar(c.n, "09:45", "USR-01", `análise ${c.k}`, () =>
        S.atualizarSolicitacao(ref.sm[c.k], {
          status: "analise",
          responsavelId: "USR-01",
        }),
      );
      for (const [n, autor, texto] of c.obs ?? []) {
        agendar(n, "15:20", autor, `observação ${c.k}`, () =>
          S.adicionarObservacao(ref.sm[c.k], texto),
        );
      }
      if (c.fim === "analise") continue;

      const osN = Math.max(c.n - 1, 0);
      agendar(osN, "10:30", "USR-01", `OS ${c.k}`, () => {
        ref.os[c.k] = S.abrirOS(ref.sm[c.k], {
          diagnostico: c.diag,
          responsavelExecucaoId: c.mec,
          dataInicio: dia(osN),
          custoEstimado: c.est,
        }).id;
      });
      if (c.fim !== "concluida") {
        agendar(
          osN,
          "10:50",
          FISCAL_CIDADE[S.veiculo(vid).cidade],
          `leitura de entrada ${c.k}`,
          () => {
            const maior = Math.max(...S.leiturasKm(vid).map((l) => l.km));
            S.registrarLeituraKm({
              veiculoId: vid,
              data: dia(osN),
              km: maior + R.inteiro(30, 160),
              observacao: "Leitura na entrada da oficina",
            });
          },
        );
      }
      c.pecas.forEach(([codigo, qtd, posicao], i) => {
        agendar(
          osN,
          `11:${String(10 + i).padStart(2, "0")}`,
          "USR-01",
          `peça ${codigo} ${c.k}`,
          () => {
            const material = S.material(mat(codigo));
            S.adicionarPecaOS(ref.os[c.k], {
              materialId: material.id,
              quantidade: qtd,
              unidadeIds: material.rastreavel ? disponiveis(codigo, qtd) : [],
              posicao: posicao || "",
            });
          },
        );
      });
      if (c.fim === "aguardando_pecas") {
        agendar(osN, "14:00", "USR-01", `aguardando peças ${c.k}`, () =>
          S.atualizarSolicitacao(ref.sm[c.k], {
            status: "aguardando_pecas",
            observacao: c.obsPecas,
          }),
        );
      }
      if (c.fim === "concluida") {
        const fimN = osN - c.dur;
        janelas[vid] = [...(janelas[vid] ?? []), { inicio: c.n, fim: fimN }];
        agendar(fimN, "16:30", "USR-01", `conclusão ${c.k}`, () => {
          S.concluirOS(ref.os[c.k], {
            servico: c.servico,
            dataConclusao: dia(fimN),
            custoFinal: c.custo,
            categoriaCusto: c.cat ?? "manutencao",
            registrarDespesa: c.custo > 0,
            liberarVeiculo: true,
          });
          if (c.retirar) {
            const antiga = estado.unidades.find(
              (u) =>
                u.status === "instalado" &&
                u.veiculoId === vid &&
                u.materialId === mat(c.retirar.codigo) &&
                u.dataInstalacao === dia(100),
            );
            if (antiga)
              S.registrarRetirada({
                unidadeId: antiga.id,
                destino: c.retirar.destino,
                data: dia(fimN),
                observacao: "Unidade substituída na OS",
              });
          }
        });
        if (fimN > 10) {
          agendar(
            fimN - 1,
            "07:30",
            "USR-06",
            `retorno à operação ${c.k}`,
            () =>
              S.alterarSituacaoVeiculo(
                vid,
                "operacao",
                "Retorno à operação após manutenção",
              ),
          );
        }
      } else {
        paradas[vid] = c.n;
      }
    }

    // 5) Compras e aprovações.
    for (const c of COMPRAS) {
      agendar(c.n, hora(8, 9), "USR-02", `compra ${c.k}`, () => {
        const itens = c.itens.map(([codigo, quantidade, valorUnitario]) => ({
          materialId: mat(codigo),
          quantidade,
          valorUnitario,
        }));
        ref.sc[c.k] = S.criarCompra({
          cidade: c.cidade,
          itens,
          justificativa: c.just,
          solicitacaoId: c.sm ? ref.sm[c.sm] : null,
        }).id;
      });
      if (c.rejeita)
        agendar(c.rejeita[0], hora(14, 16), "USR-07", `rejeição ${c.k}`, () =>
          S.decidirCompra(ref.sc[c.k], "rejeitar", c.rejeita[1]),
        );
      if (c.aprova)
        agendar(c.aprova[0], hora(14, 16), "USR-07", `aprovação ${c.k}`, () =>
          S.decidirCompra(ref.sc[c.k], "aprovar", c.aprova[1]),
        );
      if (c.pedido) {
        agendar(
          c.pedido[0],
          c.pedido[0] === c.aprova?.[0] ? "17:50" : hora(9, 11),
          "USR-02",
          `pedido ${c.k}`,
          () =>
            S.registrarPedido(ref.sc[c.k], {
              fornecedor: c.pedido[1],
              previsaoEntrega: dia(c.pedido[2]),
              observacao: "",
            }),
        );
      }
      if (c.receb)
        agendar(c.receb[0], "13:30", c.receb[1], `recebimento ${c.k}`, () =>
          S.registrarRecebimento(ref.sc[c.k], {
            data: dia(c.receb[0]),
            gerarEntrada: true,
            notaFiscal: `NF ${R.inteiro(10000, 99999)} (fictícia)`,
          }),
        );
      if (c.despesa) {
        agendar(c.despesa[0], "14:30", "USR-04", `despesa ${c.k}`, () => {
          const compra = S.db().compras.find((x) => x.id === ref.sc[c.k]);
          S.registrarDespesa({
            descricao: `Compra ${compra.id} — ${compra.pedido.fornecedor}`,
            categoria: S.categoriaSugerida(compra),
            cidade: compra.cidade,
            data: dia(c.despesa[0]),
            valor: arred(compra.valorEstimado * c.despesa[1]),
            fornecedor: compra.pedido.fornecedor,
            origemTipo: "compra",
            origemId: compra.id,
          });
        });
      }
    }

    // 6) Destinação de peças por placa.
    for (const d of DESTINACOES) {
      agendar(
        d.n,
        hora(13, 16),
        d.u,
        `destinação ${d.codigo} ${d.frota}`,
        () => {
          const material = S.material(mat(d.codigo));
          const retirar = d.retirar
            ? instalada(d.frota, d.codigo, d.retirar.posicao)
            : null;
          S.destinarPeca({
            veiculoId: veic(d.frota),
            tipo: d.tipo,
            materialId: material.id,
            quantidade: d.qtd ?? 1,
            unidadeIds: material.rastreavel ? disponiveis(d.codigo, 1) : [],
            posicao: d.posicao ?? "",
            data: dia(d.n),
            cidade: S.veiculo(veic(d.frota)).cidade,
            observacao: d.obs,
            retirarUnidadeIds: retirar ? [retirar.id] : [],
            destinoRetirada: d.retirar?.destino,
          });
        },
      );
    }
    agendar(40, "10:15", "USR-05", "retorno de recapagem", () => {
      const u = estado.unidades.find((x) => x.status === "recapagem");
      if (u) S.receberDaRecapagem(u.id);
    });
    agendar(2, "09:10", "USR-05", "retirada de pneu", () => {
      const u = instalada(101, "PNE-225R", "Tração esquerdo externo");
      S.registrarRetirada({
        unidadeId: u.id,
        destino: "recapagem",
        data: dia(2),
        observacao: "Banda de rodagem no limite de segurança",
      });
    });

    // 7) Situações operacionais específicas.
    for (const frota of [115, 124]) {
      paradas[veic(frota)] = 62;
      agendar(62, "08:20", "USR-06", `inativação ${frota}`, () =>
        S.alterarSituacaoVeiculo(
          veic(frota),
          "inativo",
          "Veículo em processo de desmobilização",
        ),
      );
    }
    for (const frota of [123, 131]) {
      paradas[veic(frota)] = 20;
      agendar(20, "08:40", "USR-06", `reserva ${frota}`, () =>
        S.alterarSituacaoVeiculo(
          veic(frota),
          "disponivel",
          "Veículo mantido em reserva no pátio",
        ),
      );
    }

    // 8) Abastecimentos e quilometragem.
    for (const v of [...estado.veiculos]) {
      const { modelo: m, fator, frota } = meta[v.id];
      let km = v.kmCadastro;
      let anterior = 99;
      let n = 96 - R.inteiro(0, 3);
      while (n >= 0) {
        const janela = (janelas[v.id] ?? []).find(
          (j) => n <= j.inicio && n >= j.fim,
        );
        if (janela) {
          n = janela.fim - 1;
          continue;
        }
        if (paradas[v.id] !== undefined && n <= paradas[v.id]) break;
        const dias = anterior - n;
        const distancia = Math.round(dias * R.entre(m.kmDia[0], m.kmDia[1]));
        km += distancia;
        // O veículo 127 apresenta consumo elevado nas últimas semanas (gera alerta e solicitação em análise).
        const desvio = frota === 127 && n <= 35 ? 0.78 : 1;
        const kml = m.kml * fator * desvio * R.entre(0.94, 1.06);
        const litros = arred(distancia / kml, 1);
        const cidade =
          m.tipo === "Cavalo mecânico" && R.chance(0.25)
            ? R.escolher(["teresina", "oeiras", "jatoba", "angical"])
            : v.cidade;
        const preco = arred(
          PRECO_BASE[cidade] +
            (m.combustivel === "Gasolina" ? 0.24 : 0) -
            (n / 30) * 0.03 +
            R.entre(-0.03, 0.03),
          2,
        );
        const posto = R.escolher(POSTOS_CIDADE[cidade]);
        const kmAtual = km;
        const dataAbastecimento = dia(n);
        const usuario = R.chance(0.15) ? "USR-06" : FISCAL_CIDADE[cidade];
        agendar(
          n,
          n === 0 ? "06:15" : hora(6, 18),
          usuario,
          `abastecimento ${frota}`,
          () =>
            S.registrarAbastecimento({
              veiculoId: v.id,
              cidade,
              data: dataAbastecimento,
              km: kmAtual,
              litros,
              precoLitro: preco,
              posto,
            }),
        );
        anterior = n;
        n -= R.inteiro(m.intervalo[0], m.intervalo[1]);
      }
    }

    // 9) Despesas avulsas do financeiro.
    for (const [
      n,
      descricao,
      categoria,
      cidade,
      frota,
      valor,
      fornecedor,
      cancelar,
    ] of DESPESAS) {
      agendar(n, hora(10, 16), "USR-04", `despesa ${descricao}`, () => {
        const d = S.registrarDespesa({
          descricao,
          categoria,
          cidade,
          veiculoId: frota ? veic(frota) : null,
          data: dia(n),
          valor,
          fornecedor,
        });
        if (cancelar) S.alterarStatusDespesa(d.id, "cancelada", cancelar);
      });
    }

    // Execução em ordem cronológica.
    eventos.sort(
      (a, b) =>
        a.data.localeCompare(b.data) ||
        a.hora.localeCompare(b.hora) ||
        a.ordem - b.ordem,
    );
    for (const e of eventos)
      executar(e.data, e.hora, e.usuarioId, e.descricao, e.fn);

    // 10) Despesas com mais de uma semana já conferidas pelo financeiro.
    for (const d of estado.despesas) {
      if (d.status === "lancada" && d.data <= dia(8)) {
        d.status = "conferida";
        d.historico.push({
          dataHora: new Date(`${somarDias(d.data, 2)}T10:00:00`).toISOString(),
          usuarioId: "USR-04",
          descricao: "Despesa conferida pelo financeiro",
        });
      }
    }

    // Um usuário inativo para demonstrar a ativação/desativação.
    estado.usuarios.find((u) => u.id === "USR-12").ativo = false;
  });

  definirRelogio(null);
  estado.sessao.usuarioId = "USR-07";
  return estado;
}

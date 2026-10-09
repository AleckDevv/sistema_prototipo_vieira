// Veículos, abastecimentos e leituras de quilometragem.

import { CIDADES, SITUACOES_VEICULO } from "../constants.js";
import {
  db,
  buscar,
  obter,
  exigir,
  pode,
  proximoId,
  registrarLog,
  eventoHistorico,
  transacao,
  agora,
  hoje,
  ErroNegocio,
  exigirTexto,
  exigirNumero,
  exigirData,
  exigirOpcao,
} from "./core.js";
import { criarDespesaInterna } from "./despesas.js";
import { arred, fmt } from "../utils.js";

export const TIPOS_VEICULO = [
  "Cavalo mecânico",
  "Caminhão",
  "Caminhão basculante",
  "Caminhão leve",
  "Micro-ônibus",
  "Van",
  "Picape",
  "Utilitário",
];
export const COMBUSTIVEIS = ["Diesel S10", "Gasolina", "Etanol"];

const PLACA_RE = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;

export function normalizarPlaca(placa) {
  return String(placa ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function formatarPlaca(placa) {
  // Placas Mercosul não usam hífen; placas no padrão antigo (ABC1234) exibem hífen.
  return /^[A-Z]{3}[0-9]{4}$/.test(placa)
    ? `${placa.slice(0, 3)}-${placa.slice(3)}`
    : placa;
}

function cidadeValida(cidade) {
  if (!CIDADES.some((c) => c.id === cidade))
    throw new ErroNegocio("Selecione a cidade de referência.");
  return cidade;
}

export function salvarVeiculo(dados, id = null) {
  return transacao(() => {
    exigir("veiculos.gerenciar");
    const placa = normalizarPlaca(dados.placa);
    if (!PLACA_RE.test(placa))
      throw new ErroNegocio(
        "Placa inválida. Use o formato ABC1D23 (Mercosul) ou ABC1234.",
      );
    const frota = exigirTexto(dados.frota, "o número de frota").toUpperCase();
    const outros = db().veiculos.filter((v) => v.id !== id);
    if (outros.some((v) => v.placa === placa))
      throw new ErroNegocio(
        `A placa ${formatarPlaca(placa)} já está cadastrada.`,
      );
    if (outros.some((v) => v.frota === frota))
      throw new ErroNegocio(`O número de frota ${frota} já está em uso.`);
    const anoAtual = Number(hoje().slice(0, 4));
    const base = {
      frota,
      placa,
      modelo: exigirTexto(dados.modelo, "o modelo", 2),
      tipo: TIPOS_VEICULO.includes(dados.tipo)
        ? dados.tipo
        : (() => {
            throw new ErroNegocio("Selecione o tipo do veículo.");
          })(),
      ano: exigirNumero(dados.ano, "O ano", {
        inteiro: true,
        min: 1990,
        max: anoAtual + 1,
      }),
      cidade: cidadeValida(dados.cidade),
      combustivel: COMBUSTIVEIS.includes(dados.combustivel)
        ? dados.combustivel
        : "Diesel S10",
    };
    if (id) {
      const v = obter("veiculos", id, "Veículo");
      const alteracoes = Object.keys(base).filter((k) => v[k] !== base[k]);
      Object.assign(v, base);
      v.historico.push(
        eventoHistorico(
          `Cadastro atualizado${alteracoes.length ? ` (${alteracoes.join(", ")})` : ""}`,
        ),
      );
      registrarLog(
        "Veículos",
        `Veículo ${v.frota} · ${formatarPlaca(v.placa)} atualizado`,
        v.id,
      );
      return v;
    }
    const km = exigirNumero(dados.km, "A quilometragem inicial", {
      inteiro: true,
      min: 0,
      max: 5_000_000,
    });
    const v = {
      id: proximoId("VEI", 3),
      ...base,
      km,
      kmCadastro: km,
      dataCadastro: hoje(),
      kmAtualizadoEm: hoje(),
      situacao:
        SITUACOES_VEICULO[dados.situacao] && dados.situacao !== "manutencao"
          ? dados.situacao
          : "disponivel",
      historico: [eventoHistorico("Veículo cadastrado")],
    };
    db().veiculos.push(v);
    registrarLog(
      "Veículos",
      `Veículo ${v.frota} · ${formatarPlaca(v.placa)} cadastrado`,
      v.id,
    );
    return v;
  });
}

export function manutencaoAtiva(veiculoId) {
  return db().solicitacoes.some(
    (s) =>
      s.veiculoId === veiculoId &&
      ["aguardando_pecas", "execucao"].includes(s.status),
  );
}

export function alterarSituacaoVeiculo(id, situacao, motivo = "") {
  return transacao(() => {
    exigir("veiculos.situacao");
    const v = obter("veiculos", id, "Veículo");
    exigirOpcao(situacao, SITUACOES_VEICULO, "a situação");
    if (v.situacao === situacao)
      throw new ErroNegocio("O veículo já está nesta situação.");
    if (["operacao", "disponivel"].includes(situacao) && manutencaoAtiva(id)) {
      throw new ErroNegocio(
        "Este veículo possui solicitação mecânica em execução ou aguardando peças. Conclua a ordem de serviço antes de liberá-lo.",
      );
    }
    exigirTexto(motivo, "o motivo da alteração", 3);
    const anterior = v.situacao;
    v.situacao = situacao;
    v.historico.push(
      eventoHistorico(
        `Situação alterada de "${SITUACOES_VEICULO[anterior].label}" para "${SITUACOES_VEICULO[situacao].label}"`,
        { motivo },
      ),
    );
    registrarLog(
      "Veículos",
      `Situação do veículo ${v.frota} alterada para ${SITUACOES_VEICULO[situacao].label}`,
      v.id,
    );
    return v;
  });
}

/** Ajuste automático da situação conforme a manutenção (chamado pela oficina). */
export function sincronizarSituacaoVeiculo(veiculoId, { liberar = true } = {}) {
  const v = buscar("veiculos", veiculoId);
  if (!v || v.situacao === "inativo") return;
  const ativa = manutencaoAtiva(veiculoId);
  if (ativa && v.situacao !== "manutencao") {
    const anterior = v.situacao;
    v.situacao = "manutencao";
    v.historico.push(
      eventoHistorico(
        `Situação alterada de "${SITUACOES_VEICULO[anterior].label}" para "Em manutenção" (automático pela oficina)`,
      ),
    );
  } else if (!ativa && v.situacao === "manutencao" && liberar) {
    v.situacao = "disponivel";
    v.historico.push(
      eventoHistorico('Veículo liberado pela oficina — situação "Disponível"'),
    );
  }
}

export function vinculosVeiculo(id) {
  const s = db();
  return {
    solicitacoes: s.solicitacoes.filter((x) => x.veiculoId === id).length,
    abastecimentos: s.abastecimentos.filter((x) => x.veiculoId === id).length,
    destinacoes: s.destinacoes.filter((x) => x.veiculoId === id).length,
    despesas: s.despesas.filter((x) => x.veiculoId === id).length,
    leituras: s.leituras.filter((x) => x.veiculoId === id).length,
  };
}

export function excluirVeiculo(id) {
  return transacao(() => {
    exigir("veiculos.gerenciar");
    const v = obter("veiculos", id, "Veículo");
    const total = Object.values(vinculosVeiculo(id)).reduce((a, b) => a + b, 0);
    const instaladas = db().unidades.some(
      (u) => u.veiculoId === id && u.status === "instalado",
    );
    if (total > 0 || instaladas) {
      throw new ErroNegocio(
        'Este veículo possui registros históricos vinculados e não pode ser excluído. Utilize a situação "Inativo" para preservar o histórico.',
      );
    }
    db().veiculos.splice(db().veiculos.indexOf(v), 1);
    registrarLog(
      "Veículos",
      `Veículo ${v.frota} · ${formatarPlaca(v.placa)} excluído (sem histórico vinculado)`,
      v.id,
    );
  });
}

// ---------- Quilometragem ----------

/** Todas as leituras conhecidas do veículo (cadastro, abastecimentos e leituras avulsas), em ordem cronológica. */
export function leiturasKm(veiculoId, { ignorarId = null } = {}) {
  const v = buscar("veiculos", veiculoId);
  if (!v) return [];
  const lista = [
    {
      data: v.dataCadastro,
      km: v.kmCadastro,
      origem: "Cadastro",
      id: `cad:${v.id}`,
    },
  ];
  for (const a of db().abastecimentos)
    if (a.veiculoId === veiculoId && a.id !== ignorarId)
      lista.push({ data: a.data, km: a.km, origem: "Abastecimento", id: a.id });
  for (const l of db().leituras)
    if (l.veiculoId === veiculoId && l.id !== ignorarId)
      lista.push({
        data: l.data,
        km: l.km,
        origem: "Leitura de hodômetro",
        id: l.id,
      });
  return lista.sort((a, b) => a.data.localeCompare(b.data) || a.km - b.km);
}

/** Garante que a nova leitura seja coerente com as leituras anteriores e posteriores. */
export function validarKm(veiculoId, data, km) {
  const lista = leiturasKm(veiculoId);
  const anteriores = lista.filter((l) => l.data <= data);
  const posteriores = lista.filter((l) => l.data > data);
  const maxAnterior = anteriores.length
    ? Math.max(...anteriores.map((l) => l.km))
    : 0;
  const minPosterior = posteriores.length
    ? Math.min(...posteriores.map((l) => l.km))
    : Infinity;
  if (km <= maxAnterior) {
    throw new ErroNegocio(
      `Quilometragem regressiva: a leitura deve ser maior que ${fmt.km(maxAnterior)} (última leitura até ${fmt.data(data)}).`,
    );
  }
  if (km >= minPosterior) {
    throw new ErroNegocio(
      `Quilometragem incoerente: existe leitura posterior com ${fmt.km(minPosterior)}.`,
    );
  }
}

function atualizarKmVeiculo(v, km, data) {
  if (km > v.km) {
    v.km = km;
    v.kmAtualizadoEm = data;
  }
}

export function registrarAbastecimento(dados) {
  return transacao(() => {
    const usuario = exigir("abastecimento.registrar");
    const v = obter("veiculos", dados.veiculoId, "Veículo");
    if (v.situacao === "inativo")
      throw new ErroNegocio("Veículo inativo não pode receber abastecimento.");
    const data = exigirData(dados.data, "a data do abastecimento");
    const km = exigirNumero(dados.km, "A quilometragem", {
      inteiro: true,
      maiorQueZero: true,
      max: 5_000_000,
    });
    const litros = arred(
      exigirNumero(dados.litros, "A quantidade de litros", {
        maiorQueZero: true,
        max: 1500,
      }),
      2,
    );
    const preco = arred(
      exigirNumero(dados.precoLitro, "O preço por litro", { min: 1, max: 30 }),
      3,
    );
    const posto = exigirTexto(dados.posto, "o posto ou fornecedor", 2);
    const cidade = cidadeValida(dados.cidade || v.cidade);
    validarKm(v.id, data, km);
    const ab = {
      id: proximoId("AB"),
      veiculoId: v.id,
      cidade,
      data,
      km,
      litros,
      precoLitro: preco,
      valorTotal: arred(litros * preco),
      combustivel: v.combustivel,
      posto,
      usuarioId: usuario.id,
      despesaId: null,
      dataHora: agora().toISOString(),
    };
    db().abastecimentos.push(ab);
    atualizarKmVeiculo(v, km, data);
    const despesa = criarDespesaInterna({
      descricao: `Abastecimento ${fmt.numero(litros, 1)} L — ${posto}`,
      categoria: "combustivel",
      cidade,
      veiculoId: v.id,
      data,
      valor: ab.valorTotal,
      fornecedor: posto,
      origem: { tipo: "abastecimento", id: ab.id },
    });
    ab.despesaId = despesa.id;
    registrarLog(
      "Abastecimento",
      `Abastecimento de ${fmt.numero(litros, 1)} L no veículo ${v.frota} (${fmt.km(km)})`,
      ab.id,
    );
    return ab;
  });
}

export function registrarLeituraKm(dados) {
  return transacao(() => {
    const usuario = exigir("abastecimento.registrar");
    const v = obter("veiculos", dados.veiculoId, "Veículo");
    const data = exigirData(dados.data, "a data da leitura");
    const km = exigirNumero(dados.km, "A quilometragem", {
      inteiro: true,
      maiorQueZero: true,
      max: 5_000_000,
    });
    validarKm(v.id, data, km);
    const leitura = {
      id: proximoId("KM"),
      veiculoId: v.id,
      data,
      km,
      usuarioId: usuario.id,
      observacao: String(dados.observacao || "").trim(),
      dataHora: agora().toISOString(),
    };
    db().leituras.push(leitura);
    atualizarKmVeiculo(v, km, data);
    registrarLog(
      "Abastecimento",
      `Leitura de hodômetro do veículo ${v.frota}: ${fmt.km(km)}`,
      leitura.id,
    );
    return leitura;
  });
}

export function podeGerenciarVeiculos() {
  return pode("veiculos.gerenciar");
}

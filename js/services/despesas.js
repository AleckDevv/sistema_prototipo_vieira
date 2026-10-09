// Despesas operacionais.
// Regra anti-duplicidade: cada origem (compra, ordem de serviço ou abastecimento)
// pode ter no máximo UMA despesa ativa. Peças retiradas do estoque não geram nova
// despesa na OS, pois o custo delas já foi lançado na compra correspondente.

import { CATEGORIAS_DESPESA, CIDADES } from "../constants.js";
import {
  db,
  buscar,
  obter,
  exigir,
  proximoId,
  registrarLog,
  eventoHistorico,
  transacao,
  usuarioAtual,
  hoje,
  ErroNegocio,
  exigirTexto,
  exigirNumero,
  exigirData,
  exigirOpcao,
} from "./core.js";
import { arred, fmt } from "../utils.js";

const CIDADES_MAPA = Object.fromEntries(CIDADES.map((c) => [c.id, c]));

export function despesaAtivaDaOrigem(tipo, id) {
  return (
    db().despesas.find(
      (d) =>
        d.status !== "cancelada" &&
        d.origem?.tipo === tipo &&
        d.origem?.id === id,
    ) ?? null
  );
}

/** Uso interno (abastecimentos, OS e compras). Valida e cria a despesa sem checar permissão de financeiro. */
export function criarDespesaInterna({
  descricao,
  categoria,
  cidade,
  veiculoId = null,
  data,
  valor,
  fornecedor = "",
  origem = null,
  status = "lancada",
}) {
  exigirTexto(descricao, "a descrição", 3);
  exigirOpcao(categoria, CATEGORIAS_DESPESA, "a categoria");
  if (!CIDADES_MAPA[cidade])
    throw new ErroNegocio("Selecione a cidade da despesa.");
  exigirData(data, "a data da despesa");
  const v = exigirNumero(valor, "O valor", {
    maiorQueZero: true,
    max: 5_000_000,
  });
  if (veiculoId) obter("veiculos", veiculoId, "Veículo");
  if (origem) {
    const existente = despesaAtivaDaOrigem(origem.tipo, origem.id);
    if (existente) {
      throw new ErroNegocio(
        `Já existe a despesa ${existente.id} vinculada a ${origem.id}. A mesma despesa não pode ser lançada duas vezes.`,
      );
    }
  }
  const despesa = {
    id: proximoId("DP"),
    descricao: String(descricao).trim(),
    categoria,
    cidade,
    veiculoId: veiculoId || null,
    data,
    valor: arred(v),
    fornecedor: String(fornecedor || "").trim(),
    status,
    usuarioId: usuarioAtual()?.id ?? null,
    origem,
    historico: [eventoHistorico("Despesa lançada")],
  };
  db().despesas.push(despesa);
  return despesa;
}

function vincularOrigem(despesa) {
  if (!despesa.origem) return;
  const colecao = {
    compra: "compras",
    os: "ordens",
    abastecimento: "abastecimentos",
  }[despesa.origem.tipo];
  const registro = colecao ? buscar(colecao, despesa.origem.id) : null;
  if (registro) registro.despesaId = despesa.id;
}

export function registrarDespesa(dados) {
  return transacao(() => {
    exigir("despesas.registrar");
    let origem = null;
    if (dados.origemTipo === "compra" && dados.origemId) {
      const compra = obter("compras", dados.origemId, "Solicitação de compra");
      if (!["em_compra", "recebida"].includes(compra.status)) {
        throw new ErroNegocio(
          "A despesa de uma compra só pode ser registrada após a aprovação e a realização do pedido. Aprovação não significa pagamento.",
        );
      }
      origem = { tipo: "compra", id: compra.id };
    } else if (dados.origemTipo === "os" && dados.origemId) {
      const os = obter("ordens", dados.origemId, "Ordem de serviço");
      if (os.status !== "concluida")
        throw new ErroNegocio(
          "Registre a despesa da OS somente após a conclusão.",
        );
      origem = { tipo: "os", id: os.id };
    }
    const despesa = criarDespesaInterna({
      ...dados,
      origem,
      data: dados.data || hoje(),
    });
    vincularOrigem(despesa);
    registrarLog(
      "Despesas",
      `Despesa ${despesa.id} registrada (${fmt.moeda(despesa.valor)})`,
      despesa.id,
    );
    return despesa;
  });
}

export function alterarStatusDespesa(id, novoStatus, motivo = "") {
  return transacao(() => {
    exigir("despesas.conferir");
    const d = obter("despesas", id, "Despesa");
    if (d.status === "cancelada")
      throw new ErroNegocio("Despesa cancelada não pode ser alterada.");
    if (novoStatus === d.status)
      throw new ErroNegocio("A despesa já está nesta situação.");
    if (novoStatus === "conferida") {
      d.status = "conferida";
      d.historico.push(
        eventoHistorico("Despesa conferida pelo financeiro", { motivo }),
      );
      registrarLog("Despesas", `Despesa ${d.id} conferida`, d.id);
    } else if (novoStatus === "cancelada") {
      exigirTexto(motivo, "o motivo do cancelamento", 5);
      d.status = "cancelada";
      d.historico.push(eventoHistorico("Despesa cancelada", { motivo }));
      if (d.origem) {
        const colecao = {
          compra: "compras",
          os: "ordens",
          abastecimento: "abastecimentos",
        }[d.origem.tipo];
        const registro = colecao ? buscar(colecao, d.origem.id) : null;
        if (registro && registro.despesaId === d.id) registro.despesaId = null;
      }
      registrarLog("Despesas", `Despesa ${d.id} cancelada: ${motivo}`, d.id);
    } else {
      throw new ErroNegocio("Situação inválida.");
    }
    return d;
  });
}

// Solicitações de compra e fluxo de aprovação pela diretoria.
// Fluxo: Comprador cria → Aguardando aprovação → Diretor aprova/rejeita →
// Pedido realizado → Recebida (entrada opcional no estoque).
// A aprovação NÃO registra pagamento; a despesa efetiva é lançada à parte pelo financeiro.

import { CIDADES, STATUS_COMPRA } from "../constants.js";
import {
  db,
  obter,
  exigir,
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
} from "./core.js";
import { entradaInterna, FRACIONAVEIS } from "./estoque.js";
import { arred, fmt } from "../utils.js";

export function criarCompra(dados) {
  return transacao(() => {
    const usuario = exigir("compras.criar");
    if (!CIDADES.some((c) => c.id === dados.cidade))
      throw new ErroNegocio("Selecione a cidade de destino.");
    const linhas = (dados.itens || []).filter((i) => i && i.materialId);
    if (!linhas.length)
      throw new ErroNegocio("Inclua pelo menos um item na solicitação.");
    const vistos = new Set();
    const itens = linhas.map((linha, i) => {
      const material = obter("materiais", linha.materialId, "Material");
      if (vistos.has(material.id))
        throw new ErroNegocio(
          `O item "${material.nome}" foi incluído mais de uma vez. Ajuste a quantidade em uma única linha.`,
        );
      vistos.add(material.id);
      const quantidade = exigirNumero(
        linha.quantidade,
        `A quantidade do item ${i + 1}`,
        { maiorQueZero: true, max: 100000 },
      );
      if (
        !FRACIONAVEIS.includes(material.unidade) &&
        !Number.isInteger(quantidade)
      ) {
        throw new ErroNegocio(
          `A quantidade de "${material.nome}" deve ser inteira.`,
        );
      }
      const valorUnitario = arred(
        exigirNumero(linha.valorUnitario, `O valor unitário do item ${i + 1}`, {
          maiorQueZero: true,
          max: 1_000_000,
        }),
      );
      return {
        materialId: material.id,
        quantidade,
        unidade: material.unidade,
        valorUnitario,
        subtotal: arred(quantidade * valorUnitario),
      };
    });
    const justificativa = exigirTexto(
      dados.justificativa,
      "a justificativa",
      10,
    );
    let solicitacaoId = null;
    if (dados.solicitacaoId) {
      const s = obter(
        "solicitacoes",
        dados.solicitacaoId,
        "Solicitação mecânica",
      );
      if (["concluida", "cancelada"].includes(s.status))
        throw new ErroNegocio(
          "A solicitação mecânica vinculada já foi encerrada.",
        );
      solicitacaoId = s.id;
    }
    const compra = {
      id: proximoId("SC"),
      data: hoje(),
      solicitanteId: usuario.id,
      cidade: dados.cidade,
      itens,
      justificativa,
      valorEstimado: arred(itens.reduce((t, i) => t + i.subtotal, 0)),
      status: "aguardando",
      solicitacaoId,
      decisao: null,
      pedido: null,
      recebimento: null,
      despesaId: null,
      historico: [
        eventoHistorico(
          "Solicitação criada e enviada para aprovação da diretoria",
        ),
      ],
    };
    db().compras.push(compra);
    registrarLog(
      "Compras",
      `Solicitação de compra ${compra.id} criada (${fmt.moeda(compra.valorEstimado)})`,
      compra.id,
    );
    return compra;
  });
}

export function decidirCompra(id, decisao, motivo = "") {
  return transacao(() => {
    const usuario = exigir("compras.decidir");
    const compra = obter("compras", id, "Solicitação de compra");
    if (compra.status !== "aguardando") {
      throw new ErroNegocio(
        `Esta solicitação já está "${STATUS_COMPRA[compra.status].label}" e não aguarda decisão.`,
      );
    }
    if (!["aprovar", "rejeitar"].includes(decisao))
      throw new ErroNegocio("Decisão inválida.");
    const texto = String(motivo || "").trim();
    if (decisao === "rejeitar") exigirTexto(texto, "o motivo da rejeição", 5);
    compra.status = decisao === "aprovar" ? "aprovada" : "rejeitada";
    compra.decisao = {
      resultado: compra.status,
      usuarioId: usuario.id,
      dataHora: agora().toISOString(),
      motivo: texto,
    };
    compra.historico.push(
      eventoHistorico(
        decisao === "aprovar"
          ? "Aprovada pela diretoria"
          : "Rejeitada pela diretoria",
        { motivo: texto },
      ),
    );
    registrarLog(
      "Compras",
      `Solicitação ${compra.id} ${decisao === "aprovar" ? "aprovada" : "rejeitada"}${texto ? `: ${texto}` : ""}`,
      compra.id,
    );
    return compra;
  });
}

export function registrarPedido(id, dados) {
  return transacao(() => {
    const usuario = exigir("compras.acompanhar");
    const compra = obter("compras", id, "Solicitação de compra");
    if (compra.status !== "aprovada")
      throw new ErroNegocio(
        "Somente solicitações aprovadas podem seguir para o pedido de compra.",
      );
    const fornecedor = exigirTexto(dados.fornecedor, "o fornecedor", 3);
    const previsao = exigirData(
      dados.previsaoEntrega,
      "a previsão de entrega",
      { permitirFutura: true },
    );
    if (previsao < compra.data)
      throw new ErroNegocio(
        "A previsão de entrega não pode ser anterior à solicitação.",
      );
    compra.pedido = {
      fornecedor,
      previsaoEntrega: previsao,
      observacao: String(dados.observacao || "").trim(),
      usuarioId: usuario.id,
      dataHora: agora().toISOString(),
    };
    compra.status = "em_compra";
    compra.historico.push(
      eventoHistorico(`Pedido realizado junto a ${fornecedor}`),
    );
    registrarLog(
      "Compras",
      `Pedido da solicitação ${compra.id} realizado (${fornecedor})`,
      compra.id,
    );
    return compra;
  });
}

export function registrarRecebimento(id, dados) {
  return transacao(() => {
    const usuario = exigir("compras.receber");
    const compra = obter("compras", id, "Solicitação de compra");
    if (compra.status === "rejeitada")
      throw new ErroNegocio(
        "Solicitação rejeitada não pode gerar entrada de estoque.",
      );
    if (compra.status === "recebida")
      throw new ErroNegocio(
        "O recebimento desta compra já foi registrado. A entrada no estoque não é duplicada.",
      );
    if (compra.status !== "em_compra")
      throw new ErroNegocio(
        "Registre o pedido de compra antes do recebimento.",
      );
    const data = exigirData(dados.data, "a data de recebimento");
    if (data < compra.data)
      throw new ErroNegocio(
        "A data de recebimento não pode ser anterior à solicitação.",
      );
    const movimentoIds = [];
    if (dados.gerarEntrada) {
      for (const item of compra.itens) {
        const material = obter("materiais", item.materialId, "Material");
        const mov = entradaInterna({
          material,
          quantidade: item.quantidade,
          custoUnitario: item.valorUnitario,
          motivo: "Recebimento de compra",
          ref: { tipo: "compra", id: compra.id },
          data,
          cidade: material.deposito,
          observacao: compra.pedido?.fornecedor
            ? `Fornecedor: ${compra.pedido.fornecedor}`
            : "",
        });
        movimentoIds.push(mov.id);
      }
    }
    compra.recebimento = {
      data,
      usuarioId: usuario.id,
      entradaEstoque: Boolean(dados.gerarEntrada),
      movimentoIds,
      notaFiscal: String(dados.notaFiscal || "").trim(),
      dataHora: agora().toISOString(),
    };
    compra.status = "recebida";
    compra.historico.push(
      eventoHistorico(
        dados.gerarEntrada
          ? `Recebida · ${movimentoIds.length} entrada(s) registrada(s) no estoque`
          : "Recebida · sem entrada no estoque",
      ),
    );
    registrarLog(
      "Compras",
      `Recebimento da solicitação ${compra.id} registrado${dados.gerarEntrada ? " com entrada no estoque" : ""}`,
      compra.id,
    );
    return compra;
  });
}

export function categoriaSugerida(compra) {
  const materiais = compra.itens.map((i) =>
    db().materiais.find((m) => m.id === i.materialId),
  );
  return materiais.every(
    (m) => m && ["pneus", "baterias"].includes(m.categoria),
  )
    ? "pneus_baterias"
    : "pecas";
}

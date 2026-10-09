// Solicitações mecânicas e ordens de serviço.

import {
  PRIORIDADES,
  STATUS_SOLICITACAO,
} from "../constants.js";
import {
  db,
  obter,
  exigir,
  pode,
  proximoId,
  registrarLog,
  eventoHistorico,
  transacao,
  usuarioAtual,
  agora,
  hoje,
  ErroNegocio,
  exigirTexto,
  exigirNumero,
  exigirData,
  exigirOpcao,
} from "./core.js";
import { sincronizarSituacaoVeiculo, formatarPlaca } from "./frota.js";
import { aplicarPecaEmOS, estornarPecaDeOS } from "./estoque.js";
import { criarDespesaInterna } from "./despesas.js";
import { arred, fmt } from "../utils.js";

const FINAIS = ["concluida", "cancelada"];

export function osDaSolicitacao(solicitacaoId) {
  return db().ordens.find((o) => o.solicitacaoId === solicitacaoId) ?? null;
}

export function abrirSolicitacao(dados) {
  return transacao(() => {
    const usuario = exigir("manutencao.solicitar");
    const v = obter("veiculos", dados.veiculoId, "Veículo");
    if (v.situacao === "inativo")
      throw new ErroNegocio(
        "Não é possível abrir solicitação para veículo inativo.",
      );
    const descricao = exigirTexto(
      dados.descricao,
      "a descrição do problema",
      10,
    );
    exigirOpcao(dados.prioridade, PRIORIDADES, "a prioridade");
    const s = {
      id: proximoId("SM"),
      dataAbertura: hoje(),
      veiculoId: v.id,
      cidade: v.cidade,
      descricao,
      prioridade: dados.prioridade,
      solicitanteId: usuario.id,
      responsavelId: null,
      status: "aberta",
      observacoes: [],
      historico: [eventoHistorico("Solicitação aberta")],
    };
    const obs = String(dados.observacao || "").trim();
    if (obs)
      s.observacoes.push({
        dataHora: agora().toISOString(),
        usuarioId: usuario.id,
        texto: obs,
      });
    db().solicitacoes.push(s);
    registrarLog(
      "Manutenção",
      `Solicitação ${s.id} aberta para o veículo ${v.frota} · ${formatarPlaca(v.placa)}`,
      s.id,
    );
    return s;
  });
}

export function atualizarSolicitacao(id, dados) {
  return transacao(() => {
    exigir("manutencao.gerenciar");
    const s = obter("solicitacoes", id, "Solicitação");
    if (FINAIS.includes(s.status))
      throw new ErroNegocio(
        "Solicitação concluída ou cancelada não pode ser alterada.",
      );
    const os = osDaSolicitacao(s.id);
    const mudancas = [];

    if (
      dados.responsavelId !== undefined &&
      dados.responsavelId !== s.responsavelId
    ) {
      const r = dados.responsavelId
        ? obter("usuarios", dados.responsavelId, "Responsável")
        : null;
      if (r && !r.ativo)
        throw new ErroNegocio("O responsável selecionado está inativo.");
      s.responsavelId = r?.id ?? null;
      mudancas.push(`Responsável: ${r ? r.nome : "não atribuído"}`);
    }
    if (dados.prioridade && dados.prioridade !== s.prioridade) {
      exigirOpcao(dados.prioridade, PRIORIDADES, "a prioridade");
      s.prioridade = dados.prioridade;
      mudancas.push(`Prioridade: ${PRIORIDADES[dados.prioridade].label}`);
    }
    if (dados.status && dados.status !== s.status) {
      exigirOpcao(dados.status, STATUS_SOLICITACAO, "o status");
      const novo = dados.status;
      if (novo === "execucao" && (!os || os.status !== "andamento")) {
        throw new ErroNegocio(
          "Para iniciar a execução, abra uma ordem de serviço para esta solicitação.",
        );
      }
      if (novo === "concluida" && os && os.status === "andamento") {
        throw new ErroNegocio(
          `Conclua a ordem de serviço ${os.id} para concluir a solicitação.`,
        );
      }
      if (novo === "cancelada") {
        if (os && os.status === "andamento")
          throw new ErroNegocio(
            `Existe a ordem de serviço ${os.id} em andamento. Conclua-a antes de encerrar a solicitação.`,
          );
        exigirTexto(
          dados.observacao,
          "o motivo do cancelamento (campo observação)",
          5,
        );
      }
      if (novo === "aberta" && os)
        throw new ErroNegocio(
          'Solicitação com ordem de serviço não pode voltar para "Aberta".',
        );
      mudancas.push(
        `Status: ${STATUS_SOLICITACAO[s.status].label} → ${STATUS_SOLICITACAO[novo].label}`,
      );
      s.status = novo;
    }
    const obs = String(dados.observacao || "").trim();
    if (obs)
      s.observacoes.push({
        dataHora: agora().toISOString(),
        usuarioId: usuarioAtual().id,
        texto: obs,
      });
    if (!mudancas.length && !obs)
      throw new ErroNegocio("Nenhuma alteração informada.");
    if (mudancas.length)
      s.historico.push(eventoHistorico(mudancas.join(" · ")));
    sincronizarSituacaoVeiculo(s.veiculoId);
    registrarLog(
      "Manutenção",
      `Solicitação ${s.id} atualizada${mudancas.length ? `: ${mudancas.join(" · ")}` : " (observação)"}`,
      s.id,
    );
    return s;
  });
}

export function adicionarObservacao(id, texto) {
  return transacao(() => {
    const u = usuarioAtual();
    if (!pode("manutencao.solicitar") && !pode("manutencao.gerenciar"))
      exigir("manutencao.solicitar");
    const s = obter("solicitacoes", id, "Solicitação");
    const t = exigirTexto(texto, "a observação", 3);
    s.observacoes.push({
      dataHora: agora().toISOString(),
      usuarioId: u.id,
      texto: t,
    });
    registrarLog(
      "Manutenção",
      `Observação registrada na solicitação ${s.id}`,
      s.id,
    );
    return s;
  });
}

// ---------- Ordens de serviço ----------

export function abrirOS(solicitacaoId, dados) {
  return transacao(() => {
    exigir("manutencao.gerenciar");
    const s = obter("solicitacoes", solicitacaoId, "Solicitação");
    if (FINAIS.includes(s.status))
      throw new ErroNegocio(
        "Não é possível abrir OS para solicitação concluída ou cancelada.",
      );
    if (osDaSolicitacao(s.id))
      throw new ErroNegocio("Esta solicitação já possui ordem de serviço.");
    const responsavel = obter(
      "usuarios",
      dados.responsavelExecucaoId,
      "Responsável pela execução",
    );
    const dataInicio = exigirData(dados.dataInicio, "a data de início");
    if (dataInicio < s.dataAbertura)
      throw new ErroNegocio(
        "A data de início não pode ser anterior à abertura da solicitação.",
      );
    const os = {
      id: proximoId("OS"),
      solicitacaoId: s.id,
      veiculoId: s.veiculoId,
      cidade: s.cidade,
      diagnostico: exigirTexto(dados.diagnostico, "o diagnóstico", 5),
      servico: "",
      responsavelExecucaoId: responsavel.id,
      dataInicio,
      dataConclusao: null,
      custoEstimado: arred(
        exigirNumero(dados.custoEstimado, "O custo estimado", {
          min: 0,
          max: 1_000_000,
        }),
      ),
      custoFinal: null,
      categoriaCusto: "manutencao",
      status: "andamento",
      pecas: [],
      despesaId: null,
      historico: [eventoHistorico("Ordem de serviço aberta")],
    };
    db().ordens.push(os);
    if (!s.responsavelId) s.responsavelId = usuarioAtual().id;
    const anterior = s.status;
    s.status = "execucao";
    s.historico.push(
      eventoHistorico(
        `OS ${os.id} aberta · Status: ${STATUS_SOLICITACAO[anterior].label} → Em execução`,
      ),
    );
    sincronizarSituacaoVeiculo(s.veiculoId);
    registrarLog(
      "Manutenção",
      `Ordem de serviço ${os.id} aberta (solicitação ${s.id})`,
      os.id,
    );
    return os;
  });
}

export function atualizarOS(id, dados) {
  return transacao(() => {
    exigir("manutencao.gerenciar");
    const os = obter("ordens", id, "Ordem de serviço");
    if (os.status !== "andamento")
      throw new ErroNegocio(
        "Ordem de serviço concluída não pode ser alterada.",
      );
    os.diagnostico = exigirTexto(dados.diagnostico, "o diagnóstico", 5);
    os.servico = String(dados.servico || "").trim();
    os.responsavelExecucaoId = obter(
      "usuarios",
      dados.responsavelExecucaoId,
      "Responsável pela execução",
    ).id;
    os.custoEstimado = arred(
      exigirNumero(dados.custoEstimado, "O custo estimado", {
        min: 0,
        max: 1_000_000,
      }),
    );
    os.historico.push(eventoHistorico("Dados da OS atualizados"));
    registrarLog("Manutenção", `Ordem de serviço ${os.id} atualizada`, os.id);
    return os;
  });
}

export function adicionarPecaOS(
  osId,
  { materialId, quantidade, unidadeIds = [], posicao = "" },
) {
  return transacao(() => {
    exigir("manutencao.gerenciar");
    const os = obter("ordens", osId, "Ordem de serviço");
    if (os.status !== "andamento")
      throw new ErroNegocio("Não é possível lançar peças em OS concluída.");
    const material = obter("materiais", materialId, "Material");
    const { mov, destinacao } = aplicarPecaEmOS({
      os,
      material,
      quantidade,
      unidadeIds,
      posicao,
      data: hoje(),
    });
    const linha = {
      id: `${os.id}-P${os.pecas.length + 1}-${mov.id}`,
      materialId: material.id,
      quantidade: mov.quantidade,
      unidadeIds: mov.unidadeIds,
      posicao,
      custoUnitario: material.custoUnitario,
      movimentoId: mov.id,
      destinacaoId: destinacao.id,
      dataHora: agora().toISOString(),
      usuarioId: usuarioAtual().id,
    };
    os.pecas.push(linha);
    os.historico.push(
      eventoHistorico(
        `Peça aplicada: ${mov.quantidade} ${material.unidade} de ${material.nome} (baixa no estoque ${mov.id})`,
      ),
    );
    registrarLog(
      "Manutenção",
      `${mov.quantidade} ${material.unidade} de ${material.nome} aplicados na ${os.id}`,
      os.id,
    );
    return linha;
  });
}

export function removerPecaOS(osId, linhaId) {
  return transacao(() => {
    exigir("manutencao.gerenciar");
    const os = obter("ordens", osId, "Ordem de serviço");
    if (os.status !== "andamento")
      throw new ErroNegocio("Não é possível alterar peças de OS concluída.");
    const i = os.pecas.findIndex((p) => p.id === linhaId);
    if (i < 0) throw new ErroNegocio("Peça não encontrada nesta OS.");
    const linha = os.pecas[i];
    const material = obter("materiais", linha.materialId, "Material");
    const mov = estornarPecaDeOS({ os, linha });
    os.pecas.splice(i, 1);
    os.historico.push(
      eventoHistorico(
        `Peça estornada ao estoque: ${linha.quantidade} ${material.unidade} de ${material.nome} (${mov.id})`,
      ),
    );
    registrarLog(
      "Manutenção",
      `Estorno de ${material.nome} da ${os.id}`,
      os.id,
    );
    return mov;
  });
}

export function custoPecasOS(os) {
  return arred(
    os.pecas.reduce((t, p) => t + p.quantidade * p.custoUnitario, 0),
  );
}

export function concluirOS(id, dados) {
  return transacao(() => {
    exigir("manutencao.gerenciar");
    const os = obter("ordens", id, "Ordem de serviço");
    if (os.status !== "andamento")
      throw new ErroNegocio("Esta ordem de serviço já foi concluída.");
    const s = obter("solicitacoes", os.solicitacaoId, "Solicitação");
    os.servico = exigirTexto(dados.servico, "o serviço realizado", 5);
    const dataConclusao = exigirData(
      dados.dataConclusao,
      "a data de conclusão",
    );
    if (dataConclusao < os.dataInicio)
      throw new ErroNegocio(
        "A data de conclusão não pode ser anterior ao início.",
      );
    const custoFinal = arred(
      exigirNumero(dados.custoFinal, "O custo final do serviço", {
        min: 0,
        max: 1_000_000,
      }),
    );
    const categoria = ["manutencao", "servicos_externos"].includes(
      dados.categoriaCusto,
    )
      ? dados.categoriaCusto
      : "manutencao";
    os.dataConclusao = dataConclusao;
    os.custoFinal = custoFinal;
    os.categoriaCusto = categoria;
    os.status = "concluida";
    os.historico.push(
      eventoHistorico(
        `OS concluída · custo do serviço ${fmt.moeda(custoFinal)} · peças do estoque ${fmt.moeda(custoPecasOS(os))}`,
      ),
    );

    if (dados.registrarDespesa && custoFinal > 0) {
      // Apenas o serviço vira despesa: as peças já foram lançadas como despesa na compra.
      const v = obter("veiculos", os.veiculoId, "Veículo");
      const despesa = criarDespesaInterna({
        descricao: `Serviço da ${os.id} — veículo ${v.frota}`,
        categoria,
        cidade: os.cidade,
        veiculoId: os.veiculoId,
        data: dataConclusao,
        valor: custoFinal,
        origem: { tipo: "os", id: os.id },
      });
      os.despesaId = despesa.id;
    }

    const anterior = s.status;
    s.status = "concluida";
    s.historico.push(
      eventoHistorico(
        `OS ${os.id} concluída · Status: ${STATUS_SOLICITACAO[anterior].label} → Concluída`,
      ),
    );
    sincronizarSituacaoVeiculo(os.veiculoId, {
      liberar: Boolean(dados.liberarVeiculo),
    });
    registrarLog("Manutenção", `Ordem de serviço ${os.id} concluída`, os.id);
    return os;
  });
}

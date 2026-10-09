// Solicitações de compra e fluxo de aprovação pela diretoria.

import * as S from "../services/index.js";
import {
  STATUS_COMPRA,
  STATUS_SOLICITACAO_ATIVOS,
  CATEGORIAS_DESPESA,
  FORNECEDORES,
  STATUS_DESPESA,
  nomeCidade,
} from "../constants.js";
import { perfisAutorizados } from "../permissions.js";
import { esc, fmt, contem, somar, arred } from "../utils.js";
import {
  badge,
  botao,
  abrirModal,
  confirmar,
  executar,
  campo,
  opcoes,
  opcoesMapa,
  opcoesCidades,
  dadosFormulario,
  validarFormulario,
  tabela,
  paginar,
  paginacao,
  detalhes,
  linhaDoTempo,
  mostrarErro,
} from "../ui.js";
import { icone } from "../icons.js";
import { limparParametroRota } from "../router.js";

const filtros = { busca: "", cidade: "", status: "" };
let pagina = 1;

export default {
  titulo: "Solicitações de compra",
  descricao:
    "Pedidos de materiais com aprovação da diretoria, acompanhamento e recebimento.",
  render(el, rota, { navegacao }) {
    if (navegacao) {
      filtros.status = rota.query.get("status") ?? "";
      if (rota.query.has("cidade")) filtros.cidade = rota.query.get("cidade");
      pagina = 1;
    }
    el.innerHTML = `
      <div id="cmp-banner"></div>
      <div class="pipeline" id="cmp-pipeline"></div>
      <div class="page-toolbar">
        <div class="filters filters-inline" role="search">
          <div class="filter filter-grow"><label for="cmp-busca">Buscar</label><div class="input-icon">${icone("search")}<input id="cmp-busca" type="search" placeholder="Nº, item, justificativa ou solicitante" value="${esc(filtros.busca)}" data-filtro="busca"></div></div>
          <div class="filter"><label for="cmp-cidade">Cidade</label><select id="cmp-cidade" data-filtro="cidade">${opcoesCidades(filtros.cidade)}</select></div>
          <div class="filter"><label for="cmp-status">Status</label><select id="cmp-status" data-filtro="status">${opcoesMapa(STATUS_COMPRA, filtros.status, "Todos os status")}</select></div>
        </div>
        <div class="page-actions">${botao({ acao: "nova", texto: "Nova solicitação de compra", icone: "plus", variante: "primary", permissao: "compras.criar" })}</div>
      </div>
      <div id="cmp-resultado"></div>`;

    el.oninput = (e) => {
      if (e.target.dataset.filtro === "busca") {
        filtros.busca = e.target.value;
        pagina = 1;
        desenhar(el);
      }
    };
    el.onchange = (e) => {
      const f = e.target.dataset.filtro;
      if (f && f !== "busca") {
        filtros[f] = e.target.value;
        pagina = 1;
        desenhar(el);
      }
    };
    el.onclick = (e) => {
      const b = e.target.closest("[data-acao], [data-pagina]");
      if (!b) return;
      if (b.dataset.pagina) {
        pagina = Number(b.dataset.pagina);
        desenhar(el);
        return;
      }
      const acao = b.dataset.acao;
      if (acao === "nova") abrirNovaCompra();
      else if (acao === "ver") abrirDetalheCompra(b.dataset.id);
      else if (acao === "etapa") {
        filtros.status =
          filtros.status === b.dataset.valor ? "" : b.dataset.valor;
        el.querySelector("#cmp-status").value = filtros.status;
        pagina = 1;
        desenhar(el);
      }
    };
    el.onkeydown = (e) => {
      if (e.key === "Enter" && e.target.dataset?.acao === "ver")
        abrirDetalheCompra(e.target.dataset.id);
    };
    desenhar(el);
    if (navegacao && rota.param)
      abrirDetalheCompra(rota.param, {
        aoFechar: limparParametroRota("compras", rota.param),
      });
  },
};

function desenhar(el) {
  const s = S.db();
  const u = S.usuarioAtual();
  const aguardando = s.compras.filter((c) => c.status === "aguardando");

  el.querySelector("#cmp-banner").innerHTML =
    S.pode("compras.decidir") && aguardando.length
      ? `<div class="notice notice-warning notice-lg">${icone("gavel")}<span><strong>${aguardando.length} solicitação(ões) aguardando sua decisão</strong> · total estimado ${fmt.moeda(somar(aguardando, (c) => c.valorEstimado))}. Abra cada solicitação para aprovar ou rejeitar.</span><button type="button" class="btn btn-secondary btn-sm" data-acao="etapa" data-valor="aguardando">Ver pendências</button></div>`
      : u.perfil === "comprador"
        ? `<div class="notice notice-info">${icone("info")}<span>Fluxo: você cria a solicitação → a diretoria aprova ou rejeita → você registra o pedido → o recebimento gera entrada no estoque → o financeiro lança a despesa.</span></div>`
        : "";

  el.querySelector("#cmp-pipeline").innerHTML = Object.entries(STATUS_COMPRA)
    .map(([k, d]) => {
      const lista = s.compras.filter(
        (c) =>
          c.status === k && (!filtros.cidade || c.cidade === filtros.cidade),
      );
      return `<button type="button" class="pipeline-step step-${d.tom} ${filtros.status === k ? "is-active" : ""}" data-acao="etapa" data-valor="${k}" aria-pressed="${filtros.status === k}">
        <span class="pipeline-label">${esc(d.label)}</span>
        <strong>${lista.length}</strong>
        <small>${fmt.moeda(somar(lista, (c) => c.valorEstimado))}</small>
      </button>`;
    })
    .join("");

  const lista = [...s.compras]
    .filter(
      (c) =>
        (!filtros.cidade || c.cidade === filtros.cidade) &&
        (!filtros.status || c.status === filtros.status),
    )
    .filter(
      (c) =>
        !filtros.busca ||
        contem(
          `${c.id} ${c.justificativa} ${S.nomeUsuario(c.solicitanteId)} ${c.itens.map((i) => S.material(i.materialId)?.nome).join(" ")}`,
          filtros.busca,
        ),
    )
    .sort(
      (a, b) =>
        (b.status === "aguardando") - (a.status === "aguardando") ||
        b.data.localeCompare(a.data) ||
        b.id.localeCompare(a.id),
    );
  const pag = paginar(lista, pagina, 12);
  pagina = pag.pagina;
  el.querySelector("#cmp-resultado").innerHTML =
    `<div class="card card-flush">${tabela({
      colunas: [
        {
          titulo: "Nº",
          render: (c) => `<span class="mono">${c.id}</span>`,
          classe: "nowrap",
        },
        { titulo: "Data", render: (c) => fmt.data(c.data), classe: "nowrap" },
        {
          titulo: "Solicitante",
          render: (c) => esc(S.nomeUsuario(c.solicitanteId)),
          classe: "hide-sm",
        },
        {
          titulo: "Cidade",
          render: (c) => esc(nomeCidade(c.cidade)),
          classe: "hide-sm",
        },
        {
          titulo: "Itens",
          render: (c) =>
            `<span class="truncate" title="${esc(c.itens.map((i) => `${i.quantidade} ${i.unidade} ${S.material(i.materialId)?.nome}`).join("; "))}">${esc(c.itens.map((i) => `${fmt.numero(i.quantidade, i.quantidade % 1 ? 1 : 0)} ${i.unidade} ${S.material(i.materialId)?.nome}`).join("; "))}</span>`,
        },
        {
          titulo: "Valor estimado",
          render: (c) => fmt.moeda(c.valorEstimado),
          classe: "num nowrap",
        },
        { titulo: "Status", render: (c) => badge(STATUS_COMPRA, c.status) },
        {
          titulo: "Decisão",
          render: (c) =>
            c.decisao
              ? `${esc(S.nomeUsuario(c.decisao.usuarioId))}<small class="cell-sub">${fmt.dataHora(c.decisao.dataHora)}</small>`
              : '<span class="muted">Pendente</span>',
          classe: "hide-sm nowrap",
        },
      ],
      linhas: pag.itens,
      linhaAttrs: (c) =>
        `class="is-clickable ${c.status === "aguardando" ? "row-highlight" : ""}" data-acao="ver" data-id="${c.id}" tabindex="0"`,
      vazio: "Nenhuma solicitação de compra encontrada.",
    })}${paginacao(pag)}</div>`;
}

// ---------------------------------------------------------------------------
// Nova solicitação
// ---------------------------------------------------------------------------

function linhaItem(materiais, indice, item = {}) {
  return `
    <div class="item-line" data-linha="${indice}">
      <div class="field field-wide" data-campo="material-${indice}">
        <label>Material</label>
        <select name="material" required>${opcoes(
          materiais.map((m) => ({
            valor: m.id,
            texto: `${m.codigo} · ${m.nome} (saldo ${fmt.numero(S.saldo(m), ["L", "kg"].includes(m.unidade) ? 1 : 0)} ${m.unidade}${S.saldo(m) < m.minimo ? " · abaixo do mínimo" : ""})`,
          })),
          item.materialId ?? "",
          "Selecione",
        )}</select>
        <small class="field-error" role="alert"></small>
      </div>
      <div class="field" data-campo="qtd-${indice}"><label>Quantidade</label><input name="quantidade" type="number" min="0.1" step="any" value="${item.quantidade ?? ""}" required><small class="field-error" role="alert"></small></div>
      <div class="field" data-campo="valor-${indice}"><label>Valor unit. (R$)</label><input name="valorUnitario" type="number" min="0.01" step="0.01" value="${item.valorUnitario ?? ""}" required><small class="field-error" role="alert"></small></div>
      <div class="item-subtotal"><span>Subtotal</span><strong data-subtotal>—</strong></div>
      <button type="button" class="icon-btn" data-remover title="Remover item" aria-label="Remover item">${icone("trash")}</button>
    </div>`;
}

export function abrirNovaCompra() {
  const u = S.usuarioAtual();
  const materiais = [...S.db().materiais].sort(
    (a, b) =>
      (S.saldo(a) < a.minimo ? 0 : 1) - (S.saldo(b) < b.minimo ? 0 : 1) ||
      a.nome.localeCompare(b.nome),
  );
  const solicitacoes = S.db().solicitacoes.filter((x) =>
    STATUS_SOLICITACAO_ATIVOS.includes(x.status),
  );
  let contador = 1;
  abrirModal({
    titulo: "Nova solicitação de compra",
    subtitulo: `Solicitante: ${esc(u.nome)} — identificado pelo perfil ativo. A solicitação seguirá para aprovação da diretoria.`,
    tamanho: "lg",
    corpo: `
      <form class="form" novalidate>
        <div class="grid-form">
          ${campo({ rotulo: "Cidade de destino", nome: "cidade", tipo: "select", obrigatorio: true, opcoesHtml: opcoesCidades(u.cidade, "Selecione") })}
          ${campo({
            rotulo: "Vincular a solicitação mecânica (opcional)",
            nome: "solicitacaoId",
            tipo: "select",
            largura: "wide",
            opcoesHtml: opcoes(
              solicitacoes.map((x) => ({
                valor: x.id,
                texto: `${x.id} · ${S.rotuloVeiculo(x.veiculoId)} — ${x.descricao.slice(0, 60)}`,
              })),
              "",
              "Sem vínculo",
            ),
          })}
        </div>
        <fieldset class="items-box">
          <legend>Itens solicitados</legend>
          <div data-itens>${linhaItem(materiais, 0)}</div>
          <div class="items-foot">
            <button type="button" class="btn btn-ghost btn-sm" data-adicionar>${icone("plus")}<span>Adicionar item</span></button>
            <span>Valor estimado total: <strong data-total>${fmt.moeda(0)}</strong></span>
          </div>
        </fieldset>
        ${campo({ rotulo: "Justificativa", nome: "justificativa", tipo: "textarea", obrigatorio: true, attrs: 'rows="3" minlength="10" maxlength="500" placeholder="Explique a necessidade da compra para a decisão da diretoria."' })}
      </form>`,
    rodape: `<button type="button" class="btn btn-ghost" data-fechar-modal>Cancelar</button><button type="button" class="btn btn-primary" data-salvar>Enviar para aprovação</button>`,
    aoMontar(modal, ctrl) {
      const form = modal.querySelector("form");
      const caixa = form.querySelector("[data-itens]");
      const recalcular = () => {
        let total = 0;
        caixa.querySelectorAll(".item-line").forEach((l) => {
          const q = Number(l.querySelector("[name=quantidade]").value);
          const v = Number(l.querySelector("[name=valorUnitario]").value);
          const sub = q > 0 && v > 0 ? q * v : 0;
          total += sub;
          l.querySelector("[data-subtotal]").textContent = sub
            ? fmt.moeda(sub)
            : "—";
        });
        form.querySelector("[data-total]").textContent = fmt.moeda(total);
      };
      caixa.addEventListener("change", (e) => {
        if (e.target.name === "material") {
          const m = S.material(e.target.value);
          const valor = e.target
            .closest(".item-line")
            .querySelector("[name=valorUnitario]");
          if (m && !valor.value) valor.value = m.custoUnitario;
          const qtd = e.target
            .closest(".item-line")
            .querySelector("[name=quantidade]");
          if (m) qtd.step = ["L", "kg"].includes(m.unidade) ? "0.1" : "1";
        }
        recalcular();
      });
      caixa.addEventListener("input", recalcular);
      form.querySelector("[data-adicionar]").addEventListener("click", () => {
        caixa.insertAdjacentHTML("beforeend", linhaItem(materiais, contador));
        contador += 1;
      });
      caixa.addEventListener("click", (e) => {
        if (!e.target.closest("[data-remover]")) return;
        if (caixa.querySelectorAll(".item-line").length > 1)
          e.target.closest(".item-line").remove();
        recalcular();
      });
      const salvar = (e) => {
        e?.preventDefault();
        if (!validarFormulario(form)) return;
        const linhas = [...caixa.querySelectorAll(".item-line")];
        let ok = true;
        const itens = linhas.map((l) => {
          const i = l.dataset.linha;
          const item = {
            materialId: l.querySelector("[name=material]").value,
            quantidade: l.querySelector("[name=quantidade]").value,
            valorUnitario: l.querySelector("[name=valorUnitario]").value,
          };
          const erro = (campoErro, mensagem) => {
            mostrarErro(form, campoErro, mensagem);
            ok = false;
          };
          if (!item.materialId) erro(`material-${i}`, "Selecione o material.");
          if (!(Number(item.quantidade) > 0))
            erro(`qtd-${i}`, "Informe a quantidade.");
          if (!(Number(item.valorUnitario) > 0))
            erro(`valor-${i}`, "Informe o valor.");
          return item;
        });
        if (!ok) return;
        const d = dadosFormulario(form);
        const compra = executar(
          () =>
            S.criarCompra({
              cidade: d.cidade,
              solicitacaoId: d.solicitacaoId || null,
              justificativa: d.justificativa,
              itens,
            }),
          (c) => `Solicitação ${c.id} enviada para aprovação da diretoria.`,
        );
        if (compra) {
          ctrl.fechar();
          abrirDetalheCompra(compra.id);
        }
      };
      form.addEventListener("submit", salvar);
      modal.querySelector("[data-salvar]").addEventListener("click", salvar);
    },
  });
}

// ---------------------------------------------------------------------------
// Detalhe e fluxo
// ---------------------------------------------------------------------------

function etapas(c) {
  const rejeitada = c.status === "rejeitada";
  const ordem = ["aguardando", "aprovada", "em_compra", "recebida"];
  const atual = ordem.indexOf(c.status);
  const passos = [
    { rotulo: "Criada", feito: true, meta: fmt.data(c.data) },
    {
      rotulo: "Aguardando aprovação",
      feito: c.status !== "aguardando",
      atual: c.status === "aguardando",
    },
    rejeitada
      ? {
          rotulo: "Rejeitada",
          feito: true,
          erro: true,
          meta: fmt.data(c.decisao?.dataHora),
        }
      : {
          rotulo: "Aprovada",
          feito: atual >= 1,
          meta: c.decisao ? fmt.data(c.decisao.dataHora) : "",
        },
    {
      rotulo: "Pedido realizado",
      feito: !rejeitada && atual >= 2,
      atual: c.status === "aprovada",
      inativo: rejeitada,
      meta: c.pedido ? fmt.data(c.pedido.dataHora) : "",
    },
    {
      rotulo: "Recebida",
      feito: c.status === "recebida",
      atual: c.status === "em_compra",
      inativo: rejeitada,
      meta: c.recebimento ? fmt.data(c.recebimento.data) : "",
    },
    {
      rotulo: "Despesa lançada",
      feito: Boolean(c.despesaId),
      atual: ["em_compra", "recebida"].includes(c.status) && !c.despesaId,
      inativo: rejeitada,
    },
  ];
  return `<ol class="stepper">${passos
    .map(
      (p) =>
        `<li class="${p.feito ? "is-done" : ""} ${p.atual ? "is-current" : ""} ${p.erro ? "is-error" : ""} ${p.inativo ? "is-disabled" : ""}"><span class="step-dot">${p.erro ? icone("x") : p.feito ? icone("check") : ""}</span><span class="step-label">${esc(p.rotulo)}</span>${p.meta ? `<small>${esc(p.meta)}</small>` : ""}</li>`,
    )
    .join("")}</ol>`;
}

function blocoAcoes(c) {
  const partes = [];
  if (c.status === "aguardando") {
    if (S.pode("compras.decidir")) {
      partes.push(
        `<div class="decision-box"><div><strong>Decisão da diretoria</strong><p>Analise os itens, o valor e a justificativa. A decisão registra o usuário, a data e o motivo. A aprovação não registra pagamento.</p></div><div class="decision-actions"><button type="button" class="btn btn-danger" data-acao="rejeitar">${icone("xCircle")}<span>Rejeitar</span></button><button type="button" class="btn btn-success" data-acao="aprovar">${icone("checkCircle")}<span>Aprovar</span></button></div></div>`,
      );
    } else {
      partes.push(
        `<div class="notice notice-warning">${icone("clock")}<span>Aguardando decisão da diretoria. Os botões <strong>Aprovar</strong> e <strong>Rejeitar</strong> aparecem apenas para o perfil ${esc(perfisAutorizados("compras.decidir"))}.</span></div>`,
      );
    }
  }
  if (c.status === "aprovada") {
    partes.push(
      S.pode("compras.acompanhar")
        ? `<div class="action-row">${botao({ acao: "pedido", texto: "Registrar pedido ao fornecedor", icone: "cart", variante: "primary" })}</div>`
        : `<div class="notice notice-info">${icone("info")}<span>Aprovada. Próxima etapa: pedido ao fornecedor, registrado por ${esc(perfisAutorizados("compras.acompanhar"))}.</span></div>`,
    );
  }
  if (c.status === "em_compra") {
    partes.push(
      S.pode("compras.receber")
        ? `<div class="action-row">${botao({ acao: "receber", texto: "Registrar recebimento", icone: "inbox", variante: "primary" })}</div>`
        : `<div class="notice notice-info">${icone("info")}<span>Pedido realizado. O recebimento é registrado por ${esc(perfisAutorizados("compras.receber"))}.</span></div>`,
    );
  }
  if (["em_compra", "recebida"].includes(c.status) && !c.despesaId) {
    partes.push(
      S.pode("despesas.registrar")
        ? `<div class="action-row">${botao({ acao: "despesa", texto: "Registrar despesa efetiva", icone: "receipt", variante: c.status === "recebida" ? "primary" : "secondary" })}<span class="muted small">A despesa é registrada separadamente da aprovação.</span></div>`
        : c.status === "recebida"
          ? `<div class="notice notice-muted">${icone("info")}<span>Despesa ainda não lançada. Lançamento feito por ${esc(perfisAutorizados("despesas.registrar"))}.</span></div>`
          : "",
    );
  }
  if (c.status === "rejeitada") {
    partes.push(
      `<div class="notice notice-danger">${icone("xCircle")}<span>Solicitação rejeitada. Não gera pedido, entrada de estoque nem despesa.</span></div>`,
    );
  }
  return partes.join("");
}

function conteudoCompra(id) {
  const c = S.db().compras.find((x) => x.id === id);
  const despesa = c.despesaId
    ? S.db().despesas.find((d) => d.id === c.despesaId)
    : null;
  const sm = c.solicitacaoId
    ? S.db().solicitacoes.find((x) => x.id === c.solicitacaoId)
    : null;
  const corpo = `
    ${etapas(c)}
    ${blocoAcoes(c)}
    ${detalhes([
      ["Solicitante", esc(S.nomeUsuario(c.solicitanteId))],
      ["Data", fmt.data(c.data)],
      ["Cidade de destino", esc(nomeCidade(c.cidade))],
      ["Status", badge(STATUS_COMPRA, c.status)],
      ["Valor estimado", `<strong>${fmt.moeda(c.valorEstimado)}</strong>`],
      [
        "Solicitação mecânica",
        sm
          ? `<a class="link" href="#/manutencao/${sm.id}">${sm.id}</a> · ${esc(S.rotuloVeiculo(sm.veiculoId))}`
          : "—",
      ],
      ["Justificativa", esc(c.justificativa), true],
    ])}
    <h4 class="subhead">Itens solicitados</h4>
    ${tabela({
      colunas: [
        {
          titulo: "Código",
          render: (i) =>
            `<span class="mono">${esc(S.material(i.materialId)?.codigo)}</span>`,
        },
        {
          titulo: "Material",
          render: (i) => esc(S.material(i.materialId)?.nome),
        },
        {
          titulo: "Quantidade",
          render: (i) =>
            `${fmt.numero(i.quantidade, i.quantidade % 1 ? 1 : 0)} ${esc(i.unidade)}`,
          classe: "num nowrap",
        },
        {
          titulo: "Valor unit.",
          render: (i) => fmt.moeda(i.valorUnitario),
          classe: "num nowrap",
        },
        {
          titulo: "Subtotal",
          render: (i) => fmt.moeda(i.subtotal),
          classe: "num nowrap",
        },
      ],
      linhas: c.itens,
      rodape: `<tr><td colspan="4" class="num"><strong>Total estimado</strong></td><td class="num"><strong>${fmt.moeda(c.valorEstimado)}</strong></td></tr>`,
    })}
    ${
      c.decisao
        ? `<h4 class="subhead">Decisão da diretoria</h4>${detalhes([
            ["Resultado", badge(STATUS_COMPRA, c.decisao.resultado)],
            ["Decidido por", esc(S.nomeUsuario(c.decisao.usuarioId))],
            ["Data e hora", fmt.dataHora(c.decisao.dataHora)],
            [
              "Motivo / observação",
              esc(c.decisao.motivo) ||
                '<span class="muted">Não informado</span>',
              true,
            ],
          ])}`
        : ""
    }
    ${
      c.pedido
        ? `<h4 class="subhead">Pedido</h4>${detalhes([
            ["Fornecedor", esc(c.pedido.fornecedor)],
            ["Previsão de entrega", fmt.data(c.pedido.previsaoEntrega)],
            [
              "Registrado por",
              `${esc(S.nomeUsuario(c.pedido.usuarioId))} · ${fmt.dataHora(c.pedido.dataHora)}`,
            ],
            c.pedido.observacao
              ? ["Observação", esc(c.pedido.observacao), true]
              : null,
          ])}`
        : ""
    }
    ${
      c.recebimento
        ? `<h4 class="subhead">Recebimento</h4>${detalhes([
            ["Data", fmt.data(c.recebimento.data)],
            ["Registrado por", esc(S.nomeUsuario(c.recebimento.usuarioId))],
            ["Nota fiscal", esc(c.recebimento.notaFiscal) || "—"],
            [
              "Entrada no estoque",
              c.recebimento.entradaEstoque
                ? `Sim · movimentos <span class="mono">${c.recebimento.movimentoIds.join(", ")}</span> · <a class="link" href="#/estoque?aba=movimentos&ref=${c.id}">ver no estoque</a>`
                : "Não gerada",
              true,
            ],
          ])}`
        : ""
    }
    ${
      despesa
        ? `<h4 class="subhead">Despesa vinculada</h4>${detalhes([
            ["Nº", `<span class="mono">${despesa.id}</span>`],
            ["Valor efetivo", fmt.moeda(despesa.valor)],
            ["Situação", badge(STATUS_DESPESA, despesa.status)],
          ])}`
        : ""
    }
    <h4 class="subhead">Histórico</h4>
    ${linhaDoTempo(c.historico)}`;
  return {
    titulo: `Solicitação de compra ${c.id}`,
    subtitulo: `${esc(S.nomeUsuario(c.solicitanteId))} · ${fmt.data(c.data)} · ${esc(nomeCidade(c.cidade))}`,
    corpo,
  };
}

export function abrirDetalheCompra(id, { aoFechar } = {}) {
  if (!S.db().compras.some((c) => c.id === id)) {
    executar(() => {
      throw new S.ErroNegocio(`Solicitação de compra ${id} não encontrada.`);
    });
    return;
  }
  abrirModal({
    ...conteudoCompra(id),
    tamanho: "lg",
    aoFechar,
    aoMontar(modal, ctrl) {
      const atualizar = () => ctrl.atualizar(conteudoCompra(id));
      modal.addEventListener("click", async (e) => {
        const b = e.target.closest("[data-acao]");
        if (!b) return;
        const c = S.db().compras.find((x) => x.id === id);
        const acao = b.dataset.acao;
        if (acao === "aprovar") {
          const r = await confirmar({
            titulo: `Aprovar ${id}`,
            mensagem: `<p>Aprovar a compra de <strong>${c.itens.length} item(ns)</strong> no valor estimado de <strong>${fmt.moeda(c.valorEstimado)}</strong>?</p><p class="muted">A aprovação libera o pedido ao fornecedor. Nenhum pagamento é registrado.</p>`,
            textoConfirmar: "Aprovar compra",
            motivo: {
              rotulo: "Observação (opcional)",
              obrigatorio: false,
              placeholder: "Ex.: priorizar fornecedor local",
            },
          });
          if (
            r &&
            executar(
              () => S.decidirCompra(id, "aprovar", r.motivo),
              `Solicitação ${id} aprovada.`,
            )
          )
            atualizar();
        } else if (acao === "rejeitar") {
          const r = await confirmar({
            titulo: `Rejeitar ${id}`,
            mensagem:
              "<p>A solicitação será encerrada como <strong>rejeitada</strong> e não poderá gerar pedido nem entrada de estoque.</p>",
            textoConfirmar: "Rejeitar compra",
            perigo: true,
            motivo: {
              rotulo: "Motivo da rejeição",
              obrigatorio: true,
              minimo: 5,
              placeholder: "Ex.: solicitar novas cotações",
            },
          });
          if (
            r &&
            executar(
              () => S.decidirCompra(id, "rejeitar", r.motivo),
              `Solicitação ${id} rejeitada.`,
            )
          )
            atualizar();
        } else if (acao === "pedido") abrirPedido(c, atualizar);
        else if (acao === "receber") abrirRecebimento(c, atualizar);
        else if (acao === "despesa") abrirDespesaCompra(c, atualizar);
      });
      modal
        .querySelectorAll('a[href^="#/"]')
        .forEach((a) => a.addEventListener("click", () => ctrl.fechar()));
    },
  });
}

function abrirPedido(c, aoConcluir) {
  abrirModal({
    titulo: `Registrar pedido — ${c.id}`,
    tamanho: "sm",
    corpo: `
      <form class="form" novalidate>
        ${campo({ rotulo: "Fornecedor", nome: "fornecedor", obrigatorio: true, attrs: 'list="lista-fornecedores" minlength="3" maxlength="80" placeholder="Fornecedor fictício"' })}
        <datalist id="lista-fornecedores">${FORNECEDORES.map((f) => `<option value="${esc(f)}">`).join("")}</datalist>
        ${campo({ rotulo: "Previsão de entrega", nome: "previsaoEntrega", tipo: "date", obrigatorio: true, attrs: `min="${c.data}"` })}
        ${campo({ rotulo: "Observação", nome: "observacao", tipo: "textarea", attrs: 'rows="2" maxlength="300"' })}
      </form>`,
    rodape: `<button type="button" class="btn btn-ghost" data-fechar-modal>Cancelar</button><button type="button" class="btn btn-primary" data-salvar>Registrar pedido</button>`,
    aoMontar(modal, ctrl) {
      const form = modal.querySelector("form");
      const salvar = (e) => {
        e?.preventDefault();
        if (!validarFormulario(form)) return;
        if (
          executar(
            () => S.registrarPedido(c.id, dadosFormulario(form)),
            "Pedido registrado.",
          )
        ) {
          ctrl.fechar();
          aoConcluir();
        }
      };
      form.addEventListener("submit", salvar);
      modal.querySelector("[data-salvar]").addEventListener("click", salvar);
    },
  });
}

function abrirRecebimento(c, aoConcluir) {
  abrirModal({
    titulo: `Registrar recebimento — ${c.id}`,
    tamanho: "md",
    corpo: `
      <form class="form" novalidate>
        <div class="grid-form">
          ${campo({ rotulo: "Data de recebimento", nome: "data", tipo: "date", valor: S.hoje(), obrigatorio: true, attrs: `min="${c.data}" max="${S.hoje()}"` })}
          ${campo({ rotulo: "Nota fiscal (opcional)", nome: "notaFiscal", attrs: 'maxlength="40" placeholder="Número fictício"' })}
        </div>
        <label class="check"><input type="checkbox" name="gerarEntrada" checked> Gerar entrada no estoque para os itens abaixo</label>
        ${tabela({
          colunas: [
            {
              titulo: "Material",
              render: (i) => esc(S.material(i.materialId)?.nome),
            },
            {
              titulo: "Entrada",
              render: (i) =>
                `+${fmt.numero(i.quantidade, i.quantidade % 1 ? 1 : 0)} ${esc(i.unidade)}`,
              classe: "num",
            },
            {
              titulo: "Saldo atual",
              render: (i) =>
                `${fmt.numero(S.saldo(S.material(i.materialId)), 1).replace(",0", "")} ${esc(i.unidade)}`,
              classe: "num",
            },
            {
              titulo: "Controle",
              render: (i) =>
                S.material(i.materialId)?.rastreavel
                  ? "Individual (gera identificadores)"
                  : "Por quantidade",
            },
          ],
          linhas: c.itens,
        })}
        <p class="muted small">O recebimento só pode ser registrado uma vez; a entrada no estoque não é duplicada.</p>
      </form>`,
    rodape: `<button type="button" class="btn btn-ghost" data-fechar-modal>Cancelar</button><button type="button" class="btn btn-primary" data-salvar>Confirmar recebimento</button>`,
    aoMontar(modal, ctrl) {
      const form = modal.querySelector("form");
      const salvar = (e) => {
        e?.preventDefault();
        if (!validarFormulario(form)) return;
        if (
          executar(
            () => S.registrarRecebimento(c.id, dadosFormulario(form)),
            (r) =>
              r.recebimento.entradaEstoque
                ? "Recebimento registrado e estoque atualizado."
                : "Recebimento registrado sem entrada no estoque.",
          )
        ) {
          ctrl.fechar();
          aoConcluir();
        }
      };
      form.addEventListener("submit", salvar);
      modal.querySelector("[data-salvar]").addEventListener("click", salvar);
    },
  });
}

function abrirDespesaCompra(c, aoConcluir) {
  abrirModal({
    titulo: `Registrar despesa — ${c.id}`,
    subtitulo:
      "Despesa efetiva da compra (separada da aprovação). Cada compra aceita apenas uma despesa ativa.",
    tamanho: "md",
    corpo: `
      <form class="form grid-form" novalidate>
        ${campo({ rotulo: "Descrição", nome: "descricao", valor: `Compra ${c.id}${c.pedido ? ` — ${c.pedido.fornecedor}` : ""}`, obrigatorio: true, largura: "full", attrs: 'minlength="3" maxlength="120"' })}
        ${campo({ rotulo: "Valor efetivo (R$)", nome: "valor", tipo: "number", valor: c.valorEstimado, obrigatorio: true, attrs: 'min="0.01" step="0.01"', ajuda: `Estimado: ${fmt.moeda(c.valorEstimado)}` })}
        ${campo({ rotulo: "Data", nome: "data", tipo: "date", valor: S.hoje(), obrigatorio: true, attrs: `max="${S.hoje()}"` })}
        ${campo({ rotulo: "Categoria", nome: "categoria", tipo: "select", obrigatorio: true, opcoesHtml: opcoesMapa(CATEGORIAS_DESPESA, S.categoriaSugerida(c)) })}
        ${campo({ rotulo: "Cidade", nome: "cidade", tipo: "select", obrigatorio: true, opcoesHtml: opcoesCidades(c.cidade, null) })}
        ${campo({ rotulo: "Fornecedor", nome: "fornecedor", valor: c.pedido?.fornecedor ?? "", largura: "wide", attrs: 'maxlength="80"' })}
      </form>`,
    rodape: `<button type="button" class="btn btn-ghost" data-fechar-modal>Cancelar</button><button type="button" class="btn btn-primary" data-salvar>Registrar despesa</button>`,
    aoMontar(modal, ctrl) {
      const form = modal.querySelector("form");
      const salvar = (e) => {
        e?.preventDefault();
        if (!validarFormulario(form)) return;
        const d = dadosFormulario(form);
        if (
          executar(
            () =>
              S.registrarDespesa({
                ...d,
                valor: arred(Number(d.valor)),
                origemTipo: "compra",
                origemId: c.id,
              }),
            (r) => `Despesa ${r.id} registrada.`,
          )
        ) {
          ctrl.fechar();
          aoConcluir();
        }
      };
      form.addEventListener("submit", salvar);
      modal.querySelector("[data-salvar]").addEventListener("click", salvar);
    },
  });
}

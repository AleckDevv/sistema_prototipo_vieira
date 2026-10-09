// Manutenção: solicitações mecânicas e ordens de serviço.

import * as S from "../services/index.js";
import {
  STATUS_SOLICITACAO,
  STATUS_SOLICITACAO_ATIVOS,
  PRIORIDADES,
  STATUS_OS,
  STATUS_COMPRA,
  POSICOES_PNEU,
  POSICOES_BATERIA,
  nomeCidade,
} from "../constants.js";
import { PERFIS } from "../permissions.js";
import { esc, fmt, contem } from "../utils.js";
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
  abas,
  avisoPermissao,
  mostrarErro,
} from "../ui.js";
import { icone } from "../icons.js";
import { limparParametroRota } from "../router.js";

const filtros = {
  busca: "",
  cidade: "",
  status: "pendentes",
  prioridade: "",
  minhas: false,
};
const filtrosOS = { busca: "", cidade: "", status: "" };
let aba = "solicitacoes";
let pagina = 1;
let paginaOS = 1;

export default {
  titulo: "Manutenção",
  descricao: "Solicitações mecânicas, ordens de serviço e peças aplicadas.",
  render(el, rota, { navegacao }) {
    if (navegacao) {
      if (rota.query.has("status")) filtros.status = rota.query.get("status");
      if (rota.query.has("prioridade")) {
        filtros.prioridade = rota.query.get("prioridade");
        filtros.status = "pendentes";
      }
      if (rota.query.has("cidade")) filtros.cidade = rota.query.get("cidade");
      filtros.minhas = rota.query.get("minhas") === "1";
      if (rota.query.has("aba")) aba = rota.query.get("aba");
      pagina = 1;
    }
    el.innerHTML = `
      <div class="page-toolbar">
        ${abas(
          [
            {
              id: "solicitacoes",
              rotulo: "Solicitações",
              contador: S.db().solicitacoes.filter((x) =>
                STATUS_SOLICITACAO_ATIVOS.includes(x.status),
              ).length,
            },
            {
              id: "os",
              rotulo: "Ordens de serviço",
              contador: S.db().ordens.filter((o) => o.status === "andamento")
                .length,
            },
          ],
          aba,
        )}
        <div class="page-actions">${botao({ acao: "nova", texto: "Nova solicitação", icone: "plus", variante: "primary", permissao: "manutencao.solicitar" })}</div>
      </div>
      <div id="man-conteudo"></div>`;

    el.onclick = (e) => {
      const b = e.target.closest("[data-aba], [data-acao], [data-pagina]");
      if (!b) return;
      if (b.dataset.aba) {
        aba = b.dataset.aba;
        this.render(el, rota, { navegacao: false });
        return;
      }
      if (b.dataset.pagina) {
        if (b.dataset.alvo === "os") paginaOS = Number(b.dataset.pagina);
        else pagina = Number(b.dataset.pagina);
        desenhar(el);
        return;
      }
      const acao = b.dataset.acao;
      if (acao === "nova") abrirNovaSolicitacao();
      else if (acao === "ver-sm") abrirDetalheSolicitacao(b.dataset.id);
      else if (acao === "ver-os") abrirDetalheOS(b.dataset.id);
      else if (acao === "chip") {
        filtros.status =
          filtros.status === b.dataset.valor ? "" : b.dataset.valor;
        pagina = 1;
        desenhar(el);
      } else if (acao === "limpar-minhas") {
        filtros.minhas = false;
        desenhar(el);
      }
    };
    el.oninput = (e) => {
      const f = e.target.dataset.filtro;
      if (f === "busca") {
        filtros.busca = e.target.value;
        pagina = 1;
        desenharResultado(el);
      } else if (f === "busca-os") {
        filtrosOS.busca = e.target.value;
        paginaOS = 1;
        desenharResultado(el);
      }
    };
    el.onchange = (e) => {
      const f = e.target.dataset.filtro;
      if (!f || f.startsWith("busca")) return;
      if (f.endsWith("-os")) {
        filtrosOS[f.replace("-os", "")] = e.target.value;
        paginaOS = 1;
      } else {
        filtros[f] = e.target.value;
        pagina = 1;
      }
      desenhar(el);
    };
    el.onkeydown = (e) => {
      if (e.key !== "Enter") return;
      const id = e.target.dataset?.id;
      if (e.target.dataset?.acao === "ver-sm") abrirDetalheSolicitacao(id);
      if (e.target.dataset?.acao === "ver-os") abrirDetalheOS(id);
    };
    desenhar(el);

    if (navegacao && rota.param) {
      if (rota.param.startsWith("OS-"))
        abrirDetalheOS(rota.param, {
          aoFechar: limparParametroRota("manutencao", rota.param),
        });
      else
        abrirDetalheSolicitacao(rota.param, {
          aoFechar: limparParametroRota("manutencao", rota.param),
        });
    }
  },
};

function desenhar(el) {
  const alvo = el.querySelector("#man-conteudo");
  if (aba === "os") {
    alvo.innerHTML = `
      <div class="filters" role="search">
        <div class="filter filter-grow"><label for="os-busca">Buscar</label><div class="input-icon">${icone("search")}<input id="os-busca" type="search" placeholder="Nº da OS, solicitação, placa ou frota" value="${esc(filtrosOS.busca)}" data-filtro="busca-os"></div></div>
        <div class="filter"><label for="os-cidade">Cidade</label><select id="os-cidade" data-filtro="cidade-os">${opcoesCidades(filtrosOS.cidade)}</select></div>
        <div class="filter"><label for="os-status">Status</label><select id="os-status" data-filtro="status-os">${opcoesMapa(STATUS_OS, filtrosOS.status, "Todos")}</select></div>
      </div>
      <div id="man-resultado"></div>`;
  } else {
    const base = S.db().solicitacoes;
    alvo.innerHTML = `
      <div class="chips chips-row">
        <button type="button" class="chip ${filtros.status === "pendentes" ? "is-active" : ""}" data-acao="chip" data-valor="pendentes">Pendentes<strong>${base.filter((x) => STATUS_SOLICITACAO_ATIVOS.includes(x.status)).length}</strong></button>
        ${Object.entries(STATUS_SOLICITACAO)
          .map(
            ([k, d]) =>
              `<button type="button" class="chip chip-${d.tom} ${filtros.status === k ? "is-active" : ""}" data-acao="chip" data-valor="${k}" aria-pressed="${filtros.status === k}">${esc(d.label)}<strong>${base.filter((x) => x.status === k).length}</strong></button>`,
          )
          .join("")}
      </div>
      <div class="filters" role="search">
        <div class="filter filter-grow"><label for="sm-busca">Buscar</label><div class="input-icon">${icone("search")}<input id="sm-busca" type="search" placeholder="Nº, placa, frota ou descrição do problema" value="${esc(filtros.busca)}" data-filtro="busca"></div></div>
        <div class="filter"><label for="sm-cidade">Cidade</label><select id="sm-cidade" data-filtro="cidade">${opcoesCidades(filtros.cidade)}</select></div>
        <div class="filter"><label for="sm-status">Status</label><select id="sm-status" data-filtro="status">${opcoes([{ valor: "pendentes", texto: "Pendentes (em aberto)" }, ...Object.entries(STATUS_SOLICITACAO).map(([valor, d]) => ({ valor, texto: d.label }))], filtros.status, "Todos os status")}</select></div>
        <div class="filter"><label for="sm-prio">Prioridade</label><select id="sm-prio" data-filtro="prioridade">${opcoesMapa(PRIORIDADES, filtros.prioridade, "Todas")}</select></div>
      </div>
      ${filtros.minhas ? `<div class="notice notice-info">${icone("info")}<span>Exibindo somente as solicitações abertas por você.</span><button type="button" class="btn btn-ghost btn-sm" data-acao="limpar-minhas">Mostrar todas</button></div>` : ""}
      <div id="man-resultado"></div>`;
  }
  desenharResultado(el);
}

function desenharResultado(el) {
  const alvo = el.querySelector("#man-resultado");
  if (aba === "os") {
    const lista = [...S.db().ordens]
      .filter(
        (o) =>
          (!filtrosOS.cidade || o.cidade === filtrosOS.cidade) &&
          (!filtrosOS.status || o.status === filtrosOS.status),
      )
      .filter(
        (o) =>
          !filtrosOS.busca ||
          contem(
            `${o.id} ${o.solicitacaoId} ${S.rotuloVeiculo(o.veiculoId)} ${S.veiculo(o.veiculoId)?.placa}`,
            filtrosOS.busca,
          ),
      )
      .sort((a, b) =>
        a.status === b.status
          ? b.id.localeCompare(a.id)
          : a.status === "andamento"
            ? -1
            : 1,
      );
    const pag = paginar(lista, paginaOS, 12);
    paginaOS = pag.pagina;
    alvo.innerHTML = `<div class="card card-flush">${tabela({
      colunas: [
        {
          titulo: "OS",
          render: (o) =>
            `<span class="mono">${o.id}</span><small class="cell-sub">${o.solicitacaoId}</small>`,
          classe: "nowrap",
        },
        {
          titulo: "Veículo",
          render: (o) =>
            `${esc(S.rotuloVeiculo(o.veiculoId))}<small class="cell-sub">${esc(nomeCidade(o.cidade))}</small>`,
          classe: "nowrap",
        },
        {
          titulo: "Diagnóstico",
          render: (o) =>
            `<span class="truncate" title="${esc(o.diagnostico)}">${esc(o.diagnostico)}</span>`,
        },
        {
          titulo: "Execução",
          render: (o) => esc(S.nomeUsuario(o.responsavelExecucaoId)),
          classe: "hide-sm",
        },
        {
          titulo: "Início",
          render: (o) => fmt.data(o.dataInicio),
          classe: "nowrap hide-sm",
        },
        {
          titulo: "Conclusão",
          render: (o) => fmt.data(o.dataConclusao),
          classe: "nowrap hide-sm",
        },
        {
          titulo: "Estimado",
          render: (o) => fmt.moeda(o.custoEstimado),
          classe: "num nowrap hide-sm",
        },
        {
          titulo: "Serviço (final)",
          render: (o) =>
            o.custoFinal === null ? "—" : fmt.moeda(o.custoFinal),
          classe: "num nowrap",
        },
        { titulo: "Status", render: (o) => badge(STATUS_OS, o.status) },
      ],
      linhas: pag.itens,
      linhaAttrs: (o) =>
        `class="is-clickable" data-acao="ver-os" data-id="${o.id}" tabindex="0"`,
      vazio: "Nenhuma ordem de serviço encontrada.",
    })}${paginacao(pag, "os")}</div>`;
    return;
  }

  const u = S.usuarioAtual();
  const lista = [...S.db().solicitacoes]
    .filter((x) =>
      filtros.status === "pendentes"
        ? STATUS_SOLICITACAO_ATIVOS.includes(x.status)
        : !filtros.status || x.status === filtros.status,
    )
    .filter(
      (x) =>
        (!filtros.cidade || x.cidade === filtros.cidade) &&
        (!filtros.prioridade || x.prioridade === filtros.prioridade) &&
        (!filtros.minhas || x.solicitanteId === u.id),
    )
    .filter(
      (x) =>
        !filtros.busca ||
        contem(
          `${x.id} ${S.rotuloVeiculo(x.veiculoId)} ${S.veiculo(x.veiculoId)?.placa} ${x.descricao}`,
          filtros.busca,
        ),
    )
    .sort(
      (a, b) =>
        PRIORIDADES[b.prioridade].peso *
          (STATUS_SOLICITACAO_ATIVOS.includes(b.status) ? 1 : 0) -
          PRIORIDADES[a.prioridade].peso *
            (STATUS_SOLICITACAO_ATIVOS.includes(a.status) ? 1 : 0) ||
        b.dataAbertura.localeCompare(a.dataAbertura) ||
        b.id.localeCompare(a.id),
    );
  const pag = paginar(lista, pagina, 12);
  pagina = pag.pagina;
  alvo.innerHTML = `<div class="card card-flush">${tabela({
    colunas: [
      {
        titulo: "Nº",
        render: (x) => `<span class="mono">${x.id}</span>`,
        classe: "nowrap",
      },
      {
        titulo: "Abertura",
        render: (x) => fmt.data(x.dataAbertura),
        classe: "nowrap hide-sm",
      },
      {
        titulo: "Veículo",
        render: (x) =>
          `${esc(S.rotuloVeiculo(x.veiculoId))}<small class="cell-sub">${esc(nomeCidade(x.cidade))}</small>`,
        classe: "nowrap",
      },
      {
        titulo: "Problema",
        render: (x) =>
          `<span class="truncate" title="${esc(x.descricao)}">${esc(x.descricao)}</span>`,
      },
      { titulo: "Prioridade", render: (x) => badge(PRIORIDADES, x.prioridade) },
      {
        titulo: "Solicitante",
        render: (x) => esc(S.nomeUsuario(x.solicitanteId)),
        classe: "hide-sm",
      },
      {
        titulo: "Responsável",
        render: (x) =>
          x.responsavelId
            ? esc(S.nomeUsuario(x.responsavelId))
            : '<span class="muted">Não atribuído</span>',
        classe: "hide-sm",
      },
      { titulo: "Status", render: (x) => badge(STATUS_SOLICITACAO, x.status) },
    ],
    linhas: pag.itens,
    linhaAttrs: (x) =>
      `class="is-clickable" data-acao="ver-sm" data-id="${x.id}" tabindex="0"`,
    vazio: "Nenhuma solicitação encontrada com os filtros atuais.",
  })}${paginacao(pag)}</div>`;
}

// ---------------------------------------------------------------------------
// Nova solicitação
// ---------------------------------------------------------------------------

export function abrirNovaSolicitacao(veiculoId = "") {
  const u = S.usuarioAtual();
  const veiculos = S.veiculosOrdenados().filter(
    (v) => v.situacao !== "inativo",
  );
  abrirModal({
    titulo: "Nova solicitação mecânica",
    subtitulo: `Solicitante: ${esc(u.nome)} (${esc(PERFIS[u.perfil].label)}) — identificado pelo perfil ativo`,
    corpo: `
      ${avisoPermissao("manutencao.solicitar", "Abertura de solicitação")}
      <form class="form grid-form" novalidate>
        ${campo({
          rotulo: "Veículo",
          nome: "veiculoId",
          tipo: "select",
          obrigatorio: true,
          largura: "wide",
          opcoesHtml: opcoes(
            veiculos.map((v) => ({
              valor: v.id,
              texto: `${S.rotuloVeiculo(v)} — ${v.modelo} (${nomeCidade(v.cidade)})`,
            })),
            veiculoId,
            "Selecione o veículo",
          ),
        })}
        ${campo({ rotulo: "Prioridade", nome: "prioridade", tipo: "select", obrigatorio: true, opcoesHtml: opcoesMapa(PRIORIDADES, "media") })}
        ${campo({ rotulo: "Cidade", nome: "cidadeInfo", valor: veiculoId ? nomeCidade(S.veiculo(veiculoId)?.cidade) : "", somenteLeitura: true, ajuda: "Preenchida a partir do cadastro do veículo." })}
        ${campo({ rotulo: "Descrição do problema", nome: "descricao", tipo: "textarea", obrigatorio: true, largura: "full", attrs: 'rows="3" minlength="10" maxlength="400" placeholder="Descreva o sintoma observado, quando ocorre e em que condições."' })}
        ${campo({ rotulo: "Observação inicial (opcional)", nome: "observacao", tipo: "textarea", largura: "full", attrs: 'rows="2" maxlength="400"' })}
      </form>`,
    rodape: `<button type="button" class="btn btn-ghost" data-fechar-modal>Cancelar</button><button type="button" class="btn btn-primary" data-salvar ${S.pode("manutencao.solicitar") ? "" : "disabled"}>Abrir solicitação</button>`,
    aoMontar(modal, ctrl) {
      const form = modal.querySelector("form");
      form.veiculoId.addEventListener("change", () => {
        form.cidadeInfo.value = form.veiculoId.value
          ? nomeCidade(S.veiculo(form.veiculoId.value)?.cidade)
          : "";
      });
      const salvar = (e) => {
        e?.preventDefault();
        if (!validarFormulario(form)) return;
        const r = executar(
          () => S.abrirSolicitacao(dadosFormulario(form)),
          (s) => `Solicitação ${s.id} aberta.`,
        );
        if (r) {
          ctrl.fechar();
          abrirDetalheSolicitacao(r.id);
        }
      };
      form.addEventListener("submit", salvar);
      modal.querySelector("[data-salvar]").addEventListener("click", salvar);
    },
  });
}

// ---------------------------------------------------------------------------
// Detalhe da solicitação
// ---------------------------------------------------------------------------

function responsaveisOficina(selecionado) {
  return S.db()
    .usuarios.filter(
      (u) =>
        ["oficina", "mecanico"].includes(u.perfil) &&
        (u.ativo || u.id === selecionado),
    )
    .map((u) => ({
      valor: u.id,
      texto: `${u.nome} — ${u.funcao}${u.ativo ? "" : " (inativo)"}`,
    }));
}

function statusPermitidos(s, os) {
  const andamento = os && os.status === "andamento";
  return Object.entries(STATUS_SOLICITACAO)
    .filter(([k]) => {
      if (k === s.status) return true;
      if (k === "execucao") return andamento;
      if (k === "aberta") return !os;
      if (k === "concluida" || k === "cancelada") return !andamento;
      return true;
    })
    .map(([valor, d]) => ({ valor, texto: d.label }));
}

function conteudoSolicitacao(id) {
  const s = S.db().solicitacoes.find((x) => x.id === id);
  const v = S.veiculo(s.veiculoId);
  const os = S.osDaSolicitacao(s.id);
  const final = ["concluida", "cancelada"].includes(s.status);
  const podeGerenciar = S.pode("manutencao.gerenciar");
  const podeObservar = S.pode("manutencao.solicitar") || podeGerenciar;
  const compras = S.db().compras.filter((c) => c.solicitacaoId === s.id);

  const gestao = final
    ? `<div class="notice notice-muted">${icone("info")}<span>Solicitação ${esc(STATUS_SOLICITACAO[s.status].label.toLowerCase())}. Não aceita novas alterações.</span></div>`
    : podeGerenciar
      ? `<form class="form grid-form form-panel" data-form="gestao" novalidate>
          ${campo({ rotulo: "Status", nome: "status", tipo: "select", opcoesHtml: opcoes(statusPermitidos(s, os), s.status) })}
          ${campo({ rotulo: "Responsável", nome: "responsavelId", tipo: "select", opcoesHtml: opcoes(responsaveisOficina(s.responsavelId), s.responsavelId ?? "", "Não atribuído") })}
          ${campo({ rotulo: "Prioridade", nome: "prioridade", tipo: "select", opcoesHtml: opcoesMapa(PRIORIDADES, s.prioridade) })}
          ${campo({ rotulo: "Observação", nome: "observacao", tipo: "textarea", largura: "full", attrs: 'rows="2" maxlength="400" placeholder="Obrigatória para cancelar a solicitação."' })}
          <div class="form-actions span-all">
            ${!os ? `<button type="button" class="btn btn-secondary" data-acao="abrir-os">${icone("clipboard")}<span>Abrir ordem de serviço</span></button>` : ""}
            <button type="submit" class="btn btn-primary">${icone("check")}<span>Salvar alterações</span></button>
          </div>
        </form>`
      : avisoPermissao(
          "manutencao.gerenciar",
          "Alteração de status, responsável e abertura de OS",
        );

  const corpo = `
    <div class="badge-row">${badge(STATUS_SOLICITACAO, s.status)} ${badge(PRIORIDADES, s.prioridade)} <span class="muted">Prioridade</span></div>
    ${detalhes([
      ["Abertura", fmt.data(s.dataAbertura)],
      [
        "Veículo",
        `<a class="link" href="#/veiculos/${v.id}">${esc(S.rotuloVeiculo(v))}</a><small class="cell-sub">${esc(v.modelo)}</small>`,
      ],
      ["Cidade", esc(nomeCidade(s.cidade))],
      ["Solicitante", esc(S.nomeUsuario(s.solicitanteId))],
      [
        "Responsável",
        s.responsavelId
          ? esc(S.nomeUsuario(s.responsavelId))
          : '<span class="muted">Não atribuído</span>',
      ],
      [
        "Ordem de serviço",
        os
          ? `<button type="button" class="link-btn" data-acao="ver-os" data-id="${os.id}">${os.id}</button> ${badge(STATUS_OS, os.status)}`
          : '<span class="muted">Não aberta</span>',
      ],
      ["Descrição do problema", esc(s.descricao), true],
    ])}
    <h4 class="subhead">Gestão da solicitação</h4>
    ${gestao}
    ${compras.length ? `<h4 class="subhead">Compras vinculadas</h4><ul class="link-list">${compras.map((c) => `<li><a class="link" href="#/compras/${c.id}">${c.id}</a> · ${c.itens.map((i) => esc(S.material(i.materialId)?.nome)).join(", ")} ${badge(STATUS_COMPRA, c.status)}</li>`).join("")}</ul>` : ""}
    <div class="grid-2 grid-gap-lg">
      <div>
        <h4 class="subhead">Observações (${s.observacoes.length})</h4>
        ${s.observacoes.length ? `<ul class="comments">${s.observacoes.map((o) => `<li><p>${esc(o.texto)}</p><small>${esc(S.nomeUsuario(o.usuarioId))} · ${fmt.dataHora(o.dataHora)}</small></li>`).join("")}</ul>` : '<p class="muted small">Nenhuma observação registrada.</p>'}
        ${podeObservar ? `<form class="form inline-form" data-form="obs" novalidate>${campo({ rotulo: "Nova observação", nome: "texto", tipo: "textarea", obrigatorio: true, attrs: 'rows="2" minlength="3" maxlength="400"' })}<button type="submit" class="btn btn-secondary btn-sm">${icone("message")}<span>Registrar observação</span></button></form>` : ""}
      </div>
      <div><h4 class="subhead">Histórico</h4>${linhaDoTempo(s.historico)}</div>
    </div>`;
  return {
    titulo: `Solicitação ${s.id}`,
    subtitulo: esc(
      `${S.rotuloVeiculo(v)} · ${v.modelo} · ${nomeCidade(s.cidade)}`,
    ),
    corpo,
  };
}

export function abrirDetalheSolicitacao(id, { aoFechar } = {}) {
  if (!S.db().solicitacoes.some((x) => x.id === id)) {
    executar(() => {
      throw new S.ErroNegocio(`Solicitação ${id} não encontrada.`);
    });
    return;
  }
  abrirModal({
    ...conteudoSolicitacao(id),
    tamanho: "lg",
    aoFechar,
    aoMontar(modal, ctrl) {
      const atualizar = () => ctrl.atualizar(conteudoSolicitacao(id));
      modal
        .querySelector('[data-form="gestao"]')
        ?.addEventListener("submit", (e) => {
          e.preventDefault();
          const form = e.target;
          const d = dadosFormulario(form);
          if (d.status === "cancelada" && d.observacao.trim().length < 5) {
            mostrarErro(
              form,
              "observacao",
              "Informe o motivo do cancelamento (mínimo de 5 caracteres).",
            );
            return;
          }
          const s = S.db().solicitacoes.find((x) => x.id === id);
          const confirmarFinal =
            d.status !== s.status &&
            ["concluida", "cancelada"].includes(d.status);
          const prosseguir = () => {
            if (
              executar(
                () =>
                  S.atualizarSolicitacao(id, {
                    status: d.status,
                    responsavelId: d.responsavelId || null,
                    prioridade: d.prioridade,
                    observacao: d.observacao,
                  }),
                "Solicitação atualizada.",
              )
            )
              atualizar();
          };
          if (confirmarFinal) {
            confirmar({
              titulo: "Confirmar alteração",
              mensagem: `<p>Alterar a solicitação ${id} para <strong>${esc(STATUS_SOLICITACAO[d.status].label)}</strong>? Esta situação é final.</p>`,
              textoConfirmar: "Confirmar",
              perigo: d.status === "cancelada",
            }).then((ok) => ok && prosseguir());
          } else prosseguir();
        });
      modal
        .querySelector('[data-form="obs"]')
        ?.addEventListener("submit", (e) => {
          e.preventDefault();
          if (!validarFormulario(e.target)) return;
          if (
            executar(
              () => S.adicionarObservacao(id, e.target.texto.value),
              "Observação registrada.",
            )
          )
            atualizar();
        });
      modal.addEventListener("click", (e) => {
        const b = e.target.closest("[data-acao]");
        if (!b) return;
        if (b.dataset.acao === "abrir-os") abrirFormularioOS(id, atualizar);
        if (b.dataset.acao === "ver-os")
          abrirDetalheOS(b.dataset.id, { aoAlterar: atualizar });
      });
      modal
        .querySelectorAll('a[href^="#/"]')
        .forEach((a) => a.addEventListener("click", () => ctrl.fechar()));
    },
  });
}

function abrirFormularioOS(solicitacaoId, aoConcluir) {
  const s = S.db().solicitacoes.find((x) => x.id === solicitacaoId);
  abrirModal({
    titulo: "Abrir ordem de serviço",
    subtitulo: esc(`${s.id} · ${S.rotuloVeiculo(s.veiculoId)}`),
    tamanho: "md",
    corpo: `
      <div class="notice notice-info">${icone("info")}<span>Ao abrir a OS, a solicitação passa para <strong>Em execução</strong> e o veículo para <strong>Em manutenção</strong>.</span></div>
      <form class="form grid-form" novalidate>
        ${campo({ rotulo: "Diagnóstico", nome: "diagnostico", tipo: "textarea", obrigatorio: true, largura: "full", attrs: 'rows="3" minlength="5" maxlength="400"' })}
        ${campo({ rotulo: "Responsável pela execução", nome: "responsavelExecucaoId", tipo: "select", obrigatorio: true, opcoesHtml: opcoes(responsaveisOficina(), "", "Selecione") })}
        ${campo({ rotulo: "Data de início", nome: "dataInicio", tipo: "date", valor: S.hoje(), obrigatorio: true, attrs: `min="${s.dataAbertura}" max="${S.hoje()}"` })}
        ${campo({ rotulo: "Custo estimado (R$)", nome: "custoEstimado", tipo: "number", obrigatorio: true, attrs: 'min="0" step="0.01"', ajuda: "Estimativa de serviço e peças." })}
      </form>`,
    rodape: `<button type="button" class="btn btn-ghost" data-fechar-modal>Cancelar</button><button type="button" class="btn btn-primary" data-salvar>Abrir OS</button>`,
    aoMontar(modal, ctrl) {
      const form = modal.querySelector("form");
      const salvar = (e) => {
        e?.preventDefault();
        if (!validarFormulario(form)) return;
        const os = executar(
          () => S.abrirOS(solicitacaoId, dadosFormulario(form)),
          (o) => `Ordem de serviço ${o.id} aberta.`,
        );
        if (os) {
          ctrl.fechar();
          aoConcluir?.();
          abrirDetalheOS(os.id, { aoAlterar: aoConcluir });
        }
      };
      form.addEventListener("submit", salvar);
      modal.querySelector("[data-salvar]").addEventListener("click", salvar);
    },
  });
}

// ---------------------------------------------------------------------------
// Detalhe da ordem de serviço
// ---------------------------------------------------------------------------

function conteudoOS(id) {
  const os = S.db().ordens.find((o) => o.id === id);
  const v = S.veiculo(os.veiculoId);
  const andamento = os.status === "andamento";
  const podeGerenciar = S.pode("manutencao.gerenciar");
  const custoPecas = S.custoPecasOS(os);
  const despesa = os.despesaId
    ? S.db().despesas.find((d) => d.id === os.despesaId)
    : null;
  const materiais = [...S.db().materiais].sort((a, b) =>
    a.nome.localeCompare(b.nome),
  );

  const linhasPecas = tabela({
    colunas: [
      {
        titulo: "Peça",
        render: (p) =>
          `${esc(S.material(p.materialId)?.nome)}${p.unidadeIds.length ? `<small class="cell-sub mono">${p.unidadeIds.map((u) => esc(S.db().unidades.find((x) => x.id === u)?.serie)).join(", ")}${p.posicao ? ` · ${esc(p.posicao)}` : ""}</small>` : ""}`,
      },
      {
        titulo: "Qtd.",
        render: (p) =>
          `${fmt.numero(p.quantidade, p.quantidade % 1 ? 1 : 0)} ${esc(S.material(p.materialId)?.unidade)}`,
        classe: "num nowrap",
      },
      {
        titulo: "Custo unit.",
        render: (p) => fmt.moeda(p.custoUnitario),
        classe: "num nowrap hide-sm",
      },
      {
        titulo: "Subtotal",
        render: (p) => fmt.moeda(p.quantidade * p.custoUnitario),
        classe: "num nowrap",
      },
      {
        titulo: "Baixa no estoque",
        render: (p) => `<span class="mono small">${p.movimentoId}</span>`,
        classe: "hide-sm",
      },
      ...(andamento && podeGerenciar
        ? [
            {
              titulo: "",
              classe: "actions",
              render: (p) =>
                `<button type="button" class="btn btn-ghost btn-sm" data-acao="estornar" data-linha="${p.id}">${icone("reset")}<span>Estornar</span></button>`,
            },
          ]
        : []),
    ],
    linhas: os.pecas,
    vazio: "Nenhuma peça aplicada nesta OS.",
  });

  const formPeca =
    andamento && podeGerenciar
      ? `<form class="form grid-form form-panel" data-form="peca" novalidate>
        <p class="form-panel-title span-all">${icone("package")} Aplicar peça do estoque <span class="muted">— a baixa é feita uma única vez, no momento do lançamento</span></p>
        ${campo({
          rotulo: "Material",
          nome: "materialId",
          tipo: "select",
          obrigatorio: true,
          largura: "wide",
          opcoesHtml: opcoes(
            materiais.map((m) => ({
              valor: m.id,
              texto: `${m.nome} — saldo ${fmt.numero(S.saldo(m), m.unidade === "L" || m.unidade === "kg" ? 1 : 0)} ${m.unidade}`,
              desabilitado: S.saldo(m) <= 0,
            })),
            "",
            "Selecione",
          ),
        })}
        <div class="span-all" data-peca-detalhe></div>
        <div class="form-actions span-all"><button type="submit" class="btn btn-secondary">${icone("saida")}<span>Aplicar e baixar do estoque</span></button></div>
      </form>`
      : "";

  const formConcluir =
    andamento && podeGerenciar
      ? `<form class="form grid-form form-panel" data-form="concluir" novalidate>
        <p class="form-panel-title span-all">${icone("checkCircle")} Concluir ordem de serviço</p>
        ${campo({ rotulo: "Serviço realizado", nome: "servico", tipo: "textarea", obrigatorio: true, largura: "full", valor: os.servico, attrs: 'rows="2" minlength="5" maxlength="400"' })}
        ${campo({ rotulo: "Data de conclusão", nome: "dataConclusao", tipo: "date", valor: S.hoje(), obrigatorio: true, attrs: `min="${os.dataInicio}" max="${S.hoje()}"` })}
        ${campo({ rotulo: "Custo final do serviço (R$)", nome: "custoFinal", tipo: "number", obrigatorio: true, attrs: 'min="0" step="0.01"', ajuda: "Mão de obra ou serviço externo. Não inclua peças do estoque." })}
        ${campo({
          rotulo: "Tipo de custo",
          nome: "categoriaCusto",
          tipo: "select",
          opcoesHtml: opcoes(
            [
              { valor: "manutencao", texto: "Manutenção (oficina própria)" },
              { valor: "servicos_externos", texto: "Serviço externo" },
            ],
            "manutencao",
          ),
        })}
        <label class="check span-all"><input type="checkbox" name="registrarDespesa" checked> Lançar a despesa do serviço (aguardará conferência do financeiro)</label>
        <label class="check span-all"><input type="checkbox" name="liberarVeiculo" checked> Liberar o veículo (situação "Disponível"), se não houver outra manutenção ativa</label>
        <div class="form-actions span-all"><button type="submit" class="btn btn-primary">${icone("check")}<span>Concluir OS</span></button></div>
      </form>`
      : andamento
        ? avisoPermissao(
            "manutencao.gerenciar",
            "Lançamento de peças e conclusão da OS",
          )
        : "";

  const corpo = `
    <div class="badge-row">${badge(STATUS_OS, os.status)} <button type="button" class="link-btn" data-acao="ver-sm" data-id="${os.solicitacaoId}">Solicitação ${os.solicitacaoId}</button></div>
    ${detalhes([
      [
        "Veículo",
        `<a class="link" href="#/veiculos/${v.id}">${esc(S.rotuloVeiculo(v))}</a>`,
      ],
      ["Cidade", esc(nomeCidade(os.cidade))],
      [
        "Responsável pela execução",
        esc(S.nomeUsuario(os.responsavelExecucaoId)),
      ],
      ["Data de início", fmt.data(os.dataInicio)],
      ["Data de conclusão", fmt.data(os.dataConclusao)],
      ["Custo estimado", fmt.moeda(os.custoEstimado)],
      [
        "Custo final do serviço",
        os.custoFinal === null ? "—" : fmt.moeda(os.custoFinal),
      ],
      ["Peças do estoque (referência)", fmt.moeda(custoPecas)],
      [
        "Custo total da OS",
        os.custoFinal === null
          ? "—"
          : `<strong>${fmt.moeda(os.custoFinal + custoPecas)}</strong>`,
      ],
      ["Diagnóstico", esc(os.diagnostico), true],
      [
        "Serviço realizado",
        esc(os.servico) ||
          '<span class="muted">A registrar na conclusão</span>',
        true,
      ],
      [
        "Despesa lançada",
        despesa
          ? `<span class="mono">${despesa.id}</span> · ${fmt.moeda(despesa.valor)} (${esc(despesa.status === "cancelada" ? "cancelada" : "serviço apenas")})`
          : os.status === "concluida"
            ? '<span class="muted">Sem despesa de serviço</span>'
            : "—",
        true,
      ],
    ])}
    <div class="notice notice-muted">${icone("info")}<span>As peças são baixadas do estoque quando aplicadas. A conclusão da OS não gera nova baixa, e a despesa da OS considera apenas o serviço — o custo das peças já está registrado na compra.</span></div>
    <h4 class="subhead">Peças utilizadas</h4>
    ${linhasPecas}
    ${formPeca}
    ${formConcluir}
    <h4 class="subhead">Histórico da OS</h4>
    ${linhaDoTempo(os.historico)}`;
  return {
    titulo: `Ordem de serviço ${os.id}`,
    subtitulo: esc(`${S.rotuloVeiculo(v)} · ${v.modelo}`),
    corpo,
  };
}

function detalhePeca(material) {
  if (!material) return "";
  if (material.rastreavel) {
    const unidades = S.db().unidades.filter(
      (u) => u.materialId === material.id && u.status === "estoque",
    );
    const posicoes =
      material.categoria === "baterias" ? POSICOES_BATERIA : POSICOES_PNEU;
    return `
      <div class="grid-form">
        <fieldset class="field span-all" data-campo="unidadeIds">
          <legend>Unidades em estoque (controle individual) <span class="req">*</span></legend>
          <div class="check-grid">${unidades.map((u) => `<label class="check"><input type="checkbox" name="unidadeIds[]" value="${u.id}"> <span class="mono">${esc(u.serie)}</span></label>`).join("") || '<p class="muted small">Nenhuma unidade disponível.</p>'}</div>
          <small class="field-error" role="alert"></small>
        </fieldset>
        ${campo({
          rotulo: "Posição no veículo",
          nome: "posicao",
          tipo: "select",
          opcoesHtml: opcoes(
            posicoes.map((p) => ({ valor: p, texto: p })),
            "",
            "Não informada",
          ),
        })}
      </div>`;
  }
  const fr = ["L", "kg"].includes(material.unidade);
  return campo({
    rotulo: `Quantidade (${material.unidade}) — saldo ${fmt.numero(S.saldo(material), fr ? 1 : 0)}`,
    nome: "quantidade",
    tipo: "number",
    obrigatorio: true,
    attrs: `min="${fr ? "0.1" : "1"}" max="${S.saldo(material)}" step="${fr ? "0.1" : "1"}"`,
  });
}

export function abrirDetalheOS(id, { aoFechar, aoAlterar } = {}) {
  if (!S.db().ordens.some((o) => o.id === id)) {
    executar(() => {
      throw new S.ErroNegocio(`Ordem de serviço ${id} não encontrada.`);
    });
    return;
  }
  abrirModal({
    ...conteudoOS(id),
    tamanho: "lg",
    aoFechar,
    aoMontar(modal, ctrl) {
      const atualizar = () => {
        ctrl.atualizar(conteudoOS(id));
        aoAlterar?.();
      };
      const formPeca = modal.querySelector('[data-form="peca"]');
      if (formPeca) {
        formPeca.materialId.addEventListener("change", () => {
          formPeca.querySelector("[data-peca-detalhe]").innerHTML = detalhePeca(
            S.material(formPeca.materialId.value),
          );
        });
        formPeca.addEventListener("submit", (e) => {
          e.preventDefault();
          const material = S.material(formPeca.materialId.value);
          if (
            !validarFormulario(formPeca, (d) =>
              material?.rastreavel && !(d.unidadeIds ?? []).length
                ? { unidadeIds: "Selecione ao menos uma unidade." }
                : {},
            )
          )
            return;
          const d = dadosFormulario(formPeca);
          if (
            executar(
              () =>
                S.adicionarPecaOS(id, {
                  materialId: d.materialId,
                  quantidade: d.quantidade,
                  unidadeIds: d.unidadeIds ?? [],
                  posicao: d.posicao ?? "",
                }),
              "Peça aplicada e baixada do estoque.",
            )
          )
            atualizar();
        });
      }
      modal
        .querySelector('[data-form="concluir"]')
        ?.addEventListener("submit", async (e) => {
          e.preventDefault();
          const form = e.target;
          if (!validarFormulario(form)) return;
          const d = dadosFormulario(form);
          const ok = await confirmar({
            titulo: `Concluir ${id}`,
            mensagem: `<p>Confirma a conclusão da ordem de serviço com custo de serviço de <strong>${fmt.moeda(Number(d.custoFinal))}</strong>?</p><p class="muted">${d.registrarDespesa && Number(d.custoFinal) > 0 ? "Uma despesa será lançada para conferência do financeiro. " : ""}${d.liberarVeiculo ? "O veículo será liberado se não houver outra manutenção ativa." : "O veículo permanecerá em manutenção."}</p>`,
            textoConfirmar: "Concluir OS",
          });
          if (
            ok &&
            executar(() => S.concluirOS(id, d), "Ordem de serviço concluída.")
          )
            atualizar();
        });
      modal.addEventListener("click", async (e) => {
        const b = e.target.closest("[data-acao]");
        if (!b) return;
        if (b.dataset.acao === "estornar") {
          const ok = await confirmar({
            titulo: "Estornar peça",
            mensagem:
              "<p>A peça voltará ao estoque e o lançamento será removido da OS. Use apenas para corrigir lançamentos feitos por engano.</p>",
            textoConfirmar: "Estornar",
            perigo: true,
          });
          if (
            ok &&
            executar(
              () => S.removerPecaOS(id, b.dataset.linha),
              "Peça estornada ao estoque.",
            )
          )
            atualizar();
        } else if (b.dataset.acao === "ver-sm") {
          ctrl.fechar();
          abrirDetalheSolicitacao(b.dataset.id);
        }
      });
      modal
        .querySelectorAll('a[href^="#/"]')
        .forEach((a) => a.addEventListener("click", () => ctrl.fechar()));
    },
  });
}

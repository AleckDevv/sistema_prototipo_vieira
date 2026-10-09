// Estoque e inventário: materiais, movimentações e unidades rastreáveis (pneus e baterias).

import * as S from "../services/index.js";
import {
  CATEGORIAS_MATERIAL,
  UNIDADES_MEDIDA,
  TIPOS_MOVIMENTO,
  STATUS_UNIDADE,
  STATUS_COMPRA,
  PERIODOS,
  nomeCidade,
} from "../constants.js";
import { esc, fmt, contem, intervaloPeriodo, noPeriodo } from "../utils.js";
import {
  badge,
  badgeTexto,
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
  abas,
  kpi,
  avisoPermissao,
} from "../ui.js";
import { icone } from "../icons.js";
import { limparParametroRota } from "../router.js";

const filtros = { busca: "", categoria: "", deposito: "", situacao: "" };
const filtrosMov = { busca: "", tipo: "", periodo: "90d", cidade: "", ref: "" };
const filtrosUn = { material: "", status: "" };
let aba = "materiais";
let pagina = 1;
let paginaMov = 1;
let paginaUn = 1;

const qtd = (m, v) =>
  `${fmt.numero(v, ["L", "kg"].includes(m?.unidade) && v % 1 ? 1 : 0)} ${m?.unidade ?? ""}`;

export default {
  titulo: "Estoque e inventário",
  descricao:
    "Materiais, saldos, movimentações e controle individual de pneus e baterias.",
  render(el, rota, { navegacao }) {
    if (navegacao) {
      if (rota.query.get("filtro") === "baixo") {
        aba = "materiais";
        filtros.situacao = "baixo";
      }
      if (rota.query.has("aba")) aba = rota.query.get("aba");
      if (rota.query.has("ref")) {
        filtrosMov.ref = rota.query.get("ref");
        filtrosMov.periodo = "tudo";
      }
      pagina = paginaMov = paginaUn = 1;
    }
    const s = S.db();
    const baixos = S.materiaisAbaixoDoMinimo();
    const mes = intervaloPeriodo("mes", S.hoje());
    el.innerHTML = `
      <div class="kpi-grid kpi-grid-4">
        ${kpi({ rotulo: "Materiais cadastrados", valor: s.materiais.length, detalhe: `${s.materiais.filter((m) => m.rastreavel).length} com controle individual`, ic: "package" })}
        ${kpi({ rotulo: "Abaixo do estoque mínimo", valor: baixos.length, detalhe: `${baixos.filter((m) => S.saldo(m) <= 0).length} sem saldo`, ic: "alert", tom: baixos.length ? "danger" : "" })}
        ${kpi({ rotulo: "Valor em estoque", valor: fmt.moeda(S.valorEmEstoque()), detalhe: "Saldo × custo médio (demonstrativo)", ic: "wallet" })}
        ${kpi({ rotulo: "Movimentações no mês", valor: s.movimentos.filter((m) => noPeriodo(m.data, mes)).length, detalhe: "Entradas, saídas e ajustes", ic: "swap" })}
      </div>
      <div class="page-toolbar">
        ${abas(
          [
            {
              id: "materiais",
              rotulo: "Materiais",
              contador: s.materiais.length,
            },
            {
              id: "movimentos",
              rotulo: "Movimentações",
              contador: s.movimentos.length,
            },
            {
              id: "unidades",
              rotulo: "Pneus e baterias",
              contador: s.unidades.filter((u) => u.status !== "descartado")
                .length,
            },
          ],
          aba,
        )}
        <div class="page-actions">
          ${botao({ acao: "cadastrar", texto: "Cadastrar material", icone: "plus", permissao: "estoque.cadastrar" })}
          ${botao({ acao: "entrada", texto: "Entrada", icone: "entrada", permissao: "estoque.movimentar" })}
          ${botao({ acao: "saida", texto: "Saída", icone: "saida", permissao: "estoque.movimentar" })}
          ${botao({ acao: "ajuste", texto: "Ajuste de inventário", icone: "sliders", permissao: "estoque.ajustar" })}
        </div>
      </div>
      <div id="est-conteudo"></div>`;

    el.onclick = (e) => {
      const b = e.target.closest("[data-aba], [data-acao], [data-pagina]");
      if (!b) return;
      if (b.dataset.aba) {
        aba = b.dataset.aba;
        this.render(el, rota, { navegacao: false });
        return;
      }
      if (b.dataset.pagina) {
        const p = Number(b.dataset.pagina);
        if (b.dataset.alvo === "mov") paginaMov = p;
        else if (b.dataset.alvo === "un") paginaUn = p;
        else pagina = p;
        desenharResultado(el);
        return;
      }
      e.stopPropagation();
      const { acao, id } = b.dataset;
      if (acao === "cadastrar") abrirFormMaterial();
      else if (acao === "entrada") abrirEntrada(id);
      else if (acao === "saida") abrirSaida(id);
      else if (acao === "ajuste") abrirAjuste(id);
      else if (acao === "ver") abrirDetalheMaterial(id);
      else if (acao === "baixar") baixar(id);
      else if (acao === "recapagem") receberRecapagem(id);
      else if (acao === "limpar-ref") {
        filtrosMov.ref = "";
        desenhar(el);
      }
    };
    el.oninput = (e) => {
      const f = e.target.dataset.filtro;
      if (f === "busca") {
        filtros.busca = e.target.value;
        pagina = 1;
        desenharResultado(el);
      } else if (f === "busca-mov") {
        filtrosMov.busca = e.target.value;
        paginaMov = 1;
        desenharResultado(el);
      }
    };
    el.onchange = (e) => {
      const f = e.target.dataset.filtro;
      if (!f || f.startsWith("busca")) return;
      const [nome, grupo] = f.split(":");
      if (grupo === "mov") {
        filtrosMov[nome] = e.target.value;
        paginaMov = 1;
      } else if (grupo === "un") {
        filtrosUn[nome] = e.target.value;
        paginaUn = 1;
      } else {
        filtros[nome] = e.target.value;
        pagina = 1;
      }
      desenharResultado(el);
    };
    el.onkeydown = (e) => {
      if (e.key === "Enter" && e.target.dataset?.acao === "ver")
        abrirDetalheMaterial(e.target.dataset.id);
    };
    desenhar(el);
    if (navegacao && rota.query.has("material"))
      abrirDetalheMaterial(rota.query.get("material"), {
        aoFechar: limparParametroRota("estoque", rota.query.get("material")),
      });
  },
};

function desenhar(el) {
  const alvo = el.querySelector("#est-conteudo");
  if (aba === "movimentos") {
    alvo.innerHTML = `
      <div class="filters" role="search">
        <div class="filter filter-grow"><label for="mov-busca">Buscar</label><div class="input-icon">${icone("search")}<input id="mov-busca" type="search" placeholder="Material, código, placa ou observação" value="${esc(filtrosMov.busca)}" data-filtro="busca-mov"></div></div>
        <div class="filter"><label for="mov-tipo">Tipo</label><select id="mov-tipo" data-filtro="tipo:mov">${opcoesMapa(TIPOS_MOVIMENTO, filtrosMov.tipo, "Todos")}</select></div>
        <div class="filter"><label for="mov-periodo">Período</label><select id="mov-periodo" data-filtro="periodo:mov">${opcoes(
          Object.entries(PERIODOS)
            .filter(([k]) => k !== "personalizado")
            .map(([valor, texto]) => ({ valor, texto })),
          filtrosMov.periodo,
        )}</select></div>
        <div class="filter"><label for="mov-cidade">Cidade</label><select id="mov-cidade" data-filtro="cidade:mov">${opcoesCidades(filtrosMov.cidade)}</select></div>
      </div>
      ${filtrosMov.ref ? `<div class="notice notice-info">${icone("info")}<span>Exibindo movimentações vinculadas a <strong>${esc(filtrosMov.ref)}</strong>.</span><button type="button" class="btn btn-ghost btn-sm" data-acao="limpar-ref">Mostrar todas</button></div>` : ""}
      <div id="est-resultado"></div>`;
  } else if (aba === "unidades") {
    const rastreaveis = S.db().materiais.filter((m) => m.rastreavel);
    alvo.innerHTML = `
      <div class="notice notice-muted">${icone("info")}<span>Pneus e baterias com controle individual recebem um identificador por unidade, permitindo rastrear instalação, retirada, recapagem e descarte por placa.</span></div>
      <div class="filters" role="search">
        <div class="filter"><label for="un-mat">Item</label><select id="un-mat" data-filtro="material:un">${opcoes(
          rastreaveis.map((m) => ({ valor: m.id, texto: m.nome })),
          filtrosUn.material,
          "Todos os itens",
        )}</select></div>
        <div class="filter"><label for="un-status">Situação</label><select id="un-status" data-filtro="status:un">${opcoesMapa(STATUS_UNIDADE, filtrosUn.status, "Todas")}</select></div>
      </div>
      <div id="est-resultado"></div>`;
  } else {
    alvo.innerHTML = `
      <div class="filters" role="search">
        <div class="filter filter-grow"><label for="mat-busca">Buscar</label><div class="input-icon">${icone("search")}<input id="mat-busca" type="search" placeholder="Código ou nome do material" value="${esc(filtros.busca)}" data-filtro="busca"></div></div>
        <div class="filter"><label for="mat-cat">Categoria</label><select id="mat-cat" data-filtro="categoria">${opcoesMapa(CATEGORIAS_MATERIAL, filtros.categoria, "Todas")}</select></div>
        <div class="filter"><label for="mat-dep">Depósito</label><select id="mat-dep" data-filtro="deposito">${opcoesCidades(filtros.deposito, "Todos")}</select></div>
        <div class="filter"><label for="mat-sit">Situação</label><select id="mat-sit" data-filtro="situacao">${opcoes(
          [
            { valor: "baixo", texto: "Abaixo do mínimo" },
            { valor: "ok", texto: "Normal" },
          ],
          filtros.situacao,
          "Todas",
        )}</select></div>
      </div>
      <div id="est-resultado"></div>`;
  }
  desenharResultado(el);
}

function desenharResultado(el) {
  const alvo = el.querySelector("#est-resultado");
  const s = S.db();
  if (aba === "movimentos") {
    const p = intervaloPeriodo(filtrosMov.periodo, S.hoje());
    const lista = [...s.movimentos]
      .filter(
        (m) =>
          noPeriodo(m.data, p) &&
          (!filtrosMov.tipo || m.tipo === filtrosMov.tipo) &&
          (!filtrosMov.cidade || m.cidade === filtrosMov.cidade) &&
          (!filtrosMov.ref || m.ref?.id === filtrosMov.ref),
      )
      .filter(
        (m) =>
          !filtrosMov.busca ||
          contem(
            `${S.material(m.materialId)?.codigo} ${S.material(m.materialId)?.nome} ${m.veiculoId ? S.rotuloVeiculo(m.veiculoId) : ""} ${m.observacao} ${m.motivo} ${m.ref?.id ?? ""}`,
            filtrosMov.busca,
          ),
      )
      .reverse();
    const pag = paginar(lista, paginaMov, 15);
    paginaMov = pag.pagina;
    alvo.innerHTML = `<div class="card card-flush">${tabelaMovimentos(pag.itens)}${paginacao(pag, "mov")}</div>`;
    return;
  }
  if (aba === "unidades") {
    const lista = s.unidades
      .filter(
        (u) =>
          (!filtrosUn.material || u.materialId === filtrosUn.material) &&
          (!filtrosUn.status || u.status === filtrosUn.status),
      )
      .sort((a, b) => a.serie.localeCompare(b.serie));
    const pag = paginar(lista, paginaUn, 15);
    paginaUn = pag.pagina;
    const podeAjustar = S.pode("estoque.ajustar");
    const podeMov = S.pode("estoque.movimentar");
    alvo.innerHTML = `<div class="card card-flush">${tabela({
      colunas: [
        {
          titulo: "Identificador",
          render: (u) => `<span class="mono">${esc(u.serie)}</span>`,
        },
        { titulo: "Item", render: (u) => esc(S.material(u.materialId)?.nome) },
        { titulo: "Situação", render: (u) => badge(STATUS_UNIDADE, u.status) },
        {
          titulo: "Veículo",
          render: (u) =>
            u.veiculoId
              ? `<a class="link" href="#/veiculos/${u.veiculoId}?aba=pecas">${esc(S.rotuloVeiculo(u.veiculoId))}</a>`
              : "—",
        },
        {
          titulo: "Posição",
          render: (u) => esc(u.posicao || "—"),
          classe: "hide-sm",
        },
        {
          titulo: "Último evento",
          render: (u) => {
            const ult = u.historico[u.historico.length - 1];
            return `${esc(ult.descricao)}<small class="cell-sub">${fmt.dataHora(ult.dataHora)}</small>`;
          },
          classe: "hide-sm",
        },
        {
          titulo: "Ações",
          classe: "actions",
          render: (u) =>
            [
              u.status === "recapagem" && podeMov
                ? `<button type="button" class="btn btn-ghost btn-sm" data-acao="recapagem" data-id="${u.id}">${icone("entrada")}<span>Receber</span></button>`
                : "",
              ["estoque", "recapagem"].includes(u.status) && podeAjustar
                ? `<button type="button" class="btn btn-ghost btn-sm" data-acao="baixar" data-id="${u.id}">${icone("trash")}<span>Baixar</span></button>`
                : "",
              u.status === "instalado"
                ? `<a class="btn btn-ghost btn-sm" href="#/pecas?veiculo=${u.veiculoId}">${icone("tire")}<span>Peças do veículo</span></a>`
                : "",
            ].join(""),
        },
      ],
      linhas: pag.itens,
      vazio: "Nenhuma unidade encontrada.",
    })}${paginacao(pag, "un")}</div>`;
    return;
  }

  const lista = [...s.materiais]
    .filter(
      (m) =>
        (!filtros.categoria || m.categoria === filtros.categoria) &&
        (!filtros.deposito || m.deposito === filtros.deposito),
    )
    .filter(
      (m) =>
        !filtros.situacao ||
        (filtros.situacao === "baixo"
          ? S.saldo(m) < m.minimo
          : S.saldo(m) >= m.minimo),
    )
    .filter(
      (m) => !filtros.busca || contem(`${m.codigo} ${m.nome}`, filtros.busca),
    )
    .sort(
      (a, b) =>
        (S.saldo(a) < a.minimo ? 0 : 1) - (S.saldo(b) < b.minimo ? 0 : 1) ||
        a.codigo.localeCompare(b.codigo),
    );
  const pag = paginar(lista, pagina, 15);
  pagina = pag.pagina;
  const podeMov = S.pode("estoque.movimentar");
  const podeAjustar = S.pode("estoque.ajustar");
  alvo.innerHTML = `<div class="card card-flush">${tabela({
    colunas: [
      {
        titulo: "Código",
        render: (m) => `<span class="mono">${esc(m.codigo)}</span>`,
        classe: "nowrap",
      },
      {
        titulo: "Material",
        render: (m) =>
          `${esc(m.nome)}${m.rastreavel ? '<small class="cell-sub">Controle individual</small>' : ""}`,
      },
      {
        titulo: "Categoria",
        render: (m) => esc(CATEGORIAS_MATERIAL[m.categoria].label),
        classe: "hide-sm",
      },
      {
        titulo: "Saldo",
        render: (m) => `<strong>${qtd(m, S.saldo(m))}</strong>`,
        classe: "num nowrap",
      },
      {
        titulo: "Mínimo",
        render: (m) => qtd(m, m.minimo),
        classe: "num nowrap",
      },
      {
        titulo: "Custo unit.",
        render: (m) => fmt.moeda(m.custoUnitario),
        classe: "num nowrap hide-sm",
      },
      {
        titulo: "Valor",
        render: (m) => fmt.moeda(S.saldo(m) * m.custoUnitario),
        classe: "num nowrap hide-sm",
      },
      {
        titulo: "Depósito",
        render: (m) => esc(nomeCidade(m.deposito)),
        classe: "hide-sm",
      },
      {
        titulo: "Situação",
        render: (m) => {
          const st = S.situacaoEstoque(m);
          const compra = S.comprasAbertasDoMaterial(m.id).length;
          return `${badgeTexto(st.label, st.tom)}${st.chave !== "ok" && compra ? '<small class="cell-sub">Compra em andamento</small>' : ""}`;
        },
      },
      {
        titulo: "Ações",
        classe: "actions",
        render: (m) =>
          `<button type="button" class="icon-btn" data-acao="ver" data-id="${m.id}" title="Detalhes e movimentações" aria-label="Detalhes de ${esc(m.nome)}">${icone("eye")}</button>` +
          (podeMov
            ? `<button type="button" class="icon-btn" data-acao="entrada" data-id="${m.id}" title="Registrar entrada" aria-label="Entrada de ${esc(m.nome)}">${icone("entrada")}</button>`
            : "") +
          (podeMov && !m.rastreavel
            ? `<button type="button" class="icon-btn" data-acao="saida" data-id="${m.id}" title="Registrar saída" aria-label="Saída de ${esc(m.nome)}">${icone("saida")}</button>`
            : "") +
          (podeAjustar && !m.rastreavel
            ? `<button type="button" class="icon-btn" data-acao="ajuste" data-id="${m.id}" title="Ajuste de inventário" aria-label="Ajustar ${esc(m.nome)}">${icone("sliders")}</button>`
            : ""),
      },
    ],
    linhas: pag.itens,
    linhaAttrs: (m) =>
      `class="is-clickable ${S.saldo(m) < m.minimo ? "row-warning" : ""}" data-acao="ver" data-id="${m.id}" tabindex="0"`,
    vazio: "Nenhum material encontrado.",
  })}${paginacao(pag)}</div>`;
}

function referencia(m) {
  if (!m.ref) return "—";
  if (m.ref.tipo === "compra")
    return `<a class="link mono" href="#/compras/${m.ref.id}">${m.ref.id}</a>`;
  if (m.ref.tipo === "os")
    return `<a class="link mono" href="#/manutencao/${m.ref.id}">${m.ref.id}</a>`;
  return `<span class="mono">${esc(m.ref.id)}</span>`;
}

function tabelaMovimentos(linhas) {
  return tabela({
    colunas: [
      { titulo: "Data", render: (m) => fmt.data(m.data), classe: "nowrap" },
      {
        titulo: "Material",
        render: (m) =>
          `${esc(S.material(m.materialId)?.nome)}<small class="cell-sub mono">${m.id}</small>`,
      },
      { titulo: "Tipo", render: (m) => badge(TIPOS_MOVIMENTO, m.tipo) },
      {
        titulo: "Motivo",
        render: (m) =>
          `${esc(m.motivo)}${m.observacao ? `<small class="cell-sub">${esc(m.observacao)}</small>` : ""}`,
      },
      {
        titulo: "Qtd.",
        render: (m) =>
          `<span class="${m.delta >= 0 ? "pos" : "neg"}">${m.delta >= 0 ? "+" : "−"}${qtd(S.material(m.materialId), Math.abs(m.delta))}</span>`,
        classe: "num nowrap",
      },
      {
        titulo: "Saldo após",
        render: (m) => qtd(S.material(m.materialId), m.saldoApos),
        classe: "num nowrap hide-sm",
      },
      {
        titulo: "Veículo",
        render: (m) => (m.veiculoId ? esc(S.rotuloVeiculo(m.veiculoId)) : "—"),
        classe: "nowrap hide-sm",
      },
      { titulo: "Referência", render: referencia, classe: "hide-sm" },
      {
        titulo: "Usuário",
        render: (m) => esc(S.nomeUsuario(m.usuarioId)),
        classe: "hide-sm",
      },
    ],
    linhas,
    vazio: "Nenhuma movimentação no período.",
  });
}

// ---------------------------------------------------------------------------
// Detalhe do material
// ---------------------------------------------------------------------------

export function abrirDetalheMaterial(id, { aoFechar } = {}) {
  const montar = () => {
    const m = S.material(id);
    const movimentos = S.db()
      .movimentos.filter((x) => x.materialId === id)
      .reverse();
    const compras = S.comprasAbertasDoMaterial(id);
    const st = S.situacaoEstoque(m);
    const unidades = S.db().unidades.filter(
      (u) => u.materialId === id && u.status !== "descartado",
    );
    return {
      titulo: esc(m.nome),
      subtitulo: `<span class="mono">${esc(m.codigo)}</span> · ${esc(CATEGORIAS_MATERIAL[m.categoria].label)} · Almoxarifado ${esc(nomeCidade(m.deposito))}`,
      corpo: `
        <div class="badge-row">${badgeTexto(st.label, st.tom)} ${m.rastreavel ? badgeTexto("Controle individual", "info") : ""}</div>
        ${detalhes([
          ["Saldo disponível", `<strong>${qtd(m, S.saldo(m))}</strong>`],
          ["Estoque mínimo", qtd(m, m.minimo)],
          ["Custo unitário (médio)", fmt.moeda(m.custoUnitario)],
          ["Valor em estoque", fmt.moeda(S.saldo(m) * m.custoUnitario)],
          ["Unidade de medida", esc(m.unidade)],
          ["Depósito", esc(nomeCidade(m.deposito))],
        ])}
        ${compras.length ? `<div class="notice notice-info">${icone("cart")}<span>Compras em andamento: ${compras.map((c) => `<a class="link" href="#/compras/${c.id}">${c.id}</a> (${esc(STATUS_COMPRA[c.status].label)})`).join(", ")}</span></div>` : S.saldo(m) < m.minimo ? `<div class="notice notice-warning">${icone("alert")}<span>Abaixo do mínimo e sem solicitação de compra em andamento.</span></div>` : ""}
        ${
          m.rastreavel
            ? `<h4 class="subhead">Unidades (${unidades.length})</h4>${tabela({
                colunas: [
                  {
                    titulo: "Identificador",
                    render: (u) => `<span class="mono">${esc(u.serie)}</span>`,
                  },
                  {
                    titulo: "Situação",
                    render: (u) => badge(STATUS_UNIDADE, u.status),
                  },
                  {
                    titulo: "Veículo",
                    render: (u) =>
                      u.veiculoId ? esc(S.rotuloVeiculo(u.veiculoId)) : "—",
                  },
                  { titulo: "Posição", render: (u) => esc(u.posicao || "—") },
                ],
                linhas: unidades,
              })}`
            : ""
        }
        <h4 class="subhead">Histórico de movimentações (${movimentos.length})</h4>
        ${tabelaMovimentos(movimentos.slice(0, 30))}
        ${movimentos.length > 30 ? '<p class="muted small">Exibindo as 30 movimentações mais recentes. Use a aba Movimentações para o histórico completo.</p>' : ""}`,
      rodape: `
        ${botao({ acao: "editar", texto: "Editar cadastro", icone: "pencil", permissao: "estoque.cadastrar" })}
        ${botao({ acao: "entrada", texto: "Entrada", icone: "entrada", permissao: "estoque.movimentar" })}
        ${m.rastreavel ? "" : botao({ acao: "saida", texto: "Saída", icone: "saida", permissao: "estoque.movimentar" })}
        ${m.rastreavel ? "" : botao({ acao: "ajuste", texto: "Ajuste", icone: "sliders", permissao: "estoque.ajustar" })}`,
    };
  };
  if (!S.material(id)) return;
  abrirModal({
    ...montar(),
    tamanho: "lg",
    aoFechar,
    aoMontar(modal, ctrl) {
      const atualizar = () => ctrl.atualizar(montar());
      modal.addEventListener("click", (e) => {
        const b = e.target.closest("[data-acao]");
        if (!b) return;
        if (b.dataset.acao === "editar") abrirFormMaterial(id, atualizar);
        if (b.dataset.acao === "entrada") abrirEntrada(id, atualizar);
        if (b.dataset.acao === "saida") abrirSaida(id, atualizar);
        if (b.dataset.acao === "ajuste") abrirAjuste(id, atualizar);
      });
      modal
        .querySelectorAll('a[href^="#/"]')
        .forEach((a) => a.addEventListener("click", () => ctrl.fechar()));
    },
  });
}

// ---------------------------------------------------------------------------
// Formulários
// ---------------------------------------------------------------------------

function modalFormulario({
  titulo,
  subtitulo,
  campos,
  textoSalvar,
  validarExtra,
  salvar,
  tamanho = "md",
  aoMontarExtra,
}) {
  abrirModal({
    titulo,
    subtitulo,
    tamanho,
    corpo: `<form class="form grid-form" novalidate>${campos}</form>`,
    rodape: `<button type="button" class="btn btn-ghost" data-fechar-modal>Cancelar</button><button type="button" class="btn btn-primary" data-salvar>${esc(textoSalvar)}</button>`,
    aoMontar(modal, ctrl) {
      const form = modal.querySelector("form");
      aoMontarExtra?.(form);
      const enviar = async (e) => {
        e?.preventDefault();
        if (!validarFormulario(form, validarExtra)) return;
        if (await salvar(dadosFormulario(form))) ctrl.fechar();
      };
      form.addEventListener("submit", enviar);
      modal.querySelector("[data-salvar]").addEventListener("click", enviar);
    },
  });
}

function abrirFormMaterial(id = null, aoConcluir) {
  const m = id ? S.material(id) : null;
  modalFormulario({
    titulo: m ? `Editar material ${esc(m.codigo)}` : "Cadastrar material",
    subtitulo: m
      ? "Unidade de medida e controle individual não podem ser alterados após o cadastro."
      : "Cadastro demonstrativo de material de manutenção.",
    campos: `
      ${campo({ rotulo: "Código", nome: "codigo", valor: m?.codigo ?? "", obrigatorio: !m, somenteLeitura: Boolean(m), attrs: 'maxlength="12" minlength="3" placeholder="Ex.: FIL-HID" style="text-transform:uppercase"' })}
      ${campo({ rotulo: "Nome", nome: "nome", valor: m?.nome ?? "", obrigatorio: true, largura: "wide", attrs: 'minlength="3" maxlength="80"' })}
      ${campo({ rotulo: "Categoria", nome: "categoria", tipo: "select", obrigatorio: true, opcoesHtml: opcoesMapa(CATEGORIAS_MATERIAL, m?.categoria ?? "", "Selecione") })}
      ${
        m
          ? campo({
              rotulo: "Unidade",
              nome: "unidadeInfo",
              valor: m.unidade,
              somenteLeitura: true,
            })
          : campo({
              rotulo: "Unidade de medida",
              nome: "unidade",
              tipo: "select",
              obrigatorio: true,
              opcoesHtml: opcoes(
                UNIDADES_MEDIDA.map((u) => ({ valor: u, texto: u })),
                "un",
              ),
            })
      }
      ${campo({ rotulo: "Estoque mínimo", nome: "minimo", tipo: "number", valor: m?.minimo ?? "", obrigatorio: true, attrs: 'min="0" step="any"' })}
      ${campo({ rotulo: "Custo unitário (R$)", nome: "custoUnitario", tipo: "number", valor: m?.custoUnitario ?? "", obrigatorio: true, attrs: 'min="0.01" step="0.01"' })}
      ${campo({ rotulo: "Depósito", nome: "deposito", tipo: "select", obrigatorio: true, opcoesHtml: opcoesCidades(m?.deposito ?? "teresina", null) })}
      ${m ? "" : campo({ rotulo: "Quantidade inicial", nome: "quantidadeInicial", tipo: "number", valor: 0, attrs: 'min="0" step="any"', ajuda: 'Gera uma entrada "Saldo inicial de cadastro".' })}
      ${m ? "" : '<label class="check span-all"><input type="checkbox" name="rastreavel"> Controle individual por unidade (pneus e baterias) — gera um identificador para cada unidade</label>'}`,
    textoSalvar: m ? "Salvar alterações" : "Cadastrar material",
    salvar: (d) => {
      const r = executar(
        () => (m ? S.editarMaterial(id, d) : S.cadastrarMaterial(d)),
        m ? "Material atualizado." : (x) => `Material ${x.codigo} cadastrado.`,
      );
      if (r) aoConcluir?.();
      return r;
    },
  });
}

function opcoesMateriais(selecionado, { somenteNaoRastreaveis = false } = {}) {
  return opcoes(
    [...S.db().materiais]
      .filter((m) => !somenteNaoRastreaveis || !m.rastreavel)
      .sort((a, b) => a.nome.localeCompare(b.nome))
      .map((m) => ({
        valor: m.id,
        texto: `${m.codigo} · ${m.nome} — saldo ${qtd(m, S.saldo(m))}`,
      })),
    selecionado ?? "",
    "Selecione o material",
  );
}

function abrirEntrada(materialId, aoConcluir) {
  modalFormulario({
    titulo: "Registrar entrada de estoque",
    subtitulo:
      "Entradas de compras aprovadas devem ser registradas pelo recebimento da solicitação de compra.",
    campos: `
      ${avisoPermissao("estoque.movimentar", "Entrada de estoque")}
      ${campo({ rotulo: "Material", nome: "materialId", tipo: "select", obrigatorio: true, largura: "full", opcoesHtml: opcoesMateriais(materialId) })}
      ${campo({ rotulo: "Quantidade", nome: "quantidade", tipo: "number", obrigatorio: true, attrs: 'min="0.1" step="any"', ajuda: "Itens com controle individual geram um identificador por unidade." })}
      ${campo({ rotulo: "Data", nome: "data", tipo: "date", valor: S.hoje(), obrigatorio: true, attrs: `max="${S.hoje()}"` })}
      ${campo({ rotulo: "Custo unitário (R$, opcional)", nome: "custoUnitario", tipo: "number", attrs: 'min="0.01" step="0.01"', ajuda: "Atualiza o custo médio." })}
      ${campo({ rotulo: "Origem / observação", nome: "observacao", obrigatorio: true, largura: "full", attrs: 'minlength="3" maxlength="200" placeholder="Ex.: devolução de material não utilizado"' })}`,
    textoSalvar: "Registrar entrada",
    validarExtra: (d) => {
      const m = S.material(d.materialId);
      if (
        m &&
        !["L", "kg"].includes(m.unidade) &&
        !Number.isInteger(Number(d.quantidade))
      )
        return { quantidade: `Use quantidade inteira (${m.unidade}).` };
      return {};
    },
    salvar: (d) => {
      const r = executar(
        () => S.registrarEntrada(d),
        "Entrada registrada. Saldo atualizado.",
      );
      if (r) aoConcluir?.();
      return r;
    },
  });
}

function abrirSaida(materialId, aoConcluir) {
  modalFormulario({
    titulo: "Registrar saída de estoque",
    subtitulo:
      "Para destinar uma peça a um veículo (com placa), use a tela Peças por veículo.",
    campos: `
      ${avisoPermissao("estoque.movimentar", "Saída de estoque")}
      ${campo({ rotulo: "Material", nome: "materialId", tipo: "select", obrigatorio: true, largura: "full", opcoesHtml: opcoesMateriais(materialId, { somenteNaoRastreaveis: true }), ajuda: "Pneus e baterias rastreáveis saem pela instalação no veículo ou pela baixa da unidade." })}
      ${campo({ rotulo: "Quantidade", nome: "quantidade", tipo: "number", obrigatorio: true, attrs: 'min="0.1" step="any"' })}
      ${campo({ rotulo: "Data", nome: "data", tipo: "date", valor: S.hoje(), obrigatorio: true, attrs: `max="${S.hoje()}"` })}
      ${campo({
        rotulo: "Motivo",
        nome: "motivo",
        tipo: "select",
        obrigatorio: true,
        opcoesHtml: opcoes(
          S.MOTIVOS_SAIDA.map((m) => ({ valor: m, texto: m })),
          "",
          "Selecione",
        ),
      })}
      ${campo({ rotulo: "Observação", nome: "observacao", largura: "wide", attrs: 'maxlength="200"' })}`,
    textoSalvar: "Registrar saída",
    validarExtra: (d) => {
      const m = S.material(d.materialId);
      if (m && Number(d.quantidade) > S.saldo(m))
        return {
          quantidade: `Saldo insuficiente: disponível ${qtd(m, S.saldo(m))}. O estoque não pode ficar negativo.`,
        };
      return {};
    },
    salvar: (d) => {
      const r = executar(
        () => S.registrarSaida(d),
        "Saída registrada. Saldo atualizado.",
      );
      if (r) aoConcluir?.();
      return r;
    },
  });
}

function abrirAjuste(materialId, aoConcluir) {
  modalFormulario({
    titulo: "Ajuste de inventário",
    subtitulo:
      "Corrige o saldo do sistema para a quantidade contada fisicamente. A justificativa é obrigatória e fica registrada.",
    campos: `
      ${avisoPermissao("estoque.ajustar", "Ajuste de inventário")}
      ${campo({ rotulo: "Material", nome: "materialId", tipo: "select", obrigatorio: true, largura: "full", opcoesHtml: opcoesMateriais(materialId, { somenteNaoRastreaveis: true }) })}
      ${campo({ rotulo: "Saldo no sistema", nome: "saldoInfo", valor: materialId ? qtd(S.material(materialId), S.saldo(S.material(materialId))) : "", somenteLeitura: true })}
      ${campo({ rotulo: "Quantidade contada", nome: "quantidadeContada", tipo: "number", obrigatorio: true, attrs: 'min="0" step="any"' })}
      <p class="span-all diff-preview" data-diferenca></p>
      ${campo({ rotulo: "Justificativa", nome: "justificativa", tipo: "textarea", obrigatorio: true, largura: "full", attrs: 'rows="2" minlength="10" maxlength="300" placeholder="Ex.: contagem do inventário mensal identificou divergência"' })}`,
    textoSalvar: "Registrar ajuste",
    aoMontarExtra(form) {
      const preview = () => {
        const m = S.material(form.materialId.value);
        form.saldoInfo.value = m ? qtd(m, S.saldo(m)) : "";
        const alvo = form.querySelector("[data-diferenca]");
        if (!m || form.quantidadeContada.value === "") {
          alvo.textContent = "";
          return;
        }
        const dif = Number(form.quantidadeContada.value) - S.saldo(m);
        alvo.innerHTML =
          dif === 0
            ? "Sem diferença em relação ao sistema."
            : `Diferença: <strong class="${dif > 0 ? "pos" : "neg"}">${dif > 0 ? "+" : "−"}${qtd(m, Math.abs(dif))}</strong>`;
      };
      form.materialId.addEventListener("change", preview);
      form.quantidadeContada.addEventListener("input", preview);
    },
    salvar: async (d) => {
      const m = S.material(d.materialId);
      const ok = await confirmar({
        titulo: "Confirmar ajuste",
        mensagem: `<p>Ajustar o saldo de <strong>${esc(m.nome)}</strong> de ${qtd(m, S.saldo(m))} para <strong>${qtd(m, Number(d.quantidadeContada))}</strong>?</p>`,
        textoConfirmar: "Confirmar ajuste",
      });
      if (!ok) return false;
      const r = executar(
        () => S.ajustarInventario(d),
        "Ajuste de inventário registrado.",
      );
      if (r) aoConcluir?.();
      return r;
    },
  });
}

async function baixar(unidadeId) {
  const u = S.db().unidades.find((x) => x.id === unidadeId);
  const r = await confirmar({
    titulo: `Baixar unidade ${u.serie}`,
    mensagem:
      "<p>A unidade será marcada como <strong>descartada</strong> e deixará de compor o saldo. Esta ação fica registrada no histórico.</p>",
    textoConfirmar: "Baixar unidade",
    perigo: true,
    motivo: {
      rotulo: "Justificativa",
      obrigatorio: true,
      minimo: 10,
      placeholder: "Ex.: carcaça reprovada para recapagem",
    },
  });
  if (r)
    executar(() => S.baixarUnidade(unidadeId, r.motivo), "Unidade baixada.");
}

async function receberRecapagem(unidadeId) {
  const u = S.db().unidades.find((x) => x.id === unidadeId);
  const ok = await confirmar({
    titulo: "Receber da recapagem",
    mensagem: `<p>Registrar o retorno da unidade <strong>${esc(u.serie)}</strong> ao estoque?</p>`,
    textoConfirmar: "Receber",
  });
  if (ok)
    executar(
      () => S.receberDaRecapagem(unidadeId),
      "Unidade retornou ao estoque.",
    );
}

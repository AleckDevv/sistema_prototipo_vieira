// Despesas operacionais: filtros por cidade, categoria, período e veículo, resumo e conferência.

import * as S from "../services/index.js";
import {
  CATEGORIAS_DESPESA,
  STATUS_DESPESA,
  PERIODOS,
  CIDADES,
  nomeCidade,
} from "../constants.js";
import {
  esc,
  fmt,
  contem,
  somar,
  intervaloPeriodo,
  noPeriodo,
  baixarCSV,
} from "../utils.js";
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
  kpi,
  secao,
} from "../ui.js";
import { barrasHorizontais } from "../charts.js";
import { icone } from "../icons.js";

const filtros = {
  busca: "",
  cidade: "",
  categoria: "",
  periodo: "mes",
  de: "",
  ate: "",
  veiculo: "",
  status: "",
};
let pagina = 1;

export default {
  titulo: "Despesas",
  descricao: "Despesas operacionais por cidade, categoria, período e veículo.",
  render(el, rota, { navegacao }) {
    if (navegacao) {
      for (const k of ["cidade", "categoria", "periodo", "status", "veiculo"])
        if (rota.query.has(k)) filtros[k] = rota.query.get(k);
      if (rota.query.has("status") && !rota.query.has("periodo"))
        filtros.periodo = "tudo";
      pagina = 1;
    }
    el.innerHTML = `
      <div class="filters" role="search">
        <div class="filter filter-grow"><label for="dp-busca">Buscar</label><div class="input-icon">${icone("search")}<input id="dp-busca" type="search" placeholder="Nº, descrição, fornecedor ou referência" value="${esc(filtros.busca)}" data-filtro="busca"></div></div>
        <div class="filter"><label for="dp-cidade">Cidade</label><select id="dp-cidade" data-filtro="cidade">${opcoesCidades(filtros.cidade)}</select></div>
        <div class="filter"><label for="dp-cat">Categoria</label><select id="dp-cat" data-filtro="categoria">${opcoesMapa(CATEGORIAS_DESPESA, filtros.categoria, "Todas")}</select></div>
        <div class="filter"><label for="dp-periodo">Período</label><select id="dp-periodo" data-filtro="periodo">${opcoes(
          Object.entries(PERIODOS).map(([valor, texto]) => ({ valor, texto })),
          filtros.periodo,
        )}</select></div>
        <div class="filter ${filtros.periodo === "personalizado" ? "" : "is-hidden"}" data-custom><label for="dp-de">De</label><input id="dp-de" type="date" value="${filtros.de}" data-filtro="de"></div>
        <div class="filter ${filtros.periodo === "personalizado" ? "" : "is-hidden"}" data-custom><label for="dp-ate">Até</label><input id="dp-ate" type="date" value="${filtros.ate}" data-filtro="ate"></div>
        <div class="filter"><label for="dp-veic">Veículo</label><select id="dp-veic" data-filtro="veiculo">${opcoes([{ valor: "sem", texto: "Sem veículo associado" }, ...S.veiculosOrdenados().map((v) => ({ valor: v.id, texto: S.rotuloVeiculo(v) }))], filtros.veiculo, "Todos")}</select></div>
        <div class="filter"><label for="dp-status">Status</label><select id="dp-status" data-filtro="status">${opcoesMapa(STATUS_DESPESA, filtros.status, "Ativas (sem canceladas)")}</select></div>
      </div>
      <div id="dp-conteudo"></div>`;

    el.oninput = (e) => {
      if (e.target.dataset.filtro === "busca") {
        filtros.busca = e.target.value;
        pagina = 1;
        desenhar(el);
      }
    };
    el.onchange = (e) => {
      const f = e.target.dataset.filtro;
      if (!f || f === "busca") return;
      filtros[f] = e.target.value;
      if (f === "periodo")
        el.querySelectorAll("[data-custom]").forEach((x) =>
          x.classList.toggle("is-hidden", filtros.periodo !== "personalizado"),
        );
      pagina = 1;
      desenhar(el);
    };
    el.onclick = (e) => {
      const b = e.target.closest("[data-acao], [data-pagina]");
      if (!b) return;
      if (b.dataset.pagina) {
        pagina = Number(b.dataset.pagina);
        desenhar(el, false);
        return;
      }
      e.stopPropagation();
      const { acao, id } = b.dataset;
      if (acao === "nova") abrirNovaDespesa();
      else if (acao === "csv") exportar();
      else if (acao === "ver") abrirDetalheDespesa(id);
      else if (acao === "conferir") conferir(id);
      else if (acao === "cancelar") cancelar(id);
    };
    el.onkeydown = (e) => {
      if (e.key === "Enter" && e.target.dataset?.acao === "ver")
        abrirDetalheDespesa(e.target.dataset.id);
    };
    desenhar(el);
  },
};

function filtrar() {
  const p = intervaloPeriodo(
    filtros.periodo,
    S.hoje(),
    filtros.de,
    filtros.ate,
  );
  return S.db()
    .despesas.filter((d) =>
      filtros.status ? d.status === filtros.status : d.status !== "cancelada",
    )
    .filter(
      (d) =>
        noPeriodo(d.data, p) &&
        (!filtros.cidade || d.cidade === filtros.cidade) &&
        (!filtros.categoria || d.categoria === filtros.categoria),
    )
    .filter(
      (d) =>
        !filtros.veiculo ||
        (filtros.veiculo === "sem"
          ? !d.veiculoId
          : d.veiculoId === filtros.veiculo),
    )
    .filter(
      (d) =>
        !filtros.busca ||
        contem(
          `${d.id} ${d.descricao} ${d.fornecedor} ${d.origem?.id ?? ""} ${d.veiculoId ? S.rotuloVeiculo(d.veiculoId) : ""}`,
          filtros.busca,
        ),
    )
    .sort((a, b) => b.data.localeCompare(a.data) || b.id.localeCompare(a.id));
}

function referencia(d) {
  if (!d.origem) return '<span class="muted">Lançamento direto</span>';
  const rota = {
    compra: `#/compras/${d.origem.id}`,
    os: `#/manutencao/${d.origem.id}`,
    abastecimento: `#/abastecimento?veiculo=${d.veiculoId}`,
  }[d.origem.tipo];
  const rotulo = { compra: "Compra", os: "OS", abastecimento: "Abastecimento" }[
    d.origem.tipo
  ];
  return `<a class="link" href="${rota}">${rotulo} <span class="mono">${d.origem.id}</span></a>`;
}

function desenhar(el, comResumo = true) {
  const lista = filtrar();
  const ativas = lista.filter((d) => d.status !== "cancelada");
  const total = somar(ativas, (d) => d.valor);
  const aConferir = ativas.filter((d) => d.status === "lancada");
  const porCategoria = Object.entries(CATEGORIAS_DESPESA)
    .map(([k, c]) => ({
      rotulo: c.label,
      valor: somar(
        ativas.filter((d) => d.categoria === k),
        (d) => d.valor,
      ),
    }))
    .sort((a, b) => b.valor - a.valor);
  const porCidade = CIDADES.map((c) => ({
    rotulo: c.nome,
    valor: somar(
      ativas.filter((d) => d.cidade === c.id),
      (d) => d.valor,
    ),
  })).sort((a, b) => b.valor - a.valor);
  const alvo = el.querySelector("#dp-conteudo");

  if (comResumo || !alvo.querySelector("#dp-tabela")) {
    alvo.innerHTML = `
      <div class="kpi-grid kpi-grid-4">
        ${kpi({ rotulo: "Total no período", valor: fmt.moeda(total), detalhe: `${PERIODOS[filtros.periodo]}${filtros.cidade ? ` · ${nomeCidade(filtros.cidade)}` : ""}`, ic: "wallet" })}
        ${kpi({ rotulo: "Lançamentos", valor: fmt.numero(ativas.length), detalhe: "Canceladas não são somadas", ic: "receipt" })}
        ${kpi({ rotulo: "Aguardando conferência", valor: fmt.numero(aConferir.length), detalhe: fmt.moeda(somar(aConferir, (d) => d.valor)), ic: "clock", tom: aConferir.length ? "warning" : "" })}
        ${kpi({ rotulo: "Maior categoria", valor: porCategoria[0]?.valor ? esc(porCategoria[0].rotulo) : "—", detalhe: porCategoria[0]?.valor ? `${fmt.moeda(porCategoria[0].valor)} (${fmt.numero((porCategoria[0].valor / total) * 100, 0)}%)` : "Sem despesas", ic: "chart" })}
      </div>
      <div class="grid-2">
        ${secao("Resumo por cidade", barrasHorizontais(porCidade))}
        ${secao("Resumo por categoria", barrasHorizontais(porCategoria))}
      </div>
      <div class="page-toolbar">
        <p class="muted small">${icone("info")} Cada compra, ordem de serviço ou abastecimento gera no máximo uma despesa ativa; peças do estoque aplicadas em OS não geram nova despesa.</p>
        <div class="page-actions">
          <button type="button" class="btn btn-secondary" data-acao="csv">${icone("download")}<span>Exportar CSV</span></button>
          ${botao({ acao: "nova", texto: "Registrar despesa", icone: "plus", variante: "primary", permissao: "despesas.registrar" })}
        </div>
      </div>
      <div id="dp-tabela"></div>`;
  }

  const pag = paginar(lista, pagina, 15);
  pagina = pag.pagina;
  const podeConferir = S.pode("despesas.conferir");
  alvo.querySelector("#dp-tabela").innerHTML =
    `<div class="card card-flush">${tabela({
      colunas: [
        {
          titulo: "Nº",
          render: (d) => `<span class="mono">${d.id}</span>`,
          classe: "nowrap",
        },
        { titulo: "Data", render: (d) => fmt.data(d.data), classe: "nowrap" },
        {
          titulo: "Descrição",
          render: (d) =>
            `<span class="truncate" title="${esc(d.descricao)}">${esc(d.descricao)}</span>${d.fornecedor ? `<small class="cell-sub">${esc(d.fornecedor)}</small>` : ""}`,
        },
        {
          titulo: "Categoria",
          render: (d) => esc(CATEGORIAS_DESPESA[d.categoria].label),
          classe: "hide-sm",
        },
        {
          titulo: "Cidade",
          render: (d) => esc(nomeCidade(d.cidade)),
          classe: "hide-sm",
        },
        {
          titulo: "Veículo",
          render: (d) =>
            d.veiculoId ? esc(S.rotuloVeiculo(d.veiculoId)) : "—",
          classe: "nowrap hide-sm",
        },
        {
          titulo: "Valor",
          render: (d) => `<strong>${fmt.moeda(d.valor)}</strong>`,
          classe: "num nowrap",
        },
        { titulo: "Status", render: (d) => badge(STATUS_DESPESA, d.status) },
        { titulo: "Referência", render: referencia, classe: "hide-md" },
        {
          titulo: "Ações",
          classe: "actions",
          render: (d) =>
            (podeConferir && d.status === "lancada"
              ? `<button type="button" class="icon-btn" data-acao="conferir" data-id="${d.id}" title="Conferir" aria-label="Conferir ${d.id}">${icone("check")}</button>`
              : "") +
            (podeConferir && d.status !== "cancelada"
              ? `<button type="button" class="icon-btn" data-acao="cancelar" data-id="${d.id}" title="Cancelar" aria-label="Cancelar ${d.id}">${icone("x")}</button>`
              : ""),
        },
      ],
      linhas: pag.itens,
      linhaAttrs: (d) =>
        `class="is-clickable ${d.status === "cancelada" ? "row-muted" : ""}" data-acao="ver" data-id="${d.id}" tabindex="0"`,
      vazio: "Nenhuma despesa encontrada com os filtros atuais.",
      rodape: lista.length
        ? `<tr><td colspan="6" class="num"><strong>Total filtrado (${ativas.length} ativas)</strong></td><td class="num nowrap"><strong>${fmt.moeda(total)}</strong></td><td colspan="3"></td></tr>`
        : "",
    })}${paginacao(pag)}</div>`;
}

function exportar() {
  const lista = filtrar();
  baixarCSV(
    `despesas-demonstracao-${S.hoje()}.csv`,
    [
      { titulo: "Número", campo: "id" },
      { titulo: "Data", csv: (d) => fmt.data(d.data) },
      { titulo: "Descrição", campo: "descricao" },
      {
        titulo: "Categoria",
        csv: (d) => CATEGORIAS_DESPESA[d.categoria].label,
      },
      { titulo: "Cidade", csv: (d) => nomeCidade(d.cidade) },
      {
        titulo: "Veículo",
        csv: (d) => (d.veiculoId ? S.rotuloVeiculo(d.veiculoId) : ""),
      },
      { titulo: "Valor (R$)", csv: (d) => d.valor },
      { titulo: "Status", csv: (d) => STATUS_DESPESA[d.status].label },
      { titulo: "Responsável", csv: (d) => S.nomeUsuario(d.usuarioId) },
      { titulo: "Fornecedor", campo: "fornecedor" },
      { titulo: "Referência", csv: (d) => d.origem?.id ?? "" },
    ],
    lista,
  );
}

async function conferir(id) {
  const ok = await confirmar({
    titulo: `Conferir ${id}`,
    mensagem:
      "<p>Marcar a despesa como <strong>conferida</strong> pelo financeiro? Isso não registra pagamento.</p>",
    textoConfirmar: "Conferir",
  });
  if (ok)
    executar(
      () => S.alterarStatusDespesa(id, "conferida"),
      `Despesa ${id} conferida.`,
    );
}

async function cancelar(id) {
  const r = await confirmar({
    titulo: `Cancelar ${id}`,
    mensagem:
      "<p>A despesa deixará de ser somada nos totais e relatórios. O registro e o histórico são mantidos.</p>",
    textoConfirmar: "Cancelar despesa",
    perigo: true,
    motivo: { rotulo: "Motivo do cancelamento", obrigatorio: true, minimo: 5 },
  });
  if (r)
    executar(
      () => S.alterarStatusDespesa(id, "cancelada", r.motivo),
      `Despesa ${id} cancelada.`,
    );
}

function abrirDetalheDespesa(id) {
  const d = S.db().despesas.find((x) => x.id === id);
  if (!d) return;
  abrirModal({
    titulo: `Despesa ${d.id}`,
    subtitulo: esc(d.descricao),
    tamanho: "md",
    corpo: `
      <div class="badge-row">${badge(STATUS_DESPESA, d.status)}</div>
      ${detalhes(
        [
          ["Valor", `<strong>${fmt.moeda(d.valor)}</strong>`],
          ["Data", fmt.data(d.data)],
          ["Categoria", esc(CATEGORIAS_DESPESA[d.categoria].label)],
          ["Cidade", esc(nomeCidade(d.cidade))],
          [
            "Veículo",
            d.veiculoId
              ? `<a class="link" href="#/veiculos/${d.veiculoId}">${esc(S.rotuloVeiculo(d.veiculoId))}</a>`
              : "—",
          ],
          ["Responsável pelo lançamento", esc(S.nomeUsuario(d.usuarioId))],
          ["Fornecedor", esc(d.fornecedor) || "—"],
          ["Referência", referencia(d), true],
        ],
        2,
      )}
      <h4 class="subhead">Histórico</h4>
      ${linhaDoTempo(d.historico)}`,
    rodape:
      '<button type="button" class="btn btn-secondary" data-fechar-modal>Fechar</button>',
    aoMontar(modal, ctrl) {
      modal
        .querySelectorAll('a[href^="#/"]')
        .forEach((a) => a.addEventListener("click", () => ctrl.fechar()));
    },
  });
}

function abrirNovaDespesa() {
  const s = S.db();
  const comprasSemDespesa = s.compras.filter(
    (c) =>
      ["em_compra", "recebida"].includes(c.status) &&
      !S.despesaAtivaDaOrigem("compra", c.id),
  );
  const osSemDespesa = s.ordens.filter(
    (o) => o.status === "concluida" && !S.despesaAtivaDaOrigem("os", o.id),
  );
  abrirModal({
    titulo: "Registrar despesa",
    subtitulo:
      "Lançamento demonstrativo. Não há integração bancária nem registro de pagamento.",
    tamanho: "md",
    corpo: `
      <form class="form grid-form" novalidate>
        ${campo({ rotulo: "Vincular a (opcional)", nome: "origem", tipo: "select", largura: "full", opcoesHtml: opcoes([...comprasSemDespesa.map((c) => ({ valor: `compra:${c.id}`, texto: `Compra ${c.id} — ${fmt.moeda(c.valorEstimado)} estimados` })), ...osSemDespesa.map((o) => ({ valor: `os:${o.id}`, texto: `OS ${o.id} — ${S.rotuloVeiculo(o.veiculoId)}` }))], "", "Sem vínculo (lançamento direto)"), ajuda: "Somente compras e OS ainda sem despesa ativa aparecem aqui, evitando lançamento em duplicidade." })}
        ${campo({ rotulo: "Descrição", nome: "descricao", obrigatorio: true, largura: "full", attrs: 'minlength="3" maxlength="120"' })}
        ${campo({ rotulo: "Categoria", nome: "categoria", tipo: "select", obrigatorio: true, opcoesHtml: opcoesMapa(CATEGORIAS_DESPESA, "", "Selecione") })}
        ${campo({ rotulo: "Cidade", nome: "cidade", tipo: "select", obrigatorio: true, opcoesHtml: opcoesCidades("", "Selecione") })}
        ${campo({
          rotulo: "Veículo (quando aplicável)",
          nome: "veiculoId",
          tipo: "select",
          opcoesHtml: opcoes(
            S.veiculosOrdenados().map((v) => ({
              valor: v.id,
              texto: `${S.rotuloVeiculo(v)} — ${v.modelo}`,
            })),
            "",
            "Nenhum",
          ),
        })}
        ${campo({ rotulo: "Data", nome: "data", tipo: "date", valor: S.hoje(), obrigatorio: true, attrs: `max="${S.hoje()}"` })}
        ${campo({ rotulo: "Valor (R$)", nome: "valor", tipo: "number", obrigatorio: true, attrs: 'min="0.01" step="0.01"' })}
        ${campo({ rotulo: "Fornecedor", nome: "fornecedor", attrs: 'maxlength="80"' })}
      </form>`,
    rodape: `<button type="button" class="btn btn-ghost" data-fechar-modal>Cancelar</button><button type="button" class="btn btn-primary" data-salvar>Registrar despesa</button>`,
    aoMontar(modal, ctrl) {
      const form = modal.querySelector("form");
      form.origem.addEventListener("change", () => {
        const [tipo, id] = form.origem.value.split(":");
        if (tipo === "compra") {
          const c = s.compras.find((x) => x.id === id);
          form.descricao.value = `Compra ${c.id}${c.pedido ? ` — ${c.pedido.fornecedor}` : ""}`;
          form.categoria.value = S.categoriaSugerida(c);
          form.cidade.value = c.cidade;
          form.valor.value = c.valorEstimado;
          form.fornecedor.value = c.pedido?.fornecedor ?? "";
        } else if (tipo === "os") {
          const o = s.ordens.find((x) => x.id === id);
          form.descricao.value = `Serviço da ${o.id} — veículo ${S.veiculo(o.veiculoId)?.frota}`;
          form.categoria.value = o.categoriaCusto;
          form.cidade.value = o.cidade;
          form.veiculoId.value = o.veiculoId;
          form.valor.value = o.custoFinal || "";
        }
      });
      const salvar = (e) => {
        e?.preventDefault();
        if (!validarFormulario(form)) return;
        const d = dadosFormulario(form);
        const [origemTipo, origemId] = d.origem
          ? d.origem.split(":")
          : [null, null];
        if (
          executar(
            () =>
              S.registrarDespesa({
                ...d,
                veiculoId: d.veiculoId || null,
                origemTipo,
                origemId,
              }),
            (x) => `Despesa ${x.id} registrada.`,
          )
        )
          ctrl.fechar();
      };
      form.addEventListener("submit", salvar);
      modal.querySelector("[data-salvar]").addEventListener("click", salvar);
    },
  });
}

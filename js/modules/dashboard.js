// Dashboard: indicadores calculados a partir dos registros, com filtros por
// cidade, período e situação dos veículos.

import * as S from "../services/index.js";
import {
  CIDADES,
  SITUACOES_VEICULO,
  STATUS_SOLICITACAO,
  STATUS_SOLICITACAO_ATIVOS,
  STATUS_COMPRA,
  CATEGORIAS_DESPESA,
  PERIODOS,
  nomeCidade,
} from "../constants.js";
import { perfisAutorizados } from "../permissions.js";
import { esc, fmt, intervaloPeriodo, noPeriodo, somar } from "../utils.js";
import {
  kpi,
  opcoes,
  opcoesCidades,
  opcoesMapa,
  badge,
  tabela,
  secao,
  estadoVazio,
} from "../ui.js";
import { barrasHorizontais, barraEmpilhada, legenda } from "../charts.js";
import { icone } from "../icons.js";

const filtros = { cidade: "", periodo: "mes", situacao: "" };
let agrupamento = "categoria";
let todosAlertas = false;

const ROTULO_GASTOS = {
  mes: "Gastos do mês",
  "30d": "Gastos (30 dias)",
  "90d": "Gastos (90 dias)",
  ano: "Gastos no ano",
  tudo: "Gastos no período",
};

export default {
  titulo: "Dashboard",
  descricao:
    "Visão geral da operação calculada a partir dos registros da demonstração.",
  render(el, rota, { navegacao }) {
    if (navegacao && rota.query.has("cidade"))
      filtros.cidade = rota.query.get("cidade");
    el.innerHTML = `
      <div class="filters" role="search">
        <div class="filter">
          <label for="dash-cidade">Cidade</label>
          <select id="dash-cidade" data-filtro="cidade">${opcoesCidades(filtros.cidade)}</select>
        </div>
        <div class="filter">
          <label for="dash-periodo">Período</label>
          <select id="dash-periodo" data-filtro="periodo">${opcoes(
            Object.entries(PERIODOS)
              .filter(([k]) => k !== "personalizado")
              .map(([valor, texto]) => ({ valor, texto })),
            filtros.periodo,
          )}</select>
        </div>
        <div class="filter">
          <label for="dash-situacao">Situação dos veículos</label>
          <select id="dash-situacao" data-filtro="situacao">${opcoesMapa(SITUACOES_VEICULO, filtros.situacao, "Todas as situações")}</select>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" data-acao="limpar">${icone("reset")}<span>Limpar filtros</span></button>
        <p class="filters-hint">${icone("info")}<span>A situação filtra os indicadores da frota, as solicitações mecânicas e o consumo.</span></p>
      </div>
      <div id="dash-conteudo"></div>`;

    el.onchange = (e) => {
      const f = e.target.closest("[data-filtro]");
      if (!f) return;
      filtros[f.dataset.filtro] = f.value;
      desenhar(el);
    };
    el.onclick = (e) => {
      const alvo = e.target.closest("[data-acao], [data-href]");
      if (!alvo) return;
      if (alvo.dataset.href) {
        location.hash = alvo.dataset.href;
        return;
      }
      const acao = alvo.dataset.acao;
      if (acao === "limpar") {
        Object.assign(filtros, { cidade: "", periodo: "mes", situacao: "" });
        this.render(el, rota, { navegacao: false });
      } else if (acao === "agrupar") {
        agrupamento = alvo.dataset.valor;
        desenhar(el);
      } else if (acao === "alertas") {
        todosAlertas = !todosAlertas;
        desenhar(el);
      }
    };
    el.onkeydown = (e) => {
      if (e.key === "Enter" && e.target.dataset?.href)
        location.hash = e.target.dataset.href;
    };
    desenhar(el);
  },
};

function desenhar(el) {
  const s = S.db();
  const hoje = S.hoje();
  const periodo = intervaloPeriodo(filtros.periodo, hoje);
  const daCidade = (c) => !filtros.cidade || c === filtros.cidade;

  const veiculosCidade = s.veiculos.filter((v) => daCidade(v.cidade));
  const veiculos = veiculosCidade.filter(
    (v) => !filtros.situacao || v.situacao === filtros.situacao,
  );
  const ids = new Set(veiculos.map((v) => v.id));
  const conta = (sit) => veiculos.filter((v) => v.situacao === sit).length;

  const pendentes = s.solicitacoes.filter(
    (x) => STATUS_SOLICITACAO_ATIVOS.includes(x.status) && ids.has(x.veiculoId),
  );
  const aguardando = s.compras.filter(
    (c) => c.status === "aguardando" && daCidade(c.cidade),
  );
  const baixos = S.materiaisAbaixoDoMinimo({ cidade: filtros.cidade });
  const podeVerGastos = S.pode("despesas.consultar");
  const despesas = S.despesasAtivas().filter(
    (d) => daCidade(d.cidade) && noPeriodo(d.data, periodo),
  );
  const totalGastos = somar(despesas, (d) => d.valor);
  const combustivel = somar(
    despesas.filter((d) => d.categoria === "combustivel"),
    (d) => d.valor,
  );
  const consumo = S.consumo({ veiculoIds: ids, periodo });
  const qsCidade = filtros.cidade ? `cidade=${filtros.cidade}` : "";
  const qs = (...partes) => {
    const q = [...partes, qsCidade].filter(Boolean).join("&");
    return q ? `?${q}` : "";
  };

  const cards = [
    kpi({
      rotulo: "Veículos cadastrados",
      valor: fmt.numero(veiculos.length),
      detalhe: filtros.cidade
        ? `Frota de ${nomeCidade(filtros.cidade)}`
        : `${CIDADES.length} cidades atendidas`,
      ic: "truck",
      rota: `#/veiculos${qs(filtros.situacao ? `situacao=${filtros.situacao}` : "")}`,
    }),
    kpi({
      rotulo: "Veículos disponíveis",
      valor: fmt.numero(conta("operacao") + conta("disponivel")),
      detalhe: `${conta("operacao")} em operação · ${conta("disponivel")} no pátio`,
      ic: "checkCircle",
      tom: "success",
      rota: `#/veiculos${qs("situacao=disponivel")}`,
    }),
    kpi({
      rotulo: "Em manutenção",
      valor: fmt.numero(conta("manutencao")),
      detalhe: `${pendentes.filter((x) => x.status === "aguardando_pecas").length} aguardando peças`,
      ic: "wrench",
      tom: "warning",
      rota: `#/veiculos${qs("situacao=manutencao")}`,
    }),
    kpi({
      rotulo: "Solicitações pendentes",
      valor: fmt.numero(pendentes.length),
      detalhe: `${pendentes.filter((x) => x.prioridade === "critica").length} crítica(s) · ${pendentes.filter((x) => x.status === "aberta").length} sem análise`,
      ic: "clipboard",
      rota: `#/manutencao${qs("status=pendentes")}`,
    }),
    kpi({
      rotulo: "Compras aguardando aprovação",
      valor: fmt.numero(aguardando.length),
      detalhe: aguardando.length
        ? `${fmt.moeda(somar(aguardando, (c) => c.valorEstimado))} estimados`
        : "Nenhuma pendência da diretoria",
      ic: "gavel",
      tom: aguardando.length ? "warning" : "",
      rota: `#/compras${qs("status=aguardando")}`,
    }),
    kpi({
      rotulo: "Itens com estoque baixo",
      valor: fmt.numero(baixos.length),
      detalhe: `${baixos.filter((m) => S.saldo(m) <= 0).length} sem saldo · ${baixos.filter((m) => S.comprasAbertasDoMaterial(m.id).length).length} com compra em andamento`,
      ic: "package",
      tom: baixos.length ? "danger" : "",
      rota: "#/estoque?filtro=baixo",
    }),
    kpi({
      rotulo: ROTULO_GASTOS[filtros.periodo],
      valor: fmt.moeda(totalGastos),
      detalhe: `${despesas.length} lançamento(s) · combustível ${totalGastos ? fmt.numero((combustivel / totalGastos) * 100, 0) : 0}%`,
      ic: "wallet",
      rota: `#/despesas${qs(`periodo=${filtros.periodo}`)}`,
      bloqueado: podeVerGastos
        ? ""
        : `Visível para ${perfisAutorizados("despesas.consultar")}`,
    }),
    kpi({
      rotulo: "Consumo médio da frota",
      valor: consumo.kml ? fmt.kml(consumo.kml) : "—",
      detalhe: consumo.kml
        ? `${consumo.trechos} trechos válidos · ${fmt.km(consumo.dist)}`
        : "Dados insuficientes no período",
      ic: "gauge",
      rota: "#/abastecimento?aba=consumo",
    }),
  ];

  // Despesas por categoria ou cidade.
  let graficoDespesas;
  if (!podeVerGastos) {
    graficoDespesas = `<div class="restricted-inline">${icone("lock")}<p>Distribuição de despesas visível para ${esc(perfisAutorizados("despesas.consultar"))}.</p></div>`;
  } else {
    const itens =
      agrupamento === "categoria"
        ? Object.entries(CATEGORIAS_DESPESA).map(([k, c]) => ({
            rotulo: c.label,
            valor: somar(
              despesas.filter((d) => d.categoria === k),
              (d) => d.valor,
            ),
            rota: `#/despesas?categoria=${k}&periodo=${filtros.periodo}${filtros.cidade ? `&cidade=${filtros.cidade}` : ""}`,
          }))
        : CIDADES.map((c) => ({
            rotulo: c.nome,
            valor: somar(
              despesas.filter((d) => d.cidade === c.id),
              (d) => d.valor,
            ),
            rota: `#/despesas?cidade=${c.id}&periodo=${filtros.periodo}`,
          }));
    graficoDespesas =
      barrasHorizontais(itens.sort((a, b) => b.valor - a.valor)) +
      `<p class="chart-foot">Total: <strong>${fmt.moeda(totalGastos)}</strong> · despesas canceladas não são somadas.</p>`;
  }
  const seletorAgrupamento = podeVerGastos
    ? `<div class="segmented" role="group" aria-label="Agrupar despesas por">
        <button type="button" class="${agrupamento === "categoria" ? "is-active" : ""}" data-acao="agrupar" data-valor="categoria" aria-pressed="${agrupamento === "categoria"}">Categoria</button>
        <button type="button" class="${agrupamento === "cidade" ? "is-active" : ""}" data-acao="agrupar" data-valor="cidade" aria-pressed="${agrupamento === "cidade"}">Cidade</button>
      </div>`
    : "";

  // Situação da frota por cidade.
  const tons = {
    operacao: "info",
    disponivel: "success",
    manutencao: "warning",
    inativo: "neutral",
  };
  const segmentosLegenda = Object.entries(SITUACOES_VEICULO).map(([k, d]) => ({
    rotulo: d.label,
    tom: tons[k],
  }));
  const linhasFrota = CIDADES.filter((c) => daCidade(c.id))
    .map((c) => {
      const vs = s.veiculos.filter((v) => v.cidade === c.id);
      const segs = Object.entries(SITUACOES_VEICULO).map(([k, d]) => ({
        rotulo: d.label,
        valor: vs.filter((v) => v.situacao === k).length,
        tom: tons[k],
      }));
      return `
        <li class="fleet-row">
          <div class="fleet-head"><a class="link" href="#/veiculos?cidade=${c.id}">${esc(c.nome)}</a><span>${vs.length} veículos</span></div>
          ${barraEmpilhada(segs, vs.length)}
          <div class="fleet-counts">${segs.map((sg) => `<span><i class="legend-swatch seg-${sg.tom}"></i>${sg.valor}</span>`).join("")}</div>
        </li>`;
    })
    .join("");

  // Solicitações recentes (manutenção e compras).
  const recentes = [
    ...s.solicitacoes
      .filter((x) => ids.has(x.veiculoId))
      .map((x) => ({
        tipo: "Manutenção",
        id: x.id,
        data: x.dataAbertura,
        desc: `${S.rotuloVeiculo(x.veiculoId)} — ${x.descricao}`,
        cidade: x.cidade,
        status: badge(STATUS_SOLICITACAO, x.status),
        href: `#/manutencao/${x.id}`,
      })),
    ...s.compras
      .filter((c) => daCidade(c.cidade))
      .map((c) => ({
        tipo: "Compra",
        id: c.id,
        data: c.data,
        desc: `${c.itens.length} item(ns) · ${fmt.moeda(c.valorEstimado)} — ${c.justificativa}`,
        cidade: c.cidade,
        status: badge(STATUS_COMPRA, c.status),
        href: `#/compras/${c.id}`,
      })),
  ]
    .sort((a, b) => b.data.localeCompare(a.data) || b.id.localeCompare(a.id))
    .slice(0, 8);

  const tabelaRecentes = tabela({
    colunas: [
      {
        titulo: "Nº",
        render: (r) =>
          `<span class="mono">${esc(r.id)}</span><small class="cell-sub">${r.tipo}</small>`,
        classe: "nowrap",
      },
      {
        titulo: "Descrição",
        render: (r) =>
          `<span class="truncate" title="${esc(r.desc)}">${esc(r.desc)}</span><small class="cell-sub">${esc(nomeCidade(r.cidade))} · ${fmt.data(r.data)}</small>`,
      },
      { titulo: "Status", render: (r) => r.status },
    ],
    linhas: recentes,
    linhaAttrs: (r) =>
      `class="is-clickable" data-href="${r.href}" tabindex="0"`,
    vazio: "Nenhuma solicitação para os filtros selecionados.",
  });

  const alertas = S.alertasOperacionais({
    cidade: filtros.cidade,
    veiculoIds: filtros.situacao ? ids : null,
  });
  const visiveis = todosAlertas ? alertas : alertas.slice(0, 7);
  const listaAlertas = alertas.length
    ? `<ul class="alert-list">${visiveis
        .map(
          (a) =>
            `<li><a href="${a.rota}" class="alert-item alert-${a.tom}">${icone(a.tom === "danger" ? "alert" : a.tom === "info" ? "info" : "alert")}<span><strong>${esc(a.titulo)}</strong><small>${esc(a.detalhe)}</small></span>${icone("chevronRight", "alert-go")}</a></li>`,
        )
        .join(
          "",
        )}</ul>${alertas.length > 7 ? `<button type="button" class="btn btn-ghost btn-sm btn-block" data-acao="alertas">${todosAlertas ? "Mostrar menos" : `Ver todos os ${alertas.length} alertas`}</button>` : ""}`
    : estadoVazio(
        "Nenhum alerta operacional para os filtros selecionados.",
        "checkCircle",
      );

  el.querySelector("#dash-conteudo").innerHTML = `
    <div class="kpi-grid">${cards.join("")}</div>
    <div class="grid-2 grid-dash">
      ${secao("Despesas por " + (agrupamento === "categoria" ? "categoria" : "cidade"), graficoDespesas, { acoes: seletorAgrupamento, descricao: `${esc(PERIODOS[filtros.periodo])}${filtros.cidade ? ` · ${esc(nomeCidade(filtros.cidade))}` : ""}` })}
      ${secao("Situação da frota por cidade", `<ul class="fleet-list">${linhasFrota}</ul>${legenda(segmentosLegenda)}`, { descricao: "Distribuição atual dos veículos cadastrados" })}
    </div>
    <div class="grid-2 grid-dash-bottom">
      ${secao("Solicitações recentes", tabelaRecentes, { descricao: "Manutenção e compras, das mais recentes para as mais antigas", acoes: `<a class="btn btn-ghost btn-sm" href="#/manutencao">Manutenção</a><a class="btn btn-ghost btn-sm" href="#/compras">Compras</a>` })}
      ${secao(`Alertas operacionais (${alertas.length})`, listaAlertas, { descricao: "Gerados automaticamente a partir dos registros" })}
    </div>`;
}

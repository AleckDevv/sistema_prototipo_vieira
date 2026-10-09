// Relatórios gerenciais: todos os valores vêm dos registros e respeitam os filtros.
// Cada relatório pode ser exportado em CSV ou impresso.

import * as S from "../services/index.js";
import {
  CIDADES,
  CATEGORIAS_DESPESA,
  CATEGORIAS_MATERIAL,
  STATUS_COMPRA,
  STATUS_SOLICITACAO,
  STATUS_SOLICITACAO_ATIVOS,
  PRIORIDADES,
  TIPOS_MOVIMENTO,
  TIPOS_DESTINACAO,
  PERIODOS,
  nomeCidade,
} from "../constants.js";
import {
  esc,
  fmt,
  somar,
  intervaloPeriodo,
  noPeriodo,
  baixarCSV,
  diasEntre,
} from "../utils.js";
import {
  opcoes,
  opcoesMapa,
  opcoesCidades,
  tabela,
  badge,
  badgeTexto,
} from "../ui.js";
import { icone } from "../icons.js";

const filtros = {
  relatorio: "despesas-cidade",
  periodo: "90d",
  de: "",
  ate: "",
  cidade: "",
  veiculo: "",
  categoria: "",
  categoriaMaterial: "",
  statusCompra: "",
  statusSolicitacao: "",
  tipoMovimento: "",
};

const n2 = (v) => Math.round(v * 100) / 100;
const veic = (id) => S.rotuloVeiculo(id);

function periodo() {
  return intervaloPeriodo(filtros.periodo, S.hoje(), filtros.de, filtros.ate);
}

function despesasFiltradas({ usarCategoria = true, usarVeiculo = true } = {}) {
  const p = periodo();
  return S.despesasAtivas().filter(
    (d) =>
      noPeriodo(d.data, p) &&
      (!filtros.cidade || d.cidade === filtros.cidade) &&
      (!usarCategoria ||
        !filtros.categoria ||
        d.categoria === filtros.categoria) &&
      (!usarVeiculo || !filtros.veiculo || d.veiculoId === filtros.veiculo),
  );
}

function veiculosFiltrados() {
  return S.veiculosOrdenados().filter(
    (v) =>
      (!filtros.cidade || v.cidade === filtros.cidade) &&
      (!filtros.veiculo || v.id === filtros.veiculo),
  );
}

const colMoeda = (titulo, campo) => ({
  titulo,
  render: (l) => fmt.moeda(l[campo]),
  csv: (l) => n2(l[campo]),
  classe: "num nowrap",
});

const RELATORIOS = [
  {
    id: "despesas-cidade",
    titulo: "Despesas por cidade",
    descricao: "Total de despesas ativas por cidade, separado por categoria.",
    filtros: ["periodo", "categoria"],
    linhas() {
      const lista = despesasFiltradas({ usarVeiculo: false });
      return CIDADES.filter(
        (c) => !filtros.cidade || c.id === filtros.cidade,
      ).map((c) => {
        const daCidade = lista.filter((d) => d.cidade === c.id);
        const linha = {
          cidade: c.nome,
          n: daCidade.length,
          total: somar(daCidade, (d) => d.valor),
        };
        for (const k of Object.keys(CATEGORIAS_DESPESA))
          linha[k] = somar(
            daCidade.filter((d) => d.categoria === k),
            (d) => d.valor,
          );
        return linha;
      });
    },
    colunas: () => [
      {
        titulo: "Cidade",
        render: (l) => `<strong>${esc(l.cidade)}</strong>`,
        csv: (l) => l.cidade,
      },
      {
        titulo: "Lançamentos",
        render: (l) => l.n,
        csv: (l) => l.n,
        classe: "num",
      },
      ...Object.entries(CATEGORIAS_DESPESA)
        .filter(([k]) => !filtros.categoria || k === filtros.categoria)
        .map(([k, c]) => colMoeda(c.curto ?? c.label, k)),
      {
        ...colMoeda("Total", "total"),
        render: (l) => `<strong>${fmt.moeda(l.total)}</strong>`,
      },
    ],
    total: (linhas) => ({
      rotulo: "Total geral",
      valor: fmt.moeda(somar(linhas, (l) => l.total)),
    }),
  },
  {
    id: "despesas-veiculo",
    titulo: "Despesas por veículo",
    descricao:
      "Despesas associadas a cada veículo no período (despesas sem veículo não entram).",
    filtros: ["periodo", "cidade", "veiculo", "categoria"],
    linhas() {
      const lista = despesasFiltradas().filter((d) => d.veiculoId);
      return veiculosFiltrados()
        .map((v) => {
          const dv = lista.filter((d) => d.veiculoId === v.id);
          const soma = (cats) =>
            somar(
              dv.filter((d) => cats.includes(d.categoria)),
              (d) => d.valor,
            );
          return {
            v,
            n: dv.length,
            combustivel: soma(["combustivel"]),
            manutencao: soma(["manutencao", "servicos_externos"]),
            pecas: soma(["pecas", "pneus_baterias"]),
            outras: soma(["outras"]),
            total: somar(dv, (d) => d.valor),
          };
        })
        .filter((l) => l.n > 0)
        .sort((a, b) => b.total - a.total);
    },
    colunas: () => [
      {
        titulo: "Veículo",
        render: (l) =>
          `<strong>${esc(veic(l.v))}</strong><small class="cell-sub">${esc(l.v.modelo)}</small>`,
        csv: (l) => veic(l.v),
      },
      {
        titulo: "Cidade",
        render: (l) => esc(nomeCidade(l.v.cidade)),
        csv: (l) => nomeCidade(l.v.cidade),
      },
      {
        titulo: "Lançamentos",
        render: (l) => l.n,
        csv: (l) => l.n,
        classe: "num",
      },
      colMoeda("Combustível", "combustivel"),
      colMoeda("Manutenção e serviços", "manutencao"),
      colMoeda("Peças, pneus e baterias", "pecas"),
      colMoeda("Outras", "outras"),
      {
        ...colMoeda("Total", "total"),
        render: (l) => `<strong>${fmt.moeda(l.total)}</strong>`,
      },
    ],
    total: (linhas) => ({
      rotulo: `${linhas.length} veículo(s)`,
      valor: fmt.moeda(somar(linhas, (l) => l.total)),
    }),
  },
  {
    id: "despesas-categoria",
    titulo: "Despesas por categoria",
    descricao: "Distribuição das despesas ativas por categoria.",
    filtros: ["periodo", "cidade", "veiculo"],
    linhas() {
      const lista = despesasFiltradas({ usarCategoria: false });
      const total = somar(lista, (d) => d.valor);
      return Object.entries(CATEGORIAS_DESPESA)
        .map(([k, c]) => {
          const dc = lista.filter((d) => d.categoria === k);
          const valor = somar(dc, (d) => d.valor);
          return {
            categoria: c.label,
            n: dc.length,
            total: valor,
            pct: total ? (valor / total) * 100 : 0,
          };
        })
        .sort((a, b) => b.total - a.total);
    },
    colunas: () => [
      {
        titulo: "Categoria",
        render: (l) => `<strong>${esc(l.categoria)}</strong>`,
        csv: (l) => l.categoria,
      },
      {
        titulo: "Lançamentos",
        render: (l) => l.n,
        csv: (l) => l.n,
        classe: "num",
      },
      { ...colMoeda("Total", "total") },
      {
        titulo: "Participação",
        render: (l) =>
          `<span class="pct-bar"><span style="width:${l.pct.toFixed(1)}%"></span></span> ${fmt.numero(l.pct, 1)}%`,
        csv: (l) => n2(l.pct),
        classe: "nowrap",
      },
    ],
    total: (linhas) => ({
      rotulo: "Total",
      valor: fmt.moeda(somar(linhas, (l) => l.total)),
    }),
  },
  {
    id: "manutencao",
    titulo: "Histórico de manutenção",
    descricao:
      "Solicitações mecânicas abertas no período, com ordem de serviço e custos.",
    filtros: ["periodo", "cidade", "veiculo", "statusSolicitacao"],
    linhas() {
      const p = periodo();
      return S.db()
        .solicitacoes.filter(
          (x) =>
            noPeriodo(x.dataAbertura, p) &&
            (!filtros.cidade || x.cidade === filtros.cidade) &&
            (!filtros.veiculo || x.veiculoId === filtros.veiculo) &&
            (!filtros.statusSolicitacao ||
              x.status === filtros.statusSolicitacao),
        )
        .map((x) => {
          const os = S.osDaSolicitacao(x.id);
          return {
            x,
            os,
            servico: os?.custoFinal ?? 0,
            pecas: os ? S.custoPecasOS(os) : 0,
          };
        })
        .sort(
          (a, b) =>
            b.x.dataAbertura.localeCompare(a.x.dataAbertura) ||
            b.x.id.localeCompare(a.x.id),
        );
    },
    colunas: () => [
      {
        titulo: "Nº",
        render: (l) => `<span class="mono">${l.x.id}</span>`,
        csv: (l) => l.x.id,
        classe: "nowrap",
      },
      {
        titulo: "Abertura",
        render: (l) => fmt.data(l.x.dataAbertura),
        csv: (l) => fmt.data(l.x.dataAbertura),
        classe: "nowrap",
      },
      {
        titulo: "Veículo",
        render: (l) => esc(veic(l.x.veiculoId)),
        csv: (l) => veic(l.x.veiculoId),
        classe: "nowrap",
      },
      {
        titulo: "Cidade",
        render: (l) => esc(nomeCidade(l.x.cidade)),
        csv: (l) => nomeCidade(l.x.cidade),
      },
      {
        titulo: "Problema",
        render: (l) => esc(l.x.descricao),
        csv: (l) => l.x.descricao,
      },
      {
        titulo: "Prioridade",
        render: (l) => esc(PRIORIDADES[l.x.prioridade].label),
        csv: (l) => PRIORIDADES[l.x.prioridade].label,
        classe: "hide-md",
      },
      {
        titulo: "Status",
        render: (l) => badge(STATUS_SOLICITACAO, l.x.status),
        csv: (l) => STATUS_SOLICITACAO[l.x.status].label,
      },
      {
        titulo: "OS",
        render: (l) => (l.os ? `<span class="mono">${l.os.id}</span>` : "—"),
        csv: (l) => l.os?.id ?? "",
      },
      {
        titulo: "Conclusão",
        render: (l) => fmt.data(l.os?.dataConclusao),
        csv: (l) => (l.os?.dataConclusao ? fmt.data(l.os.dataConclusao) : ""),
        classe: "nowrap hide-md",
      },
      colMoeda("Serviço", "servico"),
      colMoeda("Peças (estoque)", "pecas"),
    ],
    total: (linhas) => ({
      rotulo: `${linhas.length} solicitação(ões) · serviço + peças`,
      valor: fmt.moeda(somar(linhas, (l) => l.servico + l.pecas)),
    }),
  },
  {
    id: "abastecimento",
    titulo: "Histórico de abastecimento",
    descricao: "Abastecimentos registrados no período.",
    filtros: ["periodo", "cidade", "veiculo"],
    linhas() {
      const p = periodo();
      return S.db()
        .abastecimentos.filter(
          (a) =>
            noPeriodo(a.data, p) &&
            (!filtros.cidade || a.cidade === filtros.cidade) &&
            (!filtros.veiculo || a.veiculoId === filtros.veiculo),
        )
        .sort(
          (a, b) => b.data.localeCompare(a.data) || b.id.localeCompare(a.id),
        );
    },
    colunas: () => [
      {
        titulo: "Data",
        render: (a) => fmt.data(a.data),
        csv: (a) => fmt.data(a.data),
        classe: "nowrap",
      },
      {
        titulo: "Veículo",
        render: (a) => esc(veic(a.veiculoId)),
        csv: (a) => veic(a.veiculoId),
        classe: "nowrap",
      },
      {
        titulo: "Cidade",
        render: (a) => esc(nomeCidade(a.cidade)),
        csv: (a) => nomeCidade(a.cidade),
      },
      {
        titulo: "Km",
        render: (a) => fmt.numero(a.km),
        csv: (a) => a.km,
        classe: "num",
      },
      {
        titulo: "Litros",
        render: (a) => fmt.numero(a.litros, 1),
        csv: (a) => a.litros,
        classe: "num",
      },
      {
        titulo: "R$/L",
        render: (a) => fmt.numero(a.precoLitro, 2),
        csv: (a) => a.precoLitro,
        classe: "num",
      },
      colMoeda("Total", "valorTotal"),
      { titulo: "Posto", render: (a) => esc(a.posto), csv: (a) => a.posto },
      {
        titulo: "Responsável",
        render: (a) => esc(S.nomeUsuario(a.usuarioId)),
        csv: (a) => S.nomeUsuario(a.usuarioId),
      },
    ],
    total: (linhas) => ({
      rotulo: `${linhas.length} abastecimento(s) · ${fmt.litros(somar(linhas, (a) => a.litros))}`,
      valor: fmt.moeda(somar(linhas, (a) => a.valorTotal)),
    }),
  },
  {
    id: "consumo",
    titulo: "Consumo médio de combustível",
    descricao:
      "Consumo (km/l) por veículo, apenas com trechos válidos (sem quilometragem regressiva).",
    filtros: ["periodo", "cidade", "veiculo"],
    linhas() {
      const veiculos = veiculosFiltrados();
      const c = S.consumo({
        veiculoIds: new Set(veiculos.map((v) => v.id)),
        periodo: periodo(),
      });
      const ref = S.consumoReferenciaPorTipo(periodo());
      return veiculos
        .map((v) => {
          const x = c.porVeiculo.get(v.id);
          const base = ref.get(v.tipo);
          return {
            v,
            dist: x?.dist ?? 0,
            litros: x?.litros ?? 0,
            trechos: x?.trechos ?? 0,
            kml: x?.kml ?? null,
            base,
            variacao: x && base ? (x.kml / base - 1) * 100 : null,
          };
        })
        .sort((a, b) => (a.variacao ?? 999) - (b.variacao ?? 999));
    },
    colunas: () => [
      {
        titulo: "Veículo",
        render: (l) =>
          `<strong>${esc(veic(l.v))}</strong><small class="cell-sub">${esc(l.v.modelo)}</small>`,
        csv: (l) => veic(l.v),
      },
      { titulo: "Tipo", render: (l) => esc(l.v.tipo), csv: (l) => l.v.tipo },
      {
        titulo: "Cidade",
        render: (l) => esc(nomeCidade(l.v.cidade)),
        csv: (l) => nomeCidade(l.v.cidade),
      },
      {
        titulo: "Trechos",
        render: (l) => l.trechos,
        csv: (l) => l.trechos,
        classe: "num",
      },
      {
        titulo: "Km",
        render: (l) => fmt.numero(l.dist),
        csv: (l) => l.dist,
        classe: "num",
      },
      {
        titulo: "Litros",
        render: (l) => fmt.numero(l.litros, 1),
        csv: (l) => n2(l.litros),
        classe: "num",
      },
      {
        titulo: "Consumo (km/l)",
        render: (l) =>
          l.kml
            ? `<strong>${fmt.numero(l.kml, 2)}</strong>`
            : '<span class="muted">Dados insuficientes</span>',
        csv: (l) => (l.kml ? n2(l.kml) : ""),
        classe: "num",
      },
      {
        titulo: "Ref. do tipo",
        render: (l) => (l.base ? fmt.numero(l.base, 2) : "—"),
        csv: (l) => (l.base ? n2(l.base) : ""),
        classe: "num",
      },
      {
        titulo: "Variação",
        render: (l) =>
          l.variacao === null
            ? "—"
            : badgeTexto(
                `${l.variacao > 0 ? "+" : ""}${fmt.numero(l.variacao, 1)}%`,
                l.variacao < -15
                  ? "danger"
                  : l.variacao < -7
                    ? "warning"
                    : "success",
              ),
        csv: (l) => (l.variacao === null ? "" : n2(l.variacao)),
        classe: "num",
      },
    ],
    total: (linhas) => {
      const d = somar(linhas, (l) => l.dist);
      const lt = somar(linhas, (l) => l.litros);
      return {
        rotulo: "Consumo médio ponderado",
        valor: lt ? fmt.kml(d / lt) : "—",
      };
    },
  },
  {
    id: "movimentos",
    titulo: "Movimentações de estoque",
    descricao: "Entradas, saídas e ajustes no período.",
    filtros: ["periodo", "cidade", "categoriaMaterial", "tipoMovimento"],
    linhas() {
      const p = periodo();
      return S.db()
        .movimentos.filter(
          (m) =>
            noPeriodo(m.data, p) &&
            (!filtros.cidade || m.cidade === filtros.cidade) &&
            (!filtros.tipoMovimento || m.tipo === filtros.tipoMovimento) &&
            (!filtros.categoriaMaterial ||
              S.material(m.materialId)?.categoria ===
                filtros.categoriaMaterial),
        )
        .slice()
        .reverse();
    },
    colunas: () => [
      {
        titulo: "Data",
        render: (m) => fmt.data(m.data),
        csv: (m) => fmt.data(m.data),
        classe: "nowrap",
      },
      {
        titulo: "Nº",
        render: (m) => `<span class="mono">${m.id}</span>`,
        csv: (m) => m.id,
      },
      {
        titulo: "Material",
        render: (m) => esc(S.material(m.materialId)?.nome),
        csv: (m) => S.material(m.materialId)?.nome,
      },
      {
        titulo: "Tipo",
        render: (m) => esc(TIPOS_MOVIMENTO[m.tipo].label),
        csv: (m) => TIPOS_MOVIMENTO[m.tipo].label,
      },
      { titulo: "Motivo", render: (m) => esc(m.motivo), csv: (m) => m.motivo },
      {
        titulo: "Quantidade",
        render: (m) =>
          `${m.delta > 0 ? "+" : "−"}${fmt.numero(Math.abs(m.delta), Math.abs(m.delta) % 1 ? 1 : 0)} ${esc(S.material(m.materialId)?.unidade)}`,
        csv: (m) => m.delta,
        classe: "num nowrap",
      },
      {
        titulo: "Saldo após",
        render: (m) => fmt.numero(m.saldoApos, m.saldoApos % 1 ? 1 : 0),
        csv: (m) => m.saldoApos,
        classe: "num",
      },
      {
        titulo: "Veículo",
        render: (m) => (m.veiculoId ? esc(veic(m.veiculoId)) : "—"),
        csv: (m) => (m.veiculoId ? veic(m.veiculoId) : ""),
      },
      {
        titulo: "Referência",
        render: (m) => esc(m.ref?.id ?? "—"),
        csv: (m) => m.ref?.id ?? "",
      },
      {
        titulo: "Usuário",
        render: (m) => esc(S.nomeUsuario(m.usuarioId)),
        csv: (m) => S.nomeUsuario(m.usuarioId),
      },
    ],
    total: (linhas) => ({
      rotulo: "Movimentações",
      valor: `${linhas.length} (${linhas.filter((m) => m.tipo === "entrada").length} entradas · ${linhas.filter((m) => m.tipo === "saida").length} saídas · ${linhas.filter((m) => m.tipo === "ajuste").length} ajustes)`,
    }),
  },
  {
    id: "compras",
    titulo: "Solicitações de compra",
    descricao: "Solicitações criadas no período, com decisão da diretoria.",
    filtros: ["periodo", "cidade", "statusCompra"],
    linhas() {
      const p = periodo();
      return S.db()
        .compras.filter(
          (c) =>
            noPeriodo(c.data, p) &&
            (!filtros.cidade || c.cidade === filtros.cidade) &&
            (!filtros.statusCompra || c.status === filtros.statusCompra),
        )
        .sort(
          (a, b) => b.data.localeCompare(a.data) || b.id.localeCompare(a.id),
        );
    },
    colunas: () => [
      {
        titulo: "Nº",
        render: (c) => `<span class="mono">${c.id}</span>`,
        csv: (c) => c.id,
      },
      {
        titulo: "Data",
        render: (c) => fmt.data(c.data),
        csv: (c) => fmt.data(c.data),
        classe: "nowrap",
      },
      {
        titulo: "Solicitante",
        render: (c) => esc(S.nomeUsuario(c.solicitanteId)),
        csv: (c) => S.nomeUsuario(c.solicitanteId),
      },
      {
        titulo: "Cidade",
        render: (c) => esc(nomeCidade(c.cidade)),
        csv: (c) => nomeCidade(c.cidade),
      },
      {
        titulo: "Itens",
        render: (c) =>
          esc(
            c.itens
              .map(
                (i) =>
                  `${i.quantidade} ${i.unidade} ${S.material(i.materialId)?.nome}`,
              )
              .join("; "),
          ),
        csv: (c) =>
          c.itens
            .map(
              (i) =>
                `${i.quantidade} ${i.unidade} ${S.material(i.materialId)?.nome}`,
            )
            .join("; "),
      },
      colMoeda("Valor estimado", "valorEstimado"),
      {
        titulo: "Status",
        render: (c) => badge(STATUS_COMPRA, c.status),
        csv: (c) => STATUS_COMPRA[c.status].label,
      },
      {
        titulo: "Decisão por",
        render: (c) =>
          c.decisao
            ? `${esc(S.nomeUsuario(c.decisao.usuarioId))}<small class="cell-sub">${fmt.dataHora(c.decisao.dataHora)}</small>`
            : "—",
        csv: (c) =>
          c.decisao
            ? `${S.nomeUsuario(c.decisao.usuarioId)} em ${fmt.dataHora(c.decisao.dataHora)}`
            : "",
      },
      {
        titulo: "Motivo",
        render: (c) => esc(c.decisao?.motivo || "—"),
        csv: (c) => c.decisao?.motivo ?? "",
      },
    ],
    total: (linhas) => ({
      rotulo: `${linhas.length} solicitação(ões)`,
      valor: fmt.moeda(somar(linhas, (c) => c.valorEstimado)),
    }),
  },
  {
    id: "pendentes",
    titulo: "Solicitações pendentes",
    descricao:
      "Solicitações mecânicas em aberto e compras ainda não recebidas, com tempo em aberto.",
    filtros: ["cidade"],
    linhas() {
      const h = S.hoje();
      const s = S.db();
      return [
        ...s.solicitacoes
          .filter(
            (x) =>
              STATUS_SOLICITACAO_ATIVOS.includes(x.status) &&
              (!filtros.cidade || x.cidade === filtros.cidade),
          )
          .map((x) => ({
            tipo: "Manutenção",
            id: x.id,
            data: x.dataAbertura,
            dias: diasEntre(x.dataAbertura, h),
            desc: `${veic(x.veiculoId)} — ${x.descricao}`,
            cidade: x.cidade,
            status: STATUS_SOLICITACAO[x.status].label,
            statusHtml: badge(STATUS_SOLICITACAO, x.status),
            resp: x.responsavelId
              ? S.nomeUsuario(x.responsavelId)
              : "Não atribuído",
            prioridade: PRIORIDADES[x.prioridade].label,
          })),
        ...s.compras
          .filter(
            (c) =>
              ["aguardando", "aprovada", "em_compra"].includes(c.status) &&
              (!filtros.cidade || c.cidade === filtros.cidade),
          )
          .map((c) => ({
            tipo: "Compra",
            id: c.id,
            data: c.data,
            dias: diasEntre(c.data, h),
            desc: `${c.itens.map((i) => S.material(i.materialId)?.nome).join(", ")} — ${fmt.moeda(c.valorEstimado)}`,
            cidade: c.cidade,
            status: STATUS_COMPRA[c.status].label,
            statusHtml: badge(STATUS_COMPRA, c.status),
            resp:
              c.status === "aguardando"
                ? "Diretoria"
                : S.nomeUsuario(c.solicitanteId),
            prioridade: "—",
          })),
      ].sort((a, b) => b.dias - a.dias);
    },
    colunas: () => [
      { titulo: "Tipo", render: (l) => esc(l.tipo), csv: (l) => l.tipo },
      {
        titulo: "Nº",
        render: (l) => `<span class="mono">${l.id}</span>`,
        csv: (l) => l.id,
      },
      {
        titulo: "Desde",
        render: (l) => fmt.data(l.data),
        csv: (l) => fmt.data(l.data),
        classe: "nowrap",
      },
      {
        titulo: "Dias em aberto",
        render: (l) => `<strong>${l.dias}</strong>`,
        csv: (l) => l.dias,
        classe: "num",
      },
      { titulo: "Descrição", render: (l) => esc(l.desc), csv: (l) => l.desc },
      {
        titulo: "Cidade",
        render: (l) => esc(nomeCidade(l.cidade)),
        csv: (l) => nomeCidade(l.cidade),
      },
      {
        titulo: "Prioridade",
        render: (l) => esc(l.prioridade),
        csv: (l) => l.prioridade,
      },
      { titulo: "Status", render: (l) => l.statusHtml, csv: (l) => l.status },
      { titulo: "Com quem", render: (l) => esc(l.resp), csv: (l) => l.resp },
    ],
    total: (linhas) => ({
      rotulo: "Pendências",
      valor: `${linhas.length} (${linhas.filter((l) => l.tipo === "Manutenção").length} manutenção · ${linhas.filter((l) => l.tipo === "Compra").length} compras)`,
    }),
  },
  {
    id: "pecas",
    titulo: "Peças destinadas aos veículos",
    descricao:
      "Destinações por placa, inclusive peças aplicadas em ordens de serviço.",
    filtros: ["periodo", "cidade", "veiculo", "categoriaMaterial"],
    linhas() {
      const p = periodo();
      return S.db()
        .destinacoes.filter(
          (d) =>
            noPeriodo(d.data, p) &&
            (!filtros.cidade || d.cidade === filtros.cidade) &&
            (!filtros.veiculo || d.veiculoId === filtros.veiculo) &&
            (!filtros.categoriaMaterial ||
              S.material(d.materialId)?.categoria ===
                filtros.categoriaMaterial),
        )
        .sort(
          (a, b) => b.data.localeCompare(a.data) || b.id.localeCompare(a.id),
        );
    },
    colunas: () => {
      const series = (d) =>
        d.unidadeIds
          .map((u) => S.db().unidades.find((x) => x.id === u)?.serie)
          .join(", ");
      return [
        {
          titulo: "Data",
          render: (d) => fmt.data(d.data),
          csv: (d) => fmt.data(d.data),
          classe: "nowrap",
        },
        {
          titulo: "Placa",
          render: (d) =>
            esc(S.formatarPlaca(S.veiculo(d.veiculoId)?.placa ?? "")),
          csv: (d) => S.formatarPlaca(S.veiculo(d.veiculoId)?.placa ?? ""),
        },
        {
          titulo: "Frota",
          render: (d) => esc(S.veiculo(d.veiculoId)?.frota),
          csv: (d) => S.veiculo(d.veiculoId)?.frota,
        },
        {
          titulo: "Peça",
          render: (d) =>
            `${esc(S.material(d.materialId)?.nome)}${d.unidadeIds.length ? `<small class="cell-sub mono">${esc(series(d))}</small>` : ""}`,
          csv: (d) => S.material(d.materialId)?.nome,
        },
        { titulo: "Unidades", render: () => "", csv: series, somenteCsv: true },
        {
          titulo: "Qtd.",
          render: (d) =>
            `${fmt.numero(d.quantidade, d.quantidade % 1 ? 1 : 0)} ${esc(S.material(d.materialId)?.unidade)}`,
          csv: (d) => d.quantidade,
          classe: "num nowrap",
        },
        {
          titulo: "Tipo",
          render: (d) => esc(TIPOS_DESTINACAO[d.tipo].label),
          csv: (d) => TIPOS_DESTINACAO[d.tipo].label,
        },
        {
          titulo: "Cidade",
          render: (d) => esc(nomeCidade(d.cidade)),
          csv: (d) => nomeCidade(d.cidade),
        },
        {
          titulo: "Responsável",
          render: (d) => esc(S.nomeUsuario(d.usuarioId)),
          csv: (d) => S.nomeUsuario(d.usuarioId),
        },
        {
          titulo: "Observação",
          render: (d) => esc(d.observacao),
          csv: (d) => d.observacao,
        },
      ];
    },
    total: (linhas) => ({
      rotulo: "Destinações",
      valor: String(linhas.length),
    }),
  },
];

export default {
  titulo: "Relatórios",
  descricao:
    "Relatórios gerenciais com filtros, exportação CSV e versão para impressão.",
  render(el, rota, { navegacao }) {
    if (navegacao && rota.query.has("relatorio"))
      filtros.relatorio = rota.query.get("relatorio");
    el.innerHTML = `
      <div class="reports">
        <nav class="report-nav card" aria-label="Relatórios disponíveis">
          <p class="report-nav-title">Relatórios</p>
          ${RELATORIOS.map((r) => `<button type="button" class="report-link ${r.id === filtros.relatorio ? "is-active" : ""}" data-relatorio="${r.id}">${esc(r.titulo)}</button>`).join("")}
          <div class="filter report-select">
            <label for="rel-escolha">Relatório</label>
            <select id="rel-escolha" data-filtro="relatorio">${opcoes(
              RELATORIOS.map((r) => ({ valor: r.id, texto: r.titulo })),
              filtros.relatorio,
            )}</select>
          </div>
        </nav>
        <section class="report-panel" id="rel-painel"></section>
      </div>`;
    el.onclick = (e) => {
      const b = e.target.closest("[data-relatorio], [data-acao]");
      if (!b) return;
      if (b.dataset.relatorio) {
        filtros.relatorio = b.dataset.relatorio;
        el.querySelector("#rel-escolha").value = filtros.relatorio;
        el.querySelectorAll(".report-link").forEach((x) =>
          x.classList.toggle(
            "is-active",
            x.dataset.relatorio === filtros.relatorio,
          ),
        );
        desenhar(el);
      } else if (b.dataset.acao === "csv") exportar();
      else if (b.dataset.acao === "imprimir") window.print();
    };
    el.onchange = (e) => {
      const f = e.target.dataset.filtro;
      if (!f) return;
      filtros[f] = e.target.value;
      if (f === "relatorio")
        el.querySelectorAll(".report-link").forEach((x) =>
          x.classList.toggle(
            "is-active",
            x.dataset.relatorio === filtros.relatorio,
          ),
        );
      desenhar(el);
    };
    el.oninput = null;
    el.onkeydown = null;
    desenhar(el);
  },
};

function controle(nome) {
  const id = `rel-${nome}`;
  switch (nome) {
    case "periodo":
      return `
        <div class="filter"><label for="${id}">Período</label><select id="${id}" data-filtro="periodo">${opcoes(
          Object.entries(PERIODOS).map(([valor, texto]) => ({ valor, texto })),
          filtros.periodo,
        )}</select></div>
        ${filtros.periodo === "personalizado" ? `<div class="filter"><label for="rel-de">De</label><input id="rel-de" type="date" value="${filtros.de}" data-filtro="de"></div><div class="filter"><label for="rel-ate">Até</label><input id="rel-ate" type="date" value="${filtros.ate}" data-filtro="ate"></div>` : ""}`;
    case "cidade":
      return `<div class="filter"><label for="${id}">Cidade</label><select id="${id}" data-filtro="cidade">${opcoesCidades(filtros.cidade)}</select></div>`;
    case "veiculo":
      return `<div class="filter filter-grow"><label for="${id}">Veículo</label><select id="${id}" data-filtro="veiculo">${opcoes(
        S.veiculosOrdenados()
          .filter((v) => !filtros.cidade || v.cidade === filtros.cidade)
          .map((v) => ({
            valor: v.id,
            texto: `${S.rotuloVeiculo(v)} — ${v.modelo}`,
          })),
        filtros.veiculo,
        "Todos",
      )}</select></div>`;
    case "categoria":
      return `<div class="filter"><label for="${id}">Categoria</label><select id="${id}" data-filtro="categoria">${opcoesMapa(CATEGORIAS_DESPESA, filtros.categoria, "Todas")}</select></div>`;
    case "categoriaMaterial":
      return `<div class="filter"><label for="${id}">Categoria do material</label><select id="${id}" data-filtro="categoriaMaterial">${opcoesMapa(CATEGORIAS_MATERIAL, filtros.categoriaMaterial, "Todas")}</select></div>`;
    case "statusCompra":
      return `<div class="filter"><label for="${id}">Status</label><select id="${id}" data-filtro="statusCompra">${opcoesMapa(STATUS_COMPRA, filtros.statusCompra, "Todos")}</select></div>`;
    case "statusSolicitacao":
      return `<div class="filter"><label for="${id}">Status</label><select id="${id}" data-filtro="statusSolicitacao">${opcoesMapa(STATUS_SOLICITACAO, filtros.statusSolicitacao, "Todos")}</select></div>`;
    case "tipoMovimento":
      return `<div class="filter"><label for="${id}">Tipo</label><select id="${id}" data-filtro="tipoMovimento">${opcoesMapa(TIPOS_MOVIMENTO, filtros.tipoMovimento, "Todos")}</select></div>`;
    default:
      return "";
  }
}

function descricaoFiltros(r) {
  const partes = [];
  for (const f of r.filtros) {
    if (f === "periodo") {
      const p = periodo();
      partes.push(
        filtros.periodo === "tudo"
          ? "Período: todo o histórico"
          : `Período: ${fmt.data(p.de)} a ${fmt.data(p.ate)}`,
      );
    } else if (f === "cidade")
      partes.push(
        `Cidade: ${filtros.cidade ? nomeCidade(filtros.cidade) : "todas"}`,
      );
    else if (f === "veiculo" && filtros.veiculo)
      partes.push(`Veículo: ${S.rotuloVeiculo(filtros.veiculo)}`);
    else if (f === "categoria" && filtros.categoria)
      partes.push(`Categoria: ${CATEGORIAS_DESPESA[filtros.categoria].label}`);
    else if (f === "categoriaMaterial" && filtros.categoriaMaterial)
      partes.push(
        `Material: ${CATEGORIAS_MATERIAL[filtros.categoriaMaterial].label}`,
      );
    else if (f === "statusCompra" && filtros.statusCompra)
      partes.push(`Status: ${STATUS_COMPRA[filtros.statusCompra].label}`);
    else if (f === "statusSolicitacao" && filtros.statusSolicitacao)
      partes.push(
        `Status: ${STATUS_SOLICITACAO[filtros.statusSolicitacao].label}`,
      );
    else if (f === "tipoMovimento" && filtros.tipoMovimento)
      partes.push(`Tipo: ${TIPOS_MOVIMENTO[filtros.tipoMovimento].label}`);
  }
  return partes.join(" · ");
}

function desenhar(el) {
  const r = RELATORIOS.find((x) => x.id === filtros.relatorio) ?? RELATORIOS[0];
  // Filtros que não se aplicam ao relatório atual não interferem no resultado.
  const linhas = r.linhas();
  const colunas = r.colunas().filter((c) => !c.somenteCsv);
  const total = r.total(linhas);
  const agora = new Date();
  el.querySelector("#rel-painel").innerHTML = `
    <div class="card report-card">
      <div class="print-header">
        <p class="print-brand">Vieira | Gestão Operacional</p>
        <p>Protótipo de demonstração — dados fictícios, sem valor para operações reais.</p>
      </div>
      <header class="card-header">
        <div><h3>${esc(r.titulo)}</h3><p>${esc(r.descricao)}</p></div>
        <div class="card-actions no-print">
          <button type="button" class="btn btn-secondary btn-sm" data-acao="csv">${icone("download")}<span>Exportar CSV</span></button>
          <button type="button" class="btn btn-secondary btn-sm" data-acao="imprimir">${icone("printer")}<span>Imprimir</span></button>
        </div>
      </header>
      <div class="filters no-print" role="search">${r.filtros.map(controle).join("")}</div>
      <p class="report-meta">${esc(descricaoFiltros(r))} · Gerado em ${fmt.data(S.hoje())} ${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")} por ${esc(S.usuarioAtual().nome)}</p>
      <div class="report-total"><span>${esc(total.rotulo)}</span><strong>${total.valor}</strong></div>
      ${tabela({ colunas, linhas, vazio: "Nenhum registro para os filtros selecionados." })}
      <p class="muted small">${linhas.length} linha(s). Os valores são calculados a partir dos registros da demonstração; despesas canceladas não são consideradas.</p>
    </div>`;
}

function exportar() {
  const r = RELATORIOS.find((x) => x.id === filtros.relatorio);
  baixarCSV(
    `relatorio-${r.id}-${S.hoje()}.csv`,
    r.colunas().map((c) => ({ titulo: c.titulo, csv: c.csv })),
    r.linhas(),
  );
}

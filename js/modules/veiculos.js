// Veículos: listagem, filtros, cadastro/edição e ficha completa do veículo.

import * as S from "../services/index.js";
import {
  SITUACOES_VEICULO,
  STATUS_SOLICITACAO,
  PRIORIDADES,
  STATUS_OS,
  CATEGORIAS_DESPESA,
  STATUS_DESPESA,
  TIPOS_DESTINACAO,
  nomeCidade,
} from "../constants.js";
import { perfisAutorizados } from "../permissions.js";
import { esc, fmt, contem, somar, somarDias } from "../utils.js";
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
  kpi,
  estadoVazio,
} from "../ui.js";
import { icone } from "../icons.js";
import { abrirNovaSolicitacao, abrirDetalheSolicitacao } from "./manutencao.js";
import { abrirNovoAbastecimento } from "./abastecimento.js";
import { abrirDestinacao } from "./pecas.js";

const filtros = { busca: "", cidade: "", situacao: "", tipo: "" };
let pagina = 1;
let abaFicha = "manutencao";

export default {
  titulo: "Veículos",
  descricao: "Cadastro da frota, situação operacional e ficha de cada veículo.",
  render(el, rota, { navegacao }) {
    if (rota.param) {
      if (navegacao) abaFicha = rota.query.get("aba") || "manutencao";
      renderFicha(el, rota.param);
      return;
    }
    if (navegacao) {
      if (rota.query.has("cidade")) filtros.cidade = rota.query.get("cidade");
      if (rota.query.has("situacao"))
        filtros.situacao = rota.query.get("situacao");
      pagina = 1;
    }
    renderLista(el);
  },
};

// ---------------------------------------------------------------------------
// Listagem
// ---------------------------------------------------------------------------

function renderLista(el) {
  const tipos = [...new Set(S.db().veiculos.map((v) => v.tipo))].sort();
  el.innerHTML = `
    <div class="page-toolbar">
      <div class="chips" id="vei-chips"></div>
      <div class="page-actions">${botao({ acao: "novo", texto: "Cadastrar veículo", icone: "plus", variante: "primary", permissao: "veiculos.gerenciar" })}</div>
    </div>
    <div class="filters" role="search">
      <div class="filter filter-grow">
        <label for="vei-busca">Buscar</label>
        <div class="input-icon">${icone("search")}<input id="vei-busca" type="search" placeholder="Placa, número de frota ou modelo" value="${esc(filtros.busca)}" data-filtro="busca"></div>
      </div>
      <div class="filter"><label for="vei-cidade">Cidade</label><select id="vei-cidade" data-filtro="cidade">${opcoesCidades(filtros.cidade)}</select></div>
      <div class="filter"><label for="vei-situacao">Situação</label><select id="vei-situacao" data-filtro="situacao">${opcoesMapa(SITUACOES_VEICULO, filtros.situacao, "Todas as situações")}</select></div>
      <div class="filter"><label for="vei-tipo">Tipo</label><select id="vei-tipo" data-filtro="tipo">${opcoes(
        tipos.map((t) => ({ valor: t, texto: t })),
        filtros.tipo,
        "Todos os tipos",
      )}</select></div>
    </div>
    <div id="vei-resultado"></div>`;

  el.oninput = (e) => {
    if (e.target.dataset.filtro === "busca") {
      filtros.busca = e.target.value;
      pagina = 1;
      desenharLista(el);
    }
  };
  el.onchange = (e) => {
    const f = e.target.dataset.filtro;
    if (f && f !== "busca") {
      filtros[f] = e.target.value;
      pagina = 1;
      desenharLista(el);
    }
  };
  el.onclick = (e) => {
    const b = e.target.closest("[data-acao], [data-pagina], [data-href]");
    if (!b) return;
    if (b.dataset.pagina) {
      pagina = Number(b.dataset.pagina);
      desenharLista(el);
      return;
    }
    if (b.dataset.acao === "novo") abrirFormulario();
    else if (b.dataset.acao === "editar") {
      e.stopPropagation();
      abrirFormulario(b.dataset.id);
    } else if (b.dataset.acao === "situacao-chip") {
      filtros.situacao =
        filtros.situacao === b.dataset.valor ? "" : b.dataset.valor;
      el.querySelector("#vei-situacao").value = filtros.situacao;
      pagina = 1;
      desenharLista(el);
    } else if (b.dataset.href) {
      location.hash = b.dataset.href;
    }
  };
  el.onkeydown = (e) => {
    if (e.key === "Enter" && e.target.dataset?.href)
      location.hash = e.target.dataset.href;
  };
  desenharLista(el);
}

function desenharLista(el) {
  const todos = S.veiculosOrdenados();
  const base = todos.filter(
    (v) =>
      (!filtros.cidade || v.cidade === filtros.cidade) &&
      (!filtros.tipo || v.tipo === filtros.tipo) &&
      (!filtros.busca ||
        contem(
          `${v.placa} ${S.formatarPlaca(v.placa)} ${v.frota} ${v.modelo}`,
          filtros.busca,
        )),
  );
  const lista = base.filter(
    (v) => !filtros.situacao || v.situacao === filtros.situacao,
  );

  el.querySelector("#vei-chips").innerHTML = Object.entries(SITUACOES_VEICULO)
    .map(
      ([k, d]) =>
        `<button type="button" class="chip chip-${d.tom} ${filtros.situacao === k ? "is-active" : ""}" data-acao="situacao-chip" data-valor="${k}" aria-pressed="${filtros.situacao === k}">${esc(d.label)}<strong>${base.filter((v) => v.situacao === k).length}</strong></button>`,
    )
    .join("");

  const pag = paginar(lista, pagina, 12);
  pagina = pag.pagina;
  const podeEditar = S.pode("veiculos.gerenciar");
  el.querySelector("#vei-resultado").innerHTML = `
    <div class="card card-flush">
      ${tabela({
        colunas: [
          {
            titulo: "Frota",
            render: (v) => `<strong>${esc(v.frota)}</strong>`,
            classe: "nowrap",
          },
          {
            titulo: "Placa",
            render: (v) =>
              `<span class="plate">${esc(S.formatarPlaca(v.placa))}</span>`,
          },
          {
            titulo: "Modelo",
            render: (v) =>
              `${esc(v.modelo)}<small class="cell-sub">${esc(v.tipo)}</small>`,
          },
          { titulo: "Ano", render: (v) => v.ano, classe: "hide-sm" },
          { titulo: "Cidade", render: (v) => esc(nomeCidade(v.cidade)) },
          {
            titulo: "Km atual",
            render: (v) => fmt.km(v.km),
            classe: "num nowrap",
          },
          {
            titulo: "Situação",
            render: (v) => badge(SITUACOES_VEICULO, v.situacao),
          },
          {
            titulo: "Ações",
            classe: "actions",
            render: (v) =>
              `<a class="icon-btn" href="#/veiculos/${v.id}" title="Abrir ficha" aria-label="Abrir ficha do veículo ${esc(v.frota)}">${icone("eye")}</a>${podeEditar ? `<button type="button" class="icon-btn" data-acao="editar" data-id="${v.id}" title="Editar" aria-label="Editar veículo ${esc(v.frota)}">${icone("pencil")}</button>` : ""}`,
          },
        ],
        linhas: pag.itens,
        linhaAttrs: (v) =>
          `class="is-clickable" data-href="#/veiculos/${v.id}" tabindex="0"`,
        vazio: "Nenhum veículo encontrado. Ajuste a busca ou os filtros.",
      })}
      ${paginacao(pag)}
    </div>`;
}

// ---------------------------------------------------------------------------
// Cadastro e edição
// ---------------------------------------------------------------------------

function abrirFormulario(id = null) {
  const v = id ? S.veiculo(id) : null;
  const corpo = `
    <form class="form grid-form" novalidate>
      ${campo({ rotulo: "Número de frota", nome: "frota", valor: v?.frota ?? "", obrigatorio: true, attrs: 'maxlength="10" placeholder="Ex.: 141"' })}
      ${campo({ rotulo: "Placa", nome: "placa", valor: v ? S.formatarPlaca(v.placa) : "", obrigatorio: true, attrs: 'maxlength="8" placeholder="ABC1D23" style="text-transform:uppercase"', ajuda: "Placa fictícia — padrão Mercosul ou antigo." })}
      ${campo({ rotulo: "Modelo", nome: "modelo", valor: v?.modelo ?? "", obrigatorio: true, attrs: 'maxlength="60"', largura: "wide" })}
      ${campo({
        rotulo: "Tipo",
        nome: "tipo",
        tipo: "select",
        obrigatorio: true,
        opcoesHtml: opcoes(
          S.TIPOS_VEICULO.map((t) => ({ valor: t, texto: t })),
          v?.tipo ?? "",
          "Selecione",
        ),
      })}
      ${campo({ rotulo: "Ano", nome: "ano", tipo: "number", valor: v?.ano ?? "", obrigatorio: true, attrs: `min="1990" max="${Number(S.hoje().slice(0, 4)) + 1}" step="1"` })}
      ${campo({ rotulo: "Cidade de referência", nome: "cidade", tipo: "select", obrigatorio: true, opcoesHtml: opcoesCidades(v?.cidade ?? "", "Selecione") })}
      ${campo({
        rotulo: "Combustível",
        nome: "combustivel",
        tipo: "select",
        obrigatorio: true,
        opcoesHtml: opcoes(
          S.COMBUSTIVEIS.map((c) => ({ valor: c, texto: c })),
          v?.combustivel ?? "Diesel S10",
        ),
      })}
      ${v ? campo({ rotulo: "Quilometragem atual", nome: "kmInfo", valor: fmt.km(v.km), somenteLeitura: true, ajuda: "Atualizada por abastecimentos e leituras de hodômetro." }) : campo({ rotulo: "Quilometragem inicial", nome: "km", tipo: "number", obrigatorio: true, attrs: 'min="0" step="1"' })}
      ${
        v
          ? ""
          : campo({
              rotulo: "Situação inicial",
              nome: "situacao",
              tipo: "select",
              opcoesHtml: opcoes(
                [
                  { valor: "disponivel", texto: "Disponível" },
                  { valor: "operacao", texto: "Em operação" },
                  { valor: "inativo", texto: "Inativo" },
                ],
                "disponivel",
              ),
            })
      }
    </form>`;
  abrirModal({
    titulo: v ? `Editar veículo ${esc(v.frota)}` : "Cadastrar veículo",
    subtitulo: v
      ? esc(`${S.formatarPlaca(v.placa)} · ${v.modelo}`)
      : "Os dados informados são fictícios e ficam apenas neste navegador.",
    corpo,
    rodape: `<button type="button" class="btn btn-ghost" data-fechar-modal>Cancelar</button><button type="submit" class="btn btn-primary" data-salvar>${v ? "Salvar alterações" : "Cadastrar veículo"}</button>`,
    tamanho: "md",
    aoMontar(modal, ctrl) {
      const form = modal.querySelector("form");
      const salvar = (e) => {
        e?.preventDefault();
        if (
          !validarFormulario(form, (d) =>
            /^[A-Za-z]{3}-?[0-9][A-Za-z0-9][0-9]{2}$/.test(d.placa.trim())
              ? {}
              : { placa: "Use o formato ABC1D23 ou ABC-1234." },
          )
        )
          return;
        const r = executar(
          () => S.salvarVeiculo(dadosFormulario(form), id),
          v ? "Veículo atualizado." : "Veículo cadastrado.",
        );
        if (r) ctrl.fechar();
      };
      form.addEventListener("submit", salvar);
      modal.querySelector("[data-salvar]").addEventListener("click", salvar);
    },
  });
}

function abrirAlterarSituacao(v) {
  const opcoesSit = Object.entries(SITUACOES_VEICULO)
    .filter(([k]) => k !== v.situacao)
    .map(([valor, d]) => ({ valor, texto: d.label }));
  abrirModal({
    titulo: "Alterar situação operacional",
    subtitulo: esc(
      `${S.rotuloVeiculo(v)} · atual: ${SITUACOES_VEICULO[v.situacao].label}`,
    ),
    corpo: `
      ${S.manutencaoAtiva(v.id) ? `<div class="notice notice-warning">${icone("alert")}<span>Há solicitação em execução ou aguardando peças. O veículo só pode ser liberado após a conclusão da ordem de serviço.</span></div>` : ""}
      <form class="form" novalidate>
        ${campo({ rotulo: "Nova situação", nome: "situacao", tipo: "select", obrigatorio: true, opcoesHtml: opcoes(opcoesSit, "", "Selecione") })}
        ${campo({ rotulo: "Motivo", nome: "motivo", tipo: "textarea", obrigatorio: true, attrs: 'rows="3" minlength="3" placeholder="Ex.: veículo mantido em reserva no pátio"' })}
      </form>`,
    rodape: `<button type="button" class="btn btn-ghost" data-fechar-modal>Cancelar</button><button type="button" class="btn btn-primary" data-salvar>Alterar situação</button>`,
    tamanho: "sm",
    aoMontar(modal, ctrl) {
      const form = modal.querySelector("form");
      const salvar = (e) => {
        e?.preventDefault();
        if (!validarFormulario(form)) return;
        const d = dadosFormulario(form);
        if (
          executar(
            () => S.alterarSituacaoVeiculo(v.id, d.situacao, d.motivo),
            "Situação do veículo atualizada.",
          )
        )
          ctrl.fechar();
      };
      form.addEventListener("submit", salvar);
      modal.querySelector("[data-salvar]").addEventListener("click", salvar);
    },
  });
}

async function excluir(v) {
  const vinculos = S.vinculosVeiculo(v.id);
  const total = Object.values(vinculos).reduce((a, b) => a + b, 0);
  if (total > 0) {
    abrirModal({
      titulo: "Exclusão não permitida",
      tamanho: "sm",
      corpo: `
        <div class="notice notice-warning">${icone("alert")}<span>O veículo ${esc(S.rotuloVeiculo(v))} possui registros históricos vinculados e não pode ser excluído definitivamente.</span></div>
        ${detalhes(
          [
            ["Solicitações mecânicas", vinculos.solicitacoes],
            ["Abastecimentos", vinculos.abastecimentos],
            ["Peças destinadas", vinculos.destinacoes],
            ["Despesas", vinculos.despesas],
          ],
          2,
        )}
        <p class="muted">Para retirar o veículo da operação preservando o histórico, altere a situação para <strong>Inativo</strong>.</p>`,
      rodape:
        '<button type="button" class="btn btn-primary" data-fechar-modal>Entendi</button>',
    });
    return;
  }
  const ok = await confirmar({
    titulo: "Excluir veículo",
    mensagem: `<p>Excluir definitivamente o veículo <strong>${esc(S.rotuloVeiculo(v))}</strong>? Ele não possui registros vinculados.</p>`,
    textoConfirmar: "Excluir",
    perigo: true,
  });
  if (ok && executar(() => S.excluirVeiculo(v.id), "Veículo excluído."))
    location.hash = "#/veiculos";
}

// ---------------------------------------------------------------------------
// Ficha do veículo
// ---------------------------------------------------------------------------

function renderFicha(el, id) {
  const v = S.veiculo(id);
  if (!v) {
    el.innerHTML = `<div class="card">${estadoVazio("Veículo não encontrado. Ele pode ter sido excluído.", "truck")}<div class="center"><a class="btn btn-secondary" href="#/veiculos">Voltar para a listagem</a></div></div>`;
    return;
  }
  const s = S.db();
  const h = S.hoje();
  const solicitacoes = s.solicitacoes
    .filter((x) => x.veiculoId === v.id)
    .sort(
      (a, b) =>
        b.dataAbertura.localeCompare(a.dataAbertura) ||
        b.id.localeCompare(a.id),
    );
  const abastecimentos = s.abastecimentos
    .filter((a) => a.veiculoId === v.id)
    .sort((a, b) => b.data.localeCompare(a.data) || b.km - a.km);
  const instaladas = S.pecasInstaladas(v.id);
  const destinacoes = s.destinacoes
    .filter((d) => d.veiculoId === v.id)
    .sort((a, b) => b.data.localeCompare(a.data) || b.id.localeCompare(a.id));
  const podeVerDespesas = S.pode("despesas.consultar");
  const despesas = S.despesasAtivas()
    .filter((d) => d.veiculoId === v.id)
    .sort((a, b) => b.data.localeCompare(a.data));
  const consumo = S.consumo({ veiculoIds: new Set([v.id]) }).porVeiculo.get(
    v.id,
  );
  const ativas = solicitacoes.filter((x) =>
    ["aberta", "analise", "aguardando_pecas", "execucao"].includes(x.status),
  );
  const gasto90 = somar(
    despesas.filter((d) => d.data >= somarDias(h, -89)),
    (d) => d.valor,
  );

  const acoes = [
    botao({
      acao: "editar",
      texto: "Editar",
      icone: "pencil",
      permissao: "veiculos.gerenciar",
    }),
    botao({
      acao: "situacao",
      texto: "Alterar situação",
      icone: "swap",
      permissao: "veiculos.situacao",
    }),
    botao({
      acao: "solicitacao",
      texto: "Solicitação mecânica",
      icone: "wrench",
      permissao: "manutencao.solicitar",
    }),
    botao({
      acao: "abastecimento",
      texto: "Abastecimento",
      icone: "fuel",
      permissao: "abastecimento.registrar",
    }),
    botao({
      acao: "peca",
      texto: "Destinar peça",
      icone: "tire",
      permissao: "pecas.destinar",
    }),
    S.pode("veiculos.gerenciar")
      ? botao({
          acao: "excluir",
          texto: "Excluir",
          icone: "trash",
          variante: "ghost",
        })
      : "",
  ].join("");

  const abasLista = [
    { id: "manutencao", rotulo: "Manutenção", contador: solicitacoes.length },
    {
      id: "abastecimentos",
      rotulo: "Abastecimentos",
      contador: abastecimentos.length,
    },
    { id: "pecas", rotulo: "Peças instaladas", contador: instaladas.length },
    {
      id: "despesas",
      rotulo: "Despesas",
      contador: podeVerDespesas ? despesas.length : undefined,
    },
    { id: "historico", rotulo: "Histórico" },
  ];

  el.innerHTML = `
    <a href="#/veiculos" class="back-link">${icone("arrowLeft")}<span>Veículos</span></a>
    <section class="card vehicle-hero">
      <div class="vehicle-id">
        <span class="plate plate-lg">${esc(S.formatarPlaca(v.placa))}</span>
        <div>
          <h2>Frota ${esc(v.frota)} · ${esc(v.modelo)}</h2>
          <p>${esc(v.tipo)} · ${v.ano} · ${esc(v.combustivel)} · ${icone("pin")} ${esc(nomeCidade(v.cidade))}</p>
        </div>
        ${badge(SITUACOES_VEICULO, v.situacao)}
      </div>
      <div class="vehicle-actions">${acoes}</div>
    </section>
    <div class="kpi-grid kpi-grid-4">
      ${kpi({ rotulo: "Quilometragem atual", valor: fmt.km(v.km), detalhe: `Atualizada em ${fmt.data(v.kmAtualizadoEm)}`, ic: "road" })}
      ${kpi({ rotulo: "Consumo médio", valor: consumo ? fmt.kml(consumo.kml) : "—", detalhe: consumo ? `${consumo.trechos} trechos · ${fmt.km(consumo.dist)}` : "Dados insuficientes para cálculo", ic: "gauge" })}
      ${kpi({ rotulo: "Solicitações em aberto", valor: ativas.length, detalhe: ativas.length ? ativas.map((x) => x.id).join(", ") : "Nenhuma pendência", ic: "wrench", tom: ativas.length ? "warning" : "" })}
      ${kpi({ rotulo: "Gastos (90 dias)", valor: fmt.moeda(gasto90), detalhe: "Despesas associadas ao veículo", ic: "wallet", bloqueado: podeVerDespesas ? "" : `Visível para ${perfisAutorizados("despesas.consultar")}` })}
    </div>
    <section class="card">
      ${abas(abasLista, abaFicha)}
      <div class="card-body" id="ficha-aba"></div>
    </section>`;

  const desenharAba = () => {
    const alvo = el.querySelector("#ficha-aba");
    if (abaFicha === "manutencao") {
      alvo.innerHTML = tabela({
        colunas: [
          {
            titulo: "Nº",
            render: (x) => `<span class="mono">${x.id}</span>`,
            classe: "nowrap",
          },
          {
            titulo: "Abertura",
            render: (x) => fmt.data(x.dataAbertura),
            classe: "nowrap",
          },
          { titulo: "Problema", render: (x) => esc(x.descricao) },
          {
            titulo: "Prioridade",
            render: (x) => badge(PRIORIDADES, x.prioridade),
          },
          {
            titulo: "OS",
            render: (x) => {
              const os = S.osDaSolicitacao(x.id);
              return os ? `${os.id} ${badge(STATUS_OS, os.status)}` : "—";
            },
          },
          {
            titulo: "Status",
            render: (x) => badge(STATUS_SOLICITACAO, x.status),
          },
        ],
        linhas: solicitacoes,
        linhaAttrs: (x) =>
          `class="is-clickable" data-acao="ver-sm" data-id="${x.id}" tabindex="0"`,
        vazio: "Nenhuma solicitação mecânica registrada para este veículo.",
      });
    } else if (abaFicha === "abastecimentos") {
      const ord = [...abastecimentos].reverse();
      const trecho = new Map();
      ord.forEach((a, i) => {
        if (i === 0) return;
        const d = a.km - ord[i - 1].km;
        if (d > 0) trecho.set(a.id, d / a.litros);
      });
      alvo.innerHTML = `
        <div class="summary-row">
          <span>Abastecimentos: <strong>${abastecimentos.length}</strong></span>
          <span>Litros: <strong>${fmt.litros(somar(abastecimentos, (a) => a.litros))}</strong></span>
          <span>Valor: <strong>${fmt.moeda(somar(abastecimentos, (a) => a.valorTotal))}</strong></span>
          <span>Consumo médio: <strong>${consumo ? fmt.kml(consumo.kml) : "—"}</strong></span>
        </div>
        ${tabela({
          colunas: [
            {
              titulo: "Data",
              render: (a) => fmt.data(a.data),
              classe: "nowrap",
            },
            { titulo: "Km", render: (a) => fmt.km(a.km), classe: "num nowrap" },
            {
              titulo: "Litros",
              render: (a) => fmt.numero(a.litros, 1),
              classe: "num",
            },
            {
              titulo: "R$/L",
              render: (a) => fmt.numero(a.precoLitro, 2),
              classe: "num",
            },
            {
              titulo: "Total",
              render: (a) => fmt.moeda(a.valorTotal),
              classe: "num nowrap",
            },
            {
              titulo: "Consumo do trecho",
              render: (a) =>
                trecho.has(a.id)
                  ? fmt.kml(trecho.get(a.id))
                  : '<span class="muted">sem leitura anterior</span>',
              classe: "num nowrap",
            },
            {
              titulo: "Posto",
              render: (a) =>
                `${esc(a.posto)}<small class="cell-sub">${esc(nomeCidade(a.cidade))}</small>`,
              classe: "hide-sm",
            },
            {
              titulo: "Responsável",
              render: (a) => esc(S.nomeUsuario(a.usuarioId)),
              classe: "hide-sm",
            },
          ],
          linhas: abastecimentos.slice(0, 40),
          vazio: "Nenhum abastecimento registrado.",
        })}
        ${abastecimentos.length > 40 ? `<p class="muted small">Exibindo os 40 abastecimentos mais recentes. Consulte o histórico completo em Relatórios.</p>` : ""}`;
    } else if (abaFicha === "pecas") {
      alvo.innerHTML = `
        <h4 class="subhead">Pneus e baterias instalados (controle individual)</h4>
        ${tabela({
          colunas: [
            {
              titulo: "Identificador",
              render: (u) => `<span class="mono">${esc(u.serie)}</span>`,
            },
            {
              titulo: "Item",
              render: (u) => esc(S.material(u.materialId)?.nome),
            },
            { titulo: "Posição", render: (u) => esc(u.posicao || "—") },
            {
              titulo: "Instalado em",
              render: (u) => fmt.data(u.dataInstalacao),
              classe: "nowrap",
            },
          ],
          linhas: instaladas,
          vazio: "Nenhuma unidade rastreável instalada neste veículo.",
        })}
        <h4 class="subhead">Peças destinadas a este veículo</h4>
        ${tabela({
          colunas: [
            {
              titulo: "Data",
              render: (d) => fmt.data(d.data),
              classe: "nowrap",
            },
            { titulo: "Tipo", render: (d) => badge(TIPOS_DESTINACAO, d.tipo) },
            {
              titulo: "Peça",
              render: (d) =>
                `${esc(S.material(d.materialId)?.nome)}${d.unidadeIds.length ? `<small class="cell-sub mono">${d.unidadeIds.map((u) => esc(S.db().unidades.find((x) => x.id === u)?.serie)).join(", ")}</small>` : ""}`,
            },
            {
              titulo: "Qtd.",
              render: (d) =>
                `${fmt.numero(d.quantidade, d.quantidade % 1 ? 1 : 0)} ${esc(S.material(d.materialId)?.unidade)}`,
              classe: "num nowrap",
            },
            {
              titulo: "Responsável",
              render: (d) => esc(S.nomeUsuario(d.usuarioId)),
            },
            {
              titulo: "Referência",
              render: (d) =>
                d.ref?.tipo === "os"
                  ? `<span class="mono">${d.ref.id}</span>`
                  : esc(d.observacao || "—"),
              classe: "hide-sm",
            },
          ],
          linhas: destinacoes,
          vazio: "Nenhuma peça destinada a este veículo.",
        })}`;
    } else if (abaFicha === "despesas") {
      alvo.innerHTML = podeVerDespesas
        ? `<div class="summary-row"><span>Total (todas as despesas ativas): <strong>${fmt.moeda(somar(despesas, (d) => d.valor))}</strong></span>${Object.entries(
            CATEGORIAS_DESPESA,
          )
            .map(([k, c]) => {
              const t = somar(
                despesas.filter((d) => d.categoria === k),
                (d) => d.valor,
              );
              return t
                ? `<span>${esc(c.label)}: <strong>${fmt.moeda(t)}</strong></span>`
                : "";
            })
            .join("")}</div>
          ${tabela({
            colunas: [
              {
                titulo: "Nº",
                render: (d) => `<span class="mono">${d.id}</span>`,
                classe: "nowrap",
              },
              {
                titulo: "Data",
                render: (d) => fmt.data(d.data),
                classe: "nowrap",
              },
              { titulo: "Descrição", render: (d) => esc(d.descricao) },
              {
                titulo: "Categoria",
                render: (d) => esc(CATEGORIAS_DESPESA[d.categoria].label),
              },
              {
                titulo: "Valor",
                render: (d) => fmt.moeda(d.valor),
                classe: "num nowrap",
              },
              {
                titulo: "Status",
                render: (d) => badge(STATUS_DESPESA, d.status),
              },
            ],
            linhas: despesas.slice(0, 50),
            vazio: "Nenhuma despesa associada a este veículo.",
          })}`
        : `<div class="restricted-inline">${icone("lock")}<p>As despesas do veículo são visíveis para ${esc(perfisAutorizados("despesas.consultar"))}.</p></div>`;
    } else {
      const leituras = S.leiturasKm(v.id).reverse().slice(0, 12);
      alvo.innerHTML = `
        <div class="grid-2">
          <div><h4 class="subhead">Eventos do cadastro</h4>${linhaDoTempo(v.historico)}</div>
          <div><h4 class="subhead">Últimas leituras de quilometragem</h4>
            ${tabela({
              colunas: [
                { titulo: "Data", render: (l) => fmt.data(l.data) },
                { titulo: "Km", render: (l) => fmt.km(l.km), classe: "num" },
                { titulo: "Origem", render: (l) => esc(l.origem) },
              ],
              linhas: leituras,
            })}
          </div>
        </div>`;
    }
  };

  el.onclick = (e) => {
    const b = e.target.closest("[data-acao], [data-aba]");
    if (!b) return;
    if (b.dataset.aba) {
      abaFicha = b.dataset.aba;
      el.querySelectorAll(".tab").forEach((t) => {
        t.classList.toggle("is-active", t.dataset.aba === abaFicha);
        t.setAttribute("aria-selected", String(t.dataset.aba === abaFicha));
      });
      desenharAba();
      return;
    }
    const acao = b.dataset.acao;
    if (acao === "editar") abrirFormulario(v.id);
    else if (acao === "situacao") abrirAlterarSituacao(v);
    else if (acao === "solicitacao") abrirNovaSolicitacao(v.id);
    else if (acao === "abastecimento") abrirNovoAbastecimento(v.id);
    else if (acao === "peca") abrirDestinacao({ veiculoId: v.id });
    else if (acao === "excluir") excluir(v);
    else if (acao === "ver-sm") abrirDetalheSolicitacao(b.dataset.id);
  };
  el.oninput = null;
  el.onchange = null;
  el.onkeydown = (e) => {
    if (e.key === "Enter" && e.target.dataset?.acao === "ver-sm")
      abrirDetalheSolicitacao(e.target.dataset.id);
  };
  desenharAba();
}

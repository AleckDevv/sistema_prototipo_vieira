// Peças por veículo: destinação de peças por placa, com usuário identificado pelo
// perfil ativo e controle individual de pneus e baterias (instalação e retirada).

import * as S from "../services/index.js";
import {
  TIPOS_DESTINACAO,
  CATEGORIAS_MATERIAL,
  DESTINOS_RETIRADA,
  POSICOES_PNEU,
  POSICOES_BATERIA,
  PERIODOS,
  nomeCidade,
} from "../constants.js";
import { PERFIS } from "../permissions.js";
import { esc, fmt, contem, intervaloPeriodo, noPeriodo } from "../utils.js";
import {
  badge,
  botao,
  abrirModal,
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
  avisoPermissao,
  estadoVazio,
  secao,
} from "../ui.js";
import { icone } from "../icons.js";

const filtros = {
  busca: "",
  cidade: "",
  tipo: "",
  categoria: "",
  periodo: "90d",
};
let veiculoConsulta = "";
let pagina = 1;

const qtd = (m, v) =>
  `${fmt.numero(v, ["L", "kg"].includes(m?.unidade) && v % 1 ? 1 : 0)} ${m?.unidade ?? ""}`;

export default {
  titulo: "Peças por veículo",
  descricao:
    "Destinação de peças por placa, com responsável identificado pelo perfil ativo.",
  render(el, rota, { navegacao }) {
    if (navegacao && rota.query.has("veiculo"))
      veiculoConsulta = rota.query.get("veiculo");
    const u = S.usuarioAtual();
    el.innerHTML = `
      <div class="page-toolbar">
        <div class="responsible">${icone("shield")}<span>Responsável pelos lançamentos: <strong>${esc(u.nome)}</strong> (${esc(PERFIS[u.perfil].label)}) — identificado automaticamente pelo perfil ativo.</span></div>
        <div class="page-actions">${botao({ acao: "destinar", texto: "Registrar destinação", icone: "plus", variante: "primary", permissao: "pecas.destinar" })}</div>
      </div>
      <div id="pec-consulta"></div>
      <div class="filters" role="search">
        <div class="filter filter-grow"><label for="pec-busca">Buscar</label><div class="input-icon">${icone("search")}<input id="pec-busca" type="search" placeholder="Placa, frota, peça ou identificador" value="${esc(filtros.busca)}" data-filtro="busca"></div></div>
        <div class="filter"><label for="pec-cidade">Cidade</label><select id="pec-cidade" data-filtro="cidade">${opcoesCidades(filtros.cidade)}</select></div>
        <div class="filter"><label for="pec-tipo">Tipo</label><select id="pec-tipo" data-filtro="tipo">${opcoesMapa(TIPOS_DESTINACAO, filtros.tipo, "Todos")}</select></div>
        <div class="filter"><label for="pec-cat">Categoria</label><select id="pec-cat" data-filtro="categoria">${opcoesMapa(CATEGORIAS_MATERIAL, filtros.categoria, "Todas")}</select></div>
        <div class="filter"><label for="pec-periodo">Período</label><select id="pec-periodo" data-filtro="periodo">${opcoes(
          Object.entries(PERIODOS)
            .filter(([k]) => k !== "personalizado")
            .map(([valor, texto]) => ({ valor, texto })),
          filtros.periodo,
        )}</select></div>
      </div>
      <div id="pec-resultado"></div>`;

    el.oninput = (e) => {
      if (e.target.dataset.filtro === "busca") {
        filtros.busca = e.target.value;
        pagina = 1;
        desenharLista(el);
      }
    };
    el.onchange = (e) => {
      const f = e.target.dataset.filtro;
      if (f === "veiculo-consulta") {
        veiculoConsulta = e.target.value;
        desenharConsulta(el);
      } else if (f && f !== "busca") {
        filtros[f] = e.target.value;
        pagina = 1;
        desenharLista(el);
      }
    };
    el.onclick = (e) => {
      const b = e.target.closest("[data-acao], [data-pagina]");
      if (!b) return;
      if (b.dataset.pagina) {
        pagina = Number(b.dataset.pagina);
        desenharLista(el);
        return;
      }
      if (b.dataset.acao === "destinar")
        abrirDestinacao({ veiculoId: veiculoConsulta });
      if (b.dataset.acao === "retirar") abrirRetirada(b.dataset.id);
    };
    desenharConsulta(el);
    desenharLista(el);
  },
};

function desenharConsulta(el) {
  const veiculos = S.veiculosOrdenados();
  const v = veiculoConsulta ? S.veiculo(veiculoConsulta) : null;
  let conteudo = `<p class="muted">Selecione uma placa para ver os pneus e baterias instalados e as últimas peças destinadas.</p>`;
  if (v) {
    const instaladas = S.pecasInstaladas(v.id).sort((a, b) =>
      a.posicao.localeCompare(b.posicao),
    );
    const ultimas = S.db()
      .destinacoes.filter((d) => d.veiculoId === v.id)
      .sort((a, b) => b.data.localeCompare(a.data) || b.id.localeCompare(a.id))
      .slice(0, 5);
    const podeRetirar = S.pode("pecas.destinar");
    conteudo = `
      <div class="grid-2">
        <div>
          <h4 class="subhead">Pneus e baterias instalados (${instaladas.length})</h4>
          ${
            instaladas.length
              ? `<ul class="unit-list">${instaladas
                  .map(
                    (u) =>
                      `<li><span class="unit-icon">${icone(S.material(u.materialId)?.categoria === "baterias" ? "battery" : "tire")}</span><span><strong class="mono">${esc(u.serie)}</strong><small>${esc(S.material(u.materialId)?.nome)} · ${esc(u.posicao || "posição não informada")} · desde ${fmt.data(u.dataInstalacao)}</small></span>${podeRetirar ? `<button type="button" class="btn btn-ghost btn-sm" data-acao="retirar" data-id="${u.id}">${icone("saida")}<span>Retirar</span></button>` : ""}</li>`,
                  )
                  .join("")}</ul>`
              : estadoVazio(
                  "Nenhuma unidade rastreável instalada neste veículo.",
                  "tire",
                )
          }
        </div>
        <div>
          <h4 class="subhead">Últimas destinações</h4>
          ${
            ultimas.length
              ? `<ul class="mini-list">${ultimas.map((d) => `<li><span>${fmt.data(d.data)}</span><span>${badge(TIPOS_DESTINACAO, d.tipo)} ${esc(S.material(d.materialId)?.nome)} · ${qtd(S.material(d.materialId), d.quantidade)}</span></li>`).join("")}</ul>`
              : estadoVazio("Nenhuma peça destinada a este veículo.", "package")
          }
          <a class="link small" href="#/veiculos/${v.id}?aba=pecas">Abrir ficha do veículo</a>
        </div>
      </div>`;
  }
  el.querySelector("#pec-consulta").innerHTML = secao(
    "Consulta por placa",
    conteudo,
    {
      acoes: `<div class="filter filter-inline"><label for="pec-veiculo" class="sr-only">Veículo</label><select id="pec-veiculo" data-filtro="veiculo-consulta">${opcoes(
        veiculos.map((x) => ({
          valor: x.id,
          texto: `${S.rotuloVeiculo(x)} — ${x.modelo}`,
        })),
        veiculoConsulta,
        "Selecione a placa",
      )}</select></div>`,
      descricao: v ? `${esc(v.modelo)} · ${esc(nomeCidade(v.cidade))}` : "",
    },
  );
}

function desenharLista(el) {
  const p = intervaloPeriodo(filtros.periodo, S.hoje());
  const s = S.db();
  const lista = [...s.destinacoes]
    .filter(
      (d) =>
        noPeriodo(d.data, p) &&
        (!filtros.cidade || d.cidade === filtros.cidade) &&
        (!filtros.tipo || d.tipo === filtros.tipo),
    )
    .filter(
      (d) =>
        !filtros.categoria ||
        S.material(d.materialId)?.categoria === filtros.categoria,
    )
    .filter((d) => {
      if (!filtros.busca) return true;
      const v = S.veiculo(d.veiculoId);
      const series = d.unidadeIds
        .map((u) => s.unidades.find((x) => x.id === u)?.serie)
        .join(" ");
      return contem(
        `${v?.placa} ${S.rotuloVeiculo(v)} ${S.material(d.materialId)?.nome} ${S.material(d.materialId)?.codigo} ${series}`,
        filtros.busca,
      );
    })
    .sort((a, b) => b.data.localeCompare(a.data) || b.id.localeCompare(a.id));
  const pag = paginar(lista, pagina, 15);
  pagina = pag.pagina;
  el.querySelector("#pec-resultado").innerHTML =
    `<div class="card card-flush">${tabela({
      colunas: [
        { titulo: "Data", render: (d) => fmt.data(d.data), classe: "nowrap" },
        {
          titulo: "Placa",
          render: (d) =>
            `<a class="link" href="#/veiculos/${d.veiculoId}?aba=pecas"><span class="plate plate-sm">${esc(S.formatarPlaca(S.veiculo(d.veiculoId)?.placa ?? ""))}</span></a><small class="cell-sub">Frota ${esc(S.veiculo(d.veiculoId)?.frota)}</small>`,
          classe: "nowrap",
        },
        {
          titulo: "Peça",
          render: (d) =>
            `${esc(S.material(d.materialId)?.nome)}${d.unidadeIds.length ? `<small class="cell-sub mono">${d.unidadeIds.map((u) => esc(s.unidades.find((x) => x.id === u)?.serie)).join(", ")}${d.posicao ? ` · ${esc(d.posicao)}` : ""}</small>` : ""}`,
        },
        {
          titulo: "Qtd.",
          render: (d) => qtd(S.material(d.materialId), d.quantidade),
          classe: "num nowrap",
        },
        { titulo: "Tipo", render: (d) => badge(TIPOS_DESTINACAO, d.tipo) },
        {
          titulo: "Cidade",
          render: (d) => esc(nomeCidade(d.cidade)),
          classe: "hide-sm",
        },
        {
          titulo: "Responsável",
          render: (d) => esc(S.nomeUsuario(d.usuarioId)),
          classe: "hide-sm",
        },
        {
          titulo: "Observação / referência",
          render: (d) =>
            `${d.ref?.tipo === "os" ? `<a class="link mono" href="#/manutencao/${d.ref.id}">${d.ref.id}</a> ` : ""}${esc(d.observacao)}${d.retiradas?.length && d.tipo !== "retirada" ? `<small class="cell-sub">Retirada: ${d.retiradas.map((r) => `${esc(s.unidades.find((x) => x.id === r.unidadeId)?.serie)} → ${esc(DESTINOS_RETIRADA[r.destino])}`).join(", ")}</small>` : ""}`,
          classe: "hide-sm",
        },
      ],
      linhas: pag.itens,
      vazio: "Nenhuma destinação encontrada com os filtros atuais.",
    })}${paginacao(pag)}</div>`;
}

// ---------------------------------------------------------------------------
// Formulário de destinação
// ---------------------------------------------------------------------------

function areaMaterial(material, veiculoId, tipo) {
  if (!material) return "";
  if (material.rastreavel) {
    const unidades = S.db().unidades.filter(
      (u) => u.materialId === material.id && u.status === "estoque",
    );
    const posicoes =
      material.categoria === "baterias" ? POSICOES_BATERIA : POSICOES_PNEU;
    const instaladas = veiculoId
      ? S.pecasInstaladas(veiculoId).filter(
          (u) => S.material(u.materialId)?.categoria === material.categoria,
        )
      : [];
    return `
      <fieldset class="field span-all" data-campo="unidadeIds">
        <legend>Unidades em estoque — selecione as que serão instaladas <span class="req">*</span></legend>
        <div class="check-grid">${unidades.map((u) => `<label class="check"><input type="checkbox" name="unidadeIds[]" value="${u.id}"> <span class="mono">${esc(u.serie)}</span></label>`).join("") || '<p class="muted small">Nenhuma unidade disponível em estoque.</p>'}</div>
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
      ${
        tipo === "substituicao"
          ? `<fieldset class="field span-all" data-campo="retirarUnidadeIds">
            <legend>Unidade retirada do veículo</legend>
            <div class="check-grid">${instaladas.map((u) => `<label class="check"><input type="checkbox" name="retirarUnidadeIds[]" value="${u.id}"> <span class="mono">${esc(u.serie)}</span> <small class="muted">${esc(u.posicao)}</small></label>`).join("") || '<p class="muted small">Nenhuma unidade deste tipo registrada no veículo.</p>'}</div>
            <small class="field-error" role="alert"></small>
          </fieldset>
          ${campo({
            rotulo: "Destino da unidade retirada",
            nome: "destinoRetirada",
            tipo: "select",
            opcoesHtml: opcoes(
              Object.entries(DESTINOS_RETIRADA).map(([valor, texto]) => ({
                valor,
                texto,
              })),
              "recapagem",
            ),
          })}`
          : ""
      }`;
  }
  const fr = ["L", "kg"].includes(material.unidade);
  return campo({
    rotulo: `Quantidade (${material.unidade})`,
    nome: "quantidade",
    tipo: "number",
    obrigatorio: true,
    attrs: `min="${fr ? "0.1" : "1"}" max="${S.saldo(material)}" step="${fr ? "0.1" : "1"}"`,
    ajuda: `Saldo disponível: ${qtd(material, S.saldo(material))}`,
  });
}

export function abrirDestinacao({ veiculoId = "" } = {}) {
  const u = S.usuarioAtual();
  const veiculos = S.veiculosOrdenados().filter(
    (v) => v.situacao !== "inativo",
  );
  const materiais = [...S.db().materiais].sort((a, b) =>
    a.nome.localeCompare(b.nome),
  );
  abrirModal({
    titulo: "Registrar destinação de peça",
    subtitulo: "Saída do estoque vinculada à placa do veículo.",
    tamanho: "lg",
    corpo: `
      ${avisoPermissao("pecas.destinar", "Destinação de peças")}
      <form class="form grid-form" novalidate>
        ${campo({
          rotulo: "Veículo (placa)",
          nome: "veiculoId",
          tipo: "select",
          obrigatorio: true,
          largura: "wide",
          opcoesHtml: opcoes(
            veiculos.map((v) => ({
              valor: v.id,
              texto: `${S.formatarPlaca(v.placa)} · Frota ${v.frota} — ${v.modelo}`,
            })),
            veiculoId,
            "Selecione a placa",
          ),
        })}
        ${campo({
          rotulo: "Tipo de movimentação",
          nome: "tipo",
          tipo: "select",
          obrigatorio: true,
          opcoesHtml: opcoes(
            [
              { valor: "instalacao", texto: "Instalação" },
              { valor: "substituicao", texto: "Substituição" },
              { valor: "reposicao", texto: "Reposição de consumo" },
            ],
            "instalacao",
          ),
        })}
        ${campo({
          rotulo: "Peça / material",
          nome: "materialId",
          tipo: "select",
          obrigatorio: true,
          largura: "full",
          opcoesHtml: opcoes(
            materiais.map((m) => ({
              valor: m.id,
              texto: `${m.codigo} · ${m.nome} — saldo ${qtd(m, S.saldo(m))}${m.rastreavel ? " · controle individual" : ""}`,
              desabilitado: S.saldo(m) <= 0,
            })),
            "",
            "Selecione a peça",
          ),
        })}
        <div class="span-all grid-form" data-area-material></div>
        ${campo({ rotulo: "Data", nome: "data", tipo: "date", valor: S.hoje(), obrigatorio: true, attrs: `max="${S.hoje()}"` })}
        ${campo({ rotulo: "Cidade / localidade", nome: "cidade", tipo: "select", obrigatorio: true, opcoesHtml: opcoesCidades(veiculoId ? S.veiculo(veiculoId)?.cidade : "", "Selecione") })}
        ${campo({ rotulo: "Usuário responsável", nome: "responsavelInfo", valor: `${u.nome} — ${PERFIS[u.perfil].label}`, somenteLeitura: true, ajuda: "Preenchido automaticamente pelo perfil ativo." })}
        ${campo({ rotulo: "Observação", nome: "observacao", tipo: "textarea", largura: "full", attrs: 'rows="2" maxlength="300"' })}
      </form>`,
    rodape: `<button type="button" class="btn btn-ghost" data-fechar-modal>Cancelar</button><button type="button" class="btn btn-primary" data-salvar ${S.pode("pecas.destinar") ? "" : "disabled"}>Registrar destinação</button>`,
    aoMontar(modal, ctrl) {
      const form = modal.querySelector("form");
      const area = form.querySelector("[data-area-material]");
      const atualizarArea = () => {
        area.innerHTML = areaMaterial(
          S.material(form.materialId.value),
          form.veiculoId.value,
          form.tipo.value,
        );
      };
      form.materialId.addEventListener("change", atualizarArea);
      form.tipo.addEventListener("change", atualizarArea);
      form.veiculoId.addEventListener("change", () => {
        const v = S.veiculo(form.veiculoId.value);
        if (v) form.cidade.value = v.cidade;
        atualizarArea();
      });
      const salvar = (e) => {
        e?.preventDefault();
        const material = S.material(form.materialId.value);
        const ok = validarFormulario(form, (d) => {
          const erros = {};
          if (material?.rastreavel && !(d.unidadeIds ?? []).length)
            erros.unidadeIds = "Selecione ao menos uma unidade.";
          if (
            material &&
            !material.rastreavel &&
            Number(d.quantidade) > S.saldo(material)
          )
            erros.quantidade = `Saldo insuficiente (${qtd(material, S.saldo(material))}).`;
          return erros;
        });
        if (!ok) return;
        const d = dadosFormulario(form);
        const r = executar(
          () =>
            S.destinarPeca({
              ...d,
              unidadeIds: d.unidadeIds ?? [],
              retirarUnidadeIds: d.retirarUnidadeIds ?? [],
              quantidade: d.quantidade ?? 1,
            }),
          (x) =>
            `Destinação ${x.id} registrada para a placa ${S.formatarPlaca(S.veiculo(x.veiculoId).placa)}. Estoque atualizado.`,
        );
        if (r) ctrl.fechar();
      };
      form.addEventListener("submit", salvar);
      modal.querySelector("[data-salvar]").addEventListener("click", salvar);
      if (veiculoId) atualizarArea();
    },
  });
}

function abrirRetirada(unidadeId) {
  const un = S.db().unidades.find((x) => x.id === unidadeId);
  const v = S.veiculo(un.veiculoId);
  const u = S.usuarioAtual();
  abrirModal({
    titulo: `Retirar unidade ${esc(un.serie)}`,
    subtitulo: esc(
      `${S.rotuloVeiculo(v)} · ${un.posicao || "posição não informada"}`,
    ),
    tamanho: "sm",
    corpo: `
      <form class="form" novalidate>
        ${campo({
          rotulo: "Destino",
          nome: "destino",
          tipo: "select",
          obrigatorio: true,
          opcoesHtml: opcoes(
            Object.entries(DESTINOS_RETIRADA).map(([valor, texto]) => ({
              valor,
              texto,
            })),
            "",
            "Selecione",
          ),
        })}
        ${campo({ rotulo: "Data", nome: "data", tipo: "date", valor: S.hoje(), obrigatorio: true, attrs: `max="${S.hoje()}"` })}
        ${campo({ rotulo: "Responsável", nome: "resp", valor: u.nome, somenteLeitura: true })}
        ${campo({ rotulo: "Observação", nome: "observacao", tipo: "textarea", attrs: 'rows="2" maxlength="200"' })}
      </form>`,
    rodape: `<button type="button" class="btn btn-ghost" data-fechar-modal>Cancelar</button><button type="button" class="btn btn-primary" data-salvar>Registrar retirada</button>`,
    aoMontar(modal, ctrl) {
      const form = modal.querySelector("form");
      const salvar = (e) => {
        e?.preventDefault();
        if (!validarFormulario(form)) return;
        const d = dadosFormulario(form);
        if (
          executar(
            () =>
              S.registrarRetirada({
                unidadeId,
                destino: d.destino,
                data: d.data,
                cidade: v.cidade,
                observacao: d.observacao,
              }),
            "Retirada registrada.",
          )
        )
          ctrl.fechar();
      };
      form.addEventListener("submit", salvar);
      modal.querySelector("[data-salvar]").addEventListener("click", salvar);
    },
  });
}

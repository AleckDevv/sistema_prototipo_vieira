// Abastecimento e quilometragem: registros, consumo médio (km/l) e gastos com combustível.

import * as S from "../services/index.js";
import { CIDADES, POSTOS, PERIODOS, nomeCidade } from "../constants.js";
import { PERFIS } from "../permissions.js";
import {
  esc,
  fmt,
  somar,
  arred,
  intervaloPeriodo,
  noPeriodo,
  diasEntre,
} from "../utils.js";
import {
  botao,
  abrirModal,
  executar,
  campo,
  opcoes,
  opcoesCidades,
  dadosFormulario,
  validarFormulario,
  tabela,
  paginar,
  paginacao,
  abas,
  kpi,
  secao,
  avisoPermissao,
  badgeTexto,
} from "../ui.js";
import { barrasHorizontais, colunas } from "../charts.js";
import { icone } from "../icons.js";

const filtros = { cidade: "", veiculo: "", periodo: "90d", de: "", ate: "" };
let aba = "registros";
let pagina = 1;

export default {
  titulo: "Abastecimento e quilometragem",
  descricao:
    "Registros de abastecimento, leituras de hodômetro, consumo médio e gastos com combustível.",
  render(el, rota, { navegacao }) {
    if (navegacao) {
      if (rota.query.has("aba")) aba = rota.query.get("aba");
      if (rota.query.has("veiculo"))
        filtros.veiculo = rota.query.get("veiculo");
      pagina = 1;
    }
    el.innerHTML = `
      <div class="filters" role="search">
        <div class="filter"><label for="ab-cidade">Cidade</label><select id="ab-cidade" data-filtro="cidade">${opcoesCidades(filtros.cidade)}</select></div>
        <div class="filter filter-grow"><label for="ab-veiculo">Veículo</label><select id="ab-veiculo" data-filtro="veiculo">${opcoes(
          S.veiculosOrdenados().map((v) => ({
            valor: v.id,
            texto: `${S.rotuloVeiculo(v)} — ${v.modelo}`,
          })),
          filtros.veiculo,
          "Todos os veículos",
        )}</select></div>
        <div class="filter"><label for="ab-periodo">Período</label><select id="ab-periodo" data-filtro="periodo">${opcoes(
          Object.entries(PERIODOS).map(([valor, texto]) => ({ valor, texto })),
          filtros.periodo,
        )}</select></div>
        <div class="filter ${filtros.periodo === "personalizado" ? "" : "is-hidden"}" data-custom><label for="ab-de">De</label><input id="ab-de" type="date" value="${filtros.de}" data-filtro="de"></div>
        <div class="filter ${filtros.periodo === "personalizado" ? "" : "is-hidden"}" data-custom><label for="ab-ate">Até</label><input id="ab-ate" type="date" value="${filtros.ate}" data-filtro="ate"></div>
      </div>
      <div id="ab-kpis"></div>
      <div class="page-toolbar">
        ${abas(
          [
            { id: "registros", rotulo: "Abastecimentos" },
            { id: "consumo", rotulo: "Consumo por veículo" },
            { id: "gastos", rotulo: "Gastos por cidade e período" },
            { id: "leituras", rotulo: "Quilometragem" },
          ],
          aba,
        )}
        <div class="page-actions">
          ${botao({ acao: "leitura", texto: "Registrar quilometragem", icone: "road", permissao: "abastecimento.registrar" })}
          ${botao({ acao: "abastecer", texto: "Registrar abastecimento", icone: "plus", variante: "primary", permissao: "abastecimento.registrar" })}
        </div>
      </div>
      <div id="ab-conteudo"></div>`;

    el.onchange = (e) => {
      const f = e.target.dataset.filtro;
      if (!f) return;
      filtros[f] = e.target.value;
      if (f === "periodo")
        el.querySelectorAll("[data-custom]").forEach((x) =>
          x.classList.toggle("is-hidden", filtros.periodo !== "personalizado"),
        );
      pagina = 1;
      desenhar(el);
    };
    el.onclick = (e) => {
      const b = e.target.closest("[data-aba], [data-acao], [data-pagina]");
      if (!b) return;
      if (b.dataset.aba) {
        aba = b.dataset.aba;
        el.querySelectorAll(".tab").forEach((t) => {
          t.classList.toggle("is-active", t.dataset.aba === aba);
          t.setAttribute("aria-selected", String(t.dataset.aba === aba));
        });
        pagina = 1;
        desenhar(el);
        return;
      }
      if (b.dataset.pagina) {
        pagina = Number(b.dataset.pagina);
        desenhar(el);
        return;
      }
      if (b.dataset.acao === "abastecer")
        abrirNovoAbastecimento(filtros.veiculo);
      if (b.dataset.acao === "leitura") abrirLeitura(filtros.veiculo);
    };
    el.oninput = null;
    el.onkeydown = null;
    desenhar(el);
  },
};

function contexto() {
  const s = S.db();
  const periodo = intervaloPeriodo(
    filtros.periodo,
    S.hoje(),
    filtros.de,
    filtros.ate,
  );
  const veiculos = s.veiculos.filter(
    (v) =>
      (!filtros.cidade || v.cidade === filtros.cidade) &&
      (!filtros.veiculo || v.id === filtros.veiculo),
  );
  const ids = new Set(veiculos.map((v) => v.id));
  const abastecimentos = s.abastecimentos.filter(
    (a) => ids.has(a.veiculoId) && noPeriodo(a.data, periodo),
  );
  return { s, periodo, veiculos, ids, abastecimentos };
}

function desenhar(el) {
  const { s, periodo, veiculos, ids, abastecimentos } = contexto();
  const consumo = S.consumo({ veiculoIds: ids, periodo });
  const litros = somar(abastecimentos, (a) => a.litros);
  const valor = somar(abastecimentos, (a) => a.valorTotal);
  el.querySelector("#ab-kpis").innerHTML = `<div class="kpi-grid kpi-grid-4">
    ${kpi({ rotulo: "Litros abastecidos", valor: fmt.litros(litros), detalhe: `${abastecimentos.length} abastecimento(s)`, ic: "fuel" })}
    ${kpi({ rotulo: "Gasto com combustível", valor: fmt.moeda(valor), detalhe: filtros.cidade ? `Veículos de ${nomeCidade(filtros.cidade)}` : "Toda a frota filtrada", ic: "wallet" })}
    ${kpi({ rotulo: "Consumo médio", valor: consumo.kml ? fmt.kml(consumo.kml) : "—", detalhe: consumo.kml ? `${consumo.trechos} trechos válidos · ${fmt.km(consumo.dist)}` : "Dados insuficientes no período", ic: "gauge" })}
    ${kpi({ rotulo: "Preço médio por litro", valor: litros ? fmt.moeda(valor / litros) : "—", detalhe: "Média ponderada pelos litros", ic: "receipt" })}
  </div>`;

  const alvo = el.querySelector("#ab-conteudo");
  if (aba === "consumo") {
    const ref = S.consumoReferenciaPorTipo(periodo);
    const linhas = veiculos
      .map((v) => {
        const c = consumo.porVeiculo.get(v.id);
        const lista = abastecimentos.filter((a) => a.veiculoId === v.id);
        const base = ref.get(v.tipo);
        return {
          v,
          c,
          n: lista.length,
          gasto: somar(lista, (a) => a.valorTotal),
          base,
          variacao: c && base ? (c.kml / base - 1) * 100 : null,
        };
      })
      .sort((a, b) => (a.variacao ?? 999) - (b.variacao ?? 999));
    alvo.innerHTML = `
      <div class="notice notice-muted">${icone("info")}<span>Consumo calculado pelo método de tanque cheio: distância entre leituras consecutivas dividida pelos litros do abastecimento seguinte. Trechos com quilometragem regressiva ou sem leitura anterior são descartados.</span></div>
      <div class="card card-flush">${tabela({
        colunas: [
          {
            titulo: "Veículo",
            render: (l) =>
              `<a class="link" href="#/veiculos/${l.v.id}?aba=abastecimentos">${esc(S.rotuloVeiculo(l.v))}</a><small class="cell-sub">${esc(l.v.modelo)}</small>`,
            classe: "nowrap",
          },
          { titulo: "Tipo", render: (l) => esc(l.v.tipo), classe: "hide-sm" },
          {
            titulo: "Cidade",
            render: (l) => esc(nomeCidade(l.v.cidade)),
            classe: "hide-sm",
          },
          { titulo: "Abastec.", render: (l) => l.n, classe: "num" },
          {
            titulo: "Km válidos",
            render: (l) => (l.c ? fmt.numero(l.c.dist) : "—"),
            classe: "num nowrap hide-sm",
          },
          {
            titulo: "Litros válidos",
            render: (l) => (l.c ? fmt.numero(l.c.litros, 1) : "—"),
            classe: "num nowrap hide-sm",
          },
          {
            titulo: "Consumo médio",
            render: (l) =>
              l.c
                ? `<strong>${fmt.kml(l.c.kml)}</strong>`
                : '<span class="muted">Dados insuficientes</span>',
            classe: "num nowrap",
          },
          {
            titulo: "Referência do tipo",
            render: (l) => (l.base ? fmt.kml(l.base) : "—"),
            classe: "num nowrap hide-sm",
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
            classe: "num",
          },
          {
            titulo: "Gasto",
            render: (l) => fmt.moeda(l.gasto),
            classe: "num nowrap",
          },
        ],
        linhas,
        vazio: "Nenhum veículo para os filtros selecionados.",
      })}</div>`;
    return;
  }
  if (aba === "gastos") {
    const porCidade = CIDADES.map((c) => {
      const lista = abastecimentos.filter((a) => a.cidade === c.id);
      return {
        rotulo: c.nome,
        valor: somar(lista, (a) => a.valorTotal),
        litros: somar(lista, (a) => a.litros),
        n: lista.length,
      };
    });
    const meses = [
      ...new Set(abastecimentos.map((a) => a.data.slice(0, 7))),
    ].sort();
    const porMes = meses.map((m) => ({
      rotulo: fmt.mes(m),
      valor: somar(
        abastecimentos.filter((a) => a.data.startsWith(m)),
        (a) => a.valorTotal,
      ),
    }));
    alvo.innerHTML = `
      <div class="grid-2">
        ${secao("Gasto com combustível por cidade do abastecimento", barrasHorizontais([...porCidade].sort((a, b) => b.valor - a.valor)), { descricao: "Cidade onde o abastecimento foi realizado" })}
        ${secao("Gasto mensal com combustível", colunas(porMes), { descricao: "Meses do período selecionado (meses parciais incluídos)" })}
      </div>
      ${secao(
        "Gastos por cidade e mês",
        tabela({
          colunas: [
            {
              titulo: "Cidade",
              render: (l) => `<strong>${esc(l.rotulo)}</strong>`,
            },
            ...meses.map((m) => ({
              titulo: fmt.mes(m),
              render: (l) => fmt.moeda(l.meses[m] ?? 0),
              classe: "num nowrap",
            })),
            {
              titulo: "Litros",
              render: (l) => fmt.numero(l.litros, 1),
              classe: "num nowrap",
            },
            {
              titulo: "Preço médio/L",
              render: (l) => (l.litros ? fmt.moeda(l.valor / l.litros) : "—"),
              classe: "num nowrap",
            },
            {
              titulo: "Total",
              render: (l) => `<strong>${fmt.moeda(l.valor)}</strong>`,
              classe: "num nowrap",
            },
          ],
          linhas: porCidade.map((c, i) => ({
            ...c,
            meses: Object.fromEntries(
              meses.map((m) => [
                m,
                somar(
                  abastecimentos.filter(
                    (a) => a.cidade === CIDADES[i].id && a.data.startsWith(m),
                  ),
                  (a) => a.valorTotal,
                ),
              ]),
            ),
          })),
          rodape: `<tr><td><strong>Total</strong></td>${meses.map((m) => `<td class="num"><strong>${fmt.moeda(porMes.find((x) => x.rotulo === fmt.mes(m)).valor)}</strong></td>`).join("")}<td class="num"><strong>${fmt.numero(
            somar(porCidade, (c) => c.litros),
            1,
          )}</strong></td><td></td><td class="num"><strong>${fmt.moeda(somar(porCidade, (c) => c.valor))}</strong></td></tr>`,
        }),
      )}`;
    return;
  }
  if (aba === "leituras") {
    const h = S.hoje();
    const frota = [...veiculos]
      .filter((v) => v.situacao !== "inativo")
      .sort((a, b) => a.kmAtualizadoEm.localeCompare(b.kmAtualizadoEm));
    const leituras = s.leituras
      .filter((l) => ids.has(l.veiculoId) && noPeriodo(l.data, periodo))
      .sort((a, b) => b.data.localeCompare(a.data));
    alvo.innerHTML = `
      <div class="grid-2">
        ${secao(
          "Quilometragem atual da frota",
          tabela({
            colunas: [
              {
                titulo: "Veículo",
                render: (v) =>
                  `<a class="link" href="#/veiculos/${v.id}">${esc(S.rotuloVeiculo(v))}</a>`,
                classe: "nowrap",
              },
              {
                titulo: "Km atual",
                render: (v) => fmt.km(v.km),
                classe: "num nowrap",
              },
              {
                titulo: "Última leitura",
                render: (v) => {
                  const d = diasEntre(v.kmAtualizadoEm, h);
                  return `${fmt.data(v.kmAtualizadoEm)}${d > 15 ? ` ${badgeTexto(`há ${d} dias`, "warning")}` : ""}`;
                },
                classe: "nowrap",
              },
            ],
            linhas: frota,
          }),
          {
            descricao:
              "Ordenado pela leitura mais antiga. Veículos inativos não aparecem.",
          },
        )}
        ${secao(
          "Leituras de hodômetro avulsas",
          tabela({
            colunas: [
              {
                titulo: "Data",
                render: (l) => fmt.data(l.data),
                classe: "nowrap",
              },
              {
                titulo: "Veículo",
                render: (l) => esc(S.rotuloVeiculo(l.veiculoId)),
                classe: "nowrap",
              },
              {
                titulo: "Km",
                render: (l) => fmt.km(l.km),
                classe: "num nowrap",
              },
              {
                titulo: "Responsável",
                render: (l) =>
                  `${esc(S.nomeUsuario(l.usuarioId))}${l.observacao ? `<small class="cell-sub">${esc(l.observacao)}</small>` : ""}`,
              },
            ],
            linhas: leituras,
            vazio: "Nenhuma leitura avulsa no período.",
          }),
          { descricao: "Leituras sem abastecimento (ex.: entrada na oficina)" },
        )}
      </div>`;
    return;
  }

  const lista = [...abastecimentos].sort(
    (a, b) => b.data.localeCompare(a.data) || b.id.localeCompare(a.id),
  );
  const pag = paginar(lista, pagina, 15);
  pagina = pag.pagina;
  alvo.innerHTML = `<div class="card card-flush">${tabela({
    colunas: [
      { titulo: "Data", render: (a) => fmt.data(a.data), classe: "nowrap" },
      {
        titulo: "Veículo",
        render: (a) =>
          `<a class="link" href="#/veiculos/${a.veiculoId}?aba=abastecimentos">${esc(S.rotuloVeiculo(a.veiculoId))}</a>`,
        classe: "nowrap",
      },
      {
        titulo: "Cidade",
        render: (a) => esc(nomeCidade(a.cidade)),
        classe: "hide-sm",
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
        classe: "num hide-sm",
      },
      {
        titulo: "Total",
        render: (a) => fmt.moeda(a.valorTotal),
        classe: "num nowrap",
      },
      { titulo: "Posto", render: (a) => esc(a.posto), classe: "hide-sm" },
      {
        titulo: "Responsável",
        render: (a) => esc(S.nomeUsuario(a.usuarioId)),
        classe: "hide-sm",
      },
    ],
    linhas: pag.itens,
    vazio: "Nenhum abastecimento no período e filtros selecionados.",
  })}${paginacao(pag)}</div>`;
}

// ---------------------------------------------------------------------------
// Formulários
// ---------------------------------------------------------------------------

function ultimaLeituraTexto(veiculoId, data) {
  if (!veiculoId) return "Selecione o veículo para ver a última leitura.";
  const anteriores = S.leiturasKm(veiculoId).filter(
    (l) => !data || l.data <= data,
  );
  const ult = anteriores[anteriores.length - 1];
  return ult
    ? `Última leitura: <strong>${fmt.km(Math.max(...anteriores.map((l) => l.km)))}</strong> em ${fmt.data(ult.data)} (${esc(ult.origem.toLowerCase())}).`
    : "Sem leituras anteriores.";
}

export function abrirNovoAbastecimento(veiculoId = "") {
  const u = S.usuarioAtual();
  const veiculos = S.veiculosOrdenados().filter(
    (v) => v.situacao !== "inativo",
  );
  abrirModal({
    titulo: "Registrar abastecimento",
    subtitulo:
      "O valor total é calculado automaticamente e a despesa de combustível é lançada para conferência do financeiro.",
    tamanho: "md",
    corpo: `
      ${avisoPermissao("abastecimento.registrar", "Registro de abastecimento")}
      <form class="form grid-form" novalidate>
        ${campo({
          rotulo: "Veículo (placa)",
          nome: "veiculoId",
          tipo: "select",
          obrigatorio: true,
          largura: "full",
          opcoesHtml: opcoes(
            veiculos.map((v) => ({
              valor: v.id,
              texto: `${S.rotuloVeiculo(v)} — ${v.modelo} (${v.combustivel})`,
            })),
            veiculoId,
            "Selecione o veículo",
          ),
        })}
        ${campo({ rotulo: "Cidade", nome: "cidade", tipo: "select", obrigatorio: true, opcoesHtml: opcoesCidades(S.veiculo(veiculoId)?.cidade ?? "", "Selecione") })}
        ${campo({ rotulo: "Data", nome: "data", tipo: "date", valor: S.hoje(), obrigatorio: true, attrs: `max="${S.hoje()}"` })}
        ${campo({ rotulo: "Quilometragem (hodômetro)", nome: "km", tipo: "number", obrigatorio: true, largura: "full", attrs: 'min="1" step="1"', ajuda: `<span data-ultima>${ultimaLeituraTexto(veiculoId, S.hoje())}</span>` })}
        ${campo({ rotulo: "Litros abastecidos", nome: "litros", tipo: "number", obrigatorio: true, attrs: 'min="0.1" max="1500" step="0.01"' })}
        ${campo({ rotulo: "Preço por litro (R$)", nome: "precoLitro", tipo: "number", obrigatorio: true, attrs: 'min="1" max="30" step="0.001"' })}
        ${campo({ rotulo: "Valor total (R$)", nome: "valorTotal", valor: "", somenteLeitura: true, ajuda: "Litros × preço por litro." })}
        ${campo({ rotulo: "Posto ou fornecedor", nome: "posto", obrigatorio: true, attrs: 'list="lista-postos" minlength="2" maxlength="80" placeholder="Posto fictício"' })}
        <datalist id="lista-postos">${POSTOS.map((p) => `<option value="${esc(p)}">`).join("")}</datalist>
        ${campo({ rotulo: "Usuário responsável", nome: "resp", valor: `${u.nome} — ${PERFIS[u.perfil].label}`, somenteLeitura: true })}
        <p class="span-all calc-preview" data-previa></p>
      </form>`,
    rodape: `<button type="button" class="btn btn-ghost" data-fechar-modal>Cancelar</button><button type="button" class="btn btn-primary" data-salvar ${S.pode("abastecimento.registrar") ? "" : "disabled"}>Registrar abastecimento</button>`,
    aoMontar(modal, ctrl) {
      const form = modal.querySelector("form");
      const previa = form.querySelector("[data-previa]");
      const calcular = () => {
        const litros = Number(form.litros.value);
        const preco = Number(form.precoLitro.value);
        form.valorTotal.value =
          litros > 0 && preco > 0 ? fmt.moeda(arred(litros * preco)) : "";
        form.querySelector("[data-ultima]").innerHTML = ultimaLeituraTexto(
          form.veiculoId.value,
          form.data.value,
        );
        const km = Number(form.km.value);
        previa.className = "span-all calc-preview";
        previa.textContent = "";
        if (!form.veiculoId.value || !km) return;
        const anteriores = S.leiturasKm(form.veiculoId.value).filter(
          (l) => l.data <= form.data.value,
        );
        const maior = anteriores.length
          ? Math.max(...anteriores.map((l) => l.km))
          : 0;
        if (km <= maior) {
          previa.classList.add("is-error");
          previa.textContent = `Quilometragem regressiva: informe um valor maior que ${fmt.km(maior)}. O consumo não é calculado com leituras regressivas.`;
          return;
        }
        const ultimoAbast = S.db()
          .abastecimentos.filter(
            (a) =>
              a.veiculoId === form.veiculoId.value && a.data <= form.data.value,
          )
          .sort((a, b) => b.km - a.km)[0];
        if (ultimoAbast && litros > 0) {
          const dist = km - ultimoAbast.km;
          previa.textContent = `Distância desde o último abastecimento: ${fmt.km(dist)} · consumo estimado deste trecho: ${fmt.kml(dist / litros)}.`;
        } else {
          previa.textContent =
            "Primeiro abastecimento registrado para este veículo: o consumo será calculado a partir do próximo.";
        }
      };
      form.addEventListener("input", calcular);
      form.veiculoId.addEventListener("change", () => {
        const v = S.veiculo(form.veiculoId.value);
        if (v) form.cidade.value = v.cidade;
        calcular();
      });
      const salvar = (e) => {
        e?.preventDefault();
        if (!validarFormulario(form)) return;
        const d = dadosFormulario(form);
        const r = executar(
          () => S.registrarAbastecimento(d),
          (a) =>
            `Abastecimento registrado: ${fmt.moeda(a.valorTotal)}. Histórico do veículo e despesas atualizados.`,
        );
        if (r) ctrl.fechar();
      };
      form.addEventListener("submit", salvar);
      modal.querySelector("[data-salvar]").addEventListener("click", salvar);
      calcular();
    },
  });
}

function abrirLeitura(veiculoId = "") {
  const veiculos = S.veiculosOrdenados().filter(
    (v) => v.situacao !== "inativo",
  );
  abrirModal({
    titulo: "Registrar quilometragem",
    subtitulo:
      "Leitura de hodômetro sem abastecimento (ex.: entrada na oficina, inspeção).",
    tamanho: "sm",
    corpo: `
      ${avisoPermissao("abastecimento.registrar", "Registro de quilometragem")}
      <form class="form" novalidate>
        ${campo({
          rotulo: "Veículo",
          nome: "veiculoId",
          tipo: "select",
          obrigatorio: true,
          opcoesHtml: opcoes(
            veiculos.map((v) => ({
              valor: v.id,
              texto: `${S.rotuloVeiculo(v)} — ${v.modelo}`,
            })),
            veiculoId,
            "Selecione",
          ),
        })}
        ${campo({ rotulo: "Data", nome: "data", tipo: "date", valor: S.hoje(), obrigatorio: true, attrs: `max="${S.hoje()}"` })}
        ${campo({ rotulo: "Quilometragem", nome: "km", tipo: "number", obrigatorio: true, attrs: 'min="1" step="1"', ajuda: `<span data-ultima>${ultimaLeituraTexto(veiculoId, S.hoje())}</span>` })}
        ${campo({ rotulo: "Observação", nome: "observacao", attrs: 'maxlength="120"' })}
      </form>`,
    rodape: `<button type="button" class="btn btn-ghost" data-fechar-modal>Cancelar</button><button type="button" class="btn btn-primary" data-salvar ${S.pode("abastecimento.registrar") ? "" : "disabled"}>Registrar leitura</button>`,
    aoMontar(modal, ctrl) {
      const form = modal.querySelector("form");
      const info = () => {
        form.querySelector("[data-ultima]").innerHTML = ultimaLeituraTexto(
          form.veiculoId.value,
          form.data.value,
        );
      };
      form.veiculoId.addEventListener("change", info);
      form.data.addEventListener("change", info);
      const salvar = (e) => {
        e?.preventDefault();
        if (!validarFormulario(form)) return;
        if (
          executar(
            () => S.registrarLeituraKm(dadosFormulario(form)),
            "Quilometragem registrada.",
          )
        )
          ctrl.fechar();
      };
      form.addEventListener("submit", salvar);
      modal.querySelector("[data-salvar]").addEventListener("click", salvar);
    },
  });
}

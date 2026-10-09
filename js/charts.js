// Gráficos discretos: uma cor por série, marcas finas, valores em texto e
// grade em linhas finas. Todos os valores também aparecem nas tabelas/relatórios.

import { esc, fmt } from "./utils.js";
import { estadoVazio } from "./ui.js";

/** Barras horizontais (uma série) com o valor ao final de cada barra. */
export function barrasHorizontais(
  itens,
  {
    formatar = fmt.moeda,
    vazio = "Sem dados para os filtros selecionados.",
  } = {},
) {
  const validos = itens.filter((i) => i.valor > 0);
  if (!validos.length) return estadoVazio(vazio, "chart");
  const max = Math.max(...validos.map((i) => i.valor));
  const total = validos.reduce((t, i) => t + i.valor, 0);
  return `<ul class="hbar-list">${validos
    .map((i) => {
      const pct = Math.max(1.5, (i.valor / max) * 100);
      const participacao = total ? (i.valor / total) * 100 : 0;
      const dica = `${i.rotulo}: ${formatar(i.valor)} (${fmt.numero(participacao, 1)}% do total)`;
      const rotulo = i.rota
        ? `<a href="${i.rota}" class="hbar-label">${esc(i.rotulo)}</a>`
        : `<span class="hbar-label">${esc(i.rotulo)}</span>`;
      return `
        <li class="hbar" title="${esc(dica)}">
          ${rotulo}
          <div class="hbar-track"><span class="hbar-fill" style="width:${pct.toFixed(2)}%"></span></div>
          <span class="hbar-value">${esc(formatar(i.valor))}<small>${fmt.numero(participacao, 0)}%</small></span>
        </li>`;
    })
    .join("")}</ul>`;
}

function passoEixo(max) {
  const bruto = max / 4;
  const mag = 10 ** Math.floor(Math.log10(bruto || 1));
  const norm = bruto / mag;
  const passo =
    norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return passo * mag;
}

/** Colunas verticais em SVG (uma série), responsivas: posições horizontais em %. */
export function colunas(
  itens,
  { formatar = fmt.compacto, formatarDica = fmt.moeda, altura = 220 } = {},
) {
  if (!itens.length || itens.every((i) => !i.valor))
    return estadoVazio("Sem dados para os filtros selecionados.", "chart");
  const topo = 22;
  const base = altura - 28;
  const max = Math.max(...itens.map((i) => i.valor));
  const passo = passoEixo(max);
  const limite = Math.ceil(max / passo) * passo || 1;
  const escala = (v) => base - ((base - topo) * v) / limite;
  const ticks = [];
  for (let v = 0; v <= limite + 1e-9; v += passo) ticks.push(v);
  const n = itens.length;
  const esquerda = 12; // % reservado para o eixo
  const largura = (100 - esquerda) / n;
  const barra = Math.min(largura * 0.5, 9);

  const grade = ticks
    .map(
      (v) =>
        `<line x1="${esquerda}%" x2="100%" y1="${escala(v)}" y2="${escala(v)}" class="chart-grid"/><text x="${esquerda - 1.5}%" y="${escala(v) + 4}" class="chart-axis chart-tick" text-anchor="end">${esc(formatar(v))}</text>`,
    )
    .join("");
  const barras = itens
    .map((i, k) => {
      const cx = esquerda + largura * k + largura / 2;
      const y = escala(i.valor);
      const h = Math.max(0, base - y);
      const r = Math.min(4, h);
      return `
        <g class="chart-col" tabindex="0" aria-label="${esc(`${i.rotulo}: ${formatarDica(i.valor)}`)}">
          <title>${esc(`${i.rotulo}: ${formatarDica(i.valor)}`)}</title>
          <rect x="${cx - largura / 2}%" y="${topo - 10}" width="${largura}%" height="${base - topo + 10}" class="chart-hit"/>
          <rect x="${cx - barra / 2}%" y="${y}" width="${barra}%" height="${h}" rx="${r}" class="chart-bar"/>
          <rect x="${cx - barra / 2}%" y="${Math.max(y, base - r)}" width="${barra}%" height="${Math.min(r, h)}" class="chart-bar"/>
          <text x="${cx}%" y="${y - 6}" text-anchor="middle" class="chart-value">${i.valor ? esc(formatar(i.valor)) : ""}</text>
          <text x="${cx}%" y="${base + 18}" text-anchor="middle" class="chart-axis">${esc(i.rotulo)}</text>
        </g>`;
    })
    .join("");
  return `<svg class="chart-svg" width="100%" height="${altura}" role="img" aria-label="Gráfico de colunas">${grade}<line x1="${esquerda}%" x2="100%" y1="${base}" y2="${base}" class="chart-baseline"/>${barras}</svg>`;
}

/** Barra empilhada por categorias de situação (cores de status com legenda). */
export function barraEmpilhada(segmentos, total) {
  if (!total) return '<div class="stack-bar is-empty"></div>';
  return `<div class="stack-bar" role="img" aria-label="${esc(segmentos.map((s) => `${s.rotulo}: ${s.valor}`).join(", "))}">${segmentos
    .filter((s) => s.valor > 0)
    .map(
      (s) =>
        `<span class="stack-seg seg-${s.tom}" style="flex:${s.valor}" title="${esc(`${s.rotulo}: ${s.valor}`)}"></span>`,
    )
    .join("")}</div>`;
}

export function legenda(segmentos) {
  return `<ul class="legend">${segmentos.map((s) => `<li><span class="legend-swatch seg-${s.tom}"></span>${esc(s.rotulo)}</li>`).join("")}</ul>`;
}

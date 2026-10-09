// Componentes de interface reutilizáveis: modais, confirmações, avisos,
// formulários, tabelas, paginação, badges e indicadores.

import { esc, fmt } from "./utils.js";
import { icone } from "./icons.js";
import { pode, nomeUsuario } from "./services/index.js";
import { perfisAutorizados } from "./permissions.js";
import { CIDADES } from "./constants.js";

// ---------- Badges ----------

export function badge(mapa, chave) {
  const d = mapa[chave];
  if (!d) return '<span class="badge badge-neutral">—</span>';
  return `<span class="badge badge-${d.tom}">${esc(d.label)}</span>`;
}

export function badgeTexto(texto, tom = "neutral") {
  return `<span class="badge badge-${tom}">${esc(texto)}</span>`;
}

// ---------- Botões com permissão simulada ----------

export function botao({
  acao,
  texto,
  icone: ic,
  variante = "secondary",
  permissao = null,
  attrs = "",
  tamanho = "",
  titulo = "",
}) {
  const classes = `btn btn-${variante}${tamanho ? ` btn-${tamanho}` : ""}`;
  if (permissao && !pode(permissao)) {
    const dica = `Simulação de permissões: disponível para ${perfisAutorizados(permissao)}`;
    return `<button type="button" class="${classes} is-locked" disabled title="${esc(dica)}" aria-label="${esc(`${texto} — ${dica}`)}">${icone("lock")}<span>${esc(texto)}</span></button>`;
  }
  return `<button type="button" class="${classes}" ${acao ? `data-acao="${esc(acao)}"` : ""} ${titulo ? `title="${esc(titulo)}"` : ""} ${attrs}>${ic ? icone(ic) : ""}<span>${esc(texto)}</span></button>`;
}

export function avisoPermissao(permissao, texto) {
  if (pode(permissao)) return "";
  return `<div class="notice notice-muted">${icone("lock")}<span>${esc(texto ?? "Ação restrita")} — nesta simulação, disponível para ${esc(perfisAutorizados(permissao))}.</span></div>`;
}

// ---------- Modais (com pilha, para confirmações sobre detalhes) ----------

const pilha = [];
let contadorModal = 0;

function raizModais() {
  return document.getElementById("modal-root");
}

export function abrirModal({
  titulo,
  subtitulo = "",
  corpo = "",
  rodape = "",
  tamanho = "md",
  aoMontar,
  aoFechar,
}) {
  const camada = document.createElement("div");
  camada.className = "modal-layer";
  const id = `modal-titulo-${(contadorModal += 1)}`;
  const anteriorFoco = document.activeElement;
  let opcoes = { titulo, subtitulo, corpo, rodape };

  const ctrl = {
    el: camada,
    fechar() {
      const i = pilha.indexOf(ctrl);
      if (i >= 0) pilha.splice(i, 1);
      camada.remove();
      if (!pilha.length) document.body.classList.remove("modal-aberto");
      aoFechar?.();
      if (anteriorFoco && document.contains(anteriorFoco))
        anteriorFoco.focus({ preventScroll: true });
    },
    atualizar(novas) {
      opcoes = { ...opcoes, ...novas };
      montar(false);
    },
  };

  function montar(primeira) {
    const scroll = camada.querySelector(".modal-body")?.scrollTop ?? 0;
    camada.innerHTML = `
      <div class="modal-backdrop" data-fechar-modal></div>
      <div class="modal modal-${tamanho}" role="dialog" aria-modal="true" aria-labelledby="${id}">
        <header class="modal-header">
          <div class="modal-title">
            <h2 id="${id}">${opcoes.titulo}</h2>
            ${opcoes.subtitulo ? `<p>${opcoes.subtitulo}</p>` : ""}
          </div>
          <button type="button" class="icon-btn" data-fechar-modal aria-label="Fechar">${icone("x")}</button>
        </header>
        <div class="modal-body">${opcoes.corpo}</div>
        ${opcoes.rodape ? `<footer class="modal-footer">${opcoes.rodape}</footer>` : ""}
      </div>`;
    const modal = camada.querySelector(".modal");
    if (!primeira) camada.querySelector(".modal-body").scrollTop = scroll;
    aoMontar?.(modal, ctrl);
    if (primeira) {
      const alvo =
        modal.querySelector("[autofocus]") ||
        modal.querySelector(
          "input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled])",
        ) ||
        modal.querySelector(".modal-header .icon-btn");
      alvo?.focus({ preventScroll: true });
    }
  }

  camada.addEventListener("click", (e) => {
    if (e.target.closest("[data-fechar-modal]")) ctrl.fechar();
  });
  raizModais().appendChild(camada);
  pilha.push(ctrl);
  document.body.classList.add("modal-aberto");
  montar(true);
  return ctrl;
}

export function fecharTodosModais() {
  while (pilha.length) pilha[pilha.length - 1].fechar();
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && pilha.length) {
    e.preventDefault();
    pilha[pilha.length - 1].fechar();
  }
});

/**
 * Confirmação de ações importantes. Opcionalmente exige um motivo.
 * Resolve com { motivo } quando confirmada ou null quando cancelada.
 */
export function confirmar({
  titulo,
  mensagem,
  textoConfirmar = "Confirmar",
  perigo = false,
  motivo = null,
}) {
  return new Promise((resolve) => {
    let resolvido = false;
    const corpo = `
      <div class="confirm-body">
        <div class="confirm-icon ${perigo ? "is-danger" : ""}">${icone(perigo ? "alert" : "info")}</div>
        <div class="confirm-text">${mensagem}</div>
      </div>
      ${motivo ? `<form class="form" novalidate data-form-confirmar>${campo({ rotulo: motivo.rotulo, nome: "motivo", tipo: "textarea", obrigatorio: Boolean(motivo.obrigatorio), attrs: `placeholder="${esc(motivo.placeholder ?? "")}" rows="3"`, ajuda: motivo.ajuda })}</form>` : ""}`;
    const rodape = `
      <button type="button" class="btn btn-ghost" data-fechar-modal>Cancelar</button>
      <button type="button" class="btn ${perigo ? "btn-danger" : "btn-primary"}" data-confirmar>${esc(textoConfirmar)}</button>`;
    const ctrl = abrirModal({
      titulo: esc(titulo),
      corpo,
      rodape,
      tamanho: "sm",
      aoFechar: () => {
        if (!resolvido) resolve(null);
      },
      aoMontar: (modal) => {
        const enviar = () => {
          let texto = "";
          if (motivo) {
            const form = modal.querySelector("[data-form-confirmar]");
            const minimo = motivo.minimo ?? (motivo.obrigatorio ? 5 : 0);
            if (
              !validarFormulario(form, (d) =>
                minimo && d.motivo.trim().length < minimo
                  ? { motivo: `Informe pelo menos ${minimo} caracteres.` }
                  : {},
              )
            )
              return;
            texto = form.motivo.value.trim();
          }
          resolvido = true;
          ctrl.fechar();
          resolve({ motivo: texto });
        };
        modal
          .querySelector("[data-confirmar]")
          .addEventListener("click", enviar);
        modal
          .querySelector("[data-form-confirmar]")
          ?.addEventListener("submit", (e) => {
            e.preventDefault();
            enviar();
          });
      },
    });
  });
}

// ---------- Avisos (toasts) ----------

export function toast(mensagem, tipo = "sucesso") {
  const raiz = document.getElementById("toast-root");
  if (!raiz) return;
  const el = document.createElement("div");
  const ic =
    { sucesso: "checkCircle", erro: "xCircle", aviso: "alert", info: "info" }[
      tipo
    ] ?? "info";
  el.className = `toast toast-${tipo}`;
  el.setAttribute("role", tipo === "erro" ? "alert" : "status");
  el.innerHTML = `${icone(ic)}<div class="toast-text">${esc(mensagem)}</div><button type="button" class="icon-btn" aria-label="Fechar aviso">${icone("x")}</button>`;
  const remover = () => {
    el.classList.add("is-leaving");
    setTimeout(() => el.remove(), 180);
  };
  el.querySelector("button").addEventListener("click", remover);
  raiz.appendChild(el);
  setTimeout(remover, tipo === "erro" ? 7000 : 4200);
}

/** Executa uma operação de serviço exibindo o resultado. Retorna o resultado ou null em caso de erro. */
export function executar(fn, mensagemSucesso) {
  try {
    const r = fn();
    if (mensagemSucesso)
      toast(
        typeof mensagemSucesso === "function"
          ? mensagemSucesso(r)
          : mensagemSucesso,
        "sucesso",
      );
    return r ?? true;
  } catch (erro) {
    if (erro?.name === "ErroNegocio") {
      toast(erro.message, "erro");
    } else {
      console.error(erro);
      toast(`Erro inesperado: ${erro?.message ?? erro}`, "erro");
    }
    return null;
  }
}

// ---------- Formulários ----------

export function opcoes(lista, selecionado = "", vazio = null) {
  const sel = Array.isArray(selecionado)
    ? selecionado.map(String)
    : [String(selecionado ?? "")];
  return (
    (vazio !== null ? `<option value="">${esc(vazio)}</option>` : "") +
    lista
      .map(
        (o) =>
          `<option value="${esc(o.valor)}" ${sel.includes(String(o.valor)) ? "selected" : ""} ${o.desabilitado ? "disabled" : ""}>${esc(o.texto)}</option>`,
      )
      .join("")
  );
}

export function opcoesMapa(mapa, selecionado = "", vazio = null) {
  return opcoes(
    Object.entries(mapa).map(([valor, d]) => ({ valor, texto: d.label ?? d })),
    selecionado,
    vazio,
  );
}

export function opcoesCidades(selecionado = "", vazio = "Todas as cidades") {
  return opcoes(
    CIDADES.map((c) => ({ valor: c.id, texto: c.nome })),
    selecionado,
    vazio,
  );
}

/** Campo de formulário padronizado (rótulo, controle, ajuda e espaço para erro). */
export function campo({
  rotulo,
  nome,
  tipo = "text",
  valor = "",
  obrigatorio = false,
  attrs = "",
  ajuda = "",
  opcoesHtml = "",
  largura = "",
  somenteLeitura = false,
}) {
  const id = `f-${nome}-${Math.random().toString(36).slice(2, 7)}`;
  const req = obrigatorio ? "required" : "";
  const ro = somenteLeitura ? "readonly" : "";
  let controle;
  if (tipo === "select") {
    controle = `<select id="${id}" name="${nome}" ${req} ${attrs}>${opcoesHtml}</select>`;
  } else if (tipo === "textarea") {
    controle = `<textarea id="${id}" name="${nome}" ${req} ${ro} ${attrs}>${esc(valor)}</textarea>`;
  } else {
    controle = `<input id="${id}" name="${nome}" type="${tipo}" value="${esc(valor)}" ${req} ${ro} ${attrs}>`;
  }
  return `
    <div class="field ${largura ? `field-${largura}` : ""}" data-campo="${nome}">
      <label for="${id}">${esc(rotulo)}${obrigatorio ? ' <span class="req" aria-hidden="true">*</span>' : ""}</label>
      ${controle}
      ${ajuda ? `<small class="field-help">${ajuda}</small>` : ""}
      <small class="field-error" role="alert"></small>
    </div>`;
}

export function dadosFormulario(form) {
  const dados = {};
  for (const el of form.elements) {
    if (!el.name || el.disabled) continue;
    if (el.type === "checkbox") {
      if (el.name.endsWith("[]")) {
        const k = el.name.slice(0, -2);
        dados[k] = dados[k] ?? [];
        if (el.checked) dados[k].push(el.value);
      } else {
        dados[el.name] = el.checked;
      }
    } else if (el.type === "radio") {
      if (el.checked) dados[el.name] = el.value;
    } else {
      dados[el.name] = el.value;
    }
  }
  return dados;
}

export function limparErros(form) {
  form
    .querySelectorAll(".field.has-error")
    .forEach((f) => f.classList.remove("has-error"));
  form.querySelectorAll(".field-error").forEach((e) => (e.textContent = ""));
}

export function mostrarErro(form, nome, mensagem) {
  const f = form.querySelector(`[data-campo="${nome}"]`);
  if (!f) return false;
  f.classList.add("has-error");
  const e = f.querySelector(".field-error");
  if (e) e.textContent = mensagem;
  return true;
}

/**
 * Valida campos obrigatórios e limites numéricos; `extras` recebe os dados e
 * pode retornar { campo: mensagem } para regras específicas.
 */
export function validarFormulario(form, extras) {
  limparErros(form);
  const erros = {};
  for (const el of form.elements) {
    if (!el.name || el.disabled || el.type === "hidden") continue;
    const valor = (el.value ?? "").trim();
    if (el.required && el.type !== "checkbox" && !valor) {
      erros[el.name] = "Campo obrigatório.";
      continue;
    }
    if (el.type === "number" && valor) {
      const n = Number(valor);
      if (Number.isNaN(n)) erros[el.name] = "Informe um número válido.";
      else if (el.min !== "" && n < Number(el.min))
        erros[el.name] =
          `O valor mínimo é ${fmt.numero(Number(el.min), String(el.min).includes(".") ? 2 : 0)}.`;
      else if (el.max !== "" && n > Number(el.max))
        erros[el.name] = `O valor máximo é ${fmt.numero(Number(el.max))}.`;
    }
    if (el.minLength > 0 && valor && valor.length < el.minLength)
      erros[el.name] = `Informe pelo menos ${el.minLength} caracteres.`;
  }
  if (extras)
    Object.assign(
      erros,
      Object.fromEntries(
        Object.entries(extras(dadosFormulario(form)) ?? {}).filter(
          ([k]) => !erros[k],
        ),
      ),
    );
  let primeiro = null;
  for (const [nome, msg] of Object.entries(erros)) {
    if (mostrarErro(form, nome, msg) && !primeiro)
      primeiro = form.querySelector(
        `[data-campo="${nome}"] input, [data-campo="${nome}"] select, [data-campo="${nome}"] textarea`,
      );
  }
  if (Object.keys(erros).length) {
    primeiro?.focus();
    if (!primeiro) toast(Object.values(erros)[0], "erro");
    return false;
  }
  return true;
}

// ---------- Tabelas e paginação ----------

export function tabela({
  colunas,
  linhas,
  vazio = "Nenhum registro encontrado com os filtros atuais.",
  linhaAttrs = null,
  classe = "",
  rodape = "",
}) {
  const thead = colunas
    .map(
      (c) => `<th scope="col" class="${c.classe ?? ""}">${esc(c.titulo)}</th>`,
    )
    .join("");
  const corpo = linhas.length
    ? linhas
        .map((l) => {
          const attrs = linhaAttrs ? linhaAttrs(l) : "";
          return `<tr ${attrs}>${colunas.map((c) => `<td class="${c.classe ?? ""}" data-label="${esc(c.titulo)}">${c.render(l)}</td>`).join("")}</tr>`;
        })
        .join("")
    : `<tr class="empty-row"><td colspan="${colunas.length}">${estadoVazio(vazio)}</td></tr>`;
  return `<div class="table-wrap ${classe}"><table class="table"><thead><tr>${thead}</tr></thead><tbody>${corpo}</tbody>${rodape ? `<tfoot>${rodape}</tfoot>` : ""}</table></div>`;
}

export function estadoVazio(texto, ic = "search") {
  return `<div class="empty-state">${icone(ic)}<p>${esc(texto)}</p></div>`;
}

export function paginar(linhas, pagina, porPagina = 12) {
  const totalPaginas = Math.max(1, Math.ceil(linhas.length / porPagina));
  const p = Math.min(Math.max(1, pagina), totalPaginas);
  return {
    itens: linhas.slice((p - 1) * porPagina, p * porPagina),
    pagina: p,
    totalPaginas,
    total: linhas.length,
    porPagina,
  };
}

export function paginacao(
  { pagina, totalPaginas, total, porPagina },
  alvo = "principal",
) {
  if (total <= porPagina)
    return total
      ? `<div class="pagination"><span>${total} registro(s)</span></div>`
      : "";
  const ini = (pagina - 1) * porPagina + 1;
  const fim = Math.min(total, pagina * porPagina);
  const paginas = [];
  for (let p = 1; p <= totalPaginas; p += 1) {
    if (p === 1 || p === totalPaginas || Math.abs(p - pagina) <= 1)
      paginas.push(p);
    else if (paginas[paginas.length - 1] !== "…") paginas.push("…");
  }
  return `
    <nav class="pagination" aria-label="Paginação">
      <span>Mostrando ${ini}–${fim} de ${total}</span>
      <div class="pagination-pages">
        <button type="button" class="icon-btn" data-pagina="${pagina - 1}" data-alvo="${alvo}" ${pagina === 1 ? "disabled" : ""} aria-label="Página anterior">${icone("chevronLeft")}</button>
        ${paginas.map((p) => (p === "…" ? '<span class="pagination-gap">…</span>' : `<button type="button" class="page-btn ${p === pagina ? "is-active" : ""}" data-pagina="${p}" data-alvo="${alvo}" ${p === pagina ? 'aria-current="page"' : ""}>${p}</button>`)).join("")}
        <button type="button" class="icon-btn" data-pagina="${pagina + 1}" data-alvo="${alvo}" ${pagina === totalPaginas ? "disabled" : ""} aria-label="Próxima página">${icone("chevronRight")}</button>
      </div>
    </nav>`;
}

// ---------- Blocos de conteúdo ----------

export function kpi({
  rotulo,
  valor,
  detalhe = "",
  ic = "info",
  tom = "",
  rota = "",
  bloqueado = "",
}) {
  const tag = rota && !bloqueado ? "a" : "div";
  const href = rota && !bloqueado ? `href="${rota}"` : "";
  return `
    <${tag} class="kpi ${tom ? `kpi-${tom}` : ""} ${bloqueado ? "is-locked" : ""}" ${href}>
      <div class="kpi-head"><span class="kpi-label">${esc(rotulo)}</span><span class="kpi-icon">${icone(bloqueado ? "lock" : ic)}</span></div>
      <div class="kpi-value">${bloqueado ? '<span class="kpi-restricted">Restrito</span>' : valor}</div>
      <div class="kpi-detail">${bloqueado ? esc(bloqueado) : detalhe}</div>
    </${tag}>`;
}

export function detalhes(pares, colunas = 3) {
  return `<dl class="details-grid cols-${colunas}">${pares
    .filter(Boolean)
    .map(
      ([r, v, largo]) =>
        `<div class="${largo ? "span-all" : ""}"><dt>${esc(r)}</dt><dd>${v === "" || v === null || v === undefined ? "—" : v}</dd></div>`,
    )
    .join("")}</dl>`;
}

export function linhaDoTempo(eventos) {
  if (!eventos?.length)
    return estadoVazio("Sem registros no histórico.", "history");
  return `<ol class="timeline">${[...eventos]
    .reverse()
    .map(
      (e) => `
      <li>
        <span class="timeline-dot"></span>
        <div>
          <p class="timeline-text">${esc(e.descricao)}</p>
          ${e.motivo ? `<p class="timeline-note">Motivo: ${esc(e.motivo)}</p>` : ""}
          <p class="timeline-meta">${fmt.dataHora(e.dataHora)} · ${esc(nomeUsuario(e.usuarioId))}</p>
        </div>
      </li>`,
    )
    .join("")}</ol>`;
}

export function abas(lista, ativa, alvo = "aba") {
  return `<div class="tabs" role="tablist">${lista
    .map(
      (a) =>
        `<button type="button" role="tab" class="tab ${a.id === ativa ? "is-active" : ""}" aria-selected="${a.id === ativa}" data-${alvo}="${a.id}">${esc(a.rotulo)}${a.contador !== undefined ? `<span class="tab-count">${a.contador}</span>` : ""}</button>`,
    )
    .join("")}</div>`;
}

export function secao(
  titulo,
  conteudo,
  { acoes = "", descricao = "", classe = "" } = {},
) {
  return `
    <section class="card ${classe}">
      <header class="card-header">
        <div><h3>${esc(titulo)}</h3>${descricao ? `<p>${descricao}</p>` : ""}</div>
        ${acoes ? `<div class="card-actions">${acoes}</div>` : ""}
      </header>
      <div class="card-body">${conteudo}</div>
    </section>`;
}

export function link(rota, texto) {
  return `<a class="link" href="${rota}">${esc(texto)}</a>`;
}

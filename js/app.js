// Inicialização, navegação (rotas por hash), cabeçalho, seletor de perfil,
// notificações e restauração dos dados de demonstração.

import { store, carregar, persistir } from "./storage.js";
import { gerarDadosIniciais, errosGeracao } from "./data.js";
import { VERSAO_DADOS } from "./constants.js";
import {
  PERFIS,
  PAGINAS_RESTRITAS,
  podeExecutar,
  perfisAutorizados,
} from "./permissions.js";
import * as S from "./services/index.js";
import { icone } from "./icons.js";
import { esc, iniciais } from "./utils.js";
import { toast, confirmar, fecharTodosModais, executar } from "./ui.js";
import { rotaAtual } from "./router.js";
import { iniciarAjusteResponsivo } from "./responsivo.js";
import { iniciarTema, alternarTema } from "./tema.js";

import dashboard from "./modules/dashboard.js";
import veiculos from "./modules/veiculos.js";
import manutencao from "./modules/manutencao.js";
import compras from "./modules/compras.js";
import estoque from "./modules/estoque.js";
import pecas from "./modules/pecas.js";
import abastecimento from "./modules/abastecimento.js";
import despesas from "./modules/despesas.js";
import relatorios from "./modules/relatorios.js";
import usuarios from "./modules/usuarios.js";

const PAGINAS = [
  {
    id: "dashboard",
    rotulo: "Dashboard",
    icone: "dashboard",
    modulo: dashboard,
  },
  { id: "veiculos", rotulo: "Veículos", icone: "truck", modulo: veiculos },
  {
    id: "manutencao",
    rotulo: "Manutenção",
    icone: "wrench",
    modulo: manutencao,
  },
  {
    id: "compras",
    rotulo: "Solicitações de compra",
    icone: "cart",
    modulo: compras,
  },
  {
    id: "estoque",
    rotulo: "Estoque e inventário",
    icone: "package",
    modulo: estoque,
  },
  { id: "pecas", rotulo: "Peças por veículo", icone: "tire", modulo: pecas },
  {
    id: "abastecimento",
    rotulo: "Abastecimento e quilometragem",
    icone: "fuel",
    modulo: abastecimento,
  },
  { id: "despesas", rotulo: "Despesas", icone: "receipt", modulo: despesas },
  {
    id: "relatorios",
    rotulo: "Relatórios",
    icone: "chart",
    modulo: relatorios,
  },
  { id: "usuarios", rotulo: "Usuários", icone: "users", modulo: usuarios },
];

let paginaRenderizada = null;

// ---------------------------------------------------------------------------
// Estrutura da aplicação
// ---------------------------------------------------------------------------

function montarEstrutura() {
  document.getElementById("app").innerHTML = `
    <aside class="sidebar" id="sidebar" aria-label="Navegação principal">
      <div class="brand">
        <div>
          <p class="brand-name">Vieira <span>|</span> Gestão Operacional</p>
          <p class="brand-sub">Gestão de frota, manutenção e recursos operacionais.</p>
        </div>
      </div>
      <nav class="nav" id="nav"></nav>
      <div class="sidebar-footer">
        <p class="demo-note">${icone("info")}<span>Protótipo de demonstração com dados fictícios. Os registros ficam apenas neste navegador.</span></p>
        <button type="button" class="btn btn-ghost btn-sm btn-block" id="btn-restaurar">${icone("reset")}<span>Restaurar dados da demonstração</span></button>
      </div>
    </aside>
    <div class="sidebar-overlay" id="sidebar-overlay"></div>
    <div class="main">
      <header class="topbar">
        <button type="button" class="icon-btn menu-btn" id="btn-menu" aria-label="Abrir menu">${icone("menu")}</button>
        <div class="topbar-title">
          <h1 id="titulo-pagina"></h1>
          <p id="descricao-pagina"></p>
        </div>
        <div class="topbar-actions">
          <span class="demo-pill" title="Os números exibidos são fictícios e servem apenas para demonstração.">Demonstração · dados fictícios</span>
          <button type="button" class="icon-btn theme-btn" id="btn-tema" data-alternar-tema aria-pressed="false" aria-label="Usar modo escuro" title="Usar modo escuro">${icone("lua", "icon-lua")}${icone("sol", "icon-sol")}</button>
          <div class="dropdown" id="dd-notificacoes">
            <button type="button" class="icon-btn bell-btn" id="btn-notificacoes" aria-haspopup="true" aria-expanded="false" aria-label="Notificações"></button>
            <div class="dropdown-menu dropdown-right notif-menu" id="menu-notificacoes" hidden></div>
          </div>
          <div class="dropdown" id="dd-perfil">
            <button type="button" class="profile-btn" id="btn-perfil" aria-haspopup="true" aria-expanded="false"></button>
            <div class="dropdown-menu dropdown-right profile-menu" id="menu-perfil" hidden></div>
          </div>
        </div>
      </header>
      <main class="content" id="view" tabindex="-1"></main>
    </div>`;

  document
    .getElementById("btn-menu")
    .addEventListener("click", () => alternarMenu(true));
  document
    .getElementById("sidebar-overlay")
    .addEventListener("click", () => alternarMenu(false));
  document
    .getElementById("btn-restaurar")
    .addEventListener("click", restaurarDemonstracao);
  document.getElementById("btn-tema").addEventListener("click", () => {
    const tema = alternarTema();
    toast(tema === "dark" ? "Modo escuro ativado." : "Modo claro ativado.", "info");
  });
  document.getElementById("btn-notificacoes").addEventListener("click", (e) => {
    e.stopPropagation();
    alternarDropdown("notificacoes");
  });
  document.getElementById("btn-perfil").addEventListener("click", (e) => {
    e.stopPropagation();
    alternarDropdown("perfil");
  });
  document.getElementById("menu-perfil").addEventListener("click", (e) => {
    const b = e.target.closest("[data-perfil]");
    if (!b) return;
    fecharDropdowns();
    const u = executar(() => S.trocarPerfil(b.dataset.perfil));
    if (u)
      toast(
        `Perfil de demonstração: ${u.nome} — ${PERFIS[u.perfil].label}`,
        "info",
      );
  });
  document
    .getElementById("menu-notificacoes")
    .addEventListener("click", (e) => {
      if (e.target.closest("a")) fecharDropdowns();
    });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".dropdown")) fecharDropdowns();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      fecharDropdowns();
      alternarMenu(false);
    }
  });
}

function alternarMenu(abrir) {
  document.body.classList.toggle("menu-aberto", abrir);
}

function alternarDropdown(nome) {
  const menu = document.getElementById(`menu-${nome}`);
  const btn = document.getElementById(`btn-${nome}`);
  const abrir = menu.hidden;
  fecharDropdowns();
  menu.hidden = !abrir;
  btn.setAttribute("aria-expanded", String(abrir));
}

function fecharDropdowns() {
  for (const nome of ["notificacoes", "perfil"]) {
    const menu = document.getElementById(`menu-${nome}`);
    if (menu) menu.hidden = true;
    document
      .getElementById(`btn-${nome}`)
      ?.setAttribute("aria-expanded", "false");
  }
}

// ---------------------------------------------------------------------------
// Renderização
// ---------------------------------------------------------------------------

function renderizarNavegacao() {
  const u = S.usuarioAtual();
  const { pagina } = rotaAtual();
  document.getElementById("nav").innerHTML = PAGINAS.map((p) => {
    const restrita =
      PAGINAS_RESTRITAS[p.id] && !podeExecutar(u, PAGINAS_RESTRITAS[p.id]);
    return `<a href="#/${p.id}" class="nav-item ${p.id === pagina ? "is-active" : ""} ${restrita ? "is-restricted" : ""}" ${p.id === pagina ? 'aria-current="page"' : ""} ${restrita ? `title="Restrito nesta simulação: ${esc(perfisAutorizados(PAGINAS_RESTRITAS[p.id]))}"` : ""}>
      ${icone(p.icone)}<span>${p.rotulo}</span>${restrita ? icone("lock", "nav-lock") : ""}
    </a>`;
  }).join("");
}

function renderizarCabecalho() {
  const u = S.usuarioAtual();
  const notifs = S.notificacoes(u);
  document.getElementById("btn-notificacoes").innerHTML =
    `${icone("bell")}${notifs.length ? `<span class="bell-count">${notifs.length}</span>` : ""}`;
  document
    .getElementById("btn-notificacoes")
    .setAttribute("aria-label", `Notificações (${notifs.length})`);
  document.getElementById("menu-notificacoes").innerHTML = `
    <div class="dropdown-header"><strong>Pendências do perfil</strong><span>${esc(PERFIS[u.perfil].label)}</span></div>
    ${
      notifs.length
        ? `<ul class="notif-list">${notifs.map((n) => `<li><a href="${n.rota}" class="notif-item"><span class="notif-dot dot-${n.tom}"></span><span><strong>${esc(n.titulo)}</strong>${n.detalhe ? `<small>${esc(n.detalhe)}</small>` : ""}</span></a></li>`).join("")}</ul>`
        : '<p class="dropdown-empty">Nenhuma pendência para este perfil.</p>'
    }
    <p class="dropdown-foot">Notificações simuladas, calculadas a partir dos registros. Não há envio real de mensagens.</p>`;

  document.getElementById("btn-perfil").innerHTML = `
    <span class="avatar">${esc(iniciais(u.nome))}</span>
    <span class="profile-text"><strong>${esc(u.nome)}</strong><small>${esc(u.funcao)}</small></span>
    ${icone("chevronDown")}`;
  const demo = S.db().usuarios.filter((x) => x.demo);
  document.getElementById("menu-perfil").innerHTML = `
    <div class="dropdown-header"><strong>Perfil de demonstração</strong><span>Simulação — sem autenticação</span></div>
    <ul class="profile-list">${demo
      .map(
        (
          x,
        ) => `<li><button type="button" class="profile-option ${x.id === u.id ? "is-active" : ""}" data-perfil="${x.id}" ${x.ativo ? "" : "disabled"}>
          <span class="avatar avatar-sm">${esc(iniciais(x.nome))}</span>
          <span><strong>${esc(x.nome)}</strong><small>${esc(x.funcao)}${x.ativo ? "" : " · inativo"}</small></span>
          ${x.id === u.id ? icone("check") : ""}
        </button></li>`,
      )
      .join("")}</ul>
    <p class="dropdown-foot">As permissões mudam conforme o perfil. Trata-se de uma simulação na interface, não de controle de acesso seguro.</p>`;
}

function renderizarPagina({ navegacao }) {
  const rota = rotaAtual();
  const def = PAGINAS.find((p) => p.id === rota.pagina);
  const view = document.getElementById("view");
  document.getElementById("titulo-pagina").textContent =
    def.modulo.titulo ?? def.rotulo;
  document.getElementById("descricao-pagina").textContent =
    def.modulo.descricao ?? "";
  document.title = `${def.rotulo} · Vieira | Gestão Operacional`;

  const u = S.usuarioAtual();
  const permissao = PAGINAS_RESTRITAS[def.id];
  if (permissao && !podeExecutar(u, permissao)) {
    view.innerHTML = `
      <div class="restricted">
        ${icone("lock")}
        <h2>Página restrita para o perfil ${esc(PERFIS[u.perfil].label)}</h2>
        <p>Nesta simulação de permissões, <strong>${esc(def.rotulo)}</strong> está disponível para: ${esc(perfisAutorizados(permissao))}.</p>
        <p class="muted">Use o seletor de perfil no canto superior direito para alternar o usuário da demonstração.</p>
      </div>`;
    paginaRenderizada = def.id;
    return;
  }
  const scroll = window.scrollY;
  def.modulo.render(view, rota, {
    navegacao: navegacao || paginaRenderizada !== def.id,
  });
  paginaRenderizada = def.id;
  if (navegacao) {
    window.scrollTo(0, 0);
  } else {
    window.scrollTo(0, scroll);
  }
}

function renderizarTudo({ navegacao = false } = {}) {
  renderizarNavegacao();
  renderizarCabecalho();
  renderizarPagina({ navegacao });
}

// ---------------------------------------------------------------------------
// Restauração da demonstração
// ---------------------------------------------------------------------------

async function restaurarDemonstracao() {
  const ok = await confirmar({
    titulo: "Restaurar dados da demonstração",
    mensagem:
      '<p>Todos os registros criados ou alterados nesta apresentação serão descartados e os dados fictícios iniciais serão recriados.</p><p class="muted">O perfil de demonstração ativo será mantido.</p>',
    textoConfirmar: "Restaurar dados",
    perigo: true,
  });
  if (!ok) return;
  const usuarioId = S.usuarioAtual()?.id;
  fecharTodosModais();
  const estado = gerarDadosIniciais();
  const u = estado.usuarios.find((x) => x.id === usuarioId);
  if (u && u.ativo && u.demo) estado.sessao.usuarioId = u.id;
  store.substituir(estado);
  store.commit();
  alternarMenu(false);
  toast(
    errosGeracao.length
      ? `Dados restaurados com ${errosGeracao.length} aviso(s) — veja o console.`
      : "Dados da demonstração restaurados.",
    errosGeracao.length ? "aviso" : "sucesso",
  );
}

// ---------------------------------------------------------------------------
// Início
// ---------------------------------------------------------------------------

function iniciar() {
  let estado = carregar();
  if (
    !estado ||
    estado.versao !== VERSAO_DADOS ||
    !Array.isArray(estado.veiculos)
  ) {
    estado = gerarDadosIniciais();
    store.substituir(estado);
    persistir();
  } else {
    store.substituir(estado);
  }
  if (!S.usuarioAtual()?.ativo) estado.sessao.usuarioId = "USR-07";

  montarEstrutura();
  iniciarAjusteResponsivo();
  iniciarTema();
  store.assinar(() => renderizarTudo({ navegacao: false }));
  window.addEventListener("hashchange", () => {
    fecharTodosModais();
    fecharDropdowns();
    alternarMenu(false);
    renderizarTudo({ navegacao: true });
  });
  renderizarTudo({ navegacao: true });
  if (store.falhouAoSalvar)
    toast(
      "O navegador bloqueou o armazenamento local. A demonstração funciona, mas os dados não serão mantidos ao recarregar.",
      "aviso",
    );

  // Acesso para inspeção durante a apresentação/testes (somente leitura recomendada).
  window.VieiraDemo = { store, servicos: S, errosGeracao };
}

iniciar();

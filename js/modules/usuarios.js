// Usuários fictícios, perfis de acesso (simulados) e registro de atividades.

import * as S from "../services/index.js";
import { nomeCidade } from "../constants.js";
import { PERFIS, ACOES } from "../permissions.js";
import { esc, fmt, iniciais } from "../utils.js";
import {
  badgeTexto,
  confirmar,
  executar,
  tabela,
  paginar,
  paginacao,
  abas,
  opcoes,
  toast,
} from "../ui.js";
import { icone } from "../icons.js";

let aba = "usuarios";
const filtrosLog = { usuario: "", modulo: "" };
let paginaLog = 1;

export default {
  titulo: "Usuários",
  descricao:
    "Usuários fictícios, setores, perfis de acesso e registro de atividades.",
  render(el, rota, { navegacao }) {
    if (navegacao && rota.query.has("aba")) aba = rota.query.get("aba");
    el.innerHTML = `
      <div class="notice notice-muted">${icone("shield")}<span><strong>Simulação de acessos.</strong> Não há cadastro de senhas nem autenticação. As permissões são aplicadas apenas na interface desta demonstração e não representam controle de acesso seguro.</span></div>
      <div class="page-toolbar">
        ${abas(
          [
            {
              id: "usuarios",
              rotulo: "Usuários",
              contador: S.db().usuarios.length,
            },
            { id: "perfis", rotulo: "Perfis e permissões" },
            { id: "atividades", rotulo: "Registro de atividades" },
          ],
          aba,
        )}
      </div>
      <div id="usr-conteudo"></div>`;
    el.onclick = async (e) => {
      const b = e.target.closest("[data-aba], [data-acao], [data-pagina]");
      if (!b) return;
      if (b.dataset.aba) {
        aba = b.dataset.aba;
        this.render(el, rota, { navegacao: false });
        return;
      }
      if (b.dataset.pagina) {
        paginaLog = Number(b.dataset.pagina);
        desenhar(el);
        return;
      }
      const u = S.usuario(b.dataset.id);
      if (b.dataset.acao === "alternar") {
        const ok = await confirmar({
          titulo: u.ativo ? "Desativar usuário" : "Ativar usuário",
          mensagem: `<p>${u.ativo ? "Desativar" : "Ativar"} <strong>${esc(u.nome)}</strong> (${esc(u.funcao)})?</p><p class="muted">${u.ativo ? "Usuários inativos não podem ser selecionados como perfil de demonstração nem atribuídos a novas tarefas. O histórico é preservado." : "O usuário voltará a ficar disponível na demonstração."}</p>`,
          textoConfirmar: u.ativo ? "Desativar" : "Ativar",
          perigo: u.ativo,
        });
        if (ok)
          executar(
            () => S.alternarUsuarioAtivo(u.id),
            `${u.nome} ${u.ativo ? "desativado" : "ativado"}.`,
          );
      } else if (b.dataset.acao === "usar") {
        if (executar(() => S.trocarPerfil(u.id)))
          toast(
            `Perfil de demonstração: ${u.nome} — ${PERFIS[u.perfil].label}`,
            "info",
          );
      }
    };
    el.onchange = (e) => {
      const f = e.target.dataset.filtro;
      if (!f) return;
      filtrosLog[f] = e.target.value;
      paginaLog = 1;
      desenhar(el);
    };
    el.oninput = null;
    el.onkeydown = null;
    desenhar(el);
  },
};

function desenhar(el) {
  const alvo = el.querySelector("#usr-conteudo");
  const atual = S.usuarioAtual();
  const podeGerenciar = S.pode("usuarios.gerenciar");

  if (aba === "perfis") {
    const perfis = Object.keys(PERFIS);
    const grupos = [...new Set(ACOES.map((a) => a.grupo))];
    alvo.innerHTML = `
      <div class="profile-cards">${perfis
        .map((p) => {
          const usuarios = S.db().usuarios.filter((u) => u.perfil === p);
          return `<article class="card profile-card ${atual.perfil === p ? "is-current" : ""}"><h4>${esc(PERFIS[p].label)}${atual.perfil === p ? ' <span class="badge badge-primary">Perfil ativo</span>' : ""}</h4><p>${esc(PERFIS[p].descricao)}</p><small>${usuarios.map((u) => esc(u.nome)).join(", ") || "Sem usuários"}</small></article>`;
        })
        .join("")}</div>
      <div class="card perm-list">${grupos
        .map(
          (g) =>
            `<section class="perm-group"><h4>${esc(g)}</h4><ul>${ACOES.filter(
              (a) => a.grupo === g,
            )
              .map(
                (a) =>
                  `<li><span>${esc(a.label)}</span><span class="perm-perfis">${a.perfis.map((p) => `<span class="badge ${atual.perfil === p ? "badge-primary" : "badge-neutral"}">${esc(PERFIS[p].label)}</span>`).join("")}</span></li>`,
              )
              .join("")}</ul></section>`,
        )
        .join("")}</div>
      <div class="card card-flush perm-matrix">
        <div class="table-wrap table-scroll"><table class="table matrix">
          <thead><tr><th scope="col">Ação</th>${perfis.map((p) => `<th scope="col" class="center ${atual.perfil === p ? "col-current" : ""}">${esc(PERFIS[p].label)}</th>`).join("")}</tr></thead>
          <tbody>${grupos
            .map(
              (g) =>
                `<tr class="group-row"><th colspan="${perfis.length + 1}" scope="rowgroup">${esc(g)}</th></tr>${ACOES.filter(
                  (a) => a.grupo === g,
                )
                  .map(
                    (a) =>
                      `<tr><td>${esc(a.label)}</td>${perfis.map((p) => `<td class="center ${atual.perfil === p ? "col-current" : ""}">${a.perfis.includes(p) ? `<span class="perm-yes" aria-label="Permitido">${icone("check")}</span>` : '<span class="perm-no" aria-label="Não permitido">—</span>'}</td>`).join("")}</tr>`,
                  )
                  .join("")}`,
            )
            .join("")}</tbody>
        </table></div>
      </div>
      <p class="muted small">Páginas de consulta (Dashboard, Veículos, Manutenção, Compras, Estoque, Peças, Abastecimento e Usuários) são visíveis a todos os perfis; as ações dependem da matriz acima. Despesas e Relatórios exigem permissão de consulta.</p>`;
    return;
  }

  if (aba === "atividades") {
    const log = S.db().auditoria;
    const modulos = [...new Set(log.map((l) => l.modulo))].sort();
    const lista = log
      .filter(
        (l) =>
          (!filtrosLog.usuario || l.usuarioId === filtrosLog.usuario) &&
          (!filtrosLog.modulo || l.modulo === filtrosLog.modulo),
      )
      .slice()
      .reverse();
    const pag = paginar(lista, paginaLog, 20);
    paginaLog = pag.pagina;
    alvo.innerHTML = `
      <div class="filters" role="search">
        <div class="filter"><label for="log-usuario">Usuário</label><select id="log-usuario" data-filtro="usuario">${opcoes(
          S.db().usuarios.map((u) => ({ valor: u.id, texto: u.nome })),
          filtrosLog.usuario,
          "Todos",
        )}</select></div>
        <div class="filter"><label for="log-modulo">Módulo</label><select id="log-modulo" data-filtro="modulo">${opcoes(
          modulos.map((m) => ({ valor: m, texto: m })),
          filtrosLog.modulo,
          "Todos",
        )}</select></div>
      </div>
      <div class="card card-flush">${tabela({
        colunas: [
          {
            titulo: "Data e hora",
            render: (l) => fmt.dataHora(l.dataHora),
            classe: "nowrap",
          },
          {
            titulo: "Usuário",
            render: (l) => esc(S.nomeUsuario(l.usuarioId)),
            classe: "nowrap",
          },
          { titulo: "Módulo", render: (l) => esc(l.modulo), classe: "nowrap" },
          { titulo: "Atividade", render: (l) => esc(l.descricao) },
          {
            titulo: "Referência",
            render: (l) =>
              `<span class="mono small">${esc(l.ref ?? "")}</span>`,
            classe: "hide-sm",
          },
        ],
        linhas: pag.itens,
        vazio: "Nenhuma atividade registrada.",
      })}${paginacao(pag)}</div>`;
    return;
  }

  alvo.innerHTML = `<div class="card card-flush">${tabela({
    colunas: [
      {
        titulo: "Usuário",
        render: (u) =>
          `<div class="user-cell"><span class="avatar avatar-sm ${u.ativo ? "" : "is-off"}">${esc(iniciais(u.nome))}</span><span><strong>${esc(u.nome)}</strong>${u.id === atual.id ? ' <span class="badge badge-primary">Em uso</span>' : ""}<small class="cell-sub">${u.demo ? "Perfil de demonstração" : "Usuário de apoio (fictício)"}</small></span></div>`,
      },
      { titulo: "Função", render: (u) => esc(u.funcao) },
      { titulo: "Setor", render: (u) => esc(u.setor), classe: "hide-sm" },
      {
        titulo: "Perfil de acesso",
        render: (u) => esc(PERFIS[u.perfil].label),
      },
      {
        titulo: "Cidade base",
        render: (u) => esc(nomeCidade(u.cidade)),
        classe: "hide-sm",
      },
      {
        titulo: "Situação",
        render: (u) =>
          badgeTexto(
            u.ativo ? "Ativo" : "Inativo",
            u.ativo ? "success" : "neutral",
          ),
      },
      {
        titulo: "Ações",
        classe: "actions",
        render: (u) =>
          (u.demo && u.ativo && u.id !== atual.id
            ? `<button type="button" class="btn btn-ghost btn-sm" data-acao="usar" data-id="${u.id}">${icone("swap")}<span>Usar perfil</span></button>`
            : "") +
          (podeGerenciar && u.id !== atual.id
            ? `<button type="button" class="btn btn-ghost btn-sm" data-acao="alternar" data-id="${u.id}">${icone("power")}<span>${u.ativo ? "Desativar" : "Ativar"}</span></button>`
            : ""),
      },
    ],
    linhas: S.db().usuarios,
  })}</div>
  ${podeGerenciar ? "" : `<p class="muted small">${icone("lock")} Ativar e desativar usuários está disponível para Diretoria e Gerência nesta simulação.</p>`}`;
}

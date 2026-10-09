// Usuários fictícios e troca do perfil de demonstração (sem autenticação real).

import { PERFIS } from "../permissions.js";
import {
  db,
  obter,
  exigir,
  registrarLog,
  transacao,
  usuarioAtual,
  ErroNegocio,
} from "./core.js";

export function trocarPerfil(usuarioId) {
  return transacao(() => {
    const u = obter("usuarios", usuarioId, "Usuário");
    if (!u.demo)
      throw new ErroNegocio(
        "Este usuário não faz parte dos perfis de demonstração.",
      );
    if (!u.ativo)
      throw new ErroNegocio(
        `${u.nome} está inativo. Reative o usuário para utilizá-lo na demonstração.`,
      );
    db().sessao.usuarioId = u.id;
    return u;
  });
}

export function alternarUsuarioAtivo(usuarioId) {
  return transacao(() => {
    exigir("usuarios.gerenciar");
    const u = obter("usuarios", usuarioId, "Usuário");
    if (u.id === usuarioAtual().id)
      throw new ErroNegocio(
        "Não é possível desativar o próprio perfil em uso.",
      );
    u.ativo = !u.ativo;
    registrarLog(
      "Usuários",
      `${u.nome} (${PERFIS[u.perfil].label}) ${u.ativo ? "ativado" : "desativado"}`,
      u.id,
    );
    return u;
  });
}

// Núcleo dos serviços: relógio, usuário ativo, permissões, identificadores,
// auditoria e transações. Os módulos de interface nunca alteram o estado
// diretamente; sempre passam por uma função de serviço.

import { store } from "../storage.js";
import {
  podeExecutar,
  acao,
  perfisAutorizados,
  PERFIS,
} from "../permissions.js";
import { isoData } from "../utils.js";

export class ErroNegocio extends Error {
  constructor(mensagem) {
    super(mensagem);
    this.name = "ErroNegocio";
  }
}

// ---------- Relógio (substituível durante a geração dos dados de demonstração) ----------

let relogio = null;

export function definirRelogio(data) {
  relogio = data ? new Date(data) : null;
}

export function agora() {
  return relogio ? new Date(relogio) : new Date();
}

export function hoje() {
  return isoData(agora());
}

// ---------- Acesso ao estado ----------

export const db = () => store.state;

export function buscar(colecao, id) {
  if (!id) return null;
  return db()[colecao].find((x) => x.id === id) ?? null;
}

export function obter(colecao, id, nome = "Registro") {
  const r = buscar(colecao, id);
  if (!r) throw new ErroNegocio(`${nome} não encontrado.`);
  return r;
}

// ---------- Perfil ativo e permissões simuladas ----------

export function usuarioAtual() {
  const s = db();
  if (!s) return null;
  return s.usuarios.find((u) => u.id === s.sessao.usuarioId) ?? null;
}

export function pode(idAcao) {
  return podeExecutar(usuarioAtual(), idAcao);
}

export function exigir(idAcao) {
  const u = usuarioAtual();
  if (!podeExecutar(u, idAcao)) {
    const perfil = u ? PERFIS[u.perfil]?.label : "sem perfil";
    throw new ErroNegocio(
      `O perfil ${perfil} não pode "${acao(idAcao)?.label ?? idAcao}". ` +
        `Nesta simulação, apenas: ${perfisAutorizados(idAcao)}.`,
    );
  }
  return u;
}

// ---------- Identificadores ----------

export function proximoId(prefixo, digitos = 4) {
  const s = db();
  s.seq[prefixo] = (s.seq[prefixo] ?? 0) + 1;
  return `${prefixo}-${String(s.seq[prefixo]).padStart(digitos, "0")}`;
}

// ---------- Auditoria ----------

export function registrarLog(modulo, descricao, ref = null) {
  db().auditoria.push({
    id: proximoId("LOG", 5),
    dataHora: agora().toISOString(),
    usuarioId: usuarioAtual()?.id ?? null,
    modulo,
    descricao,
    ref,
  });
}

export function eventoHistorico(descricao, extra = {}) {
  return {
    dataHora: agora().toISOString(),
    usuarioId: usuarioAtual()?.id ?? null,
    descricao,
    ...extra,
  };
}

// ---------- Transações ----------
// Se qualquer validação falhar no meio de uma operação, o estado anterior é
// restaurado — assim nenhuma operação fica pela metade (ex.: saída de estoque
// sem o registro correspondente na ordem de serviço).

let profundidade = 0;

export function transacao(fn) {
  if (store.silencioso || profundidade > 0) {
    profundidade += 1;
    try {
      return fn();
    } finally {
      profundidade -= 1;
    }
  }
  const copia = structuredClone(store.state);
  profundidade = 1;
  try {
    const resultado = fn();
    profundidade = 0;
    store.commit();
    return resultado;
  } catch (erro) {
    profundidade = 0;
    store.substituir(copia);
    throw erro;
  }
}

// ---------- Validações reutilizáveis ----------

export function exigirTexto(valor, campo, minimo = 1) {
  const t = String(valor ?? "").trim();
  if (t.length < minimo) {
    throw new ErroNegocio(
      minimo > 1
        ? `Informe ${campo} com pelo menos ${minimo} caracteres.`
        : `Informe ${campo}.`,
    );
  }
  return t;
}

export function exigirNumero(
  valor,
  campo,
  { min = 0, max = Infinity, inteiro = false, maiorQueZero = false } = {},
) {
  const n = Number(valor);
  if (
    valor === "" ||
    valor === null ||
    valor === undefined ||
    Number.isNaN(n)
  ) {
    throw new ErroNegocio(`Informe ${campo}.`);
  }
  if (inteiro && !Number.isInteger(n))
    throw new ErroNegocio(`${campo} deve ser um número inteiro.`);
  if (maiorQueZero && n <= 0)
    throw new ErroNegocio(`${campo} deve ser maior que zero.`);
  if (n < min) throw new ErroNegocio(`${campo} não pode ser menor que ${min}.`);
  if (n > max) throw new ErroNegocio(`${campo} não pode ser maior que ${max}.`);
  return n;
}

export function exigirData(
  valor,
  campo = "a data",
  { permitirFutura = false } = {},
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(valor ?? "")))
    throw new ErroNegocio(`Informe ${campo}.`);
  if (!permitirFutura && valor > hoje())
    throw new ErroNegocio(
      `${campo[0].toUpperCase()}${campo.slice(1)} não pode ser posterior a hoje.`,
    );
  return valor;
}

export function exigirOpcao(valor, opcoes, campo) {
  if (!Object.prototype.hasOwnProperty.call(opcoes, valor))
    throw new ErroNegocio(`Selecione ${campo}.`);
  return valor;
}

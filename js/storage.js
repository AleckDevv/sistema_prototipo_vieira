// Estado em memória + persistência no LocalStorage do navegador.
// A persistência local serve apenas à demonstração: os dados ficam somente neste
// navegador, não são sincronizados e podem ser apagados ao limpar os dados do site.

const CHAVE = "vieira-gestao-operacional:demo";

let estado = null;
let silencio = 0;
let falhouAoSalvar = false;
const ouvintes = new Set();

export const store = {
  get state() {
    return estado;
  },
  substituir(novo) {
    estado = novo;
  },
  /** Persiste e notifica a interface. Ignorado durante a geração dos dados iniciais. */
  commit() {
    if (silencio > 0) return;
    persistir();
    ouvintes.forEach((fn) => fn());
  },
  assinar(fn) {
    ouvintes.add(fn);
    return () => ouvintes.delete(fn);
  },
  emSilencio(fn) {
    silencio += 1;
    try {
      return fn();
    } finally {
      silencio -= 1;
    }
  },
  get silencioso() {
    return silencio > 0;
  },
  get falhouAoSalvar() {
    return falhouAoSalvar;
  },
};

export function carregar() {
  try {
    const bruto = localStorage.getItem(CHAVE);
    return bruto ? JSON.parse(bruto) : null;
  } catch {
    return null;
  }
}

export function persistir() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(estado));
    falhouAoSalvar = false;
  } catch {
    // Modo privado ou cota excedida: a demonstração continua funcionando em memória.
    falhouAoSalvar = true;
  }
}

export function limpar() {
  try {
    localStorage.removeItem(CHAVE);
  } catch {
    /* sem acesso ao armazenamento */
  }
}

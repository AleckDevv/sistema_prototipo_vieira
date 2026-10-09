// Alternância entre modo claro e escuro.
// A escolha fica guardada apenas neste navegador (conveniência visual, separada
// dos dados da demonstração). Sem escolha salva, acompanha o tema do sistema.

const CHAVE = 'vieira-gestao-operacional:tema';
const COR_BARRA = { light: '#ffffff', dark: '#151e2b' };

function lerEscolha() {
  try {
    return localStorage.getItem(CHAVE);
  } catch {
    return null;
  }
}

function salvarEscolha(valor) {
  try {
    localStorage.setItem(CHAVE, valor);
  } catch {
    /* modo privado: vale só para esta sessão */
  }
}

export function temaAtual() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function aplicar(tema) {
  document.documentElement.setAttribute('data-theme', tema);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COR_BARRA[tema]);
  for (const botao of document.querySelectorAll('[data-alternar-tema]')) {
    const escuro = tema === 'dark';
    botao.setAttribute('aria-pressed', String(escuro));
    botao.setAttribute('aria-label', escuro ? 'Usar modo claro' : 'Usar modo escuro');
    botao.title = escuro ? 'Usar modo claro' : 'Usar modo escuro';
  }
}

export function alternarTema() {
  const novo = temaAtual() === 'dark' ? 'light' : 'dark';
  salvarEscolha(novo === 'dark' ? 'escuro' : 'claro');
  aplicar(novo);
  return novo;
}

export function iniciarTema() {
  aplicar(temaAtual());
  // Sem escolha salva, acompanha mudanças do tema do sistema (ex.: modo noturno automático).
  const consulta = window.matchMedia?.('(prefers-color-scheme: dark)');
  consulta?.addEventListener?.('change', (e) => {
    if (!lerEscolha()) aplicar(e.matches ? 'dark' : 'light');
  });
}

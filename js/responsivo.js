// Ajuste automático de tabelas e abas ao espaço disponível.
// Se uma tabela não couber no contêiner (em qualquer largura de tela), ela passa a
// ser exibida como cartões "rótulo: valor"; se as abas não couberem, viram uma grade.
// Assim nenhuma tela depende de rolagem horizontal.

let agendado = false;

function ajustar() {
  agendado = false;
  for (const wrap of document.querySelectorAll('.table-wrap:not(.table-scroll)')) {
    wrap.classList.remove('as-cards');
    if (wrap.clientWidth && wrap.scrollWidth > wrap.clientWidth + 1) wrap.classList.add('as-cards');
  }
  for (const abas of document.querySelectorAll('.tabs')) {
    abas.classList.remove('tabs-grid');
    if (abas.clientWidth && abas.scrollWidth > abas.clientWidth + 1) abas.classList.add('tabs-grid');
  }
}

function agendar() {
  if (agendado) return;
  agendado = true;
  requestAnimationFrame(ajustar);
}

export function iniciarAjusteResponsivo() {
  // Reavalia sempre que o conteúdo muda (telas, abas, filtros, modais) ou a janela é redimensionada.
  new MutationObserver(agendar).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('resize', agendar);
  window.addEventListener('orientationchange', agendar);
  agendar();
}

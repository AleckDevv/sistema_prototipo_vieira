// Aplica o tema (claro/escuro) antes da primeira pintura, evitando o "piscar"
// branco ao abrir no modo escuro. Script clássico carregado no <head>.
// Escolha salva pelo usuário tem prioridade; sem escolha, segue o sistema.
(function () {
  var escolha = null;
  try {
    escolha = localStorage.getItem('vieira-gestao-operacional:tema');
  } catch (e) {
    /* armazenamento indisponível: segue o sistema */
  }
  var sistemaEscuro = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  var escuro = escolha ? escolha === 'escuro' : sistemaEscuro;
  document.documentElement.setAttribute('data-theme', escuro ? 'dark' : 'light');
})();

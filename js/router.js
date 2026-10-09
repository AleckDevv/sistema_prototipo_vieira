// Rotas por hash: #/pagina/identificador?filtro=valor

export const IDS_PAGINAS = [
  "dashboard",
  "veiculos",
  "manutencao",
  "compras",
  "estoque",
  "pecas",
  "abastecimento",
  "despesas",
  "relatorios",
  "usuarios",
];

export function rotaAtual() {
  const bruto = location.hash.replace(/^#\/?/, "");
  const [caminho, query] = bruto.split("?");
  const [pagina, param] = (caminho || "dashboard").split("/");
  return {
    pagina: IDS_PAGINAS.includes(pagina) ? pagina : "dashboard",
    param: decodeURIComponent(param || ""),
    query: new URLSearchParams(query || ""),
  };
}

/**
 * Retorna uma função que remove da rota o identificador de um detalhe aberto por link
 * (ex.: #/compras/SC-0013) quando ele é fechado, sem renavegar. Só age se a rota atual
 * ainda for a que abriu o detalhe — ao voltar no navegador, a nova rota é preservada.
 */
export function limparParametroRota(pagina, identificador) {
  return () => {
    const atual = rotaAtual();
    const mesmo =
      atual.param === identificador ||
      atual.query.get("material") === identificador;
    if (atual.pagina === pagina && mesmo)
      history.replaceState(null, "", `#/${pagina}`);
  };
}

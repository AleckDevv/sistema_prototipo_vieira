// Catálogos e rótulos compartilhados por todos os módulos.
// Os identificadores (chaves) são usados nos registros; os rótulos apenas na interface.

export const VERSAO_DADOS = 3;

export const CIDADES = [
  { id: "teresina", nome: "Teresina" },
  { id: "jatoba", nome: "Jatobá" },
  { id: "oeiras", nome: "Oeiras" },
  { id: "angical", nome: "Angical" },
];

export const SITUACOES_VEICULO = {
  operacao: { label: "Em operação", tom: "info" },
  disponivel: { label: "Disponível", tom: "success" },
  manutencao: { label: "Em manutenção", tom: "warning" },
  inativo: { label: "Inativo", tom: "neutral" },
};

export const STATUS_SOLICITACAO = {
  aberta: { label: "Aberta", tom: "info" },
  analise: { label: "Em análise", tom: "info" },
  aguardando_pecas: { label: "Aguardando peças", tom: "warning" },
  execucao: { label: "Em execução", tom: "primary" },
  concluida: { label: "Concluída", tom: "success" },
  cancelada: { label: "Cancelada", tom: "neutral" },
};

export const STATUS_SOLICITACAO_ATIVOS = [
  "aberta",
  "analise",
  "aguardando_pecas",
  "execucao",
];

export const PRIORIDADES = {
  baixa: { label: "Baixa", tom: "neutral", peso: 1 },
  media: { label: "Média", tom: "info", peso: 2 },
  alta: { label: "Alta", tom: "warning", peso: 3 },
  critica: { label: "Crítica", tom: "danger", peso: 4 },
};

export const STATUS_OS = {
  andamento: { label: "Em andamento", tom: "primary" },
  concluida: { label: "Concluída", tom: "success" },
};

export const STATUS_COMPRA = {
  aguardando: { label: "Aguardando aprovação", tom: "warning" },
  aprovada: { label: "Aprovada", tom: "info" },
  em_compra: { label: "Pedido realizado", tom: "primary" },
  recebida: { label: "Recebida", tom: "success" },
  rejeitada: { label: "Rejeitada", tom: "danger" },
};

export const STATUS_DESPESA = {
  lancada: { label: "Aguardando conferência", tom: "warning" },
  conferida: { label: "Conferida", tom: "success" },
  cancelada: { label: "Cancelada", tom: "neutral" },
};

export const CATEGORIAS_DESPESA = {
  combustivel: { label: "Combustível" },
  pecas: { label: "Peças" },
  manutencao: { label: "Manutenção" },
  pneus_baterias: { label: "Pneus e baterias", curto: "Pneus e bat." },
  servicos_externos: { label: "Serviços externos", curto: "Serviços ext." },
  outras: { label: "Outras despesas operacionais", curto: "Outras" },
};

export const CATEGORIAS_MATERIAL = {
  pneus: { label: "Pneus" },
  baterias: { label: "Baterias" },
  filtros: { label: "Filtros" },
  lubrificantes: { label: "Lubrificantes" },
  pecas: { label: "Peças mecânicas" },
  eletrica: { label: "Elétrica" },
  outros: { label: "Outros materiais" },
};

export const UNIDADES_MEDIDA = [
  "un",
  "L",
  "kg",
  "jogo",
  "kit",
  "pct",
  "cx",
  "par",
];

export const TIPOS_MOVIMENTO = {
  entrada: { label: "Entrada", tom: "success" },
  saida: { label: "Saída", tom: "info" },
  ajuste: { label: "Ajuste", tom: "warning" },
};

export const TIPOS_DESTINACAO = {
  instalacao: { label: "Instalação", tom: "primary" },
  substituicao: { label: "Substituição", tom: "info" },
  reposicao: { label: "Reposição de consumo", tom: "neutral" },
  retirada: { label: "Retirada", tom: "warning" },
  aplicacao_os: { label: "Aplicação em OS", tom: "success" },
};

export const STATUS_UNIDADE = {
  estoque: { label: "Em estoque", tom: "info" },
  instalado: { label: "Instalado", tom: "success" },
  recapagem: { label: "Em recapagem", tom: "warning" },
  descartado: { label: "Descartado", tom: "neutral" },
};

export const DESTINOS_RETIRADA = {
  estoque: "Retorno ao estoque",
  recapagem: "Envio para recapagem",
  descarte: "Descarte",
};

export const POSICOES_PNEU = [
  "Dianteiro esquerdo",
  "Dianteiro direito",
  "Tração esquerdo externo",
  "Tração esquerdo interno",
  "Tração direito externo",
  "Tração direito interno",
  "Truck esquerdo externo",
  "Truck direito externo",
  "Estepe",
];

export const POSICOES_BATERIA = ["Bateria 1", "Bateria 2"];

export const POSTOS = [
  "Posto Rota 316",
  "Posto Avenida Sul",
  "Posto Serra Azul",
  "Posto Canindé",
  "Posto Trevo Norte",
];

export const FORNECEDORES = [
  "Central Autopeças",
  "Recapadora Nordeste",
  "Baterias Forte",
  "Lubrificantes Delta",
  "Diesel Parts Distribuidora",
];

export const PERIODOS = {
  mes: "Este mês",
  "30d": "Últimos 30 dias",
  "90d": "Últimos 90 dias",
  ano: "Este ano",
  tudo: "Todo o período",
  personalizado: "Personalizado",
};

export const nomeCidade = (id) => CIDADES.find((c) => c.id === id)?.nome ?? "—";

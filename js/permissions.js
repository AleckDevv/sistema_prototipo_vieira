// Simulação de permissões por perfil.
// Importante: isto NÃO é uma barreira de segurança. Qualquer pessoa com acesso ao
// navegador pode alterar o código ou o LocalStorage. Em produção, as permissões
// precisam ser validadas no servidor.

export const PERFIS = {
  diretor: {
    label: "Diretoria",
    descricao:
      "Aprova ou rejeita solicitações de compra e acompanha todos os indicadores.",
  },
  gerente: {
    label: "Gerência",
    descricao:
      "Consulta indicadores operacionais e relatórios, cadastra veículos e acompanha a operação.",
  },
  oficina: {
    label: "Oficina",
    descricao:
      "Gerencia solicitações mecânicas, ordens de serviço e aplicação de peças.",
  },
  comprador: {
    label: "Compras",
    descricao: "Cria solicitações de compra, registra pedidos e recebimentos.",
  },
  financeiro: {
    label: "Financeiro",
    descricao: "Registra e confere despesas e consulta relatórios financeiros.",
  },
  fiscal: {
    label: "Fiscal",
    descricao:
      "Registra quilometragem, abastecimentos e movimentações de peças autorizadas.",
  },
  operacional: {
    label: "Operacional",
    descricao:
      "Mantém o cadastro da frota, registra abastecimentos e abre solicitações mecânicas.",
  },
  mecanico: {
    label: "Mecânico",
    descricao:
      "Executa ordens de serviço e registra observações nas solicitações.",
  },
};

export const ACOES = [
  {
    id: "veiculos.gerenciar",
    grupo: "Veículos",
    label: "Cadastrar e editar veículos",
    perfis: ["operacional", "gerente", "diretor"],
  },
  {
    id: "veiculos.situacao",
    grupo: "Veículos",
    label: "Alterar situação operacional do veículo",
    perfis: ["operacional", "gerente", "oficina"],
  },
  {
    id: "manutencao.solicitar",
    grupo: "Manutenção",
    label: "Abrir solicitação mecânica e registrar observações",
    perfis: ["oficina", "operacional", "fiscal", "gerente", "mecanico"],
  },
  {
    id: "manutencao.gerenciar",
    grupo: "Manutenção",
    label: "Gerenciar solicitações e ordens de serviço",
    perfis: ["oficina"],
  },
  {
    id: "compras.criar",
    grupo: "Compras",
    label: "Criar solicitação de compra",
    perfis: ["comprador"],
  },
  {
    id: "compras.decidir",
    grupo: "Compras",
    label: "Aprovar ou rejeitar solicitação de compra",
    perfis: ["diretor"],
  },
  {
    id: "compras.acompanhar",
    grupo: "Compras",
    label: "Registrar pedido junto ao fornecedor",
    perfis: ["comprador"],
  },
  {
    id: "compras.receber",
    grupo: "Compras",
    label: "Registrar recebimento e entrada no estoque",
    perfis: ["comprador", "fiscal"],
  },
  {
    id: "estoque.cadastrar",
    grupo: "Estoque",
    label: "Cadastrar e editar materiais",
    perfis: ["comprador", "fiscal", "oficina"],
  },
  {
    id: "estoque.movimentar",
    grupo: "Estoque",
    label: "Registrar entradas e saídas de estoque",
    perfis: ["fiscal", "oficina"],
  },
  {
    id: "estoque.ajustar",
    grupo: "Estoque",
    label: "Ajustar inventário e baixar unidades",
    perfis: ["fiscal", "gerente"],
  },
  {
    id: "pecas.destinar",
    grupo: "Peças por veículo",
    label: "Destinar e retirar peças por placa",
    perfis: ["fiscal", "oficina"],
  },
  {
    id: "abastecimento.registrar",
    grupo: "Abastecimento",
    label: "Registrar abastecimento e quilometragem",
    perfis: ["fiscal", "operacional"],
  },
  {
    id: "despesas.consultar",
    grupo: "Despesas",
    label: "Consultar despesas e gastos",
    perfis: ["financeiro", "gerente", "diretor"],
  },
  {
    id: "despesas.registrar",
    grupo: "Despesas",
    label: "Registrar despesas",
    perfis: ["financeiro"],
  },
  {
    id: "despesas.conferir",
    grupo: "Despesas",
    label: "Conferir ou cancelar despesas",
    perfis: ["financeiro"],
  },
  {
    id: "relatorios.consultar",
    grupo: "Relatórios",
    label: "Consultar relatórios gerenciais",
    perfis: ["financeiro", "gerente", "diretor"],
  },
  {
    id: "usuarios.gerenciar",
    grupo: "Usuários",
    label: "Ativar ou desativar usuários",
    perfis: ["diretor", "gerente"],
  },
];

const MAPA_ACOES = Object.fromEntries(ACOES.map((a) => [a.id, a]));

export function acao(id) {
  return MAPA_ACOES[id];
}

export function podeExecutar(usuario, idAcao) {
  if (!usuario || !usuario.ativo) return false;
  const a = MAPA_ACOES[idAcao];
  return Boolean(a && a.perfis.includes(usuario.perfil));
}

/** Texto curto com os perfis autorizados, usado em dicas de botões bloqueados. */
export function perfisAutorizados(idAcao) {
  const a = MAPA_ACOES[idAcao];
  if (!a) return "";
  return a.perfis.map((p) => PERFIS[p]?.label ?? p).join(", ");
}

// Páginas com acesso restrito (as demais são visíveis a todos os perfis).
export const PAGINAS_RESTRITAS = {
  despesas: "despesas.consultar",
  relatorios: "relatorios.consultar",
};

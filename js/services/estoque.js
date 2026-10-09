// Estoque, inventário, unidades rastreáveis (pneus e baterias) e destinação de peças por placa.
// Toda alteração de saldo passa por entradaInterna/saidaInterna/ajuste, que gravam
// um movimento com o saldo resultante. Nenhuma operação deixa o saldo negativo.

import {
  CATEGORIAS_MATERIAL,
  CIDADES,
  UNIDADES_MEDIDA,
  TIPOS_DESTINACAO,
  DESTINOS_RETIRADA,
} from "../constants.js";
import {
  db,
  buscar,
  obter,
  exigir,
  proximoId,
  registrarLog,
  eventoHistorico,
  transacao,
  usuarioAtual,
  agora,
  hoje,
  ErroNegocio,
  exigirTexto,
  exigirNumero,
  exigirData,
  exigirOpcao,
} from "./core.js";
import { arred, fmt } from "../utils.js";

export const FRACIONAVEIS = ["L", "kg"];

export function saldo(material) {
  if (!material) return 0;
  if (material.rastreavel) {
    return db().unidades.filter(
      (u) => u.materialId === material.id && u.status === "estoque",
    ).length;
  }
  return material.quantidade;
}

function validarQuantidade(material, valor, campo = "A quantidade") {
  const q = exigirNumero(valor, campo, { maiorQueZero: true, max: 100000 });
  if (!FRACIONAVEIS.includes(material.unidade) && !Number.isInteger(q)) {
    throw new ErroNegocio(
      `${campo} de "${material.nome}" deve ser um número inteiro (${material.unidade}).`,
    );
  }
  return arred(q, 3);
}

function cidadeValida(cidade) {
  if (!CIDADES.some((c) => c.id === cidade))
    throw new ErroNegocio("Selecione a cidade ou localidade.");
  return cidade;
}

function novoMovimento({
  material,
  tipo,
  motivo,
  quantidade,
  delta,
  data,
  cidade,
  veiculoId = null,
  ref = null,
  unidadeIds = [],
  observacao = "",
  custoUnitario,
}) {
  const mov = {
    id: proximoId("MV", 5),
    data,
    dataHora: agora().toISOString(),
    materialId: material.id,
    tipo,
    motivo,
    quantidade: arred(quantidade, 3),
    delta: arred(delta, 3),
    saldoApos: saldo(material),
    custoUnitario: arred(custoUnitario ?? material.custoUnitario),
    usuarioId: usuarioAtual()?.id ?? null,
    cidade: cidade || material.deposito,
    veiculoId,
    ref,
    unidadeIds,
    observacao: String(observacao || "").trim(),
  };
  db().movimentos.push(mov);
  return mov;
}

function proximaSerie(material) {
  const s = db();
  const chave = `UN:${material.codigo}`;
  s.seq[chave] = (s.seq[chave] ?? 0) + 1;
  return `${material.codigo}-${String(s.seq[chave]).padStart(4, "0")}`;
}

export function criarUnidade(
  material,
  {
    status = "estoque",
    veiculoId = null,
    posicao = "",
    dataInstalacao = null,
    descricao,
  },
) {
  const u = {
    id: proximoId("UN", 5),
    serie: proximaSerie(material),
    materialId: material.id,
    status,
    veiculoId,
    posicao,
    dataInstalacao,
    historico: [eventoHistorico(descricao)],
  };
  db().unidades.push(u);
  return u;
}

// ---------- Operações internas (chamadas por compras, OS e destinação) ----------

export function entradaInterna({
  material,
  quantidade,
  custoUnitario,
  motivo,
  ref = null,
  data,
  cidade,
  observacao = "",
}) {
  const q = validarQuantidade(material, quantidade);
  const saldoAnterior = saldo(material);
  const unidadeIds = [];
  if (material.rastreavel) {
    for (let i = 0; i < q; i += 1) {
      unidadeIds.push(
        criarUnidade(material, { descricao: `Entrada no estoque — ${motivo}` })
          .id,
      );
    }
  } else {
    material.quantidade = arred(material.quantidade + q, 3);
  }
  if (custoUnitario && custoUnitario > 0) {
    // Custo médio ponderado.
    const total = saldoAnterior * material.custoUnitario + q * custoUnitario;
    material.custoUnitario = arred(total / (saldoAnterior + q));
  }
  return novoMovimento({
    material,
    tipo: "entrada",
    motivo,
    quantidade: q,
    delta: q,
    data,
    cidade,
    ref,
    unidadeIds,
    observacao,
    custoUnitario: custoUnitario || material.custoUnitario,
  });
}

export function saidaInterna({
  material,
  quantidade,
  unidadeIds = [],
  veiculoId = null,
  posicao = "",
  motivo,
  ref = null,
  data,
  cidade,
  observacao = "",
}) {
  let q;
  if (material.rastreavel) {
    const ids = [...new Set(unidadeIds)];
    if (!ids.length)
      throw new ErroNegocio(
        `Selecione as unidades de "${material.nome}" (controle individual).`,
      );
    for (const id of ids) {
      const u = obter("unidades", id, "Unidade");
      if (u.materialId !== material.id)
        throw new ErroNegocio(
          `A unidade ${u.serie} não pertence a "${material.nome}".`,
        );
      if (u.status !== "estoque")
        throw new ErroNegocio(
          `A unidade ${u.serie} não está disponível em estoque.`,
        );
    }
    for (const id of ids) {
      const u = buscar("unidades", id);
      if (veiculoId) {
        u.status = "instalado";
        u.veiculoId = veiculoId;
        u.posicao = posicao || "";
        u.dataInstalacao = data;
        u.historico.push(
          eventoHistorico(`${motivo}${posicao ? ` (${posicao})` : ""}`, {
            veiculoId,
          }),
        );
      } else {
        u.status = "descartado";
        u.historico.push(eventoHistorico(motivo));
      }
    }
    q = ids.length;
    unidadeIds = ids;
  } else {
    q = validarQuantidade(material, quantidade);
    if (q > material.quantidade) {
      throw new ErroNegocio(
        `Saldo insuficiente de "${material.nome}": disponível ${fmt.numero(material.quantidade, FRACIONAVEIS.includes(material.unidade) ? 1 : 0)} ${material.unidade}. O estoque não pode ficar negativo.`,
      );
    }
    material.quantidade = arred(material.quantidade - q, 3);
  }
  return novoMovimento({
    material,
    tipo: "saida",
    motivo,
    quantidade: q,
    delta: -q,
    data,
    cidade,
    veiculoId,
    ref,
    unidadeIds,
    observacao,
  });
}

// ---------- Cadastro de materiais ----------

export function cadastrarMaterial(dados) {
  return transacao(() => {
    exigir("estoque.cadastrar");
    const codigo = exigirTexto(dados.codigo, "o código", 3).toUpperCase();
    if (db().materiais.some((m) => m.codigo === codigo))
      throw new ErroNegocio(`Já existe um material com o código ${codigo}.`);
    const material = {
      id: proximoId("MAT", 3),
      codigo,
      nome: exigirTexto(dados.nome, "o nome do material", 3),
      categoria: exigirOpcao(
        dados.categoria,
        CATEGORIAS_MATERIAL,
        "a categoria",
      ),
      unidade: UNIDADES_MEDIDA.includes(dados.unidade)
        ? dados.unidade
        : (() => {
            throw new ErroNegocio("Selecione a unidade de medida.");
          })(),
      quantidade: 0,
      minimo: exigirNumero(dados.minimo, "O estoque mínimo", {
        min: 0,
        max: 100000,
      }),
      custoUnitario: arred(
        exigirNumero(dados.custoUnitario, "O custo unitário", {
          maiorQueZero: true,
          max: 1_000_000,
        }),
      ),
      deposito: cidadeValida(dados.deposito),
      rastreavel: Boolean(dados.rastreavel),
      criadoEm: hoje(),
    };
    if (material.rastreavel && FRACIONAVEIS.includes(material.unidade)) {
      throw new ErroNegocio(
        "Itens com controle individual devem usar unidade inteira (ex.: un).",
      );
    }
    db().materiais.push(material);
    const inicial = Number(dados.quantidadeInicial || 0);
    if (inicial > 0) {
      entradaInterna({
        material,
        quantidade: inicial,
        motivo: "Saldo inicial de cadastro",
        data: hoje(),
        cidade: material.deposito,
      });
    }
    registrarLog(
      "Estoque",
      `Material ${material.codigo} — ${material.nome} cadastrado`,
      material.id,
    );
    return material;
  });
}

export function editarMaterial(id, dados) {
  return transacao(() => {
    exigir("estoque.cadastrar");
    const m = obter("materiais", id, "Material");
    m.nome = exigirTexto(dados.nome, "o nome do material", 3);
    m.categoria = exigirOpcao(
      dados.categoria,
      CATEGORIAS_MATERIAL,
      "a categoria",
    );
    m.minimo = exigirNumero(dados.minimo, "O estoque mínimo", {
      min: 0,
      max: 100000,
    });
    m.custoUnitario = arred(
      exigirNumero(dados.custoUnitario, "O custo unitário", {
        maiorQueZero: true,
        max: 1_000_000,
      }),
    );
    m.deposito = cidadeValida(dados.deposito);
    registrarLog("Estoque", `Material ${m.codigo} atualizado`, m.id);
    return m;
  });
}

// ---------- Movimentações manuais ----------

export function registrarEntrada({
  materialId,
  quantidade,
  data,
  custoUnitario,
  observacao,
  cidade,
}) {
  return transacao(() => {
    exigir("estoque.movimentar");
    const material = obter("materiais", materialId, "Material");
    exigirData(data, "a data da entrada");
    exigirTexto(observacao, "a origem/observação da entrada", 3);
    const custo =
      custoUnitario === "" || custoUnitario === undefined
        ? null
        : exigirNumero(custoUnitario, "O custo unitário", {
            maiorQueZero: true,
          });
    const mov = entradaInterna({
      material,
      quantidade,
      custoUnitario: custo,
      motivo: "Entrada manual",
      data,
      cidade: cidade || material.deposito,
      observacao,
    });
    registrarLog(
      "Estoque",
      `Entrada de ${fmt.numero(mov.quantidade, 1).replace(",0", "")} ${material.unidade} — ${material.nome}`,
      mov.id,
    );
    return mov;
  });
}

export const MOTIVOS_SAIDA = [
  "Consumo da oficina",
  "Transferência entre depósitos",
  "Avaria ou perda",
  "Devolução ao fornecedor",
];

export function registrarSaida({
  materialId,
  quantidade,
  data,
  motivo,
  observacao,
  cidade,
}) {
  return transacao(() => {
    exigir("estoque.movimentar");
    const material = obter("materiais", materialId, "Material");
    if (material.rastreavel) {
      throw new ErroNegocio(
        'Pneus e baterias com controle individual saem do estoque pela tela "Peças por veículo" (instalação) ou pela baixa da unidade.',
      );
    }
    exigirData(data, "a data da saída");
    if (!MOTIVOS_SAIDA.includes(motivo))
      throw new ErroNegocio("Selecione o motivo da saída.");
    const mov = saidaInterna({
      material,
      quantidade,
      motivo,
      data,
      cidade: cidade || material.deposito,
      observacao,
    });
    registrarLog(
      "Estoque",
      `Saída de ${mov.quantidade} ${material.unidade} — ${material.nome} (${motivo})`,
      mov.id,
    );
    return mov;
  });
}

export function ajustarInventario({
  materialId,
  quantidadeContada,
  justificativa,
}) {
  return transacao(() => {
    exigir("estoque.ajustar");
    const material = obter("materiais", materialId, "Material");
    if (material.rastreavel) {
      throw new ErroNegocio(
        "Itens com controle individual são ajustados por unidade (baixa de unidade ou nova entrada).",
      );
    }
    const contada = exigirNumero(quantidadeContada, "A quantidade contada", {
      min: 0,
      max: 100000,
    });
    if (
      !FRACIONAVEIS.includes(material.unidade) &&
      !Number.isInteger(contada)
    ) {
      throw new ErroNegocio("A quantidade contada deve ser um número inteiro.");
    }
    const just = exigirTexto(justificativa, "a justificativa do ajuste", 10);
    const diferenca = arred(contada - material.quantidade, 3);
    if (diferenca === 0)
      throw new ErroNegocio(
        "A quantidade contada é igual ao saldo do sistema. Nenhum ajuste é necessário.",
      );
    material.quantidade = arred(contada, 3);
    const mov = novoMovimento({
      material,
      tipo: "ajuste",
      motivo: "Ajuste de inventário",
      quantidade: Math.abs(diferenca),
      delta: diferenca,
      data: hoje(),
      cidade: material.deposito,
      observacao: just,
    });
    registrarLog(
      "Estoque",
      `Ajuste de inventário em ${material.codigo}: ${diferenca > 0 ? "+" : ""}${diferenca} ${material.unidade}`,
      mov.id,
    );
    return mov;
  });
}

export function baixarUnidade(unidadeId, justificativa) {
  return transacao(() => {
    exigir("estoque.ajustar");
    const u = obter("unidades", unidadeId, "Unidade");
    const material = obter("materiais", u.materialId, "Material");
    const just = exigirTexto(justificativa, "a justificativa da baixa", 10);
    if (!["estoque", "recapagem"].includes(u.status)) {
      throw new ErroNegocio(
        "Apenas unidades em estoque ou em recapagem podem ser baixadas. Unidades instaladas devem ser retiradas do veículo primeiro.",
      );
    }
    const estavaEmEstoque = u.status === "estoque";
    u.status = "descartado";
    u.historico.push(
      eventoHistorico("Unidade baixada (descarte)", { motivo: just }),
    );
    if (estavaEmEstoque) {
      novoMovimento({
        material,
        tipo: "ajuste",
        motivo: "Baixa de unidade",
        quantidade: 1,
        delta: -1,
        data: hoje(),
        cidade: material.deposito,
        unidadeIds: [u.id],
        observacao: just,
      });
    }
    registrarLog("Estoque", `Unidade ${u.serie} baixada: ${just}`, u.id);
    return u;
  });
}

export function receberDaRecapagem(unidadeId) {
  return transacao(() => {
    exigir("estoque.movimentar");
    const u = obter("unidades", unidadeId, "Unidade");
    if (u.status !== "recapagem")
      throw new ErroNegocio("A unidade não está em recapagem.");
    const material = obter("materiais", u.materialId, "Material");
    u.status = "estoque";
    u.historico.push(eventoHistorico("Retorno da recapagem ao estoque"));
    const mov = novoMovimento({
      material,
      tipo: "entrada",
      motivo: "Retorno de recapagem",
      quantidade: 1,
      delta: 1,
      data: hoje(),
      cidade: material.deposito,
      unidadeIds: [u.id],
    });
    registrarLog("Estoque", `Unidade ${u.serie} retornou da recapagem`, u.id);
    return mov;
  });
}

// ---------- Destinação de peças por placa ----------

function retirarUnidadeInterna(u, { destino, data, cidade, destinacaoId }) {
  if (!DESTINOS_RETIRADA[destino])
    throw new ErroNegocio("Selecione o destino da peça retirada.");
  const material = obter("materiais", u.materialId, "Material");
  const veiculoId = u.veiculoId;
  u.status =
    destino === "estoque"
      ? "estoque"
      : destino === "recapagem"
        ? "recapagem"
        : "descartado";
  u.historico.push(
    eventoHistorico(`Retirada do veículo — ${DESTINOS_RETIRADA[destino]}`, {
      veiculoId,
    }),
  );
  u.veiculoId = null;
  u.posicao = "";
  u.dataInstalacao = null;
  if (destino === "estoque") {
    novoMovimento({
      material,
      tipo: "entrada",
      motivo: "Retorno de veículo",
      quantidade: 1,
      delta: 1,
      data,
      cidade,
      veiculoId,
      ref: { tipo: "destinacao", id: destinacaoId },
      unidadeIds: [u.id],
    });
  }
}

export function destinarPeca(dados) {
  return transacao(() => {
    const usuario = exigir("pecas.destinar");
    const tipo = dados.tipo;
    if (!["instalacao", "substituicao", "reposicao"].includes(tipo))
      throw new ErroNegocio("Selecione o tipo de movimentação.");
    const veiculo = obter("veiculos", dados.veiculoId, "Veículo");
    if (veiculo.situacao === "inativo")
      throw new ErroNegocio(
        "Não é possível destinar peças a um veículo inativo.",
      );
    const material = obter("materiais", dados.materialId, "Material");
    const data = exigirData(dados.data, "a data");
    const cidade = cidadeValida(dados.cidade || veiculo.cidade);
    const id = proximoId("DS");

    const retiradas = [];
    if (
      tipo === "substituicao" &&
      material.rastreavel &&
      dados.retirarUnidadeIds?.length
    ) {
      for (const uid of dados.retirarUnidadeIds) {
        const u = obter("unidades", uid, "Unidade");
        if (u.status !== "instalado" || u.veiculoId !== veiculo.id) {
          throw new ErroNegocio(
            `A unidade ${u.serie} não está instalada no veículo ${veiculo.placa}.`,
          );
        }
        retiradas.push({ unidadeId: u.id, destino: dados.destinoRetirada });
      }
      if (!DESTINOS_RETIRADA[dados.destinoRetirada])
        throw new ErroNegocio("Selecione o destino da unidade retirada.");
    }

    const mov = saidaInterna({
      material,
      quantidade: dados.quantidade,
      unidadeIds: dados.unidadeIds || [],
      veiculoId: veiculo.id,
      posicao: dados.posicao || "",
      motivo: `${TIPOS_DESTINACAO[tipo].label} em ${veiculo.placa}`,
      ref: { tipo: "destinacao", id },
      data,
      cidade,
      observacao: dados.observacao,
    });

    for (const r of retiradas) {
      retirarUnidadeInterna(buscar("unidades", r.unidadeId), {
        destino: r.destino,
        data,
        cidade,
        destinacaoId: id,
      });
    }

    const destinacao = {
      id,
      data,
      dataHora: agora().toISOString(),
      veiculoId: veiculo.id,
      cidade,
      tipo,
      materialId: material.id,
      quantidade: mov.quantidade,
      unidadeIds: mov.unidadeIds,
      posicao: dados.posicao || "",
      usuarioId: usuario.id,
      observacao: String(dados.observacao || "").trim(),
      movimentoId: mov.id,
      ref: null,
      retiradas,
    };
    db().destinacoes.push(destinacao);
    registrarLog(
      "Peças por veículo",
      `${TIPOS_DESTINACAO[tipo].label}: ${mov.quantidade} ${material.unidade} de ${material.nome} na placa ${veiculo.placa}`,
      id,
    );
    return destinacao;
  });
}

export function registrarRetirada({
  unidadeId,
  destino,
  data,
  cidade,
  observacao,
}) {
  return transacao(() => {
    const usuario = exigir("pecas.destinar");
    const u = obter("unidades", unidadeId, "Unidade");
    if (u.status !== "instalado" || !u.veiculoId)
      throw new ErroNegocio(
        "A unidade selecionada não está instalada em um veículo.",
      );
    const veiculo = obter("veiculos", u.veiculoId, "Veículo");
    const material = obter("materiais", u.materialId, "Material");
    exigirData(data, "a data da retirada");
    if (!DESTINOS_RETIRADA[destino])
      throw new ErroNegocio("Selecione o destino da peça retirada.");
    const id = proximoId("DS");
    const local = cidadeValida(cidade || veiculo.cidade);
    const posicao = u.posicao;
    retirarUnidadeInterna(u, {
      destino,
      data,
      cidade: local,
      destinacaoId: id,
    });
    const destinacao = {
      id,
      data,
      dataHora: agora().toISOString(),
      veiculoId: veiculo.id,
      cidade: local,
      tipo: "retirada",
      materialId: material.id,
      quantidade: 1,
      unidadeIds: [u.id],
      posicao,
      usuarioId: usuario.id,
      observacao: [DESTINOS_RETIRADA[destino], String(observacao || "").trim()]
        .filter(Boolean)
        .join(" — "),
      movimentoId: null,
      ref: null,
      retiradas: [{ unidadeId: u.id, destino }],
    };
    db().destinacoes.push(destinacao);
    registrarLog(
      "Peças por veículo",
      `Retirada da unidade ${u.serie} da placa ${veiculo.placa} (${DESTINOS_RETIRADA[destino]})`,
      id,
    );
    return destinacao;
  });
}

/** Usado pelas ordens de serviço: baixa do estoque + registro da destinação em uma única operação. */
export function aplicarPecaEmOS({
  os,
  material,
  quantidade,
  unidadeIds,
  posicao,
  data,
}) {
  const veiculo = obter("veiculos", os.veiculoId, "Veículo");
  const id = proximoId("DS");
  const mov = saidaInterna({
    material,
    quantidade,
    unidadeIds,
    veiculoId: veiculo.id,
    posicao,
    motivo: `Aplicação na ${os.id}`,
    ref: { tipo: "os", id: os.id },
    data,
    cidade: os.cidade,
  });
  const destinacao = {
    id,
    data,
    dataHora: agora().toISOString(),
    veiculoId: veiculo.id,
    cidade: os.cidade,
    tipo: "aplicacao_os",
    materialId: material.id,
    quantidade: mov.quantidade,
    unidadeIds: mov.unidadeIds,
    posicao: posicao || "",
    usuarioId: usuarioAtual()?.id ?? null,
    observacao: `Peça aplicada na ${os.id}`,
    movimentoId: mov.id,
    ref: { tipo: "os", id: os.id },
    retiradas: [],
  };
  db().destinacoes.push(destinacao);
  return { mov, destinacao };
}

/** Estorno de peça lançada em OS por engano: devolve ao estoque e remove a destinação. */
export function estornarPecaDeOS({ os, linha }) {
  const material = obter("materiais", linha.materialId, "Material");
  if (material.rastreavel) {
    for (const uid of linha.unidadeIds) {
      const u = obter("unidades", uid, "Unidade");
      u.status = "estoque";
      u.historico.push(
        eventoHistorico(`Estorno da ${os.id} — retorno ao estoque`, {
          veiculoId: u.veiculoId,
        }),
      );
      u.veiculoId = null;
      u.posicao = "";
      u.dataInstalacao = null;
    }
  } else {
    material.quantidade = arred(material.quantidade + linha.quantidade, 3);
  }
  const mov = novoMovimento({
    material,
    tipo: "entrada",
    motivo: `Estorno da ${os.id}`,
    quantidade: linha.quantidade,
    delta: linha.quantidade,
    data: hoje(),
    cidade: os.cidade,
    veiculoId: os.veiculoId,
    ref: { tipo: "os", id: os.id },
    unidadeIds: linha.unidadeIds,
  });
  const lista = db().destinacoes;
  const i = lista.findIndex((d) => d.id === linha.destinacaoId);
  if (i >= 0) lista.splice(i, 1);
  return mov;
}

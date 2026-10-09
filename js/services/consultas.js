// Consultas e cálculos derivados (somente leitura). Todos os indicadores da
// interface são calculados aqui a partir dos registros — nenhum número é fixo.

import { STATUS_SOLICITACAO_ATIVOS, PRIORIDADES } from "../constants.js";
import { db, buscar, hoje } from "./core.js";
import { saldo } from "./estoque.js";
import { formatarPlaca } from "./frota.js";
import {
  agrupar,
  noPeriodo,
  somar,
  diasEntre,
  somarDias,
  fmt,
} from "../utils.js";

export const veiculo = (id) => buscar("veiculos", id);
export const material = (id) => buscar("materiais", id);
export const usuario = (id) => buscar("usuarios", id);
export const nomeUsuario = (id) => usuario(id)?.nome ?? "—";

export function rotuloVeiculo(v) {
  if (typeof v === "string") v = veiculo(v);
  return v ? `${v.frota} · ${formatarPlaca(v.placa)}` : "—";
}

export function veiculosOrdenados() {
  return [...db().veiculos].sort((a, b) =>
    a.frota.localeCompare(b.frota, "pt-BR", { numeric: true }),
  );
}

// ---------- Estoque ----------

export function situacaoEstoque(m) {
  const s = saldo(m);
  if (s <= 0) return { chave: "zerado", label: "Sem saldo", tom: "danger" };
  if (s < m.minimo)
    return { chave: "baixo", label: "Abaixo do mínimo", tom: "warning" };
  return { chave: "ok", label: "Normal", tom: "success" };
}

export function materiaisAbaixoDoMinimo({ cidade = "" } = {}) {
  return db().materiais.filter(
    (m) => saldo(m) < m.minimo && (!cidade || m.deposito === cidade),
  );
}

export function comprasAbertasDoMaterial(materialId) {
  return db().compras.filter(
    (c) =>
      ["aguardando", "aprovada", "em_compra"].includes(c.status) &&
      c.itens.some((i) => i.materialId === materialId),
  );
}

export function valorEmEstoque() {
  return somar(db().materiais, (m) => saldo(m) * m.custoUnitario);
}

export function pecasInstaladas(veiculoId) {
  return db().unidades.filter(
    (u) => u.status === "instalado" && u.veiculoId === veiculoId,
  );
}

// ---------- Combustível ----------

/**
 * Consumo médio (km/l) pelo método de tanque cheio: a distância entre duas leituras
 * consecutivas dividida pelos litros do abastecimento que fecha o trecho.
 * Trechos com quilometragem regressiva, sem leitura anterior ou com valores
 * implausíveis são descartados — não há cálculo com dados insuficientes.
 */
export function consumo({ veiculoIds = null, periodo = null } = {}) {
  const porVeiculo = new Map();
  let dist = 0;
  let litros = 0;
  let trechos = 0;
  let descartados = 0;
  for (const [vid, lista] of agrupar(db().abastecimentos, (a) => a.veiculoId)) {
    if (veiculoIds && !veiculoIds.has(vid)) continue;
    const ord = [...lista].sort(
      (a, b) => a.data.localeCompare(b.data) || a.km - b.km,
    );
    let d = 0;
    let l = 0;
    let t = 0;
    for (let i = 1; i < ord.length; i += 1) {
      const atual = ord[i];
      if (periodo && !noPeriodo(atual.data, periodo)) continue;
      const distancia = atual.km - ord[i - 1].km;
      const kml = distancia / atual.litros;
      if (distancia <= 0 || kml < 0.5 || kml > 30) {
        descartados += 1;
        continue;
      }
      d += distancia;
      l += atual.litros;
      t += 1;
    }
    if (t > 0)
      porVeiculo.set(vid, { dist: d, litros: l, trechos: t, kml: d / l });
    dist += d;
    litros += l;
    trechos += t;
  }
  return {
    porVeiculo,
    dist,
    litros,
    trechos,
    descartados,
    kml: trechos ? dist / litros : null,
  };
}

/** Consumo de referência por tipo de veículo (média ponderada da frota do mesmo tipo). */
export function consumoReferenciaPorTipo(periodo = null) {
  const { porVeiculo } = consumo({ periodo });
  const tipos = new Map();
  for (const [vid, c] of porVeiculo) {
    const v = veiculo(vid);
    if (!v) continue;
    const t = tipos.get(v.tipo) ?? { dist: 0, litros: 0 };
    t.dist += c.dist;
    t.litros += c.litros;
    tipos.set(v.tipo, t);
  }
  return new Map([...tipos].map(([tipo, t]) => [tipo, t.dist / t.litros]));
}

// ---------- Despesas ----------

export function despesasAtivas() {
  return db().despesas.filter((d) => d.status !== "cancelada");
}

// ---------- Alertas e notificações ----------

export function alertasOperacionais({ cidade = "", veiculoIds = null } = {}) {
  const s = db();
  const h = hoje();
  const alertas = [];
  const daCidade = (c) => !cidade || c === cidade;
  const doVeiculo = (id) => !veiculoIds || veiculoIds.has(id);

  for (const m of materiaisAbaixoDoMinimo({ cidade })) {
    const compras = comprasAbertasDoMaterial(m.id);
    alertas.push({
      tom: saldo(m) <= 0 ? "danger" : "warning",
      titulo: `${m.nome} abaixo do estoque mínimo`,
      detalhe: `Saldo ${fmt.numero(saldo(m), m.unidade === "L" || m.unidade === "kg" ? 1 : 0)} ${m.unidade} · mínimo ${m.minimo} ${m.unidade}${compras.length ? ` · compra em andamento (${compras.map((c) => c.id).join(", ")})` : " · sem compra em andamento"}`,
      rota: `#/estoque?material=${m.id}`,
      peso: saldo(m) <= 0 ? 3 : 2,
    });
  }

  for (const sol of s.solicitacoes) {
    if (
      !STATUS_SOLICITACAO_ATIVOS.includes(sol.status) ||
      !daCidade(sol.cidade) ||
      !doVeiculo(sol.veiculoId)
    )
      continue;
    if (sol.prioridade === "critica") {
      alertas.push({
        tom: "danger",
        titulo: `Solicitação crítica ${sol.id} — ${rotuloVeiculo(sol.veiculoId)}`,
        detalhe: `${sol.descricao} · aberta há ${diasEntre(sol.dataAbertura, h)} dia(s)`,
        rota: `#/manutencao/${sol.id}`,
        peso: 4,
      });
    } else if (sol.status === "aguardando_pecas") {
      alertas.push({
        tom: "warning",
        titulo: `Veículo ${rotuloVeiculo(sol.veiculoId)} parado aguardando peças`,
        detalhe: `${sol.id} · ${sol.descricao}`,
        rota: `#/manutencao/${sol.id}`,
        peso: 3,
      });
    } else if (
      sol.status === "aberta" &&
      PRIORIDADES[sol.prioridade].peso >= 3 &&
      diasEntre(sol.dataAbertura, h) >= 1
    ) {
      alertas.push({
        tom: "warning",
        titulo: `Solicitação ${sol.id} sem análise`,
        detalhe: `Prioridade ${PRIORIDADES[sol.prioridade].label.toLowerCase()} · ${rotuloVeiculo(sol.veiculoId)}`,
        rota: `#/manutencao/${sol.id}`,
        peso: 2,
      });
    }
  }

  for (const c of s.compras) {
    if (!daCidade(c.cidade)) continue;
    if (c.status === "aguardando" && diasEntre(c.data, h) >= 3) {
      alertas.push({
        tom: "warning",
        titulo: `Compra ${c.id} aguarda aprovação há ${diasEntre(c.data, h)} dias`,
        detalhe: fmt.moeda(c.valorEstimado),
        rota: `#/compras/${c.id}`,
        peso: 2,
      });
    }
    if (c.status === "em_compra" && c.pedido && c.pedido.previsaoEntrega < h) {
      alertas.push({
        tom: "warning",
        titulo: `Entrega da compra ${c.id} atrasada`,
        detalhe: `Previsão era ${fmt.data(c.pedido.previsaoEntrega)} · ${c.pedido.fornecedor}`,
        rota: `#/compras/${c.id}`,
        peso: 2,
      });
    }
  }

  const ref = consumoReferenciaPorTipo({ de: "0000-01-01", ate: h });
  const recente = consumo({ periodo: { de: somarDias(h, -30), ate: h } });
  for (const [vid, c] of recente.porVeiculo) {
    const v = veiculo(vid);
    if (!v || !daCidade(v.cidade) || !doVeiculo(vid) || c.trechos < 2) continue;
    const base = ref.get(v.tipo);
    if (base && c.kml < base * 0.85) {
      alertas.push({
        tom: "warning",
        titulo: `Consumo elevado no veículo ${rotuloVeiculo(v)}`,
        detalhe: `${fmt.kml(c.kml)} nos últimos 30 dias · referência do tipo ${fmt.kml(base)}`,
        rota: `#/veiculos/${v.id}`,
        peso: 1,
      });
    }
  }

  for (const v of s.veiculos) {
    if (
      !["operacao", "disponivel"].includes(v.situacao) ||
      !daCidade(v.cidade) ||
      !doVeiculo(v.id)
    )
      continue;
    if (diasEntre(v.kmAtualizadoEm, h) > 15) {
      alertas.push({
        tom: "info",
        titulo: `Veículo ${rotuloVeiculo(v)} sem leitura de km há ${diasEntre(v.kmAtualizadoEm, h)} dias`,
        detalhe: `Última leitura: ${fmt.km(v.km)} em ${fmt.data(v.kmAtualizadoEm)}`,
        rota: `#/veiculos/${v.id}`,
        peso: 1,
      });
    }
  }

  return alertas.sort((a, b) => b.peso - a.peso);
}

/** Pendências do perfil ativo, exibidas no sino do cabeçalho. */
export function notificacoes(u) {
  if (!u) return [];
  const s = db();
  const h = hoje();
  const lista = [];
  const add = (titulo, detalhe, rota, tom = "info") =>
    lista.push({ titulo, detalhe, rota, tom });
  const contar = (arr) => arr.length;

  const aguardando = s.compras.filter((c) => c.status === "aguardando");
  const aprovadas = s.compras.filter((c) => c.status === "aprovada");
  const emCompra = s.compras.filter((c) => c.status === "em_compra");
  const semDespesa = s.compras.filter(
    (c) => c.status === "recebida" && !c.despesaId,
  );
  const abertas = s.solicitacoes.filter((x) => x.status === "aberta");
  const aguardPecas = s.solicitacoes.filter(
    (x) => x.status === "aguardando_pecas",
  );
  const criticas = s.solicitacoes.filter(
    (x) =>
      STATUS_SOLICITACAO_ATIVOS.includes(x.status) &&
      x.prioridade === "critica",
  );
  const baixos = materiaisAbaixoDoMinimo();
  const aConferir = s.despesas.filter((d) => d.status === "lancada");
  const emManutencao = s.veiculos.filter((v) => v.situacao === "manutencao");

  switch (u.perfil) {
    case "diretor":
      if (aguardando.length)
        add(
          `${contar(aguardando)} compra(s) aguardando sua aprovação`,
          `Total estimado ${fmt.moeda(somar(aguardando, (c) => c.valorEstimado))}`,
          "#/compras?status=aguardando",
          "warning",
        );
      if (criticas.length)
        add(
          `${contar(criticas)} solicitação(ões) mecânica(s) crítica(s)`,
          criticas.map((c) => c.id).join(", "),
          "#/manutencao?prioridade=critica",
          "danger",
        );
      if (emManutencao.length)
        add(
          `${contar(emManutencao)} veículo(s) em manutenção`,
          "Acompanhe a disponibilidade da frota",
          "#/veiculos?situacao=manutencao",
        );
      break;
    case "comprador":
      if (aprovadas.length)
        add(
          `${contar(aprovadas)} compra(s) aprovada(s) aguardando pedido`,
          aprovadas.map((c) => c.id).join(", "),
          "#/compras?status=aprovada",
          "info",
        );
      if (emCompra.length)
        add(
          `${contar(emCompra)} pedido(s) aguardando recebimento`,
          emCompra.map((c) => c.id).join(", "),
          "#/compras?status=em_compra",
        );
      if (baixos.length)
        add(
          `${contar(baixos)} item(ns) abaixo do estoque mínimo`,
          "Avalie novas solicitações de compra",
          "#/estoque?filtro=baixo",
          "warning",
        );
      for (const c of s.compras.filter(
        (x) =>
          x.status === "rejeitada" &&
          x.decisao &&
          diasEntre(x.decisao.dataHora.slice(0, 10), h) <= 15,
      )) {
        add(
          `Compra ${c.id} rejeitada pela diretoria`,
          c.decisao.motivo,
          `#/compras/${c.id}`,
          "danger",
        );
      }
      break;
    case "oficina":
      if (abertas.length)
        add(
          `${contar(abertas)} solicitação(ões) aguardando análise`,
          abertas.map((x) => x.id).join(", "),
          "#/manutencao?status=aberta",
          "warning",
        );
      if (aguardPecas.length)
        add(
          `${contar(aguardPecas)} veículo(s) aguardando peças`,
          aguardPecas.map((x) => x.id).join(", "),
          "#/manutencao?status=aguardando_pecas",
          "warning",
        );
      if (baixos.length)
        add(
          `${contar(baixos)} item(ns) abaixo do estoque mínimo`,
          "Verifique antes de programar serviços",
          "#/estoque?filtro=baixo",
        );
      break;
    case "fiscal":
      if (emCompra.length)
        add(
          `${contar(emCompra)} compra(s) a receber`,
          "Registre o recebimento e a entrada no estoque",
          "#/compras?status=em_compra",
          "info",
        );
      if (baixos.length)
        add(
          `${contar(baixos)} item(ns) abaixo do estoque mínimo`,
          baixos
            .slice(0, 3)
            .map((m) => m.nome)
            .join(", "),
          "#/estoque?filtro=baixo",
          "warning",
        );
      {
        const semLeitura = s.veiculos.filter(
          (v) =>
            ["operacao", "disponivel"].includes(v.situacao) &&
            diasEntre(v.kmAtualizadoEm, h) > 15,
        );
        if (semLeitura.length)
          add(
            `${contar(semLeitura)} veículo(s) sem leitura de km recente`,
            "Mais de 15 dias sem atualização",
            "#/abastecimento?aba=leituras",
          );
      }
      break;
    case "financeiro":
      if (semDespesa.length)
        add(
          `${contar(semDespesa)} compra(s) recebida(s) sem despesa lançada`,
          semDespesa.map((c) => c.id).join(", "),
          "#/compras?status=recebida",
          "warning",
        );
      if (aConferir.length)
        add(
          `${contar(aConferir)} despesa(s) aguardando conferência`,
          `Total ${fmt.moeda(somar(aConferir, (d) => d.valor))}`,
          "#/despesas?status=lancada",
          "info",
        );
      break;
    case "gerente":
      if (emManutencao.length)
        add(
          `${contar(emManutencao)} veículo(s) em manutenção`,
          emManutencao.map((v) => v.frota).join(", "),
          "#/veiculos?situacao=manutencao",
          "warning",
        );
      if (criticas.length)
        add(
          `${contar(criticas)} solicitação(ões) crítica(s)`,
          criticas.map((c) => c.id).join(", "),
          "#/manutencao?prioridade=critica",
          "danger",
        );
      if (baixos.length)
        add(
          `${contar(baixos)} item(ns) abaixo do estoque mínimo`,
          "",
          "#/estoque?filtro=baixo",
          "warning",
        );
      if (aguardando.length)
        add(
          `${contar(aguardando)} compra(s) aguardando a diretoria`,
          "",
          "#/compras?status=aguardando",
        );
      break;
    case "operacional":
      if (emManutencao.length)
        add(
          `${contar(emManutencao)} veículo(s) indisponíveis por manutenção`,
          emManutencao.map((v) => v.frota).join(", "),
          "#/veiculos?situacao=manutencao",
          "warning",
        );
      {
        const minhas = s.solicitacoes.filter(
          (x) =>
            x.solicitanteId === u.id &&
            STATUS_SOLICITACAO_ATIVOS.includes(x.status),
        );
        if (minhas.length)
          add(
            `${contar(minhas)} solicitação(ões) abertas por você em andamento`,
            minhas.map((x) => x.id).join(", "),
            "#/manutencao?minhas=1",
          );
      }
      break;
    default:
      break;
  }
  return lista;
}

export function ultimoAbastecimento(veiculoId) {
  const lista = db().abastecimentos.filter((a) => a.veiculoId === veiculoId);
  return (
    lista.sort((a, b) => b.data.localeCompare(a.data) || b.km - a.km)[0] ?? null
  );
}

export function gastosDoVeiculo(veiculoId, periodo = null) {
  return somar(
    despesasAtivas().filter(
      (d) =>
        d.veiculoId === veiculoId && (!periodo || noPeriodo(d.data, periodo)),
    ),
    (d) => d.valor,
  );
}

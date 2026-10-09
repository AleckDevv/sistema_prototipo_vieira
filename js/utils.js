// Utilitários de formatação, datas e exportação.

const moedaFmt = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function esc(valor) {
  if (valor === null || valor === undefined) return "";
  return String(valor)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const fmt = {
  moeda: (v) => moedaFmt.format(Number(v) || 0),
  numero: (v, casas = 0) =>
    (Number(v) || 0).toLocaleString("pt-BR", {
      minimumFractionDigits: casas,
      maximumFractionDigits: casas,
    }),
  km: (v) => `${fmt.numero(v)} km`,
  kml: (v) => (v ? `${fmt.numero(v, 2)} km/l` : "—"),
  litros: (v) => `${fmt.numero(v, 1)} L`,
  data(iso) {
    if (!iso) return "—";
    const [a, m, d] = iso.slice(0, 10).split("-");
    return `${d}/${m}/${a}`;
  },
  dataHora(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return fmt.data(iso);
    return `${fmt.data(isoData(d))} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  },
  mes(isoMes) {
    const nomes = [
      "jan",
      "fev",
      "mar",
      "abr",
      "mai",
      "jun",
      "jul",
      "ago",
      "set",
      "out",
      "nov",
      "dez",
    ];
    const [a, m] = isoMes.split("-");
    return `${nomes[Number(m) - 1]}/${a.slice(2)}`;
  },
  compacto(v) {
    const n = Number(v) || 0;
    if (Math.abs(n) >= 1e6) return `R$ ${fmt.numero(n / 1e6, 1)} mi`;
    if (Math.abs(n) >= 1e3) return `R$ ${fmt.numero(n / 1e3, 1)} mil`;
    return fmt.moeda(n);
  },
};

export const arred = (v, casas = 2) =>
  Math.round((Number(v) + Number.EPSILON) * 10 ** casas) / 10 ** casas;

// ---------- Datas (sempre no fuso local, formato AAAA-MM-DD) ----------

export function isoData(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function deIso(iso) {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, m - 1, d, 12, 0, 0);
}

export function somarDias(iso, dias) {
  const d = deIso(iso);
  d.setDate(d.getDate() + dias);
  return isoData(d);
}

export function diasEntre(isoA, isoB) {
  return Math.round((deIso(isoB) - deIso(isoA)) / 86400000);
}

export function intervaloPeriodo(preset, hoje, de, ate) {
  switch (preset) {
    case "mes":
      return { de: `${hoje.slice(0, 7)}-01`, ate: hoje };
    case "30d":
      return { de: somarDias(hoje, -29), ate: hoje };
    case "90d":
      return { de: somarDias(hoje, -89), ate: hoje };
    case "ano":
      return { de: `${hoje.slice(0, 4)}-01-01`, ate: hoje };
    case "personalizado":
      return { de: de || "0000-01-01", ate: ate || "9999-12-31" };
    default:
      return { de: "0000-01-01", ate: "9999-12-31" };
  }
}

export const noPeriodo = (iso, p) => iso >= p.de && iso <= p.ate;

// ---------- Coleções ----------

export function somar(lista, fn) {
  return lista.reduce((t, x) => t + (Number(fn(x)) || 0), 0);
}

export function agrupar(lista, fnChave) {
  const mapa = new Map();
  for (const item of lista) {
    const k = fnChave(item);
    if (!mapa.has(k)) mapa.set(k, []);
    mapa.get(k).push(item);
  }
  return mapa;
}

export function normalizar(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function contem(texto, busca) {
  return normalizar(texto).includes(normalizar(busca).trim());
}

// ---------- Exportação CSV ----------

export function baixarCSV(nomeArquivo, colunas, linhas) {
  const celula = (v) => {
    let s = v === null || v === undefined ? "" : String(v);
    if (typeof v === "number") s = String(v).replace(".", ",");
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const conteudo = [
    colunas.map((c) => celula(c.titulo)).join(";"),
    ...linhas.map((l) =>
      colunas.map((c) => celula(c.csv ? c.csv(l) : l[c.campo])).join(";"),
    ),
  ].join("\r\n");
  // BOM para que o Excel reconheça acentuação em UTF-8.
  const blob = new Blob(["﻿" + conteudo], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function iniciais(nome) {
  const partes = String(nome).trim().split(/\s+/);
  return (
    (partes[0]?.[0] ?? "") +
    (partes.length > 1 ? partes[partes.length - 1][0] : "")
  ).toUpperCase();
}

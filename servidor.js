// Servidor local mínimo (sem dependências) para executar a demonstração.
// Uso: node servidor.js [--abrir] [--porta 8080]
// Atende apenas em 127.0.0.1 (este computador) e somente arquivos desta pasta.

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { exec } = require("node:child_process");

const RAIZ = __dirname;
const args = process.argv.slice(2);
const iPorta = args.indexOf("--porta");
const PORTA = Number(iPorta >= 0 ? args[iPorta + 1] : process.env.PORT) || 8080;
const ABRIR = args.includes("--abrir");

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".md": "text/markdown; charset=utf-8",
};

const servidor = http.createServer((req, res) => {
  let caminho;
  try {
    caminho = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch {
    res.writeHead(400).end("Requisição inválida");
    return;
  }
  if (caminho.endsWith("/")) caminho += "index.html";
  const arquivo = path.normalize(path.join(RAIZ, caminho));
  if (!arquivo.startsWith(RAIZ + path.sep)) {
    res.writeHead(403).end("Acesso negado");
    return;
  }
  fs.readFile(arquivo, (erro, conteudo) => {
    if (erro) {
      res
        .writeHead(404, { "Content-Type": "text/plain; charset=utf-8" })
        .end("Arquivo não encontrado");
      return;
    }
    res.writeHead(200, {
      "Content-Type":
        TIPOS[path.extname(arquivo).toLowerCase()] ??
        "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(conteudo);
  });
});

servidor.on("error", (erro) => {
  if (erro.code === "EADDRINUSE") {
    console.error(
      `A porta ${PORTA} já está em uso. Tente: node servidor.js --porta 8090`,
    );
  } else {
    console.error(erro);
  }
  process.exit(1);
});

servidor.listen(PORTA, "127.0.0.1", () => {
  const url = `http://localhost:${PORTA}`;
  console.log("Vieira | Gestão Operacional — protótipo de demonstração");
  console.log(`Servidor local em ${url}  (Ctrl+C para encerrar)`);
  if (ABRIR) {
    const cmd =
      process.platform === "win32"
        ? `start "" "${url}"`
        : process.platform === "darwin"
          ? `open "${url}"`
          : `xdg-open "${url}"`;
    exec(cmd);
  }
});

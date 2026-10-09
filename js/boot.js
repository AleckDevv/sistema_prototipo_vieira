// Executado antes do aplicativo (script clássico, não módulo).
// Módulos ES6 não carregam quando o arquivo é aberto diretamente do disco (file://).
// Nesse caso, orienta como iniciar o servidor local. Na Vercel ou em qualquer
// servidor HTTP este aviso não aparece.
if (location.protocol === "file:") {
  document.getElementById("boot").innerHTML =
    "<h1>Vieira | Gestão Operacional</h1>" +
    "<p>Este protótipo usa módulos JavaScript e precisa ser aberto por um servidor local simples (o navegador bloqueia módulos abertos diretamente do disco).</p>" +
    "<p><strong>Windows:</strong> dê dois cliques em <code>iniciar-demo.bat</code> na pasta do projeto.</p>" +
    "<p><strong>Qualquer sistema com Node.js:</strong></p><pre>node servidor.js --abrir</pre>" +
    "<p>Depois acesse <code>http://localhost:8080</code>. Detalhes no arquivo <code>README.md</code>.</p>";
}

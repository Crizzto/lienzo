// Servidor local para diseñar las páginas de web/ en el navegador, sin Lienzo.exe (los datos se simulan).
//   node herramientas/servidor.js        → http://localhost:5178/panel.html, /barra.html, /escritorio.html
const http = require("http"), fs = require("fs"), path = require("path");
const raiz = path.join(__dirname, "..", "web");
const tipos = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml" };
const puerto = Number(process.argv[2]) || 5178;
http.createServer((req, res) => {
  const ruta = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const archivo = path.join(raiz, ruta === "/" ? "panel.html" : ruta);
  if (!archivo.startsWith(raiz)) { res.writeHead(403); return res.end(); }
  const alterno = path.join(__dirname, path.basename(ruta)); // herramientas/vista-barra.html, escenas.html…
  fs.readFile(fs.existsSync(archivo) ? archivo : alterno, (err, datos) => {
    if (err) { res.writeHead(404); return res.end("No encontrado"); }
    res.writeHead(200, { "Content-Type": (tipos[path.extname(archivo)] || "application/octet-stream") + "; charset=utf-8", "Cache-Control": "no-store" });
    res.end(datos);
  });
}).listen(puerto, () => console.log(`Lienzo (diseño): http://localhost:${puerto}/panel.html`));

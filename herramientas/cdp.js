// Prueba las páginas de Lienzo mientras corre con --dev (puerto de depuración 9333 de WebView2).
//   node herramientas/cdp.js lista
//   node herramientas/cdp.js eval <barra|panel|escritorio|editor> "<expresión JS>"
//   node herramientas/cdp.js foto <barra|panel|escritorio|editor> salida.png
"use strict";
const fs = require("fs");
const [, , orden, pagina, arg] = process.argv;
const PUERTO = 9333;

async function objetivos() {
  const r = await fetch(`http://127.0.0.1:${PUERTO}/json`);
  return (await r.json()).filter((t) => t.type === "page");
}

function conectar(url) {
  return new Promise((ok, mal) => {
    const ws = new WebSocket(url);
    let id = 0;
    const pendientes = new Map();
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.id && pendientes.has(m.id)) { pendientes.get(m.id)(m); pendientes.delete(m.id); }
    };
    ws.onerror = (e) => mal(new Error("WebSocket: " + (e.message || "error")));
    ws.onopen = () => ok({
      enviar(metodo, params) {
        return new Promise((r) => { const n = ++id; pendientes.set(n, r); ws.send(JSON.stringify({ id: n, method: metodo, params: params || {} })); });
      },
      cerrar() { ws.close(); },
    });
  });
}

(async () => {
  const lista = await objetivos();
  if (orden === "lista") { lista.forEach((t) => console.log(t.url)); return; }
  const archivo = { barra: "barra.html", panel: "panel.html", escritorio: "escritorio.html?monitor", editor: "editar=1" }[pagina] || pagina;
  const t = lista.find((x) => x.url.includes(archivo));
  if (!t) { console.error("No encontré la página " + pagina + ". Abiertas:\n" + lista.map((x) => x.url).join("\n")); process.exit(1); }
  const c = await conectar(t.webSocketDebuggerUrl);
  if (orden === "eval") {
    const r = await c.enviar("Runtime.evaluate", { expression: arg, awaitPromise: true, returnByValue: true });
    const v = r.result && r.result.result;
    if (r.result && r.result.exceptionDetails) console.error("Excepción:", JSON.stringify(r.result.exceptionDetails.exception || r.result.exceptionDetails));
    else console.log(typeof (v && v.value) === "string" ? v.value : JSON.stringify(v && v.value, null, 1));
  } else if (orden === "foto") {
    const r = await c.enviar("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(arg, Buffer.from(r.result.data, "base64"));
    console.log("Foto: " + arg);
  }
  c.cerrar();
})().catch((e) => { console.error(e.message); process.exit(1); });

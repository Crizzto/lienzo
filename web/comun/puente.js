// Puente entre las páginas y Lienzo.exe (mensajes JSON {tipo, ...} por WebView2).
// Si la página se abre en un navegador normal (para diseñarla), simula datos para que todo se vea.
(function () {
  "use strict";
  const L = (window.Lienzo = window.Lienzo || {});
  const w = window.chrome && window.chrome.webview;
  const oyentes = {};

  const P = {
    real: !!w,
    on(tipo, fn) { (oyentes[tipo] = oyentes[tipo] || []).push(fn); },
    emitir(tipo, datos) {
      (oyentes[tipo] || []).forEach((f) => {
        try { f(datos); } catch (e) { console.error(e); P.log(`Error en "${tipo}": ${e.message}`); }
      });
    },
    enviar(tipo, datos) {
      const m = Object.assign({ tipo }, datos || {});
      if (w) w.postMessage(m); else simular(m);
    },
    log(texto) {
      if (w) w.postMessage({ tipo: "registro", texto: String(texto) }); else console.log("[lienzo]", texto);
    },
  };
  L.puente = P;

  if (w) w.addEventListener("message", (e) => { const m = e.data; if (m && m.tipo) P.emitir(m.tipo, m); });
  addEventListener("error", (e) => P.log(`JS ${location.pathname}: ${e.message} (${String(e.filename || "").split("/").pop()}:${e.lineno})`));
  addEventListener("unhandledrejection", (e) => P.log(`Promesa ${location.pathname}: ${(e.reason && e.reason.message) || e.reason}`));

  // Datos compartidos (sistema, música, ficha...) con aviso cuando cambian.
  const datos = (L.datos = { sistema: {}, musica: { activa: false }, ficha: {}, ventanas: { lista: [], fijadas: [], iconos: {} } });
  ["sistema", "ficha"].forEach((t) => P.on(t, (m) => { datos[t] = m; }));
  P.on("config", (m) => { L.config = m.config; }); // la última configuración recibida (útil para depurar)
  P.on("musica", (m) => {
    const portada = m.portada !== undefined ? m.portada : datos.musica.portada;
    datos.musica = Object.assign({}, m, { portada, recibido: performance.now() });
  });

  // ---------------- Simulación (solo fuera de Lienzo.exe) ----------------
  let simIniciada = false;
  async function simular(m) {
    if (m.tipo === "registro") return console.log("[lienzo]", m.texto);
    if (m.tipo === "lanzar" || m.tipo === "media") return console.log("[lienzo] " + m.tipo, m.destino || m.accion);
    if (m.tipo === "pedirApps") {
      const nombres = ["Spotify", "WhatsApp", "Discord", "Visual Studio Code", "Google Chrome", "Steam", "Clima", "Notion", "OBS Studio", "Calculadora"];
      return setTimeout(() => P.emitir("apps", { lista: nombres.map((n) => ({ nombre: n, clave: "sim:" + n, destino: "sim:" + n })) }), 120);
    }
    if (m.tipo === "pedirIconos") {
      const iconos = {};
      (m.claves || []).forEach((c) => {
        const h = Array.from(c).reduce((a, x) => (a * 31 + x.charCodeAt(0)) % 360, 0);
        iconos[c] = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect x="3" y="3" width="42" height="42" rx="12" fill="hsl(${h},65%,50%)"/><circle cx="24" cy="24" r="9" fill="#fff" opacity=".85"/></svg>`)}`;
      });
      return setTimeout(() => P.emitir("iconos", { iconos, tam: m.tam || 48 }), 80);
    }
    if (m.tipo === "pedirHerramientas") return setTimeout(() => P.emitir("herramientas", { ytdlp: false }), 50);
    if (m.tipo === "buscarFondos") {
      const video = ["motionbgs", "desktophut", "moewalls", "youtube", "tiktok"].includes(m.fuente);
      const resultados = Array.from({ length: 9 }, (_, i) => ({ id: m.fuente + i + "-" + m.pagina, nombre: (m.q || "Fondo") + " " + (i + 1),
        miniatura: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"><rect width="16" height="9" fill="hsl(${i * 40},55%,45%)"/></svg>`)}`,
        descarga: String(i), etiqueta: video ? "4K · video" : "3840×2160", credito: m.fuente, video }));
      return setTimeout(() => P.emitir("fondosEnLinea", { fuente: m.fuente, pagina: m.pagina, resultados, ultima: m.pagina >= 2 }), 200);
    }
    if (m.tipo !== "listo" || simIniciada) return;
    simIniciada = true;
    let config = {};
    try { config = await (await fetch("comun/defecto.json")).json(); } catch (e) { console.warn("Sin defecto.json", e); }
    const q = new URLSearchParams(location.search);
    if (q.get("rice") && L.rices) {
      const r = L.rices.find((x) => x.id === q.get("rice"));
      if (r) config = L.aplicarRice(config, r);
    }
    setTimeout(() => {
      P.emitir("config", { config, primeraVez: q.has("bienvenida") });
      P.emitir("ficha", {
        usuario: "cris", equipo: "LAPTOP-LIENZO", so: "Windows 11 Home Single Language", version: "25H2",
        compilacion: "26200.9974", cpu: "Intel Core i5-1135G7 @ 2.40GHz", nucleos: 8, gpu: "Intel UHD Graphics",
        ram: 15.8, resolucion: "1920x1080", escala: 150, lienzo: "1.0.0",
      });
      const sis = () => P.emitir("sistema", {
        cpu: Math.round(8 + Math.random() * 30), ram: 62, ramUsada: 9.8, ramTotal: 15.8, bateria: 76, cargando: false,
        disco: 71, discoLibre: 140, bajada: Math.round(Math.random() * 900000), subida: 42000, red: "wifi",
        encendido: 11520, volumen: 64, silencio: false,
      });
      sis(); setInterval(sis, 2000);
      P.emitir("musica", {
        activa: true, app: "Spotify", titulo: "Luces de la ciudad", artista: "Nébula Lo-fi", album: "Madrugada",
        reproduciendo: true, posicion: 63, duracion: 187, portada: "",
      });
      const pix = (c) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect x="4" y="4" width="40" height="40" rx="11" fill="${c}"/></svg>`)}`;
      P.emitir("ventanas", {
        lista: [
          { h: 1, titulo: "Lienzo — Código", clave: "code", ruta: "", activa: true, min: false, atencion: false },
          { h: 2, titulo: "YouTube — Navegador", clave: "nav", ruta: "", activa: false, min: false, atencion: false },
          { h: 3, titulo: "Discord", clave: "disc", ruta: "", activa: false, min: true, atencion: true },
        ],
        fijadas: [{ clave: "expl", ruta: "" }, { clave: "nav", ruta: "" }],
        iconos: { code: pix("#3b82f6"), nav: pix("#f59e0b"), disc: pix("#6366f1"), expl: pix("#eab308") },
      });
      P.emitir("estadoWindows", { iconos: true, tamanoIconos: 48, tema: "oscuro", barraAuto: true, pausaManual: false, fondos: 1, escritorio: "24H2+", version: "1.0.0", carpetaDatos: "%APPDATA%\\Lienzo" });
      P.emitir("pausa", { pausado: false, motivo: "", reducido: false });
    }, 30);
  }
})();

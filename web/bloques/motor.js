// Registro de bloques (widgets) del escritorio. Cada tipo vive en web/bloques/<tipo>.js y llama a Lienzo.bloque({...}).
(function () {
  "use strict";
  const L = (window.Lienzo = window.Lienzo || {});
  const tipos = (L.bloques = L.bloques || {});

  // Opciones que tienen todos los bloques (aparecen al final del inspector).
  L.opcionesComunes = [
    { id: "fondo", nombre: "Fondo", tipo: "lista", opciones: [["ninguno", "Sin fondo"], ["vidrio", "Vidrio"], ["solido", "Sólido"]], valor: "ninguno" },
    { id: "alinear", nombre: "Alineación", tipo: "lista", opciones: [["izquierda", "Izquierda"], ["centro", "Centro"], ["derecha", "Derecha"]], valor: "izquierda" },
    { id: "fuente", nombre: "Letra", tipo: "lista", opciones: [["tema", "La del tema"], ["serif", "Clásica"], ["mono", "Monoespaciada"], ["condensada", "Condensada"], ["manuscrita", "Manuscrita"]], valor: "tema" },
    { id: "color", nombre: "Color del texto", tipo: "lista", opciones: [["texto", "Normal"], ["acento", "Acento"], ["acento2", "Acento 2"]], valor: "texto" },
  ];

  L.bloque = function (def) {
    if (!def || !def.tipo || typeof def.crear !== "function") throw new Error("Bloque inválido");
    tipos[def.tipo] = def;
  };

  L.opcionesDeBloque = function (def, opciones) {
    const o = {};
    (def.opciones || []).concat(L.opcionesComunes).forEach((op) => { o[op.id] = op.valor; });
    if (def.comunes) Object.assign(o, def.comunes);
    return Object.assign(o, opciones || {});
  };

  // ---- Reloj central: un solo temporizador para todos los bloques, alineado al segundo ----
  const suscriptores = new Set();
  let temporizador = 0, pausado = false;
  function tic() {
    temporizador = 0;
    if (pausado) return;
    const ahora = new Date();
    suscriptores.forEach((f) => { try { f(ahora); } catch (e) { console.error(e); } });
    temporizador = setTimeout(tic, 1000 - (Date.now() % 1000) + 5);
  }
  L.reloj = {
    suscribir(f) { suscriptores.add(f); f(new Date()); if (!temporizador && !pausado) tic(); return () => suscriptores.delete(f); },
    pausar(p) {
      pausado = !!p;
      if (pausado && temporizador) { clearTimeout(temporizador); temporizador = 0; }
      if (!pausado && !temporizador) tic();
    },
  };

  // ---- Widgets tocables ----
  // Los bloques están detrás de los iconos del escritorio: Lienzo.exe ve los clics que caen en el escritorio
  // y manda {tipo:"toque", x, y}; escritorio.js busca el elemento con data-toque en ese punto y le hace click().
  L.tocable = function (el, fn, titulo) {
    if (!el) return el;
    el.dataset.toque = "1";
    el.classList.add("lz-tocable");
    if (titulo) el.title = titulo;
    el.addEventListener("click", (e) => {
      if (document.body.classList.contains("editando")) return; // en el modo edición se arrastra, no se toca
      e.stopPropagation();
      try { fn(e); } catch (err) { console.error(err); }
    });
    return el;
  };

  L.lanzar = function (destino) {
    if (destino && L.puente) L.puente.enviar("lanzar", { destino: String(destino) });
  };

  // Iconos de apps instaladas (los da Lienzo.exe como data URL PNG). Se piden en lotes y se guardan.
  const iconos = {}, esperando = {};
  let lote = {}, tLote = 0;
  L.iconoApp = function (clave, tam, cb) {
    tam = tam || 96;
    if (!clave) { cb(""); return; }
    const k = tam + "|" + clave;
    if (iconos[k] !== undefined) { cb(iconos[k]); return; }
    (esperando[k] = esperando[k] || []).push(cb);
    (lote[tam] = lote[tam] || new Set()).add(clave);
    clearTimeout(tLote);
    tLote = setTimeout(() => {
      const pedir = lote;
      lote = {};
      Object.keys(pedir).forEach((t) => {
        const claves = Array.from(pedir[t]);
        for (let i = 0; i < claves.length; i += 150) L.puente.enviar("pedirIconos", { claves: claves.slice(i, i + 150), tam: Number(t) });
      });
    }, 40);
  };
  if (L.puente) L.puente.on("iconos", (m) => {
    const tam = m.tam || 48;
    Object.keys(m.iconos || {}).forEach((clave) => {
      const k = tam + "|" + clave, url = m.iconos[clave] || "";
      iconos[k] = url;
      (esperando[k] || []).forEach((f) => { try { f(url); } catch (e) { console.error(e); } });
      delete esperando[k];
    });
  });

  // Letra con color propio para cuando una app no tiene icono (o aún no llega).
  L.tonoDe = function (texto) {
    let h = 0;
    for (const c of String(texto || "")) h = (h * 31 + c.charCodeAt(0)) % 360;
    return h;
  };
  L.inicial = (texto) => (String(texto || "?").trim()[0] || "?").toUpperCase();

  // ---- Formatos en español de México ----
  const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const dos = (n) => String(n).padStart(2, "0");
  L.formato = {
    DIAS, MESES, dos,
    hora(d, h24, seg) {
      let h = d.getHours();
      const sufijo = h24 ? "" : h < 12 ? "a. m." : "p. m.";
      if (!h24) h = h % 12 || 12;
      return { h: h24 ? dos(h) : String(h), m: dos(d.getMinutes()), s: dos(d.getSeconds()), sufijo, texto: `${h24 ? dos(h) : h}:${dos(d.getMinutes())}${seg ? ":" + dos(d.getSeconds()) : ""}` };
    },
    fechaLarga: (d) => `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`,
    fechaCorta: (d) => `${DIAS[d.getDay()].slice(0, 3)} ${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)}`,
    capital: (s) => (s ? s[0].toUpperCase() + s.slice(1) : s),
    bytes(b) {
      if (!(b > 0)) return "0 B/s";
      const u = ["B/s", "KB/s", "MB/s", "GB/s"];
      let i = 0;
      while (b >= 1000 && i < u.length - 1) { b /= 1024; i++; }
      return `${b >= 100 || i === 0 ? Math.round(b) : b.toFixed(1)} ${u[i]}`;
    },
    duracion(seg) {
      seg = Math.max(0, Math.floor(seg || 0));
      const d = Math.floor(seg / 86400), h = Math.floor((seg % 86400) / 3600), m = Math.floor((seg % 3600) / 60);
      return d ? `${d} d ${h} h` : h ? `${h} h ${m} min` : `${m} min`;
    },
    minutos(seg) { seg = Math.max(0, Math.floor(seg || 0)); return `${Math.floor(seg / 60)}:${dos(seg % 60)}`; },
  };
})();

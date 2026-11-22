// Lienzo en el celular (web/comun/movil.js): cómo se acomodan los temas (rices) en una pantalla vertical.
// Los temas de web/comun/rices.js están pensados para un monitor acostado; aquí cada uno tiene sus bloques
// recolocados para un teléfono (≈ 412 × 915 px CSS en un Pixel 7). Lo usan el panel del celular y el fondo.
(function () {
  "use strict";
  const L = (window.Lienzo = window.Lienzo || {});

  // En el teléfono la posición horizontal sale de la alineación: así nunca se salen por un lado.
  const X = { izquierda: 0.07, centro: 0.5, derecha: 0.93 };
  function b(tipo, alinear, y, escala, opciones) {
    return { id: tipo + "-1", tipo, x: X[alinear], y, escala, opciones: Object.assign({ alinear }, opciones || {}) };
  }

  // Zonas libres en un Pixel: arriba está la barra de estado y «De un vistazo» (≈ 0–12 %); abajo, la barra de
  // búsqueda y el dock (≈ 82–100 %). Los bloques viven en medio.
  const DISENOS = {
    "noche-lofi": [b("saludo", "izquierda", 0.15, 0.95), b("reloj", "izquierda", 0.2, 0.85, { estilo: "grande" }), b("musica", "centro", 0.6, 0.95, { estilo: "tarjeta" })],
    "neon-2077": [b("reloj", "centro", 0.15, 0.8, { estilo: "neon" }), b("sistema", "centro", 0.4, 0.9, { estilo: "anillos", fondo: "vidrio", cpu: false, red: false }), b("musica", "centro", 0.62, 0.95, { estilo: "tarjeta" })],
    aurora: [b("reloj", "izquierda", 0.15, 0.9, { estilo: "apilado" }), b("fecha", "centro", 0.5, 0.9, { estilo: "calendario", fondo: "vidrio" })],
    sakura: [b("fecha", "derecha", 0.14, 0.8, { estilo: "calendario", fondo: "vidrio" }), b("reloj", "izquierda", 0.5, 0.85, { estilo: "minimal" }), b("frase", "izquierda", 0.66, 0.9, { fuente: "serif" })],
    terminal: [b("fetch", "centro", 0.16, 0.72, { logo: "gato", fondo: "solido" }), b("reloj", "centro", 0.56, 0.9, { estilo: "terminal", fondo: "solido" })],
    oceano: [b("reloj", "derecha", 0.14, 0.9, { estilo: "apilado" }), b("fecha", "derecha", 0.4, 0.9, { estilo: "tarjeta", fondo: "vidrio" }), b("musica", "centro", 0.58, 0.85, { estilo: "vinilo" })],
    nord: [b("reloj", "centro", 0.28, 1.05, { estilo: "minimal" }), b("fecha", "centro", 0.42, 0.95, { estilo: "linea" })],
    cosmos: [b("saludo", "izquierda", 0.15, 0.95), b("reloj", "izquierda", 0.2, 0.85, { estilo: "grande" }), b("sistema", "centro", 0.6, 0.95, { estilo: "barras", fondo: "vidrio", cpu: false, red: false })],
  };
  const PREDETERMINADO = DISENOS["noche-lofi"];

  // Bloques que tienen sentido en el teléfono (los de apps de Windows no) y dónde aparecen al encenderlos.
  const CATALOGO = [
    { tipo: "reloj", nuevo: b("reloj", "izquierda", 0.2, 0.85, { estilo: "grande" }) },
    { tipo: "saludo", nuevo: b("saludo", "izquierda", 0.15, 0.95) },
    { tipo: "fecha", nuevo: b("fecha", "centro", 0.42, 0.9, { estilo: "tarjeta", fondo: "vidrio" }) },
    { tipo: "musica", nuevo: b("musica", "centro", 0.6, 0.95, { estilo: "tarjeta" }) },
    { tipo: "letras", nuevo: b("letras", "centro", 0.45, 0.9, { estilo: "karaoke", lineas: 3 }) },
    { tipo: "clima", nuevo: b("clima", "izquierda", 0.36, 0.9, { fondo: "vidrio" }) },
    { tipo: "frase", nuevo: b("frase", "izquierda", 0.7, 0.9) },
    { tipo: "sistema", nuevo: b("sistema", "centro", 0.5, 0.9, { estilo: "anillos", fondo: "vidrio", cpu: false, red: false }) },
    { tipo: "fetch", nuevo: b("fetch", "centro", 0.3, 0.72, { logo: "gato", fondo: "solido" }) },
  ];

  const PALETAS = [
    ["Medianoche", { fondo: "#12101c", superficie: "#1e1a2e", texto: "#f2eefa", tenue: "#9d94b8", acento: "#ff7eb6", acento2: "#7ee8fa" }],
    ["Bosque", { fondo: "#0f1714", superficie: "#1a2620", texto: "#eaf2ec", tenue: "#93a89b", acento: "#8fd694", acento2: "#f2c57c" }],
    ["Glaciar", { fondo: "#0e141b", superficie: "#18222d", texto: "#e8f0f7", tenue: "#8ea2b5", acento: "#7cc4ff", acento2: "#b8a1ff" }],
    ["Durazno", { fondo: "#1a1214", superficie: "#2a1d20", texto: "#fbefe9", tenue: "#b79c93", acento: "#ffab76", acento2: "#ff6f91" }],
    ["Neón", { fondo: "#0b0b12", superficie: "#161626", texto: "#f5f3ff", tenue: "#9893b3", acento: "#ff2bd6", acento2: "#24f0ff" }],
    ["Lavanda", { fondo: "#15121c", superficie: "#221d2e", texto: "#f4f0fb", tenue: "#a59cbd", acento: "#c3a6ff", acento2: "#ffc6e0" }],
    ["Desierto", { fondo: "#17130e", superficie: "#251e16", texto: "#f6efe4", tenue: "#b3a48d", acento: "#e9b872", acento2: "#d97b5a" }],
    ["Tinta", { fondo: "#101010", superficie: "#1c1c1c", texto: "#f0f0f0", tenue: "#9a9a9a", acento: "#e8e8e8", acento2: "#8a8a8a" }],
  ];

  const clonar = (o) => JSON.parse(JSON.stringify(o));

  L.movil = {
    X, CATALOGO, PALETAS,

    bloquesDeRice(id) { return clonar(DISENOS[id] || PREDETERMINADO); },

    /** Aplica un tema con su diseño de teléfono (los bloques del tema reemplazan a los tuyos). */
    aplicarRice(config, rice) {
      const c = L.aplicarRice(config, rice, "tema");
      c.bloques = this.bloquesDeRice(rice.id);
      return c;
    },

    /** Convierte una configuración de Windows (o defecto.json) en una de teléfono. */
    adaptar(config) {
      const c = clonar(config || {});
      c.movil = 1;
      c.bloques = this.bloquesDeRice(c.rice);
      c.rendimiento = Object.assign({}, c.rendimiento, { fps: 30, calidad: 0.6, bateria: "reducir" });
      c.fondo = c.fondo || {};
      c.fondo.efectos = Object.assign({}, c.fondo.efectos, { parallax: (c.fondo.efectos || {}).parallax || 0.5 });
      c.general = Object.assign({ nombre: "" }, c.general);
      c.biblioteca = c.biblioteca || [];
      // Lo de Windows no aplica en el teléfono.
      delete c.barra; delete c.barraWindows; delete c.escritorio; delete c.windows; delete c.fijadas;
      return c;
    },

    /** Coloca un bloque según su alineación (se llama al cambiarla en el panel). */
    alinear(bloque, alinear) {
      bloque.opciones = Object.assign({}, bloque.opciones, { alinear });
      bloque.x = X[alinear] != null ? X[alinear] : 0.5;
    },
  };
})();

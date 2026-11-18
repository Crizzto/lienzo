// "Rices": combinaciones listas de fondo + colores + barra + bloques que se aplican con un clic.
(function () {
  "use strict";
  const L = (window.Lienzo = window.Lienzo || {});

  const EFECTOS = { oscurecer: 0, desenfoque: 0, saturacion: 100, brillo: 100, vineta: 20, grano: 0, parallax: 0 };
  const MODULOS = {
    inicio: ["inicio", "apps"],
    centro: ["reloj"],
    fin: ["musica", "sistema", "volumen", "bateria", "red", "bandeja", "lienzo"],
  };

  L.rices = [
    {
      id: "noche-lofi",
      nombre: "Noche lo-fi",
      descripcion: "Cielo estrellado, ciudad dormida y música tranquila.",
      ocultarIconos: true,
      config: {
        fondo: { tipo: "escena", escena: "cielo-lofi", efectos: { vineta: 25, parallax: 0.5 } },
        estilo: { fuente: "Segoe UI Variable Display", redondeo: 16, opacidad: 0.5 },
        barra: { posicion: "arriba", estilo: "islas", flotante: true, grosor: 38, margen: 8, iconoInicio: "luna", titulos: "activa", modulos: MODULOS },
        bloques: [
          { id: "saludo-1", tipo: "saludo", x: 0.06, y: 0.1, escala: 1, opciones: {} },
          { id: "reloj-1", tipo: "reloj", x: 0.06, y: 0.16, escala: 1.1, opciones: { estilo: "grande" } },
          { id: "musica-1", tipo: "musica", x: 0.06, y: 0.72, escala: 1, opciones: { estilo: "tarjeta" } },
        ],
      },
    },
    {
      id: "neon-2077",
      nombre: "Neón 2077",
      descripcion: "Synthwave ochentero: rejilla, sol retro y luces de neón.",
      ocultarIconos: true,
      config: {
        fondo: { tipo: "escena", escena: "synthwave", efectos: { vineta: 30 } },
        estilo: { fuente: "Bahnschrift", redondeo: 6, opacidad: 0.45 },
        barra: { posicion: "abajo", estilo: "continua", flotante: true, grosor: 40, margen: 10, fondo: "acrilico", iconoInicio: "rayo", titulos: "activa",
          modulos: { inicio: ["inicio", "apps"], centro: [], fin: ["musica", "sistema", "red", "volumen", "bateria", "reloj", "bandeja", "lienzo"] } },
        bloques: [
          { id: "reloj-1", tipo: "reloj", x: 0.36, y: 0.08, escala: 1.15, opciones: { estilo: "neon", alinear: "centro" } },
          { id: "sistema-1", tipo: "sistema", x: 0.04, y: 0.68, escala: 1, opciones: { estilo: "anillos", fondo: "vidrio" } },
          { id: "musica-1", tipo: "musica", x: 0.72, y: 0.72, escala: 1, opciones: { estilo: "tarjeta" } },
        ],
      },
    },
    {
      id: "aurora",
      nombre: "Aurora boreal",
      descripcion: "Luces del norte sobre un bosque de pinos.",
      ocultarIconos: true,
      config: {
        fondo: { tipo: "escena", escena: "aurora", efectos: { vineta: 15 } },
        estilo: { fuente: "Segoe UI Variable Display", redondeo: 18, opacidad: 0.4 },
        barra: { posicion: "arriba", estilo: "continua", flotante: true, grosor: 36, margen: 10, fondo: "acrilico", iconoInicio: "estrella", titulos: "ninguno", modulos: MODULOS },
        bloques: [
          { id: "reloj-1", tipo: "reloj", x: 0.78, y: 0.1, escala: 1, opciones: { estilo: "apilado", alinear: "derecha" } },
          { id: "fecha-1", tipo: "fecha", x: 0.78, y: 0.5, escala: 1, opciones: { estilo: "calendario", fondo: "vidrio" } },
        ],
      },
    },
    {
      id: "sakura",
      nombre: "Sakura",
      descripcion: "Pétalos de cerezo y colores pastel.",
      ocultarIconos: true,
      config: {
        fondo: { tipo: "escena", escena: "sakura", efectos: { vineta: 10, parallax: 0.4 } },
        estilo: { fuente: "Segoe UI Variable Display", redondeo: 20, opacidad: 0.45 },
        barra: { posicion: "arriba", estilo: "islas", flotante: true, grosor: 36, margen: 8, iconoInicio: "flor", titulos: "activa", modulos: MODULOS },
        bloques: [
          { id: "reloj-1", tipo: "reloj", x: 0.07, y: 0.58, escala: 1, opciones: { estilo: "minimal" } },
          { id: "frase-1", tipo: "frase", x: 0.07, y: 0.78, escala: 1, opciones: { fuente: "serif" } },
          { id: "fecha-1", tipo: "fecha", x: 0.79, y: 0.1, escala: 1, opciones: { estilo: "calendario", fondo: "vidrio" } },
        ],
      },
    },
    {
      id: "terminal",
      nombre: "Terminal",
      descripcion: "Lluvia de código, letra monoespaciada y ficha del sistema.",
      ocultarIconos: true,
      config: {
        fondo: { tipo: "escena", escena: "lluvia-codigo", efectos: { vineta: 30, oscurecer: 15 } },
        estilo: { fuente: "Cascadia Mono", fuenteMono: "Cascadia Mono", redondeo: 4, opacidad: 0.7 },
        barra: { posicion: "arriba", estilo: "minimal", flotante: false, grosor: 30, margen: 0, fondo: "transparente", iconoInicio: "terminal", titulos: "ninguno",
          modulos: { inicio: ["inicio", "apps"], centro: ["ventanaActiva"], fin: ["sistema", "red", "volumen", "bateria", "reloj", "lienzo"] } },
        bloques: [
          { id: "fetch-1", tipo: "fetch", x: 0.56, y: 0.2, escala: 1, opciones: { logo: "gato", fondo: "solido" } },
          { id: "reloj-1", tipo: "reloj", x: 0.56, y: 0.7, escala: 1, opciones: { estilo: "terminal", fondo: "solido" } },
        ],
      },
    },
    {
      id: "oceano",
      nombre: "Océano",
      descripcion: "Olas tranquilas, un faro y la barra a un lado.",
      ocultarIconos: true,
      config: {
        fondo: { tipo: "escena", escena: "oceano", efectos: { vineta: 20 } },
        estilo: { fuente: "Segoe UI Variable Display", redondeo: 14, opacidad: 0.45 },
        barra: { posicion: "izquierda", estilo: "continua", flotante: true, grosor: 46, margen: 10, fondo: "acrilico", iconoInicio: "ondas", titulos: "ninguno",
          modulos: { inicio: ["inicio", "apps"], centro: [], fin: ["musica", "volumen", "bateria", "red", "reloj", "lienzo"] } },
        bloques: [
          { id: "reloj-1", tipo: "reloj", x: 0.8, y: 0.1, escala: 1, opciones: { estilo: "apilado", alinear: "derecha" } },
          { id: "fecha-1", tipo: "fecha", x: 0.8, y: 0.47, escala: 1, opciones: { estilo: "tarjeta", fondo: "vidrio" } },
          { id: "musica-1", tipo: "musica", x: 0.38, y: 0.74, escala: 1, opciones: { estilo: "vinilo" } },
        ],
      },
    },
    {
      id: "nord",
      nombre: "Nord minimal",
      descripcion: "Gradiente sereno, barra delgada y un reloj al centro.",
      ocultarIconos: true,
      config: {
        fondo: { tipo: "escena", escena: "gradiente", efectos: { vineta: 10, grano: 10 } },
        estilo: { fuente: "Segoe UI Variable Text", redondeo: 10, opacidad: 0.6 },
        barra: { posicion: "arriba", estilo: "continua", flotante: false, grosor: 32, margen: 0, fondo: "solido", iconoInicio: "cuadros", titulos: "activa", modulos: MODULOS },
        bloques: [
          { id: "reloj-1", tipo: "reloj", x: 0.37, y: 0.3, escala: 1.3, opciones: { estilo: "minimal", alinear: "centro" } },
          { id: "fecha-1", tipo: "fecha", x: 0.395, y: 0.52, escala: 1, opciones: { estilo: "linea", alinear: "centro" } },
        ],
      },
    },
    {
      id: "cosmos",
      nombre: "Cosmos",
      descripcion: "Constelaciones que siguen tu cursor.",
      ocultarIconos: true,
      config: {
        fondo: { tipo: "escena", escena: "constelacion", efectos: { vineta: 25 } },
        estilo: { fuente: "Segoe UI Variable Display", redondeo: 14, opacidad: 0.5 },
        barra: { posicion: "abajo", estilo: "islas", flotante: true, grosor: 38, margen: 8, iconoInicio: "estrella", titulos: "activa", modulos: MODULOS },
        bloques: [
          { id: "saludo-1", tipo: "saludo", x: 0.06, y: 0.1, escala: 1, opciones: {} },
          { id: "reloj-1", tipo: "reloj", x: 0.06, y: 0.16, escala: 1, opciones: { estilo: "grande" } },
          { id: "sistema-1", tipo: "sistema", x: 0.76, y: 0.66, escala: 1, opciones: { estilo: "barras", fondo: "vidrio" } },
        ],
      },
    },
  ];

  /** Aplica un rice sobre la configuración actual (conserva apps fijadas, biblioteca, rendimiento, etc.). */
  // bloques: "combinar" (por defecto) = los del tema + los tuyos de tipos que el tema no trae (tus apps, clima, letras…);
  //          "tema" = solo los del tema; "mios" = no tocar tus bloques.
  L.combinarBloques = function (actuales, delTema, modo) {
    if (modo === "mios") return actuales || [];
    if (modo === "tema") return delTema || [];
    const tipos = new Set((delTema || []).map((b) => b.tipo));
    const ids = new Set((delTema || []).map((b) => b.id));
    const propios = (actuales || []).filter((b) => !tipos.has(b.tipo)).map((b) => {
      if (!ids.has(b.id)) return b;
      let n = 2;
      while (ids.has(`${b.tipo}-${n}`)) n++;
      return Object.assign({}, b, { id: `${b.tipo}-${n}` });
    });
    return (delTema || []).concat(propios);
  };

  L.aplicarRice = function (config, rice, modoBloques) {
    const c = L.clonar(config);
    const r = L.clonar(rice.config);
    if (r.fondo) {
      const opciones = Object.assign({}, c.fondo && c.fondo.opciones, r.fondo.opciones || {});
      c.fondo = L.fusionar(c.fondo || {}, r.fondo);
      c.fondo.opciones = opciones;
      c.fondo.efectos = Object.assign({}, EFECTOS, r.fondo.efectos || {});
      c.fondo.activo = true;
    }
    c.paleta = Object.assign({}, c.paleta, { modo: "auto" });
    const escena = r.fondo && L.escenas && L.escenas[r.fondo.escena];
    if (escena && escena.paleta) c.paleta.colores = Object.assign({}, escena.paleta);
    if (r.estilo) c.estilo = Object.assign({ fuenteMono: "Cascadia Mono", sombra: true }, c.estilo, r.estilo);
    if (r.barra) c.barra = L.fusionar(c.barra || {}, Object.assign({ activa: true, fondo: "acrilico", opacidad: 0.55, redondeo: 14 }, r.barra));
    if (r.bloques) c.bloques = L.combinarBloques(c.bloques, r.bloques, modoBloques || "combinar");
    c.rice = rice.id;
    return c;
  };
})();

// Gradiente suave: manchas de color que se mueven muy despacio y se mezclan entre sí.
// Se pintan en un lienzo diminuto y se estiran a pantalla completa (el suavizado hace el resto), así que cuesta casi nada.
(function () {
  "use strict";
  const U = Lienzo.util;
  const TAU = Math.PI * 2;

  const CONJUNTOS = {
    nord: { base: "#2e3440", colores: ["#5e81ac", "#88c0d0", "#b48ead", "#a3be8c", "#81a1c1"] },
    atardecer: { base: "#2a1a3c", colores: ["#ff6b6b", "#ffa45c", "#ffd36b", "#c86bd8", "#6a5cff"] },
    menta: { base: "#0d272c", colores: ["#3fe08a", "#38e8d0", "#4facfe", "#a8eedb", "#18b89a"] },
    lavanda: { base: "#2a2246", colores: ["#c3a6ff", "#f2b2e4", "#9ec5ff", "#e0c3fc", "#8e7cf0"] },
  };

  function nuevoLienzo(w, h) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // Colores del tema actual de Lienzo (si falta alguno, se completa con "nord").
  function delTema(p) {
    const n = CONJUNTOS.nord, ok = (c) => typeof c === "string" && /^#?[0-9a-f]{3,8}$/i.test(c.trim());
    const tomar = (c, def) => (ok(c) ? c.trim() : def);
    const fondo = tomar(p.fondo, n.base);
    return {
      base: fondo,
      colores: [
        tomar(p.acento, n.colores[0]), tomar(p.acento2, n.colores[1]), tomar(p.superficie, n.colores[2]),
        U.mezclar(tomar(p.acento, n.colores[3]), tomar(p.acento2, n.colores[4]), 0.5), tomar(p.tenue, n.colores[4]),
      ],
    };
  }

  // Mancha: círculo con caída suave (casi gaussiana) en un solo color.
  function mancha(color) {
    const s = 64, c = nuevoLienzo(s, s), q = c.getContext("2d"), m = s / 2;
    const gr = q.createRadialGradient(m, m, 0, m, m, m);
    for (let i = 0; i <= 10; i++) { const p = i / 10; gr.addColorStop(p, U.rgba(color, 0.88 * Math.exp(-p * p * 3.2) * (1 - p))); }
    q.fillStyle = gr;
    q.fillRect(0, 0, s, s);
    return c;
  }

  Lienzo.escena({
    id: "gradiente",
    nombre: "Gradiente suave",
    descripcion: "Manchas de color que se funden y cambian de forma muy despacio. Minimalista y ligero.",
    tipo: "2d",
    fpsMax: 24,
    calidadMax: 0.35,
    paleta: { fondo: "#2e3440", superficie: "#3b4252", texto: "#eceff4", tenue: "#a3aec2", acento: "#88c0d0", acento2: "#b48ead" },
    opciones: [
      {
        id: "colores", nombre: "Colores", tipo: "lista",
        opciones: [["nord", "Nord"], ["atardecer", "Atardecer"], ["menta", "Menta"], ["lavanda", "Lavanda"], ["tema", "Tema"]],
        valor: "nord",
      },
      { id: "velocidad", nombre: "Velocidad", tipo: "rango", min: 0, max: 3, paso: 0.1, valor: 1 },
      { id: "grano", nombre: "Grano", tipo: "si-no", valor: true },
    ],

    crear(lienzo, ctx) {
      const g = ctx.g;
      let W = 1, H = 1, mini = null, mq = null, manchas = [], base = "#000", ruido = null, patron = null, clave = "";
      let fase = 0;
      // Recorrido de cada mancha (curvas de Lissajous lentas) y su tamaño.
      const recorridos = (() => {
        const r = U.azar(2468), a = [];
        for (let i = 0; i < 5; i++) {
          a.push({
            fx: 0.05 + r() * 0.08, fy: 0.04 + r() * 0.08, px: r() * TAU, py: r() * TAU,
            ax: 0.28 + r() * 0.18, ay: 0.26 + r() * 0.18, r: 0.42 + r() * 0.3, pr: r() * TAU,
          });
        }
        return a;
      })();

      function conjunto() {
        const o = ctx.opciones;
        return o.colores === "tema" ? delTema(ctx.paleta || {}) : CONJUNTOS[o.colores] || CONJUNTOS.nord;
      }
      function claveActual() {
        const c = conjunto();
        return c.base + c.colores.join("");
      }

      function construir() {
        const c = conjunto();
        clave = claveActual();
        base = c.base;
        for (const m of manchas) m.width = m.height = 0;
        manchas = c.colores.map(mancha);
        const mw = 128, mh = Math.max(32, Math.round(128 * H / W));
        if (!mini || mini.width !== mw || mini.height !== mh) { mini = nuevoLienzo(mw, mh); mq = mini.getContext("2d"); }
        if (!ruido) {
          // mosaico de ruido para el grano (y un tramado casi invisible que evita franjas en el degradado)
          ruido = nuevoLienzo(128, 128);
          const q = ruido.getContext("2d"), img = q.createImageData(128, 128), d = img.data, r = U.azar(99);
          for (let i = 0; i < d.length; i += 4) { const v = r() * 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
          q.putImageData(img, 0, 0);
          patron = g.createPattern(ruido, "repeat");
        }
      }

      return {
        redimensionar(ancho, alto) {
          W = ancho; H = alto;
          construir();
        },

        cuadro(t, dt) {
          const o = ctx.opciones;
          if (claveActual() !== clave) construir();
          if (dt > 0) fase += dt * Math.max(0, Number(o.velocidad) || 0);

          const mw = mini.width, mh = mini.height, lado = Math.max(mw, mh);
          mq.globalCompositeOperation = "source-over";
          mq.globalAlpha = 1;
          mq.fillStyle = base;
          mq.fillRect(0, 0, mw, mh);
          recorridos.forEach((p, i) => {
            const x = mw * (0.5 + p.ax * Math.sin(fase * p.fx + p.px));
            const y = mh * (0.5 + p.ay * Math.cos(fase * p.fy + p.py));
            const r = lado * p.r * (0.9 + 0.1 * Math.sin(fase * 0.07 + p.pr));
            mq.drawImage(manchas[i % manchas.length], x - r, y - r, r * 2, r * 2);
          });

          g.setTransform(1, 0, 0, 1, 0, 0);
          g.globalAlpha = 1;
          g.globalCompositeOperation = "source-over";
          g.imageSmoothingEnabled = true;
          g.imageSmoothingQuality = "high";
          g.drawImage(mini, 0, 0, W, H);

          // grano que cambia en cada cuadro (o, sin la opción, un tramado fijo apenas perceptible)
          const k = o.grano ? Math.floor(t * 24) : 0;
          const ox = (k * 73) % 128, oy = (k * 151) % 128;
          g.globalAlpha = o.grano ? 0.07 : 0.022;
          g.fillStyle = patron;
          g.setTransform(1, 0, 0, 1, -ox, -oy);
          g.fillRect(ox, oy, W, H);
          g.setTransform(1, 0, 0, 1, 0, 0);
          g.globalAlpha = 1;
        },

        destruir() {
          for (const c of [mini, ruido, ...manchas]) if (c) c.width = c.height = 0;
          mini = ruido = null;
          manchas = [];
        },
      };
    },
  });
})();

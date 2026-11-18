// Lluvia de código: columnas de caracteres (katakana de ancho medio, números y letras) que caen con una cabeza
// brillante y una estela que se apaga. La estela sale "gratis": en cada cuadro se pinta encima un rectángulo
// del color de fondo casi transparente, así lo anterior se va oscureciendo poco a poco.
(function () {
  "use strict";
  const U = Lienzo.util;
  const FUENTE = '"MS Gothic", "Yu Gothic UI", "Yu Gothic", "Meiryo", "Consolas", monospace';
  const GLIFOS = (() => {
    const a = [];
    for (let c = 0xff66; c <= 0xff9d; c++) a.push(String.fromCharCode(c)); // katakana de ancho medio
    for (const c of "0123456789") a.push(c);
    for (const c of "ABCDEFHIJKLMNOPRSTUVXYZ") a.push(c);
    for (const c of ":=+*<>|\"_-.") a.push(c);
    return a;
  })();
  const VACIA = 255;
  const DECAE = 0.1; // cuánto se apaga la estela en cada cuadro
  // Con 8 bits por canal, el velo translúcido nunca llega exacto al color de fondo: se "atora" hasta
  // 0.5 / DECAE = 5 niveles arriba. Por eso el fondo inicial y las celdas que se borran usan un color
  // 6 niveles más claro: así todo baja al mismo nivel y no quedan cuadritos ni rayas más oscuras.
  // Por lo mismo, el velo es siempre igual (no depende de dt): si cambiara de un cuadro a otro, cada
  // píxel se atoraría en un nivel distinto.
  const HOLGURA = 6;

  function nuevoLienzo(w, h) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  Lienzo.escena({
    id: "lluvia-codigo",
    nombre: "Lluvia de código",
    descripcion: "Columnas de caracteres que caen sin parar, con una cabeza brillante y una estela que se desvanece.",
    tipo: "2d",
    fpsMax: 30,
    paleta: { fondo: "#020a05", superficie: "#0a1a10", texto: "#d9ffe6", tenue: "#5fa577", acento: "#3dff7a", acento2: "#b6ffcf" },
    opciones: [
      { id: "color", nombre: "Color", tipo: "color", valor: "#3dff7a" },
      { id: "velocidad", nombre: "Velocidad", tipo: "rango", min: 0.2, max: 3, paso: 0.1, valor: 1 },
      { id: "tamano", nombre: "Tamaño de letra", tipo: "rango", min: 10, max: 32, paso: 1, valor: 16 },
      { id: "densidad", nombre: "Densidad (%)", tipo: "rango", min: 10, max: 100, paso: 5, valor: 70 },
    ],

    crear(lienzo, ctx) {
      const g = ctx.g;
      let W = 1, H = 1, e = 1, clave = "";
      let celW = 10, celH = 10, nCol = 0, nFil = 0;
      let atlas = null, atlasCab = null, brillo = null, fondo = "#000", limpio = "#000", colsAtlas = 16;
      let celdas = new Uint8Array(0);
      let y = new Float32Array(0), vel = new Float32Array(0), luz = new Float32Array(0), espera = new Float32Array(0);
      let activa = new Uint8Array(0);
      const r = U.azar(4040);

      function velocidad() { return Math.max(0.05, Number(ctx.opciones.velocidad) || 1); }
      function densidad() { return Math.max(0.05, Math.min(1, (Number(ctx.opciones.densidad) || 70) / 100)); }

      // Atlas: todos los glifos pintados una vez (en el color de la estela y en el de la cabeza).
      function pintarAtlas(color) {
        const filas = Math.ceil(GLIFOS.length / colsAtlas);
        const blanco = nuevoLienzo(colsAtlas * celW, filas * celH), q = blanco.getContext("2d");
        q.font = `${Math.round(celH * 0.86)}px ${FUENTE}`;
        q.textAlign = "center";
        q.textBaseline = "middle";
        q.fillStyle = "#ffffff";
        const rr = U.azar(77);
        GLIFOS.forEach((ch, i) => {
          const cx = (i % colsAtlas) * celW + celW / 2, cy = Math.floor(i / colsAtlas) * celH + celH / 2;
          q.save();
          q.beginPath(); q.rect(cx - celW / 2, cy - celH / 2, celW, celH); q.clip();
          q.translate(cx, cy);
          if (i < 56 && rr() < 0.5) q.scale(-1, 1); // la mitad de los katakana, en espejo
          q.fillText(ch, 0, 0);
          q.restore();
        });
        const c = nuevoLienzo(blanco.width, blanco.height), q2 = c.getContext("2d");
        q2.drawImage(blanco, 0, 0);
        q2.globalCompositeOperation = "source-in";
        q2.fillStyle = color;
        q2.fillRect(0, 0, c.width, c.height);
        blanco.width = blanco.height = 0;
        return c;
      }

      function construir() {
        const o = ctx.opciones;
        e = ctx.escala || 1;
        const color = String(o.color || "#3dff7a");
        const tam = Math.max(8, Math.min(48, Number(o.tamano) || 16));
        clave = color + "|" + tam;
        celH = Math.max(6, Math.round(tam * 1.08 * e));
        celW = Math.max(4, Math.round(tam * 0.8 * e));
        fondo = U.mezclar(color, "#000000", 0.965);
        limpio = "rgb(" + U.hexARgb(fondo).map((v) => Math.min(255, v + HOLGURA)).join(",") + ")";
        for (const c of [atlas, atlasCab, brillo]) if (c) c.width = c.height = 0;
        atlas = pintarAtlas(color);
        atlasCab = pintarAtlas(U.mezclar(color, "#ffffff", 0.9));
        // resplandor de la cabeza
        const s = Math.ceil(celH * 2.4);
        brillo = nuevoLienzo(s, s);
        const q = brillo.getContext("2d"), gr = q.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
        gr.addColorStop(0, U.rgba(color, 0.55));
        gr.addColorStop(0.35, U.rgba(color, 0.16));
        gr.addColorStop(1, U.rgba(color, 0));
        q.fillStyle = gr;
        q.fillRect(0, 0, s, s);

        nCol = Math.ceil(W / celW);
        nFil = Math.ceil(H / celH) + 1;
        celdas = new Uint8Array(nCol * nFil).fill(VACIA);
        y = new Float32Array(nCol); vel = new Float32Array(nCol); luz = new Float32Array(nCol);
        espera = new Float32Array(nCol); activa = new Uint8Array(nCol);
        for (let c = 0; c < nCol; c++) {
          reiniciar(c);
          y[c] = -r() * nFil * 1.2;
          if (r() > densidad()) { activa[c] = 0; espera[c] = r() * 6; }
        }
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.globalAlpha = 1;
        g.globalCompositeOperation = "source-over";
        g.fillStyle = limpio;
        g.fillRect(0, 0, W, H);
        // precalentar: simular unos segundos para que el primer cuadro ya tenga lluvia
        for (let i = 0; i < 75; i++) paso(1 / 30);
      }

      function reiniciar(c) {
        activa[c] = 1;
        y[c] = -r() * 6;
        vel[c] = 7 + r() * 13;
        luz[c] = 0.5 + r() * 0.5;
      }

      function glifo(a, k, c, f) {
        g.drawImage(a, (k % colsAtlas) * celW, Math.floor(k / colsAtlas) * celH, celW, celH, c * celW, f * celH, celW, celH);
      }

      // Avanza la simulación y pinta lo nuevo encima del cuadro anterior.
      function paso(dt) {
        const v = velocidad(), den = densidad();
        g.globalCompositeOperation = "source-over";
        g.globalAlpha = DECAE;
        g.fillStyle = fondo;
        g.fillRect(0, 0, W, H);
        const altoBrillo = celH * 2.4; // resplandor alargado y del ancho de la columna: no invade a las vecinas
        for (let c = 0; c < nCol; c++) {
          if (!activa[c]) {
            espera[c] -= dt;
            if (espera[c] <= 0) reiniciar(c);
            continue;
          }
          const antes = Math.floor(y[c]);
          y[c] += vel[c] * v * dt;
          const ahora = Math.floor(y[c]);
          for (let f = antes + 1; f <= ahora; f++) {
            // la cabeza anterior pasa a ser parte de la estela
            if (f - 1 >= 0 && f - 1 < nFil) {
              const k = celdas[c * nFil + f - 1];
              if (k !== VACIA) { g.globalAlpha = luz[c]; glifo(atlas, k, c, f - 1); }
            }
            if (f >= 0 && f < nFil) {
              const k = Math.floor(r() * GLIFOS.length);
              celdas[c * nFil + f] = k;
              g.globalCompositeOperation = "lighter";
              g.globalAlpha = 0.5 * luz[c];
              g.drawImage(brillo, c * celW, f * celH + celH / 2 - altoBrillo / 2, celW, altoBrillo);
              g.globalCompositeOperation = "source-over";
            }
          }
          // la cabeza se repinta cada cuadro para que no se apague
          if (ahora >= 0 && ahora < nFil) {
            const k = celdas[c * nFil + ahora];
            if (k !== VACIA) { g.globalAlpha = 1; glifo(atlasCab, k, c, ahora); }
          }
          // cuando la estela ya salió de la pantalla, la columna descansa un rato
          if (ahora - 40 > nFil) {
            activa[c] = 0;
            espera[c] = r() * (0.3 + (1 - den) * 9);
          }
        }
        // algunos caracteres de las estelas cambian (se borra la celda y se pinta con el brillo que le toca)
        const cambios = Math.ceil(nCol * 0.12 * dt * 30);
        for (let i = 0; i < cambios; i++) {
          const c = Math.floor(r() * nCol);
          if (!activa[c]) continue;
          const f = Math.floor(y[c]) - 4 - Math.floor(r() * 22); // lejos de la cabeza y su resplandor
          if (f < 0 || f >= nFil) continue;
          const b = Math.pow(1 - DECAE, ((y[c] - f) / (vel[c] * v)) * 30) * luz[c];
          if (b < 0.06 || b > 0.45) continue;
          const k = Math.floor(r() * GLIFOS.length);
          celdas[c * nFil + f] = k;
          g.globalAlpha = 1;
          g.fillStyle = limpio;
          g.fillRect(c * celW, f * celH, celW, celH);
          g.globalAlpha = b;
          glifo(atlas, k, c, f);
        }
        g.globalAlpha = 1;
      }

      // Para cuando se pide redibujar sin avanzar (por ejemplo, en pausa tras cambiar el tamaño):
      // se reconstruye la imagen a partir de la cuadrícula de caracteres.
      function reconstruir() {
        const v = velocidad();
        g.globalCompositeOperation = "source-over";
        g.globalAlpha = 1;
        g.fillStyle = limpio;
        g.fillRect(0, 0, W, H);
        for (let c = 0; c < nCol; c++) {
          if (!activa[c]) continue;
          const cab = Math.floor(y[c]);
          for (let f = Math.min(cab, nFil - 1); f >= 0; f--) {
            const b = Math.pow(1 - DECAE, ((y[c] - f) / (vel[c] * v)) * 30);
            if (b < 0.02) break;
            const k = celdas[c * nFil + f];
            if (k === VACIA) continue;
            g.globalAlpha = f === cab ? 1 : b * luz[c];
            glifo(f === cab ? atlasCab : atlas, k, c, f);
          }
        }
        g.globalAlpha = 1;
      }

      return {
        redimensionar(ancho, alto) {
          W = ancho; H = alto;
          construir();
        },

        cuadro(t, dt) {
          const o = ctx.opciones;
          const tam = Math.max(8, Math.min(48, Number(o.tamano) || 16));
          if (clave !== String(o.color || "#3dff7a") + "|" + tam || ctx.escala !== e) construir();
          g.setTransform(1, 0, 0, 1, 0, 0);
          if (dt > 0) paso(Math.min(dt, 0.1));
          else reconstruir();
        },

        destruir() {
          for (const c of [atlas, atlasCab, brillo]) if (c) c.width = c.height = 0;
          atlas = atlasCab = brillo = null;
        },
      };
    },
  });
})();

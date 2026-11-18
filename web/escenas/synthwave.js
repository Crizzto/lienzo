// Neón 2077: atardecer retro de los ochenta. Sol a rayas, montañas de alambre y una cuadrícula que corre hacia ti.
// El cielo, el piso con las líneas que van al horizonte y las montañas se pintan una vez; cada cuadro solo
// dibuja las líneas horizontales que avanzan, las rayas del sol y las estrellas.
(function () {
  "use strict";
  const U = Lienzo.util;
  const TAU = Math.PI * 2;
  const HORIZONTE = 0.62; // altura del horizonte (fracción de la pantalla)

  function nuevoLienzo(w, h) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }
  function suave(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

  // Degradado vertical con un brillo elíptico, con tramado para que no se vean franjas.
  function degradado(w, h, paradas, brillo, semilla) {
    const c = nuevoLienzo(w, h), g = c.getContext("2d");
    w = c.width; h = c.height;
    const img = g.createImageData(w, h), d = img.data;
    const cols = paradas.map(([p, hex]) => [p, U.hexARgb(hex)]);
    const br = brillo ? U.hexARgb(brillo.color) : [0, 0, 0];
    const gx = new Float32Array(w);
    if (brillo) for (let x = 0; x < w; x++) { const u = (x - brillo.x * w) / (brillo.rx * w); gx[x] = Math.exp(-u * u * 2); }
    const ruido = new Float32Array(4096), r = U.azar(semilla || 5);
    for (let i = 0; i < 4096; i++) ruido[i] = (r() + r() - 1) * 1.5;
    let k = 0;
    for (let y = 0; y < h; y++) {
      const p = h > 1 ? y / (h - 1) : 0;
      let i = 0;
      while (i < cols.length - 2 && p > cols[i + 1][0]) i++;
      const a = cols[i], b = cols[i + 1], f = suave(0, 1, (p - a[0]) / ((b[0] - a[0]) || 1));
      const R = a[1][0] + (b[1][0] - a[1][0]) * f, G = a[1][1] + (b[1][1] - a[1][1]) * f, B = a[1][2] + (b[1][2] - a[1][2]) * f;
      let by = 0;
      if (brillo) { const u = (y - brillo.y * h) / (brillo.ry * h); by = Math.exp(-u * u * 2) * brillo.a; }
      const o = (r() * 4096) | 0;
      for (let x = 0; x < w; x++) {
        const bb = gx[x] * by, n = ruido[(o + x) & 4095];
        d[k] = R + (br[0] - R) * bb + n;
        d[k + 1] = G + (br[1] - G) * bb + n;
        d[k + 2] = B + (br[2] - B) * bb + n;
        d[k + 3] = 255;
        k += 4;
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  // Resplandor radial suave (para halos).
  function halo(radio, color, alfa) {
    const s = Math.ceil(radio * 2), c = nuevoLienzo(s, s), g = c.getContext("2d"), m = s / 2;
    const gr = g.createRadialGradient(m, m, 0, m, m, radio);
    for (let i = 0; i <= 10; i++) { const p = i / 10; gr.addColorStop(p, U.rgba(color, alfa * Math.pow(1 - p, 2.2))); }
    g.fillStyle = gr;
    g.fillRect(0, 0, s, s);
    return c;
  }

  // Cordillera de alambre: silueta oscura con malla de neón que se desvanece hacia el horizonte.
  function cordillera(q, puntos, base, color, alfaMalla, filas, oscuro, e) {
    const gr = q.createLinearGradient(0, base - Math.max(...puntos.map((p) => base - p[1])), 0, base);
    gr.addColorStop(0, oscuro[0]);
    gr.addColorStop(1, oscuro[1]);
    q.fillStyle = gr;
    q.beginPath();
    q.moveTo(puntos[0][0], base);
    for (const [x, y] of puntos) q.lineTo(x, y);
    q.lineTo(puntos[puntos.length - 1][0], base);
    q.closePath();
    q.fill();
    // malla: curvas de nivel, verticales y diagonales
    const fila = (j) => puntos.map(([x, y]) => [x, y + (base - y) * (j / filas)]);
    const niveles = [];
    for (let j = 0; j <= filas; j++) niveles.push(fila(j));
    q.strokeStyle = color;
    q.lineWidth = Math.max(1, 0.9 * e);
    for (let j = 1; j < filas; j++) {
      q.globalAlpha = alfaMalla * (1 - j / filas) * 0.9;
      q.beginPath();
      niveles[j].forEach(([x, y], i) => (i ? q.lineTo(x, y) : q.moveTo(x, y)));
      q.stroke();
    }
    for (let j = 0; j < filas; j++) {
      q.globalAlpha = alfaMalla * (1 - j / filas);
      q.beginPath();
      for (let i = 0; i < puntos.length; i++) {
        const a = niveles[j][i], b = niveles[j + 1][i];
        q.moveTo(a[0], a[1]); q.lineTo(b[0], b[1]);
        if (i < puntos.length - 1) {
          const c = (i + j) % 2 ? niveles[j + 1][i + 1] : niveles[j][i + 1], d = (i + j) % 2 ? a : b;
          q.moveTo(d[0], d[1]); q.lineTo(c[0], c[1]);
        }
      }
      q.stroke();
    }
    // contorno brillante con resplandor
    q.lineJoin = "round";
    for (const [ancho, alfa] of [[6, 0.12], [3, 0.25], [1.3, 1]]) {
      q.globalAlpha = alfa;
      q.lineWidth = ancho * e;
      q.beginPath();
      puntos.forEach(([x, y], i) => (i ? q.lineTo(x, y) : q.moveTo(x, y)));
      q.stroke();
    }
    q.globalAlpha = 1;
  }

  Lienzo.escena({
    id: "synthwave",
    nombre: "Neón 2077",
    descripcion: "Atardecer retro de los ochenta: sol a rayas, montañas de neón y una cuadrícula que corre hacia ti.",
    tipo: "2d",
    fpsMax: 30,
    paleta: { fondo: "#0d0221", superficie: "#1c0a38", texto: "#fdeaff", tenue: "#a88ccc", acento: "#ff2fd1", acento2: "#26e7ff" },
    opciones: [
      { id: "velocidad", nombre: "Velocidad", tipo: "rango", min: 0, max: 3, paso: 0.1, valor: 1 },
      { id: "color", nombre: "Color de la cuadrícula", tipo: "color", valor: "#ff2fd1" },
      { id: "sol", nombre: "Sol", tipo: "si-no", valor: true },
      { id: "estrellas", nombre: "Estrellas", tipo: "si-no", valor: true },
    ],

    crear(lienzo, ctx) {
      const g = ctx.g;
      let W = 1, H = 1, e = 1, yh = 0;
      let cielo = null, sol = null, lejanas = null, cercanas = null, piso = null;
      let clave = "";
      let solX = 0, solY = 0, solR = 0;
      const PARALAJE = { estrellas: 2, sol: 3, lejanas: 5, cercanas: 10 };
      let mLej = 0, mCer = 0, yLej = 0, yCer = 0, bruma = null;
      // fase acumulada del avance: así cambiar la velocidad no hace saltar la cuadrícula
      let avance = 0, rayas = 0;

      // Estrellas fijas (coordenadas normalizadas).
      const est = (() => {
        const r = U.azar(808), n = 190, a = [];
        for (let i = 0; i < n; i++) {
          const y = Math.pow(r(), 1.5) * (HORIZONTE - 0.08);
          a.push({ x: r(), y, s: 0.7 + r() * 1.3, a: (0.35 + r() * 0.65) * (1 - suave(0.2, HORIZONTE - 0.08, y) * 0.8), f: 0.6 + r() * 2.5, p: r() * TAU });
        }
        return a;
      })();

      // Puntos de la cresta (px de pantalla). altaIzquierda: la cordillera es alta a la izquierda y baja
      // hacia la derecha (la del lado izquierdo); si no, al revés. Así el centro queda libre para el sol.
      function cresta(semilla, x0, x1, alto, altaIzquierda) {
        const r = U.azar(semilla), pts = [];
        let x = x0, pico = r() < 0.5;
        while (x < x1) {
          const u = (x - x0) / (x1 - x0);
          const env = altaIzquierda ? suave(0, 0.9, 1 - u) : suave(0.1, 1, u);
          const h = alto * (0.12 + 0.88 * env) * (pico ? 0.7 + r() * 0.3 : 0.3 + r() * 0.3);
          pts.push([x, yh - h]);
          x += (0.022 + r() * 0.03) * W;
          pico = !pico;
        }
        // el extremo del lado del centro baja hasta el horizonte (queda tapado por el piso)
        pts.push([x1, altaIzquierda ? yh + 2 : yh - alto * 0.3]);
        if (!altaIzquierda) pts[0][1] = yh + 2;
        return pts;
      }

      function construir() {
        const o = ctx.opciones;
        e = ctx.escala || 1;
        yh = Math.round(H * HORIZONTE);
        const color = String(o.color || "#ff2fd1");
        clave = color + "|" + !!o.sol;
        for (const c of [cielo, sol, lejanas, cercanas, piso]) if (c) c.width = c.height = 0;

        // cielo: morado profundo que se vuelve magenta en el horizonte
        cielo = degradado(W, yh + 2, [[0, "#07021a"], [0.35, "#170636"], [0.68, "#45105e"], [0.9, "#a0287d"], [1, "#ff4f9a"]],
          { x: 0.5, y: 1, rx: 0.55, ry: 0.35, color: "#ff6aa8", a: 0.45 }, 21);

        // sol con degradado amarillo → magenta (las rayas se recortan en cada cuadro)
        solR = Math.round(Math.min(H * 0.25, W * 0.2));
        solX = W / 2; solY = yh - solR * 0.42;
        sol = nuevoLienzo(solR * 2 + 2, solR * 2 + 2);
        const q = sol.getContext("2d"), m = solR + 1;
        const gs = q.createLinearGradient(0, 1, 0, solR * 2 + 1);
        // la parte visible llega hasta ~71 % del diámetro (el resto queda bajo el horizonte)
        gs.addColorStop(0, "#fff46f"); gs.addColorStop(0.2, "#ffd045"); gs.addColorStop(0.4, "#ff9448");
        gs.addColorStop(0.56, "#ff5677"); gs.addColorStop(0.7, "#e8269f"); gs.addColorStop(1, "#a8159c");
        q.fillStyle = gs;
        q.beginPath(); q.arc(m, m, solR, 0, TAU); q.fill();
        // el halo del sol se pinta directo en el cielo (no hace falta moverlo cada cuadro)
        if (o.sol) {
          const h = halo(solR * 2.6, "#ff5c9c", 0.5);
          cielo.getContext("2d").drawImage(h, solX - h.width / 2, solY - h.height / 2);
          h.width = h.height = 0;
        }

        // montañas lejanas (suaves) y cercanas (de alambre)
        mLej = Math.ceil(PARALAJE.lejanas * e) + 2; mCer = Math.ceil(PARALAJE.cercanas * e) + 2;
        const altoLej = H * 0.11, altoCer = H * 0.2;
        yLej = Math.floor(yh - altoLej - 10 * e); yCer = Math.floor(yh - altoCer - 10 * e);
        lejanas = nuevoLienzo(W + 2 * mLej, yh - yLej + 2);
        {
          const q2 = lejanas.getContext("2d");
          q2.translate(mLej, -yLej);
          // cordillera de fondo a todo lo ancho, más baja en el centro (tapa un poco la base del sol)
          const r = U.azar(5), pts = [];
          let pico = true;
          for (let x = -mLej; x < W + mLej; x += (0.016 + r() * 0.022) * W) {
            const env = 0.3 + 0.7 * Math.abs(x / W - 0.5) * 2;
            pts.push([x, yh - altoLej * env * (pico ? 0.6 + r() * 0.4 : 0.2 + r() * 0.25)]);
            pico = !pico;
          }
          pts.push([W + mLej, yh - altoLej * 0.5]);
          cordillera(q2, pts, yh + 1, "#9a6bff", 0.3, 3, ["#1f0940", "#3b0f5a"], e);
        }
        cercanas = nuevoLienzo(W + 2 * mCer, yh - yCer + 2);
        {
          const q3 = cercanas.getContext("2d");
          q3.translate(mCer, -yCer);
          cordillera(q3, cresta(11, -mCer, W * 0.4, altoCer, true), yh + 1, color, 0.5, 5, ["#14042a", "#26073f"], e);
          cordillera(q3, cresta(12, W * 0.6, W + mCer, altoCer * 0.9, false), yh + 1, color, 0.5, 5, ["#14042a", "#26073f"], e);
        }

        // piso: degradado, reflejo del sol y líneas que convergen en el punto de fuga
        const D = H - yh;
        piso = degradado(W, D, [[0, "#3c0b52"], [0.12, "#1f0636"], [0.5, "#0e0320"], [1, "#05010d"]],
          o.sol ? { x: 0.5, y: 0, rx: 0.13, ry: 0.55, color: "#ff4f9a", a: 0.32 } : null, 33);
        const p = piso.getContext("2d");
        const sx = W / 7.5, n = Math.ceil((W * 3) / sx);
        const gl = p.createLinearGradient(0, 0, 0, D);
        gl.addColorStop(0, U.rgba(color, 0));
        gl.addColorStop(0.08, U.rgba(color, 0.25));
        gl.addColorStop(0.45, U.rgba(color, 0.8));
        gl.addColorStop(1, U.rgba(color, 1));
        p.strokeStyle = gl;
        p.globalCompositeOperation = "lighter";
        for (const [ancho, alfa] of [[7, 0.1], [3, 0.22], [1.4, 0.95]]) {
          p.lineWidth = ancho * e;
          p.globalAlpha = alfa;
          p.beginPath();
          for (let i = -n; i <= n; i++) { p.moveTo(W / 2, 0); p.lineTo(W / 2 + i * sx * 1.0, D); }
          p.stroke();
        }
        p.globalAlpha = 1;
        p.globalCompositeOperation = "source-over";
        // bruma rosa sobre las líneas más lejanas
        bruma = g.createLinearGradient(0, yh, 0, yh + H * 0.08);
        bruma.addColorStop(0, "rgba(255,90,170,0.32)");
        bruma.addColorStop(1, "rgba(255,90,170,0)");
        // línea del horizonte
        const gh = p.createLinearGradient(0, 0, W, 0);
        gh.addColorStop(0, U.rgba("#ff8ac4", 0.2)); gh.addColorStop(0.5, U.rgba("#ffd1ec", 0.95)); gh.addColorStop(1, U.rgba("#ff8ac4", 0.2));
        p.fillStyle = gh;
        p.fillRect(0, 0, W, Math.max(1, 1.5 * e));
      }

      function dibujarEstrellas(t, dx, dy) {
        g.fillStyle = "#ffffff";
        for (const s of est) {
          g.globalAlpha = s.a * (0.65 + 0.35 * Math.sin(t * s.f + s.p));
          const z = s.s * e;
          g.fillRect(s.x * W + dx - z / 2, s.y * H + dy - z / 2, z, z);
        }
        g.globalAlpha = 1;
      }

      // Sol recortado en franjas: los huecos bajan despacio y se ensanchan hacia abajo.
      function dibujarSol(dx, dy) {
        const x = solX - solR - 1 + dx, y = solY - solR - 1 + dy, d = solR * 2 + 2;
        const inicio = solY - solR * 0.3 + dy, fin = yh, alto = fin - inicio, n = 7;
        g.save();
        g.beginPath();
        g.rect(x, y, d, inicio - y);
        let ultimo = inicio;
        for (let k = 0; k <= n; k++) {
          const u = (k + rayas) / n;
          if (u > 1) break;
          const hueco = (0.01 + 0.13 * u) * solR * u;
          const yc = inicio + alto * u;
          g.rect(x, ultimo, d, Math.max(0, yc - hueco / 2 - ultimo));
          ultimo = yc + hueco / 2;
        }
        g.rect(x, ultimo, d, Math.max(0, fin - ultimo + 2));
        g.clip();
        g.drawImage(sol, x, y);
        g.restore();
      }

      // Líneas horizontales del piso que avanzan hacia la cámara (más gruesas y brillantes de cerca).
      function dibujarLineas(color) {
        const D = H - yh, fase = avance % 1;
        g.globalCompositeOperation = "lighter";
        g.fillStyle = color;
        for (let k = 1; k <= 34; k++) {
          const z = k - fase;
          if (z < 0.6) continue;
          const y = yh + D / z;
          if (y > H + 4 * e) continue;
          const fade = suave(30, 6, z);
          if (fade <= 0.003) continue;
          const th = 2.6 * e / Math.pow(z, 0.75);
          const a = th < 1 ? th : 1;
          const t2 = Math.max(1, th);
          g.globalAlpha = 0.16 * fade;
          g.fillRect(0, y - t2 * 2.2, W, t2 * 4.4);
          g.globalAlpha = 0.95 * fade * a;
          g.fillRect(0, y - t2 / 2, W, t2);
        }
        g.globalAlpha = 1;
        g.globalCompositeOperation = "source-over";
      }

      return {
        redimensionar(ancho, alto) {
          W = ancho; H = alto;
          construir();
        },

        cuadro(t, dt) {
          const o = ctx.opciones;
          const color = String(o.color || "#ff2fd1");
          if (clave !== color + "|" + !!o.sol || ctx.escala !== e) construir();
          const v = Math.max(0, Number(o.velocidad) || 0);
          if (dt > 0) { avance += dt * v * 1.1; rayas = (rayas + dt * v * 0.12) % 1; }

          const mx = (ctx.mouse.x - 0.5) * 2, my = (ctx.mouse.y - 0.5) * 2;
          const px = (k) => -mx * PARALAJE[k] * e, py = (k) => -my * PARALAJE[k] * e * 0.4;

          g.setTransform(1, 0, 0, 1, 0, 0);
          g.globalAlpha = 1;
          g.drawImage(cielo, 0, 0);
          if (o.estrellas) dibujarEstrellas(t, px("estrellas"), py("estrellas"));
          if (o.sol) dibujarSol(px("sol"), py("sol"));
          g.drawImage(lejanas, -mLej + px("lejanas"), yLej);
          g.drawImage(cercanas, -mCer + px("cercanas"), yCer);
          g.drawImage(piso, 0, yh);
          dibujarLineas(color);
          g.fillStyle = bruma;
          g.fillRect(0, yh, W, H * 0.08);
        },

        destruir() {
          for (const c of [cielo, sol, lejanas, cercanas, piso]) if (c) c.width = c.height = 0;
          cielo = sol = lejanas = cercanas = piso = null;
        },
      };
    },
  });
})();

// Sakura: amanecer pastel con montañas a lo lejos, una rama de cerezo en flor y pétalos que caen con el viento.
// El cielo, las montañas y la rama se pintan una vez; cada cuadro solo mueve los pétalos y mece la rama.
(function () {
  "use strict";
  const U = Lienzo.util;
  const TAU = Math.PI * 2;
  const MAX_PETALOS = 200;

  const TEMAS = {
    dia: {
      cielo: [[0, "#9db0e4"], [0.3, "#bfb6e6"], [0.55, "#ecc3dc"], [0.78, "#ffd5cf"], [1, "#ffead8"]],
      brillo: { x: 0.7, y: 0.56, rx: 0.4, ry: 0.3, color: "#fff4e4", a: 0.75 },
      astro: { x: 0.7, y: 0.535, r: 0.055, color: "#fff7ec", halo: "#ffe2c6" },
      montes: [["#c4a6d6", "#efd0e0"], ["#a888c4", "#dcbad8"], ["#7d5f9f", "#b393c6"], ["#5a4380", "#7d62a0"]],
      rama: "#4a2c3b", ramaLuz: "#7a4d5c",
      flores: ["#ffd3e2", "#ffc0d6", "#ffb0cb", "#fff0f5"], centro: "#e0607f", estambre: "#ffd36b",
      petalos: ["#ffd0e0", "#ffbcd2", "#ffe4ee", "#ffaac5"], alfaPetalo: 0.95,
    },
    noche: {
      cielo: [[0, "#090b26"], [0.35, "#171a46"], [0.65, "#2f2a5f"], [0.85, "#4f3f75"], [1, "#6b5084"]],
      brillo: { x: 0.7, y: 0.25, rx: 0.3, ry: 0.3, color: "#5d5a9a", a: 0.45 },
      astro: { x: 0.72, y: 0.22, r: 0.05, color: "#f4f1ff", halo: "#a9a3e8" },
      montes: [["#3a3468", "#4e4479"], ["#2c2856", "#3d3569"], ["#1e1b40", "#2b2652"], ["#131129", "#1c1838"]],
      rama: "#170f1c", ramaLuz: "#3b2a45",
      flores: ["#f6d4ea", "#e9bfe0", "#ffe6f4", "#d9b5dc"], centro: "#b0507a", estambre: "#f3d38a",
      petalos: ["#f3d2ea", "#e8c0e2", "#fbe6f5", "#dcb4dc"], alfaPetalo: 0.85,
    },
  };

  function nuevoLienzo(w, h) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }
  function suave(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

  function ruido1D(semilla) {
    const r = U.azar(semilla), v = new Float32Array(256);
    for (let i = 0; i < 256; i++) v[i] = r();
    const n = (x) => { const i = Math.floor(x), f = x - i, s = f * f * (3 - 2 * f), a = v[i & 255]; return a + (v[(i + 1) & 255] - a) * s; };
    return (x, oct) => {
      let s = 0, a = 1, tot = 0, f = 1;
      for (let o = 0; o < (oct || 4); o++) { s += a * n(x * f + o * 17.3); tot += a; a *= 0.5; f *= 2.1; }
      return s / tot;
    };
  }

  // Degradado vertical con un brillo elíptico, con tramado para que no se vean franjas.
  function degradado(w, h, paradas, brillo, semilla) {
    const c = nuevoLienzo(w, h), g = c.getContext("2d");
    w = c.width; h = c.height;
    const img = g.createImageData(w, h), d = img.data;
    const cols = paradas.map(([p, hex]) => [p, U.hexARgb(hex)]);
    const br = U.hexARgb(brillo.color), gx = new Float32Array(w);
    for (let x = 0; x < w; x++) { const u = (x - brillo.x * w) / (brillo.rx * w); gx[x] = Math.exp(-u * u * 2); }
    const ruido = new Float32Array(4096), r = U.azar(semilla || 5);
    for (let i = 0; i < 4096; i++) ruido[i] = (r() + r() - 1) * 1.5;
    let k = 0;
    for (let y = 0; y < h; y++) {
      const p = h > 1 ? y / (h - 1) : 0;
      let i = 0;
      while (i < cols.length - 2 && p > cols[i + 1][0]) i++;
      const a = cols[i], b = cols[i + 1], f = suave(0, 1, (p - a[0]) / ((b[0] - a[0]) || 1));
      const R = a[1][0] + (b[1][0] - a[1][0]) * f, G = a[1][1] + (b[1][1] - a[1][1]) * f, B = a[1][2] + (b[1][2] - a[1][2]) * f;
      const u = (y - brillo.y * h) / (brillo.ry * h), by = Math.exp(-u * u * 2) * brillo.a, o = (r() * 4096) | 0;
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

  // Forma de pétalo de cerezo (con la muesca en la punta), centrado en el origen, apuntando hacia arriba.
  function trazoPetalo(q, s) {
    q.beginPath();
    q.moveTo(0, s * 0.5);
    q.bezierCurveTo(s * 0.5, s * 0.28, s * 0.44, -s * 0.36, s * 0.12, -s * 0.5);
    q.lineTo(0, -s * 0.38);
    q.lineTo(-s * 0.12, -s * 0.5);
    q.bezierCurveTo(-s * 0.44, -s * 0.36, -s * 0.5, s * 0.28, 0, s * 0.5);
    q.closePath();
  }

  function spritePetalo(s, color) {
    const c = nuevoLienzo(s * 1.15, s * 1.15), q = c.getContext("2d");
    q.translate(c.width / 2, c.height / 2);
    const gr = q.createLinearGradient(0, s * 0.5, 0, -s * 0.5);
    gr.addColorStop(0, U.mezclar(color, "#d4577e", 0.35));
    gr.addColorStop(0.45, color);
    gr.addColorStop(1, U.mezclar(color, "#ffffff", 0.45));
    q.fillStyle = gr;
    trazoPetalo(q, s);
    q.fill();
    return c;
  }

  Lienzo.escena({
    id: "sakura",
    nombre: "Sakura",
    descripcion: "Un amanecer pastel con una rama de cerezo en flor y pétalos que caen con el viento.",
    tipo: "2d",
    fpsMax: 30,
    paleta: { fondo: "#2a2140", superficie: "#3a2d55", texto: "#fff1f6", tenue: "#c7a9cf", acento: "#ff9ec2", acento2: "#ffd6a5" },
    opciones: [
      { id: "petalos", nombre: "Pétalos", tipo: "rango", min: 0, max: MAX_PETALOS, paso: 5, valor: 90 },
      { id: "viento", nombre: "Viento", tipo: "rango", min: 0, max: 100, paso: 5, valor: 30 },
      { id: "rama", nombre: "Rama de cerezo", tipo: "si-no", valor: true },
      { id: "noche", nombre: "Modo noche", tipo: "si-no", valor: false },
    ],

    crear(lienzo, ctx) {
      const g = ctx.g;
      let W = 1, H = 1, e = 1, tema = TEMAS.dia, clave = "";
      let cielo = null, capas = [], rama = null, flores = [], sprites = [];
      const PARALAJE = [3, 6, 10, 16];
      const capaY = [0.28, 0.5, 0.6, 0.72]; // dónde empieza cada lienzo de montaña (fracción de la altura)
      let margenes = [];
      const anclaRama = { x: 0, y: 0 };

      // Pétalos: posiciones en px del lienzo; profundidad z (pequeños y lentos atrás, grandes al frente).
      const P = {
        x: new Float32Array(MAX_PETALOS), y: new Float32Array(MAX_PETALOS), z: new Float32Array(MAX_PETALOS),
        vy: new Float32Array(MAX_PETALOS), rot: new Float32Array(MAX_PETALOS), vr: new Float32Array(MAX_PETALOS),
        giro: new Float32Array(MAX_PETALOS), vg: new Float32Array(MAX_PETALOS), fase: new Float32Array(MAX_PETALOS),
        frec: new Float32Array(MAX_PETALOS), spr: new Uint8Array(MAX_PETALOS),
      };
      const rp = U.azar(3131);
      let iniciados = false;

      function nacer(i, alInicio) {
        const z = 0.45 + Math.pow(rp(), 1.6) * 0.95;
        P.z[i] = z;
        P.vy[i] = (26 + rp() * 22) * e;
        P.rot[i] = rp() * TAU; P.vr[i] = (rp() - 0.5) * 2.4;
        P.giro[i] = rp() * TAU; P.vg[i] = 1.2 + rp() * 2.2;
        P.fase[i] = rp() * TAU; P.frec[i] = 0.6 + rp() * 1.1;
        P.spr[i] = Math.floor(rp() * 4);
        const v = (Number(ctx.opciones.viento) || 0) / 100;
        if (alInicio) { P.x[i] = rp() * W; P.y[i] = rp() * H; return; }
        if (ctx.opciones.rama && flores.length && rp() < 0.35) {
          // algunos se desprenden de la rama
          const f = flores[Math.floor(rp() * flores.length)];
          P.x[i] = f[0]; P.y[i] = f[1];
        } else if (rp() < v * 0.6) {
          P.x[i] = -20 * e; P.y[i] = rp() * H * 0.8;
        } else {
          P.x[i] = (rp() * 1.2 - 0.2 * v) * W; P.y[i] = -20 * e;
        }
      }

      // Rama de cerezo: recursiva, más gruesa en la base; las flores se juntan en las puntas.
      // Cada rama se tuerce al azar pero siempre vuelve hacia su dirección original (no se sale del cuadro).
      function pintarRama() {
        const c = nuevoLienzo(W * 0.62, H * 0.62), q = c.getContext("2d"), r = U.azar(424);
        q.lineCap = "round";
        q.lineJoin = "round";
        const lista = [], segmentos = [];
        anclaRama.x = -12 * e; anclaRama.y = H * 0.05;
        function crecer(x, y, a0, largo, grosor, fin, nivel) {
          const paso = 7 * e, pasos = Math.max(3, Math.round(largo / paso));
          let a = a0;
          for (let i = 0; i < pasos; i++) {
            const u = i / pasos, w = grosor + (fin - grosor) * u;
            a += (a0 - a) * 0.12 + (r() - 0.5) * 0.22;
            const nx = x + Math.cos(a) * paso, ny = y + Math.sin(a) * paso;
            segmentos.push([x, y, nx, ny, w]);
            const prob = [0.11, 0.14, 0.12][nivel] || 0;
            if (i > 2 && u < 0.92 && r() < prob) {
              const lado = r() < 0.55 ? 1 : -1; // un poco más de ramitas hacia abajo
              crecer(nx, ny, a + lado * (0.5 + r() * 0.7), largo * (0.22 + r() * 0.25) * (1 - u * 0.4), Math.max(1.3 * e, w * 0.55), 1.1 * e, nivel + 1);
            }
            if (nivel >= 1 && u > 0.25 && r() < 0.3) lista.push([nx + (r() - 0.5) * 12 * e, ny + (r() - 0.5) * 12 * e, (4.5 + r() * 3.5) * e, r()]);
            x = nx; y = ny;
          }
          const n = 4 + Math.floor(r() * 6);
          for (let k = 0; k < n; k++) lista.push([x + (r() - 0.5) * 26 * e, y + (r() - 0.5) * 20 * e, (5 + r() * 4.5) * e, r()]);
        }
        crecer(anclaRama.x, anclaRama.y, 0.2, W * 0.56, 20 * e, 4 * e, 0);
        crecer(anclaRama.x, anclaRama.y + 8 * e, 0.62, W * 0.26, 12 * e, 2.5 * e, 1);
        // rama: primero un borde más claro y luego el relleno, para que tenga algo de volumen
        for (const [x0, y0, x1, y1, w] of segmentos) {
          q.strokeStyle = tema.rama;
          q.lineWidth = w;
          q.beginPath(); q.moveTo(x0, y0); q.lineTo(x1, y1); q.stroke();
        }
        q.globalAlpha = 0.5;
        for (const [x0, y0, x1, y1, w] of segmentos) {
          if (w < 3 * e) continue;
          q.strokeStyle = tema.ramaLuz;
          q.lineWidth = w * 0.25;
          q.beginPath(); q.moveTo(x0, y0 - w * 0.25); q.lineTo(x1, y1 - w * 0.25); q.stroke();
        }
        q.globalAlpha = 1;
        // flores: primero las de atrás (más oscuras y chicas), luego las de enfrente
        lista.sort((a, b) => a[3] - b[3]);
        for (const [x, y, s, k] of lista) {
          const atras = k < 0.3;
          const base = tema.flores[Math.floor(k * 997) % tema.flores.length];
          const col = atras ? U.mezclar(base, tema.rama, 0.18) : base;
          if (k > 0.9) { // botón cerrado
            q.fillStyle = U.mezclar(col, tema.centro, 0.45);
            q.beginPath(); q.arc(x, y, s * 0.35, 0, TAU); q.fill();
            continue;
          }
          q.save();
          q.translate(x, y);
          q.rotate(k * 40);
          q.scale(1, 0.62 + 0.38 * ((k * 7.31) % 1)); // algunas se ven de lado
          const gr = q.createRadialGradient(0, 0, 0, 0, 0, s);
          gr.addColorStop(0, U.mezclar(col, tema.centro, 0.35));
          gr.addColorStop(0.45, col);
          gr.addColorStop(1, U.mezclar(col, "#ffffff", 0.35));
          q.fillStyle = gr;
          for (let p = 0; p < 5; p++) {
            q.rotate(TAU / 5);
            q.save();
            q.translate(0, -s * 0.5);
            trazoPetalo(q, s * 0.95);
            q.restore();
            q.fill();
          }
          q.fillStyle = tema.estambre;
          for (let p = 0; p < 6; p++) {
            const a = p * TAU / 6 + k;
            q.beginPath(); q.arc(Math.cos(a) * s * 0.22, Math.sin(a) * s * 0.22, Math.max(0.6, s * 0.06), 0, TAU); q.fill();
          }
          q.restore();
        }
        flores = lista.filter((f) => f[3] >= 0.3 && f[3] <= 0.9).map((f) => [f[0], f[1]]);
        return c;
      }

      function pintarMontes() {
        const capasNuevas = [];
        const formas = [
          // lejos: un volcán grande y suave + cordillera
          (xs, rn) => {
            const d = Math.abs(xs / W - 0.3) / 0.24, cono = d < 1 ? Math.min(0.93, Math.pow(1 - d, 1.8)) : 0;
            return H * (0.6 - 0.07 * rn(xs / (0.3 * W) + 1, 4) - 0.26 * cono);
          },
          (xs, rn) => H * (0.66 - 0.1 * rn(xs / (0.22 * W) + 5, 4)),
          (xs, rn) => H * (0.77 - 0.07 * rn(xs / (0.18 * W) + 9, 3)),
          (xs, rn) => H * (0.9 - 0.05 * rn(xs / (0.15 * W) + 2, 3) - 0.04 * Math.exp(-Math.pow((xs / W - 0.95) / 0.15, 2))),
        ];
        margenes = PARALAJE.map((p) => Math.ceil(p * e) + 2);
        formas.forEach((alto, k) => {
          const m = margenes[k], y0 = Math.floor(H * capaY[k]), vm = Math.ceil(m * 0.5) + 2;
          const c = nuevoLienzo(W + 2 * m, H - y0 + vm), q = c.getContext("2d"), rn = ruido1D(40 + k);
          const cols = tema.montes[k];
          const top = H * (capaY[k] + 0.02) - y0;
          const gr = q.createLinearGradient(0, top, 0, c.height);
          gr.addColorStop(0, cols[0]);
          gr.addColorStop(1, cols[1]);
          q.fillStyle = gr;
          q.beginPath();
          q.moveTo(0, c.height);
          for (let x = 0; x <= c.width + 3 * e; x += 3 * e) q.lineTo(x, alto(x - m, rn) - y0);
          q.lineTo(c.width, c.height);
          q.closePath();
          q.fill();
          if (k === 0) {
            // nieve en la cima del volcán
            const cx = 0.3 * W + m, cima = alto(0.3 * W, rn) - y0;
            q.save();
            q.clip();
            const nieve = q.createLinearGradient(0, cima, 0, cima + H * 0.08);
            nieve.addColorStop(0, U.rgba("#ffffff", 0.7));
            nieve.addColorStop(0.6, U.rgba("#ffffff", 0.35));
            nieve.addColorStop(1, U.rgba("#ffffff", 0.05));
            q.fillStyle = nieve;
            // borde de abajo con "dedos" de nieve que bajan por las cañadas, más largos al centro
            const rs = U.azar(8), pasos = 26;
            q.beginPath();
            q.moveTo(cx - W * 0.12, cima - H * 0.02);
            for (let i = 0; i <= pasos; i++) {
              const u = i / pasos, centro = 1 - Math.abs(u - 0.5) * 2;
              q.lineTo(cx - W * 0.12 + u * W * 0.24, cima + H * (0.02 + 0.06 * centro * (i % 2 ? 0.45 + 0.55 * rs() : 0.2 * rs())));
            }
            q.lineTo(cx + W * 0.12, cima - H * 0.02);
            q.closePath();
            q.fill();
            q.restore();
          }
          // cerezos en flor sobre las colinas cercanas
          if (k >= 2) {
            const rr = U.azar(90 + k), cerca = k === 3;
            const rosa = U.mezclar(tema.flores[cerca ? 2 : 1], cols[0], (cerca ? 0.28 : 0.45) + (tema === TEMAS.noche ? 0.2 : 0));
            const rosa2 = U.mezclar(rosa, "#ffffff", 0.18), tronco = U.mezclar(cols[0], "#000000", 0.2);
            for (let x = 0; x < c.width; x += (12 + rr() * 34) * e) {
              if (rr() < 0.4) continue;
              const yb = alto(x - m, rn) - y0 + 3 * e, s = (cerca ? 1.25 : 0.75) * e * (0.7 + rr() * 0.6);
              q.fillStyle = tronco;
              q.fillRect(x - 1.2 * s, yb - 10 * s, 2.4 * s, 10 * s);
              for (const [col, dy] of [[rosa, 0], [rosa2, -3]]) {
                q.fillStyle = col;
                q.beginPath();
                for (let i = 0; i < (dy ? 3 : 6); i++) {
                  const cx = x + (rr() - 0.5) * 16 * s, cy = yb - 15 * s + dy * s + (rr() - 0.5) * 8 * s, rad = (dy ? 4 : 6) * s + rr() * 4 * s;
                  q.moveTo(cx + rad, cy);
                  q.arc(cx, cy, rad, 0, TAU);
                }
                q.fill();
              }
            }
          }
          // neblina en la base de cada capa
          const neb = q.createLinearGradient(0, c.height * 0.35, 0, c.height);
          neb.addColorStop(0, U.rgba(tema.cielo[4][1], 0));
          neb.addColorStop(1, U.rgba(tema.cielo[4][1], k < 3 ? 0.55 : 0.18));
          q.globalCompositeOperation = "source-atop";
          q.fillStyle = neb;
          q.fillRect(0, 0, c.width, c.height);
          q.globalCompositeOperation = "source-over";
          capasNuevas.push({ c, y0, m });
        });
        return capasNuevas;
      }

      function construir() {
        const o = ctx.opciones;
        e = ctx.escala || 1;
        tema = o.noche ? TEMAS.noche : TEMAS.dia;
        clave = String(!!o.noche);
        for (const c of [cielo, rama, ...capas.map((k) => k.c), ...sprites]) if (c) c.width = c.height = 0;
        cielo = degradado(W, H, tema.cielo, tema.brillo, 12);
        const q = cielo.getContext("2d");
        if (o.noche) {
          const r = U.azar(55);
          for (let i = 0; i < 160; i++) {
            const y = Math.pow(r(), 1.4) * H * 0.6, s = (0.6 + r() * 1.3) * e;
            q.fillStyle = U.rgba("#ffffff", (0.3 + r() * 0.6) * (1 - y / (H * 0.7)));
            q.fillRect(r() * W, y, s, s);
          }
        }
        // sol que asoma (día) o luna (noche), con su halo
        const a = tema.astro, R = a.r * H, ax = a.x * W, ay = a.y * H;
        const halo = q.createRadialGradient(ax, ay, R * 0.8, ax, ay, R * 5);
        for (let i = 0; i <= 8; i++) halo.addColorStop(i / 8, U.rgba(a.halo, 0.55 * Math.pow(1 - i / 8, 2.2)));
        q.fillStyle = halo;
        q.fillRect(ax - R * 5, ay - R * 5, R * 10, R * 10);
        q.fillStyle = a.color;
        q.beginPath(); q.arc(ax, ay, R, 0, TAU); q.fill();
        capas = pintarMontes();
        rama = pintarRama();
        sprites = tema.petalos.map((c) => spritePetalo(Math.round(14 * e), c));
        if (!iniciados) { for (let i = 0; i < MAX_PETALOS; i++) nacer(i, true); iniciados = true; }
      }

      function moverPetalos(t, dt, n) {
        const v = (Number(ctx.opciones.viento) || 0) / 100;
        const rafaga = 0.75 + 0.25 * Math.sin(t * 0.23) + 0.18 * Math.sin(t * 0.61 + 1.3);
        const empuje = v * 110 * e * rafaga;
        for (let i = 0; i < n; i++) {
          const z = P.z[i];
          P.x[i] += (empuje * z + Math.sin(t * P.frec[i] + P.fase[i]) * 22 * e * z) * dt;
          P.y[i] += P.vy[i] * z * dt * (1 + v * 0.3);
          P.rot[i] += P.vr[i] * dt * (1 + v);
          P.giro[i] += P.vg[i] * dt;
          if (P.y[i] > H + 24 * e || P.x[i] > W + 40 * e || P.x[i] < -60 * e) nacer(i, false);
        }
      }

      function dibujarPetalos(n, cerca, dx) {
        for (let i = 0; i < n; i++) {
          const z = P.z[i];
          if ((z >= 0.95) !== cerca) continue;
          const s = sprites[P.spr[i]], f = Math.cos(P.giro[i]), c = Math.cos(P.rot[i]), sn = Math.sin(P.rot[i]);
          const k = z * 0.9;
          g.globalAlpha = tema.alfaPetalo * Math.min(1, 0.35 + z * 0.6);
          g.setTransform(c * f * k, sn * f * k, -sn * k, c * k, P.x[i] + dx * z, P.y[i]);
          g.drawImage(s, -s.width / 2, -s.height / 2);
        }
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.globalAlpha = 1;
      }

      return {
        redimensionar(ancho, alto) {
          const viejoW = W, viejoH = H;
          W = ancho; H = alto;
          if (iniciados && viejoW > 1) for (let i = 0; i < MAX_PETALOS; i++) { P.x[i] *= W / viejoW; P.y[i] *= H / viejoH; }
          construir();
        },

        cuadro(t, dt) {
          const o = ctx.opciones;
          if (String(!!o.noche) !== clave || ctx.escala !== e) construir();
          const n = Math.max(0, Math.min(MAX_PETALOS, Math.round(Number(o.petalos) || 0)));
          if (dt > 0) moverPetalos(t, dt, n);

          const mx = (ctx.mouse.x - 0.5) * 2, my = (ctx.mouse.y - 0.5) * 2;
          g.setTransform(1, 0, 0, 1, 0, 0);
          g.globalAlpha = 1;
          g.drawImage(cielo, 0, 0);
          capas.forEach((k, i) => g.drawImage(k.c, -k.m - mx * PARALAJE[i] * e, k.y0 - my * PARALAJE[i] * e * 0.4));

          const dxP = -mx * 8 * e;
          dibujarPetalos(n, false, dxP);
          if (o.rama) {
            const v = (Number(o.viento) || 0) / 100;
            const ang = (0.006 + 0.012 * v) * Math.sin(t * 0.7) + 0.004 * Math.sin(t * 1.9 + 1);
            const ox = -mx * 20 * e, oy = -my * 8 * e;
            g.setTransform(Math.cos(ang), Math.sin(ang), -Math.sin(ang), Math.cos(ang), anclaRama.x + ox, anclaRama.y + oy);
            g.drawImage(rama, -anclaRama.x, -anclaRama.y);
            g.setTransform(1, 0, 0, 1, 0, 0);
          }
          dibujarPetalos(n, true, dxP);
        },

        destruir() {
          for (const c of [cielo, rama, ...capas.map((k) => k.c), ...sprites]) if (c) c.width = c.height = 0;
          cielo = rama = null;
          capas = [];
          sprites = [];
        },
      };
    },
  });
})();

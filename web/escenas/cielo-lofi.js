// Noche lo-fi: cielo nocturno con estrellas, una luna grande, ciudad con ventanas que se encienden
// poco a poco, cables de luz y neblina. Todo lo estático se pinta una sola vez en lienzos aparte.
(function () {
  "use strict";
  const U = Lienzo.util;
  const TAU = Math.PI * 2;
  const MAX_ESTRELLAS = 600;

  // Colores de cada tono de cielo (de arriba hacia el horizonte) y de las siluetas.
  const TONOS = {
    morado: {
      cielo: [[0, "#06041a"], [0.3, "#150b38"], [0.58, "#32195f"], [0.8, "#6a3479"], [1, "#c06685"]],
      brillo: "#ff8fb0", luna: "#fff3e8", halo: "#d5b0ff",
      montana: ["#4a2b6d", "#7c4581"], atras: "#35205a", ciudad: "#1b1236", cerca: "#0b0717", niebla: "#dcbcf2",
    },
    azul: {
      cielo: [[0, "#020716"], [0.3, "#0a1a3f"], [0.58, "#163a71"], [0.8, "#2c609a"], [1, "#78a8d6"]],
      brillo: "#9fcaff", luna: "#f4f7ff", halo: "#a2c6ff",
      montana: ["#23416f", "#4675a6"], atras: "#1b3159", ciudad: "#0e1b38", cerca: "#050b1a", niebla: "#b6d2f3",
    },
    rosa: {
      cielo: [[0, "#10041a"], [0.3, "#2c0c38"], [0.58, "#5a1b56"], [0.8, "#9c3d6d"], [1, "#f29490"]],
      brillo: "#ffb39d", luna: "#fff1ea", halo: "#ffb8d4",
      montana: ["#692b5f", "#a65577"], atras: "#491c4a", ciudad: "#290f2e", cerca: "#130716", niebla: "#f7c3d9",
    },
    "verde-azulado": {
      cielo: [[0, "#020c11"], [0.3, "#062a35"], [0.58, "#0c4b55"], [0.8, "#1c7374"], [1, "#63b8a8"]],
      brillo: "#a6eed6", luna: "#f2fff9", halo: "#a2f2e0",
      montana: ["#0f4a52", "#2c807d"], atras: "#0c3a42", ciudad: "#07232a", cerca: "#031115", niebla: "#b0eae0",
    },
  };
  const CALIDOS = ["#ffd27f", "#ffbb66", "#ffe6ae", "#ffa36f"];
  const TINTES = ["#ffffff", "#cfe0ff", "#ffe2c4"];

  function nuevoLienzo(w, h) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }
  function porcentaje(v) { return Math.max(0, Math.min(100, Number(v) || 0)); }
  function suave(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

  // Ruido de valor 1D con semilla (crestas de montañas, alturas de la ciudad, colinas).
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

  // Cielo: degradado vertical + brillo elíptico + viñeta, con tramado (ruido de ±1 nivel) para que no se vean franjas.
  function pintarCielo(w, h, paradas, horizonte, brillo, vineta, semilla) {
    const c = nuevoLienzo(w, h), g = c.getContext("2d");
    w = c.width; h = c.height;
    const img = g.createImageData(w, h), d = img.data;
    const cols = paradas.map(([p, hex]) => [p, U.hexARgb(hex)]);
    const fila = new Float32Array(h * 3);
    for (let y = 0; y < h; y++) {
      const p = Math.min(1, y / (horizonte * h));
      let i = 0;
      while (i < cols.length - 2 && p > cols[i + 1][0]) i++;
      const a = cols[i], b = cols[i + 1], f = suave(0, 1, (p - a[0]) / ((b[0] - a[0]) || 1));
      for (let k = 0; k < 3; k++) fila[y * 3 + k] = a[1][k] + (b[1][k] - a[1][k]) * f;
    }
    const br = U.hexARgb(brillo.color);
    const gx = new Float32Array(w), gy = new Float32Array(h), vx = new Float32Array(w), vy = new Float32Array(h);
    for (let x = 0; x < w; x++) {
      const u = (x - brillo.x * w) / (brillo.rx * w);
      gx[x] = Math.exp(-u * u * 2);
      vx[x] = 1 - vineta * suave(0.5, 1.3, Math.abs(x / w - 0.5) * 2);
    }
    for (let y = 0; y < h; y++) {
      const u = (y - brillo.y * h) / (brillo.ry * h);
      gy[y] = Math.exp(-u * u * 2) * brillo.a;
      vy[y] = 1 - vineta * suave(0.55, 1.4, Math.abs(y / h - 0.5) * 2);
    }
    const ruido = new Float32Array(4096), r = U.azar(semilla || 5);
    for (let i = 0; i < 4096; i++) ruido[i] = (r() + r() - 1) * 1.5;
    let k = 0;
    for (let y = 0; y < h; y++) {
      const R = fila[y * 3], G = fila[y * 3 + 1], B = fila[y * 3 + 2], o = (r() * 4096) | 0, by = gy[y], vv = vy[y];
      for (let x = 0; x < w; x++) {
        const b = gx[x] * by, v = vx[x] * vv, n = ruido[(o + x) & 4095];
        d[k] = (R + (br[0] - R) * b) * v + n;
        d[k + 1] = (G + (br[1] - G) * b) * v + n;
        d[k + 2] = (B + (br[2] - B) * b) * v + n;
        d[k + 3] = 255;
        k += 4;
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  // Luna llena suave con halo grande y manchas (mares) muy tenues.
  function pintarLuna(R, tono) {
    const G = Math.ceil(R * 4.6), c = nuevoLienzo(G * 2, G * 2), g = c.getContext("2d");
    const cx = G, cy = G;
    const halo = g.createRadialGradient(cx, cy, R * 0.95, cx, cy, G);
    for (let i = 0; i <= 12; i++) { const p = i / 12; halo.addColorStop(p, U.rgba(tono.halo, 0.36 * Math.pow(1 - p, 2.6))); }
    g.fillStyle = halo;
    g.fillRect(0, 0, G * 2, G * 2);
    const disco = g.createRadialGradient(cx - R * 0.32, cy - R * 0.36, R * 0.05, cx, cy, R);
    disco.addColorStop(0, tono.luna);
    disco.addColorStop(0.7, U.mezclar(tono.luna, tono.halo, 0.14));
    disco.addColorStop(1, U.mezclar(tono.luna, tono.halo, 0.42));
    g.fillStyle = disco;
    g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
    g.save();
    g.clip();
    const mar = U.mezclar(tono.luna, "#7d7490", 0.6), r = U.azar(4242);
    const mancha = (x, y, rr, a) => {
      const m = g.createRadialGradient(x, y, 0, x, y, rr);
      m.addColorStop(0, U.rgba(mar, a));
      m.addColorStop(0.55, U.rgba(mar, a * 0.55));
      m.addColorStop(1, U.rgba(mar, 0));
      g.fillStyle = m;
      g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    };
    // mares grandes, cargados hacia un lado como en la luna real
    for (let i = 0; i < 9; i++) {
      const a = r() * TAU, d = Math.sqrt(r()) * R * 0.6, rr = R * (0.16 + r() * 0.24);
      mancha(cx - R * 0.12 + Math.cos(a) * d, cy - R * 0.08 + Math.sin(a) * d, rr, 0.13 + r() * 0.08);
    }
    // cráteres pequeños: manchitas suaves
    for (let i = 0; i < 14; i++) {
      const a = r() * TAU, d = Math.sqrt(r()) * R * 0.85;
      mancha(cx + Math.cos(a) * d, cy + Math.sin(a) * d, R * (0.03 + r() * 0.05), 0.16);
    }
    g.restore();
    return c;
  }

  // Sprite de estrella: punto con resplandor; con "cruz" agrega destellos finos.
  function spriteEstrella(radio, color, cruz) {
    const s = Math.ceil(radio * 2) + 2, c = nuevoLienzo(s, s), g = c.getContext("2d"), m = s / 2;
    const gr = g.createRadialGradient(m, m, 0, m, m, radio);
    gr.addColorStop(0, U.rgba(color, 1));
    gr.addColorStop(0.1, U.rgba(color, 0.9));
    gr.addColorStop(0.28, U.rgba(color, 0.28));
    gr.addColorStop(0.6, U.rgba(color, 0.06));
    gr.addColorStop(1, U.rgba(color, 0));
    g.fillStyle = gr;
    g.fillRect(0, 0, s, s);
    if (cruz) {
      const grosor = Math.max(1, radio * 0.07);
      for (const vertical of [false, true]) {
        const l = vertical ? g.createLinearGradient(m, 0, m, s) : g.createLinearGradient(0, m, s, m);
        l.addColorStop(0, U.rgba(color, 0)); l.addColorStop(0.5, U.rgba(color, 0.75)); l.addColorStop(1, U.rgba(color, 0));
        g.fillStyle = l;
        if (vertical) g.fillRect(m - grosor / 2, 0, grosor, s); else g.fillRect(0, m - grosor / 2, s, grosor);
      }
    }
    return c;
  }

  // Estela de estrella fugaz; la cabeza queda en x = largo, y = alto / 2.
  function spriteFugaz(largo, grosor) {
    const h = Math.ceil(grosor * 6), c = nuevoLienzo(largo + grosor * 3, h), g = c.getContext("2d"), cy = h / 2;
    const l = g.createLinearGradient(0, 0, largo, 0);
    l.addColorStop(0, "rgba(255,255,255,0)");
    l.addColorStop(0.65, "rgba(235,225,255,0.28)");
    l.addColorStop(1, "rgba(255,255,255,0.95)");
    g.fillStyle = l;
    g.beginPath(); g.moveTo(0, cy); g.lineTo(largo, cy - grosor / 2); g.lineTo(largo, cy + grosor / 2); g.closePath(); g.fill();
    const r = g.createRadialGradient(largo, cy, 0, largo, cy, grosor * 3);
    r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.3, "rgba(255,240,255,0.45)"); r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r;
    g.fillRect(largo - grosor * 3, 0, grosor * 6, h);
    c.cabeza = largo;
    return c;
  }

  // Neblina que se repite sin costura en horizontal (se dibuja dos veces, una junto a la otra).
  function pintarNiebla(w, h, color, semilla, cantidad, alfa) {
    const c = nuevoLienzo(w, h), g = c.getContext("2d"), r = U.azar(semilla);
    w = c.width;
    for (let i = 0; i < cantidad; i++) {
      const x = r() * w, y = h * (0.38 + r() * 0.24), rx = w * (0.07 + r() * 0.13), ry = h * (0.16 + r() * 0.18);
      const a = alfa * (0.5 + r() * 0.5);
      for (const ox of [-w, 0, w]) {
        if (x + ox + rx < 0 || x + ox - rx > w) continue;
        g.save();
        g.translate(x + ox, y);
        g.scale(rx / ry, 1);
        const gr = g.createRadialGradient(0, 0, 0, 0, 0, ry);
        gr.addColorStop(0, U.rgba(color, a));
        gr.addColorStop(0.45, U.rgba(color, a * 0.5));
        gr.addColorStop(1, U.rgba(color, 0));
        g.fillStyle = gr;
        g.fillRect(-ry, -ry, ry * 2, ry * 2);
        g.restore();
      }
    }
    return c;
  }

  // Pino estilizado de varios niveles (para siluetas).
  function pino(g, x, yb, h, w) {
    const n = 5, tr = h * 0.1, paso = (h - tr) / n;
    const yPunta = (i) => yb - h + paso * i;
    g.beginPath();
    g.moveTo(x, yb - h);
    for (let i = 1; i <= n; i++) {
      g.lineTo(x + w * (i / n), yPunta(i));
      if (i < n) g.lineTo(x + w * (i / n) * 0.45, yPunta(i) - paso * 0.22);
    }
    g.lineTo(x + w * 0.1, yb - tr); g.lineTo(x + w * 0.1, yb); g.lineTo(x - w * 0.1, yb); g.lineTo(x - w * 0.1, yb - tr);
    for (let i = n; i >= 1; i--) {
      g.lineTo(x - w * (i / n), yPunta(i));
      if (i > 1) g.lineTo(x - w * ((i - 1) / n) * 0.45, yPunta(i - 1) - paso * 0.22);
    }
    g.closePath();
    g.fill();
  }

  // Árbol frondoso: tronco y copa hecha de círculos.
  function arbol(g, x, yb, s, r) {
    g.fillRect(x - 1.3 * s, yb - 16 * s, 2.6 * s, 16 * s);
    g.beginPath();
    for (let i = 0; i < 9; i++) {
      const a = r() * TAU, d = r() * 8 * s, rad = (6 + r() * 5) * s;
      const cx = x + Math.cos(a) * d, cy = yb - 24 * s + Math.sin(a) * d * 0.75;
      g.moveTo(cx + rad, cy);
      g.arc(cx, cy, rad, 0, TAU);
    }
    g.fill();
  }

  Lienzo.escena({
    id: "cielo-lofi",
    nombre: "Noche lo-fi",
    descripcion: "Un cielo nocturno con luna, estrellas fugaces y una ciudad tranquila con ventanas encendidas.",
    tipo: "2d",
    fpsMax: 30,
    paleta: { fondo: "#120b22", superficie: "#1f1538", texto: "#f2eaff", tenue: "#9f8fc4", acento: "#ff8fb8", acento2: "#ffc977" },
    opciones: [
      { id: "estrellas", nombre: "Estrellas", tipo: "rango", min: 0, max: 600, paso: 10, valor: 260 },
      { id: "fugaces", nombre: "Estrellas fugaces", tipo: "si-no", valor: true },
      { id: "luna", nombre: "Luna", tipo: "si-no", valor: true },
      { id: "ventanas", nombre: "Ventanas encendidas (%)", tipo: "rango", min: 0, max: 100, paso: 5, valor: 30 },
      {
        id: "tono", nombre: "Tono del cielo", tipo: "lista",
        opciones: [["morado", "Morado"], ["azul", "Azul"], ["rosa", "Rosa"], ["verde-azulado", "Verde azulado"]],
        valor: "morado",
      },
    ],

    crear(lienzo, ctx) {
      const g = ctx.g;
      let W = 1, H = 1, e = 1;
      let tono = TONOS.morado, claveTono = "", claveVentanas = -1;
      let cielo = null, luna = null, capa1 = null, capa2 = null, capa3 = null, niebla1 = null, niebla2 = null;
      let spr = null, ciudad = null;
      let lunaX = 0, lunaY = 0;
      // Desplazamiento máximo por paralaje (px CSS): lo lejano se mueve menos que lo cercano.
      const PARALAJE = { estrellas: 2, luna: 4, capa1: 6, niebla1: 9, capa2: 12, niebla2: 16, capa3: 22 };
      // m = margen horizontal, v = margen vertical, y = posición vertical de cada capa en la pantalla.
      const capa = { m1: 0, m2: 0, m3: 0, v1: 0, v2: 0, v3: 0, y1: 0, y2: 0, y3: 0, yN1: 0, yN2: 0 };
      let fugaz = null, proximaFugaz = 4;
      const azarFugaz = U.azar(1312);

      // Estrellas en coordenadas normalizadas: siempre las mismas; la opción decide cuántas se dibujan.
      const est = (() => {
        const r = U.azar(2024), n = MAX_ESTRELLAS;
        const a = {
          x: new Float32Array(n), y: new Float32Array(n), tam: new Float32Array(n), alfa: new Float32Array(n),
          frec: new Float32Array(n), fase: new Float32Array(n), tipo: new Uint8Array(n), tinte: new Uint8Array(n),
        };
        for (let i = 0; i < n; i++) {
          a.x[i] = r();
          a.y[i] = 0.74 * Math.pow(r(), 1.2);
          const k = r();
          a.tipo[i] = k < 0.05 ? 2 : k < 0.24 ? 1 : 0;
          a.tam[i] = a.tipo[i] === 2 ? 6 + r() * 4 : a.tipo[i] === 1 ? 2.6 + r() * 2.2 : 0.8 + r() * 0.9;
          a.alfa[i] = (a.tipo[i] === 0 ? 0.35 + r() * 0.55 : 0.55 + r() * 0.45) * (1 - 0.85 * suave(0.42, 0.74, a.y[i]));
          a.frec[i] = 0.5 + r() * 2.2;
          a.fase[i] = r() * TAU;
          const c = r();
          a.tinte[i] = c < 0.7 ? 0 : c < 0.85 ? 1 : 2;
        }
        return a;
      })();

      // Geometría de la ciudad (edificios y ventanas): depende del tamaño, no de las opciones.
      // Coordenadas de la capa 2: x = xPantalla + m2, y = yPantalla - y2.
      function generarCiudad() {
        const r = U.azar(777), ruido = ruido1D(31);
        const m = capa.m2, y0 = capa.y2, Wc = W + 2 * m, fondo = H - y0 + capa.v2;
        const edificios = [];
        const vx = [], vy = [], vw = [], vh = [], rango = [], cambia = [], per = [], fase = [], ciclo = [], col = [], luz = [];
        let x = 0;
        while (x < Wc) {
          const centro = (x - m) / W;
          const ancho = Math.round((15 + r() * 34) * e);
          const env = 0.1 + 0.9 * Math.exp(-Math.pow((centro - 0.3) / 0.15, 2)) + 0.6 * Math.exp(-Math.pow((centro - 0.88) / 0.08, 2)) +
            0.3 * Math.exp(-Math.pow((centro - 0.6) / 0.05, 2));
          let alt = H * (0.05 + 0.25 * env * (0.4 + 0.6 * ruido(centro * 9, 2)) + r() * 0.04);
          if (r() < 0.25) alt *= 0.6;
          const top = Math.round(H * 0.87 - alt) - y0;
          // partes: [x, arriba, ancho, abajo]
          const ed = { x, ancho, partes: [[x, top, ancho, fondo]], antena: null, tanque: null };
          const forma = r();
          if (alt > H * 0.16 && forma < 0.45) {
            const w2 = Math.round(ancho * (0.5 + r() * 0.25)), h2 = Math.round((8 + r() * 18) * e);
            ed.partes.push([x + Math.round((ancho - w2) * r()), top - h2, w2, top]);
          } else if (forma > 0.86 && ancho > 22 * e) {
            ed.tanque = { x: x + ancho * (0.25 + r() * 0.4), y: top };
          }
          edificios.push(ed);
          if (r() < 0.88) {
            const ww = Math.max(1, Math.round(2.4 * e)), wh = Math.max(1, Math.round(3.4 * e));
            const sx = Math.round((6 + r() * 2) * e), sy = Math.round((8 + r() * 2) * e);
            const cols = Math.max(1, Math.floor((ancho - 8 * e + (sx - ww)) / sx));
            const x0 = x + Math.round((ancho - (cols * sx - (sx - ww))) / 2);
            const bandas = r() < 0.08; // ventanas corridas en franjas
            for (let yy = top + Math.round(6 * e); yy < H * 0.96 - y0; yy += sy) {
              for (let c = 0; c < (bandas ? 1 : cols); c++) {
                vx.push(x0 + c * sx); vy.push(yy);
                vw.push(bandas ? cols * sx - (sx - ww) : ww); vh.push(wh);
                rango.push(r()); cambia.push(r() < 0.05 ? 1 : 0);
                per.push(14 + r() * 40); fase.push(r() * 60); ciclo.push(0.35 + r() * 0.45);
                col.push(Math.floor(r() * CALIDOS.length));
                luz.push(bandas ? 0.45 : 0.55 + r() * 0.45);
              }
            }
          }
          x += ancho + (r() < 0.3 ? Math.round(r() * 5 * e) : 0);
        }
        // antenas con baliza roja en los edificios más altos
        const altura = (ed) => ed.partes[ed.partes.length - 1][1];
        const balizas = [];
        for (const ed of edificios.slice().sort((a, b) => altura(a) - altura(b)).slice(0, 4)) {
          const p = ed.partes[ed.partes.length - 1];
          const ax = p[0] + Math.round(p[2] / 2), alto = Math.round((14 + r() * 22) * e);
          ed.antena = { x: ax, y0: p[1], y1: p[1] - alto };
          balizas.push({ x: ax, y: p[1] - alto, fase: r() * TAU });
        }
        const F = (arr) => Float32Array.from(arr);
        return {
          edificios, balizas, cambiantes: new Uint32Array(0),
          v: {
            n: vx.length, x: F(vx), y: F(vy), w: F(vw), h: F(vh), rango: F(rango), cambia: Uint8Array.from(cambia),
            per: F(per), fase: F(fase), ciclo: F(ciclo), col: Uint8Array.from(col), luz: F(luz),
          },
        };
      }

      // Capa 1: montañas lejanas y ciudad del fondo, con bruma.
      function pintarCapa1() {
        const m = capa.m1, y0 = capa.y1, Wc = W + 2 * m, Hc = H - y0 + capa.v1;
        const c = nuevoLienzo(Wc, Hc), q = c.getContext("2d");
        const ruido = ruido1D(11), r = U.azar(99);
        const cresta = (xs) => H * (0.6 + 0.09 * ruido(xs / (0.26 * W) + 2.3, 5) - 0.05 * Math.exp(-Math.pow((xs / W - 0.15) / 0.12, 2))) - y0;
        const gm = q.createLinearGradient(0, H * 0.52 - y0, 0, H * 0.82 - y0);
        gm.addColorStop(0, tono.montana[0]);
        gm.addColorStop(1, tono.montana[1]);
        q.fillStyle = gm;
        q.beginPath();
        q.moveTo(0, Hc);
        for (let x = 0; x <= Wc + 4 * e; x += 3 * e) q.lineTo(x, cresta(x - m));
        q.lineTo(Wc, Hc);
        q.closePath();
        q.fill();
        // ciudad del fondo
        const ru2 = ruido1D(55), ventanas = [];
        q.fillStyle = tono.atras;
        let x = 0;
        while (x < Wc) {
          const xs = x - m, ancho = Math.round((10 + r() * 22) * e);
          const alt = H * (0.03 + 0.1 * ru2(xs / W * 7, 2) + r() * 0.035) * (0.6 + 0.6 * Math.exp(-Math.pow((xs / W - 0.62) / 0.25, 2)));
          const top = Math.round(H * 0.8 - alt) - y0;
          q.fillRect(x, top, ancho, Hc - top);
          if (r() < 0.3) q.fillRect(x + Math.round(ancho * 0.25), top - Math.round(6 * e), Math.round(ancho * 0.5), Math.round(6 * e));
          for (let yy = top + 4 * e; yy < Hc; yy += 6 * e) {
            for (let xx = x + 3 * e; xx < x + ancho - 3 * e; xx += 5 * e) if (r() < 0.07) ventanas.push(xx, yy);
          }
          x += ancho + (r() < 0.25 ? Math.round(r() * 4 * e) : 0);
        }
        q.fillStyle = U.rgba(CALIDOS[0], 0.55);
        const s = Math.max(1, Math.round(1.6 * e));
        for (let i = 0; i < ventanas.length; i += 2) q.fillRect(Math.round(ventanas[i]), Math.round(ventanas[i + 1]), s, s);
        // bruma en la base para dar profundidad
        const bruma = q.createLinearGradient(0, H * 0.7 - y0, 0, H * 0.86 - y0);
        bruma.addColorStop(0, U.rgba(tono.niebla, 0));
        bruma.addColorStop(1, U.rgba(tono.niebla, 0.22));
        q.fillStyle = bruma;
        q.globalCompositeOperation = "source-atop";
        q.fillRect(0, 0, Wc, Hc);
        q.globalCompositeOperation = "source-over";
        return c;
      }

      // Capa 2: ciudad principal. Las ventanas fijas se pintan aquí; las que cambian, en cada cuadro.
      function pintarCapa2(pct) {
        const Wc = W + 2 * capa.m2, Hc = H - capa.y2 + capa.v2;
        if (!capa2 || capa2.width !== Math.ceil(Wc) || capa2.height !== Math.ceil(Hc)) capa2 = nuevoLienzo(Wc, Hc);
        const q = capa2.getContext("2d");
        q.clearRect(0, 0, capa2.width, capa2.height);
        const borde = U.mezclar(tono.ciudad, tono.halo, 0.3), apagada = U.mezclar(tono.ciudad, tono.cielo[4][1], 0.13);
        const r = U.azar(4321), lw = Math.max(1, Math.round(e));
        for (const ed of ciudad.edificios) {
          const color = U.mezclar(tono.ciudad, tono.atras, r() * 0.25);
          q.fillStyle = color;
          for (const p of ed.partes) q.fillRect(p[0], p[1], p[2], p[3] - p[1]);
          if (ed.antena) {
            q.fillRect(ed.antena.x - lw / 2, ed.antena.y1, lw, ed.antena.y0 - ed.antena.y1);
            q.fillRect(ed.antena.x - 2 * lw, ed.antena.y0 - Math.round(6 * e), lw * 4, lw);
          }
          if (ed.tanque) {
            const tx = ed.tanque.x, ty = ed.tanque.y, tw = 9 * e, th = 8 * e, patas = 4 * e;
            q.fillRect(tx - tw / 2 + lw, ty - patas, lw, patas);
            q.fillRect(tx + tw / 2 - 2 * lw, ty - patas, lw, patas);
            q.fillRect(tx - tw / 2, ty - patas - th, tw, th);
            q.beginPath(); q.moveTo(tx - tw / 2 - lw, ty - patas - th); q.lineTo(tx, ty - patas - th - 4 * e); q.lineTo(tx + tw / 2 + lw, ty - patas - th); q.fill();
          }
          // luz de luna en el borde que mira hacia ella y en la azotea
          const haciaLuna = (ed.x - capa.m2 + ed.ancho / 2) < lunaX;
          q.fillStyle = U.rgba(borde, 0.55);
          for (const p of ed.partes) {
            q.fillRect(haciaLuna ? p[0] + p[2] - lw : p[0], p[1], lw, p[3] - p[1]);
            q.fillRect(p[0], p[1], p[2], lw);
          }
        }
        // ventanas: apagadas, fijas encendidas (con un brillo leve) y lista de las que cambian
        const v = ciudad.v, g1 = Math.max(1, Math.round(1.5 * e)), cambiantes = [];
        q.fillStyle = apagada;
        for (let i = 0; i < v.n; i++) q.fillRect(v.x[i], v.y[i], v.w[i], v.h[i]);
        for (let k = 0; k < CALIDOS.length; k++) {
          for (let i = 0; i < v.n; i++) {
            if (v.col[i] !== k || v.rango[i] >= pct || v.cambia[i]) continue;
            q.fillStyle = CALIDOS[k];
            q.globalAlpha = 0.12 * v.luz[i];
            q.fillRect(v.x[i] - g1, v.y[i] - g1, v.w[i] + 2 * g1, v.h[i] + 2 * g1);
            q.globalAlpha = v.luz[i];
            q.fillRect(v.x[i], v.y[i], v.w[i], v.h[i]);
          }
        }
        q.globalAlpha = 1;
        for (let i = 0; i < v.n; i++) if (v.cambia[i] && v.rango[i] < pct) cambiantes.push(i);
        ciudad.cambiantes = Uint32Array.from(cambiantes);
      }

      // Capa 3: colina cercana con árboles, postes de luz y cables.
      function pintarCapa3() {
        const m = capa.m3, y0 = capa.y3, Wc = W + 2 * m, Hc = H - y0 + capa.v3;
        const c = nuevoLienzo(Wc, Hc), q = c.getContext("2d");
        const ruido = ruido1D(77), r = U.azar(5150);
        const suelo = (xs) => H * (0.95 - 0.025 * ruido(xs / (0.2 * W) + 3.1, 3) - 0.045 * Math.exp(-Math.pow((xs / W - 0.05) / 0.15, 2)) -
          0.02 * Math.exp(-Math.pow((xs / W - 0.93) / 0.1, 2))) - y0;
        q.fillStyle = tono.cerca;
        q.strokeStyle = tono.cerca;
        q.beginPath();
        q.moveTo(0, Hc);
        for (let x = 0; x <= Wc + 4 * e; x += 3 * e) q.lineTo(x, suelo(x - m));
        q.lineTo(Wc, Hc);
        q.closePath();
        q.fill();
        // pasto en el borde
        q.beginPath();
        for (let x = 0; x < Wc; x += (2 + r() * 5) * e) {
          const y = suelo(x - m) + e, h = (2 + r() * 5) * e, inc = (r() - 0.5) * 3 * e;
          q.moveTo(x - 1.2 * e, y); q.lineTo(x + inc, y - h); q.lineTo(x + 1.2 * e, y);
        }
        q.fill();
        // árboles a la izquierda y pinos a la derecha
        for (const [fx, s] of [[-0.03, 1.5], [0.02, 1.25], [0.065, 1.05], [0.105, 0.85], [0.135, 0.65], [0.985, 1.2], [1.03, 1.4]]) {
          const xs = fx * W;
          arbol(q, xs + m, suelo(xs) + 2 * e, s * e * 1.5, r);
        }
        for (const [fx, s] of [[0.84, 0.85], [0.87, 1.1], [0.895, 0.75], [0.925, 1.3], [0.955, 0.95]]) {
          const xs = fx * W, h = (52 + r() * 20) * s * e;
          pino(q, xs + m, suelo(xs) + 2 * e, h, h * 0.3);
        }
        // postes de luz (dos fuera de la pantalla para que los cables entren y salgan)
        const postes = [-0.42, 0.2, 0.74, 1.3].map((fx) => {
          const xs = fx * W, base = suelo(Math.max(-m, Math.min(W + m, xs)));
          return { x: xs + m, base, top: base - H * 0.38 };
        });
        const lw = Math.max(1, Math.round(1.6 * e));
        for (const p of postes) {
          q.fillRect(p.x - lw, p.top, lw * 2, p.base - p.top + 2 * e);
          q.fillRect(p.x - 16 * e, p.top + 6 * e, 32 * e, lw);
          q.fillRect(p.x - 10 * e, p.top + 16 * e, 20 * e, lw);
          for (const dx of [-14, -6, 6, 14]) q.fillRect(p.x + dx * e - lw / 2, p.top + 3 * e, lw, 3 * e);
          q.fillRect(p.x - 4.5 * e, p.top + 26 * e, 9 * e, 12 * e); // transformador
        }
        q.lineWidth = Math.max(1, 1.1 * e);
        const puntas = [[-14, 3], [-6, 3], [6, 3], [14, 3], [-10, 16], [10, 16]];
        for (let i = 0; i < postes.length - 1; i++) {
          const a = postes[i], b = postes[i + 1];
          puntas.forEach(([dx, dy], j) => {
            const ya = a.top + dy * e, yb = b.top + dy * e, comba = H * (0.05 + j * 0.006);
            q.beginPath();
            for (let k = 0; k <= 48; k++) {
              const u = k / 48, x = a.x + dx * e + (b.x - a.x) * u, y = ya + (yb - ya) * u + comba * 4 * u * (1 - u);
              if (k) q.lineTo(x, y); else q.moveTo(x, y);
            }
            q.stroke();
          });
        }
        return c;
      }

      function construir() {
        e = ctx.escala || 1;
        const o = ctx.opciones;
        claveTono = String(o.tono);
        tono = TONOS[o.tono] || TONOS.morado;
        const amp = (k) => Math.ceil(PARALAJE[k] * e) + 2;
        capa.m1 = amp("capa1"); capa.m2 = amp("capa2"); capa.m3 = amp("capa3");
        capa.v1 = Math.ceil(capa.m1 * 0.5) + 2; capa.v2 = Math.ceil(capa.m2 * 0.5) + 2; capa.v3 = Math.ceil(capa.m3 * 0.5) + 2;
        capa.y1 = Math.floor(H * 0.5); capa.y2 = Math.floor(H * 0.4); capa.y3 = Math.floor(H * 0.42);
        capa.yN1 = H * 0.64; capa.yN2 = H * 0.79;
        lunaX = W * 0.74; lunaY = H * 0.25;
        for (const c of [cielo, luna, capa1, capa3, niebla1, niebla2]) if (c) c.width = c.height = 0;
        cielo = pintarCielo(W, H, tono.cielo, 0.78, { x: 0.55, y: 0.8, rx: 0.65, ry: 0.22, color: tono.brillo, a: 0.38 }, 0.32, 17);
        luna = pintarLuna(Math.min(W, H) * 0.085, tono);
        spr = {
          estrella: [TINTES.map((c) => spriteEstrella(8 * e, c, false)), TINTES.map((c) => spriteEstrella(14 * e, c, true))],
          baliza: spriteEstrella(7 * e, "#ff5a6a", false),
          fugaz: spriteFugaz(Math.round(170 * e), Math.max(1.5, 2.2 * e)),
        };
        capa1 = pintarCapa1();
        ciudad = generarCiudad();
        claveVentanas = porcentaje(o.ventanas);
        pintarCapa2(claveVentanas / 100);
        capa3 = pintarCapa3();
        niebla1 = pintarNiebla(W + 2 * Math.ceil(PARALAJE.niebla1 * e) + 4, H * 0.22, tono.niebla, 61, 26, 0.17);
        niebla2 = pintarNiebla(W + 2 * Math.ceil(PARALAJE.niebla2 * e) + 4, H * 0.24, tono.niebla, 62, 22, 0.15);
      }

      function dibujarEstrellas(t, n, dx, dy) {
        for (let k = 0; k < 3; k++) {
          g.fillStyle = TINTES[k];
          for (let i = 0; i < n; i++) {
            if (est.tipo[i] !== 0 || est.tinte[i] !== k) continue;
            g.globalAlpha = est.alfa[i] * (0.7 + 0.3 * Math.sin(t * est.frec[i] + est.fase[i]));
            const s = est.tam[i] * e;
            g.fillRect(est.x[i] * W + dx - s / 2, est.y[i] * H + dy - s / 2, s, s);
          }
        }
        for (let i = 0; i < n; i++) {
          const tp = est.tipo[i];
          if (tp === 0) continue;
          const tw = Math.sin(t * est.frec[i] + est.fase[i]);
          g.globalAlpha = est.alfa[i] * (0.62 + 0.38 * tw);
          const s = est.tam[i] * e * (tp === 2 ? 0.9 + 0.1 * tw : 1);
          g.drawImage(spr.estrella[tp - 1][est.tinte[i]], est.x[i] * W + dx - s, est.y[i] * H + dy - s, 2 * s, 2 * s);
        }
        g.globalAlpha = 1;
      }

      function dibujarFugaz(t, dt) {
        if (dt > 0 && !fugaz && t >= proximaFugaz) {
          const r = azarFugaz, haciaIzq = r() < 0.5, ang = 0.32 + r() * 0.3;
          fugaz = {
            t0: t, dur: 0.7 + r() * 0.5, x: W * (0.15 + r() * 0.7), y: H * (0.04 + r() * 0.28),
            dx: Math.cos(ang) * (haciaIzq ? -1 : 1), dy: Math.sin(ang), vel: (650 + r() * 450) * e,
          };
          proximaFugaz = t + 5 + r() * 11;
        }
        if (!fugaz) return;
        const edad = t - fugaz.t0;
        if (edad > fugaz.dur || edad < 0) { fugaz = null; return; }
        const p = edad / fugaz.dur, hx = fugaz.x + fugaz.dx * fugaz.vel * edad, hy = fugaz.y + fugaz.dy * fugaz.vel * edad;
        const s = spr.fugaz, largo = Math.min(1, edad / 0.18);
        g.globalAlpha = Math.pow(Math.sin(Math.PI * p), 0.8) * 0.9;
        g.setTransform(fugaz.dx * largo, fugaz.dy * largo, -fugaz.dy, fugaz.dx, hx, hy);
        g.drawImage(s, -s.cabeza, -s.height / 2);
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.globalAlpha = 1;
      }

      // Ventanas que se prenden y apagan despacio (su estado depende solo de t).
      function dibujarVentanas(t, ox, oy) {
        const v = ciudad.v, lista = ciudad.cambiantes, g1 = Math.max(1, Math.round(1.5 * e));
        for (let j = 0; j < lista.length; j++) {
          const i = lista[j], P = v.per[i], u = (t + v.fase[i]) % P, on = v.ciclo[i] * P;
          if (u >= on) continue;
          let a = Math.min(1, u / 1.2, (on - u) / 0.8);
          if (a <= 0.01) continue;
          a = a * a * (3 - 2 * a) * v.luz[i];
          const x = v.x[i] + ox, y = v.y[i] + oy;
          g.fillStyle = CALIDOS[v.col[i]];
          g.globalAlpha = a * 0.12;
          g.fillRect(x - g1, y - g1, v.w[i] + 2 * g1, v.h[i] + 2 * g1);
          g.globalAlpha = a;
          g.fillRect(x, y, v.w[i], v.h[i]);
        }
        g.globalAlpha = 1;
      }

      function dibujarBalizas(t, ox, oy) {
        const s = spr.baliza, r = s.width / 2;
        for (const b of ciudad.balizas) {
          const f = (t * 0.45 + b.fase / TAU) % 1;
          g.globalAlpha = 0.25 + 0.75 * Math.exp(-Math.pow((f - 0.15) / 0.06, 2));
          g.drawImage(s, b.x + ox - r, b.y + oy - r);
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
          if (String(o.tono) !== claveTono || ctx.escala !== e) construir();
          else if (porcentaje(o.ventanas) !== claveVentanas) { claveVentanas = porcentaje(o.ventanas); pintarCapa2(claveVentanas / 100); }

          const mx = (ctx.mouse.x - 0.5) * 2, my = (ctx.mouse.y - 0.5) * 2;
          const px = (k) => -mx * PARALAJE[k] * e, py = (k) => -my * PARALAJE[k] * e * 0.45;

          g.setTransform(1, 0, 0, 1, 0, 0);
          g.globalAlpha = 1;
          g.globalCompositeOperation = "source-over";
          g.drawImage(cielo, 0, 0);

          const n = Math.max(0, Math.min(MAX_ESTRELLAS, Math.round(Number(o.estrellas) || 0)));
          if (n) dibujarEstrellas(t, n, px("estrellas"), py("estrellas"));
          if (o.fugaces) dibujarFugaz(t, dt); else fugaz = null;
          if (o.luna) g.drawImage(luna, lunaX - luna.width / 2 + px("luna"), lunaY - luna.height / 2 + py("luna"));

          g.drawImage(capa1, -capa.m1 + px("capa1"), capa.y1 + py("capa1"));
          const x1 = px("niebla1") - Math.ceil(PARALAJE.niebla1 * e) - 2 - (t * 7 * e) % niebla1.width;
          g.drawImage(niebla1, x1, capa.yN1 + py("niebla1"));
          g.drawImage(niebla1, x1 + niebla1.width, capa.yN1 + py("niebla1"));

          const ox2 = -capa.m2 + px("capa2"), oy2 = capa.y2 + py("capa2");
          g.drawImage(capa2, ox2, oy2);
          dibujarVentanas(t, ox2, oy2);
          dibujarBalizas(t, ox2, oy2);

          const x2 = px("niebla2") - Math.ceil(PARALAJE.niebla2 * e) - 2 - (t * 12 * e) % niebla2.width;
          g.drawImage(niebla2, x2, capa.yN2 + py("niebla2"));
          g.drawImage(niebla2, x2 + niebla2.width, capa.yN2 + py("niebla2"));

          g.drawImage(capa3, -capa.m3 + px("capa3"), capa.y3 + py("capa3"));
        },

        destruir() {
          for (const c of [cielo, luna, capa1, capa2, capa3, niebla1, niebla2]) if (c) c.width = c.height = 0;
          cielo = luna = capa1 = capa2 = capa3 = niebla1 = niebla2 = null;
        },
      };
    },
  });
})();

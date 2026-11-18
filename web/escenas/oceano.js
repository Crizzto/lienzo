// Océano: mar tranquilo con olas en capas (sumas de senos), el reflejo tembloroso del sol o la luna,
// destellos sobre el agua y un faro lejano cuya luz gira. El cielo, las nubes y la isla se pintan una vez.
(function () {
  "use strict";
  const U = Lienzo.util;
  const TAU = Math.PI * 2;
  const HORIZONTE = 0.56;
  const CAPAS = 8;

  const HORAS = {
    atardecer: {
      cielo: [[0, "#26285c"], [0.35, "#5d3f86"], [0.62, "#c2607e"], [0.85, "#ff9f6e"], [1, "#ffd193"]],
      brillo: { x: 0.5, y: 1, rx: 0.45, ry: 0.5, color: "#ffc27a", a: 0.55 },
      astro: { x: 0.5, y: 0.525, r: 0.075, color: "#ffe6a8", halo: "#ff9a58", haloA: 0.7 },
      mar: ["#e4927c", "#8d5a86", "#3b2a5c", "#1a1433"], cresta: "#ffc9a0", reflejo: "#ffd08a",
      nubes: { color: "#ff9fa0", sombra: "#6d4a86", alfa: 0.5 }, estrellas: 0,
      faro: { torre: "#2a1d3a", franja: "#2a1d3a", roca: "#22182f", luz: 0.75 },
    },
    noche: {
      cielo: [[0, "#03081a"], [0.45, "#0a1838"], [0.8, "#173060"], [1, "#2b4a7e"]],
      brillo: { x: 0.3, y: 0.3, rx: 0.4, ry: 0.4, color: "#3a5a9a", a: 0.35 },
      astro: { x: 0.3, y: 0.2, r: 0.05, color: "#f2f5ff", halo: "#9fb8ff", haloA: 0.45 },
      mar: ["#2d4a7a", "#16294e", "#0b1733", "#050b1c"], cresta: "#9fbbe8", reflejo: "#dce8ff",
      nubes: null, estrellas: 220,
      faro: { torre: "#0b1222", franja: "#0b1222", roca: "#070c18", luz: 1 },
    },
    dia: {
      cielo: [[0, "#2a74cf"], [0.5, "#5fa6ea"], [0.85, "#a9d5f6"], [1, "#d8eefb"]],
      brillo: { x: 0.75, y: 0.25, rx: 0.35, ry: 0.4, color: "#f2f8ff", a: 0.45 },
      astro: { x: 0.75, y: 0.17, r: 0.045, color: "#fffdf0", halo: "#fff4c4", haloA: 0.55 },
      mar: ["#7cc0e6", "#3a8fc8", "#1c64a0", "#0b3f70"], cresta: "#e6f6ff", reflejo: "#ffffff",
      nubes: { color: "#ffffff", sombra: "#b9cfe6", alfa: 0.85 }, estrellas: 0,
      faro: { torre: "#f4f1ea", franja: "#d8473f", roca: "#3f4652", luz: 0.25 },
    },
  };

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
    const br = brillo ? U.hexARgb(brillo.color) : [0, 0, 0], gx = new Float32Array(w);
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

  function resplandor(radio, color, alfa) {
    const s = Math.ceil(radio * 2), c = nuevoLienzo(s, s), q = c.getContext("2d"), m = s / 2;
    const gr = q.createRadialGradient(m, m, 0, m, m, radio);
    for (let i = 0; i <= 8; i++) gr.addColorStop(i / 8, U.rgba(color, alfa * Math.pow(1 - i / 8, 2)));
    q.fillStyle = gr;
    q.fillRect(0, 0, s, s);
    return c;
  }

  Lienzo.escena({
    id: "oceano",
    nombre: "Océano",
    descripcion: "Un mar tranquilo con el reflejo tembloroso del sol o la luna y un faro a lo lejos.",
    tipo: "2d",
    fpsMax: 30,
    paleta: { fondo: "#141a33", superficie: "#1f2847", texto: "#f3f0ff", tenue: "#9aa3c7", acento: "#ffab73", acento2: "#7fc8ff" },
    opciones: [
      { id: "hora", nombre: "Hora del día", tipo: "lista", opciones: [["atardecer", "Atardecer"], ["noche", "Noche"], ["dia", "Día"]], valor: "atardecer" },
      { id: "olas", nombre: "Altura de las olas", tipo: "rango", min: 0.2, max: 2, paso: 0.1, valor: 1 },
      { id: "faro", nombre: "Faro", tipo: "si-no", valor: true },
    ],

    crear(lienzo, ctx) {
      const g = ctx.g;
      let W = 1, H = 1, e = 1, yh = 0, hora = HORAS.atardecer, clave = "";
      let cielo = null, nubes = null, isla = null, columna = null, chispa = null, haz = null, linterna = null;
      let gradientes = [], brillos = [], capas = [], bruma = null;
      const faro = { x: 0, y: 0 };
      const destellos = (() => {
        const r = U.azar(616), a = [];
        for (let i = 0; i < 70; i++) {
          const cerca = r() < 0.6; // la mayoría cerca del reflejo
          a.push({ u: cerca ? (r() - 0.5) * (r() * 0.5) : r() - 0.5, v: Math.pow(r(), 1.3), f: 0.8 + r() * 2.2, p: r() * TAU, s: 0.6 + r() * 0.9 });
        }
        return a;
      })();

      function construir() {
        const o = ctx.opciones;
        e = ctx.escala || 1;
        hora = HORAS[o.hora] || HORAS.atardecer;
        clave = String(o.hora);
        yh = Math.round(H * HORIZONTE);
        for (const c of [cielo, nubes, isla, columna, chispa, haz, linterna]) if (c) c.width = c.height = 0;

        // cielo con el sol o la luna
        cielo = degradado(W, yh + 2, hora.cielo, hora.brillo, 9);
        const q = cielo.getContext("2d");
        if (hora.estrellas) {
          const r = U.azar(31);
          for (let i = 0; i < hora.estrellas; i++) {
            const y = Math.pow(r(), 1.3) * yh * 0.9, s = (0.6 + r() * 1.2) * e;
            q.fillStyle = U.rgba("#ffffff", (0.25 + r() * 0.65) * (1 - y / yh));
            q.fillRect(r() * W, y, s, s);
          }
        }
        const a = hora.astro, R = a.r * H, ax = a.x * W, ay = a.y * H;
        const h = resplandor(R * 6, a.halo, a.haloA);
        q.drawImage(h, ax - h.width / 2, ay - h.height / 2);
        h.width = h.height = 0;
        const disco = q.createRadialGradient(ax, ay - R * 0.3, R * 0.1, ax, ay, R);
        disco.addColorStop(0, U.mezclar(a.color, "#ffffff", 0.5));
        disco.addColorStop(1, a.color);
        q.fillStyle = disco;
        q.beginPath(); q.arc(ax, ay, R, 0, TAU); q.fill();
        if (o.hora === "noche") {
          // manchas suaves de la luna
          q.save(); q.clip();
          const rr = U.azar(3);
          for (let i = 0; i < 7; i++) {
            const mx = ax + (rr() - 0.55) * R, my = ay + (rr() - 0.5) * R, mr = R * (0.15 + rr() * 0.3);
            const m = q.createRadialGradient(mx, my, 0, mx, my, mr);
            m.addColorStop(0, "rgba(140,150,190,0.25)"); m.addColorStop(1, "rgba(140,150,190,0)");
            q.fillStyle = m; q.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
          }
          q.restore();
        }

        // nubes que se repiten en horizontal (se mueven despacio)
        nubes = null;
        if (hora.nubes) {
          nubes = nuevoLienzo(W, yh * 0.75);
          const qn = nubes.getContext("2d"), r = U.azar(47), wn = nubes.width;
          // cada nube es un racimo de bolitas suaves: primero la sombra (abajo) y luego la parte iluminada
          const bolitas = [];
          for (let i = 0; i < 13; i++) {
            const cx = r() * wn, cy = nubes.height * (0.2 + r() * 0.72), ancho = W * (0.07 + r() * 0.13) * (0.6 + 0.6 * cy / nubes.height);
            const n = 5 + Math.floor(r() * 5);
            for (let p = 0; p < n; p++) {
              const u = (p + 0.5) / n - 0.5, rx = ancho * (0.16 + r() * 0.16) * (1 - Math.abs(u) * 0.8);
              bolitas.push([cx + u * ancho + (r() - 0.5) * ancho * 0.12, cy - rx * (0.25 + r() * 0.35) * (1 - Math.abs(u)), rx, rx * (0.42 + r() * 0.2)]);
            }
          }
          for (const [col, dy, al] of [[hora.nubes.sombra, 0.45, 0.55], [hora.nubes.color, 0, 0.9]]) {
            for (const [x, y, rx, ry] of bolitas) {
              for (const ox of [-wn, 0, wn]) {
                if (x + ox + rx < 0 || x + ox - rx > wn) continue;
                qn.save();
                qn.translate(x + ox, y + ry * dy);
                qn.scale(rx / ry, 1);
                const gr = qn.createRadialGradient(0, 0, 0, 0, 0, ry);
                gr.addColorStop(0, U.rgba(col, hora.nubes.alfa * al));
                gr.addColorStop(0.6, U.rgba(col, hora.nubes.alfa * al * 0.5));
                gr.addColorStop(1, U.rgba(col, 0));
                qn.fillStyle = gr;
                qn.fillRect(-ry, -ry, ry * 2, ry * 2);
                qn.restore();
              }
            }
          }
        }

        // isla con faro (siempre se pinta; la opción solo apaga la luz)
        const ih = H * 0.06, iw = W * 0.12;
        isla = nuevoLienzo(iw, ih + H * 0.11);
        {
          const qi = isla.getContext("2d"), base = isla.height, r = U.azar(12);
          qi.fillStyle = hora.faro.roca;
          qi.beginPath();
          qi.moveTo(0, base);
          for (let i = 0; i <= 12; i++) {
            const u = i / 12, alto = ih * Math.pow(Math.sin(Math.PI * u), 0.7) * (0.55 + 0.45 * r()) * (u < 0.5 ? 0.7 : 1);
            qi.lineTo(u * iw, base - alto);
          }
          qi.lineTo(iw, base);
          qi.closePath();
          qi.fill();
          // torre
          const tx = iw * 0.62, tb = base - ih * 0.8, th = H * 0.085, w0 = 9 * e, w1 = 6 * e;
          qi.fillStyle = hora.faro.torre;
          qi.beginPath();
          qi.moveTo(tx - w0 / 2, tb); qi.lineTo(tx - w1 / 2, tb - th); qi.lineTo(tx + w1 / 2, tb - th); qi.lineTo(tx + w0 / 2, tb);
          qi.closePath();
          qi.fill();
          if (hora.faro.franja !== hora.faro.torre) {
            qi.save(); qi.clip();
            qi.fillStyle = hora.faro.franja;
            for (let k = 0; k < 3; k++) qi.fillRect(tx - w0, tb - th * (0.18 + k * 0.3), w0 * 2, th * 0.13);
            qi.restore();
          }
          qi.fillStyle = hora.faro.roca;
          qi.fillRect(tx - w1 * 0.75, tb - th - 1.5 * e, w1 * 1.5, 1.5 * e);
          qi.fillRect(tx - w1 * 0.4, tb - th - 7 * e, w1 * 0.8, 5.5 * e);
          qi.beginPath(); qi.moveTo(tx - w1 * 0.6, tb - th - 7 * e); qi.lineTo(tx, tb - th - 11 * e); qi.lineTo(tx + w1 * 0.6, tb - th - 7 * e); qi.fill();
          faro.izq = W * 0.8;
          faro.arriba = yh - isla.height + 2 * e; // donde se dibuja la isla
          faro.x = faro.izq + tx;
          faro.y = faro.arriba + tb - th - 4 * e;
        }

        // reflejo: columna de luz suave (campana que se ensancha hacia abajo), calculada píxel por píxel
        columna = nuevoLienzo(R * 8, H - yh);
        {
          const qc = columna.getContext("2d"), cw = columna.width, chh = columna.height;
          const img = qc.createImageData(cw, chh), d = img.data, rgb = U.hexARgb(hora.reflejo);
          for (let y = 0, k = 0; y < chh; y++) {
            const v = y / chh, ancho = R * (0.35 + 1.9 * v), alfa = 255 * 0.5 * (1 - 0.75 * v);
            for (let x = 0; x < cw; x++, k += 4) {
              const u = (x - cw / 2) / ancho;
              d[k] = rgb[0]; d[k + 1] = rgb[1]; d[k + 2] = rgb[2];
              d[k + 3] = alfa * Math.exp(-u * u * 1.6);
            }
          }
          qc.putImageData(img, 0, 0);
        }
        // bruma sobre el horizonte del mar, para que las olas lejanas se fundan con el cielo
        bruma = g.createLinearGradient(0, yh, 0, yh + H * 0.07);
        bruma.addColorStop(0, U.rgba(hora.cielo[hora.cielo.length - 1][1], 0.55));
        bruma.addColorStop(1, U.rgba(hora.cielo[hora.cielo.length - 1][1], 0));
        const cs = Math.ceil(9 * e);
        chispa = nuevoLienzo(cs * 2, cs * 2);
        {
          const qs = chispa.getContext("2d");
          const gr = qs.createRadialGradient(cs, cs, 0, cs, cs, cs);
          gr.addColorStop(0, U.rgba(hora.reflejo, 1)); gr.addColorStop(0.15, U.rgba(hora.reflejo, 0.6)); gr.addColorStop(1, U.rgba(hora.reflejo, 0));
          qs.fillStyle = gr;
          qs.fillRect(0, 0, cs * 2, cs * 2);
          qs.fillStyle = U.rgba(hora.reflejo, 0.8);
          qs.fillRect(cs - 0.5 * e, 0, 1 * e, cs * 2);
          qs.fillRect(0, cs - 0.5 * e, cs * 2, 1 * e);
        }
        // haz del faro (cono que apunta a la derecha; se escala en x para simular que gira)
        const lh = W * 0.34, ah = H * 0.05;
        haz = nuevoLienzo(lh, ah);
        {
          const qh = haz.getContext("2d");
          const gr = qh.createLinearGradient(0, 0, lh, 0);
          gr.addColorStop(0, "rgba(255,244,214,0.75)"); gr.addColorStop(0.25, "rgba(255,244,214,0.3)"); gr.addColorStop(1, "rgba(255,244,214,0)");
          qh.fillStyle = gr;
          qh.beginPath(); qh.moveTo(0, ah / 2 - 1.5 * e); qh.lineTo(lh, 0); qh.lineTo(lh, ah); qh.lineTo(0, ah / 2 + 1.5 * e); qh.closePath();
          qh.fill();
        }
        linterna = resplandor(26 * e, "#fff1c9", 0.9);

        // olas: cada capa con su degradado (fijo, porque la capa solo sube y baja un poco)
        capas = [];
        gradientes = [];
        brillos = [];
        const sx = Math.min(0.98, Math.max(0.02, hora.astro.x));
        const mar = hora.mar;
        for (let k = 0; k < CAPAS; k++) {
          const u = k / (CAPAS - 1);
          const base = yh + (H - yh) * Math.pow(u, 1.6) * 0.9 + 2 * e;
          const capa = {
            base, u,
            amp: (1.2 + 15 * Math.pow(u, 1.4)) * e,
            kx: TAU / ((36 + 240 * Math.pow(u, 1.3)) * e),
            w: 0.5 + 0.5 * u,
            fase: k * 1.7,
          };
          capas.push(capa);
          const tope = U.mezclar(mar[Math.min(3, Math.floor(u * 3))], mar[Math.min(3, Math.floor(u * 3) + 1)], (u * 3) % 1);
          const gr = g.createLinearGradient(0, base - capa.amp * 2, 0, base + (H - yh) * 0.25);
          gr.addColorStop(0, U.mezclar(tope, hora.cresta, 0.22));
          gr.addColorStop(0.3, tope);
          gr.addColorStop(1, U.mezclar(tope, "#000000", 0.25));
          gradientes.push(gr);
          // el brillo de las crestas es más fuerte hacia el lado del sol o la luna
          const al = 0.32 + 0.25 * (1 - u), gb = g.createLinearGradient(0, 0, W, 0);
          gb.addColorStop(0, U.rgba(hora.cresta, al * 0.25));
          gb.addColorStop(sx, U.rgba(hora.cresta, al));
          gb.addColorStop(1, U.rgba(hora.cresta, al * 0.25));
          const r = U.azar(70 + k), patron = [];
          for (let i = 0; i < 8; i++) patron.push((20 + r() * 90) * (0.5 + u) * e, (8 + r() * 40) * (0.5 + u) * e);
          brillos.push({ estilo: gb, patron });
        }
      }

      function alturaOla(c, x, t, f) {
        const s = x * c.kx;
        return c.base - c.amp * f * (0.55 * Math.sin(s + t * c.w * 1.3 + c.fase) + 0.3 * Math.sin(s * 2.13 - t * c.w * 1.7 + c.fase * 2) + 0.15 * Math.sin(s * 4.37 + t * c.w * 2.6));
      }

      function dibujarOlas(t, f) {
        const paso = Math.max(4, Math.round(7 * e));
        for (let k = 0; k < CAPAS; k++) {
          const c = capas[k];
          const fondo = k < CAPAS - 1 ? capas[k + 1].base + capas[k + 1].amp * f * 1.05 + 2 * e : H;
          g.beginPath();
          g.moveTo(0, fondo);
          for (let x = 0; x <= W + paso; x += paso) g.lineTo(x, alturaOla(c, x, t, f));
          g.lineTo(W + paso, fondo);
          g.closePath();
          g.fillStyle = gradientes[k];
          g.fill();
          // brillo en la cresta, cortado en tramos
          g.strokeStyle = brillos[k].estilo;
          g.setLineDash(brillos[k].patron);
          g.lineWidth = Math.max(1, (0.6 + c.u * 1.2) * e);
          g.beginPath();
          for (let x = 0; x <= W + paso; x += paso) { const y = alturaOla(c, x, t, f) + g.lineWidth * 0.5; if (x) g.lineTo(x, y); else g.moveTo(x, y); }
          g.stroke();
          g.setLineDash([]);
        }
      }

      // Reflejo del sol o la luna: destellos horizontales cortos que aparecen y desaparecen, en una franja
      // que se ensancha hacia quien mira.
      function dibujarReflejo(t) {
        const a = hora.astro, R = a.r * H, x0 = a.x * W, alto = H - yh;
        g.globalCompositeOperation = "lighter";
        g.globalAlpha = 0.6;
        g.drawImage(columna, x0 - columna.width / 2, yh);
        g.fillStyle = hora.reflejo;
        const n = 64;
        for (let i = 0; i < n; i++) {
          const q = (i + 0.5) / n, y = yh + alto * Math.pow(q, 1.6);
          const ancho = R * (0.35 + 2.2 * q), h = Math.max(1, (0.7 + 2.2 * q) * e);
          for (let j = 0; j < 3; j++) {
            const s1 = Math.sin(t * (0.9 + j * 0.37) + i * 2.31 + j * 1.7), s2 = Math.sin(t * (1.6 + j * 0.21) + i * 1.13 + j * 4.1);
            const vis = s1 * s2;
            if (vis < 0.06) continue;
            const cx = x0 + ancho * 0.85 * Math.sin(i * 12.9898 + j * 78.233 + t * 0.25 * (j + 1));
            const largo = ancho * (0.15 + 0.45 * Math.abs(s2)) * (1 - Math.abs(cx - x0) / (ancho * 1.6));
            g.globalAlpha = Math.min(1, (0.9 - 0.4 * q) * vis * 1.3);
            g.fillRect(cx - largo / 2, y, largo, h);
          }
        }
        // destellos
        const cs = chispa.width;
        for (const d of destellos) {
          const brillo = Math.pow(Math.max(0, Math.sin(t * d.f + d.p)), 10);
          if (brillo < 0.02) continue;
          const y = yh + alto * (0.04 + 0.92 * d.v), x = x0 + d.u * W * (0.3 + d.v);
          const s = cs * d.s * (0.5 + d.v * 0.8);
          g.globalAlpha = brillo * 0.9;
          g.drawImage(chispa, x - s / 2, y - s / 2, s, s);
        }
        g.globalAlpha = 1;
        g.globalCompositeOperation = "source-over";
      }

      function dibujarFaro(t) {
        const ang = t * 0.9, s = Math.sin(ang), frente = Math.max(0, Math.cos(ang));
        const luz = hora.faro.luz;
        g.globalCompositeOperation = "lighter";
        if (Math.abs(s) > 0.02) {
          g.globalAlpha = luz * 0.7 * Math.pow(Math.abs(s), 0.6);
          g.setTransform(s, 0, 0, 1, faro.x, faro.y - haz.height / 2);
          g.drawImage(haz, 0, 0);
          g.setTransform(1, 0, 0, 1, 0, 0);
        }
        const k = 0.45 + 0.55 * Math.pow(frente, 8);
        g.globalAlpha = Math.min(1, luz * k + 0.15);
        const r = linterna.width * (0.5 + 0.7 * Math.pow(frente, 8));
        g.drawImage(linterna, faro.x - r / 2, faro.y - r / 2, r, r);
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
          if (String(o.hora) !== clave || ctx.escala !== e) construir();
          const f = Math.max(0, Number(o.olas) || 0);

          g.setTransform(1, 0, 0, 1, 0, 0);
          g.globalAlpha = 1;
          g.globalCompositeOperation = "source-over";
          g.drawImage(cielo, 0, 0);
          if (nubes) {
            const d = (t * 4 * e) % nubes.width;
            g.drawImage(nubes, -d, yh * 0.12);
            g.drawImage(nubes, nubes.width - d, yh * 0.12);
          }
          g.drawImage(isla, faro.izq, faro.arriba);
          if (o.faro) dibujarFaro(t);
          dibujarOlas(t * (0.6 + 0.4 * Math.min(1.5, f)), f);
          g.fillStyle = bruma;
          g.fillRect(0, yh, W, H * 0.07);
          dibujarReflejo(t);
        },

        destruir() {
          for (const c of [cielo, nubes, isla, columna, chispa, haz, linterna]) if (c) c.width = c.height = 0;
          cielo = nubes = isla = columna = chispa = haz = linterna = null;
        },
      };
    },
  });
})();

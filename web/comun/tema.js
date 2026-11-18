// Colores y estilo compartidos: aplica la paleta como variables CSS y la calcula a partir del fondo (estilo pywal).
(function () {
  "use strict";
  const L = (window.Lienzo = window.Lienzo || {});

  const hexARgb = (hex) => {
    let h = String(hex || "#000").replace("#", "");
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const n = parseInt(h.slice(0, 6), 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const rgbAHex = (r, g, b) => "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");

  function rgbAHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return [h, s, l];
  }

  function hslAHex(h, s, l) {
    h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
    let [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return rgbAHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
  }

  const hsl = (hex) => rgbAHsl(...hexARgb(hex));

  function luminancia(hex) {
    const v = hexARgb(hex).map((c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  }
  const contraste = (a, b) => { const x = luminancia(a), y = luminancia(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

  /** Roles de la paleta (fondo, superficie, texto, tenue, acento, acento2) a partir de colores dominantes [{color, peso}]. */
  function rolesDesdeColores(lista) {
    const cols = (lista || []).filter((c) => c && c.color).map((c) => {
      const [h, s, l] = hsl(c.color);
      return { color: c.color, peso: c.peso || 0.1, h, s, l };
    });
    if (!cols.length) return null;
    // Fondo: el color oscuro con más presencia, llevado a una luminosidad muy baja.
    const oscuros = cols.slice().sort((a, b) => (a.l - b.l) - (b.peso - a.peso) * 0.15);
    const base = oscuros.find((c) => c.peso > 0.05) || oscuros[0];
    const satFondo = Math.min(0.45, base.s * 0.9 + 0.05);
    const fondo = hslAHex(base.h, satFondo, 0.085);
    const superficie = hslAHex(base.h, satFondo * 0.9, 0.16);
    const texto = hslAHex(base.h, Math.min(0.35, satFondo), 0.95);
    const tenue = hslAHex(base.h, Math.min(0.22, satFondo), 0.7);
    // Acento: el color más vivo (saturado y con luz media), con algo de peso en la imagen.
    const puntuar = (c) => c.s * Math.pow(c.peso, 0.25) * (c.l > 0.2 && c.l < 0.85 ? 1 : 0.45);
    const vivos = cols.slice().sort((a, b) => puntuar(b) - puntuar(a));
    const a1 = vivos[0];
    let acento = hslAHex(a1.h, Math.max(0.62, Math.min(0.95, a1.s * 1.15)), 0.68);
    if (a1.s < 0.12) acento = hslAHex(base.h + 180, 0.65, 0.7); // imagen casi gris: inventar un acento armónico
    const a2 = vivos.find((c) => Math.min(Math.abs(c.h - a1.h), 360 - Math.abs(c.h - a1.h)) > 35 && c.s > 0.15);
    const acento2 = a2 ? hslAHex(a2.h, Math.max(0.55, Math.min(0.9, a2.s * 1.1)), 0.72) : hslAHex(hsl(acento)[0] + 140, 0.6, 0.72);
    return { fondo, superficie, texto, tenue, acento, acento2 };
  }

  /** Colores dominantes de un canvas (k-means pequeño, como hace pywal). */
  function dominantesDeCanvas(lienzo, k) {
    k = k || 8;
    const g = lienzo.getContext("2d", { willReadFrequently: true });
    const { data } = g.getImageData(0, 0, lienzo.width, lienzo.height);
    const pix = [];
    for (let i = 0; i < data.length; i += 4) pix.push([data[i], data[i + 1], data[i + 2]]);
    if (!pix.length) return [];
    const lum = (p) => 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2];
    const orden = pix.slice().sort((a, b) => lum(a) - lum(b));
    let centros = Array.from({ length: k }, (_, c) => orden[Math.floor(((c + 0.5) * orden.length) / k)].slice());
    const grupo = new Int32Array(pix.length);
    for (let it = 0; it < 10; it++) {
      for (let i = 0; i < pix.length; i++) {
        let mejor = Infinity, cual = 0;
        for (let c = 0; c < k; c++) {
          const dr = pix[i][0] - centros[c][0], dg = pix[i][1] - centros[c][1], db = pix[i][2] - centros[c][2];
          const d = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;
          if (d < mejor) { mejor = d; cual = c; }
        }
        grupo[i] = cual;
      }
      const suma = centros.map(() => [0, 0, 0, 0]);
      for (let i = 0; i < pix.length; i++) { const s = suma[grupo[i]]; s[0] += pix[i][0]; s[1] += pix[i][1]; s[2] += pix[i][2]; s[3]++; }
      centros = centros.map((c, i) => (suma[i][3] ? [suma[i][0] / suma[i][3], suma[i][1] / suma[i][3], suma[i][2] / suma[i][3]] : c));
    }
    const cuenta = new Array(k).fill(0);
    grupo.forEach((c) => cuenta[c]++);
    return centros.map((c, i) => ({ color: rgbAHex(c[0], c[1], c[2]), peso: cuenta[i] / pix.length }))
      .filter((c) => c.peso > 0).sort((a, b) => b.peso - a.peso);
  }

  /** Pone la paleta y el estilo de la configuración como variables CSS en la página. */
  function aplicar(config, raiz) {
    const el = raiz || document.documentElement;
    const p = (config && config.paleta && config.paleta.colores) || {};
    const e = (config && config.estilo) || {};
    const set = (k, v) => { if (v !== undefined && v !== null && v !== "") el.style.setProperty(k, v); };
    ["fondo", "superficie", "texto", "tenue", "acento", "acento2"].forEach((r) => {
      if (!p[r]) return;
      set(`--${r}`, p[r]);
      set(`--${r}-rgb`, hexARgb(p[r]).join(", "));
    });
    set("--fuente", `"${e.fuente || "Segoe UI Variable Display"}", "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif`);
    set("--fuente-mono", `"${e.fuenteMono || "Cascadia Mono"}", "Cascadia Code", Consolas, monospace`);
    set("--radio", `${e.redondeo != null ? e.redondeo : 14}px`);
    set("--opacidad", e.opacidad != null ? e.opacidad : 0.55);
    el.classList.toggle("sin-sombra", e.sombra === false);
  }

  L.tema = { aplicar, rolesDesdeColores, dominantesDeCanvas, hexARgb, rgbAHex, hsl, hslAHex, contraste };

  // Utilidades de configuración compartidas
  L.clonar = (o) => JSON.parse(JSON.stringify(o));
  L.ruta = (obj, ruta) => ruta.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
  L.ponerRuta = (obj, ruta, valor) => {
    const partes = ruta.split(".");
    let o = obj;
    partes.slice(0, -1).forEach((k) => { if (typeof o[k] !== "object" || o[k] === null) o[k] = {}; o = o[k]; });
    o[partes[partes.length - 1]] = valor;
  };
  L.fusionar = function fusionar(base, encima) {
    const r = Array.isArray(base) ? base.slice() : Object.assign({}, base);
    Object.keys(encima || {}).forEach((k) => {
      const a = r[k], b = encima[k];
      r[k] = a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b) ? fusionar(a, b) : b;
    });
    return r;
  };
  L.escapar = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // Carga un script una sola vez (escenas y bloques se cargan bajo demanda).
  const cargados = {};
  L.cargar = (src) => cargados[src] || (cargados[src] = new Promise((ok, mal) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = ok;
    s.onerror = () => mal(new Error("No se pudo cargar " + src));
    document.head.appendChild(s);
  }));
})();

// Letras en vivo: la letra de la canción que suena (Spotify, navegador, reproductor…), sincronizada línea por línea.
// Las letras vienen de LRCLIB (lrclib.net, gratis y sin cuenta) y se guardan para no volver a pedirlas.
(function () {
  "use strict";
  const L = window.Lienzo;

  // ---- Buscar y guardar letras ----
  const memoria = new Map(), enCurso = new Map();
  const PREFIJO = "lienzo-letra:";

  function leerGuardada(k) {
    try { const v = localStorage.getItem(PREFIJO + k); return v ? JSON.parse(v) : null; } catch (e) { return null; }
  }
  function guardar(k, v) {
    try { localStorage.setItem(PREFIJO + k, JSON.stringify(v)); } catch (e) {
      // Almacenamiento lleno: se borran las letras guardadas (son solo caché) y se intenta otra vez.
      try {
        Object.keys(localStorage).filter((x) => x.startsWith(PREFIJO)).forEach((x) => localStorage.removeItem(x));
        localStorage.setItem(PREFIJO + k, JSON.stringify(v));
      } catch (e2) { /* sin almacenamiento */ }
    }
  }

  // Títulos de YouTube y similares: «Artista - Canción (Official Video) [HD]» → «Canción».
  const RUIDO = /\s*[([][^)\]]*(official|oficial|video|vídeo|lyric|letra|audio|visualizer|remaster|hd|4k|mv|live|en vivo)[^)\]]*[)\]]/gi;
  function limpiar(titulo, artista) {
    let t = String(titulo || "").replace(RUIDO, "").replace(/\s*\|.*$/, "").trim();
    let a = String(artista || "").replace(/\s*-\s*topic$/i, "").replace(/vevo$/i, "").trim();
    const guion = t.match(/^(.+?)\s+[-–—]\s+(.+)$/);
    if (guion && (!a || guion[1].toLowerCase().includes(a.toLowerCase()) || a.toLowerCase().includes(guion[1].toLowerCase()))) { a = guion[1].trim(); t = guion[2].trim(); }
    return { t, a };
  }

  async function pedir(url) {
    const r = await fetch(url);
    if (r.status === 404) return null;
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }

  async function descargar(m) {
    const { t, a } = limpiar(m.titulo, m.artista);
    const dur = Math.round(m.duracion || 0);
    const base = "https://lrclib.net/api/";
    let r = null;
    if (a && t) {
      r = await pedir(`${base}get?track_name=${encodeURIComponent(t)}&artist_name=${encodeURIComponent(a)}` +
        (m.album ? `&album_name=${encodeURIComponent(m.album)}` : "") + (dur ? `&duration=${dur}` : ""));
    }
    if (!r || (!r.syncedLyrics && !r.plainLyrics && !r.instrumental)) {
      const lista = (await pedir(`${base}search?q=${encodeURIComponent((a ? a + " " : "") + t)}`)) || [];
      // Mejor la que tenga letra sincronizada y dure casi lo mismo.
      const puntos = (x) => (x.syncedLyrics ? 0 : 1000) + (dur && x.duration ? Math.abs(x.duration - dur) : 30);
      r = lista.filter((x) => x.syncedLyrics || x.plainLyrics || x.instrumental).sort((x, y) => puntos(x) - puntos(y))[0] || null;
    }
    if (!r) return { nada: true };
    return { s: r.syncedLyrics || "", p: r.plainLyrics || "", i: !!r.instrumental };
  }

  function letraDe(m) {
    const k = (m.titulo + "|" + m.artista).toLowerCase();
    if (memoria.has(k)) return Promise.resolve(memoria.get(k));
    const g = leerGuardada(k);
    if (g) { memoria.set(k, g); return Promise.resolve(g); }
    if (enCurso.has(k)) return enCurso.get(k);
    const p = descargar(m).then((v) => { memoria.set(k, v); guardar(k, v); return v; })
      .catch((e) => { L.puente.log("Letras: " + e.message); return { error: true }; })
      .finally(() => enCurso.delete(k));
    enCurso.set(k, p);
    return p;
  }

  // «[01:23.45] texto» (puede haber varias marcas de tiempo en un renglón).
  function leerLrc(lrc) {
    const lineas = [];
    String(lrc || "").split(/\r?\n/).forEach((r) => {
      const marcas = [...r.matchAll(/\[(\d+):(\d+(?:[.:]\d+)?)\]/g)];
      if (!marcas.length) return;
      const texto = r.replace(/\[[^\]]*\]/g, "").trim();
      marcas.forEach((x) => lineas.push({ t: Number(x[1]) * 60 + Number(x[2].replace(":", ".")), texto }));
    });
    return lineas.sort((a, b) => a.t - b.t);
  }

  L.bloque({
    tipo: "letras",
    nombre: "Letras en vivo",
    icono: "comillas",
    descripcion: "La letra de la canción que suena, sincronizada línea por línea.",
    opciones: [
      { id: "estilo", nombre: "Estilo", tipo: "lista", valor: "karaoke", opciones: [["karaoke", "Karaoke"], ["linea", "Una línea"], ["tarjeta", "Tarjeta"]] },
      { id: "lineas", nombre: "Renglones visibles", tipo: "lista", valor: 5, opciones: [[3, "3"], [5, "5"], [7, "7"]] },
      { id: "ancho", nombre: "Ancho", tipo: "rango", min: 280, max: 900, paso: 20, valor: 520 },
      { id: "ajuste", nombre: "Adelantar la letra (segundos)", tipo: "rango", min: -2, max: 2, paso: 0.1, valor: 0 },
      { id: "ocultar", nombre: "Ocultar si no hay letra", tipo: "si-no", valor: false },
    ],
    comunes: { fondo: "ninguno", alinear: "centro" },
    css: `
      .b-letras { width: var(--ancho); text-align: inherit; }
      .b-letras .cab { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; text-align: left; }
      .b-letras .cab .portada { width: 44px; height: 44px; border-radius: 10px; flex: none; background: linear-gradient(135deg, var(--acento), var(--acento2)) center / cover; }
      .b-letras .cab b { display: block; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .b-letras .cab span { display: block; font-size: 13px; color: var(--tenue); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .b-letras .ventana { position: relative; overflow: hidden; height: calc(var(--n) * 1.55em + .4em); font-size: 21px;
        -webkit-mask-image: linear-gradient(transparent, #000 22%, #000 78%, transparent); mask-image: linear-gradient(transparent, #000 22%, #000 78%, transparent); }
      .b-letras .lista { transition: transform .55s cubic-bezier(.22, 1, .36, 1); will-change: transform; }
      .b-letras .l { line-height: 1.3; padding: .125em 0; font-weight: 600; opacity: .32; transition: opacity .4s, color .4s, transform .4s; transform-origin: var(--origen) center; }
      .b-letras .l.actual { opacity: 1; color: var(--acento); transform: scale(1.06); }
      .b-letras .l.paso { opacity: .5; }
      .b-letras .l.vacia::before { content: "♪"; }
      .b-letras.e-linea .ventana { height: auto; -webkit-mask-image: none; mask-image: none; font-size: 26px; }
      .b-letras.e-linea .actual-l { font-weight: 700; color: var(--acento); min-height: 1.3em; transition: opacity .3s; }
      .b-letras.e-linea .sig-l { font-size: .62em; color: var(--tenue); margin-top: 4px; min-height: 1.3em; }
      .b-letras .aviso { color: var(--tenue); font-size: 15px; padding: 6px 0; }
      .b-letras .plana { font-size: 12px; color: var(--tenue); margin-top: 6px; }
      .pausado .b-letras .lista, .pausado .b-letras .l { transition: none; }
    `,
    crear(el, ctx) {
      const o = ctx.opciones, esc = L.escapar;
      const caja = el.closest(".bloque");
      el.classList.add("b-letras", "e-" + o.estilo);
      el.style.setProperty("--ancho", (Number(o.ancho) || 520) + "px");
      el.style.setProperty("--n", Number(o.lineas) || 5);
      el.style.setProperty("--origen", o.alinear === "derecha" ? "right" : o.alinear === "centro" ? "center" : "left");

      let clave = "", lineas = [], plana = "", actual = -2, t = 0, vivo = true;

      const posicion = () => {
        const m = L.datos.musica || {};
        let p = m.posicion || 0;
        if (m.reproduciendo && m.recibido) p += (performance.now() - m.recibido) / 1000;
        return p + (Number(o.ajuste) || 0);
      };

      function cabecera(m) {
        if (o.estilo !== "tarjeta") return "";
        return `<div class="cab"><div class="portada" style="${m.portada ? `background-image:url('${m.portada}')` : ""}"></div>
          <div style="min-width:0"><b>${esc(m.titulo || "")}</b><span>${esc(m.artista || m.app || "")}</span></div></div>`;
      }

      function aviso(texto, m) {
        lineas = []; plana = ""; actual = -2;
        el.innerHTML = cabecera(m || {}) + `<div class="aviso">${esc(texto)}</div>`;
      }

      function mostrar(v, m) {
        if (caja) caja.classList.toggle("oculto-sin-musica", !!o.ocultar && !ctx.editando && (!v || v.nada || v.error || (!v.s && !v.p)));
        if (!v) return aviso("Buscando la letra…", m);
        if (v.error) return aviso("No pude buscar la letra (¿sin internet?).", m);
        if (v.i) return aviso("♪ Instrumental", m);
        if (v.nada || (!v.s && !v.p)) return aviso("No encontré la letra de esta canción.", m);
        lineas = v.s ? leerLrc(v.s) : [];
        plana = lineas.length ? "" : v.p;
        if (!lineas.length) lineas = String(plana).split(/\r?\n/).map((texto) => ({ t: null, texto: texto.trim() }));
        actual = -2;
        if (o.estilo === "linea") {
          el.innerHTML = `<div class="ventana"><div class="actual-l"></div><div class="sig-l"></div></div>`;
        } else {
          el.innerHTML = cabecera(m) + `<div class="ventana"><div class="lista">${lineas.map((x) =>
            `<div class="l${x.texto ? "" : " vacia"}">${esc(x.texto)}</div>`).join("")}</div></div>` +
            (plana ? '<div class="plana">Letra sin sincronizar: avanza según el tiempo de la canción.</div>' : "");
        }
        tic();
      }

      // Línea que toca ahora. Sin marcas de tiempo, se reparte la letra a lo largo de la canción.
      function indice() {
        const p = posicion();
        if (plana) {
          const m = L.datos.musica || {};
          return m.duracion ? Math.min(lineas.length - 1, Math.floor((p / m.duracion) * lineas.length)) : 0;
        }
        let i = -1;
        while (i + 1 < lineas.length && lineas[i + 1].t <= p) i++;
        return i;
      }

      function tic() {
        clearTimeout(t);
        t = 0;
        if (!vivo || !lineas.length) return;
        const i = indice();
        if (i !== actual) {
          actual = i;
          if (o.estilo === "linea") {
            const a = el.querySelector(".actual-l"), s = el.querySelector(".sig-l");
            if (a) { a.textContent = i >= 0 ? lineas[i].texto || "♪" : "♪"; s.textContent = (lineas[i + 1] || {}).texto || ""; }
          } else {
            const lista = el.querySelector(".lista"), ventana = el.querySelector(".ventana");
            if (lista) {
              lista.querySelectorAll(".l").forEach((x, k) => { x.classList.toggle("actual", k === i); x.classList.toggle("paso", k === i - 1 || k === i + 1); });
              const cur = lista.children[Math.max(0, i)];
              if (cur) lista.style.transform = `translateY(${(ventana.clientHeight / 2 - (cur.offsetTop + cur.offsetHeight / 2)).toFixed(1)}px)`;
            }
          }
        }
        const m = L.datos.musica || {};
        if (!m.reproduciendo || document.body.classList.contains("pausado")) return; // se reanuda con el siguiente aviso de música
        let espera = 1000;
        if (!plana && lineas[i + 1]) espera = Math.max(60, Math.min(1000, (lineas[i + 1].t - posicion()) * 1000 + 30));
        t = setTimeout(tic, espera);
      }

      function alCambiarMusica() {
        const m = L.datos.musica || {};
        const hay = m.activa && (m.titulo || m.artista);
        const k = hay ? m.titulo + "|" + m.artista : "";
        if (k !== clave) {
          clave = k;
          if (!hay) {
            if (caja) caja.classList.toggle("oculto-sin-musica", !!o.ocultar && !ctx.editando);
            return aviso(ctx.editando ? "Aquí saldrá la letra de lo que suene" : "Pon algo de música", m);
          }
          mostrar(null, m);
          letraDe(m).then((v) => { if (vivo && clave === k) mostrar(v, L.datos.musica || m); });
          return;
        }
        actual = -2; // la posición pudo saltar (adelantar/atrasar la canción)
        tic();
      }

      alCambiarMusica();
      ctx.on("musica", alCambiarMusica);
      const quitar = L.reloj.suscribir(() => { if (!t) tic(); });
      return { destruir() { vivo = false; clearTimeout(t); quitar(); } };
    },
  });
})();

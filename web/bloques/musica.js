Lienzo.bloque({
  tipo: "musica",
  nombre: "Música",
  icono: "nota",
  descripcion: "Lo que suena en Spotify, YouTube o cualquier reproductor.",
  opciones: [
    { id: "estilo", nombre: "Estilo", tipo: "lista", valor: "tarjeta", opciones: [["tarjeta", "Tarjeta"], ["vinilo", "Vinilo"], ["minimal", "Una línea"]] },
    { id: "ocultar", nombre: "Ocultar si no suena nada", tipo: "si-no", valor: false },
    { id: "progreso", nombre: "Barra de progreso", tipo: "si-no", valor: true },
    { id: "controles", nombre: "Botones (anterior, pausa, siguiente)", tipo: "si-no", valor: false },
    { id: "soloDe", nombre: "Solo de esta app", tipo: "lista", valor: "", opciones: [["", "Cualquiera"], ["Spotify", "Spotify"], ["Apple Music", "Apple Music"],
      ["Deezer", "Deezer"], ["TIDAL", "TIDAL"], ["Amazon Music", "Amazon Music"], ["Chrome", "Chrome"], ["Edge", "Edge"], ["Firefox", "Firefox"], ["Brave", "Brave"], ["Reproductor", "Reproductor multimedia"]] },
  ],
  comunes: { fondo: "vidrio" },
  css: `
    .b-musica { text-shadow: none; }
    .b-musica .tit { font-weight: 700; font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .b-musica .art { color: var(--tenue); font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
    .b-musica .app { font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--acento); font-weight: 700; margin-bottom: 6px; display: flex; align-items: center; gap: 6px; }
    .b-musica .barras { display: inline-flex; gap: 2px; align-items: flex-end; height: 10px; }
    .b-musica .barras i { width: 3px; background: var(--acento); border-radius: 2px; animation: lz-eq 1s ease-in-out infinite; }
    .b-musica .barras i:nth-child(2) { animation-delay: -.4s; } .b-musica .barras i:nth-child(3) { animation-delay: -.7s; }
    .b-musica.parado .barras i, .pausado .b-musica .barras i { animation-play-state: paused; }
    @keyframes lz-eq { 0%, 100% { height: 3px; } 50% { height: 10px; } }
    .b-musica .prog { height: 4px; border-radius: 4px; background: rgba(var(--texto-rgb), .12); margin-top: 12px; overflow: hidden; }
    .b-musica .prog i { display: block; height: 100%; width: 0; background: linear-gradient(90deg, var(--acento), var(--acento2)); border-radius: 4px; }
    .b-musica .tiempos { display: flex; justify-content: space-between; font-size: 11px; color: var(--tenue); margin-top: 5px; font-variant-numeric: tabular-nums; }
    .b-musica .portada { flex: none; background: linear-gradient(135deg, var(--acento), var(--acento2)); background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; color: var(--fondo); }
    .b-musica.e-tarjeta { display: flex; gap: 14px; align-items: center; width: 330px; }
    .b-musica.e-tarjeta .portada { width: 74px; height: 74px; border-radius: calc(var(--radio) * .7); font-size: 30px; box-shadow: 0 6px 20px rgba(0,0,0,.3); }
    .b-musica.e-tarjeta .txt { min-width: 0; flex: 1; }
    .b-musica.e-vinilo { width: 240px; text-align: center; }
    .b-musica.e-vinilo .disco { width: 170px; height: 170px; margin: 0 auto 14px; border-radius: 50%; position: relative;
      background: repeating-radial-gradient(circle, #111 0 2px, #1c1c1c 2px 4px); box-shadow: 0 10px 30px rgba(0,0,0,.45), inset 0 0 0 2px rgba(255,255,255,.04);
      animation: lz-giro 6s linear infinite; }
    .b-musica.e-vinilo .disco .portada { position: absolute; inset: 50px; border-radius: 50%; font-size: 22px; }
    .b-musica.e-vinilo .disco::after { content: ""; position: absolute; left: 50%; top: 50%; width: 8px; height: 8px; margin: -4px; border-radius: 50%; background: var(--fondo); }
    .b-musica.e-vinilo.parado .disco, .pausado .b-musica.e-vinilo .disco { animation-play-state: paused; }
    @keyframes lz-giro { to { transform: rotate(360deg); } }
    .b-musica.e-minimal { display: flex; align-items: center; gap: 10px; font-size: 16px; white-space: nowrap; max-width: 520px; text-shadow: var(--sombra-texto); }
    .b-musica.e-minimal .ic { color: var(--acento); font-size: 18px; }
    .b-musica.e-minimal .tit, .b-musica.e-minimal .art { display: inline; font-size: 16px; }
    .b-musica.e-minimal .art::before { content: "·"; margin: 0 8px; color: var(--tenue); }
    .b-musica .nada { color: var(--tenue); font-size: 14px; }
    .b-musica .ctl { display: flex; align-items: center; gap: 6px; margin-top: 10px; }
    .b-musica.e-vinilo .ctl { justify-content: center; }
    .b-musica .ctl .bt { width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--texto); }
    .b-musica .ctl .bt .ic { width: 18px; height: 18px; color: inherit; }
    .b-musica .ctl .bt.lz-encima { background: rgba(var(--texto-rgb), .1); }
    .b-musica .ctl .bt.pp { width: 40px; height: 40px; background: var(--acento); color: var(--fondo); }
    .b-musica .ctl .bt.pp .ic { width: 20px; height: 20px; }
    .b-musica .ctl .bt.abrir-app { width: auto; height: 32px; padding: 0 14px; border-radius: 999px; background: var(--acento); color: var(--fondo); font-size: 13px; font-weight: 700; gap: 6px; }
    .b-musica.e-minimal .ctl { margin: 0 0 0 6px; gap: 2px; }
    .b-musica.e-minimal .ctl .bt { width: 26px; height: 26px; } .b-musica.e-minimal .ctl .bt.pp { width: 28px; height: 28px; }
    .b-musica.e-minimal .ctl .bt .ic { width: 14px; height: 14px; }
  `,
  crear(el, ctx) {
    const o = ctx.opciones, F = Lienzo.formato, I = Lienzo.icono, esc = Lienzo.escapar;
    el.classList.add("b-musica", "e-" + o.estilo);
    const caja = el.closest(".bloque");
    let portadaActual = null;
    const pintar = () => {
      const m = Lienzo.datos.musica || {};
      const deOtra = !!o.soloDe && m.activa && String(m.app || "").toLowerCase() !== o.soloDe.toLowerCase();
      const hay = m.activa && (m.titulo || m.artista) && !deOtra;
      if (caja) caja.classList.toggle("oculto-sin-musica", !hay && o.ocultar && !ctx.editando);
      el.classList.toggle("parado", !m.reproduciendo);
      const titulo = hay ? m.titulo : o.soloDe ? o.soloDe : "Nada sonando";
      const artista = hay ? m.artista || m.app || "" : o.soloDe ? "No está sonando" : "Pon algo de música";
      if (o.estilo === "minimal") {
        el.innerHTML = `${I("nota")}<span class="tit">${esc(titulo)}</span>${artista ? `<span class="art">${esc(artista)}</span>` : ""}`;
        controles(el, hay, m);
        return;
      }
      if (!el.querySelector(".tit")) {
        const portada = `<div class="portada">${I("nota")}</div>`;
        const texto = `<div class="app"><span class="barras"><i></i><i></i><i></i></span><span class="fuente"></span></div>
          <div class="tit"></div><div class="art"></div>
          ${o.progreso ? '<div class="prog"><i></i></div><div class="tiempos"><span class="t1"></span><span class="t2"></span></div>' : ""}
          ${o.controles ? '<div class="ctl"></div>' : ""}`;
        el.innerHTML = o.estilo === "vinilo" ? `<div class="disco">${portada}</div>${texto}` : `${portada}<div class="txt">${texto}</div>`;
      }
      el.querySelector(".tit").textContent = titulo;
      el.querySelector(".art").textContent = artista;
      el.querySelector(".fuente").textContent = hay ? (m.reproduciendo ? m.app || "Sonando" : "En pausa") : o.soloDe || "Música";
      const ctl = el.querySelector(".ctl");
      if (ctl) controles(ctl, hay, m);
      const p = el.querySelector(".portada");
      const nueva = hay && m.portada ? m.portada : "";
      if (nueva !== portadaActual) {
        portadaActual = nueva;
        p.style.backgroundImage = nueva ? `url("${nueva}")` : "";
        p.innerHTML = nueva ? "" : I("nota");
      }
      progreso();
    };
    const progreso = () => {
      if (!o.progreso || o.estilo === "minimal") return;
      const m = Lienzo.datos.musica || {};
      const barra = el.querySelector(".prog i");
      if (!barra) return;
      const dur = m.duracion || 0;
      let pos = m.posicion || 0;
      if (m.reproduciendo && m.recibido) pos += (performance.now() - m.recibido) / 1000;
      pos = Math.min(pos, dur);
      barra.style.width = dur ? `${(pos / dur) * 100}%` : "0";
      el.querySelector(".t1").textContent = dur ? F.minutos(pos) : "";
      el.querySelector(".t2").textContent = dur ? F.minutos(dur) : "";
    };
    // Botones: se rehacen solo si cambia lo que deben mostrar (para no perder el resaltado del ratón).
    let estadoCtl = "";
    function controles(caja, hay, m) {
      if (!o.controles) return;
      let ctl = caja.classList.contains("ctl") ? caja : caja.querySelector(".ctl");
      if (!ctl) { ctl = document.createElement("span"); ctl.className = "ctl"; caja.appendChild(ctl); estadoCtl = ""; }
      const app = o.app && (o.app.destino || o.app.clave);
      const estado = hay ? (m.reproduciendo ? "pausa" : "play") : app ? "abrir" : "nada";
      if (estado === estadoCtl && ctl.childElementCount) return;
      estadoCtl = estado;
      ctl.innerHTML = "";
      const boton = (clase, html, titulo, fn) => {
        const b = document.createElement("span");
        b.className = "bt " + clase;
        b.innerHTML = html;
        ctl.appendChild(b);
        Lienzo.tocable(b, fn, titulo);
      };
      const media = (accion) => () => Lienzo.puente.enviar("media", { accion });
      if (estado === "abrir") { boton("abrir-app", I("play") + "Abrir " + esc(o.soloDe || o.app.nombre || ""), "Abrir la app", () => Lienzo.lanzar(app)); return; }
      if (estado === "nada") return;
      boton("", I("anterior"), "Anterior", media("anterior"));
      boton("pp", I(m.reproduciendo ? "pausa" : "play"), m.reproduciendo ? "Pausar" : "Reproducir", media("pausa"));
      boton("", I("siguiente"), "Siguiente", media("siguiente"));
    }
    pintar();
    ctx.on("musica", pintar);
    const quitar = Lienzo.reloj.suscribir(progreso);
    return { destruir: quitar };
  },
});

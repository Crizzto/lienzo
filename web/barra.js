// La barra de Lienzo: módulos configurables en tres secciones (inicio, centro, fin).
(function () {
  "use strict";
  const L = window.Lienzo, P = L.puente, I = L.icono, esc = L.escapar, F = L.formato;
  let config = null;
  let ventanas = { lista: [], fijadas: [], iconos: {} };
  const iconos = {};
  let claveEstructura = "";

  const NOMBRES = {
    inicio: "Inicio", apps: "Apps", reloj: "Reloj", musica: "Música", sistema: "Sistema", volumen: "Volumen",
    bateria: "Batería", red: "Red", bandeja: "Bandeja", notificaciones: "Notificaciones", lienzo: "Lienzo",
    buscar: "Buscar", escritorio: "Escritorio", ventanaActiva: "Ventana activa",
  };
  L.modulosBarra = NOMBRES;

  // ---------- Construcción ----------
  function construir() {
    const b = config.barra || {};
    const vertical = b.posicion === "izquierda" || b.posicion === "derecha";
    document.body.className = [
      `estilo-${b.estilo || "islas"}`, `fondo-${b.fondo || "acrilico"}`, `pos-${b.posicion || "arriba"}`,
      vertical ? "vertical" : "horizontal", b.flotante ? "flotante" : "pegada",
    ].join(" ");
    const raiz = document.body.style;
    raiz.setProperty("--grosor", `${b.grosor || 38}px`);
    raiz.setProperty("--radio-barra", `${b.flotante === false && b.estilo !== "islas" ? 0 : b.redondeo != null ? b.redondeo : 14}px`);
    raiz.setProperty("--opacidad-barra", b.opacidad != null ? b.opacidad : 0.55);

    const m = b.modulos || {};
    const clave = JSON.stringify([m, vertical, b.iconoInicio, b.textoInicio, b.titulos, b.reloj]);
    if (clave === claveEstructura) { pintarTodo(); return; }
    claveEstructura = clave;
    ["inicio", "centro", "fin"].forEach((s) => {
      const sec = document.querySelector(`.seccion.${s}`);
      const mods = (m[s] || []).filter((id) => NOMBRES[id]);
      sec.innerHTML = mods.length ? `<div class="isla">${mods.map(htmlModulo).join("")}</div>` : "";
    });
    pintarTodo();
  }

  function htmlModulo(id) {
    const b = config.barra || {};
    switch (id) {
      case "inicio":
        return `<button class="mod inicio" data-mod="inicio" title="Inicio">${b.textoInicio ? `<span class="txt">${esc(b.textoInicio)}</span>` : I(b.iconoInicio || "luna")}</button>`;
      case "apps": return `<div class="apps" data-mod="apps"></div>`;
      case "reloj": return `<button class="mod reloj" data-mod="reloj" title="Calendario y notificaciones"><span class="hora"></span><span class="fecha tenue"></span></button>`;
      case "musica": return `<div class="mod musica oculto" data-mod="musica"><span class="nota">${I("nota")}</span><span class="tit" data-accion="pausa"></span>
          <span class="ctrl" data-accion="anterior" title="Anterior">${I("anterior")}</span><span class="ctrl play" data-accion="pausa" title="Reproducir o pausar"></span>
          <span class="ctrl" data-accion="siguiente" title="Siguiente">${I("siguiente")}</span></div>`;
      case "sistema": return `<button class="mod sistema" data-mod="sistema" title="Abrir el Administrador de tareas">${I("cpu")}<span class="cpu"></span>${I("ram")}<span class="ram"></span></button>`;
      case "volumen": return `<button class="mod volumen" data-mod="volumen" title="Volumen (rueda del ratón para cambiarlo, clic para silenciar)"><span class="vic"></span><span class="val"></span></button>`;
      case "bateria": return `<button class="mod bateria oculto" data-mod="bateria" title="Batería"><span class="bateria-ic">${I("bateria")}<i></i></span><span class="rayo"></span><span class="val"></span></button>`;
      case "red": return `<button class="mod red" data-mod="red" title="Red"><span class="ric"></span></button>`;
      case "bandeja": return `<button class="mod bandeja" data-mod="bandeja" title="Iconos ocultos de la bandeja">${I("arriba")}</button>`;
      case "notificaciones": return `<button class="mod" data-mod="notificaciones" title="Notificaciones">${I("campana")}</button>`;
      case "lienzo": return `<button class="mod lienzo" data-mod="lienzo" title="Ajustes de Lienzo">${I("lienzo")}</button>`;
      case "buscar": return `<button class="mod" data-mod="buscar" title="Buscar">${I("buscar")}</button>`;
      case "escritorio": return `<button class="mod" data-mod="escritorio" title="Mostrar el escritorio">${I("escritorio")}</button>`;
      case "ventanaActiva": return `<span class="mod ventana-activa" data-mod="ventanaActiva"></span>`;
    }
    return "";
  }

  function pintarTodo() { pintarReloj(new Date()); pintarSistema(); pintarMusica(); pintarApps(); }

  // ---------- Reloj ----------
  function pintarReloj(d) {
    const el = document.querySelector(".mod.reloj");
    if (!el) return;
    const r = (config.barra && config.barra.reloj) || {};
    const t = F.hora(d, r.formato24, r.segundos);
    const vertical = document.body.classList.contains("vertical");
    el.querySelector(".hora").innerHTML = vertical ? `<span>${t.h}</span><span>${t.m}</span>` : `${t.texto}${t.sufijo ? " " + t.sufijo : ""}`;
    el.querySelector(".fecha").textContent = r.fecha === false ? "" : F.capital(F.fechaCorta(d));
  }
  L.reloj.suscribir(pintarReloj);

  // ---------- Sistema, volumen, batería, red ----------
  function pintarSistema() {
    const s = L.datos.sistema || {};
    const q = (sel) => document.querySelector(sel);
    if (q(".mod.sistema")) { q(".mod.sistema .cpu").textContent = `${Math.round(s.cpu || 0)}%`; q(".mod.sistema .ram").textContent = `${s.ram || 0}%`; }
    const vol = q(".mod.volumen");
    if (vol) {
      const v = s.volumen;
      vol.classList.toggle("oculto", v == null || v < 0);
      vol.querySelector(".vic").innerHTML = I(s.silencio || v === 0 ? "silencio" : v < 40 ? "volumenBajo" : "volumen");
      vol.querySelector(".val").textContent = s.silencio ? "" : `${v}%`;
    }
    const bat = q(".mod.bateria");
    if (bat) {
      const v = s.bateria;
      bat.classList.toggle("oculto", !(v >= 0));
      if (v >= 0) {
        bat.querySelector(".bateria-ic i").style.width = `${Math.max(0.06, (v / 100) * 0.6)}em`;
        bat.querySelector(".val").textContent = `${v}%`;
        bat.querySelector(".rayo").innerHTML = s.cargando ? I("rayo") : "";
        bat.classList.toggle("bateria-baja", v <= 15 && !s.cargando);
        bat.title = `Batería: ${v}%${s.cargando ? " (cargando)" : ""}${s.ahorro ? " · ahorro de energía" : ""}`;
      }
    }
    const red = q(".mod.red");
    if (red) {
      red.querySelector(".ric").innerHTML = I(s.red === "sin" ? "sinRed" : s.red === "cable" ? "cable" : "wifi");
      red.title = s.red === "sin" ? "Sin conexión" : `Bajada: ${F.bytes(s.bajada)} · Subida: ${F.bytes(s.subida)}`;
    }
  }
  P.on("sistema", pintarSistema);

  // ---------- Música ----------
  function pintarMusica() {
    const el = document.querySelector(".mod.musica");
    if (!el) return;
    const m = L.datos.musica || {};
    const hay = m.activa && (m.titulo || m.artista);
    el.classList.toggle("oculto", !hay);
    if (!hay) return;
    el.querySelector(".tit").textContent = m.artista ? `${m.titulo} · ${m.artista}` : m.titulo;
    el.title = `${m.titulo}${m.artista ? " — " + m.artista : ""}${m.app ? " (" + m.app + ")" : ""}`;
    el.querySelector(".play").innerHTML = I(m.reproduciendo ? "pausa" : "play");
  }
  P.on("musica", pintarMusica);

  // ---------- Apps (fijadas + ventanas abiertas) ----------
  P.on("ventanas", (m) => {
    Object.assign(iconos, m.iconos || {});
    ventanas = m;
    pintarApps();
  });

  function grupos() {
    const out = [];
    const igual = (w, g) => w.clave === g.clave || (g.ruta && w.ruta && g.ruta.toLowerCase() === w.ruta.toLowerCase());
    (config.fijadas || []).forEach((f) => {
      const info = (ventanas.fijadas || []).find((x) => x.clave === f.clave) || {};
      out.push({ clave: f.clave, nombre: f.nombre, destino: f.destino || f.clave, ruta: info.ruta || "", ventanas: [], fijada: true });
    });
    (ventanas.lista || []).forEach((w) => {
      let g = out.find((x) => igual(w, x));
      if (!g) { g = { clave: w.clave, nombre: w.titulo, destino: w.ruta, ruta: w.ruta, ventanas: [], fijada: false }; out.push(g); }
      g.ventanas.push(w);
    });
    return out;
  }

  let gruposActuales = [];
  function pintarApps() {
    const cont = document.querySelector(".apps");
    const activa = (ventanas.lista || []).find((w) => w.activa);
    const va = document.querySelector(".ventana-activa");
    if (va) va.textContent = activa ? activa.titulo : "";
    if (!cont) return;
    gruposActuales = grupos();
    const titulos = (config.barra && config.barra.titulos) || "activa";
    const vertical = document.body.classList.contains("vertical");
    cont.innerHTML = gruposActuales.map((g, i) => {
      const abierta = g.ventanas.length > 0;
      const act = g.ventanas.some((w) => w.activa);
      const atn = g.ventanas.some((w) => w.atencion);
      const icono = iconos[g.clave] || (g.ventanas[0] && iconos[g.ventanas[0].clave]);
      const nombre = g.ventanas.length ? g.ventanas.map((w) => w.titulo).join("\n") : g.nombre;
      const conTitulo = !vertical && abierta && (titulos === "todas" || (titulos === "activa" && act));
      const tituloTxt = conTitulo ? (g.ventanas.find((w) => w.activa) || g.ventanas[0]).titulo : "";
      return `<button class="app${abierta ? " abierta" : " cerrada"}${act ? " activa" : ""}${atn ? " atencion" : ""}" data-i="${i}" title="${esc(nombre)}">
        ${icono ? `<img src="${icono}" alt="">` : `<span class="sin-icono">${esc((g.nombre || "?").trim().charAt(0).toUpperCase())}</span>`}
        ${tituloTxt ? `<span class="titulo">${esc(tituloTxt)}</span>` : ""}
        ${g.ventanas.length > 1 ? `<span class="num">${g.ventanas.length}</span>` : ""}</button>`;
    }).join("");
  }

  function clicApp(i, boton) {
    const g = gruposActuales[i];
    if (!g) return;
    if (boton === 1 || !g.ventanas.length) {
      const destino = g.destino || g.ruta;
      if (destino) P.enviar("lanzar", { destino });
      return;
    }
    if (g.ventanas.length === 1) { P.enviar("ventana", { accion: "alternar", h: g.ventanas[0].h }); return; }
    // Varias ventanas de la misma app: cada clic trae la siguiente.
    const idx = g.ventanas.findIndex((w) => w.activa);
    const sig = idx < 0 ? g.ventanas[0] : g.ventanas[(idx + 1) % g.ventanas.length];
    P.enviar("ventana", { accion: idx >= 0 && g.ventanas.length === 1 ? "alternar" : "activar", h: sig.h });
  }

  // ---------- Interacción ----------
  document.addEventListener("mousedown", (e) => { if (e.button === 1) e.preventDefault(); }); // sin autodesplazamiento
  // La barra no roba el foco, así que Windows no sabe que hiciste clic fuera de su menú (wifi, Inicio…):
  // se avisa a Lienzo para que lo cierre, y si es el mismo botón, el clic solo lo cierra.
  document.addEventListener("pointerdown", () => P.enviar("toqueBarra"), true);
  document.addEventListener("auxclick", (e) => {
    if (e.button !== 1) return;
    const app = e.target.closest(".app");
    if (app) clicApp(Number(app.dataset.i), 1);
    else if (e.target.closest('[data-mod="volumen"]')) P.enviar("volumen", { silencio: true });
  });
  document.addEventListener("click", (e) => {
    const app = e.target.closest(".app");
    if (app) { clicApp(Number(app.dataset.i), 0); return; }
    const accion = e.target.closest("[data-accion]");
    if (accion) { P.enviar("media", { accion: accion.dataset.accion }); return; }
    const mod = e.target.closest("[data-mod]");
    if (!mod) return;
    switch (mod.dataset.mod) {
      case "inicio": P.enviar("teclas", { combo: "inicio" }); break;
      case "reloj": P.enviar("teclas", { combo: "notificaciones" }); break;
      case "sistema": P.enviar("lanzar", { destino: "taskmgr.exe" }); break;
      case "volumen": P.enviar("volumen", { silencio: true }); break;
      case "bateria": case "red": P.enviar("teclas", { combo: "ajustesRapidos" }); break;
      case "bandeja": P.enviar("bandeja"); break;
      case "notificaciones": P.enviar("teclas", { combo: "notificaciones" }); break;
      case "lienzo": P.enviar("abrirPanel"); break;
      case "buscar": P.enviar("teclas", { combo: "buscar" }); break;
      case "escritorio": P.enviar("teclas", { combo: "escritorio" }); break;
    }
  });
  document.addEventListener("wheel", (e) => {
    if (!e.target.closest('[data-mod="volumen"]')) return;
    P.enviar("volumen", { delta: e.deltaY < 0 ? 0.02 : -0.02 });
  }, { passive: true });
  document.addEventListener("contextmenu", (e) => e.preventDefault());

  P.on("config", (m) => {
    config = m.config || {};
    L.tema.aplicar(config);
    construir();
  });

  P.enviar("listo", { pagina: "barra" });
})();

// Panel de ajustes de Lienzo.
(function () {
  "use strict";
  const L = window.Lienzo, P = L.puente, I = L.icono, esc = L.escapar;
  const DATOS = "https://datos.lienzo.example/";
  const contenido = document.getElementById("contenido");
  const menu = document.getElementById("menu");
  const capaDialogo = document.getElementById("capa-dialogo");

  let config = null, estado = {}, enviado = "", primera = true, pendiente = false, punteroAbajo = false;
  let seccion = (location.hash || "#inicio").slice(1);
  if (seccion === "bienvenida") seccion = "inicio";
  let pestanaFondo = "escenas";
  let apps = null, escenasPropias = null, importando = null;
  const iconosApps = {};

  const SECCIONES = [
    ["inicio", "Temas", "varita"], ["fondo", "Fondo", "imagen"], ["barra", "Barra", "barra"], ["bloques", "Bloques", "bloques"],
    ["colores", "Colores y letra", "paleta"], ["escritorio", "Escritorio y Windows", "monitor"], ["rendimiento", "Rendimiento", "rendimiento"], ["acerca", "Acerca de", "info"],
  ];
  const MODULOS = {
    inicio: ["Inicio", "luna"], apps: ["Apps y ventanas", "apps"], reloj: ["Reloj", "reloj"], musica: ["Música", "nota"],
    sistema: ["CPU y RAM", "cpu"], volumen: ["Volumen", "volumen"], bateria: ["Batería", "bateria"], red: ["Red", "wifi"],
    bandeja: ["Bandeja", "arriba"], notificaciones: ["Notificaciones", "campana"], lienzo: ["Botón de Lienzo", "lienzo"],
    buscar: ["Buscar", "buscar"], escritorio: ["Mostrar escritorio", "escritorio"], ventanaActiva: ["Ventana activa", "ventana"],
  };
  const ICONOS_INICIO = ["luna", "cuadros", "estrella", "flor", "gato", "rayo", "terminal", "ondas", "lienzo", "corazon", "montana", "taza", "sol"];
  const PALETAS = [
    ["Medianoche", { fondo: "#12101c", superficie: "#1e1a2e", texto: "#f2eefa", tenue: "#9d94b8", acento: "#ff7eb6", acento2: "#7ee8fa" }],
    ["Bosque", { fondo: "#0f1714", superficie: "#1a2620", texto: "#eaf2ec", tenue: "#93a89b", acento: "#8fd694", acento2: "#f2c57c" }],
    ["Glaciar", { fondo: "#0e141b", superficie: "#18222d", texto: "#e8f0f7", tenue: "#8ea2b5", acento: "#7cc4ff", acento2: "#b8a1ff" }],
    ["Durazno", { fondo: "#1a1214", superficie: "#2a1d20", texto: "#fbefe9", tenue: "#b79c93", acento: "#ffab76", acento2: "#ff6f91" }],
    ["Neón", { fondo: "#0b0b12", superficie: "#161626", texto: "#f5f3ff", tenue: "#9893b3", acento: "#ff2bd6", acento2: "#24f0ff" }],
    ["Lavanda", { fondo: "#15121c", superficie: "#221d2e", texto: "#f4f0fb", tenue: "#a59cbd", acento: "#c3a6ff", acento2: "#ffc6e0" }],
    ["Desierto", { fondo: "#17130e", superficie: "#251e16", texto: "#f6efe4", tenue: "#b3a48d", acento: "#e9b872", acento2: "#d97b5a" }],
    ["Tinta", { fondo: "#101010", superficie: "#1c1c1c", texto: "#f0f0f0", tenue: "#9a9a9a", acento: "#e8e8e8", acento2: "#8a8a8a" }],
  ];
  const FUENTES = ["Segoe UI Variable Display", "Segoe UI Variable Text", "Bahnschrift", "Cascadia Mono", "Consolas", "Georgia", "Candara", "Corbel", "Trebuchet MS", "Ink Free", "Verdana"];
  const FUENTES_MONO = ["Cascadia Mono", "Cascadia Code", "Consolas", "Lucida Console", "Courier New"];
  const TAM_MINI = { reloj: [0.2, 0.13], fecha: [0.16, 0.26], saludo: [0.17, 0.05], musica: [0.24, 0.11], sistema: [0.2, 0.16], fetch: [0.34, 0.3], frase: [0.25, 0.07],
    letras: [0.3, 0.14], clima: [0.16, 0.16], app: [0.05, 0.08], atajos: [0.2, 0.07], whatsapp: [0.18, 0.12] };

  // Fondos en línea (los busca y descarga Lienzo.exe).
  // [id, nombre, grupo, descripción, texto de ejemplo del buscador]
  const FUENTES_LINEA = [
    ["walls", "Rices (GitHub)", "imagen", "Más de 1,600 fondos hechos para rices: nord, gruvbox, anime, minimal, retro… (colección github.com/dharmx/walls).", "nord, gruvbox, anime, minimal, mountain…"],
    ["wikimedia", "Wikimedia", "imagen", "Fotos destacadas con licencia libre. En inglés encuentra más.", "mountains, night city, aurora, space…"],
    ["openverse", "Openverse", "imagen", "Millones de fotos con licencia libre (Flickr, museos, Wikimedia…).", "forest, ocean, city lights…"],
    ["wallhaven", "Wallhaven", "imagen", "Arte, anime y fotos de la comunidad (solo contenido apto). Algunas redes y antivirus lo bloquean.", "anime, cyberpunk, landscape…"],
    ["motionbgs", "MotionBGs", "video", "Fondos animados en HD o 4K: anime, juegos, paisajes, lo-fi.", "rain, lofi, anime, car…"],
    ["desktophut", "DesktopHut", "video", "Fondos animados en alta calidad, de todo tipo.", "rain, space, anime, nature…"],
    ["moewalls", "MoeWalls", "video", "Muchísimos fondos animados de anime y videojuegos (calidad 720p).", "genshin, rain, night, cat…"],
    ["youtube", "YouTube", "yt", "Busca videos de fondos (live wallpaper, loops, lo-fi…) y quita Shorts y videos que no parecen fondos. También puedes pegar un enlace.", "anime rain, lofi room… o pega un enlace"],
    ["tiktok", "TikTok", "yt", "Pega el enlace de un TikTok (Compartir → Copiar enlace) o busca un hashtag. Ojo: casi todos son verticales.", "pega un enlace o escribe un hashtag"],
  ];
  const ORDENES_LINEA = {
    wikimedia: [["", "Más relevantes"], ["azar", "Al azar"], ["recientes", "Recientes"]],
    wallhaven: [["", "Populares"], ["recientes", "Recientes"], ["azar", "Al azar"], ["vistas", "Más vistas"]],
  };
  const linea = { fuente: "walls", q: "", orden: "", categoria: "110", calidad: "hd", pagina: 0, resultados: [], ultima: true, cargando: false, error: "", semilla: "",
    bajando: null, pct: 0, ytdlp: null, instalando: null };
  function buscarLinea(mas) {
    const f = FUENTES_LINEA.find((x) => x[0] === linea.fuente);
    if (f && f[2] === "yt" && !linea.ytdlp) { pintar(); return; } // primero hay que descargar yt-dlp
    if (linea.fuente === "tiktok" && !linea.q) { linea.resultados = []; linea.pagina = 0; linea.error = ""; pintar(); return; }
    if (!mas) { linea.pagina = 0; linea.resultados = []; linea.semilla = ""; }
    linea.cargando = true;
    linea.error = "";
    P.enviar("buscarFondos", { fuente: linea.fuente, q: linea.q, orden: linea.orden, categoria: linea.categoria, semilla: linea.semilla, pagina: linea.pagina + 1 });
    pintar();
  }

  // JSON con las claves ordenadas, para comparar configuraciones.
  const canon = (o) => JSON.stringify(o, (k, v) => (v && typeof v === "object" && !Array.isArray(v)
    ? Object.keys(v).sort().reduce((r, x) => { r[x] = v[x]; return r; }, {}) : v));
  const val = (ruta, def) => { const v = L.ruta(config, ruta); return v === undefined || v === null ? def : v; };

  // ---------------- Guardar ----------------
  let tGuardar = 0;
  function cambiar(ruta, valor, inmediato) {
    L.ponerRuta(config, ruta, valor);
    L.tema.aplicar(config);
    clearTimeout(tGuardar);
    tGuardar = setTimeout(guardar, inmediato ? 0 : 260);
  }
  function guardar() {
    clearTimeout(tGuardar);
    enviado = canon(config);
    P.enviar("guardarConfig", { config });
  }
  function aviso(texto) {
    const a = document.getElementById("aviso");
    a.textContent = texto;
    a.classList.add("visible");
    clearTimeout(aviso.t);
    aviso.t = setTimeout(() => a.classList.remove("visible"), 2600);
  }

  // ---------------- Mensajes del programa ----------------
  P.on("config", (m) => {
    const c = m.config || {};
    if (!primera && canon(c) === enviado) return; // es el eco de lo que acabamos de guardar
    config = c;
    L.tema.aplicar(config);
    if (primera) {
      primera = false;
      pintarMenu();
      cargarEscenas().then(() => {
        pintar();
        if (m.primeraVez || location.hash === "#bienvenida") bienvenida();
      });
      return;
    }
    if (punteroAbajo || (document.activeElement && document.activeElement.matches("input[type=text], input[type=search], textarea"))) pendiente = true;
    else pintar();
  });
  P.on("irA", (m) => irA(m.seccion));
  P.on("estadoWindows", (m) => { estado = m; pintarPie(); if (seccion === "rendimiento" || seccion === "acerca") actualizarEstado();
    const btn = document.querySelector('[data-accion="deshacer-windows"]');
    if (btn) btn.disabled = !m.cambiosWindows; });
  P.on("aviso", (m) => aviso(m.texto));
  P.on("importando", (m) => { importando = m.nombre; if (seccion === "fondo") pintar(); });
  P.on("herramientas", (m) => {
    linea.ytdlp = !!m.ytdlp;
    linea.instalando = null;
    const f = FUENTES_LINEA.find((x) => x[0] === linea.fuente);
    if (linea.ytdlp && f && f[2] === "yt" && !linea.resultados.length && linea.fuente === "youtube") buscarLinea(false);
    else if (seccion === "fondo" && pestanaFondo === "linea") pintar();
  });
  P.on("progresoHerramienta", (m) => {
    linea.instalando = m.pct;
    const b = document.getElementById("progreso-ytdlp");
    if (b) b.textContent = `Descargando yt-dlp… ${m.pct}%`;
  });
  P.on("progresoDescarga", (m) => {
    if (m.id !== linea.bajando) return;
    linea.pct = m.pct;
    const e = document.querySelector(".carta.cargando .etiqueta");
    if (e) e.textContent = `Descargando ${m.pct}%`;
  });
  P.on("fondosEnLinea", (m) => {
    if (m.fuente !== linea.fuente) return;
    linea.cargando = false;
    if (m.error) linea.error = m.error;
    else {
      const vistos = new Set(m.pagina === 1 ? [] : linea.resultados.map((r) => r.id));
      linea.resultados = (m.pagina === 1 ? [] : linea.resultados).concat((m.resultados || []).filter((r) => !vistos.has(r.id)));
      linea.pagina = m.pagina;
      linea.ultima = !!m.ultima;
      if (m.semilla) linea.semilla = m.semilla;
    }
    if (seccion === "fondo" && pestanaFondo === "linea") pintar();
  });
  P.on("archivoElegido", (m) => {
    if (m.para === "fondo") {
      importando = null;
      linea.bajando = null;
      linea.pct = 0;
      if (m.error) aviso("No se pudo importar: " + m.error);
      else if (m.entrada) {
        config.biblioteca = (config.biblioteca || []).concat([m.entrada]);
        Object.assign(config.fondo, { tipo: m.entrada.tipo, archivo: m.entrada.archivo, activo: true });
        guardar();
        aviso("Fondo agregado a tu biblioteca");
      }
      if (seccion === "fondo") pintar();
    } else if (m.para === "app" && m.app) {
      if (m.icono) iconosApps[m.app.clave] = m.icono;
      agregarFijada(m.app);
    }
  });
  P.on("apps", (m) => { apps = m.lista || []; pintarApps(); });
  P.on("iconos", (m) => {
    Object.assign(iconosApps, m.iconos || {});
    document.querySelectorAll("img[data-icono-clave]").forEach((img) => {
      const src = iconosApps[img.dataset.iconoClave];
      if (src && img.getAttribute("src") !== src) img.src = src;
    });
  });
  P.on("escenasPropias", (m) => { escenasPropias = m.lista || []; if (seccion === "fondo" && pestanaFondo === "html") pintar(); });

  document.addEventListener("pointerdown", () => { punteroAbajo = true; });
  document.addEventListener("pointerup", () => {
    punteroAbajo = false;
    if (pendiente) { pendiente = false; setTimeout(pintar, 50); }
  });

  // ---------------- Navegación ----------------
  function pintarMenu() {
    menu.innerHTML = `<div class="logo">${I("lienzo")} Lienzo</div>` +
      SECCIONES.map(([id, nombre, ic]) => `<a data-sec="${id}" class="${id === seccion ? "activo" : ""}">${I(ic)}${nombre}</a>`).join("") +
      `<div class="pie"></div>`;
    pintarPie();
  }
  function pintarPie() {
    const pie = menu.querySelector(".pie");
    if (!pie) return;
    const e = estado.estadoFondo || "activo";
    const pausa = e.startsWith("pausa");
    const motivos = { manual: "lo pausaste tú", tapado: "hay ventanas encima", "pantalla-completa": "hay algo en pantalla completa", bloqueo: "pantalla bloqueada", bateria: "ahorro de batería", pantalla: "pantalla apagada" };
    pie.innerHTML = `<span class="punto${pausa ? " pausa" : ""}"></span><b>${pausa ? "Fondo en pausa" : e === "reducido" ? "Fondo en modo ahorro" : "Fondo activo"}</b><br>${
      pausa ? esc(motivos[e.split(":")[1]] || "") : e === "reducido" ? "con batería: 15 FPS" : "La animación se detiene sola cuando no se ve."}`;
  }
  menu.addEventListener("click", (e) => { const a = e.target.closest("[data-sec]"); if (a) irA(a.dataset.sec); });
  function irA(sec) {
    if (!sec || !SECCIONES.some((s) => s[0] === sec)) return;
    seccion = sec;
    history.replaceState(null, "", "#" + sec);
    menu.querySelectorAll("[data-sec]").forEach((a) => a.classList.toggle("activo", a.dataset.sec === sec));
    pintar();
    contenido.scrollTop = 0;
  }

  function pintar() {
    if (!config) return;
    const f = { inicio: secInicio, fondo: secFondo, barra: secBarra, bloques: secBloques, colores: secColores, escritorio: secEscritorio, rendimiento: secRendimiento, acerca: secAcerca }[seccion];
    const scroll = contenido.scrollTop;
    contenido.innerHTML = f ? f() : "";
    contenido.scrollTop = scroll;
    prepararVistas();
    if (seccion === "barra") pedirIconosFijadas();
    if (seccion === "fondo" && pestanaFondo === "html" && !escenasPropias) P.enviar("pedirEscenasPropias");
  }

  // ---------------- Controles ----------------
  const fila = (et, ayuda, ctl) => `<div class="fila"><div class="et">${et}${ayuda ? `<small>${ayuda}</small>` : ""}</div><div class="ctl">${ctl}</div></div>`;
  const interruptor = (ruta, def, repintar) => `<input type="checkbox" class="interruptor" data-ruta="${ruta}" ${repintar ? "data-repintar" : ""} ${val(ruta, def) ? "checked" : ""}>`;
  function segmentos(ruta, opciones, def, extra) {
    const v = String(val(ruta, def));
    return `<div class="segmentos" data-ruta="${ruta}" ${extra || ""}>${opciones.map(([k, t, ic]) =>
      `<button data-valor="${esc(k)}" class="${String(k) === v ? "activo" : ""}">${ic ? I(ic) : ""}${esc(t)}</button>`).join("")}</div>`;
  }
  const formatear = (v, fmt) => fmt === "%" ? `${Math.round(v * 100)}%` : fmt === "px" ? `${v} px` : fmt === "pct" ? `${v}%` : fmt === "x" ? `${Number(v).toFixed(2)}×` : String(v);
  const rango = (ruta, min, max, paso, def, fmt) => {
    const v = Number(val(ruta, def));
    return `<div class="rango"><input type="range" data-ruta="${ruta}" min="${min}" max="${max}" step="${paso}" value="${v}" data-fmt="${fmt || ""}"><output>${formatear(v, fmt)}</output></div>`;
  };
  const selector = (ruta, opciones, def, repintar) => {
    const v = String(val(ruta, def));
    return `<select data-ruta="${ruta}" ${repintar ? "data-repintar" : ""}>${opciones.map(([k, t]) => `<option value="${esc(k)}" ${String(k) === v ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>`;
  };
  const colorCtl = (ruta, def) => `<input type="color" data-ruta="${ruta}" value="${esc(val(ruta, def))}">`;
  const textoCtl = (ruta, def, ph) => `<input type="text" data-ruta="${ruta}" value="${esc(val(ruta, def))}" placeholder="${esc(ph || "")}">`;

  function leerValor(el) {
    if (el.type === "checkbox") return el.checked;
    if (el.type === "range") {
      const v = Number(el.value);
      const out = el.parentElement.querySelector("output");
      if (out) out.textContent = formatear(v, el.dataset.fmt);
      return v;
    }
    if (el.dataset.num !== undefined) return Number(el.value);
    return el.value;
  }

  document.addEventListener("input", (e) => {
    const el = e.target.closest("[data-ruta]");
    if (!el || el.matches(".segmentos, input[type=text], textarea, select")) return;
    const v = leerValor(el);
    cambiar(el.dataset.ruta, v);
    efectosDeCambio(el.dataset.ruta, v);
    if (el.hasAttribute("data-repintar")) pintar();
  });
  document.addEventListener("change", (e) => {
    const el = e.target.closest("[data-ruta]");
    if (el && el.matches("input[type=text], textarea, select")) {
      cambiar(el.dataset.ruta, leerValor(el));
      efectosDeCambio(el.dataset.ruta, el.value);
      if (el.hasAttribute("data-repintar")) pintar();
      return;
    }
    const sel = e.target.closest("[data-accion-cambio]");
    if (sel && sel.value) acciones[sel.dataset.accionCambio](sel);
  });
  document.addEventListener("click", (e) => {
    const seg = e.target.closest(".segmentos[data-ruta] button");
    if (seg) {
      const cont = seg.parentElement;
      cont.querySelectorAll("button").forEach((b) => b.classList.toggle("activo", b === seg));
      let v = seg.dataset.valor;
      if (cont.hasAttribute("data-num")) v = Number(v);
      if (v === "true" || v === "false") v = v === "true";
      cambiar(cont.dataset.ruta, v);
      efectosDeCambio(cont.dataset.ruta, v);
      if (cont.hasAttribute("data-repintar")) pintar();
      return;
    }
    const acc = e.target.closest("[data-accion]");
    if (acc && acciones[acc.dataset.accion]) { e.preventDefault(); acciones[acc.dataset.accion](acc, e); return; }
    if (e.target === capaDialogo || e.target.closest("[data-cerrar]")) cerrarDialogo();
  });

  // Cambios que arrastran otros ajustes
  function efectosDeCambio(ruta, v) {
    if (ruta.startsWith("paleta.colores.")) { config.paleta.modo = "manual"; const s = contenido.querySelector('[data-ruta="paleta.modo"]'); if (s) s.querySelectorAll("button").forEach((b) => b.classList.toggle("activo", b.dataset.valor === "manual")); }
    if (ruta === "fondo.color") { config.fondo.tipo = "color"; }
    if (ruta === "paleta.modo" && v === "auto") aviso("Los colores se sacarán del fondo en unos segundos");
  }

  // ---------------- Vistas previas de escenas ----------------
  async function cargarEscenas() {
    await Promise.all((L.listaEscenas || []).map((id) => L.cargar(`escenas/${id}.js`).catch(() => {})));
  }
  const VERSION_VISTAS = "v2";
  const cacheVistas = {};
  async function vistaEscena(id, opciones) {
    const def = L.escenas[id];
    if (!def) return null;
    const clave = `${VERSION_VISTAS}|${id}|${def.version || 1}|${JSON.stringify(opciones || {})}`;
    if (cacheVistas[clave]) return cacheVistas[clave];
    try { const g = localStorage.getItem("vista:" + clave); if (g) return (cacheVistas[clave] = g); } catch (e) { /* sin almacenamiento */ }
    const c = document.createElement("canvas");
    let motor;
    try {
      motor = new L.MotorEscena(c, def, opciones, { fps: 30, calidad: 1, tamano: [400, 225], paleta: (config.paleta || {}).colores });
      motor.pausar(true);
      motor.simular(2.5);
      const url = c.toDataURL("image/jpeg", 0.85);
      cacheVistas[clave] = url;
      try { localStorage.setItem("vista:" + clave, url); } catch (e) { /* lleno */ }
      return url;
    } catch (e) { P.log("Vista de " + id + ": " + e.message); return null; }
    finally {
      if (motor) motor.destruir();
      if (def.tipo === "webgl") { const gl = c.getContext("webgl"); const ext = gl && gl.getExtension("WEBGL_lose_context"); if (ext) ext.loseContext(); }
    }
  }
  let generacion = 0;
  async function prepararVistas() {
    const mia = ++generacion;
    for (const v of Array.from(contenido.querySelectorAll(".vista[data-escena]"))) {
      if (mia !== generacion) return;
      if (v.querySelector("img.vista-img")) continue;
      let opciones = {};
      try { opciones = JSON.parse(v.dataset.opciones || "{}"); } catch (e) { /* nada */ }
      const url = await vistaEscena(v.dataset.escena, opciones);
      if (mia !== generacion || !url) continue;
      v.insertAdjacentHTML("afterbegin", `<img class="vista-img" src="${url}" alt="">`);
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  function maqueta(c) {
    const b = c.barra || {};
    let html = b.activa === false ? "" : `<div class="mini-barra pos-${b.posicion || "arriba"}${b.flotante === false ? " pegada" : ""}"></div>`;
    (c.bloques || []).forEach((bl) => {
      const [w, h] = TAM_MINI[bl.tipo] || [0.15, 0.08];
      const s = bl.escala || 1, al = (bl.opciones || {}).alinear;
      let x = bl.x;
      if (al === "centro") x -= (w * s) / 2; else if (al === "derecha") x -= w * s;
      html += `<div class="mini-bloque" style="left:${(x * 100).toFixed(1)}%;top:${(bl.y * 100).toFixed(1)}%;width:${(w * s * 100).toFixed(1)}%;height:${(h * s * 100).toFixed(1)}%"></div>`;
    });
    return html;
  }

  // ================= Secciones =================

  function cabeza(titulo, sub, derecha) {
    return `<div class="cabeza"><div><h1>${titulo}</h1><p class="sub">${sub}</p></div>${derecha || ""}</div>`;
  }

  // ---------- Temas ----------
  function cartaRice(r, activa, chica) {
    const e = r.config.fondo.escena;
    return `<button class="carta${activa ? " activa" : ""}" data-accion="${chica ? "aplicar-rice-directo" : "aplicar-rice"}" data-id="${r.id}">
      <div class="vista" data-escena="${e}" data-opciones='${esc(JSON.stringify((r.config.fondo.opciones || {})[e] || {}))}'>${maqueta(r.config)}${activa ? '<span class="etiqueta uso">En uso</span>' : ""}</div>
      <div class="info"><b>${esc(r.nombre)}</b>${chica ? "" : `<span>${esc(r.descripcion)}</span>`}</div></button>`;
  }
  function secInicio() {
    const mis = config.misRices || [];
    return cabeza("Temas", "Elige un <b>rice</b> y Lienzo cambia el fondo, los colores, la barra y los bloques de una sola vez. Después puedes ajustar cada cosa a tu gusto.") +
      `<div class="rejilla">${L.rices.map((r) => cartaRice(r, r.id === config.rice)).join("")}</div>
      <div class="tarjeta" style="margin-top:22px"><h2>${I("corazon")} Mis rices</h2><p class="nota">Guarda tu combinación actual (fondo, colores, barra y bloques) para volver a ella cuando quieras.</p>
      <div class="rejilla">${mis.map((r, i) => {
        const e = r.config.fondo && r.config.fondo.tipo === "escena" ? r.config.fondo.escena : "";
        return `<button class="carta${config.rice === r.id ? " activa" : ""}" data-accion="aplicar-mi-rice" data-i="${i}">
          <div class="vista" ${e ? `data-escena="${e}" data-opciones='${esc(JSON.stringify((r.config.fondo.opciones || {})[e] || {}))}'` : ""}>${maqueta(r.config)}
          ${!e && r.config.fondo && r.config.fondo.archivo ? `<img class="vista-img" src="${DATOS}${esc(miniaturaDe(r.config.fondo.archivo))}" alt="">` : ""}</div>
          <span class="borrar" data-accion="borrar-mi-rice" data-i="${i}" title="Borrar">${I("papelera")}</span>
          <div class="info"><b>${esc(r.nombre)}</b><span>Guardado por ti</span></div></button>`;
      }).join("")}
      <button class="carta nueva" data-accion="guardar-rice">${I("mas")}Guardar mi look actual</button></div>
      <div class="fila" style="margin-top:14px"><div class="et">Compartir como archivo<small>Como los <i>dotfiles</i> de Linux: un archivo <code>.lienzo</code> con tu fondo, colores, barra y bloques para pasarlo a otra compu o a tus amigos.</small></div>
        <div class="ctl"><button class="btn" data-accion="exportar-rice">${I("arriba")} Exportar mi look</button><button class="btn" data-accion="importar-rice">${I("abajo")} Importar</button></div></div></div>`;
  }
  function miniaturaDe(archivo) {
    const b = (config.biblioteca || []).find((x) => x.archivo === archivo);
    return b && b.miniatura ? b.miniatura : "";
  }

  // ---------- Fondo ----------
  function secFondo() {
    const f = config.fondo || {};
    const tabs = [["escenas", "Escenas animadas", "capas"], ["medios", "Mis imágenes y videos", "imagen"], ["linea", "En línea", "buscar"], ["html", "Escenas HTML", "terminal"], ["color", "Color sólido", "paleta"]];
    let cuerpo = "";
    if (pestanaFondo === "escenas") {
      cuerpo = `<div class="rejilla">${(L.listaEscenas || []).filter((id) => L.escenas[id]).map((id) => {
        const d = L.escenas[id], activa = f.tipo === "escena" && f.escena === id;
        return `<button class="carta${activa ? " activa" : ""}" data-accion="elegir-escena" data-id="${id}">
          <div class="vista" data-escena="${id}" data-opciones='${esc(JSON.stringify((f.opciones || {})[id] || {}))}'>${activa ? '<span class="etiqueta uso">En uso</span>' : ""}${d.tipo === "webgl" ? '<span class="etiqueta" style="left:auto;right:8px">WebGL</span>' : ""}</div>
          <div class="info"><b>${esc(d.nombre)}</b><span>${esc(d.descripcion || "")}</span></div></button>`;
      }).join("")}</div>${opcionesEscena(f)}`;
    } else if (pestanaFondo === "medios") {
      const bib = config.biblioteca || [];
      cuerpo = `<div class="rejilla">
        <button class="carta nueva" data-accion="agregar-medio">${I("mas")}Agregar imagen o video<small style="font-weight:400">MP4, WebM, JPG, PNG, WebP o GIF</small></button>
        ${importando ? `<div class="carta cargando"><div class="vista"></div><div class="info"><b>${esc(importando)}</b><span>Copiando a tu biblioteca…</span></div></div>` : ""}
        ${bib.slice().reverse().map((b) => {
          const activa = (f.tipo === "video" || f.tipo === "imagen") && f.archivo === b.archivo;
          return `<button class="carta${activa ? " activa" : ""}" data-accion="elegir-medio" data-archivo="${esc(b.archivo)}">
            <div class="vista">${b.miniatura ? `<img class="vista-img" src="${DATOS}${esc(b.miniatura)}" alt="">` : ""}<span class="etiqueta${activa ? " uso" : ""}">${activa ? "En uso" : b.tipo === "video" ? "Video" : "Imagen"}</span></div>
            <span class="borrar" data-accion="borrar-medio" data-archivo="${esc(b.archivo)}" title="Quitar de la biblioteca">${I("papelera")}</span>
            <div class="info"><b>${esc(b.nombre)}</b><span>${b.tipo === "video" ? "Video" : "Imagen"}</span></div></button>`;
        }).join("")}</div>
        ${f.tipo === "video" || f.tipo === "imagen" ? `<div class="tarjeta" style="margin-top:18px"><h2>${I("ajustes")} Cómo se ajusta</h2>
          ${fila("Encaje", "Cómo se acomoda en tu pantalla", segmentos("fondo.ajuste", [["cubrir", "Cubrir"], ["contener", "Contener"], ["estirar", "Estirar"], ["centrar", "Centrar"]], "cubrir"))}
          ${f.tipo === "video" ? fila("Velocidad del video", "", rango("fondo.velocidad", 0.25, 2, 0.05, 1, "x")) : ""}</div>` : ""}`;
    } else if (pestanaFondo === "linea") {
      cuerpo = secLinea();
    } else if (pestanaFondo === "html") {
      const lista = escenasPropias || [];
      cuerpo = `<div class="tarjeta"><h2>${I("terminal")} Tus propias escenas</h2>
        <p class="nota">Cada carpeta dentro de <code>escenas</code> con un <code>index.html</code> es un fondo. Puedes usar HTML, CSS, JavaScript, canvas o WebGL. Hay un ejemplo listo para copiar.</p>
        <button class="btn" data-accion="abrir-carpeta" data-cual="escenas">${I("carpeta")} Abrir la carpeta de escenas</button>
        <button class="btn" data-accion="recargar-propias">${I("deshacer")} Volver a buscar</button></div>
        <div class="rejilla">${escenasPropias === null ? '<div class="vacio cargando">Buscando escenas…</div>' : lista.length ? lista.map((s) => {
          const activa = f.tipo === "html" && f.carpeta === s.carpeta;
          return `<button class="carta${activa ? " activa" : ""}" data-accion="elegir-propia" data-carpeta="${esc(s.carpeta)}">
            <div class="vista">${s.vista ? `<img class="vista-img" src="${DATOS}${esc(s.vista)}" alt="">` : ""}${activa ? '<span class="etiqueta uso">En uso</span>' : ""}</div>
            <div class="info"><b>${esc(s.nombre)}</b><span>${esc(s.carpeta)}</span></div></button>`;
        }).join("") : '<div class="vacio">Todavía no hay escenas en la carpeta.</div>'}</div>`;
    } else {
      cuerpo = `<div class="tarjeta">${fila("Color del fondo", "Un fondo liso, sin animación: lo más ligero posible.", colorCtl("fondo.color", "#14111f") +
        `<button class="btn" data-accion="usar-color">${f.tipo === "color" ? I("check") + " En uso" : "Usar color"}</button>`)}</div>`;
    }
    return cabeza("Fondo", "Escenas animadas, tus propias imágenes y videos o escenas hechas por ti en HTML. Todo se dibuja detrás de los iconos del escritorio.",
      `<label class="fila" style="border:0;padding:0;gap:12px"><span class="et">Fondo de Lienzo</span>${interruptor("fondo.activo", true)}</label>`) +
      `<div class="pestanas">${tabs.map(([id, t, ic]) => `<button data-accion="pestana-fondo" data-p="${id}" class="${id === pestanaFondo ? "activo" : ""}">${I(ic)}${t}</button>`).join("")}</div>` +
      cuerpo + efectos();
  }
  function secLinea() {
    const fuente = FUENTES_LINEA.find((x) => x[0] === linea.fuente) || FUENTES_LINEA[0];
    const ordenes = ORDENES_LINEA[linea.fuente];
    const grupo = (g, titulo, ic) => `<div class="grupo-fuentes"><span>${I(ic)} ${titulo}</span><div class="fuentes-linea">${FUENTES_LINEA.filter((x) => x[2] === g || (g === "video" && x[2] === "yt"))
      .map(([id, n]) => `<button data-accion="fuente-linea" data-f="${id}" class="${id === linea.fuente ? "activo" : ""}">${n}</button>`).join("")}</div></div>`;
    if (fuente[2] === "yt" && linea.ytdlp === null) P.enviar("pedirHerramientas");
    if (fuente[2] === "yt" && !linea.ytdlp) {
      return `<div class="tarjeta"><h2>${I("buscar")} Fondos en línea</h2>${grupo("imagen", "Imágenes", "imagen")}${grupo("video", "Fondos animados", "video")}
        <p class="nota" style="margin:12px 0">${esc(fuente[3])}</p></div>
        <div class="tarjeta"><h2>${I("abajo")} Falta una herramienta</h2>
        <p class="nota">Para ${fuente[1]} Lienzo usa <b>yt-dlp</b>, un programa libre y gratuito (el mismo que usan Lively Wallpaper y muchas apps). Se guarda en la carpeta de Lienzo y se actualiza solo cada semana. Pesa unos 18 MB.</p>
        <p class="nota">Descarga solo para uso personal y respeta los derechos de quien hizo el video.</p>
        ${linea.ytdlp === null ? '<div class="vacio cargando">Revisando…</div>' : linea.instalando !== null
          ? `<button class="btn" disabled id="progreso-ytdlp">Descargando yt-dlp… ${linea.instalando}%</button>`
          : `<button class="btn principal" data-accion="instalar-ytdlp">${I("abajo")} Descargar yt-dlp</button>`}</div>`;
    }
    const buscador = `<div class="buscador">
        <input type="search" id="q-linea" value="${esc(linea.q)}" placeholder="Busca: ${esc(fuente[4])}">
        ${ordenes ? `<select id="orden-linea">${ordenes.map(([k, t]) => `<option value="${k}" ${k === linea.orden ? "selected" : ""}>${t}</option>`).join("")}</select>` : ""}
        ${linea.fuente === "motionbgs" ? `<select id="calidad-linea">${[["hd", "Calidad HD (ligero)"], ["4k", "Calidad 4K"]].map(([k, t]) =>
          `<option value="${k}" ${k === linea.calidad ? "selected" : ""}>${t}</option>`).join("")}</select>` : ""}
        ${linea.fuente === "wallhaven" ? `<select id="cat-linea">${[["110", "General y anime"], ["100", "Solo general"], ["010", "Solo anime"], ["111", "Todo"]].map(([k, t]) =>
          `<option value="${k}" ${k === linea.categoria ? "selected" : ""}>${t}</option>`).join("")}</select>` : ""}
        <button class="btn principal" data-accion="buscar-linea">${I("buscar")} Buscar</button></div>`;
    const vacio = linea.fuente === "tiktok" && !linea.q && !linea.resultados.length
      ? `<div class="vacio">Pega arriba el enlace de un TikTok y pulsa Buscar.</div>` : "";
    const lista = linea.resultados.map((r, i) => {
      const bajando = linea.bajando === r.id;
      return `<button class="carta${bajando ? " cargando" : ""}" data-accion="bajar-fondo" data-i="${i}" ${linea.bajando ? "disabled" : ""}>
        <div class="vista">${r.miniatura ? `<img class="vista-img" loading="lazy" src="${esc(r.miniatura)}" alt="" referrerpolicy="no-referrer">` : ""}
        <span class="etiqueta${r.video ? " es-video" : ""}">${bajando ? `Descargando${linea.pct ? " " + linea.pct + "%" : "…"}` : esc(r.etiqueta || "")}</span>
        ${r.video ? `<span class="marca-video">${I("play")}</span>` : ""}</div>
        <div class="info"><b>${esc(r.nombre)}</b><span>${esc(r.credito || "")}</span></div></button>`;
    }).join("");
    let estadoLinea = vacio;
    if (linea.error) estadoLinea = `<div class="vacio">${esc(linea.error)}</div>`;
    else if (linea.cargando) estadoLinea = `<div class="vacio cargando">Buscando fondos…</div>`;
    else if (!linea.resultados.length && linea.pagina) estadoLinea = `<div class="vacio">No encontré nada. Prueba con otras palabras (en inglés suele haber más).</div>`;
    return `<div class="tarjeta"><h2>${I("buscar")} Fondos en línea</h2>${grupo("imagen", "Imágenes", "imagen")}${grupo("video", "Fondos animados", "video")}
        <p class="nota" style="margin:12px 0">${esc(fuente[3])} Al elegir uno se descarga a tu biblioteca y se aplica con la transición que elijas en «Efectos».</p>
        ${buscador}</div>
      <div class="rejilla">${lista}${estadoLinea}</div>
      ${linea.resultados.length && !linea.ultima && !linea.cargando ? `<div style="text-align:center;margin-top:14px"><button class="btn" data-accion="mas-linea">${I("abajo")} Cargar más</button></div>` : ""}`;
  }
  function opcionesEscena(f) {
    if (f.tipo !== "escena") return "";
    const d = L.escenas[f.escena];
    if (!d || !(d.opciones || []).length) return "";
    const base = `fondo.opciones.${f.escena}`;
    const def = L.opcionesPorDefecto(d);
    return `<div class="tarjeta" style="margin-top:18px"><h2>${I("ajustes")} Opciones de «${esc(d.nombre)}»</h2>${d.opciones.map((op) => {
      const ruta = `${base}.${op.id}`, v = def[op.id];
      let ctl;
      if (op.tipo === "si-no") ctl = interruptor(ruta, v);
      else if (op.tipo === "rango") ctl = rango(ruta, op.min, op.max, op.paso || 1, v);
      else if (op.tipo === "color") ctl = colorCtl(ruta, v);
      else if (op.tipo === "lista" && op.opciones.length <= 4) ctl = segmentos(ruta, op.opciones, v);
      else if (op.tipo === "lista") ctl = selector(ruta, op.opciones, v);
      else ctl = textoCtl(ruta, v);
      return fila(esc(op.nombre), op.ayuda ? esc(op.ayuda) : "", ctl);
    }).join("")}<div class="fila"><div class="et"><small>Los cambios se ven al instante en tu escritorio.</small></div><div class="ctl"><button class="btn chico" data-accion="restablecer-escena">${I("deshacer")} Valores originales</button></div></div></div>`;
  }
  function efectos() {
    return `<div class="tarjeta" style="margin-top:18px"><h2>${I("varita")} Efectos</h2><p class="nota">Se aplican sobre cualquier fondo. El desenfoque es el único que gasta algo más de gráficos.</p>
      ${fila("Oscurecer", "Ayuda a que se lean los bloques", rango("fondo.efectos.oscurecer", 0, 80, 1, 0, "pct"))}
      ${fila("Viñeta", "Bordes más oscuros", rango("fondo.efectos.vineta", 0, 100, 1, 20, "pct"))}
      ${fila("Saturación", "", rango("fondo.efectos.saturacion", 0, 200, 1, 100, "pct"))}
      ${fila("Brillo", "", rango("fondo.efectos.brillo", 40, 160, 1, 100, "pct"))}
      ${fila("Grano de película", "", rango("fondo.efectos.grano", 0, 100, 1, 0, "pct"))}
      ${fila("Desenfoque", "", rango("fondo.efectos.desenfoque", 0, 24, 1, 0, "px"))}
      ${fila("Parallax con el ratón", "El fondo se mueve un poco siguiendo el cursor", rango("fondo.efectos.parallax", 0, 1, 0.05, 0, "%"))}
      ${fila("Transición al cambiar de fondo", "El círculo sale desde donde está tu cursor", segmentos("fondo.transicion", [["fundido", "Fundido"], ["circulo", "Círculo"], ["barrido", "Barrido"], ["zoom", "Zoom"], ["persianas", "Persianas"]], "fundido"))}</div>`;
  }

  // ---------- Barra ----------
  function secBarra() {
    const b = config.barra || {};
    const posiciones = [["arriba", "Arriba"], ["abajo", "Abajo"], ["izquierda", "Izquierda"], ["derecha", "Derecha"]];
    return cabeza("Barra", "Windows 11 no deja mover su barra de tareas, así que Lienzo trae la suya: ponla en cualquier borde y elige cómo se ve. Las ventanas maximizadas la respetan.",
      `<label class="fila" style="border:0;padding:0;gap:12px"><span class="et">Barra de Lienzo</span>${interruptor("barra.activa", true, true)}</label>`) +
      (b.activa === false ? `<div class="tarjeta"><p class="nota" style="margin:0">La barra está apagada. Actívala con el interruptor de arriba.</p></div>` : `
      <div class="tarjeta"><h2>${I("barra")} Posición y forma</h2>
        <div class="fila" style="padding-bottom:30px"><div class="et">Posición</div><div class="ctl"><div class="posiciones">${posiciones.map(([p, t]) =>
          `<button class="${p}${b.posicion === p ? " activo" : ""}" data-accion="posicion" data-p="${p}"><i></i><span>${t}</span></button>`).join("")}</div></div></div>
        ${fila("Estilo", "Islas: grupos separados · Continua: una sola barra · Minimal: sin fondo", segmentos("barra.estilo", [["islas", "Islas"], ["continua", "Continua"], ["minimal", "Minimal"]], "islas", "data-repintar"))}
        ${b.estilo === "continua" ? fila("Fondo", "El acrílico es el desenfoque de Windows 11", segmentos("barra.fondo", [["acrilico", "Acrílico"], ["transparente", "Transparente"], ["solido", "Sólido"]], "acrilico")) : ""}
        ${fila("Flotante", "Separada de los bordes, con esquinas redondeadas", interruptor("barra.flotante", true))}
        ${fila("Grosor", "", rango("barra.grosor", 26, 64, 1, 38, "px"))}
        ${fila("Separación del borde", "Solo si es flotante", rango("barra.margen", 0, 24, 1, 8, "px"))}
        ${fila("Redondeo", "", rango("barra.redondeo", 0, 24, 1, 14, "px"))}
        ${fila("Opacidad del fondo", "", rango("barra.opacidad", 0.05, 1, 0.05, 0.55, "%"))}
      </div>
      <div class="tarjeta"><h2>${I("bloques")} Módulos</h2><p class="nota">Arrastra los módulos entre las tres zonas para ordenarlos. La rueda del ratón sobre el volumen lo sube o baja.</p>${editorModulos()}</div>
      <div class="tarjeta"><h2>${I("luna")} Botón de inicio</h2>
        <div class="fila"><div class="et">Icono<small>Abre el menú Inicio de Windows</small></div><div class="ctl"><div class="iconos-inicio">${ICONOS_INICIO.map((ic) =>
          `<button data-accion="icono-inicio" data-icono="${ic}" class="${!b.textoInicio && b.iconoInicio === ic ? "activo" : ""}">${I(ic)}</button>`).join("")}</div></div></div>
        ${fila("O un texto", "Por ejemplo tu nombre o un símbolo", textoCtl("barra.textoInicio", "", "(vacío = usar el icono)"))}
      </div>
      <div class="tarjeta"><h2>${I("apps")} Apps</h2>
        ${fila("Títulos de las ventanas", "", segmentos("barra.titulos", [["ninguno", "Solo iconos"], ["activa", "La activa"], ["todas", "Todas"]], "activa"))}
        <div class="fila columna"><div class="et">Apps fijadas<small>Siempre visibles en la barra, abiertas o no. Clic central para abrir otra ventana.</small></div>
          <div class="lista-items" style="margin-top:10px">${fijadas()}</div>
          <div style="display:flex;gap:8px;margin-top:10px"><button class="btn" data-accion="fijar-app">${I("apps")} Fijar una app instalada</button>
          <button class="btn" data-accion="fijar-programa">${I("carpeta")} Fijar un programa…</button></div></div>
      </div>
      <div class="tarjeta"><h2>${I("reloj")} Reloj de la barra</h2>
        ${fila("Formato de 24 horas", "", interruptor("barra.reloj.formato24", false))}
        ${fila("Segundos", "", interruptor("barra.reloj.segundos", false))}
        ${fila("Fecha", "", interruptor("barra.reloj.fecha", true))}
      </div>`) + tarjetaBarraWindows();
  }
  function tarjetaBarraWindows() {
    return `<div class="tarjeta"><h2>${I("ventana")} Barra de tareas de Windows</h2>
      <p class="nota">Si tu barra de Lienzo está abajo, lo mejor es ocultar la de Windows. Al cerrar Lienzo vuelve sola. Con el botón «Bandeja» de tu barra llegas a los iconos ocultos (Discord, Steam…).</p>
      ${fila("Comportamiento", "", segmentos("barraWindows.modo", [["nativa", "Normal"], ["auto", "Auto-ocultar"], ["oculta", "Ocultarla"]], "auto"))}
      ${fila("Iconos de la barra de Windows", "Dónde van los iconos cuando se ve", segmentos("barraWindows.alineacion", [["no-tocar", "No cambiar"], ["izquierda", "Izquierda"], ["centro", "Centro"]], "no-tocar"))}
      ${fila("Búsqueda", "", segmentos("barraWindows.busqueda", [["no-tocar", "No cambiar"], ["oculta", "Ocultar"], ["icono", "Icono"], ["cuadro", "Cuadro"]], "no-tocar"))}
      ${fila("Vista de tareas", "El botón de los escritorios virtuales", segmentos("barraWindows.vistaTareas", SI_NO, "no-tocar"))}
      ${fila("Widgets", "El tiempo y las noticias de la esquina", segmentos("barraWindows.widgets", SI_NO, "no-tocar"))}
      ${fila("Combinar ventanas de la misma app", "", segmentos("barraWindows.agrupar", [["no-tocar", "No cambiar"], ["siempre", "Siempre"], ["llena", "Si se llena"], ["nunca", "Nunca"]], "no-tocar"))}
      ${fila("Mostrar escritorio en la esquina", "Clic en el borde derecho de la barra para ver el escritorio", segmentos("barraWindows.esquina", SI_NO, "no-tocar"))}</div>`;
  }
  const SI_NO = [["no-tocar", "No cambiar"], ["si", "Mostrar"], ["no", "Ocultar"]];
  const SI_NO_ACT = [["no-tocar", "No cambiar"], ["si", "Sí"], ["no", "No"]];
  function editorModulos() {
    const m = val("barra.modulos", {});
    const usados = new Set([].concat(m.inicio || [], m.centro || [], m.fin || []));
    const libres = Object.keys(MODULOS).filter((k) => !usados.has(k));
    return `<div class="modulos">${[["inicio", "Izquierda / arriba"], ["centro", "Centro"], ["fin", "Derecha / abajo"]].map(([sec, nombre]) =>
      `<div class="columna-mod" data-sec="${sec}"><h4>${nombre}</h4>${(m[sec] || []).map((id, i) =>
        `<div class="chip" draggable="true" data-sec="${sec}" data-i="${i}">${I((MODULOS[id] || [])[1] || "bloques")}${esc((MODULOS[id] || [id])[0])}
          <button class="x" data-accion="quitar-modulo" data-sec="${sec}" data-i="${i}" title="Quitar">${I("cerrar")}</button></div>`).join("")}
        ${libres.length ? `<select data-accion-cambio="agregar-modulo" data-sec="${sec}"><option value="">+ Añadir…</option>${libres.map((k) => `<option value="${k}">${MODULOS[k][0]}</option>`).join("")}</select>` : ""}
      </div>`).join("")}</div>`;
  }
  function fijadas() {
    const lista = config.fijadas || [];
    if (!lista.length) return '<div class="vacio">Aún no has fijado apps. Las ventanas abiertas aparecen solas.</div>';
    return lista.map((f, i) => `<div class="item">${iconosApps[f.clave] ? `<img src="${iconosApps[f.clave]}" data-icono-clave="${esc(f.clave)}" alt="">` : `<img data-icono-clave="${esc(f.clave)}" alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">`}
      <span class="nombre">${esc(f.nombre)}<small>${esc(f.clave)}</small></span>
      <span class="acciones">${i > 0 ? `<button class="icono-btn" data-accion="subir-fijada" data-i="${i}" title="Subir">${I("izquierda")}</button>` : ""}
      <button class="icono-btn" data-accion="quitar-fijada" data-i="${i}" title="Quitar">${I("cerrar")}</button></span></div>`).join("");
  }
  function pedirIconosFijadas() {
    const faltan = (config.fijadas || []).map((f) => f.clave).filter((c) => !iconosApps[c]);
    if (faltan.length) P.enviar("pedirIconos", { claves: faltan });
  }

  // Arrastrar módulos entre columnas
  let arrastre = null;
  document.addEventListener("dragstart", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    arrastre = { sec: chip.dataset.sec, i: Number(chip.dataset.i) };
    chip.classList.add("arrastrando");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", "modulo");
  });
  document.addEventListener("dragend", () => { arrastre = null; document.querySelectorAll(".encima, .arrastrando").forEach((x) => x.classList.remove("encima", "arrastrando")); });
  document.addEventListener("dragover", (e) => {
    const col = e.target.closest(".columna-mod");
    if (!col || !arrastre) return;
    e.preventDefault();
    document.querySelectorAll(".columna-mod.encima").forEach((x) => x !== col && x.classList.remove("encima"));
    col.classList.add("encima");
  });
  document.addEventListener("drop", (e) => {
    const col = e.target.closest(".columna-mod");
    if (!col || !arrastre) return;
    e.preventDefault();
    const m = L.clonar(val("barra.modulos", {}));
    const [id] = (m[arrastre.sec] || []).splice(arrastre.i, 1);
    const destino = (m[col.dataset.sec] = m[col.dataset.sec] || []);
    const chips = Array.from(col.querySelectorAll(".chip"));
    let pos = chips.findIndex((c) => e.clientY < c.getBoundingClientRect().top + c.offsetHeight / 2);
    if (pos < 0) pos = destino.length;
    if (col.dataset.sec === arrastre.sec && pos > arrastre.i) pos--;
    destino.splice(Math.min(pos, destino.length), 0, id);
    arrastre = null;
    cambiar("barra.modulos", m, true);
    pintar();
  });

  // ---------- Bloques ----------
  function secBloques() {
    const lista = config.bloques || [];
    return cabeza("Bloques", "Relojes, música, la ficha del sistema y más, encima de tu fondo. En el modo edición los arrastras, cambias de tamaño y eliges su estilo directamente sobre el escritorio.",
      `<button class="btn principal" data-accion="abrir-editor">${I("editar")} Abrir el modo edición</button>`) +
      `<div class="tarjeta"><h2>${I("bloques")} En tu escritorio</h2><div class="lista-items">${lista.length ? lista.map((b) => {
        const d = L.bloques[b.tipo] || {};
        const estilo = (b.opciones || {}).estilo;
        return `<div class="item"><span class="ico">${I(d.icono || "bloques")}</span><span class="nombre">${esc(d.nombre || b.tipo)}<small>${estilo ? "Estilo: " + esc(estilo) : "Estilo normal"} · tamaño ${Math.round((b.escala || 1) * 100)}%</small></span>
          <span class="acciones"><button class="icono-btn" data-accion="quitar-bloque" data-id="${esc(b.id)}" title="Quitar">${I("papelera")}</button></span></div>`;
      }).join("") : '<div class="vacio">No hay bloques. Añade uno o aplica un tema.</div>'}</div></div>
      <div class="tarjeta"><h2>${I("mas")} Añadir rápido</h2><p class="nota">Se coloca en el centro; luego lo acomodas en el modo edición.</p>
        <div class="rejilla">${(L.listaBloques || []).filter((t) => L.bloques[t]).map((t) => {
          const d = L.bloques[t];
          return `<button class="carta" data-accion="anadir-bloque" data-tipo="${t}" style="padding:14px"><span style="color:var(--acento)">${I(d.icono || "bloques")}</span>
            <div class="info" style="padding:8px 0 0"><b>${esc(d.nombre)}</b><span>${esc(d.descripcion || "")}</span></div></button>`;
        }).join("")}</div></div>`;
  }

  // ---------- Colores ----------
  function secColores() {
    const roles = [["fondo", "Fondo"], ["superficie", "Superficie"], ["texto", "Texto"], ["tenue", "Texto tenue"], ["acento", "Acento"], ["acento2", "Acento 2"]];
    const c = val("paleta.colores", {});
    return cabeza("Colores y letra", "Como <code>pywal</code> en Linux: los colores de la barra y los bloques salen de tu fondo. También puedes elegirlos a mano.") +
      `<div class="tarjeta"><h2>${I("paleta")} Paleta</h2>
        ${fila("Origen de los colores", "Automáticos: se calculan del fondo cada vez que lo cambias", segmentos("paleta.modo", [["auto", "Automáticos"], ["manual", "Elegidos por mí"]], "auto"))}
        <div class="muestras" style="margin:12px 0 4px">${roles.map(([r, n]) =>
          `<div class="muestra"><label style="background:${esc(c[r] || "#000")}"><input type="color" data-ruta="paleta.colores.${r}" value="${esc(c[r] || "#000000")}"></label>${n}</div>`).join("")}</div>
        <div class="fila columna"><div class="et">Paletas listas</div><div class="paletas" style="margin-top:10px">${PALETAS.map(([n, p], i) =>
          `<button data-accion="paleta-lista" data-i="${i}">${["fondo", "superficie", "acento", "acento2"].map((r) => `<i style="background:${p[r]}"></i>`).join("")}<span>${n}</span></button>`).join("")}</div></div>
      </div>
      <div class="tarjeta"><h2>${I("terminal")} Llevar los colores a otras apps</h2>
        <p class="nota">Como <code>pywal</code>: cada vez que cambia tu paleta, también cambian estas apps.</p>
        ${fila("Windows Terminal", estado.terminal === false ? "No lo encontré en tu computadora (se instala desde la Microsoft Store)"
          : "Agrega el esquema «Lienzo» y lo usa en todos tus perfiles. Guarda una copia de tu configuración y, al apagarlo, vuelve a tu esquema de antes.", interruptor("terminal.colores", false))}
      </div>
      <div class="tarjeta"><h2>${I("texto")} Letra y forma</h2>
        <div style="display:grid;grid-template-columns:1fr 300px;gap:20px;align-items:start"><div>
        ${fila("Letra", "", selector("estilo.fuente", FUENTES.map((x) => [x, x]), "Segoe UI Variable Display"))}
        ${fila("Letra monoespaciada", "Para la terminal y la ficha", selector("estilo.fuenteMono", FUENTES_MONO.map((x) => [x, x]), "Cascadia Mono"))}
        ${fila("Redondeo", "", rango("estilo.redondeo", 0, 28, 1, 14, "px"))}
        ${fila("Opacidad de los paneles", "Para los bloques con fondo de vidrio", rango("estilo.opacidad", 0.15, 0.95, 0.05, 0.55, "%"))}
        ${fila("Sombras", "", interruptor("estilo.sombra", true))}</div>
        <div class="vista-tema"><div class="vb">${I("luna")}<span>Barra</span><span style="margin-left:auto;color:var(--tenue)">10:48 p. m.</span></div>
          <div class="vc"><b>10:48</b><span>Buenas noches, <em>tú</em></span></div></div></div>
      </div>`;
  }

  // ---------- Escritorio y Windows ----------
  function secEscritorio() {
    return cabeza("Escritorio y Windows", "Ajustes del propio Windows. Lo que es temporal (barra oculta, iconos ocultos) se deshace al cerrar Lienzo.") +
      `<div class="tarjeta"><h2>${I("monitor")} Iconos del escritorio</h2>
        ${fila("Mostrar los iconos", "Los rices de TikTok casi siempre los esconden para lucir el fondo", interruptor("escritorio.iconos", true))}
        ${fila("Tamaño de los iconos", "", segmentos("escritorio.tamanoIconos", [[0, "No cambiar"], [32, "Pequeños"], [48, "Medianos"], [96, "Grandes"]], 0, "data-num"))}</div>
      ${tarjetaBarraWindows()}
      ${tarjetaPersonalizacion()}`;
  }
  function tarjetaPersonalizacion() {
    const acento = val("windows.acento", "no-tocar");
    const temaClaro = val("windows.tema", "no-tocar") === "claro";
    return `<div class="tarjeta"><h2>${I("paleta")} Personalización de Windows</h2>
        <p class="nota">Esto cambia el propio Windows y se queda aunque cierres Lienzo. Lienzo apunta cómo estaba todo para que puedas deshacerlo con un clic.</p>
        ${fila("Modo de color", "Mixto: Inicio y la barra oscuros, apps claras", segmentos("windows.tema", [["no-tocar", "No cambiar"], ["oscuro", "Oscuro"], ["claro", "Claro"], ["mixto", "Mixto"]], "no-tocar", "data-repintar"))}
        ${fila("Color de énfasis", "El color de Inicio, la barra, los botones y los bordes", segmentos("windows.acento", [["no-tocar", "No cambiar"], ["lienzo", "El de mi tema"], ["elegido", "Elegirlo"]], "no-tocar", "data-repintar"))}
        ${acento === "lienzo" ? `<p class="nota" style="margin:2px 0 8px">Sigue al acento de Lienzo (ahora <b style="color:${esc(val("paleta.colores.acento", "#fff"))}">${esc(val("paleta.colores.acento", ""))}</b>): cambia solo al aplicar otro tema o fondo.</p>` : ""}
        ${acento === "elegido" ? fila("Tu color", "", colorCtl("windows.colorAcento", "#ff7eb6")) : ""}
        ${fila("Color en Inicio y la barra de tareas", temaClaro ? "Windows solo lo permite en modo oscuro" : "", segmentos("windows.colorEnBarra", SI_NO_ACT, "no-tocar"))}
        ${fila("Color en barras de título y bordes", "", segmentos("windows.colorEnTitulos", SI_NO_ACT, "no-tocar"))}
        ${fila("Efectos de transparencia", "El vidrio de Inicio, la barra y la Configuración", segmentos("windows.transparencia", SI_NO_ACT, "no-tocar"))}
        <div class="fila"><div class="et">Deshacer mis cambios en Windows<small>Vuelve a dejar el tema, los colores y los botones de la barra como estaban antes de Lienzo</small></div>
          <div class="ctl"><button class="btn" data-accion="deshacer-windows" ${estado.cambiosWindows ? "" : "disabled"}>${I("deshacer")} Deshacer</button></div></div>
        <div class="fila"><div class="et">Más opciones de Windows<small>Fondo de bloqueo, cursores, sonidos y fuentes</small></div><div class="ctl"><button class="btn" data-accion="ajustes-windows">${I("engrane")} Abrir Personalización</button></div></div></div>`;
  }

  // ---------- Rendimiento ----------
  function secRendimiento() {
    return cabeza("Rendimiento", "Lienzo está pensado para gastar lo mínimo: el fondo se detiene solo cuando no lo estás viendo.") +
      `<div class="tarjeta"><h2>${I("rendimiento")} Ahora mismo</h2><div class="fila"><div class="et" id="estado-rend">…</div>
        <div class="ctl"><button class="btn" data-accion="pausar">${estado.pausaManual ? I("play") + " Reanudar el fondo" : I("pausa") + " Pausar el fondo"}</button></div></div></div>
      <div class="tarjeta"><h2>${I("capas")} Animación</h2>
        ${fila("Cuadros por segundo", "24 se ve fluido en escenas tranquilas; 60 gasta más del doble", segmentos("rendimiento.fps", [[15, "15"], [24, "24"], [30, "30"], [60, "60"]], 24, "data-num"))}
        ${fila("Resolución de las escenas", "Menos resolución = menos trabajo para la gráfica. Las escenas WebGL ya usan la mitad.", rango("rendimiento.calidad", 0.35, 1, 0.05, 0.75, "%"))}</div>
      <div class="tarjeta"><h2>${I("pausa")} Pausar automáticamente</h2>
        ${fila("Cuando las ventanas tapan el fondo", "Por ejemplo, con una ventana maximizada", interruptor("rendimiento.pausarMaximizada", true))}
        ${fila("Con juegos o videos en pantalla completa", "", interruptor("rendimiento.pausarPantallaCompleta", true))}
        ${fila("Con batería", "", segmentos("rendimiento.bateria", [["nada", "Seguir igual"], ["reducir", "Bajar a 15 FPS"], ["pausar", "Pausar"]], "reducir"))}
        ${fila("Suspender si lleva rato tapado", "Libera también la memoria del fondo (puede verse un parpadeo al volver)", interruptor("rendimiento.suspender", false))}
        ${fila("Fondo solo en el monitor principal", "Útil si tienes dos pantallas", interruptor("rendimiento.soloPrincipal", false))}</div>
      <div class="tarjeta"><h2>${I("info")} Consejos</h2><p class="nota" style="margin:0">Los videos MP4 (H.264) usan la aceleración de tu tarjeta gráfica y son de lo más ligero. Las escenas con desenfoque o a 60 FPS son las que más gastan. Si juegas, no te preocupes: en pantalla completa todo se detiene.</p></div>`;
  }
  function actualizarEstado() {
    const el = document.getElementById("estado-rend");
    if (!el) return;
    const e = estado.estadoFondo || "activo";
    const motivos = { manual: "Lo pausaste tú", tapado: "Hay ventanas tapando el fondo", "pantalla-completa": "Hay un juego o video en pantalla completa", bloqueo: "La pantalla está bloqueada", bateria: "Ahorro por batería", pantalla: "La pantalla está apagada" };
    el.innerHTML = e.startsWith("pausa") ? `<span class="punto pausa"></span>En pausa<small>${esc(motivos[e.split(":")[1]] || "")} · gasto casi nulo</small>`
      : e === "reducido" ? `<span class="punto"></span>Activo en modo ahorro<small>Con batería se limita a 15 FPS</small>`
      : `<span class="punto"></span>Activo<small>${estado.fondos || 1} fondo(s) · escritorio ${esc(estado.escritorio || "")}</small>`;
  }

  // ---------- Acerca de ----------
  function secAcerca() {
    return cabeza("Acerca de Lienzo", `Versión ${esc(estado.version || "1.0")} · hecho con C# y WebView2 (el motor de Edge que ya trae Windows), sin instalar nada más.`) +
      `<div class="tarjeta"><h2>${I("sol")} Tú</h2>
        ${fila("Tu nombre", "Para el bloque de saludo", textoCtl("general.nombre", "", "(vacío = tu usuario de Windows)"))}
        ${fila("Iniciar con Windows", "Lienzo se abre solo al encender la compu", interruptor("general.iniciarConWindows", false))}</div>
      <div class="tarjeta"><h2>${I("carpeta")} Tus archivos</h2><p class="nota">Tu configuración, tus fondos y tus escenas viven en <code>${esc(estado.carpetaDatos || "%APPDATA%\\Lienzo")}</code>.</p>
        <button class="btn" data-accion="abrir-carpeta" data-cual="datos">${I("carpeta")} Abrir carpeta</button>
        <button class="btn" data-accion="abrir-carpeta" data-cual="escenas">${I("terminal")} Escenas propias</button>
        <button class="btn" data-accion="abrir-carpeta" data-cual="biblioteca">${I("imagen")} Biblioteca</button></div>
      <div class="tarjeta"><h2>${I("terminal")} Crea tus propias escenas</h2><p class="nota">Haz una carpeta dentro de <code>escenas</code> con un <code>index.html</code>. Tu página recibe estos mensajes con <code>window.addEventListener("message", …)</code>:</p>
        <p class="nota"><code>{tipo: "lienzo-pausa", pausado}</code> para detener tu animación cuando no se ve, <code>{tipo: "lienzo-paleta", colores}</code> con los colores del tema y <code>{tipo: "lienzo-mouse", x, y}</code> con el cursor (0 a 1) si activas el parallax.</p></div>
      <div class="tarjeta"><h2>${I("apagar")} Cerrar Lienzo</h2><p class="nota">Al cerrar, la barra de tareas y los iconos de Windows vuelven a como estaban. Si algo se queda raro, ejecuta <code>restaurar.cmd</code> en la carpeta de Lienzo.</p>
        <button class="btn peligro" data-accion="salir">${I("apagar")} Restaurar Windows y cerrar Lienzo</button></div>`;
  }

  // ================= Acciones =================
  const acciones = {
    "aplicar-rice"(el) {
      const r = L.rices.find((x) => x.id === el.dataset.id);
      if (!r) return;
      abrirDialogo(`<h2>Aplicar «${esc(r.nombre)}»</h2><p>${esc(r.descripcion)} Se cambiarán el fondo, los colores y la barra. Tus apps fijadas y tu biblioteca se quedan igual.</p>
        ${r.ocultarIconos ? `<label class="fila" style="border:0"><span class="et">Ocultar los iconos del escritorio<small>Recomendado para este look. Puedes volver a mostrarlos cuando quieras.</small></span><input type="checkbox" class="interruptor" id="ocultar-iconos" ${val("escritorio.iconos", true) ? "" : "checked"}></label>` : ""}
        ${(config.bloques || []).length ? `<div class="fila columna" style="border:0"><div class="et">Tus bloques y widgets<small>«Combinar» deja los del tema y conserva tus widgets de otros tipos (apps, clima, letras, WhatsApp…).</small></div>
          <div class="segmentos" id="modo-bloques" style="margin-top:8px">${[["combinar", "Combinar"], ["tema", "Solo los del tema"], ["mios", "Dejar los míos"]].map(([k, t], i) =>
            `<button data-valor="${k}" class="${i === 0 ? "activo" : ""}">${t}</button>`).join("")}</div></div>` : ""}
        <div class="botones"><button class="btn" data-cerrar>Cancelar</button><button class="btn principal" data-accion="confirmar-rice" data-id="${r.id}">${I("varita")} Aplicar</button></div>`);
      const seg = document.getElementById("modo-bloques");
      if (seg) seg.addEventListener("click", (e) => {
        const b = e.target.closest("button");
        if (b) seg.querySelectorAll("button").forEach((x) => x.classList.toggle("activo", x === b));
      });
    },
    "confirmar-rice"(el) {
      const r = L.rices.find((x) => x.id === el.dataset.id);
      const ocultar = document.getElementById("ocultar-iconos");
      const modo = document.querySelector("#modo-bloques button.activo");
      aplicarRice(r, ocultar ? !ocultar.checked : null, modo ? modo.dataset.valor : "combinar");
      cerrarDialogo();
    },
    "aplicar-rice-directo"(el) {
      const r = L.rices.find((x) => x.id === el.dataset.id);
      aplicarRice(r, null);
      capaDialogo.querySelectorAll(".mini-rices .carta").forEach((c) => c.classList.toggle("activa", c.dataset.id === r.id));
    },
    "guardar-rice"() {
      abrirDialogo(`<h2>Guardar mi look</h2><p>Ponle un nombre a tu combinación actual.</p><input type="text" id="nombre-rice" maxlength="40" placeholder="Por ejemplo: Mi noche" style="width:100%">
        <div class="botones"><button class="btn" data-cerrar>Cancelar</button><button class="btn principal" data-accion="confirmar-guardar-rice">${I("guardar")} Guardar</button></div>`);
      setTimeout(() => document.getElementById("nombre-rice").focus(), 50);
    },
    "confirmar-guardar-rice"() {
      const nombre = (document.getElementById("nombre-rice").value || "").trim() || "Mi rice";
      const id = "mio-" + Date.now().toString(36);
      const copia = L.clonar({ fondo: config.fondo, paleta: config.paleta, estilo: config.estilo, barra: config.barra, bloques: config.bloques });
      config.misRices = (config.misRices || []).concat([{ id, nombre, config: copia }]);
      config.rice = id;
      guardar();
      cerrarDialogo();
      pintar();
      aviso("Guardado en «Mis rices»");
    },
    "aplicar-mi-rice"(el) {
      const r = (config.misRices || [])[Number(el.dataset.i)];
      if (!r) return;
      Object.assign(config, L.clonar(r.config));
      config.rice = r.id;
      guardar();
      pintar();
      aviso(`«${r.nombre}» aplicado`);
    },
    "borrar-mi-rice"(el, e) {
      e.stopPropagation();
      config.misRices = (config.misRices || []).filter((_, i) => i !== Number(el.dataset.i));
      guardar();
      pintar();
    },
    "pestana-fondo"(el) {
      pestanaFondo = el.dataset.p;
      if (pestanaFondo === "linea" && !linea.resultados.length && !linea.cargando && !linea.pagina) buscarLinea(false);
      else pintar();
    },
    "fuente-linea"(el) {
      const antes = FUENTES_LINEA.find((x) => x[0] === linea.fuente);
      linea.fuente = el.dataset.f;
      linea.orden = linea.fuente === "wikimedia" ? "azar" : "";
      // Un enlace pegado no sirve como búsqueda en otra fuente.
      if (/^https?:/i.test(linea.q) || (antes && antes[2] === "yt")) linea.q = "";
      buscarLinea(false);
    },
    "instalar-ytdlp"() { linea.instalando = 0; P.enviar("instalarYtdlp"); pintar(); },
    "buscar-linea"() {
      leerBuscador();
      if (linea.fuente === "wikimedia" && linea.q && linea.orden === "azar") linea.orden = "";
      buscarLinea(false);
    },
    "mas-linea"() { buscarLinea(true); },
    "bajar-fondo"(el) {
      const r = linea.resultados[Number(el.dataset.i)];
      if (!r || linea.bajando) return;
      linea.bajando = r.id;
      linea.pct = 0;
      P.enviar("descargarFondo", { fuente: linea.fuente, descarga: r.descarga, nombre: r.nombre, id: r.id, miniatura: r.miniatura, calidad: linea.calidad });
      pintar();
    },
    "exportar-rice"() {
      const mio = (config.misRices || []).find((x) => x.id === config.rice);
      const base = mio ? mio.nombre : (L.rices.find((x) => x.id === config.rice) || {}).nombre || "Mi rice";
      abrirDialogo(`<h2>Exportar mi look</h2><p>Se guarda un archivo <code>.lienzo</code> con tu fondo (incluida tu imagen o video), colores, letra, barra y bloques.</p>
        <input type="text" id="nombre-export" maxlength="40" value="${esc(base)}" style="width:100%">
        <div class="botones"><button class="btn" data-cerrar>Cancelar</button><button class="btn principal" data-accion="confirmar-exportar">${I("arriba")} Elegir dónde guardarlo</button></div>`);
      setTimeout(() => document.getElementById("nombre-export").select(), 50);
    },
    "confirmar-exportar"() {
      const nombre = (document.getElementById("nombre-export").value || "").trim() || "Mi rice";
      cerrarDialogo();
      P.enviar("exportarRice", { nombre });
    },
    "importar-rice"() { P.enviar("importarRice"); },
    "elegir-escena"(el) {
      Object.assign(config.fondo, { tipo: "escena", escena: el.dataset.id, activo: true });
      guardar();
      pintar();
    },
    "restablecer-escena"() {
      if (config.fondo.opciones) delete config.fondo.opciones[config.fondo.escena];
      guardar();
      pintar();
    },
    "agregar-medio"() { P.enviar("elegirArchivo", { para: "fondo" }); },
    "elegir-medio"(el) {
      const b = (config.biblioteca || []).find((x) => x.archivo === el.dataset.archivo);
      if (!b) return;
      Object.assign(config.fondo, { tipo: b.tipo, archivo: b.archivo, activo: true });
      guardar();
      pintar();
    },
    "borrar-medio"(el, e) {
      e.stopPropagation();
      const archivo = el.dataset.archivo;
      const b = (config.biblioteca || []).find((x) => x.archivo === archivo);
      abrirDialogo(`<h2>¿Quitar «${esc(b ? b.nombre : archivo)}»?</h2><p>Se borra la copia que Lienzo guardó en tu biblioteca. El archivo original no se toca.</p>
        <div class="botones"><button class="btn" data-cerrar>Cancelar</button><button class="btn peligro" data-accion="confirmar-borrar-medio" data-archivo="${esc(archivo)}">${I("papelera")} Quitar</button></div>`);
    },
    "confirmar-borrar-medio"(el) {
      const archivo = el.dataset.archivo;
      config.biblioteca = (config.biblioteca || []).filter((x) => x.archivo !== archivo);
      if (config.fondo.archivo === archivo && (config.fondo.tipo === "video" || config.fondo.tipo === "imagen")) Object.assign(config.fondo, { tipo: "escena", archivo: "" });
      guardar();
      setTimeout(() => P.enviar("borrarArchivo", { archivo }), 1200); // que el fondo lo suelte antes de borrarlo
      cerrarDialogo();
      pintar();
    },
    "elegir-propia"(el) {
      Object.assign(config.fondo, { tipo: "html", carpeta: el.dataset.carpeta, activo: true });
      guardar();
      pintar();
    },
    "recargar-propias"() { escenasPropias = null; pintar(); },
    "usar-color"() { config.fondo.tipo = "color"; config.fondo.activo = true; guardar(); pintar(); },
    "abrir-carpeta"(el) { P.enviar("abrirCarpeta", { cual: el.dataset.cual }); },
    posicion(el) {
      cambiar("barra.posicion", el.dataset.p, true);
      if (el.dataset.p === "abajo" && val("barraWindows.modo", "auto") === "nativa") aviso("Consejo: oculta la barra de Windows para que no choquen");
      pintar();
    },
    "icono-inicio"(el) { config.barra.textoInicio = ""; cambiar("barra.iconoInicio", el.dataset.icono, true); pintar(); },
    "quitar-modulo"(el) {
      const m = L.clonar(val("barra.modulos", {}));
      m[el.dataset.sec].splice(Number(el.dataset.i), 1);
      cambiar("barra.modulos", m, true);
      pintar();
    },
    "agregar-modulo"(sel) {
      const m = L.clonar(val("barra.modulos", {}));
      (m[sel.dataset.sec] = m[sel.dataset.sec] || []).push(sel.value);
      cambiar("barra.modulos", m, true);
      pintar();
    },
    "fijar-app"() { elegirApp(); },
    "fijar-programa"() { P.enviar("elegirArchivo", { para: "app" }); },
    "quitar-fijada"(el) { config.fijadas.splice(Number(el.dataset.i), 1); guardar(); pintar(); },
    "subir-fijada"(el) {
      const i = Number(el.dataset.i), f = config.fijadas;
      [f[i - 1], f[i]] = [f[i], f[i - 1]];
      guardar();
      pintar();
    },
    "elegir-app-lista"(el) {
      const a = (apps || []).find((x) => x.clave === el.dataset.clave);
      if (a) agregarFijada(a);
      cerrarDialogo();
    },
    "abrir-editor"() { P.enviar("abrirEditor"); },
    "quitar-bloque"(el) { config.bloques = (config.bloques || []).filter((b) => b.id !== el.dataset.id); guardar(); pintar(); },
    "anadir-bloque"(el) {
      const tipo = el.dataset.tipo;
      let n = 1;
      while ((config.bloques || []).some((b) => b.id === `${tipo}-${n}`)) n++;
      config.bloques = (config.bloques || []).concat([{ id: `${tipo}-${n}`, tipo, x: 0.4, y: 0.4, escala: 1, opciones: {} }]);
      guardar();
      pintar();
      aviso("Bloque añadido. Ábrelo en el modo edición para moverlo.");
    },
    "paleta-lista"(el) {
      config.paleta = { modo: "manual", colores: Object.assign({}, PALETAS[Number(el.dataset.i)][1]) };
      L.tema.aplicar(config);
      guardar();
      pintar();
    },
    "ajustes-windows"() { P.enviar("abrirEnlace", { url: "ms-settings:personalization" }); },
    "deshacer-windows"() {
      abrirDialogo(`<h2>¿Deshacer los cambios en Windows?</h2><p>El modo de color, el color de énfasis, la transparencia y los botones de la barra de tareas vuelven a como estaban antes de que Lienzo los tocara. Tu fondo, tu barra y tus bloques de Lienzo no cambian.</p>
        <div class="botones"><button class="btn" data-cerrar>Cancelar</button><button class="btn" data-accion="confirmar-deshacer-windows">${I("deshacer")} Deshacer</button></div>`);
    },
    "confirmar-deshacer-windows"() { cerrarDialogo(); P.enviar("deshacerWindows"); },
    pausar() { P.enviar("pausarFondo", { pausado: !estado.pausaManual }); setTimeout(() => P.enviar("pedirEstadoWindows"), 300); },
    salir() {
      abrirDialogo(`<h2>¿Cerrar Lienzo?</h2><p>Tu escritorio, la barra de tareas y los iconos de Windows vuelven a la normalidad. Tu configuración se queda guardada para la próxima vez.</p>
        <div class="botones"><button class="btn" data-cerrar>Cancelar</button><button class="btn peligro" data-accion="confirmar-salir">${I("apagar")} Cerrar Lienzo</button></div>`);
    },
    "confirmar-salir"() { P.enviar("salir"); },
  };

  function leerBuscador() {
    const q = document.getElementById("q-linea"), o = document.getElementById("orden-linea"), c = document.getElementById("cat-linea");
    if (q) linea.q = q.value.trim();
    if (o) linea.orden = o.value;
    if (c) linea.categoria = c.value;
    const k = document.getElementById("calidad-linea");
    if (k) linea.calidad = k.value;
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.id === "q-linea") { e.preventDefault(); acciones["buscar-linea"](); }
  });
  document.addEventListener("change", (e) => {
    if (e.target.id === "orden-linea" || e.target.id === "cat-linea") { leerBuscador(); buscarLinea(false); }
    if (e.target.id === "calidad-linea") leerBuscador();
  });

  function aplicarRice(r, mostrarIconos, modoBloques) {
    if (!r) return;
    const nuevo = L.aplicarRice(config, r, modoBloques || "combinar");
    if (mostrarIconos !== null && mostrarIconos !== undefined) nuevo.escritorio = Object.assign({}, nuevo.escritorio, { iconos: mostrarIconos });
    config = nuevo;
    L.tema.aplicar(config);
    guardar();
    pintar();
    aviso(`«${r.nombre}» aplicado`);
  }

  function agregarFijada(a) {
    config.fijadas = config.fijadas || [];
    if (config.fijadas.some((f) => f.clave === a.clave)) { aviso("Esa app ya está fijada"); return; }
    config.fijadas.push({ nombre: a.nombre, clave: a.clave, destino: a.destino || a.clave });
    guardar();
    if (seccion === "barra") pintar();
    aviso(`«${a.nombre}» fijada en la barra`);
  }

  // ---------- Selector de apps instaladas ----------
  function elegirApp() {
    abrirDialogo(`<h2>Fijar una app</h2><p>Las mismas apps que salen en «Todas las apps» del menú Inicio.</p>
      <input type="search" id="buscar-app" placeholder="Buscar…" style="width:100%">
      <div class="apps-rejilla" id="rejilla-apps"><div class="vacio cargando">Cargando tus apps…</div></div>
      <div class="botones"><button class="btn" data-cerrar>Cerrar</button></div>`, "ancho");
    document.getElementById("buscar-app").addEventListener("input", pintarApps);
    setTimeout(() => document.getElementById("buscar-app").focus(), 50);
    if (!apps) P.enviar("pedirApps"); else pintarApps();
  }
  function pintarApps() {
    const rejilla = document.getElementById("rejilla-apps");
    if (!rejilla || !apps) return;
    const filtro = (document.getElementById("buscar-app").value || "").toLowerCase();
    const lista = apps.filter((a) => !filtro || a.nombre.toLowerCase().includes(filtro)).slice(0, 240);
    rejilla.innerHTML = lista.length ? lista.map((a) => `<button data-accion="elegir-app-lista" data-clave="${esc(a.clave)}" title="${esc(a.nombre)}">
      ${iconosApps[a.clave] ? `<img src="${iconosApps[a.clave]}" alt="">` : `<img class="hueco" data-icono-clave="${esc(a.clave)}" alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">`}
      <span>${esc(a.nombre)}</span></button>`).join("") : '<div class="vacio">No encontré ninguna app con ese nombre.</div>';
    const faltan = lista.filter((a) => !iconosApps[a.clave]).slice(0, 80).map((a) => a.clave);
    if (faltan.length) P.enviar("pedirIconos", { claves: faltan });
  }

  // ---------- Diálogos ----------
  function abrirDialogo(html, clase) {
    capaDialogo.innerHTML = `<div class="dialogo ${clase || ""}">${html}</div>`;
    capaDialogo.hidden = false;
    prepararVistasEn(capaDialogo);
  }
  function cerrarDialogo() { capaDialogo.hidden = true; capaDialogo.innerHTML = ""; }
  addEventListener("keydown", (e) => { if (e.key === "Escape" && !capaDialogo.hidden) cerrarDialogo(); });
  async function prepararVistasEn(raiz) {
    for (const v of Array.from(raiz.querySelectorAll(".vista[data-escena]"))) {
      const url = await vistaEscena(v.dataset.escena, JSON.parse(v.dataset.opciones || "{}"));
      if (url) v.insertAdjacentHTML("afterbegin", `<img class="vista-img" src="${url}" alt="">`);
    }
  }

  function bienvenida() {
    const primeros = L.rices.slice(0, 4);
    const usuario = ((L.datos.ficha || {}).usuario || "").split(/[ ._-]/)[0];
    abrirDialogo(`<div class="bienvenida"><h2>¡Hola! Esto es Lienzo</h2>
      <p>Un fondo animado detrás de tus iconos, una barra que pones donde quieras y bloques que arrastras por el escritorio. Todo gastando lo mínimo.</p>
      <div class="pasos">
        <div class="paso"><span class="n">1</span><div class="cuerpo"><b>Elige un tema para empezar</b><div class="mini-rices">${primeros.map((r) => cartaRice(r, r.id === config.rice, true)).join("")}</div></div></div>
        <div class="pasos-fila">
          <div class="paso"><span class="n">2</span><div class="cuerpo"><b>¿Cómo te llamas?</b><input type="text" data-ruta="general.nombre" value="${esc(val("general.nombre", ""))}" placeholder="${esc(L.formato.capital(usuario) || "Tu nombre")}" style="min-width:0;width:100%"></div></div>
          <div class="paso"><span class="n">3</span><div class="cuerpo"><b>¿Ocultar los iconos?</b><label class="interruptor-fila"><input type="checkbox" class="interruptor" id="bv-iconos"><small>Luce más el fondo. Vuelven al cerrar Lienzo.</small></label></div></div>
          <div class="paso"><span class="n">4</span><div class="cuerpo"><b>Barra de Windows</b>${segmentos("barraWindows.modo", [["nativa", "Dejarla"], ["auto", "Auto-ocultar"], ["oculta", "Ocultar"]], "auto")}</div></div>
        </div>
      </div>
      <div class="botones"><span class="nota-pie">Vuelve aquí cuando quieras con el botón ${I("lienzo")} de tu barra.</span><button class="btn principal" data-cerrar>${I("check")} Empezar</button></div></div>`, "ancho");
    // La pregunta es "¿ocultar?", al revés que el ajuste "mostrar iconos".
    const t = document.getElementById("bv-iconos");
    t.checked = !val("escritorio.iconos", true);
    t.addEventListener("change", () => cambiar("escritorio.iconos", !t.checked, true));
  }

  // Estado del programa cada pocos segundos (para el aviso de pausa del menú)
  setInterval(() => P.enviar("pedirEstadoWindows"), 4000);
  P.enviar("listo", { pagina: "panel" });
})();

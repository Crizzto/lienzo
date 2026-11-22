// Panel de Lienzo en el celular (Android). Edita la configuración, la enseña en la vista previa (un iframe con
// escritorio.html, el mismo que dibuja el fondo de pantalla) y la guarda en la app con el puente.
(function () {
  "use strict";
  const L = window.Lienzo, P = L.puente, I = L.icono, esc = L.escapar;
  const DATOS = "https://datos.lienzo.example/";
  const $ = (s, r) => (r || document).querySelector(s);
  const contenido = $("#contenido");

  let config = null;
  let estado = { activo: false, musica: false, version: "", dispositivo: "" };
  let pestana = "temas";
  try { pestana = localStorage.getItem("movil:pestana") || "temas"; } catch (e) { /* sin almacenamiento */ }
  const abiertos = new Set(); // bloques con sus opciones desplegadas

  // ---------------- Vista previa (iframes) ----------------
  const vistas = () => [$("#vista"), $("#vista-grande")].filter((f) => f && f.contentWindow && f.getAttribute("src"));
  const ultimos = {}; // último mensaje de cada tipo, para la vista que se abre después
  function aVistas(tipo, datos) {
    const m = Object.assign({ tipo }, datos || {});
    if (tipo !== "config") ultimos[tipo] = m;
    vistas().forEach((f) => f.contentWindow.postMessage({ lienzoParaVista: m }, "*"));
  }
  addEventListener("message", (e) => {
    const m = e.data && e.data.lienzoDesdeVista;
    if (!m) return;
    const f = vistas().find((x) => x.contentWindow === e.source);
    if (m.tipo === "listo" && f) {
      const enviar = (x) => f.contentWindow.postMessage({ lienzoParaVista: x }, "*");
      if (config) enviar({ tipo: "config", config });
      Object.values(ultimos).forEach(enviar);
    } else if (m.tipo === "paletaCalculada" && f === $("#vista")) {
      // Paleta automática (como pywal) calculada por la vista: la hace suya el tema y la guarda.
      if (config && (config.paleta || {}).modo === "auto" && JSON.stringify(config.paleta.colores) !== JSON.stringify(m.colores)) {
        config.paleta.colores = m.colores;
        guardar(false);
        if (pestana === "colores") pintar();
      }
    } else if (m.tipo === "media" || m.tipo === "lanzar") P.enviar(m.tipo, m);
    else if (m.tipo === "registro") P.log("[vista] " + m.texto);
  });
  ["musica", "sistema", "ficha"].forEach((t) => P.on(t, (m) => aVistas(t, m)));
  aVistas("pausa", { pausado: false, motivo: "", reducido: false });

  // ---------------- Guardar ----------------
  let tGuardar = 0, tVista = 0;
  function guardar(repintarCabecera = true) {
    L.tema.aplicar(config);
    clearTimeout(tVista);
    tVista = setTimeout(() => aVistas("config", { config }), 40);
    clearTimeout(tGuardar);
    tGuardar = setTimeout(() => P.enviar("guardarConfig", { config }), 300);
    if (repintarCabecera) pintarCabecera();
  }

  // ---------------- Datos que llegan de la app ----------------
  P.on("config", async (m) => {
    let c = m.config;
    if (!c || !c.movil) {
      if (!c) { try { c = await (await fetch("comun/defecto.json")).json(); } catch (e) { c = {}; } }
      c = L.movil.adaptar(c);
      config = c;
      guardar(false);
    } else config = c;
    L.tema.aplicar(config);
    aVistas("config", { config });
    pintarTodo();
  });
  P.on("estado", (m) => {
    estado = Object.assign(estado, m);
    if (m.insets) {
      document.documentElement.style.setProperty("--sa-arriba", (m.insets.arriba || 0) + "px");
      document.documentElement.style.setProperty("--sa-abajo", (m.insets.abajo || 0) + "px");
    }
    pintarCabecera();
    if (pestana === "ajustes") pintar();
  });
  P.on("archivoAgregado", (m) => agregarArchivo(m));
  // Botón «Atrás» de Android: cierra la vista en grande; si no está abierta, sale de la app.
  P.on("atras", () => {
    if (!$("#grande").hidden) $("#cerrar-grande").click();
    else P.enviar("salir");
  });
  P.on("aviso", (m) => avisar(m.texto));

  // ---------------- Cabecera ----------------
  function riceActual() { return (L.rices || []).find((r) => r.id === (config && config.rice)); }
  function nombreFondo() {
    const f = (config && config.fondo) || {};
    if (f.tipo === "escena") return ((L.escenas || {})[f.escena] || {}).nombre || f.escena;
    if (f.tipo === "imagen") return "Tu imagen";
    if (f.tipo === "video") return "Tu video";
    return "Color sólido";
  }
  function pintarCabecera() {
    if (!config) return;
    const r = riceActual();
    $("#nombre-tema").textContent = r ? r.nombre : "Tu rice";
    $("#detalle-tema").textContent = nombreFondo() + " · " + ((config.bloques || []).length || "sin") + ((config.bloques || []).length === 1 ? " bloque" : " bloques");
    const chip = $("#estado");
    chip.hidden = !P.real || P.vista;
    chip.textContent = estado.activo ? "Es tu fondo" : "Sin poner";
    chip.classList.toggle("activo", !!estado.activo);
    const b = $("#poner");
    b.innerHTML = estado.activo ? `${I("check")} Es tu fondo` : `${I("varita")} Poner como fondo`;
    b.classList.toggle("listo", !!estado.activo);
    b.classList.toggle("principal", !estado.activo);
    $("#nota-poner").textContent = estado.activo ? "Los cambios se ven al instante." : "Para la pantalla de inicio y la de bloqueo.";
  }
  $("#poner").addEventListener("click", () => {
    if (estado.activo) { avisar("Lienzo ya es tu fondo. Todo lo que cambies aquí se ve al momento."); return; }
    P.enviar("ponerFondo");
    if (!P.real) avisar("En el celular esto abre la ventana de Android para poner el fondo.");
  });

  // Vista en grande
  $("#telefono").addEventListener("click", () => {
    const g = $("#grande"), f = $("#vista-grande");
    f.setAttribute("src", "escritorio.html?vista=1");
    g.hidden = false;
  });
  $("#cerrar-grande").innerHTML = I("cerrar");
  $("#cerrar-grande").addEventListener("click", () => {
    $("#grande").hidden = true;
    const f = $("#vista-grande");
    f.removeAttribute("src");
    f.src = "about:blank";
    f.removeAttribute("src");
  });

  // La vista se encoge al desplazarse para dejar más lugar a los ajustes.
  addEventListener("scroll", () => document.body.classList.toggle("desplazado", scrollY > 40), { passive: true });

  // ---------------- Pestañas ----------------
  document.querySelectorAll("[data-icono]").forEach((el) => { el.innerHTML = I(el.dataset.icono); });
  $(".marca").innerHTML = I("lienzo");
  $("#pestanas").addEventListener("click", (e) => {
    const b = e.target.closest("[data-pestana]");
    if (!b || b.dataset.pestana === pestana) return;
    pestana = b.dataset.pestana;
    try { localStorage.setItem("movil:pestana", pestana); } catch (er) { /* nada */ }
    pintar();
    scrollTo({ top: 0 });
  });

  function pintarTodo() { pintarCabecera(); pintar(); }
  function pintar() {
    if (!config) return;
    document.querySelectorAll("#pestanas [data-pestana]").forEach((b) => b.classList.toggle("si", b.dataset.pestana === pestana));
    const f = { temas: pintarTemas, fondo: pintarFondo, bloques: pintarBloques, colores: pintarColores, ajustes: pintarAjustes }[pestana] || pintarTemas;
    contenido.innerHTML = f();
    actualizarRangos();
    prepararVistas();
  }

  // ---------------- Campos genéricos ----------------
  // data-ruta: "fondo.efectos.oscurecer" (ruta en la configuración), "escena:<opción>", "bloque:<id>:<opción>".
  function valorEn(ruta) {
    if (ruta.startsWith("escena:")) {
      const f = config.fondo, def = L.escenas[f.escena] || {};
      const o = Object.assign(L.opcionesPorDefecto(def), (f.opciones || {})[f.escena]);
      return o[ruta.slice(7)];
    }
    if (ruta.startsWith("bloque:")) {
      const [, id, op] = ruta.split(":");
      const b = (config.bloques || []).find((x) => x.id === id);
      if (!b) return undefined;
      if (op === "y" || op === "escala") return b[op];
      return L.opcionesDeBloque(L.bloques[b.tipo] || {}, b.opciones)[op];
    }
    return ruta.split(".").reduce((o, k) => (o == null ? undefined : o[k]), config);
  }
  function ponerEn(ruta, valor) {
    if (ruta.startsWith("escena:")) {
      const f = config.fondo;
      f.opciones = f.opciones || {};
      f.opciones[f.escena] = Object.assign({}, f.opciones[f.escena], { [ruta.slice(7)]: valor });
      return;
    }
    if (ruta.startsWith("bloque:")) {
      const [, id, op] = ruta.split(":");
      const b = (config.bloques || []).find((x) => x.id === id);
      if (!b) return;
      if (op === "y" || op === "escala") b[op] = valor;
      else if (op === "alinear") L.movil.alinear(b, valor);
      else b.opciones = Object.assign({}, b.opciones, { [op]: valor });
      return;
    }
    const partes = ruta.split(".");
    let o = config;
    partes.slice(0, -1).forEach((k) => { if (o[k] == null || typeof o[k] !== "object") o[k] = {}; o = o[k]; });
    o[partes[partes.length - 1]] = valor;
  }

  function campo(op, ruta, valor) {
    const nombre = esc(op.nombre);
    const v = valor === undefined ? op.valor : valor;
    if (op.tipo === "si-no") {
      return `<label class="campo linea"><span class="et">${nombre}${op.ayuda ? `<small>${esc(op.ayuda)}</small>` : ""}</span>
        <span class="interruptor"><input type="checkbox" data-ruta="${esc(ruta)}" ${v ? "checked" : ""}><i></i></span></label>`;
    }
    if (op.tipo === "lista") {
      return `<div class="campo"><span class="et">${nombre}</span><div class="chips" data-ruta="${esc(ruta)}" data-numero="${typeof op.valor === "number" ? 1 : ""}">
        ${op.opciones.map(([val, txt]) => `<button data-valor="${esc(val)}" class="${String(val) === String(v) ? "si" : ""}">${esc(txt)}</button>`).join("")}</div></div>`;
    }
    if (op.tipo === "rango") {
      return `<div class="campo"><div class="cab-rango"><span class="et">${nombre}</span><span class="valor" data-valor-de="${esc(ruta)}">${formatear(op, v)}</span></div>
        <input type="range" data-ruta="${esc(ruta)}" min="${op.min}" max="${op.max}" step="${op.paso || 1}" value="${v}" data-unidad="${esc(op.unidad || "")}"></div>`;
    }
    if (op.tipo === "color") {
      return `<label class="campo linea"><span class="et">${nombre}</span><input type="color" data-ruta="${esc(ruta)}" value="${esc(v)}"></label>`;
    }
    if (op.tipo === "texto") {
      return `<div class="campo"><span class="et">${nombre}</span><input type="text" data-ruta="${esc(ruta)}" value="${esc(v || "")}" placeholder="${esc(op.ejemplo || "")}" enterkeyhint="done"></div>`;
    }
    return "";
  }
  function formatear(op, v) {
    const n = Number(v);
    if (op.unidad === "%") return Math.round(n * (op.max <= 1 ? 100 : 1)) + "%";
    if (op.unidad) return (Number.isInteger(n) ? n : n.toFixed(2)) + " " + op.unidad;
    return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, "");
  }
  function actualizarRangos() {
    contenido.querySelectorAll('input[type="range"]').forEach((r) => {
      const p = ((r.value - r.min) / (r.max - r.min)) * 100;
      r.style.setProperty("--p", p + "%");
    });
  }

  contenido.addEventListener("input", (e) => {
    const el = e.target;
    const ruta = el.dataset.ruta;
    if (!ruta) return;
    if (el.type === "range") {
      const v = Number(el.value);
      ponerEn(ruta, v);
      el.style.setProperty("--p", ((v - el.min) / (el.max - el.min)) * 100 + "%");
      const et = contenido.querySelector(`[data-valor-de="${CSS.escape(ruta)}"]`);
      if (et) et.textContent = formatear({ unidad: el.dataset.unidad, max: Number(el.max) }, v);
      guardar();
    } else if (el.type === "color") { ponerEn(ruta, el.value); guardar(); }
    else if (el.type === "text") { ponerEn(ruta, el.value); guardar(); }
  });
  contenido.addEventListener("change", (e) => {
    const el = e.target;
    if (el.type === "checkbox" && el.dataset.ruta) { ponerEn(el.dataset.ruta, el.checked); guardar(); }
  });
  contenido.addEventListener("click", (e) => {
    const chip = e.target.closest(".chips[data-ruta] button");
    if (chip) {
      const g = chip.parentElement;
      const v = g.dataset.numero ? Number(chip.dataset.valor) : chip.dataset.valor;
      ponerEn(g.dataset.ruta, v);
      g.querySelectorAll("button").forEach((b) => b.classList.toggle("si", b === chip));
      guardar();
      if (g.dataset.repintar) pintar();
      return;
    }
    const a = e.target.closest("[data-accion]");
    if (a) acciones[a.dataset.accion](a, e);
  });

  // ---------------- Temas ----------------
  function pintarTemas() {
    return `<section class="seccion"><h2>Temas</h2><p class="nota">Un toque y cambia todo: fondo, colores y bloques. Después lo ajustas a tu gusto en las otras pestañas.</p>
      <div class="rejilla-temas">${(L.rices || []).map((r) => {
        const def = L.escenas[(r.config.fondo || {}).escena] || {};
        const p = def.paleta || {};
        return `<button class="tema ${config.rice === r.id ? "activo" : ""}" data-accion="tema" data-id="${esc(r.id)}">
          <span class="mini" data-escena="${esc((r.config.fondo || {}).escena || "")}" data-forma="tema"></span>
          <span class="puntos">${["acento", "acento2", "texto"].map((k) => p[k] ? `<i style="background:${esc(p[k])}"></i>` : "").join("")}</span>
          <span class="info"><b>${esc(r.nombre)}</b><span>${esc(r.descripcion || "")}</span></span></button>`;
      }).join("")}</div></section>`;
  }

  // ---------------- Fondo ----------------
  function pintarFondo() {
    const f = config.fondo || {};
    const def = f.tipo === "escena" ? L.escenas[f.escena] : null;
    const efectos = [
      { id: "oscurecer", nombre: "Oscurecer", tipo: "rango", min: 0, max: 80, paso: 1, valor: 0, unidad: "%" },
      { id: "desenfoque", nombre: "Desenfoque", tipo: "rango", min: 0, max: 20, paso: 1, valor: 0, unidad: "px" },
      { id: "vineta", nombre: "Viñeta", tipo: "rango", min: 0, max: 100, paso: 1, valor: 20, unidad: "%" },
      { id: "saturacion", nombre: "Saturación", tipo: "rango", min: 0, max: 200, paso: 5, valor: 100, unidad: "%" },
      { id: "grano", nombre: "Grano", tipo: "rango", min: 0, max: 100, paso: 1, valor: 0, unidad: "%" },
      { id: "parallax", nombre: "Movimiento al deslizar", tipo: "rango", min: 0, max: 1, paso: 0.05, valor: 0.5, unidad: "%" },
    ];
    const bib = config.biblioteca || [];
    return `<section class="seccion"><h2>Escenas animadas</h2><p class="nota">Se mueven solas y se pausan cuando no las ves, para cuidar la batería.</p>
        <div class="carrusel">${(L.listaEscenas || []).map((id) => {
          const d = L.escenas[id] || {};
          return `<button class="escena ${f.tipo === "escena" && f.escena === id ? "activo" : ""}" data-accion="escena" data-id="${esc(id)}">
            <span class="mini" data-escena="${esc(id)}" data-forma="escena"></span><span>${esc(d.nombre || id)}</span></button>`;
        }).join("")}</div></section>
      ${def && (def.opciones || []).length ? `<section class="seccion"><h2>${esc(def.nombre)}</h2><div class="tarjeta">
        ${def.opciones.map((op) => campo(op, "escena:" + op.id, valorEn("escena:" + op.id))).join("")}</div></section>` : ""}
      <section class="seccion"><h2>Tus fotos y videos</h2><p class="nota">Desde tu galería. Los videos se ven con la aceleración del teléfono.</p>
        <div class="biblioteca">
          <button class="agregar" data-accion="agregar">${I("mas")}Agregar de la galería</button>
          ${bib.map((b, i) => `<div class="archivo ${(f.tipo === "imagen" || f.tipo === "video") && f.archivo === b.archivo ? "activo" : ""}" data-accion="archivo" data-i="${i}"
              style="${b.miniatura ? `background-image:url('${esc(b.miniatura)}')` : ""}">
              <span class="tipo">${I(b.tipo === "video" ? "video" : "imagen")}${b.tipo === "video" ? "Video" : "Foto"}</span>
              <button class="quitar" data-accion="quitarArchivo" data-i="${i}" aria-label="Quitar">${I("cerrar")}</button></div>`).join("")}
        </div></section>
      <section class="seccion"><h2>Efectos</h2><div class="tarjeta">
        ${efectos.map((op) => campo(op, "fondo.efectos." + op.id, ((f.efectos || {})[op.id]))).join("")}</div></section>`;
  }

  // ---------------- Bloques ----------------
  function pintarBloques() {
    const lista = config.bloques || [];
    return `<section class="seccion"><h2>Bloques</h2><p class="nota">Se dibujan sobre el fondo, en la pantalla de inicio y en la de bloqueo. Los de música se tocan con un toque en un espacio vacío.</p>
      <div class="tarjeta">${L.movil.CATALOGO.map((c) => {
        const def = L.bloques[c.tipo];
        if (!def) return "";
        const b = lista.find((x) => x.tipo === c.tipo);
        const abierto = b && abiertos.has(c.tipo);
        return `<div class="bloque-item"><div class="bloque-fila">
            <span class="ic-bloque">${I(def.icono || "bloques")}</span>
            <span class="et">${esc(def.nombre)}<small>${b ? `<button class="tenue" data-accion="desplegar" data-tipo="${c.tipo}">${abierto ? "Ocultar ajustes ▴" : "Ajustar ▾"}</button>` : esc(def.descripcion || "")}</small></span>
            <span class="interruptor"><input type="checkbox" data-bloque="${c.tipo}" ${b ? "checked" : ""} aria-label="${esc(def.nombre)}"><i></i></span>
          </div>${abierto ? opcionesBloque(b, def) : ""}</div>`;
      }).join("")}</div>
      ${estado.musica || !P.real ? "" : `<div class="caja-nota" style="margin-top:12px">${I("nota")}<span><b>¿Música en tus bloques?</b>Para ver qué suena (Spotify, YouTube Music…) Lienzo necesita permiso de leer las notificaciones de música. <button class="btn chico" data-accion="permisoMusica" style="margin-top:8px">Dar permiso</button></span></div>`}
      </section>`;
  }
  function opcionesBloque(b, def) {
    const id = b.id;
    const o = L.opcionesDeBloque(def, b.opciones);
    const ops = (def.opciones || []).filter((op) => !["app", "apps", "soloDe"].includes(op.tipo) && op.id !== "soloDe" && op.id !== "app");
    const posicion = [
      { id: "y", nombre: "Altura en la pantalla", tipo: "rango", min: 0.04, max: 0.9, paso: 0.01, valor: 0.3, unidad: "%" },
      { id: "escala", nombre: "Tamaño", tipo: "rango", min: 0.5, max: 1.6, paso: 0.05, valor: 1, unidad: "%" },
    ];
    const comunes = L.opcionesComunes.filter((op) => ["alinear", "fondo", "color"].includes(op.id));
    return `<div class="bloque-opciones">
      ${posicion.map((op) => campo(op, `bloque:${id}:${op.id}`, b[op.id])).join("")}
      ${comunes.map((op) => campo(op, `bloque:${id}:${op.id}`, o[op.id])).join("")}
      ${ops.map((op) => campo(op, `bloque:${id}:${op.id}`, o[op.id])).join("")}</div>`;
  }

  // ---------------- Colores ----------------
  function pintarColores() {
    const p = config.paleta || {}, c = p.colores || {}, e = config.estilo || {};
    const roles = [["fondo", "Fondo"], ["superficie", "Panel"], ["texto", "Texto"], ["tenue", "Tenue"], ["acento", "Acento"], ["acento2", "Acento 2"]];
    const fuentes = [["system-ui", "Del sistema"], ["serif", "Clásica"], ["sans-serif-condensed", "Condensada"], ["monospace", "Mono"]];
    return `<section class="seccion"><h2>Colores</h2><p class="nota">Salen solos del fondo, como pywal, o los eliges tú.</p>
        <div class="tarjeta">
          ${campo({ nombre: "De dónde salen", tipo: "lista", opciones: [["auto", "Del fondo"], ["manual", "Elegidos a mano"]], valor: "auto" }, "paleta.modo", p.modo)}
          <div class="muestras">${roles.map(([k, n]) => `<label class="muestra"><i style="background:${esc(c[k] || "#000")}"></i>${n}<input type="color" data-color="${k}" value="${esc(c[k] || "#000000")}"></label>`).join("")}</div>
        </div></section>
      <section class="seccion"><h2>Paletas listas</h2><div class="paletas">${L.movil.PALETAS.map(([n, pal], i) =>
        `<button class="paleta ${p.modo === "manual" && JSON.stringify(pal) === JSON.stringify(c) ? "si" : ""}" data-accion="paleta" data-i="${i}">
          <span class="pp">${["fondo", "acento", "acento2", "texto"].map((k) => `<i style="background:${pal[k]}"></i>`).join("")}</span>${esc(n)}</button>`).join("")}</div></section>
      <section class="seccion"><h2>Estilo</h2><div class="tarjeta">
        ${campo({ nombre: "Letra", tipo: "lista", opciones: fuentes, valor: "system-ui" }, "estilo.fuente", fuentes.some((f) => f[0] === e.fuente) ? e.fuente : "system-ui")}
        ${campo({ nombre: "Esquinas redondeadas", tipo: "rango", min: 0, max: 28, paso: 1, valor: 14, unidad: "px" }, "estilo.redondeo", e.redondeo)}
        ${campo({ nombre: "Opacidad del vidrio", tipo: "rango", min: 0.15, max: 0.95, paso: 0.05, valor: 0.55, unidad: "%" }, "estilo.opacidad", e.opacidad)}
        ${campo({ nombre: "Sombra en el texto", tipo: "si-no", valor: true }, "estilo.sombra", e.sombra !== false)}
      </div></section>
      <div class="caja-nota">${I("paleta")}<span><b>Todo el teléfono con tus colores</b>Con Lienzo de fondo, Android pinta los ajustes, el teclado y los iconos temáticos con estos colores (Material You). Si no cambian, revisa Ajustes → Fondo de pantalla y estilo → «Colores del fondo».</span></div>`;
  }
  contenido.addEventListener("input", (e) => {
    const k = e.target.dataset.color;
    if (!k) return;
    config.paleta = Object.assign({}, config.paleta, { modo: "manual" });
    config.paleta.colores = Object.assign({}, config.paleta.colores, { [k]: e.target.value });
    e.target.previousElementSibling.style.background = e.target.value;
    guardar();
  });
  contenido.addEventListener("change", (e) => { if (e.target.dataset.color) pintar(); });

  // ---------------- Ajustes ----------------
  function pintarAjustes() {
    const r = config.rendimiento || {};
    return `<section class="seccion"><h2>Tú</h2><div class="tarjeta">
        ${campo({ nombre: "Tu nombre (para el saludo)", tipo: "texto", ejemplo: "Cris" }, "general.nombre", (config.general || {}).nombre)}
      </div></section>
      <section class="seccion"><h2>Música</h2><div class="tarjeta"><div class="campo linea">
        <span class="et">Ver qué suena<small>${estado.musica ? "Listo: los bloques de música y letras ven Spotify, YouTube Music y cualquier reproductor." : "Lienzo lee la notificación de música para mostrar la canción, la portada y las letras. No lee tus otras notificaciones."}</small></span>
        ${estado.musica ? `<span class="chip-estado activo">Permitido</span>` : `<button class="btn chico" data-accion="permisoMusica">Permitir</button>`}
      </div></div></section>
      <section class="seccion"><h2>Batería y rendimiento</h2><div class="tarjeta">
        ${campo({ nombre: "Cuadros por segundo", tipo: "lista", opciones: [[24, "24"], [30, "30"], [60, "60"]], valor: 30 }, "rendimiento.fps", r.fps)}
        ${campo({ nombre: "Calidad de las escenas", tipo: "lista", opciones: [[0.4, "Ahorro"], [0.6, "Normal"], [0.85, "Alta"]], valor: 0.6 }, "rendimiento.calidad", r.calidad)}
        ${campo({ nombre: "Con ahorro de batería", tipo: "lista", opciones: [["reducir", "Ir más lento"], ["pausar", "Pausar"], ["nada", "Nada"]], valor: "reducir" }, "rendimiento.bateria", r.bateria)}
      </div><p class="nota" style="margin:10px 2px 0">El fondo se detiene solo cuando abres una app o apagas la pantalla: ahí no gasta nada.</p></section>
      <section class="seccion"><h2>Acerca de</h2><div class="tarjeta">
        <div class="campo linea"><span class="et">Lienzo para Android</span><span class="valor">${esc(estado.version || "1.0.0")}</span></div>
        ${estado.dispositivo ? `<div class="campo linea"><span class="et">Tu teléfono</span><span class="valor">${esc(estado.dispositivo)}</span></div>` : ""}
      </div></section>`;
  }

  // ---------------- Acciones ----------------
  const acciones = {
    tema(el) {
      const r = (L.rices || []).find((x) => x.id === el.dataset.id);
      if (!r) return;
      config = L.movil.aplicarRice(config, r);
      guardar();
      pintar();
      avisar(`Tema «${r.nombre}» aplicado`);
    },
    escena(el) {
      config.fondo = Object.assign({}, config.fondo, { tipo: "escena", escena: el.dataset.id, activo: true });
      const def = L.escenas[el.dataset.id];
      if (def && def.paleta && (config.paleta || {}).modo === "auto") config.paleta.colores = Object.assign({}, config.paleta.colores, def.paleta);
      guardar();
      pintar();
    },
    agregar() {
      if (!P.real) { avisar("En el celular esto abre tu galería."); return; }
      P.enviar("elegirArchivo");
    },
    archivo(el, e) {
      if (e.target.closest(".quitar")) return;
      const b = (config.biblioteca || [])[Number(el.dataset.i)];
      if (!b) return;
      ponerArchivo(b);
    },
    quitarArchivo(el, e) {
      e.stopPropagation();
      const i = Number(el.dataset.i);
      const b = (config.biblioteca || [])[i];
      if (!b) return;
      config.biblioteca.splice(i, 1);
      if (config.fondo.archivo === b.archivo) Object.assign(config.fondo, { tipo: "escena", escena: config.fondo.escena || "cielo-lofi" });
      P.enviar("borrarArchivo", { archivo: b.archivo });
      guardar();
      pintar();
    },
    bloque(el) {
      const tipo = el.dataset.bloque;
      if (el.checked) {
        const c = L.movil.CATALOGO.find((x) => x.tipo === tipo);
        config.bloques = (config.bloques || []).concat([JSON.parse(JSON.stringify(c.nuevo))]);
        abiertos.add(tipo);
      } else {
        config.bloques = (config.bloques || []).filter((b) => b.tipo !== tipo);
        abiertos.delete(tipo);
      }
      guardar();
      pintar();
    },
    desplegar(el) {
      const t = el.dataset.tipo;
      if (abiertos.has(t)) abiertos.delete(t); else abiertos.add(t);
      pintar();
    },
    paleta(el) {
      config.paleta = { modo: "manual", colores: Object.assign({}, L.movil.PALETAS[Number(el.dataset.i)][1]) };
      guardar();
      pintar();
    },
    permisoMusica() { P.enviar("permisoMusica"); if (!P.real) avisar("En el celular esto abre el permiso de notificaciones."); },
  };
  // Los interruptores de bloques se manejan al cambiar (no con data-accion, que es para clics).
  contenido.addEventListener("change", (e) => {
    const el = e.target;
    if (el.type === "checkbox" && el.dataset.bloque) acciones.bloque(el);
  });

  // ---------------- Fotos y videos ----------------
  function ponerArchivo(b) {
    config.fondo = Object.assign({}, config.fondo, { tipo: b.tipo, archivo: b.archivo, activo: true });
    if (b.dominantes && b.dominantes.length && (config.paleta || {}).modo === "auto") config.paleta.colores = L.tema.rolesDesdeColores(b.dominantes);
    guardar();
    pintar();
  }
  // La app copió el archivo a su carpeta: se saca una miniatura y sus colores, y se pone de fondo.
  async function agregarArchivo(m) {
    const url = DATOS + encodeURI(m.archivo);
    const entrada = { archivo: m.archivo, tipo: m.medio, nombre: m.nombre || "", miniatura: "", dominantes: [] };
    try {
      const fuente = await cargarMedio(url, m.medio);
      const w = fuente.videoWidth || fuente.naturalWidth, h = fuente.videoHeight || fuente.naturalHeight;
      const c = document.createElement("canvas");
      const alto = 320, ancho = Math.round(alto * 9 / 16);
      c.width = ancho; c.height = alto;
      const g = c.getContext("2d");
      const s = Math.max(ancho / w, alto / h);
      g.drawImage(fuente, (ancho - w * s) / 2, (alto - h * s) / 2, w * s, h * s);
      entrada.miniatura = c.toDataURL("image/jpeg", 0.8);
      entrada.dominantes = L.tema.dominantesDeCanvas(c, 8);
    } catch (e) { P.log("Miniatura: " + e.message); }
    config.biblioteca = [entrada].concat((config.biblioteca || []).filter((b) => b.archivo !== m.archivo));
    ponerArchivo(entrada);
    avisar(m.medio === "video" ? "Video agregado" : "Foto agregada");
  }
  function cargarMedio(url, tipo) {
    return new Promise((ok, mal) => {
      const tope = setTimeout(() => mal(new Error("tardó demasiado")), 15000);
      if (tipo === "video") {
        const v = document.createElement("video");
        Object.assign(v, { muted: true, playsInline: true, preload: "auto", crossOrigin: "anonymous" });
        v.addEventListener("loadeddata", () => { v.currentTime = Math.min(1, (v.duration || 2) / 3); }, { once: true });
        v.addEventListener("seeked", () => { clearTimeout(tope); ok(v); }, { once: true });
        v.addEventListener("error", () => { clearTimeout(tope); mal(new Error("no se pudo leer el video")); }, { once: true });
        v.src = url;
      } else {
        const i = new Image();
        i.crossOrigin = "anonymous";
        i.onload = () => { clearTimeout(tope); ok(i); };
        i.onerror = () => { clearTimeout(tope); mal(new Error("no se pudo leer la imagen")); };
        i.src = url;
      }
    });
  }

  // ---------------- Miniaturas de escenas ----------------
  const cache = {};
  async function vistaEscena(id, forma) {
    const def = L.escenas[id];
    if (!def) return null;
    const [w, h] = forma === "tema" ? [240, 320] : [192, 300];
    const clave = `m1|${id}|${def.version || 1}|${w}x${h}`;
    if (cache[clave]) return cache[clave];
    try { const g = localStorage.getItem("vista:" + clave); if (g) return (cache[clave] = g); } catch (e) { /* nada */ }
    const c = document.createElement("canvas");
    let motor;
    try {
      motor = new L.MotorEscena(c, def, null, { fps: 30, calidad: 1, tamano: [w / 2, h / 2], paleta: def.paleta || {} });
      motor.pausar(true);
      motor.simular(2.5);
      const url = c.toDataURL("image/jpeg", 0.82);
      cache[clave] = url;
      try { localStorage.setItem("vista:" + clave, url); } catch (e) { /* lleno */ }
      return url;
    } catch (e) { P.log("Vista de " + id + ": " + e.message); return null; }
    finally {
      if (motor) motor.destruir();
      if (def.tipo === "webgl") { const gl = c.getContext("webgl"); const x = gl && gl.getExtension("WEBGL_lose_context"); if (x) x.loseContext(); }
    }
  }
  let generacion = 0;
  async function prepararVistas() {
    const mia = ++generacion;
    for (const el of Array.from(contenido.querySelectorAll(".mini[data-escena]"))) {
      if (!el.dataset.escena) continue;
      await new Promise((r) => setTimeout(r, 0));
      if (mia !== generacion) return;
      const url = await vistaEscena(el.dataset.escena, el.dataset.forma);
      if (url && mia === generacion) el.style.backgroundImage = `url(${url})`;
    }
  }

  // ---------------- Avisos ----------------
  let tAviso = 0;
  function avisar(texto) {
    const a = $("#aviso");
    a.textContent = texto;
    a.hidden = false;
    a.style.animation = "none"; void a.offsetWidth; a.style.animation = "";
    clearTimeout(tAviso);
    tAviso = setTimeout(() => { a.hidden = true; }, 2600);
  }

  // ---------------- Arranque ----------------
  async function arrancar() {
    await Promise.all([
      Promise.all((L.listaEscenas || []).map((id) => L.cargar(`escenas/${id}.js`).catch(() => {}))),
      Promise.all(L.movil.CATALOGO.map((c) => L.cargar(`bloques/${c.tipo}.js`).catch(() => {}))),
    ]);
    P.enviar("listo", { pagina: "panel" });
  }
  arrancar();
})();

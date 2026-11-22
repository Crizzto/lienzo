// Página del escritorio: el fondo animado + los bloques. Con ?editar=1 es el modo edición.
(function () {
  "use strict";
  const L = window.Lienzo, P = L.puente;
  const q = new URLSearchParams(location.search);
  const EDITANDO = q.get("editar") === "1";
  const PRINCIPAL = q.get("principal") === "1" || !P.real;
  const DATOS = "https://datos.lienzo.example/";
  const capaFondo = document.getElementById("capa-fondo");
  const capaBloques = document.getElementById("capa-bloques");
  const efectos = document.getElementById("capa-efectos");

  let config = null;
  let pausado = false, reducido = false;
  const fondo = { clave: "", el: null, motor: null, tipo: "", paletaClave: "" };
  L.depurar = { fondo }; // para medir y probar desde herramientas/cdp.js

  // ---------------- Fondo ----------------
  function claveFondo(c) {
    const f = c.fondo || {}, r = c.rendimiento || {};
    return JSON.stringify([f.activo, f.tipo, f.escena, f.archivo, f.carpeta, f.color, f.ajuste,
      f.tipo === "escena" ? (f.opciones || {})[f.escena] : null, r.calidad]);
  }

  async function ponerFondo() {
    const f = config.fondo || {};
    const clave = claveFondo(config);
    if (clave === fondo.clave) { ajustarFondo(); return; }
    fondo.clave = clave;
    const anterior = { el: fondo.el, motor: fondo.motor };
    fondo.el = null; fondo.motor = null; fondo.tipo = f.tipo;
    let el;
    try {
      if (f.tipo === "escena") {
        await L.cargar(`escenas/${f.escena}.js`);
        const def = L.escenas[f.escena];
        if (!def) throw new Error("No existe la escena " + f.escena);
        el = document.createElement("canvas");
        el.className = "fondo";
        capaFondo.appendChild(el);
        fondo.motor = new L.MotorEscena(el, def, (f.opciones || {})[f.escena], ajustesMotor());
        if (pausado) fondo.motor.pausar(true);
      } else if (f.tipo === "video") {
        el = document.createElement("video");
        Object.assign(el, { muted: true, loop: true, autoplay: !pausado, playsInline: true, preload: "auto" });
        el.setAttribute("muted", "");
        el.src = DATOS + encodeURI(f.archivo || "");
        el.className = "fondo";
        el.addEventListener("error", () => P.log("No se pudo reproducir el video " + f.archivo));
        capaFondo.appendChild(el);
      } else if (f.tipo === "imagen") {
        el = document.createElement("img");
        el.src = DATOS + encodeURI(f.archivo || "");
        el.className = "fondo";
        el.decoding = "async";
        capaFondo.appendChild(el);
      } else if (f.tipo === "html") {
        el = document.createElement("iframe");
        el.src = DATOS + "escenas/" + encodeURIComponent(f.carpeta || "") + "/index.html";
        el.className = "fondo";
        el.setAttribute("sandbox", "allow-scripts");
        el.addEventListener("load", () => avisarEscenaPropia());
        capaFondo.appendChild(el);
      } else {
        el = document.createElement("div");
        el.className = "fondo";
        capaFondo.appendChild(el);
      }
    } catch (e) {
      P.log(e.message);
      el = document.createElement("div");
      el.className = "fondo";
      el.style.background = "radial-gradient(circle at 30% 30%, #2a1d4a, #0c0a14)";
      capaFondo.appendChild(el);
    }
    fondo.el = el;
    ajustarFondo();
    // Transición: se espera a que el nuevo fondo tenga algo que mostrar (imagen decodificada, primer cuadro del video…).
    const tr = anterior.el && !EDITANDO && !pausado ? f.transicion || "fundido" : "fundido"; // en pausa no se ve: sin animación
    await listoParaMostrar(el);
    const quitarAnterior = (ms) => setTimeout(() => {
      if (anterior.motor) anterior.motor.destruir();
      if (anterior.el) anterior.el.remove();
    }, ms);
    if (fondo.el !== el) { quitarAnterior(800); return; } // mientras esperábamos llegó otro fondo
    if (tr === "fundido") requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("visible")));
    else {
      el.style.setProperty("--tx", (parallax.x * 100).toFixed(1) + "%");
      el.style.setProperty("--ty", (parallax.y * 100).toFixed(1) + "%");
      el.addEventListener("animationend", () => el.classList.remove("entrar-" + tr), { once: true });
      el.classList.add("visible", "entrar-" + tr);
    }
    quitarAnterior(tr === "fundido" ? 800 : 1500);
    programarPaleta();
  }

  function listoParaMostrar(el) {
    const tope = new Promise((r) => setTimeout(r, 1500));
    let listo;
    if (el.tagName === "IMG") listo = el.decode().catch(() => {});
    else if (el.tagName === "VIDEO") listo = el.readyState >= 2 ? Promise.resolve() : new Promise((r) => { el.addEventListener("loadeddata", r, { once: true }); el.addEventListener("error", r, { once: true }); });
    else if (el.tagName === "IFRAME") listo = new Promise((r) => el.addEventListener("load", r, { once: true }));
    else listo = new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return Promise.race([listo, tope]);
  }

  function ajustesMotor() {
    const r = config.rendimiento || {};
    return { fps: reducido ? Math.min(15, r.fps || 24) : r.fps || 24, calidad: r.calidad || 0.75, paleta: (config.paleta || {}).colores || {} };
  }

  // Cosas que cambian sin recrear el fondo: efectos, velocidad, ajuste, color.
  function ajustarFondo() {
    const f = config.fondo || {}, e = f.efectos || {};
    const el = fondo.el;
    if (el) {
      el.classList.remove("ajuste-cubrir", "ajuste-contener", "ajuste-estirar", "ajuste-centrar");
      el.classList.add("ajuste-" + (f.ajuste || "cubrir"));
      if (f.tipo === "video") el.playbackRate = Number(f.velocidad) || 1;
      if (f.tipo === "color" || !f.tipo) el.style.background = f.color || "#14111f";
      if (f.activo === false) el.style.background = "#000";
    }
    if (fondo.motor) fondo.motor.cambiarAjustes(ajustesMotor());
    const filtros = [];
    if (e.desenfoque > 0) filtros.push(`blur(${e.desenfoque}px)`);
    if (e.saturacion != null && e.saturacion !== 100) filtros.push(`saturate(${e.saturacion}%)`);
    if (e.brillo != null && e.brillo !== 100) filtros.push(`brightness(${e.brillo}%)`);
    capaFondo.style.filter = filtros.join(" ");
    capaFondo.style.inset = e.desenfoque > 0 ? `-${Math.ceil(e.desenfoque * 2)}px` : "0";
    efectos.querySelector(".oscurecer").style.opacity = (e.oscurecer || 0) / 100;
    efectos.querySelector(".vineta").style.opacity = (e.vineta || 0) / 100;
    const grano = efectos.querySelector(".grano");
    grano.style.opacity = ((e.grano || 0) / 100) * 0.5;
    if (e.grano > 0 && !grano.style.backgroundImage) grano.style.backgroundImage = `url(${texturaGrano()})`;
    parallax.fuerza = Number(e.parallax) || 0;
    aplicarParallax();
  }

  function texturaGrano() {
    const c = document.createElement("canvas");
    c.width = c.height = 220;
    const g = c.getContext("2d");
    const img = g.createImageData(220, 220);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c.toDataURL();
  }

  // Parallax para imágenes y videos (las escenas lo hacen por su cuenta con el ratón).
  const parallax = { fuerza: 0, x: 0.5, y: 0.5 };
  function aplicarParallax() {
    const p = parallax.fuerza;
    if (!p || fondo.tipo === "escena") { capaFondo.style.transform = ""; return; }
    const dx = (0.5 - parallax.x) * 40 * p, dy = (0.5 - parallax.y) * 26 * p;
    capaFondo.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) scale(${1 + 0.05 * p})`;
  }

  P.on("mouse", (m) => {
    if (fondo.motor) fondo.motor.ponerMouse(m.x, m.y);
    parallax.x = m.x; parallax.y = m.y;
    if (parallax.fuerza) aplicarParallax();
    if (fondo.tipo === "html" && fondo.el) fondo.el.contentWindow.postMessage({ tipo: "lienzo-mouse", x: m.x, y: m.y }, "*");
  });

  // Android: al deslizar entre las páginas de la pantalla de inicio (x de 0 a 1) el fondo se mueve un poco.
  P.on("desplazar", (m) => {
    if (fondo.motor) fondo.motor.ponerMouse(m.x, m.y);
    parallax.x = m.x; parallax.y = m.y;
    if (parallax.fuerza) aplicarParallax();
  });

  function avisarEscenaPropia() {
    if (fondo.tipo !== "html" || !fondo.el) return;
    const w = fondo.el.contentWindow;
    w.postMessage({ tipo: "lienzo-paleta", colores: (config.paleta || {}).colores }, "*");
    w.postMessage({ tipo: "lienzo-pausa", pausado }, "*");
  }

  // ---------------- Pausa (cuando el fondo está tapado, con batería, etc.) ----------------
  P.on("pausa", (m) => {
    const antesReducido = reducido;
    pausado = !!m.pausado;
    reducido = !!m.reducido;
    document.body.classList.toggle("pausado", pausado);
    document.body.classList.toggle("reducido", reducido);
    if (fondo.motor) {
      fondo.motor.pausar(pausado);
      if (antesReducido !== reducido) fondo.motor.cambiarAjustes(ajustesMotor());
    }
    if (fondo.tipo === "video" && fondo.el) { if (pausado) fondo.el.pause(); else fondo.el.play().catch(() => {}); }
    if (fondo.tipo === "html") avisarEscenaPropia();
    L.reloj.pausar(pausado);
  });

  // ---------------- Paleta automática (como pywal) ----------------
  let tPaleta = 0;
  function programarPaleta() {
    clearTimeout(tPaleta);
    if (!PRINCIPAL || EDITANDO || !config || (config.paleta || {}).modo !== "auto") return;
    tPaleta = setTimeout(calcularPaleta, fondo.tipo === "escena" ? 1500 : 300);
  }

  function calcularPaleta() {
    const f = config.fondo || {};
    let roles = null;
    try {
      const def = f.tipo === "escena" && L.escenas[f.escena];
      if (def && def.paleta) {
        // Las escenas incluidas traen colores pensados para ellas; si eliges un color en sus opciones, ese es el acento.
        roles = Object.assign({}, (config.paleta || {}).colores, def.paleta);
        const opColor = (def.opciones || []).find((o) => o.tipo === "color");
        const elegido = opColor && ((f.opciones || {})[f.escena] || {})[opColor.id];
        if (elegido && elegido !== opColor.valor) roles.acento = elegido;
      } else if (f.tipo === "escena" && fondo.motor) {
        roles = L.tema.rolesDesdeColores(L.tema.dominantesDeCanvas(fondo.motor.muestra(64), 8));
      } else if (f.tipo === "video" || f.tipo === "imagen") {
        const entrada = (config.biblioteca || []).find((b) => b.archivo === f.archivo);
        if (entrada && entrada.dominantes && entrada.dominantes.length) roles = L.tema.rolesDesdeColores(entrada.dominantes);
      }
    } catch (e) { P.log("Paleta: " + e.message); }
    if (!roles) return;
    const clave = JSON.stringify(roles);
    if (clave === fondo.paletaClave) return;
    fondo.paletaClave = clave;
    P.enviar("paletaCalculada", { colores: roles });
  }

  // ---------------- Bloques ----------------
  const bloques = new Map();
  const cssInyectado = new Set();
  let claveBloques = "";
  let lista = [];

  function inyectarCss(def) {
    if (!def.css || cssInyectado.has(def.tipo)) return;
    cssInyectado.add(def.tipo);
    const s = document.createElement("style");
    s.textContent = def.css;
    document.head.appendChild(s);
  }

  async function ponerBloques(forzar) {
    const fuente = EDITANDO && edicion.lista ? edicion.lista : config.bloques || [];
    const clave = JSON.stringify([fuente, (config.general || {}).nombre, config.rice, (config.estilo || {}).fuente]);
    if (clave === claveBloques && !forzar) {
      bloques.forEach((x) => emitirA(x, "config", config));
      return;
    }
    claveBloques = clave;
    lista = fuente;
    const tipos = Array.from(new Set(lista.map((b) => b.tipo)));
    await Promise.all(tipos.map((t) => L.cargar(`bloques/${t}.js`).catch((e) => P.log(e.message))));
    bloques.forEach((x) => destruirBloque(x));
    bloques.clear();
    lista.forEach((b) => crearBloque(b));
    if (EDITANDO) marcarSeleccion();
    requestAnimationFrame(acomodarDentro);
  }

  function crearBloque(b) {
    const def = L.bloques[b.tipo];
    if (!def) return;
    inyectarCss(def);
    const o = L.opcionesDeBloque(def, b.opciones);
    const caja = document.createElement("div");
    caja.className = `bloque fondo-${o.fondo} alinear-${o.alinear} fuente-${o.fuente} color-${o.color}`;
    caja.dataset.id = b.id;
    const contenido = document.createElement("div");
    contenido.className = "bloque-contenido";
    caja.appendChild(contenido);
    capaBloques.appendChild(caja);
    posicionar(caja, b, o);
    const x = { b, def, caja, o, oyentes: {}, inst: {} };
    const ctx = {
      opciones: o, config, editando: EDITANDO,
      on(ev, fn) { (x.oyentes[ev] = x.oyentes[ev] || []).push(fn); },
    };
    try { x.inst = def.crear(contenido, ctx) || {}; } catch (e) {
      contenido.innerHTML = `<span class="error">No se pudo mostrar «${L.escapar(def.nombre)}»</span>`;
      P.log(`Bloque ${b.tipo}: ${e.message}`);
    }
    if (EDITANDO) {
      caja.insertAdjacentHTML("beforeend", `<span class="tirador quitar" title="Quitar">${L.icono("cerrar")}</span><span class="tirador tamano" title="Tamaño"></span>`);
    }
    bloques.set(b.id, x);
    return x;
  }

  function destruirBloque(x) {
    try { if (x.inst.destruir) x.inst.destruir(); } catch (e) { console.error(e); }
    x.caja.remove();
  }

  function posicionar(caja, b, o) {
    const ancla = o.alinear === "centro" ? -50 : o.alinear === "derecha" ? -100 : 0;
    caja.style.left = `${(Number(b.x) || 0) * 100}%`;
    caja.style.top = `${(Number(b.y) || 0) * 100}%`;
    caja.style.transformOrigin = `${o.alinear === "centro" ? "center" : o.alinear === "derecha" ? "right" : "left"} top`;
    caja.style.transform = `translateX(${ancla}%) scale(${Number(b.escala) || 1})`;
  }

  // Si un bloque se sale de la pantalla (p. ej. en otra resolución), se mete sin cambiar la configuración.
  function acomodarDentro() {
    if (EDITANDO) return;
    const m = 8;
    bloques.forEach((x) => {
      x.caja.style.marginLeft = x.caja.style.marginTop = "0px";
      const r = x.caja.getBoundingClientRect();
      let dx = 0, dy = 0;
      if (r.right > innerWidth - m) dx = innerWidth - m - r.right;
      if (r.left + dx < m) dx = m - r.left;
      if (r.bottom > innerHeight - m) dy = innerHeight - m - r.bottom;
      if (r.top + dy < m) dy = m - r.top;
      x.caja.style.marginLeft = dx + "px";
      x.caja.style.marginTop = dy + "px";
    });
  }
  addEventListener("resize", () => { clearTimeout(acomodarDentro.t); acomodarDentro.t = setTimeout(acomodarDentro, 150); });

  function emitirA(x, ev, datos) {
    (x.oyentes[ev] || []).forEach((f) => { try { f(datos); } catch (e) { console.error(e); } });
  }
  // ---------------- Toques en los widgets ----------------
  // Lienzo.exe avisa de los clics que caen en el escritorio (x, y entre 0 y 1). Se busca el elemento
  // tocable más pequeño en ese punto (un botón dentro de una tarjeta gana a la tarjeta).
  function tocableEn(fx, fy) {
    const x = fx * innerWidth, y = fy * innerHeight;
    let mejor = null, area = Infinity;
    capaBloques.querySelectorAll("[data-toque]").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (!r.width || x < r.left || x > r.right || y < r.top || y > r.bottom) return;
      if (r.width * r.height < area) { mejor = el; area = r.width * r.height; }
    });
    return mejor;
  }
  P.on("toque", (m) => {
    if (EDITANDO) return;
    const el = tocableEn(m.x, m.y);
    if (!el) return;
    el.classList.remove("lz-pulsado");
    void el.offsetWidth; // reinicia la animación
    el.classList.add("lz-pulsado");
    setTimeout(() => el.classList.remove("lz-pulsado"), 350);
    el.click();
  });
  let encima = null;
  P.on("mouse", (m) => {
    if (EDITANDO) return;
    const el = tocableEn(m.x, m.y);
    if (el === encima) return;
    if (encima) encima.classList.remove("lz-encima");
    encima = el;
    if (el) el.classList.add("lz-encima");
  });

  ["sistema", "musica", "ficha"].forEach((ev) => P.on(ev, () => {
    if (pausado && ev !== "ficha") return;
    bloques.forEach((x) => emitirA(x, ev, L.datos[ev]));
    if (ev === "musica") requestAnimationFrame(acomodarDentro);
  }));

  // ---------------- Configuración ----------------
  if (P.android) document.body.classList.add("movil");
  P.on("config", (m) => {
    config = m.config || {};
    // En el celular, si aún no abriste la app (pusiste el fondo desde los ajustes de Android), llega la de fábrica.
    if (P.android && !config.movil && L.movil) config = L.movil.adaptar(config);
    L.tema.aplicar(config);
    if (EDITANDO && !edicion.lista) edicion.empezar(config.bloques || []);
    ponerFondo();
    ponerBloques(false);
    programarPaleta();
  });

  // ================= Modo edición =================
  const edicion = {
    lista: null,
    historial: [],
    seleccion: null,
    empezar(bloquesIniciales) {
      this.lista = L.clonar(bloquesIniciales);
      this.historial = [];
      document.body.classList.add("editando");
      const ed = document.getElementById("editor");
      ed.hidden = false;
      ed.querySelector(".marca").innerHTML = L.icono("lienzo");
      ed.querySelector('[data-accion="anadir"]').innerHTML = `${L.icono("mas")} Añadir bloque`;
      ed.querySelector('[data-accion="deshacer"]').innerHTML = L.icono("deshacer");
      ed.querySelector('[data-accion="listo"]').innerHTML = `${L.icono("check")} Listo`;
      actualizarDeshacer();
    },
  };

  function guardarHistorial() {
    edicion.historial.push(JSON.stringify(edicion.lista));
    if (edicion.historial.length > 60) edicion.historial.shift();
    actualizarDeshacer();
  }
  function actualizarDeshacer() {
    const b = document.querySelector('[data-accion="deshacer"]');
    if (b) b.disabled = !edicion.historial.length;
  }
  function deshacer() {
    if (!edicion.historial.length) return;
    edicion.lista = JSON.parse(edicion.historial.pop());
    if (edicion.seleccion && !edicion.lista.some((b) => b.id === edicion.seleccion)) edicion.seleccion = null;
    actualizarDeshacer();
    ponerBloques(true).then(pintarInspector);
  }

  function bloqueDe(id) { return edicion.lista.find((b) => b.id === id); }

  function seleccionar(id) {
    edicion.seleccion = id;
    marcarSeleccion();
    pintarInspector();
  }
  function marcarSeleccion() {
    bloques.forEach((x, id) => x.caja.classList.toggle("seleccionado", id === edicion.seleccion));
  }

  // Arrastrar y cambiar tamaño con el puntero
  let gesto = null;
  if (EDITANDO) {
    capaBloques.addEventListener("pointerdown", (e) => {
      const caja = e.target.closest(".bloque");
      if (!caja) { seleccionar(null); return; }
      const id = caja.dataset.id, x = bloques.get(id), b = bloqueDe(id);
      if (!x || !b) return;
      e.preventDefault();
      if (e.target.closest(".tirador.quitar")) { quitarBloque(id); return; }
      seleccionar(id);
      guardarHistorial();
      const r = caja.getBoundingClientRect();
      gesto = {
        id, b, x, tipo: e.target.closest(".tirador.tamano") ? "tamano" : "mover",
        inicioX: e.clientX, inicioY: e.clientY, rect: r, escala: Number(b.escala) || 1, movido: false,
      };
      try { caja.setPointerCapture(e.pointerId); } catch (err) { /* puntero sintético (pruebas) */ }
      caja.classList.add("arrastrando");
    });
    capaBloques.addEventListener("pointermove", (e) => {
      if (!gesto) return;
      const dx = e.clientX - gesto.inicioX, dy = e.clientY - gesto.inicioY;
      if (Math.abs(dx) + Math.abs(dy) > 2) gesto.movido = true;
      const { b, x, rect } = gesto;
      if (gesto.tipo === "tamano") {
        const base = Math.max(40, rect.width);
        b.escala = Math.round(Math.max(0.4, Math.min(3, gesto.escala * (base + dx) / base)) * 100) / 100;
        posicionar(x.caja, b, x.o);
        return;
      }
      // Nueva posición del borde izquierdo, con imán a la rejilla de 8 px y al centro de la pantalla.
      let izq = rect.left + dx, arr = rect.top + dy;
      const ancho = rect.width, alto = rect.height;
      if (!e.altKey) { izq = Math.round(izq / 8) * 8; arr = Math.round(arr / 8) * 8; }
      const guiaV = document.querySelector(".guia-v"), guiaH = document.querySelector(".guia-h");
      const centroX = izq + ancho / 2, centroY = arr + alto / 2;
      guiaV.hidden = Math.abs(centroX - innerWidth / 2) > 10;
      guiaH.hidden = Math.abs(centroY - innerHeight / 2) > 10;
      if (!guiaV.hidden) izq = innerWidth / 2 - ancho / 2;
      if (!guiaH.hidden) arr = innerHeight / 2 - alto / 2;
      izq = Math.max(-ancho * 0.5, Math.min(innerWidth - ancho * 0.5, izq));
      arr = Math.max(0, Math.min(innerHeight - alto * 0.3, arr));
      const anclaX = x.o.alinear === "centro" ? izq + ancho / 2 : x.o.alinear === "derecha" ? izq + ancho : izq;
      b.x = Math.round((anclaX / innerWidth) * 10000) / 10000;
      b.y = Math.round((arr / innerHeight) * 10000) / 10000;
      posicionar(x.caja, b, x.o);
    });
    const soltar = () => {
      if (!gesto) return;
      gesto.x.caja.classList.remove("arrastrando");
      if (!gesto.movido) edicion.historial.pop(), actualizarDeshacer();
      gesto = null;
      document.querySelectorAll(".guia").forEach((g) => (g.hidden = true));
      pintarInspector();
    };
    capaBloques.addEventListener("pointerup", soltar);
    capaBloques.addEventListener("pointercancel", soltar);

    document.getElementById("editor").addEventListener("click", (e) => {
      const b = e.target.closest("[data-accion]");
      if (!b) return;
      const a = b.dataset.accion;
      if (a === "listo") P.enviar("guardarBloques", { bloques: edicion.lista });
      else if (a === "cancelar") P.enviar("cerrarEditor");
      else if (a === "deshacer") deshacer();
      else if (a === "anadir") abrirCatalogo();
      else if (a === "cerrar-catalogo") cerrarCatalogo();
      else if (a === "quitar-sel" && edicion.seleccion) quitarBloque(edicion.seleccion);
      else if (a === "duplicar" && edicion.seleccion) duplicar(edicion.seleccion);
    });

    addEventListener("keydown", (e) => {
      if (e.target.closest("input, textarea, select")) return;
      const id = edicion.seleccion, b = id && bloqueDe(id);
      if ((e.key === "Delete" || e.key === "Backspace") && id) { quitarBloque(id); e.preventDefault(); }
      else if (e.key === "Escape") {
        if (!document.querySelector(".catalogo").hidden) cerrarCatalogo();
        else if (id) seleccionar(null);
        else P.enviar("cerrarEditor");
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { deshacer(); e.preventDefault(); }
      else if (b && e.key.startsWith("Arrow")) {
        guardarHistorial();
        const paso = e.shiftKey ? 10 : 1;
        if (e.key === "ArrowLeft") b.x -= paso / innerWidth;
        if (e.key === "ArrowRight") b.x += paso / innerWidth;
        if (e.key === "ArrowUp") b.y -= paso / innerHeight;
        if (e.key === "ArrowDown") b.y += paso / innerHeight;
        const x = bloques.get(id);
        posicionar(x.caja, b, x.o);
        e.preventDefault();
      }
    });
  }

  function quitarBloque(id) {
    guardarHistorial();
    edicion.lista = edicion.lista.filter((b) => b.id !== id);
    const x = bloques.get(id);
    if (x) { destruirBloque(x); bloques.delete(id); }
    if (edicion.seleccion === id) edicion.seleccion = null;
    claveBloques = "";
    pintarInspector();
  }

  function nuevoId(tipo) {
    let n = 1;
    while (edicion.lista.some((b) => b.id === `${tipo}-${n}`)) n++;
    return `${tipo}-${n}`;
  }

  function duplicar(id) {
    const b = bloqueDe(id);
    if (!b) return;
    guardarHistorial();
    const c = L.clonar(b);
    c.id = nuevoId(b.tipo);
    c.x = Math.min(0.95, b.x + 0.02);
    c.y = Math.min(0.95, b.y + 0.03);
    edicion.lista.push(c);
    ponerBloques(true).then(() => seleccionar(c.id));
  }

  function anadirBloque(tipo, opciones) {
    guardarHistorial();
    // En cascada, para que un bloque nuevo no quede justo encima de otro recién añadido.
    let x = 0.4, y = 0.38;
    while (edicion.lista.some((b) => Math.abs(b.x - x) < 0.01 && Math.abs(b.y - y) < 0.01) && y < 0.8) { x += 0.025; y += 0.04; }
    const nuevo = { id: nuevoId(tipo), tipo, x, y, escala: 1, opciones: opciones || {} };
    edicion.lista.push(nuevo);
    ponerBloques(true).then(() => seleccionar(nuevo.id));
  }

  // Al elegir una app en «Widgets de tus apps»: las que tienen widget especial lo usan; las demás, un acceso con su icono.
  const MUSICA = [[/spotify/i, "Spotify"], [/apple music/i, "Apple Music"], [/deezer/i, "Deezer"], [/tidal/i, "TIDAL"], [/amazon music/i, "Amazon Music"]];
  function bloqueParaApp(a) {
    const app = { nombre: a.nombre, clave: a.clave, destino: a.destino };
    const musica = MUSICA.find(([re]) => re.test(a.nombre));
    if (musica) return { tipo: "musica", opciones: { estilo: "tarjeta", controles: true, soloDe: musica[1], app } };
    if (/whatsapp/i.test(a.nombre)) return { tipo: "whatsapp", opciones: { app } };
    if (/^(clima|weather|el tiempo|msn el tiempo|msn weather)$/i.test(a.nombre.trim())) return { tipo: "clima", opciones: { app } };
    return { tipo: "app", opciones: { app } };
  }

  // Apps instaladas (las de «Todas las apps» del menú Inicio).
  let apps = null, alElegirApp = null;
  P.on("apps", (m) => { apps = m.lista || []; pintarApps(); });

  function pintarApps() {
    const caja = document.querySelector(".catalogo");
    const rejilla = caja.querySelector(".apps-rejilla");
    if (!apps) { rejilla.innerHTML = '<div class="vacio">Cargando tus apps…</div>'; return; }
    const filtro = (caja.querySelector(".buscar-app").value || "").trim().toLowerCase();
    const lista = apps.filter((a) => !filtro || a.nombre.toLowerCase().includes(filtro)).slice(0, 150);
    rejilla.innerHTML = lista.length ? lista.map((a, i) => {
      const especial = !alElegirApp && bloqueParaApp(a).tipo !== "app";
      return `<button class="app-opcion" data-i="${i}" title="${L.escapar(a.nombre)}">
        <span class="app-ic" style="--tono:${L.tonoDe(a.nombre)}">${L.escapar(L.inicial(a.nombre))}</span>
        <span class="app-nombre">${L.escapar(a.nombre)}</span>${especial ? '<i class="app-especial">widget</i>' : ""}</button>`;
    }).join("") : '<div class="vacio">No encontré ninguna app con ese nombre.</div>';
    rejilla.querySelectorAll(".app-opcion").forEach((btn) => {
      const a = lista[Number(btn.dataset.i)];
      L.iconoApp(a.clave, 48, (url) => {
        if (!url || !btn.isConnected) return;
        const ic = btn.querySelector(".app-ic");
        ic.textContent = "";
        ic.classList.add("con-imagen");
        ic.style.backgroundImage = `url("${url}")`;
      });
    });
    rejilla.onclick = (e) => {
      const btn = e.target.closest(".app-opcion");
      if (!btn) return;
      const a = lista[Number(btn.dataset.i)];
      if (alElegirApp) { const f = alElegirApp; cerrarCatalogo(); f({ nombre: a.nombre, clave: a.clave, destino: a.destino }); return; }
      cerrarCatalogo();
      const b = bloqueParaApp(a);
      anadirBloque(b.tipo, b.opciones);
    };
  }

  function mostrarCatalogo(soloApps, titulo) {
    const caja = document.querySelector(".catalogo");
    caja.classList.toggle("solo-apps", !!soloApps);
    caja.querySelector("h2").textContent = titulo || "Añadir un bloque";
    const buscar = caja.querySelector(".buscar-app");
    buscar.value = "";
    buscar.oninput = pintarApps;
    caja.hidden = false;
    if (!apps) P.enviar("pedirApps");
    pintarApps();
    if (soloApps) setTimeout(() => buscar.focus(), 30);
  }

  function cerrarCatalogo() {
    document.querySelector(".catalogo").hidden = true;
    alElegirApp = null;
  }

  // Para las opciones de tipo "app"/"apps" del inspector.
  function elegirApp(titulo) {
    return new Promise((ok) => {
      alElegirApp = ok;
      mostrarCatalogo(true, titulo || "Elige una app");
    });
  }

  async function abrirCatalogo() {
    const tipos = L.listaBloques || [];
    await Promise.all(tipos.map((t) => L.cargar(`bloques/${t}.js`).catch(() => {})));
    const caja = document.querySelector(".catalogo");
    caja.querySelector(".catalogo-lista").innerHTML = tipos.filter((t) => L.bloques[t]).map((t) => {
      const d = L.bloques[t];
      return `<button class="tarjeta-bloque" data-tipo="${t}">${L.icono(d.icono || "bloques")}<b>${L.escapar(d.nombre)}</b><span>${L.escapar(d.descripcion || "")}</span></button>`;
    }).join("");
    alElegirApp = null;
    mostrarCatalogo(false);
    caja.querySelector(".catalogo-lista").onclick = (e) => {
      const t = e.target.closest("[data-tipo]");
      if (!t) return;
      cerrarCatalogo();
      anadirBloque(t.dataset.tipo, {});
    };
  }

  // Inspector: opciones del bloque seleccionado (se generan con la lista de opciones de cada tipo).
  function pintarInspector() {
    if (!EDITANDO) return;
    const ins = document.querySelector(".inspector");
    const b = edicion.seleccion && bloqueDe(edicion.seleccion);
    const def = b && L.bloques[b.tipo];
    if (!b || !def) { ins.hidden = true; return; }
    ins.hidden = false;
    const o = L.opcionesDeBloque(def, b.opciones);
    const campos = (def.opciones || []).map((op) => campo(op, o[op.id])).join("");
    const comunes = L.opcionesComunes.map((op) => campo(op, o[op.id])).join("");
    ins.innerHTML = `<h3>${L.icono(def.icono || "bloques")} ${L.escapar(def.nombre)}</h3><p class="desc">${L.escapar(def.descripcion || "")}</p>
      ${campos}<div class="sep"></div>${comunes}
      ${campo({ id: "__escala", nombre: "Tamaño", tipo: "rango", min: 0.4, max: 3, paso: 0.05 }, Number(b.escala) || 1)}
      <div class="sep"></div>
      <div style="display:flex; gap:8px"><button class="btn" data-accion="duplicar">${L.icono("capas")} Duplicar</button>
      <button class="btn" data-accion="quitar-sel">${L.icono("papelera")} Quitar</button></div>`;
    ins.querySelectorAll("[data-op]").forEach((el) => {
      const evento = el.matches("input[type=text], textarea") ? "change" : "input";
      el.addEventListener(evento, () => cambiarOpcion(b, el.dataset.op, leerCampo(el)));
    });
    ins.querySelectorAll("[data-elegir-app]").forEach((btn) => btn.addEventListener("click", async () => {
      const a = await elegirApp();
      if (a) cambiarOpcion(b, btn.dataset.elegirApp, a, true);
    }));
    ins.querySelectorAll("[data-anadir-app]").forEach((btn) => btn.addEventListener("click", async () => {
      const a = await elegirApp("Añade una app");
      const op = btn.dataset.anadirApp;
      if (a) cambiarOpcion(b, op, (Array.isArray(o[op]) ? o[op] : []).concat([a]), true);
    }));
    ins.querySelectorAll("[data-quitar-app]").forEach((btn) => btn.addEventListener("click", () => {
      const op = btn.dataset.quitarApp;
      cambiarOpcion(b, op, (Array.isArray(o[op]) ? o[op] : []).filter((_, i) => i !== Number(btn.dataset.i)), true);
    }));
    ins.querySelectorAll(".segmentos").forEach((seg) => seg.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      seg.querySelectorAll("button").forEach((x) => x.classList.toggle("activo", x === btn));
      cambiarOpcion(b, seg.dataset.op, btn.dataset.valor);
    }));
  }

  function campo(op, valor) {
    const id = L.escapar(op.id), nombre = L.escapar(op.nombre);
    if (op.tipo === "si-no") return `<div class="campo"><label class="interruptor">${nombre}<input type="checkbox" data-op="${id}" ${valor ? "checked" : ""}></label></div>`;
    if (op.tipo === "lista" && op.opciones.length <= 3) {
      return `<div class="campo"><label>${nombre}</label><div class="segmentos" data-op="${id}">${op.opciones.map(([v, t]) =>
        `<button data-valor="${L.escapar(v)}" class="${String(v) === String(valor) ? "activo" : ""}">${L.escapar(t)}</button>`).join("")}</div></div>`;
    }
    if (op.tipo === "lista") {
      return `<div class="campo"><label>${nombre}</label><select data-op="${id}">${op.opciones.map(([v, t]) =>
        `<option value="${L.escapar(v)}" ${String(v) === String(valor) ? "selected" : ""}>${L.escapar(t)}</option>`).join("")}</select></div>`;
    }
    if (op.tipo === "rango") {
      return `<div class="campo"><label>${nombre}</label><div class="fila-rango"><input type="range" data-op="${id}" min="${op.min}" max="${op.max}" step="${op.paso || 1}" value="${valor}">
        <output>${valor}</output></div></div>`;
    }
    if (op.tipo === "color") return `<div class="campo"><label>${nombre}</label><input type="color" data-op="${id}" value="${L.escapar(valor)}"></div>`;
    if (op.tipo === "texto") return `<div class="campo"><label>${nombre}</label><input type="text" data-op="${id}" value="${L.escapar(valor || "")}" placeholder="${L.escapar(op.ejemplo || "")}"></div>`;
    if (op.tipo === "app") {
      return `<div class="campo"><label>${nombre}</label><button class="btn ancho" data-elegir-app="${id}">${valor && valor.nombre
        ? `${L.escapar(valor.nombre)} <small>· cambiar</small>` : `${L.icono("apps")} Elegir una app`}</button></div>`;
    }
    if (op.tipo === "apps") {
      const lista = Array.isArray(valor) ? valor : [];
      return `<div class="campo"><label>${nombre}</label><div class="fichas-apps">${lista.map((a, i) =>
        `<span class="ficha-app">${L.escapar(a.nombre)}<button title="Quitar" data-quitar-app="${id}" data-i="${i}">${L.icono("cerrar")}</button></span>`).join("")}
        ${lista.length < (op.max || 12) ? `<button class="btn" data-anadir-app="${id}">${L.icono("mas")} Añadir app</button>` : ""}</div></div>`;
    }
    if (op.ayuda) return `<div class="campo"><label>${nombre}</label><textarea data-op="${id}" rows="3" placeholder="${L.escapar(op.ejemplo || "")}">${L.escapar(valor || "")}</textarea><p class="ayuda-campo">${L.escapar(op.ayuda)}</p></div>`;
    return `<div class="campo"><label>${nombre}</label><textarea data-op="${id}" rows="2">${L.escapar(valor || "")}</textarea></div>`;
  }

  function leerCampo(el) {
    if (el.type === "checkbox") return el.checked;
    if (el.type === "range") { const v = Number(el.value); const out = el.parentElement.querySelector("output"); if (out) out.textContent = v; return v; }
    return el.value;
  }

  let tCambio = 0;
  function cambiarOpcion(b, op, valor, repintar) {
    clearTimeout(tCambio);
    tCambio = setTimeout(() => {
      guardarHistorial();
      if (op === "__escala") {
        b.escala = valor;
        const x = bloques.get(b.id);
        if (x) posicionar(x.caja, b, x.o);
        return;
      }
      const antes = bloques.get(b.id);
      const rect = antes ? antes.caja.getBoundingClientRect() : null;
      b.opciones = Object.assign({}, b.opciones, { [op]: valor });
      // Al cambiar la alineación, el bloque se queda donde estaba (cambia su punto de anclaje).
      if (op === "alinear" && rect) b.x = (valor === "centro" ? rect.left + rect.width / 2 : valor === "derecha" ? rect.right : rect.left) / innerWidth;
      ponerBloques(true).then(() => { marcarSeleccion(); if (repintar) pintarInspector(); });
    }, op === "__escala" ? 0 : 120);
  }

  P.enviar("listo", { pagina: EDITANDO ? "editor" : "fondo" });
})();

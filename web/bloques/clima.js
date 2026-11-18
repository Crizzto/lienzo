// Widget del clima. Datos de Open-Meteo (gratis y sin cuenta): primero se busca la ciudad y luego el pronóstico.
// Se guarda 30 minutos (también entre reinicios) para no pedirlo de más.
(function () {
  "use strict";
  const L = window.Lienzo;
  const MINUTOS = 30;

  // ---- Iconos del clima (mismo estilo que comun/iconos.js: 24×24, trazo de 2 px) ----
  const NUBE = '<path d="M7 19h10.5a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.6 12.1 3.5 3.5 0 0 0 7 19z"/>';
  const nubeArriba = (resto) => `<g transform="translate(0 -3.5)">${NUBE}</g>${resto}`;
  const nubeChica = '<g transform="translate(5 4) scale(.8)"><path vector-effect="non-scaling-stroke" d="M7 19h10.5a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.6 12.1 3.5 3.5 0 0 0 7 19z"/></g>';
  const SVG = {
    sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
    luna: '<path d="M20 14.6A8.3 8.3 0 1 1 9.4 4a6.6 6.6 0 0 0 10.6 10.6z"/>',
    solNube: '<circle cx="7.5" cy="7.5" r="3"/><path d="M7.5 2v1.2M2 7.5h1.2M3.6 3.6l.85.85M11.4 3.6l-.85.85M3.6 11.4l.85-.85"/>' + nubeChica,
    lunaNube: '<g transform="translate(1 1) scale(.5)"><path vector-effect="non-scaling-stroke" d="M20 14.6A8.3 8.3 0 1 1 9.4 4a6.6 6.6 0 0 0 10.6 10.6z"/></g>' + nubeChica,
    nube: NUBE,
    niebla: '<path d="M4 8h16M6 12h12M4 16h16M8 20h8"/>',
    llovizna: nubeArriba('<path d="M8 19v.8M12 20v.8M16 19v.8"/>'),
    lluvia: nubeArriba('<path d="M8.5 18l-1.2 3M12.5 18l-1.2 3M16.5 18l-1.2 3"/>'),
    nieve: nubeArriba('<path d="M8 19h.01M12 20.5h.01M16 19h.01M10 22h.01M14 22h.01"/>'),
    tormenta: nubeArriba('<path d="M13 16.5l-2.5 3.5h3l-2.5 3.5"/>'),
  };
  const icono = (n, clase) => `<svg class="ic ${clase || ""}" viewBox="0 0 24 24" aria-hidden="true">${SVG[n] || SVG.nube}</svg>`;

  // Códigos WMO que da Open-Meteo → texto e icono.
  function estado(codigo, dia) {
    const c = Number(codigo);
    if (c === 0) return ["Despejado", dia ? "sol" : "luna"];
    if (c === 1) return ["Casi despejado", dia ? "sol" : "luna"];
    if (c === 2) return ["Parcialmente nublado", dia ? "solNube" : "lunaNube"];
    if (c === 3) return ["Nublado", "nube"];
    if (c === 45 || c === 48) return ["Niebla", "niebla"];
    if (c >= 51 && c <= 57) return ["Llovizna", "llovizna"];
    if (c >= 61 && c <= 67) return [c >= 65 ? "Lluvia fuerte" : "Lluvia", "lluvia"];
    if (c >= 71 && c <= 77) return ["Nieve", "nieve"];
    if (c >= 80 && c <= 82) return ["Chubascos", "lluvia"];
    if (c === 85 || c === 86) return ["Nevadas", "nieve"];
    if (c >= 95) return ["Tormenta", "tormenta"];
    return ["—", "nube"];
  }

  // ---- Datos ----
  const memoria = {}, enCurso = {};
  const leer = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } };
  const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } };

  async function json(url) {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }

  // «Guadalajara» o «Guadalajara, Jalisco» o «Valencia, España»: lo que va tras la coma sirve para elegir entre homónimas.
  async function buscarLugar(texto) {
    const k = "lienzo-lugar:" + texto.toLowerCase();
    const guardado = leer(k);
    if (guardado) return guardado;
    const [nombre, ...resto] = texto.split(",").map((s) => s.trim()).filter(Boolean);
    const pista = resto.join(" ").toLowerCase();
    const r = await json(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(nombre)}&count=10&language=es&format=json`);
    const lista = r.results || [];
    const coincide = (x) => [x.country, x.admin1, x.admin2, x.country_code].some((v) => v && String(v).toLowerCase().includes(pista));
    const elegido = (pista && lista.find(coincide)) || lista[0];
    if (!elegido) return null;
    const lugar = { nombre: elegido.name, region: elegido.admin1 || elegido.country || "", lat: elegido.latitude, lon: elegido.longitude };
    guardar(k, lugar);
    return lugar;
  }

  async function descargar(ciudad, unidad) {
    const lugar = await buscarLugar(ciudad);
    if (!lugar) return { error: `No encontré «${ciudad}». Prueba con «Ciudad, Estado».` };
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lugar.lat}&longitude=${lugar.lon}` +
      "&current=temperature_2m,apparent_temperature,relative_humidity_2m,is_day,weather_code,wind_speed_10m" +
      "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=6" +
      (unidad === "f" ? "&temperature_unit=fahrenheit&wind_speed_unit=mph" : "");
    const r = await json(url);
    const c = r.current || {}, d = r.daily || {};
    return {
      lugar,
      ahora: { temp: c.temperature_2m, sensacion: c.apparent_temperature, humedad: c.relative_humidity_2m, viento: c.wind_speed_10m, codigo: c.weather_code, dia: c.is_day !== 0 },
      dias: (d.time || []).map((f, i) => ({ fecha: f, codigo: d.weather_code[i], max: d.temperature_2m_max[i], min: d.temperature_2m_min[i], lluvia: (d.precipitation_probability_max || [])[i] })),
    };
  }

  // Devuelve {datos, t} o {error}. Si no hay internet, sirve lo último que se guardó.
  function obtener(ciudad, unidad, forzar) {
    const k = "lienzo-clima:" + ciudad.toLowerCase() + "|" + unidad;
    const c = memoria[k] || (memoria[k] = leer(k));
    if (c && c.datos && !forzar && Date.now() - c.t < MINUTOS * 60000) return Promise.resolve(c);
    if (enCurso[k]) return enCurso[k];
    return (enCurso[k] = descargar(ciudad, unidad).then((datos) => {
      if (datos.error) return datos;
      const nuevo = { datos, t: Date.now() };
      memoria[k] = nuevo;
      guardar(k, nuevo);
      return nuevo;
    }).catch((e) => {
      L.puente.log("Clima: " + e.message);
      return c && c.datos ? Object.assign({ viejo: true }, c) : { error: "Sin conexión. Lo intento de nuevo en un rato." };
    }).finally(() => { delete enCurso[k]; }));
  }

  L.bloque({
    tipo: "clima",
    nombre: "Clima",
    icono: "sol",
    descripcion: "La temperatura de tu ciudad y el pronóstico de los próximos días.",
    opciones: [
      { id: "ciudad", nombre: "Ciudad", tipo: "texto", valor: "", ejemplo: "Ej.: Guadalajara, Jalisco" },
      { id: "estilo", nombre: "Estilo", tipo: "lista", valor: "tarjeta", opciones: [["tarjeta", "Tarjeta"], ["pronostico", "Pronóstico"], ["minimal", "Una línea"]] },
      { id: "unidad", nombre: "Unidad", tipo: "lista", valor: "c", opciones: [["c", "°C"], ["f", "°F"]] },
      { id: "detalles", nombre: "Sensación, humedad y viento", tipo: "si-no", valor: true },
    ],
    comunes: { fondo: "vidrio" },
    css: `
      .b-clima { min-width: 210px; }
      .b-clima .lugar { font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--acento); font-weight: 700; display: flex; align-items: center; gap: 6px; }
      .b-clima .lugar .viejo { color: var(--tenue); letter-spacing: 0; text-transform: none; font-weight: 500; }
      .b-clima .fila { display: flex; align-items: center; gap: 14px; margin-top: 6px; }
      .b-clima .grande { width: 54px; height: 54px; color: var(--acento); stroke-width: 1.6; }
      .b-clima .temp { font-size: 52px; font-weight: 300; line-height: 1; letter-spacing: -.03em; font-variant-numeric: tabular-nums; }
      .b-clima .cond { font-size: 15px; font-weight: 600; margin-top: 8px; }
      .b-clima .rango { font-size: 13px; color: var(--tenue); margin-top: 2px; }
      .b-clima .det { display: flex; gap: 14px; font-size: 12px; color: var(--tenue); margin-top: 10px; }
      .b-clima .dias { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(var(--texto-rgb), .1); }
      .b-clima .dia { display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 12px; min-width: 44px; }
      .b-clima .dia .ic { width: 22px; height: 22px; color: var(--acento2); }
      .b-clima .dia b { font-weight: 600; text-transform: capitalize; color: var(--tenue); }
      .b-clima .dia .mm { font-variant-numeric: tabular-nums; } .b-clima .dia .mm span { color: var(--tenue); }
      .b-clima .dia .ll { font-size: 10.5px; color: var(--acento2); }
      .b-clima.e-minimal { display: flex; align-items: center; gap: 10px; font-size: 16px; white-space: nowrap; min-width: 0; }
      .b-clima.e-minimal .ic { width: 22px; height: 22px; color: var(--acento); }
      .b-clima.e-minimal .t { font-weight: 700; }
      .b-clima.e-minimal .c::before { content: "·"; margin: 0 8px 0 2px; color: var(--tenue); }
      .b-clima .aviso { color: var(--tenue); font-size: 13.5px; max-width: 240px; line-height: 1.4; }
      .b-clima .aviso .ic { width: 28px; height: 28px; color: var(--acento); display: block; margin-bottom: 6px; }
    `,
    crear(el, ctx) {
      const o = ctx.opciones, esc = L.escapar, F = L.formato;
      const ciudad = String(o.ciudad || "").trim();
      el.classList.add("b-clima", "e-" + o.estilo);
      const g = (v) => (v == null || isNaN(v) ? "—" : Math.round(v) + "°");

      const pintar = (r) => {
        if (!ciudad) { el.innerHTML = `<div class="aviso">${icono("solNube")}Escribe tu ciudad en el modo edición.</div>`; return; }
        if (!r) { el.innerHTML = `<div class="aviso">${icono("nube")}Buscando el clima de ${esc(ciudad)}…</div>`; return; }
        if (r.error) { el.innerHTML = `<div class="aviso">${icono("nube")}${esc(r.error)}</div>`; return; }
        const d = r.datos, a = d.ahora, hoy = d.dias[0] || {};
        const [texto, ic] = estado(a.codigo, a.dia);
        if (o.estilo === "minimal") {
          el.innerHTML = `${icono(ic)}<span class="t">${g(a.temp)}</span><span class="c">${esc(texto)}</span>`;
          return;
        }
        const viento = o.unidad === "f" ? "mph" : "km/h";
        let html = `<div class="lugar">${esc(d.lugar.nombre)}${r.viejo ? '<span class="viejo">· sin conexión</span>' : ""}</div>
          <div class="fila">${icono(ic, "grande")}<div class="temp">${g(a.temp)}</div></div>
          <div class="cond">${esc(texto)}</div>
          <div class="rango">Máx ${g(hoy.max)} · Mín ${g(hoy.min)}</div>`;
        if (o.detalles) html += `<div class="det"><span>Se siente ${g(a.sensacion)}</span><span>${Math.round(a.humedad || 0)}% hum.</span><span>${Math.round(a.viento || 0)} ${viento}</span></div>`;
        if (o.estilo === "pronostico") {
          html += `<div class="dias">${d.dias.slice(1, 6).map((x) => {
            const f = new Date(x.fecha + "T12:00:00");
            return `<div class="dia"><b>${F.DIAS[f.getDay()].slice(0, 3)}</b>${icono(estado(x.codigo, true)[1])}
              <span class="mm">${g(x.max)} <span>${g(x.min)}</span></span>${x.lluvia >= 30 ? `<span class="ll">${x.lluvia}%</span>` : ""}</div>`;
          }).join("")}</div>`;
        }
        el.innerHTML = html;
      };

      let vivo = true;
      const actualizar = (forzar) => {
        if (!ciudad) return pintar(null);
        obtener(ciudad, o.unidad, forzar).then((r) => { if (vivo) pintar(r); });
      };
      pintar(null);
      actualizar(false);
      // Revisa cada 10 min (solo pide a internet si ya pasaron 30). En pausa no hace nada.
      const t = setInterval(() => { if (!document.body.classList.contains("pausado")) actualizar(false); }, 10 * 60000);
      if (ciudad) L.tocable(el, () => { pintar(null); actualizar(true); }, "Actualizar el clima").classList.add("lz-suave");
      return { destruir() { vivo = false; clearInterval(t); } };
    },
  });
})();

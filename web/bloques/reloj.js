Lienzo.bloque({
  tipo: "reloj",
  nombre: "Reloj",
  icono: "reloj",
  descripcion: "La hora en seis estilos, del minimal al neón.",
  opciones: [
    { id: "estilo", nombre: "Estilo", tipo: "lista", valor: "grande",
      opciones: [["grande", "Grande"], ["minimal", "Minimal"], ["apilado", "Apilado"], ["neon", "Neón"], ["terminal", "Terminal"], ["analogico", "Analógico"]] },
    { id: "formato24", nombre: "Formato de 24 horas", tipo: "si-no", valor: false },
    { id: "segundos", nombre: "Mostrar segundos", tipo: "si-no", valor: false },
    { id: "fecha", nombre: "Mostrar la fecha", tipo: "si-no", valor: true },
  ],
  css: `
    .b-reloj { line-height: 1; white-space: nowrap; }
    .b-reloj .fecha { margin-top: 10px; font-size: 22px; font-weight: 400; opacity: .88; }
    .b-reloj .sufijo { font-size: .26em; font-weight: 500; margin-left: .25em; letter-spacing: .02em; opacity: .85; }
    .b-reloj.e-grande .hora { font-size: 112px; font-weight: 200; letter-spacing: -3px; }
    .b-reloj.e-minimal .hora { font-size: 68px; font-weight: 300; letter-spacing: -1px; }
    .b-reloj.e-minimal .fecha { font-size: 15px; letter-spacing: .32em; text-transform: uppercase; font-weight: 600; opacity: .75; margin-top: 12px; }
    .b-reloj.e-apilado .hora { font-size: 120px; font-weight: 700; line-height: .86; letter-spacing: -4px; display: flex; flex-direction: column; }
    .b-reloj.e-apilado .hora .min { color: var(--acento); }
    .b-reloj.e-apilado .sufijo { font-size: 20px; margin: 6px 0 0 4px; }
    .b-reloj.e-apilado .fecha { font-size: 18px; margin-top: 14px; font-weight: 600; }
    .b-reloj.e-neon .hora { font-size: 96px; font-weight: 600; color: var(--acento); letter-spacing: 2px;
      text-shadow: 0 0 6px rgba(var(--acento-rgb), .9), 0 0 22px rgba(var(--acento-rgb), .65), 0 0 60px rgba(var(--acento-rgb), .4); }
    .b-reloj.e-neon .fecha { color: var(--acento2); letter-spacing: .25em; text-transform: uppercase; font-size: 15px;
      text-shadow: 0 0 10px rgba(var(--acento2-rgb), .7); }
    .b-reloj.e-terminal { font-family: var(--fuente-mono); font-size: 18px; line-height: 1.55; text-shadow: none; }
    .b-reloj.e-terminal .prompt { color: var(--acento); font-weight: 700; }
    .b-reloj.e-terminal .ruta { color: var(--acento2); font-weight: 700; }
    .b-reloj.e-terminal .grande { font-size: 44px; font-weight: 700; margin: 4px 0 2px; color: var(--texto); }
    .b-reloj.e-terminal .cursor { display: inline-block; width: .6em; height: 1.1em; background: var(--texto); vertical-align: -3px; animation: lz-parpadeo 1s steps(1) infinite; }
    .b-reloj.e-analogico svg { width: 210px; height: 210px; display: block; filter: drop-shadow(0 6px 20px rgba(0,0,0,.35)); }
    .b-reloj.e-analogico .fecha { text-align: center; }
    @keyframes lz-parpadeo { 50% { opacity: 0; } }
    .pausado .b-reloj .cursor { animation-play-state: paused; }
  `,
  crear(el, ctx) {
    const o = ctx.opciones, F = Lienzo.formato;
    el.classList.add("b-reloj", "e-" + o.estilo);
    let pintar;
    if (o.estilo === "analogico") {
      const marcas = Array.from({ length: 60 }, (_, i) => {
        const a = (i / 60) * Math.PI * 2, larga = i % 5 === 0, r1 = larga ? 82 : 88, r2 = 93;
        return `<line x1="${100 + Math.sin(a) * r1}" y1="${100 - Math.cos(a) * r1}" x2="${100 + Math.sin(a) * r2}" y2="${100 - Math.cos(a) * r2}"
          stroke="rgba(var(--texto-rgb), ${larga ? 0.9 : 0.35})" stroke-width="${larga ? 3 : 1.2}" stroke-linecap="round"/>`;
      }).join("");
      el.innerHTML = `<svg viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="98" fill="rgba(var(--superficie-rgb), .55)" stroke="rgba(var(--texto-rgb), .12)" stroke-width="1.5"/>
          ${marcas}
          <line class="mh" x1="100" y1="112" x2="100" y2="52" stroke="var(--texto)" stroke-width="6" stroke-linecap="round"/>
          <line class="mm" x1="100" y1="116" x2="100" y2="30" stroke="var(--texto)" stroke-width="3.5" stroke-linecap="round"/>
          <line class="ms" x1="100" y1="122" x2="100" y2="22" stroke="var(--acento)" stroke-width="1.6" stroke-linecap="round"/>
          <circle cx="100" cy="100" r="5" fill="var(--acento)"/>
        </svg>${o.fecha ? '<div class="fecha"></div>' : ""}`;
      const mh = el.querySelector(".mh"), mm = el.querySelector(".mm"), ms = el.querySelector(".ms"), fe = el.querySelector(".fecha");
      ms.style.display = o.segundos ? "" : "none";
      pintar = (d) => {
        const s = d.getSeconds(), m = d.getMinutes() + s / 60, h = (d.getHours() % 12) + m / 60;
        mh.setAttribute("transform", `rotate(${h * 30} 100 100)`);
        mm.setAttribute("transform", `rotate(${m * 6} 100 100)`);
        ms.setAttribute("transform", `rotate(${s * 6} 100 100)`);
        if (fe) fe.textContent = F.capital(F.fechaCorta(d));
      };
    } else if (o.estilo === "terminal") {
      const f = Lienzo.datos.ficha || {};
      el.innerHTML = `<div><span class="prompt">${Lienzo.escapar((f.usuario || "yo").toLowerCase())}@${Lienzo.escapar((f.equipo || "lienzo").toLowerCase())}</span>:<span class="ruta">~</span>$ date</div>
        <div class="grande"></div><div class="linea-fecha"></div>
        <div><span class="prompt">${Lienzo.escapar((f.usuario || "yo").toLowerCase())}</span>:<span class="ruta">~</span>$ <span class="cursor"></span></div>`;
      const g = el.querySelector(".grande"), lf = el.querySelector(".linea-fecha");
      lf.style.display = o.fecha ? "" : "none";
      pintar = (d) => {
        const t = F.hora(d, o.formato24, o.segundos);
        g.textContent = t.texto + (t.sufijo ? " " + t.sufijo : "");
        lf.textContent = `${F.DIAS[d.getDay()]} ${d.getDate()} ${F.MESES[d.getMonth()]} ${d.getFullYear()}`;
      };
    } else {
      el.innerHTML = `<div class="hora"></div>${o.fecha ? '<div class="fecha"></div>' : ""}`;
      const hEl = el.querySelector(".hora"), fEl = el.querySelector(".fecha");
      pintar = (d) => {
        const t = F.hora(d, o.formato24, o.segundos);
        if (o.estilo === "apilado") {
          hEl.innerHTML = `<span>${t.h}</span><span class="min">${t.m}${o.segundos ? '<span class="sufijo">' + t.s + "</span>" : ""}</span>${t.sufijo ? '<span class="sufijo">' + t.sufijo + "</span>" : ""}`;
        } else {
          hEl.innerHTML = `${t.texto}${t.sufijo ? '<span class="sufijo">' + t.sufijo + "</span>" : ""}`;
        }
        if (fEl) fEl.textContent = F.capital(F.fechaLarga(d));
      };
    }
    const quitar = Lienzo.reloj.suscribir(pintar);
    return { destruir: quitar };
  },
});

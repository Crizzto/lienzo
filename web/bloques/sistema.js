Lienzo.bloque({
  tipo: "sistema",
  nombre: "Sistema",
  icono: "cpu",
  descripcion: "Procesador, memoria, disco, batería y red en vivo.",
  opciones: [
    { id: "estilo", nombre: "Estilo", tipo: "lista", valor: "barras", opciones: [["barras", "Barras"], ["anillos", "Anillos"], ["texto", "Texto compacto"]] },
    { id: "cpu", nombre: "Procesador", tipo: "si-no", valor: true },
    { id: "ram", nombre: "Memoria", tipo: "si-no", valor: true },
    { id: "disco", nombre: "Disco", tipo: "si-no", valor: true },
    { id: "bateria", nombre: "Batería", tipo: "si-no", valor: true },
    { id: "red", nombre: "Red", tipo: "si-no", valor: false },
  ],
  comunes: { fondo: "vidrio" },
  css: `
    .b-sistema { text-shadow: none; }
    .b-sistema.e-barras { width: 260px; display: grid; gap: 12px; }
    .b-sistema .fila { display: grid; grid-template-columns: 22px 1fr auto; align-items: center; gap: 10px; font-size: 14px; }
    .b-sistema .fila .ic { font-size: 18px; color: var(--acento); }
    .b-sistema .fila .et { font-weight: 600; }
    .b-sistema .fila .val { font-variant-numeric: tabular-nums; color: var(--tenue); font-size: 13px; }
    .b-sistema .fila .pista { grid-column: 2 / 4; height: 6px; border-radius: 6px; background: rgba(var(--texto-rgb), .1); overflow: hidden; margin-top: -4px; }
    .b-sistema .fila .lleno { height: 100%; border-radius: 6px; background: linear-gradient(90deg, var(--acento), var(--acento2)); transition: width .8s ease; }
    .b-sistema.e-anillos { display: flex; gap: 18px; }
    .b-sistema .anillo { width: 78px; text-align: center; font-size: 12px; color: var(--tenue); font-weight: 600; }
    .b-sistema .anillo .caja { position: relative; width: 78px; height: 78px; margin-bottom: 6px; }
    .b-sistema .anillo .caja > svg { width: 78px; height: 78px; transform: rotate(-90deg); }
    .b-sistema .anillo .arco { transition: stroke-dashoffset .8s ease; }
    .b-sistema .anillo .centro { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--texto); }
    .b-sistema .anillo .centro .ic { font-size: 16px; color: var(--acento); margin-bottom: 2px; }
    .b-sistema .anillo .centro b { font-size: 15px; font-variant-numeric: tabular-nums; }
    .b-sistema.e-texto { font-size: 15px; white-space: nowrap; font-variant-numeric: tabular-nums; display: flex; gap: 14px; align-items: center; }
    .b-sistema.e-texto span { display: inline-flex; align-items: center; gap: 6px; }
    .b-sistema.e-texto .ic { color: var(--acento); }
  `,
  crear(el, ctx) {
    const o = ctx.opciones, F = Lienzo.formato, I = Lienzo.icono;
    el.classList.add("b-sistema", "e-" + o.estilo);
    const medidas = () => {
      const s = Lienzo.datos.sistema || {};
      const m = [];
      if (o.cpu) m.push({ id: "cpu", nombre: "CPU", ic: "cpu", pct: s.cpu || 0, val: `${Math.round(s.cpu || 0)}%` });
      if (o.ram) m.push({ id: "ram", nombre: "RAM", ic: "ram", pct: s.ram || 0, val: s.ramUsada ? `${s.ramUsada} / ${s.ramTotal} GB` : `${s.ram || 0}%`, corto: `${s.ram || 0}%` });
      if (o.disco) m.push({ id: "disco", nombre: "Disco", ic: "disco", pct: s.disco || 0, val: s.discoLibre != null ? `${s.discoLibre} GB libres` : `${s.disco || 0}%`, corto: `${s.disco || 0}%` });
      if (o.bateria && s.bateria >= 0) m.push({ id: "bateria", nombre: s.cargando ? "Cargando" : "Batería", ic: s.cargando ? "rayo" : "bateria", pct: s.bateria, val: `${s.bateria}%` });
      if (o.red) m.push({ id: "red", nombre: "Red", ic: s.red === "sin" ? "sinRed" : s.red === "cable" ? "cable" : "wifi", pct: Math.min(100, ((s.bajada || 0) / 2500000) * 100), val: `↓ ${F.bytes(s.bajada)}`, corto: F.bytes(s.bajada) });
      return m;
    };
    let estructura = "";
    const pintar = () => {
      const m = medidas();
      const clave = m.map((x) => x.id + x.ic).join();
      if (clave !== estructura) {
        estructura = clave;
        if (o.estilo === "barras") {
          el.innerHTML = m.map((x) => `<div class="fila" data-id="${x.id}">${I(x.ic)}<span class="et">${x.nombre}</span><span class="val"></span><div class="pista"><div class="lleno"></div></div></div>`).join("");
        } else if (o.estilo === "anillos") {
          el.innerHTML = m.map((x) => `<div class="anillo" data-id="${x.id}"><div class="caja"><svg viewBox="0 0 78 78">
              <circle cx="39" cy="39" r="33" fill="none" stroke="rgba(var(--texto-rgb), .1)" stroke-width="7"/>
              <circle class="arco" cx="39" cy="39" r="33" fill="none" stroke="url(#lz-grad-${x.id})" stroke-width="7" stroke-linecap="round" stroke-dasharray="207.3" stroke-dashoffset="207.3"/>
              <defs><linearGradient id="lz-grad-${x.id}"><stop offset="0" stop-color="var(--acento)"/><stop offset="1" stop-color="var(--acento2)"/></linearGradient></defs>
            </svg><div class="centro">${I(x.ic)}<b></b></div></div><span class="et">${x.nombre}</span></div>`).join("");
        } else {
          el.innerHTML = m.map((x) => `<span data-id="${x.id}">${I(x.ic)}<b></b></span>`).join("");
        }
      }
      m.forEach((x) => {
        const n = el.querySelector(`[data-id="${x.id}"]`);
        if (!n) return;
        if (o.estilo === "barras") {
          n.querySelector(".val").textContent = x.val;
          n.querySelector(".lleno").style.width = `${Math.max(2, Math.min(100, x.pct))}%`;
          n.querySelector(".et").textContent = x.nombre;
        } else if (o.estilo === "anillos") {
          n.querySelector(".arco").style.strokeDashoffset = String(207.3 * (1 - Math.max(0, Math.min(100, x.pct)) / 100));
          n.querySelector("b").textContent = x.corto || x.val;
        } else n.querySelector("b").textContent = x.corto || x.val;
      });
    };
    pintar();
    ctx.on("sistema", pintar);
    return {};
  },
});

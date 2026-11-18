Lienzo.bloque({
  tipo: "fecha",
  nombre: "Fecha y calendario",
  icono: "calendario",
  descripcion: "El día de hoy en línea, en tarjeta o con el calendario del mes.",
  opciones: [
    { id: "estilo", nombre: "Estilo", tipo: "lista", valor: "calendario", opciones: [["linea", "Línea"], ["tarjeta", "Tarjeta"], ["calendario", "Calendario del mes"]] },
  ],
  comunes: { fondo: "vidrio" },
  css: `
    .b-fecha.e-linea { font-size: 26px; font-weight: 400; white-space: nowrap; }
    .b-fecha.e-tarjeta { display: flex; align-items: center; gap: 16px; }
    .b-fecha.e-tarjeta .num { font-size: 84px; font-weight: 700; line-height: .9; color: var(--acento); letter-spacing: -3px; }
    .b-fecha.e-tarjeta .dia { font-size: 24px; font-weight: 600; }
    .b-fecha.e-tarjeta .mes { font-size: 16px; opacity: .75; margin-top: 4px; text-transform: capitalize; }
    .b-fecha.e-calendario { width: 252px; text-shadow: none; }
    .b-fecha.e-calendario .cab { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px; }
    .b-fecha.e-calendario .cab b { font-size: 18px; text-transform: capitalize; }
    .b-fecha.e-calendario .cab span { font-size: 13px; color: var(--tenue); }
    .b-fecha.e-calendario .rejilla { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; text-align: center; font-size: 13px; }
    .b-fecha.e-calendario .ds { color: var(--tenue); font-weight: 600; font-size: 11px; padding-bottom: 4px; }
    .b-fecha.e-calendario .d { height: 30px; line-height: 30px; border-radius: 9px; font-variant-numeric: tabular-nums; }
    .b-fecha.e-calendario .d.otro { opacity: .28; }
    .b-fecha.e-calendario .d.hoy { background: var(--acento); color: var(--fondo); font-weight: 700; box-shadow: 0 4px 16px rgba(var(--acento-rgb), .45); }
    .b-fecha.e-calendario .d.finde { color: rgba(var(--acento2-rgb), .9); }
  `,
  crear(el, ctx) {
    const o = ctx.opciones, F = Lienzo.formato;
    el.classList.add("b-fecha", "e-" + o.estilo);
    let ultimo = "";
    const pintar = (d) => {
      const clave = d.toDateString();
      if (clave === ultimo) return;
      ultimo = clave;
      if (o.estilo === "linea") {
        el.textContent = F.capital(F.fechaLarga(d));
      } else if (o.estilo === "tarjeta") {
        el.innerHTML = `<div class="num">${d.getDate()}</div><div><div class="dia">${F.capital(F.DIAS[d.getDay()])}</div><div class="mes">${F.MESES[d.getMonth()]} ${d.getFullYear()}</div></div>`;
      } else {
        const primero = new Date(d.getFullYear(), d.getMonth(), 1);
        const inicio = (primero.getDay() + 6) % 7; // la semana empieza en lunes
        const dias = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        const previos = new Date(d.getFullYear(), d.getMonth(), 0).getDate();
        let celdas = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"].map((x) => `<div class="ds">${x}</div>`).join("");
        const total = Math.ceil((inicio + dias) / 7) * 7;
        for (let i = 0; i < total; i++) {
          const n = i - inicio + 1;
          const finde = i % 7 >= 5 ? " finde" : "";
          if (n < 1) celdas += `<div class="d otro">${previos + n}</div>`;
          else if (n > dias) celdas += `<div class="d otro">${n - dias}</div>`;
          else celdas += `<div class="d${n === d.getDate() ? " hoy" : finde}">${n}</div>`;
        }
        el.innerHTML = `<div class="cab"><b>${F.MESES[d.getMonth()]}</b><span>${d.getFullYear()}</span></div><div class="rejilla">${celdas}</div>`;
      }
    };
    const quitar = Lienzo.reloj.suscribir(pintar);
    return { destruir: quitar };
  },
});

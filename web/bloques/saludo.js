Lienzo.bloque({
  tipo: "saludo",
  nombre: "Saludo",
  icono: "sol",
  descripcion: "«Buenas noches, …» según la hora del día.",
  opciones: [
    { id: "nombre", nombre: "Tu nombre (vacío = el de Windows)", tipo: "texto", valor: "" },
    { id: "debajo", nombre: "Debajo", tipo: "lista", valor: "nada", opciones: [["nada", "Nada"], ["fecha", "La fecha"], ["frase", "Una frase"]] },
    { id: "tamano", nombre: "Tamaño", tipo: "lista", valor: "mediano", opciones: [["chico", "Chico"], ["mediano", "Mediano"], ["grande", "Grande"]] },
  ],
  css: `
    .b-saludo .hola { font-weight: 600; white-space: nowrap; letter-spacing: -.3px; }
    .b-saludo .hola b { color: var(--acento); font-weight: 700; }
    .b-saludo.t-chico .hola { font-size: 20px; } .b-saludo.t-mediano .hola { font-size: 28px; } .b-saludo.t-grande .hola { font-size: 44px; }
    .b-saludo .sub { margin-top: 6px; opacity: .8; font-size: 16px; }
  `,
  frases: [
    "Un paso a la vez también es avanzar.", "Hoy también cuenta.", "Respira hondo: lo estás haciendo bien.",
    "Lo simple también puede ser bonito.", "Pequeños avances, grandes cambios.", "No tiene que ser perfecto, solo empezar.",
  ],
  crear(el, ctx) {
    const o = ctx.opciones, F = Lienzo.formato, esc = Lienzo.escapar, def = Lienzo.bloques.saludo;
    el.classList.add("b-saludo", "t-" + o.tamano);
    let ultimo = "";
    const pintar = (d) => {
      d = d || new Date();
      const h = d.getHours();
      const saludo = h >= 5 && h < 12 ? "Buenos días" : h >= 12 && h < 19 ? "Buenas tardes" : "Buenas noches";
      const f = Lienzo.datos.ficha || {}, cfg = ctx.config || {};
      let nombre = o.nombre || (cfg.general && cfg.general.nombre) || f.usuario || "";
      nombre = F.capital(String(nombre).split(/[ ._-]/)[0]);
      const sub = o.debajo === "fecha" ? F.capital(F.fechaLarga(d)) : o.debajo === "frase" ? def.frases[d.getDate() % def.frases.length] : "";
      const html = `<div class="hola">${saludo}${nombre ? `, <b>${esc(nombre)}</b>` : ""}</div>${sub ? `<div class="sub">${esc(sub)}</div>` : ""}`;
      if (html !== ultimo) { ultimo = html; el.innerHTML = html; }
    };
    const quitar = Lienzo.reloj.suscribir(pintar);
    ctx.on("ficha", () => pintar());
    return { destruir: quitar };
  },
});

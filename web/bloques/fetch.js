Lienzo.bloque({
  tipo: "fetch",
  nombre: "Ficha del sistema",
  icono: "terminal",
  descripcion: "La ficha estilo neofetch de los rices: dibujo ASCII, datos de tu PC y la paleta.",
  opciones: [
    { id: "logo", nombre: "Dibujo", tipo: "lista", valor: "gato", opciones: [["gato", "Gato"], ["luna", "Luna"], ["montana", "Montañas"], ["ventana", "Ventana"], ["lienzo", "Lienzo"], ["ninguno", "Ninguno"]] },
    { id: "colores", nombre: "Cuadros de colores", tipo: "si-no", valor: true },
  ],
  comunes: { fondo: "solido", fuente: "mono" },
  css: `
    .b-fetch { display: flex; gap: 22px; align-items: flex-start; font-family: var(--fuente-mono); font-size: 14px; line-height: 1.5; text-shadow: none; }
    .b-fetch pre { margin: 0; font: inherit; color: var(--acento); font-weight: 700; line-height: 1.22; }
    .b-fetch .lineas { white-space: nowrap; }
    .b-fetch .usr { color: var(--acento); font-weight: 700; } .b-fetch .usr b { color: var(--acento2); }
    .b-fetch .sep { color: var(--tenue); }
    .b-fetch .k { color: var(--acento2); font-weight: 700; }
    .b-fetch .cuadros { display: flex; margin-top: 10px; }
    .b-fetch .cuadros i { width: 22px; height: 14px; }
  `,
  logos: {
    gato: ["   /\\_/\\", "  ( -.- )", "  /     \\", " ( |   | )", "  \\_)-(_/"],
    luna: ["     .--.", "   .'  _\\", "  /  .'", " |  /", " |  \\", "  \\  '._.-.", "   '.    .'", "     '--'"],
    montana: ["        /\\", "       /  \\    /\\", "      /    \\  /  \\", "     /  /\\  \\/    \\", "    /  /  \\  \\     \\", "   /__/____\\__\\_____\\"],
    ventana: [" ┌─────┬─────┐", " │     │     │", " │     │     │", " ├─────┼─────┤", " │     │     │", " │     │     │", " └─────┴─────┘"],
    lienzo: ["  ____________", " |  ~   .  *  |", " |    /\\   .  |", " |   /  \\/\\   |", " |____________|", "   /   ||   \\", "  /    ||    \\"],
  },
  crear(el, ctx) {
    const o = ctx.opciones, F = Lienzo.formato, esc = Lienzo.escapar, def = Lienzo.bloques.fetch;
    el.classList.add("b-fetch");
    const pintar = () => {
      const f = Lienzo.datos.ficha || {}, s = Lienzo.datos.sistema || {};
      const cfg = ctx.config || {};
      const rice = (Lienzo.rices || []).find((r) => r.id === cfg.rice);
      const usuario = (f.usuario || "yo").toLowerCase(), equipo = (f.equipo || "lienzo").toLowerCase();
      const filas = [
        ["SO", `${f.so || "Windows"}${f.version ? " " + f.version : ""}`],
        ["Kernel", f.kernel || (f.compilacion ? `NT 10.0.${f.compilacion}` : "")],
        ["Encendido", s.encendido ? F.duracion(s.encendido) : ""],
        ["Resolución", f.resolucion ? `${f.resolucion}${f.escala ? " @" + f.escala + "%" : ""}` : ""],
        ["Shell", `Lienzo ${f.lienzo || ""}`.trim()],
        ["Tema", rice ? rice.nombre : "Personalizado"],
        ["Letra", (cfg.estilo && cfg.estilo.fuente) || ""],
        ["CPU", f.cpu ? `${f.cpu}${f.nucleos ? " (" + f.nucleos + ")" : ""}` : ""],
        ["GPU", f.gpu || ""],
        ["Memoria", s.ramUsada ? `${s.ramUsada} GiB / ${s.ramTotal} GiB` : f.ram ? `${f.ram} GiB` : ""],
      ].filter((x) => x[1]);
      const cab = `${usuario}@${equipo}`;
      const logo = def.logos[o.logo];
      const cuadros = o.colores
        ? `<div class="cuadros">${["fondo", "superficie", "acento", "acento2", "tenue", "texto"].map((r) => `<i style="background: var(--${r})"></i>`).join("")}</div>`
        : "";
      el.innerHTML = `${logo ? `<pre>${esc(logo.join("\n"))}</pre>` : ""}<div class="lineas">
        <div class="usr">${esc(usuario)}<b>@</b>${esc(equipo)}</div><div class="sep">${"-".repeat(cab.length)}</div>
        ${filas.map((x) => `<div><span class="k">${esc(x[0])}</span>: ${esc(x[1])}</div>`).join("")}${cuadros}</div>`;
    };
    pintar();
    ctx.on("ficha", pintar);
    let n = 0;
    ctx.on("sistema", () => { if (++n % 15 === 1) pintar(); }); // el tiempo encendido no necesita más de una vez cada 30 s
    ctx.on("config", pintar);
    return {};
  },
});

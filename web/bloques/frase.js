Lienzo.bloque({
  tipo: "frase",
  nombre: "Frase o nota",
  icono: "comillas",
  descripcion: "Un texto tuyo o frases que van cambiando.",
  opciones: [
    { id: "texto", nombre: "Tu texto (vacío = frases que cambian)", tipo: "texto", valor: "" },
    { id: "cada", nombre: "Cambiar la frase cada", tipo: "lista", valor: "60", opciones: [["15", "15 minutos"], ["60", "1 hora"], ["1440", "1 día"]] },
    { id: "tamano", nombre: "Tamaño", tipo: "rango", min: 14, max: 48, paso: 1, valor: 24 },
    { id: "comillas", nombre: "Comillas decorativas", tipo: "si-no", valor: true },
  ],
  css: `
    .b-frase { max-width: 520px; line-height: 1.35; font-weight: 400; position: relative; }
    .b-frase.con-comillas { padding-left: 34px; }
    .b-frase.con-comillas::before { content: "“"; position: absolute; left: -4px; top: -.32em; font-size: 2.6em; color: var(--acento); font-family: Georgia, serif; line-height: 1; }
    .b-frase .autor { margin-top: 8px; font-size: .62em; color: var(--tenue); letter-spacing: .08em; }
  `,
  frases: [
    "Un paso a la vez también es avanzar.",
    "Hoy también cuenta.",
    "Respira hondo. Lo estás haciendo bien.",
    "Lo simple también puede ser bonito.",
    "Haz espacio para lo que te hace bien.",
    "Las mejores ideas llegan con calma.",
    "Termina lo que empiezas, pero descansa en medio.",
    "La constancia le gana al talento distraído.",
    "Que tu escritorio se sienta como tu casa.",
    "Pequeños avances, grandes cambios.",
    "Hoy es buen día para aprender algo nuevo.",
    "No tiene que ser perfecto, solo tiene que empezar.",
    "Cuida tu energía como cuidas tu batería.",
    "Lo que haces con cariño se nota.",
  ],
  crear(el, ctx) {
    const o = ctx.opciones, esc = Lienzo.escapar, def = Lienzo.bloques.frase;
    el.classList.add("b-frase");
    el.classList.toggle("con-comillas", !!o.comillas);
    el.style.fontSize = `${o.tamano}px`;
    let ultimo = "";
    const pintar = (d) => {
      let texto = String(o.texto || "").trim();
      if (!texto) {
        const minutos = Math.floor((d || new Date()).getTime() / 60000);
        const i = Math.floor(minutos / Math.max(1, Number(o.cada) || 60)) % def.frases.length;
        texto = def.frases[i];
      }
      if (texto === ultimo) return;
      ultimo = texto;
      el.innerHTML = esc(texto).replace(/\n/g, "<br>");
    };
    const quitar = Lienzo.reloj.suscribir(pintar);
    return { destruir: quitar };
  },
});

// Widget de WhatsApp: tus contactos favoritos; un clic abre el chat con esa persona.
// (WhatsApp no deja que otros programas lean tus chats ni los mensajes sin leer, así que eso no se puede mostrar).
Lienzo.bloque({
  tipo: "whatsapp",
  nombre: "WhatsApp",
  icono: "comillas",
  descripcion: "Tus contactos favoritos: un clic y se abre el chat.",
  opciones: [
    { id: "contactos", nombre: "Contactos", tipo: "contactos", valor: "", ejemplo: "Mamá, 52 55 1234 5678\nTrabajo, 52 33 9876 5432",
      ayuda: "Uno por renglón: nombre, coma y número con lada del país (52 para México)." },
    { id: "estilo", nombre: "Estilo", tipo: "lista", valor: "burbujas", opciones: [["burbujas", "Burbujas"], ["lista", "Lista"]] },
    { id: "abrirEn", nombre: "Abrir en", tipo: "lista", valor: "app", opciones: [["app", "La app"], ["web", "WhatsApp Web"]] },
  ],
  comunes: { fondo: "vidrio" },
  css: `
    .b-wa { min-width: 200px; }
    .b-wa .cab { display: flex; align-items: center; gap: 8px; font-size: 11px; letter-spacing: .14em; text-transform: uppercase; font-weight: 700; color: var(--acento); margin-bottom: 12px; width: max-content; }
    .b-wa .cab .logo { width: 20px; height: 20px; border-radius: 6px; background: center / contain no-repeat; display: flex; align-items: center; justify-content: center; }
    .b-wa .cab .logo .ic { width: 18px; height: 18px; }
    .b-wa .cab .abrir { letter-spacing: 0; text-transform: none; font-weight: 500; color: var(--tenue); }
    .b-wa .av { width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex: none;
      font-weight: 700; font-size: 18px; color: #fff; background: linear-gradient(135deg, hsl(var(--tono), 60%, 52%), hsl(calc(var(--tono) + 40), 60%, 40%));
      box-shadow: 0 4px 12px rgba(0,0,0,.25); }
    .b-wa.e-burbujas .contactos { display: flex; gap: 14px; flex-wrap: wrap; max-width: 360px; }
    .b-wa.e-burbujas .c { display: flex; flex-direction: column; align-items: center; gap: 6px; width: 60px; }
    .b-wa.e-burbujas .n { font-size: 12px; max-width: 64px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .b-wa.e-lista .contactos { display: flex; flex-direction: column; gap: 4px; }
    .b-wa.e-lista .c { display: flex; align-items: center; gap: 12px; padding: 6px 8px 6px 4px; border-radius: 12px; }
    .b-wa.e-lista .c.lz-encima { background: rgba(var(--texto-rgb), .07); }
    .b-wa.e-lista .av { width: 38px; height: 38px; font-size: 15px; }
    .b-wa.e-lista .n { font-size: 14.5px; font-weight: 600; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .b-wa.e-lista .n small { display: block; font-weight: 400; font-size: 12px; color: var(--tenue); }
    .b-wa.e-lista .ir { color: var(--tenue); width: 16px; height: 16px; }
    .b-wa .vacio { color: var(--tenue); font-size: 13px; max-width: 240px; line-height: 1.4; }
  `,
  crear(el, ctx) {
    const o = ctx.opciones, L = Lienzo, esc = L.escapar;
    const app = o.app && o.app.clave ? o.app : null;
    // "Nombre, número" (también acepta "Nombre 52 55..." sin coma).
    const contactos = String(o.contactos || "").split(/\r?\n/).map((linea) => {
      const i = linea.lastIndexOf(",");
      let nombre = i >= 0 ? linea.slice(0, i) : linea.replace(/[+\d\s()-]+$/, "");
      const numero = (i >= 0 ? linea.slice(i + 1) : linea.slice(nombre.length)).replace(/\D/g, "");
      nombre = nombre.trim() || numero;
      return { nombre, numero };
    }).filter((c) => c.numero.length >= 7).slice(0, 12);

    const web = o.abrirEn === "web";
    const chat = (n) => (web ? `https://web.whatsapp.com/send?phone=${n}` : `whatsapp://send?phone=${n}`);
    const bonito = (n) => "+" + n.replace(/^(\d{2})(\d{2})(\d{4})(\d{4})$/, "$1 $2 $3 $4");

    el.classList.add("b-wa", "e-" + o.estilo);
    el.innerHTML = `<div class="cab"><span class="logo">${L.icono("comillas")}</span>WhatsApp<span class="abrir">· abrir</span></div>` +
      (contactos.length
        ? `<div class="contactos">${contactos.map((c, i) => `<div class="c" data-i="${i}"><div class="av" style="--tono:${L.tonoDe(c.nombre)}">${esc(L.inicial(c.nombre))}</div>
            <div class="n">${esc(c.nombre)}${o.estilo === "lista" ? `<small>${esc(bonito(c.numero))}</small>` : ""}</div>${o.estilo === "lista" ? L.icono("derecha", "ir") : ""}</div>`).join("")}</div>`
        : `<div class="vacio">Agrega tus contactos favoritos en el modo edición.</div>`);

    if (app) L.iconoApp(app.clave, 64, (url) => {
      if (!url) return;
      const logo = el.querySelector(".cab .logo");
      logo.innerHTML = "";
      logo.style.backgroundImage = `url("${url}")`;
    });
    L.tocable(el.querySelector(".cab"), () => L.lanzar(web ? "https://web.whatsapp.com/" : app ? app.destino || app.clave : "whatsapp:"), "Abrir WhatsApp");
    el.querySelectorAll(".c").forEach((c) => {
      const x = contactos[Number(c.dataset.i)];
      L.tocable(c, () => L.lanzar(chat(x.numero)), "Escribirle a " + x.nombre);
    });
    return {};
  },
});

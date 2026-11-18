// Widget de una app instalada: su icono real (como en el escritorio de Android) y se abre con un clic.
Lienzo.bloque({
  tipo: "app",
  nombre: "App",
  icono: "apps",
  descripcion: "Cualquier app de tu computadora con su icono. Un clic y se abre.",
  opciones: [
    { id: "app", nombre: "App", tipo: "app", valor: null },
    { id: "estilo", nombre: "Estilo", tipo: "lista", valor: "icono", opciones: [["icono", "Icono"], ["tarjeta", "Tarjeta"], ["burbuja", "Burbuja"]] },
    { id: "etiqueta", nombre: "Mostrar el nombre", tipo: "si-no", valor: true },
    { id: "nombre", nombre: "Nombre a mostrar (opcional)", tipo: "texto", valor: "", ejemplo: "El de la app" },
  ],
  css: `
    .b-app { display: inline-flex; flex-direction: column; align-items: center; gap: 8px; }
    .b-app .ico { width: 64px; height: 64px; border-radius: 18px; display: flex; align-items: center; justify-content: center;
      font-size: 28px; font-weight: 700; color: #fff; background: hsl(var(--tono), 55%, 45%) center / 78% no-repeat; }
    .b-app .ico.con-imagen { background-color: transparent; background-size: contain; filter: drop-shadow(0 6px 14px rgba(0,0,0,.35)); }
    .b-app .nom { font-size: 13.5px; font-weight: 600; max-width: 110px; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .b-app.e-burbuja .ico { width: 76px; height: 76px; border-radius: 50%; background-color: rgba(var(--superficie-rgb), var(--opacidad));
      -webkit-backdrop-filter: blur(16px); backdrop-filter: blur(16px); border: 1px solid rgba(var(--texto-rgb), .1); box-shadow: var(--sombra-caja); }
    .b-app.e-burbuja .ico.con-imagen { background-size: 54%; filter: none; }
    .b-app.e-tarjeta { flex-direction: row; gap: 14px; padding: 12px 18px 12px 12px; border-radius: var(--radio); text-shadow: none;
      background: rgba(var(--superficie-rgb), var(--opacidad)); -webkit-backdrop-filter: blur(20px) saturate(1.5); backdrop-filter: blur(20px) saturate(1.5);
      border: 1px solid rgba(var(--texto-rgb), .08); box-shadow: var(--sombra-caja); min-width: 220px; }
    .b-app.e-tarjeta .ico { width: 52px; height: 52px; border-radius: 14px; }
    .b-app.e-tarjeta .nom { font-size: 16px; max-width: 220px; text-align: left; }
    .b-app.e-tarjeta .sub { font-size: 12px; color: var(--tenue); margin-top: 2px; }
    .b-app.e-tarjeta .flecha { margin-left: auto; color: var(--acento); width: 18px; height: 18px; }
    .b-app.vacia .ico { background: rgba(var(--texto-rgb), .12); color: var(--tenue); }
    .b-app .ico svg { width: 26px; height: 26px; }
  `,
  crear(el, ctx) {
    const o = ctx.opciones, L = Lienzo, esc = L.escapar;
    const app = o.app && o.app.clave ? o.app : null;
    const nombre = (o.nombre || "").trim() || (app ? app.nombre : "Elige una app");
    el.classList.add("b-app", "e-" + o.estilo);
    el.classList.toggle("vacia", !app);
    const conNombre = o.etiqueta || o.estilo === "tarjeta";
    el.innerHTML = `<div class="ico" style="--tono:${L.tonoDe(nombre)}">${app ? esc(L.inicial(nombre)) : L.icono("mas")}</div>` +
      (o.estilo === "tarjeta"
        ? `<div><div class="nom">${esc(nombre)}</div><div class="sub">${app ? "Toca para abrir" : "En el modo edición"}</div></div>${L.icono("derecha", "flecha")}`
        : conNombre ? `<div class="nom">${esc(nombre)}</div>` : "");
    if (!app) return {};
    const ic = el.querySelector(".ico");
    L.iconoApp(app.clave, 128, (url) => {
      if (!url) return;
      ic.textContent = "";
      ic.classList.add("con-imagen");
      ic.style.backgroundImage = `url("${url}")`;
    });
    L.tocable(o.estilo === "tarjeta" ? el : ic, () => L.lanzar(app.destino || app.clave), "Abrir " + nombre);
    return {};
  },
});

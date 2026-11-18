// Varias apps juntas, como el dock o una carpeta de Android. Cada icono se abre con un clic.
Lienzo.bloque({
  tipo: "atajos",
  nombre: "Atajos de apps",
  icono: "cuadros",
  descripcion: "Un dock o una carpeta con tus apps favoritas.",
  opciones: [
    { id: "apps", nombre: "Apps", tipo: "apps", valor: [], max: 12 },
    { id: "estilo", nombre: "Estilo", tipo: "lista", valor: "dock", opciones: [["dock", "Dock"], ["cuadricula", "Cuadrícula"], ["columna", "Columna"]] },
    { id: "etiqueta", nombre: "Mostrar los nombres", tipo: "si-no", valor: false },
    { id: "tamano", nombre: "Tamaño de los iconos", tipo: "rango", min: 32, max: 72, paso: 4, valor: 48 },
  ],
  comunes: { fondo: "vidrio" },
  css: `
    .b-atajos { display: flex; gap: 14px; --t: 48px; }
    .b-atajos.e-cuadricula { display: grid; grid-template-columns: repeat(var(--cols), auto); gap: 16px 18px; }
    .b-atajos.e-columna { flex-direction: column; gap: 10px; }
    .b-atajos .at { display: flex; flex-direction: column; align-items: center; gap: 6px; }
    .b-atajos.e-columna .at { flex-direction: row; gap: 12px; }
    .b-atajos .ico { width: var(--t); height: var(--t); border-radius: calc(var(--t) * .28); display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: calc(var(--t) * .42); color: #fff; background: hsl(var(--tono), 55%, 45%) center / contain no-repeat; flex: none; }
    .b-atajos .ico.con-imagen { background-color: transparent; }
    .b-atajos .nom { font-size: 12px; max-width: calc(var(--t) + 34px); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: center; }
    .b-atajos.e-columna .nom { font-size: 14px; max-width: 200px; text-align: left; }
    .b-atajos .vacio { color: var(--tenue); font-size: 13.5px; max-width: 220px; }
  `,
  crear(el, ctx) {
    const o = ctx.opciones, L = Lienzo, esc = L.escapar;
    const apps = (Array.isArray(o.apps) ? o.apps : []).filter((a) => a && a.clave);
    el.classList.add("b-atajos", "e-" + o.estilo);
    el.style.setProperty("--t", (Number(o.tamano) || 48) + "px");
    el.style.setProperty("--cols", String(Math.min(4, Math.max(1, Math.ceil(Math.sqrt(apps.length))))));
    if (!apps.length) {
      el.innerHTML = `<div class="vacio">Agrega apps desde el modo edición (botón «Añadir app»).</div>`;
      return {};
    }
    const conNombre = o.etiqueta || o.estilo === "columna";
    el.innerHTML = apps.map((a, i) => `<div class="at" data-i="${i}"><div class="ico" style="--tono:${L.tonoDe(a.nombre)}">${esc(L.inicial(a.nombre))}</div>
      ${conNombre ? `<div class="nom">${esc(a.nombre)}</div>` : ""}</div>`).join("");
    el.querySelectorAll(".at").forEach((at) => {
      const a = apps[Number(at.dataset.i)], ic = at.querySelector(".ico");
      L.iconoApp(a.clave, 128, (url) => {
        if (!url) return;
        ic.textContent = "";
        ic.classList.add("con-imagen");
        ic.style.backgroundImage = `url("${url}")`;
      });
      L.tocable(at, () => L.lanzar(a.destino || a.clave), "Abrir " + a.nombre);
    });
    return {};
  },
});

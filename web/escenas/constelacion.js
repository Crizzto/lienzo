// Constelaciones: estrellas que flotan, se unen con líneas cuando están cerca y reaccionan al cursor.
// Las parejas cercanas se buscan con una rejilla espacial (no se compara cada estrella con todas).
(function () {
  "use strict";
  const U = Lienzo.util;
  const TAU = Math.PI * 2;

  Lienzo.escena({
    id: "constelacion",
    nombre: "Constelaciones",
    descripcion: "Estrellas que se unen con líneas y siguen tu cursor.",
    tipo: "2d",
    fpsMax: 30,
    paleta: { fondo: "#0b0d1a", superficie: "#161a2e", texto: "#eef1ff", tenue: "#9aa3c7", acento: "#8be9fd", acento2: "#c3a6ff" },
    opciones: [
      { id: "cantidad", nombre: "Estrellas", tipo: "rango", min: 40, max: 200, paso: 10, valor: 120 },
      { id: "distancia", nombre: "Distancia de unión", tipo: "rango", min: 60, max: 220, paso: 10, valor: 120 },
      { id: "color", nombre: "Color de las líneas", tipo: "color", valor: "#8be9fd" },
      { id: "raton", nombre: "Con el cursor", tipo: "lista", opciones: [["atraer", "Atraer"], ["repeler", "Repeler"], ["ninguno", "Nada"]], valor: "atraer" },
      { id: "velocidad", nombre: "Velocidad", tipo: "rango", min: 0, max: 2, paso: 0.1, valor: 1 },
    ],

    crear(lienzo, ctx) {
      const g = ctx.g;
      const azar = U.azar(7351);
      let W = 1, H = 1, fondo = null, puntos = [];

      function pintarFondo() {
        if (!fondo) fondo = document.createElement("canvas");
        fondo.width = W; fondo.height = H;
        const q = fondo.getContext("2d");
        const gr = q.createRadialGradient(W * 0.5, H * 0.42, 0, W * 0.5, H * 0.5, Math.hypot(W, H) * 0.62);
        gr.addColorStop(0, "#171c3b"); gr.addColorStop(0.55, "#0b0e20"); gr.addColorStop(1, "#04050b");
        q.fillStyle = gr;
        q.fillRect(0, 0, W, H);
        const r = U.azar(42), tonos = ["#3b2f7a", "#1f4f7a", "#5a2a6e"];
        for (let i = 0; i < 6; i++) {
          const x = r() * W, y = r() * H, rad = (0.18 + r() * 0.3) * Math.max(W, H);
          const n = q.createRadialGradient(x, y, 0, x, y, rad);
          n.addColorStop(0, U.rgba(tonos[i % 3], 0.2));
          n.addColorStop(1, U.rgba(tonos[i % 3], 0));
          q.fillStyle = n;
          q.fillRect(0, 0, W, H);
        }
        // polvo de estrellas fijas (no se animan: cuestan cero)
        const total = Math.round((W * H) / (2600 * ctx.escala * ctx.escala));
        for (let i = 0; i < total; i++) {
          q.fillStyle = `rgba(255,255,255,${(0.12 + r() * 0.4).toFixed(2)})`;
          const s = (0.5 + r() * 1.1) * ctx.escala;
          q.fillRect(r() * W, r() * H, s, s);
        }
      }

      function nuevoPunto() {
        const a = azar() * TAU, v = 6 + azar() * 14;
        return { x: azar() * W, y: azar() * H, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 0.9 + azar() * 1.6, f: azar() * TAU, color: azar() < 0.3 };
      }

      function ajustarCantidad() {
        const n = Math.max(10, Math.round(Number(ctx.opciones.cantidad) || 120));
        while (puntos.length < n) puntos.push(nuevoPunto());
        if (puntos.length > n) puntos.length = n;
      }

      return {
        redimensionar(ancho, alto) {
          const kx = ancho / W, ky = alto / H;
          puntos.forEach((p) => { p.x *= kx; p.y *= ky; });
          W = ancho; H = alto;
          pintarFondo();
          ajustarCantidad();
        },

        cuadro(t, dt) {
          const o = ctx.opciones, e = ctx.escala;
          ajustarCantidad();
          const D = (Number(o.distancia) || 140) * e, D2 = D * D;
          const vel = Number(o.velocidad);
          const k = (isNaN(vel) ? 1 : vel) * e;
          const m = ctx.mouse, mx = m.x * W, my = m.y * H;
          const conRaton = m.activo && o.raton !== "ninguno";
          const R = D * 1.4;

          if (dt > 0) {
            for (const p of puntos) {
              p.x += p.vx * k * dt;
              p.y += p.vy * k * dt;
              if (conRaton) {
                const dx = mx - p.x, dy = my - p.y, d2 = dx * dx + dy * dy;
                if (d2 < R * R && d2 > 1) {
                  const d = Math.sqrt(d2), f = (1 - d / R) * 55 * e * dt * (o.raton === "repeler" ? -1 : 0.6);
                  p.x += (dx / d) * f;
                  p.y += (dy / d) * f;
                }
              }
              const borde = 20 * e;
              if (p.x < -borde) p.x += W + 2 * borde; else if (p.x > W + borde) p.x -= W + 2 * borde;
              if (p.y < -borde) p.y += H + 2 * borde; else if (p.y > H + borde) p.y -= H + 2 * borde;
            }
          }

          g.globalAlpha = 1;
          g.drawImage(fondo, 0, 0);

          // Rejilla espacial: cada estrella solo se compara con las de su celda y las vecinas.
          const cols = Math.max(1, Math.ceil(W / D)), filas = Math.max(1, Math.ceil(H / D));
          const celdaDe = (p) => {
            const cx = Math.min(cols - 1, Math.max(0, Math.floor(p.x / D)));
            const cy = Math.min(filas - 1, Math.max(0, Math.floor(p.y / D)));
            return [cx, cy];
          };
          const rejilla = new Map();
          puntos.forEach((p, i) => {
            const [cx, cy] = celdaDe(p), c = cx + cy * cols;
            let l = rejilla.get(c);
            if (!l) rejilla.set(c, (l = []));
            l.push(i);
          });
          const cubetas = [[], [], [], []]; // líneas agrupadas por opacidad: pocos cambios de estado al dibujar
          const vecinas = [[0, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
          for (let i = 0; i < puntos.length; i++) {
            const p = puntos[i], [cx, cy] = celdaDe(p);
            for (const [ox, oy] of vecinas) {
              const nx = cx + ox, ny = cy + oy;
              if (nx < 0 || nx >= cols || ny >= filas) continue;
              const l = rejilla.get(nx + ny * cols);
              if (!l) continue;
              for (const j of l) {
                if (ox === 0 && oy === 0 && j <= i) continue;
                const q = puntos[j], dx = p.x - q.x, dy = p.y - q.y, d2 = dx * dx + dy * dy;
                if (d2 < D2) cubetas[Math.min(3, Math.floor((1 - Math.sqrt(d2) / D) * 4))].push(p.x, p.y, q.x, q.y);
              }
            }
          }
          g.lineWidth = Math.max(1, e);
          g.strokeStyle = o.color || "#8be9fd";
          cubetas.forEach((c, b) => {
            if (!c.length) return;
            g.globalAlpha = 0.07 + b * 0.11;
            g.beginPath();
            for (let i = 0; i < c.length; i += 4) { g.moveTo(c[i], c[i + 1]); g.lineTo(c[i + 2], c[i + 3]); }
            g.stroke();
          });

          if (conRaton) {
            g.strokeStyle = (ctx.paleta && ctx.paleta.acento2) || "#c3a6ff";
            g.globalAlpha = 0.22;
            g.beginPath();
            for (const p of puntos) {
              const dx = p.x - mx, dy = p.y - my;
              if (dx * dx + dy * dy < R * R) { g.moveTo(mx, my); g.lineTo(p.x, p.y); }
            }
            g.stroke();
          }

          for (const p of puntos) {
            g.globalAlpha = 0.55 + 0.45 * Math.sin(t * 1.7 + p.f);
            g.fillStyle = p.color ? o.color || "#8be9fd" : "#ffffff";
            g.beginPath();
            g.arc(p.x, p.y, p.r * e, 0, TAU);
            g.fill();
          }
          g.globalAlpha = 1;
        },

        destruir() {
          if (fondo) fondo.width = fondo.height = 0;
          fondo = null;
          puntos = [];
        },
      };
    },
  });
})();

// Aurora boreal: cortinas de luz hechas con ruido (fbm) en un shader, sobre un cielo estrellado,
// montañas, pinos y un lago opcional que refleja todo.
(function () {
  "use strict";

  // La fase de animación se acumula en JS y se envuelve cada PERIODO (8 h a velocidad 1). El ruido del
  // shader se repite cada 289 unidades y todas las velocidades del shader son múltiplos de 0.01, así que
  // el salto no se nota y el número que llega al shader nunca crece tanto como para perder precisión.
  const PERIODO = 289 * 100;

  const COLORES = {
    verde: [[0.18, 1.0, 0.55], [0.08, 0.85, 0.78], [0.62, 0.3, 1.0]],
    violeta: [[0.55, 0.32, 1.0], [0.95, 0.35, 0.85], [0.28, 0.55, 1.0]],
    arcoiris: [[1, 1, 1], [1, 1, 1], [1, 1, 1]],
  };

  const FRAG = `
precision mediump float;
uniform vec2 u_res;
uniform float u_t;
uniform float u_int;
uniform float u_lago;
uniform float u_arco;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;
uniform vec2 u_mouse;

float hash(vec2 p) {
  p = mod(p, 289.0);
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
float ruido(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { s += a * ruido(p); p = p * 2.0 + vec2(13.0, 7.0); a *= 0.5; }
  return s / 0.875;
}
vec3 hsv(float h, float s, float v) {
  vec3 k = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return v * mix(vec3(1.0), k, s);
}

// Tres cortinas. Cada una tiene un borde inferior ondulado y brillante (núcleo) y una cola alta y tenue
// hecha de rayos verticales; el color cambia con la altura y la cola se apaga suave antes de cortarse.
vec3 aurora(vec2 p) {
  vec3 col = vec3(0.0);
  float t = u_t;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    // cada cortina cruza el cielo en diagonal (la del medio al revés) y ondula con el ruido
    float xn = p.x / (u_res.x / u_res.y) - 0.5;
    float incl = (i == 1 ? -0.17 : 0.15) * xn;
    float ondas = fbm(vec2(p.x * 0.7 + t * 0.02 + fi * 5.0, fi * 2.0 + t * 0.01));
    float base = 0.46 + fi * 0.095 + incl + (ondas - 0.5) * 0.42 + 0.03 * (ruido(vec2(p.x * 5.0 + t * 0.1, fi * 11.0)) - 0.5);
    float d = p.y - base;
    if (d < -0.2 || d > 0.5) continue;
    float pliegue = fbm(vec2(p.x * 1.5 - t * 0.05, fi * 4.0 + 1.0));
    float xr = p.x * 7.0 + pliegue * 2.6 + t * 0.05 * (1.0 + fi);
    float r1 = ruido(vec2(xr * 4.0, fi * 3.0 + d * 2.0));
    float r2 = ruido(vec2(xr * 13.0, fi * 7.0 + d * 4.0));
    float rayos = 0.15 + 1.3 * r1 * r1 + 0.5 * r2 * r2;
    float dd = max(d, 0.0);
    float nucleo = exp(-dd / 0.04);
    float cola = exp(-dd / (0.13 + 0.04 * fi)) * smoothstep(0.5, 0.22, d);
    float abajo = smoothstep(-0.04, 0.0, d);
    float pulso = ruido(vec2(p.x * 1.6 + t * 0.05, fi * 9.0 + t * 0.03));
    pulso = 0.04 + 2.1 * pulso * pulso * pulso;
    float bajo = d < 0.0 ? exp(d / 0.055) * 0.1 : 0.0; // luz que se escapa por debajo del borde
    float k = ((nucleo * (0.45 + 0.55 * rayos) + cola * rayos * 0.6) * abajo + bajo) * pulso;
    float ch = clamp(d / 0.34, 0.0, 1.0);
    vec3 c;
    if (u_arco > 0.5) c = hsv(fract(p.x * 0.2 + ch * 0.35 + t * 0.01 + fi * 0.17), 0.7, 1.0);
    else c = mix(mix(u_c1, u_c2, smoothstep(0.05, 0.35, ch)), u_c3, smoothstep(0.25, 0.8, ch));
    c = mix(c, vec3(0.9, 1.0, 0.96), nucleo * 0.22);
    col += c * k * (i == 0 ? 0.8 : (i == 1 ? 0.55 : 0.4));
  }
  return col;
}

vec3 cielo(vec2 p) {
  vec3 c = mix(vec3(0.025, 0.075, 0.105), vec3(0.004, 0.01, 0.03), smoothstep(0.2, 1.0, p.y));
  vec2 g = p * 70.0;
  vec2 id = floor(g);
  float h = hash(id + 41.0);
  if (h > 0.9) {
    vec2 o = vec2(hash(id + 3.1), hash(id + 7.7)) * 0.6 + 0.2;
    float d = length(fract(g) - o);
    float tw = 0.65 + 0.35 * sin(u_t * (1.5 + h * 4.0) + h * 80.0);
    c += vec3(0.85, 0.9, 1.0) * smoothstep(0.22, 0.0, d) * (h - 0.9) * 12.0 * tw * smoothstep(0.3, 0.55, p.y);
  }
  return c;
}

float montes(float x) {
  float n = fbm(vec2(x * 1.7 + 3.0, 2.0));
  float cresta = 1.0 - abs(ruido(vec2(x * 4.5, 7.0)) * 2.0 - 1.0);
  return 0.012 + 0.07 * n * n + 0.03 * cresta * n;
}

// Pinos: una celda por árbol; se revisan las celdas vecinas porque las copas se enciman.
float pinos(vec2 p, float base) {
  float w = 0.026;
  float id = floor(p.x / w);
  float m = 0.0;
  float aa = 1.5 / u_res.y;
  for (int k = -1; k <= 1; k++) {
    float j = id + float(k);
    float h1 = hash(vec2(j, 5.0)), h2 = hash(vec2(j, 9.0));
    float alto = 0.025 + 0.07 * h1 * h1;
    float cx = (j + 0.5 + (h2 - 0.5) * 0.7) * w;
    float yy = (p.y - base) / alto;
    if (yy > 1.0) continue;
    float s = 1.0 - clamp(yy, 0.0, 1.0);
    float nivel = fract(s * 4.0 + h2 * 0.5);
    float mitad = alto * (0.3 * s * (0.62 + 0.38 * nivel) + 0.015);
    m = max(m, smoothstep(mitad + aa, mitad - aa, abs(p.x - cx)));
  }
  return m;
}

vec3 escena(vec2 p, float yS) {
  vec3 a = aurora(p + vec2(u_mouse.x * 0.006, 0.0)) * u_int;
  a = 1.0 - exp(-a * 1.35);
  vec3 c = cielo(p) + a;
  // luz difusa de la aurora cerca del horizonte
  vec3 tinte = (u_arco > 0.5 ? vec3(0.5, 0.6, 0.9) : u_c1) * u_int;
  c += tinte * 0.03 * smoothstep(0.7, yS, p.y);
  float hm = yS + montes(p.x + u_mouse.x * 0.012);
  float m = smoothstep(hm + 0.003, hm - 0.003, p.y);
  vec3 colMonte = vec3(0.016, 0.036, 0.055) + tinte * 0.03 * smoothstep(yS, hm, p.y);
  c = mix(c, colMonte, m);
  float pi = pinos(p + vec2(u_mouse.x * 0.025, 0.0), yS - 0.004);
  c = mix(c, vec3(0.003, 0.008, 0.012), pi);
  return c;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float asp = u_res.x / u_res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  float yS = u_lago > 0.5 ? 0.24 : 0.1;
  vec3 c;
  if (uv.y >= yS) {
    c = escena(p, yS);
  } else if (u_lago > 0.5) {
    float prof = (yS - uv.y) / yS;
    float onda = ruido(vec2(p.x * 3.0, uv.y * 150.0 - u_t * 0.6)) - 0.5;
    vec2 q = vec2(p.x + onda * 0.016 * (0.3 + prof), 2.0 * yS - uv.y + onda * 0.004);
    c = escena(q, yS) * (0.55 - 0.2 * prof);
    c += vec3(0.006, 0.014, 0.02) * (1.0 - prof);
  } else {
    // suelo nevado que recoge un poco de luz de la aurora
    vec3 tinte = (u_arco > 0.5 ? vec3(0.5, 0.6, 0.9) : u_c1) * u_int;
    c = vec3(0.02, 0.035, 0.05) + tinte * 0.03;
    c *= 0.6 + 0.4 * uv.y / yS;
    float pi = pinos(p + vec2(u_mouse.x * 0.025, 0.0), yS - 0.004);
    c = mix(c, vec3(0.003, 0.008, 0.012), pi);
  }
  vec2 v = uv - 0.5;
  c *= 1.0 - 0.35 * dot(v, v);
  c += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(c, 1.0);
}`;

  Lienzo.escena({
    id: "aurora",
    nombre: "Aurora boreal",
    descripcion: "Cortinas de luz que ondulan sobre un bosque de pinos y un lago tranquilo.",
    tipo: "webgl",
    fpsMax: 24,
    calidadMax: 0.5,
    paleta: { fondo: "#05111a", superficie: "#0c1e29", texto: "#e4fff4", tenue: "#7fa8a0", acento: "#3dffa6", acento2: "#b07cff" },
    opciones: [
      { id: "intensidad", nombre: "Intensidad", tipo: "rango", min: 0.2, max: 1.6, paso: 0.05, valor: 1 },
      { id: "velocidad", nombre: "Velocidad", tipo: "rango", min: 0, max: 3, paso: 0.1, valor: 1 },
      { id: "colores", nombre: "Colores", tipo: "lista", opciones: [["verde", "Verde"], ["violeta", "Violeta"], ["arcoiris", "Arcoíris"]], valor: "verde" },
      { id: "lago", nombre: "Lago con reflejo", tipo: "si-no", valor: true },
    ],

    crear(lienzo, ctx) {
      const gl = lienzo.getContext("webgl", { alpha: false, antialias: false, powerPreference: "low-power", preserveDrawingBuffer: false });
      if (!gl) throw new Error("Este equipo no tiene WebGL disponible para la aurora.");
      let pr = null, u = null, perdido = false;
      let fase = 0;

      function iniciar() {
        pr = Lienzo.util.programaPantalla(gl, FRAG);
        u = {};
        for (const n of ["u_res", "u_t", "u_int", "u_lago", "u_arco", "u_c1", "u_c2", "u_c3", "u_mouse"]) u[n] = pr.u(n);
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.BLEND);
      }
      iniciar();

      // Si el sistema reinicia la tarjeta de video, se recupera el contexto en lugar de quedarse en negro.
      const alPerder = (ev) => { ev.preventDefault(); perdido = true; };
      const alRecuperar = () => { perdido = false; iniciar(); gl.viewport(0, 0, lienzo.width, lienzo.height); };
      lienzo.addEventListener("webglcontextlost", alPerder);
      lienzo.addEventListener("webglcontextrestored", alRecuperar);

      return {
        redimensionar(ancho, alto) {
          if (!perdido) gl.viewport(0, 0, ancho, alto);
        },

        cuadro(t, dt) {
          if (perdido || gl.isContextLost()) return;
          const o = ctx.opciones;
          if (dt > 0) fase = (fase + dt * Math.max(0, Number(o.velocidad) || 0)) % PERIODO;
          const cols = COLORES[o.colores] || COLORES.verde;
          gl.uniform2f(u.u_res, lienzo.width, lienzo.height);
          gl.uniform1f(u.u_t, fase);
          gl.uniform1f(u.u_int, Math.max(0, Number(o.intensidad) || 0));
          gl.uniform1f(u.u_lago, o.lago ? 1 : 0);
          gl.uniform1f(u.u_arco, o.colores === "arcoiris" ? 1 : 0);
          gl.uniform3fv(u.u_c1, cols[0]);
          gl.uniform3fv(u.u_c2, cols[1]);
          gl.uniform3fv(u.u_c3, cols[2]);
          gl.uniform2f(u.u_mouse, (ctx.mouse.x - 0.5) * 2, (ctx.mouse.y - 0.5) * 2);
          pr.dibujar();
        },

        destruir() {
          lienzo.removeEventListener("webglcontextlost", alPerder);
          lienzo.removeEventListener("webglcontextrestored", alRecuperar);
          if (pr && !gl.isContextLost()) pr.destruir();
          pr = null;
        },
      };
    },
  });
})();

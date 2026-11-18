// Motor de escenas animadas de Lienzo.
// Cada escena es un archivo web/escenas/<id>.js que llama a Lienzo.escena({...}). Ver LEEME para el formato.
(function () {
  "use strict";
  const L = (window.Lienzo = window.Lienzo || {});
  const registro = (L.escenas = L.escenas || {});

  L.escena = function (def) {
    if (!def || !def.id || typeof def.crear !== "function") throw new Error("Escena inválida");
    registro[def.id] = def;
  };

  L.opcionesPorDefecto = function (def) {
    const o = {};
    (def.opciones || []).forEach((op) => { o[op.id] = op.valor; });
    return o;
  };

  /**
   * Reproduce una escena en un <canvas> a pantalla completa.
   * ajustes: { fps: 30, calidad: 0.75 (escala de resolución, 0.25–1), paleta: {fondo, texto, acento, ...} }
   */
  class MotorEscena {
    constructor(lienzo, def, opciones, ajustes) {
      this.lienzo = lienzo;
      this.def = def;
      this.ajustes = Object.assign({ fps: 30, calidad: 0.75, paleta: {} }, ajustes || {});
      this.opciones = Object.assign(L.opcionesPorDefecto(def), opciones || {});
      this.mouse = { x: 0.5, y: 0.5, objetivoX: 0.5, objetivoY: 0.5, activo: false };
      this.pausado = false;
      this.t = 0;
      this.ultimo = 0;
      this.rafId = 0;
      this.destruido = false;
      this.dimensionar();
      const g = def.tipo === "webgl" ? null : lienzo.getContext("2d", { alpha: false, desynchronized: true });
      this.contexto = {
        g,
        opciones: this.opciones,
        mouse: this.mouse,
        paleta: this.ajustes.paleta || {},
        calidad: this.calidad(),
        dpr: window.devicePixelRatio || 1,
        // Escala en píxeles del lienzo por cada px CSS (para grosores de línea, tamaños de partículas, etc.)
        escala: this.escalaTotal(),
      };
      this.inst = def.crear(lienzo, this.contexto) || {};
      if (this.inst.redimensionar) this.inst.redimensionar(lienzo.width, lienzo.height);
      this.bucle = this.bucle.bind(this);
      this.alRedimensionar = () => {
        clearTimeout(this._tRedim);
        this._tRedim = setTimeout(() => this.redimensionar(), 120);
      };
      if (!this.ajustes.tamano) addEventListener("resize", this.alRedimensionar);
      this.rafId = requestAnimationFrame(this.bucle);
    }

    /** Avanza la escena unos segundos de golpe (para miniaturas estáticas en el panel). */
    simular(segundos) {
      const n = Math.max(1, Math.round(segundos * 30));
      for (let i = 0; i < n; i++) {
        this.t += 1 / 30;
        try { this.inst.cuadro(this.t, 1 / 30); } catch (e) { console.error(e); return; }
      }
    }

    calidad() {
      const c = Number(this.ajustes.calidad) || 0.75;
      const max = this.def.calidadMax || 1;
      return Math.max(0.25, Math.min(max, c));
    }

    escalaTotal() {
      return (window.devicePixelRatio || 1) * this.calidad();
    }

    // ajustes.tamano = [ancho, alto] en px CSS para miniaturas (si no, ocupa toda la ventana).
    dimensionar() {
      const e = this.escalaTotal();
      const t = this.ajustes.tamano;
      const w = Math.max(1, Math.round((t ? t[0] : innerWidth) * e));
      const h = Math.max(1, Math.round((t ? t[1] : innerHeight) * e));
      if (this.lienzo.width !== w) this.lienzo.width = w;
      if (this.lienzo.height !== h) this.lienzo.height = h;
    }

    redimensionar() {
      if (this.destruido) return;
      this.dimensionar();
      this.contexto.escala = this.escalaTotal();
      this.contexto.calidad = this.calidad();
      if (this.inst.redimensionar) this.inst.redimensionar(this.lienzo.width, this.lienzo.height);
      if (this.pausado && this.inst.cuadro) this.inst.cuadro(this.t, 0); // que no quede en blanco al pausar
    }

    fpsObjetivo() {
      const f = Number(this.ajustes.fps) || 30;
      return Math.max(5, Math.min(this.def.fpsMax || 60, f));
    }

    bucle(ahora) {
      if (this.destruido || this.pausado) { this.rafId = 0; return; }
      this.rafId = requestAnimationFrame(this.bucle);
      const intervalo = 1000 / this.fpsObjetivo();
      if (this.ultimo && ahora - this.ultimo < intervalo - 3) return;
      const dt = this.ultimo ? Math.min((ahora - this.ultimo) / 1000, 0.1) : 1 / 30;
      this.ultimo = ahora;
      this.t += dt;
      const m = this.mouse;
      const k = Math.min(1, dt * 3.5);
      m.x += (m.objetivoX - m.x) * k;
      m.y += (m.objetivoY - m.y) * k;
      try { this.inst.cuadro(this.t, dt); } catch (e) { console.error(e); this.pausado = true; }
    }

    pausar(p) {
      p = !!p;
      if (p === this.pausado || this.destruido) return;
      this.pausado = p;
      if (!p) {
        this.ultimo = 0;
        if (!this.rafId) this.rafId = requestAnimationFrame(this.bucle);
      }
    }

    ponerMouse(x, y) {
      this.mouse.objetivoX = x;
      this.mouse.objetivoY = y;
      this.mouse.activo = true;
    }

    cambiarAjustes(a) {
      const antes = this.calidad();
      Object.assign(this.ajustes, a);
      if (a.paleta) Object.assign(this.contexto.paleta, a.paleta);
      if (this.calidad() !== antes) this.redimensionar();
    }

    /** Copia del cuadro actual reducida (para sacar la paleta de colores). */
    muestra(ancho) {
      const w = ancho || 64, h = Math.max(1, Math.round(w * this.lienzo.height / this.lienzo.width));
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      const g = c.getContext("2d", { willReadFrequently: true });
      if (this.inst.cuadro && this.def.tipo === "webgl") this.inst.cuadro(this.t, 0); // el búfer WebGL se borra tras cada cuadro
      g.drawImage(this.lienzo, 0, 0, w, h);
      return c;
    }

    destruir() {
      this.destruido = true;
      if (this.rafId) cancelAnimationFrame(this.rafId);
      removeEventListener("resize", this.alRedimensionar);
      try { if (this.inst.destruir) this.inst.destruir(); } catch (e) { console.error(e); }
    }
  }

  L.MotorEscena = MotorEscena;

  // ---- Utilidades para escribir escenas ----
  L.util = {
    // Generador pseudoaleatorio con semilla (las escenas se ven igual cada vez).
    azar(semilla) {
      let s = (semilla >>> 0) || 1;
      return function () {
        s ^= s << 13; s >>>= 0;
        s ^= s >>> 17;
        s ^= s << 5; s >>>= 0;
        return s / 4294967296;
      };
    },
    hexARgb(hex) {
      const h = String(hex || "#000").replace("#", "");
      const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6), 16) || 0;
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    },
    rgba(hex, a) {
      const [r, g, b] = L.util.hexARgb(hex);
      return `rgba(${r},${g},${b},${a})`;
    },
    mezclar(hexA, hexB, t) {
      const a = L.util.hexARgb(hexA), b = L.util.hexARgb(hexB);
      const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
      return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
    },
    // Compila un programa WebGL de pantalla completa (un triángulo grande + shader de fragmentos).
    programaPantalla(gl, fuenteFragmento) {
      const vs = "attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }";
      const compilar = (tipo, src) => {
        const s = gl.createShader(tipo);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
      };
      const prog = gl.createProgram();
      gl.attachShader(prog, compilar(gl.VERTEX_SHADER, vs));
      gl.attachShader(prog, compilar(gl.FRAGMENT_SHADER, fuenteFragmento));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, "p");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      gl.useProgram(prog);
      return {
        prog,
        u: (nombre) => gl.getUniformLocation(prog, nombre),
        dibujar: () => gl.drawArrays(gl.TRIANGLES, 0, 3),
        destruir: () => { gl.deleteBuffer(buf); gl.deleteProgram(prog); },
      };
    },
  };
})();

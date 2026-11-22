package app.lienzo;

import android.app.Presentation;
import android.app.WallpaperColors;
import android.app.WallpaperManager;
import android.graphics.Color;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.os.Bundle;
import android.service.wallpaper.WallpaperService;
import android.util.Log;
import android.view.SurfaceHolder;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;

import org.json.JSONObject;

/**
 * El fondo de pantalla animado. Cada «motor» (el fondo real y la vista previa del selector de Android)
 * muestra escritorio.html en un WebView. El WebView vive en una pantalla virtual cuyo lienzo es la
 * superficie del fondo: así se dibuja con la tarjeta gráfica igual que en Chrome (WebGL, videos, CSS).
 * Los toques llegan como «tap» del lanzador (en los espacios vacíos de la pantalla de inicio).
 */
public class FondoServicio extends WallpaperService {
    @Override
    public Engine onCreateEngine() { return new Motor(); }

    private final class Motor extends Engine implements Web.Receptor, Web.Recargable, Nucleo.Anfitrion {
        private Nucleo nucleo;
        private VirtualDisplay pantalla;
        private Presentation presentacion;
        private Web web;
        private int ancho, alto;
        private boolean visible;
        private int[] colores; // acento, acento2, fondo (para Material You)

        private final Runnable alCambiarConfig = this::actualizarColores;
        private final Runnable alCambiarAhorro = () -> enviar(nucleo.pausa(visible));

        @Override
        public void onCreate(SurfaceHolder holder) {
            super.onCreate(holder);
            nucleo = Nucleo.de(FondoServicio.this);
            setOffsetNotificationsEnabled(true);
            setTouchEventsEnabled(false);
            nucleo.alCambiarConfig(alCambiarConfig);
            nucleo.alCambiarAhorro(alCambiarAhorro);
            colores = coloresDeConfig(nucleo.config());
        }

        @Override
        public void onSurfaceChanged(SurfaceHolder holder, int format, int w, int h) {
            super.onSurfaceChanged(holder, format, w, h);
            if (w <= 0 || h <= 0) return;
            int dpi = getResources().getDisplayMetrics().densityDpi;
            ancho = w; alto = h;
            if (pantalla == null) {
                crear(holder, dpi);
            } else {
                pantalla.resize(w, h, dpi);
                pantalla.setSurface(holder.getSurface());
            }
        }

        private void crear(SurfaceHolder holder, int dpi) {
            try {
                DisplayManager dm = (DisplayManager) getSystemService(DISPLAY_SERVICE);
                // Pantalla privada (sin banderas): solo Lienzo puede dibujar en ella.
                pantalla = dm.createVirtualDisplay("lienzo-fondo", ancho, alto, dpi, holder.getSurface(), 0);
                presentacion = new Presentation(FondoServicio.this, pantalla.getDisplay());
                Window ventana = presentacion.getWindow();
                if (ventana != null) {
                    ventana.addFlags(WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED);
                    ventana.setBackgroundDrawable(new android.graphics.drawable.ColorDrawable(Color.BLACK));
                }
                web = new Web(presentacion.getContext(), "fondo", "escritorio.html?principal=1", this);
                presentacion.setContentView(web.vista, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
                presentacion.show();
                nucleo.registrar(this);
            } catch (Exception e) {
                Log.e(Web.TAG, "No se pudo crear el fondo", e);
                cerrar();
            }
        }

        @Override
        public void onSurfaceDestroyed(SurfaceHolder holder) {
            cerrar();
            super.onSurfaceDestroyed(holder);
        }

        private void cerrar() {
            if (visible) { visible = false; nucleo.visible(false); }
            nucleo.quitar(this);
            if (web != null) { web.destruir(); web = null; }
            if (presentacion != null) { try { presentacion.dismiss(); } catch (Exception e) { /* ya cerrada */ } presentacion = null; }
            if (pantalla != null) { pantalla.release(); pantalla = null; }
        }

        @Override
        public void onDestroy() {
            nucleo.quitarAlCambiarConfig(alCambiarConfig);
            nucleo.quitarAlCambiarAhorro(alCambiarAhorro);
            cerrar();
            super.onDestroy();
        }

        @Override
        public void onVisibilityChanged(boolean v) {
            if (v == visible) return;
            visible = v;
            nucleo.visible(v);
            if (web != null) {
                if (v) web.vista.onResume(); else web.vista.onPause();
                enviar(nucleo.pausa(v));
            }
        }

        // Al deslizar entre las páginas de la pantalla de inicio: el fondo se mueve un poco (parallax).
        @Override
        public void onOffsetsChanged(float xOffset, float yOffset, float xStep, float yStep, int xPixels, int yPixels) {
            JSONObject m = Nucleo.mensaje("desplazar");
            Nucleo.put(m, "x", xStep > 0 && xStep < 1 ? xOffset : 0.5);
            Nucleo.put(m, "y", 0.5);
            enviar(m);
        }

        @Override
        public Bundle onCommand(String action, int x, int y, int z, Bundle extras, boolean resultRequested) {
            if (WallpaperManager.COMMAND_TAP.equals(action) && ancho > 0 && alto > 0) {
                JSONObject m = Nucleo.mensaje("toque");
                Nucleo.put(m, "x", x / (double) ancho);
                Nucleo.put(m, "y", y / (double) alto);
                enviar(m);
            }
            return null;
        }

        // ---------------- Material You: Android toma los colores del fondo ----------------

        @Override
        public WallpaperColors onComputeColors() {
            int[] c = colores != null ? colores : new int[] { Color.parseColor("#ff7eb6"), Color.parseColor("#7ee8fa"), Color.parseColor("#12101c") };
            return new WallpaperColors(Color.valueOf(c[0]), Color.valueOf(c[1]), Color.valueOf(c[2]), 0);
        }

        private void actualizarColores() { ponerColores(coloresDeConfig(nucleo.config())); }

        private void ponerColores(int[] nuevos) {
            if (nuevos == null || java.util.Arrays.equals(nuevos, colores)) return;
            colores = nuevos;
            notifyColorsChanged();
        }

        private int[] coloresDeConfig(JSONObject config) {
            JSONObject p = config == null ? null : config.optJSONObject("paleta");
            return coloresDe(p == null ? null : p.optJSONObject("colores"));
        }

        private int[] coloresDe(JSONObject c) {
            if (c == null) return null;
            try {
                return new int[] { Color.parseColor(c.getString("acento")), Color.parseColor(c.getString("acento2")), Color.parseColor(c.getString("fondo")) };
            } catch (Exception e) { return null; }
        }

        // ---------------- Página ----------------

        @Override
        public void recibir(Web w, JSONObject m) {
            switch (m.optString("tipo")) {
                case "listo":
                    nucleo.saludar(this);
                    enviar(nucleo.pausa(visible));
                    break;
                case "paletaCalculada":
                    // Colores sacados del fondo (como pywal). No se guardan aquí (eso lo hace el panel):
                    // solo se le pasan a Android para que pinte el sistema con ellos.
                    JSONObject p = nucleo.config().optJSONObject("paleta");
                    if (p != null && "auto".equals(p.optString("modo"))) ponerColores(coloresDe(m.optJSONObject("colores")));
                    break;
                case "media":
                    nucleo.musica.accion(m.optString("accion", "pausa"));
                    break;
                case "lanzar":
                    PanelActivity.abrirDestino(FondoServicio.this, m.optString("destino"));
                    break;
            }
        }

        @Override
        public void recargar(Web w) {
            if (presentacion == null || pantalla == null) return;
            SurfaceHolder h = getSurfaceHolder();
            int dpi = getResources().getDisplayMetrics().densityDpi;
            cerrar();
            crear(h, dpi);
            if (isVisible()) onVisibilityChanged(true);
        }

        // Nucleo.Anfitrion
        @Override public String pagina() { return "fondo"; }
        @Override public boolean lista() { return web != null && web.lista; }
        @Override public void enviar(JSONObject m) { if (web != null) web.enviar(m); }
    }
}

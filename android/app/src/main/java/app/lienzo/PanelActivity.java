package app.lienzo;

import android.app.Activity;
import android.app.WallpaperManager;
import android.content.ComponentName;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import android.provider.Settings;
import android.util.Log;
import android.view.WindowInsets;
import android.webkit.MimeTypeMap;
import android.widget.Toast;
import android.window.OnBackInvokedDispatcher;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Locale;

/**
 * El panel de Lienzo en el teléfono: movil.html a pantalla completa (de borde a borde).
 * Desde aquí se eligen temas, escenas, fotos, bloques y colores, y se pone Lienzo como fondo.
 */
public class PanelActivity extends Activity implements Web.Receptor, Web.Recargable {
    private static final int ELEGIR = 7;
    private Nucleo nucleo;
    private Web web;
    private float densidad;
    private int insetArriba, insetAbajo;

    @Override
    protected void onCreate(Bundle guardado) {
        super.onCreate(guardado);
        nucleo = Nucleo.de(this);
        densidad = getResources().getDisplayMetrics().density;
        getWindow().setDecorFitsSystemWindows(false);
        crearWeb();
        // Atrás: primero lo resuelve la página (cerrar la vista en grande); si no hay nada que cerrar, sale.
        getOnBackInvokedDispatcher().registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, () -> {
            if (web != null && web.lista) web.enviar(Nucleo.mensaje("atras"));
            else finish();
        });
    }

    private void crearWeb() {
        web = new Web(this, "panel", "movil.html", this);
        web.vista.setOnApplyWindowInsetsListener((v, ins) -> {
            android.graphics.Insets b = ins.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
            insetArriba = Math.round(b.top / densidad);
            insetAbajo = Math.round(b.bottom / densidad);
            enviarEstado();
            return ins;
        });
        setContentView(web.vista);
        nucleo.registrar(web);
    }

    @Override
    public void recargar(Web w) {
        nucleo.quitar(web);
        web.destruir();
        crearWeb();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.vista.onResume();
        nucleo.visible(true);
        nucleo.musica.iniciar(); // por si acaba de dar el permiso de música
        enviarEstado();
        JSONObject p = Nucleo.mensaje("pausa");
        Nucleo.put(p, "pausado", false);
        web.enviar(p);
    }

    @Override
    protected void onPause() {
        nucleo.visible(false);
        web.vista.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        nucleo.quitar(web);
        web.destruir();
        super.onDestroy();
    }

    private void enviarEstado() {
        if (web == null) return;
        JSONObject m = Nucleo.mensaje("estado");
        Nucleo.put(m, "activo", nucleo.esElFondo());
        Nucleo.put(m, "musica", nucleo.musica.permitida());
        Nucleo.put(m, "version", nucleo.version());
        Nucleo.put(m, "dispositivo", nucleo.nombreTelefono() + " · Android " + Build.VERSION.RELEASE);
        JSONObject ins = new JSONObject();
        Nucleo.put(ins, "arriba", insetArriba);
        Nucleo.put(ins, "abajo", insetAbajo);
        Nucleo.put(m, "insets", ins);
        web.enviar(m);
    }

    // ---------------- Mensajes de movil.html ----------------

    @Override
    public void recibir(Web w, JSONObject m) {
        switch (m.optString("tipo")) {
            case "listo":
                nucleo.saludar(w);
                enviarEstado();
                break;
            case "guardarConfig":
                nucleo.guardarConfig(m.optJSONObject("config"), w);
                break;
            case "ponerFondo":
                ponerFondo();
                break;
            case "elegirArchivo":
                elegirArchivo();
                break;
            case "borrarArchivo":
                borrarArchivo(m.optString("archivo"));
                break;
            case "permisoMusica":
                pedirPermisoMusica();
                break;
            case "media":
                nucleo.musica.accion(m.optString("accion", "pausa"));
                break;
            case "lanzar":
                abrirDestino(this, m.optString("destino"));
                break;
            case "salir":
                finish();
                break;
        }
    }

    private void ponerFondo() {
        Intent i = new Intent(WallpaperManager.ACTION_CHANGE_LIVE_WALLPAPER)
                .putExtra(WallpaperManager.EXTRA_LIVE_WALLPAPER_COMPONENT, new ComponentName(this, FondoServicio.class));
        try { startActivity(i); }
        catch (Exception e) {
            try { startActivity(new Intent(WallpaperManager.ACTION_LIVE_WALLPAPER_CHOOSER)); }
            catch (Exception e2) { Toast.makeText(this, "Abre Ajustes → Fondo de pantalla y elige Lienzo", Toast.LENGTH_LONG).show(); }
        }
    }

    private void pedirPermisoMusica() {
        ComponentName c = new ComponentName(this, MusicaServicio.class);
        Intent i = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS)
                .putExtra(Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME, c.flattenToString());
        try { startActivity(i); }
        catch (Exception e) { startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)); }
    }

    /** Abre un enlace o una app (los bloques de Windows mandan rutas; aquí solo tienen sentido las web). */
    static void abrirDestino(Context ctx, String destino) {
        if (destino == null || !(destino.startsWith("http://") || destino.startsWith("https://"))) return;
        try { ctx.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(destino)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); }
        catch (Exception e) { /* sin navegador */ }
    }

    // ---------------- Fotos y videos de la galería ----------------

    private void elegirArchivo() {
        // El selector de fotos de Android: no pide permisos y deja elegir fotos y videos.
        Intent i = new Intent(MediaStore.ACTION_PICK_IMAGES);
        try { startActivityForResult(i, ELEGIR); }
        catch (Exception e) {
            Intent d = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*")
                    .putExtra(Intent.EXTRA_MIME_TYPES, new String[] { "image/*", "video/*" });
            startActivityForResult(d, ELEGIR);
        }
    }

    @Override
    protected void onActivityResult(int pedido, int resultado, Intent datos) {
        super.onActivityResult(pedido, resultado, datos);
        if (pedido != ELEGIR || resultado != RESULT_OK || datos == null || datos.getData() == null) return;
        final Uri uri = datos.getData();
        avisar("Copiando…");
        new Thread(() -> {
            JSONObject m = copiar(uri);
            runOnUiThread(() -> {
                if (m != null) web.enviar(m);
                else avisar("No se pudo abrir ese archivo");
            });
        }, "lienzo-copiar").start();
    }

    /** Copia el archivo elegido a la carpeta privada de Lienzo (así sigue funcionando aunque lo borres de la galería). */
    private JSONObject copiar(Uri uri) {
        ContentResolver cr = getContentResolver();
        String mime = cr.getType(uri);
        if (mime == null) mime = "";
        String nombre = "";
        try (Cursor c = cr.query(uri, new String[] { OpenableColumns.DISPLAY_NAME }, null, null, null)) {
            if (c != null && c.moveToFirst()) nombre = c.getString(0);
        } catch (Exception e) { /* sin nombre */ }
        boolean video = mime.startsWith("video/");
        if (!video && !mime.startsWith("image/")) return null;
        String ext = MimeTypeMap.getSingleton().getExtensionFromMimeType(mime);
        if (ext == null) ext = video ? "mp4" : "jpg";
        File dir = new File(Nucleo.dirDatos(this), "medios");
        if (!dir.isDirectory()) dir.mkdirs();
        String archivo = "medios/" + Long.toString(System.currentTimeMillis(), 36) + "." + ext.toLowerCase(Locale.ROOT);
        File destino = new File(Nucleo.dirDatos(this), archivo);
        try (InputStream in = cr.openInputStream(uri); OutputStream out = new FileOutputStream(destino)) {
            if (in == null) return null;
            byte[] b = new byte[65536];
            int n;
            while ((n = in.read(b)) > 0) out.write(b, 0, n);
        } catch (Exception e) {
            Log.w(Web.TAG, "Copiar " + uri + ": " + e);
            destino.delete();
            return null;
        }
        JSONObject m = Nucleo.mensaje("archivoAgregado");
        Nucleo.put(m, "archivo", archivo);
        Nucleo.put(m, "medio", video ? "video" : "imagen"); // «tipo» ya es el nombre del mensaje
        Nucleo.put(m, "nombre", nombre);
        return m;
    }

    private void borrarArchivo(String archivo) {
        if (archivo == null || !archivo.startsWith("medios/") || archivo.contains("..")) return;
        File f = new File(Nucleo.dirDatos(this), archivo);
        if (f.isFile() && !f.delete()) Log.w(Web.TAG, "No se pudo borrar " + archivo);
    }

    private void avisar(String texto) {
        JSONObject m = Nucleo.mensaje("aviso");
        Nucleo.put(m, "texto", texto);
        web.enviar(m);
    }
}

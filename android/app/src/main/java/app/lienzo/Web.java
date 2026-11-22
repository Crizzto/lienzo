package app.lienzo;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.MimeTypeMap;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Un WebView con las páginas de web/ (van dentro del APK como assets) y el puente de mensajes.
 * Las direcciones son las mismas que en Windows: https://lienzo.example/ (páginas) y
 * https://datos.lienzo.example/ (fotos y videos del usuario, en la carpeta privada de la app).
 */
final class Web implements Nucleo.Anfitrion {
    static final String HOST_APP = "lienzo.example", HOST_DATOS = "datos.lienzo.example";
    static final String TAG = "Lienzo";

    interface Receptor { void recibir(Web web, JSONObject m); }

    final WebView vista;
    final String pagina;          // "panel" o "fondo"
    private final Receptor receptor;
    private final Handler principal = new Handler(Looper.getMainLooper());
    boolean lista;                // la página ya mandó «listo»

    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface"})
    Web(Context ctx, String pagina, String ruta, Receptor receptor) {
        this.pagina = pagina;
        this.receptor = receptor;
        final Context app = ctx.getApplicationContext();
        vista = new WebView(ctx);
        vista.setBackgroundColor(Color.parseColor("#12101c"));
        vista.setVerticalScrollBarEnabled(false);
        vista.setHorizontalScrollBarEnabled(false);
        vista.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
        WebSettings s = vista.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setTextZoom(100);           // el tamaño de letra del sistema no descuadra los bloques
        s.setSupportZoom(false);

        vista.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public void enviar(String json) {
                principal.post(() -> {
                    try {
                        JSONObject m = new JSONObject(json);
                        if ("listo".equals(m.optString("tipo"))) lista = true;
                        if ("registro".equals(m.optString("tipo"))) { Log.i(TAG, "[" + Web.this.pagina + "] " + m.optString("texto")); return; }
                        Web.this.receptor.recibir(Web.this, m);
                    } catch (Exception e) { Log.w(TAG, "Mensaje inválido: " + e); }
                });
            }
        }, "LienzoNativo");

        vista.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                return servir(app, r);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (HOST_APP.equals(u.getHost()) || HOST_DATOS.equals(u.getHost())) return false;
                // Los enlaces de fuera (créditos, letras…) se abren en el navegador, nunca dentro del fondo.
                if (r.isForMainFrame() && ("http".equals(u.getScheme()) || "https".equals(u.getScheme()))) {
                    try { app.startActivity(new Intent(Intent.ACTION_VIEW, u).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); } catch (Exception e) { /* sin navegador */ }
                    return true;
                }
                return false;
            }

            @Override
            public boolean onRenderProcessGone(WebView v, android.webkit.RenderProcessGoneDetail d) {
                // Si el proceso de la página muere (falta de memoria), se recarga en vez de cerrar la app.
                Log.w(TAG, "La página " + pagina + " se cayó; se recarga");
                lista = false;
                if (Web.this.receptor instanceof Recargable) ((Recargable) Web.this.receptor).recargar(Web.this);
                return true;
            }
        });
        vista.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage c) {
                if (c.messageLevel() == ConsoleMessage.MessageLevel.ERROR || c.messageLevel() == ConsoleMessage.MessageLevel.WARNING)
                    Log.w(TAG, "[" + pagina + "] " + c.message() + " (" + c.sourceId() + ":" + c.lineNumber() + ")");
                return true;
            }
        });
        vista.loadUrl("https://" + HOST_APP + "/" + ruta);
    }

    interface Recargable { void recargar(Web web); }

    @Override
    public String pagina() { return pagina; }

    @Override
    public boolean lista() { return lista; }

    /** Manda un mensaje {tipo, ...} a la página (lo recibe comun/puente.js). */
    @Override
    public void enviar(JSONObject m) {
        if (!lista && !"config".equals(m.optString("tipo"))) return;
        String js = "window.__lienzoMensaje&&window.__lienzoMensaje(" + m + ")";
        if (Looper.myLooper() == Looper.getMainLooper()) vista.evaluateJavascript(js, null);
        else principal.post(() -> vista.evaluateJavascript(js, null));
    }

    void destruir() {
        lista = false;
        try {
            vista.stopLoading();
            if (vista.getParent() instanceof android.view.ViewGroup) ((android.view.ViewGroup) vista.getParent()).removeView(vista);
            vista.destroy();
        } catch (Exception e) { Log.w(TAG, "destruir: " + e); }
    }

    // ---------------- Archivos ----------------

    private static final Pattern RANGO = Pattern.compile("bytes=(\\d*)-(\\d*)");

    static WebResourceResponse servir(Context ctx, WebResourceRequest r) {
        Uri u = r.getUrl();
        String host = u.getHost();
        if (!HOST_APP.equals(host) && !HOST_DATOS.equals(host)) return null; // Internet normal
        String ruta = u.getPath() == null ? "" : u.getPath();
        while (ruta.startsWith("/")) ruta = ruta.substring(1);
        if (ruta.isEmpty()) ruta = "movil.html";
        if (ruta.contains("..")) return error(403);
        String mime = mime(ruta);
        Map<String, String> cab = new HashMap<>();
        cab.put("Access-Control-Allow-Origin", "*");
        cab.put("Cache-Control", "no-cache");
        try {
            if (HOST_APP.equals(host)) {
                InputStream in = ctx.getAssets().open(ruta);
                return new WebResourceResponse(mime, textual(mime) ? "utf-8" : null, 200, "OK", cab, in);
            }
            File f = new File(Nucleo.dirDatos(ctx), ruta);
            if (!f.getCanonicalPath().startsWith(Nucleo.dirDatos(ctx).getCanonicalPath() + File.separator) || !f.isFile()) return error(404);
            long largo = f.length();
            cab.put("Accept-Ranges", "bytes");
            String rango = null;
            for (Map.Entry<String, String> e : r.getRequestHeaders().entrySet())
                if ("range".equalsIgnoreCase(e.getKey())) rango = e.getValue();
            Matcher m = rango == null ? null : RANGO.matcher(rango);
            if (m != null && m.find() && largo > 0) {
                // Los videos se piden por partes (para buscar y repetir sin cargarlos enteros).
                long ini, fin;
                if (m.group(1).isEmpty()) { ini = Math.max(0, largo - Long.parseLong(m.group(2))); fin = largo - 1; }
                else { ini = Long.parseLong(m.group(1)); fin = m.group(2).isEmpty() ? largo - 1 : Math.min(largo - 1, Long.parseLong(m.group(2))); }
                if (ini >= largo || ini > fin) return error(416);
                FileInputStream in = new FileInputStream(f);
                long saltado = 0;
                while (saltado < ini) { long s = in.skip(ini - saltado); if (s <= 0) break; saltado += s; }
                cab.put("Content-Range", "bytes " + ini + "-" + fin + "/" + largo);
                cab.put("Content-Length", String.valueOf(fin - ini + 1));
                return new WebResourceResponse(mime, null, 206, "Partial Content", cab, new Limitado(in, fin - ini + 1));
            }
            cab.put("Content-Length", String.valueOf(largo));
            return new WebResourceResponse(mime, null, 200, "OK", cab, new FileInputStream(f));
        } catch (IOException e) {
            return error(404);
        }
    }

    private static WebResourceResponse error(int codigo) {
        Map<String, String> cab = new HashMap<>();
        cab.put("Access-Control-Allow-Origin", "*");
        return new WebResourceResponse("text/plain", "utf-8", codigo, codigo == 404 ? "Not Found" : "Error", cab,
                new ByteArrayInputStream(new byte[0]));
    }

    private static boolean textual(String mime) {
        return mime.startsWith("text/") || mime.contains("javascript") || mime.contains("json") || mime.contains("svg");
    }

    static String mime(String ruta) {
        String ext = ruta.contains(".") ? ruta.substring(ruta.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT) : "";
        switch (ext) {
            case "html": return "text/html";
            case "js": case "mjs": return "text/javascript";
            case "css": return "text/css";
            case "json": return "application/json";
            case "svg": return "image/svg+xml";
            case "glsl": case "txt": return "text/plain";
            case "woff2": return "font/woff2";
            case "mp4": case "m4v": return "video/mp4";
            case "webm": return "video/webm";
            case "mov": return "video/quicktime";
        }
        String m = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
        return m != null ? m : "application/octet-stream";
    }

    /** Lee solo n bytes de otro flujo (para las respuestas por partes). */
    private static final class Limitado extends InputStream {
        private final InputStream in;
        private long quedan;
        Limitado(InputStream in, long n) { this.in = in; this.quedan = n; }
        @Override public int read() throws IOException { if (quedan <= 0) return -1; int b = in.read(); if (b >= 0) quedan--; return b; }
        @Override public int read(byte[] b, int off, int len) throws IOException {
            if (quedan <= 0) return -1;
            int n = in.read(b, off, (int) Math.min(len, quedan));
            if (n > 0) quedan -= n;
            return n;
        }
        @Override public int available() throws IOException { return (int) Math.min(in.available(), quedan); }
        @Override public void close() throws IOException { in.close(); }
    }
}

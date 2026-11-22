package app.lienzo;

import android.app.ActivityManager;
import android.app.WallpaperInfo;
import android.app.WallpaperManager;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.media.AudioManager;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.TrafficStats;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.os.StatFs;
import android.os.SystemClock;
import android.provider.Settings;
import android.util.DisplayMetrics;
import android.util.Log;
import android.view.WindowManager;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * El corazón de la app (vive mientras viva el proceso): guarda la configuración en un archivo, la reparte
 * a todas las páginas abiertas (panel y fondos), y les manda los datos del teléfono y de la música.
 * Todo se usa desde el hilo principal.
 */
final class Nucleo {
    interface Anfitrion {
        String pagina();
        boolean lista();
        void enviar(JSONObject m);
    }

    private static Nucleo unico;
    static Nucleo de(Context ctx) {
        if (unico == null) unico = new Nucleo(ctx.getApplicationContext());
        return unico;
    }

    final Context ctx;
    final Handler hilo = new Handler(Looper.getMainLooper());
    private final ExecutorService disco = Executors.newSingleThreadExecutor();
    private final List<Anfitrion> anfitriones = new ArrayList<>();
    private final List<Runnable> alCambiarConfig = new ArrayList<>();
    private JSONObject config;
    private JSONObject ultimaMusica;
    private int visibles = 0; // páginas que se están viendo (para no medir nada con la pantalla apagada)
    final Musica musica;

    private Nucleo(Context ctx) {
        this.ctx = ctx;
        config = leerConfig();
        musica = new Musica(this);
        IntentFilter f = new IntentFilter(PowerManager.ACTION_POWER_SAVE_MODE_CHANGED);
        ctx.registerReceiver(new BroadcastReceiver() {
            @Override public void onReceive(Context c, Intent i) { difundirPausaATodos(); }
        }, f, Context.RECEIVER_NOT_EXPORTED);
        musica.iniciar();
    }

    static File dirDatos(Context ctx) {
        File d = new File(ctx.getFilesDir(), "datos");
        if (!d.isDirectory()) d.mkdirs();
        return d;
    }

    // ---------------- Configuración ----------------

    private File archivoConfig() { return new File(ctx.getFilesDir(), "config.json"); }

    private JSONObject leerConfig() {
        try {
            File f = archivoConfig();
            if (f.isFile()) return new JSONObject(leerTodo(new java.io.FileInputStream(f)));
        } catch (Exception e) { Log.w(Web.TAG, "config.json dañado, se usa la de fábrica: " + e); }
        // La primera vez: la de fábrica de Windows. Las páginas la adaptan al teléfono (Lienzo.movil.adaptar).
        try { return new JSONObject(leerTodo(ctx.getAssets().open("comun/defecto.json"))); }
        catch (Exception e) { return new JSONObject(); }
    }

    static String leerTodo(InputStream in) throws java.io.IOException {
        try (InputStream i = in) {
            ByteArrayOutputStream o = new ByteArrayOutputStream();
            byte[] b = new byte[16384];
            int n;
            while ((n = i.read(b)) > 0) o.write(b, 0, n);
            return o.toString(StandardCharsets.UTF_8.name());
        }
    }

    JSONObject config() { return config; }

    /** Guarda la configuración que mandó una página y se la pasa a las demás. */
    void guardarConfig(JSONObject nueva, Anfitrion origen) {
        if (nueva == null) return;
        config = nueva;
        final String texto = nueva.toString();
        disco.execute(() -> {
            try {
                File tmp = new File(ctx.getFilesDir(), "config.json.tmp");
                try (FileOutputStream o = new FileOutputStream(tmp)) { o.write(texto.getBytes(StandardCharsets.UTF_8)); o.getFD().sync(); }
                if (!tmp.renameTo(archivoConfig())) Log.w(Web.TAG, "No se pudo guardar config.json");
            } catch (Exception e) { Log.w(Web.TAG, "Guardar config: " + e); }
        });
        JSONObject m = mensaje("config");
        put(m, "config", nueva);
        for (Anfitrion a : new ArrayList<>(anfitriones)) if (a != origen) a.enviar(m);
        for (Runnable r : new ArrayList<>(alCambiarConfig)) r.run();
    }

    void alCambiarConfig(Runnable r) { alCambiarConfig.add(r); }
    void quitarAlCambiarConfig(Runnable r) { alCambiarConfig.remove(r); }

    // ---------------- Páginas abiertas ----------------

    void registrar(Anfitrion a) { if (!anfitriones.contains(a)) anfitriones.add(a); }
    void quitar(Anfitrion a) { anfitriones.remove(a); }

    /** La página acaba de cargar: se le manda todo lo que necesita para dibujarse. */
    void saludar(Anfitrion a) {
        JSONObject c = mensaje("config");
        put(c, "config", config);
        a.enviar(c);
        a.enviar(ficha());
        a.enviar(sistema());
        if (ultimaMusica != null) a.enviar(ultimaMusica);
        else { JSONObject m = mensaje("musica"); put(m, "activa", false); a.enviar(m); }
    }

    void difundir(JSONObject m) {
        if ("musica".equals(m.optString("tipo"))) {
            // La portada solo viaja cuando cambia; la última se guarda entera para las páginas nuevas.
            if (ultimaMusica != null && !m.has("portada") && ultimaMusica.has("portada")) {
                JSONObject copia = copiar(m);
                put(copia, "portada", ultimaMusica.opt("portada"));
                ultimaMusica = copia;
            } else ultimaMusica = m;
        }
        for (Anfitrion a : new ArrayList<>(anfitriones)) a.enviar(m);
    }

    // ---------------- Visibilidad, pausa y batería ----------------

    private final Runnable tic = new Runnable() {
        @Override public void run() {
            if (visibles <= 0) return;
            difundir(sistema());
            hilo.postDelayed(this, 2000);
        }
    };

    void visible(boolean si) {
        int antes = visibles;
        visibles = Math.max(0, visibles + (si ? 1 : -1));
        if (antes == 0 && visibles > 0) { hilo.removeCallbacks(tic); hilo.post(tic); musica.publicar(true); }
    }

    /** Si la página debe ir pausada o más lenta (ahorro de batería), según lo que eligió el usuario. */
    JSONObject pausa(boolean visible) {
        PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
        boolean ahorro = pm != null && pm.isPowerSaveMode();
        String modo = config.optJSONObject("rendimiento") != null ? config.optJSONObject("rendimiento").optString("bateria", "reducir") : "reducir";
        JSONObject m = mensaje("pausa");
        boolean pausado = !visible || (ahorro && "pausar".equals(modo));
        put(m, "pausado", pausado);
        put(m, "motivo", !visible ? "oculto" : pausado ? "bateria" : "");
        put(m, "reducido", ahorro && "reducir".equals(modo));
        return m;
    }

    private final List<Runnable> alCambiarAhorro = new ArrayList<>();
    void alCambiarAhorro(Runnable r) { alCambiarAhorro.add(r); }
    void quitarAlCambiarAhorro(Runnable r) { alCambiarAhorro.remove(r); }
    private void difundirPausaATodos() { for (Runnable r : new ArrayList<>(alCambiarAhorro)) r.run(); }

    // ---------------- Estado para el panel ----------------

    boolean esElFondo() {
        try {
            WallpaperInfo w = WallpaperManager.getInstance(ctx).getWallpaperInfo();
            return w != null && w.getComponent().equals(new ComponentName(ctx, FondoServicio.class));
        } catch (Exception e) { return false; }
    }

    String version() {
        try { return ctx.getPackageManager().getPackageInfo(ctx.getPackageName(), 0).versionName; }
        catch (Exception e) { return ""; }
    }

    String nombreTelefono() {
        String n = Settings.Global.getString(ctx.getContentResolver(), Settings.Global.DEVICE_NAME);
        if (n == null || n.isEmpty()) n = Build.MODEL;
        return n;
    }

    // ---------------- Datos del teléfono ----------------

    private long rxAntes = -1, txAntes = -1, tAntes = 0;

    JSONObject sistema() {
        JSONObject m = mensaje("sistema");
        try {
            BatteryManager bm = (BatteryManager) ctx.getSystemService(Context.BATTERY_SERVICE);
            put(m, "bateria", bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY));
            put(m, "cargando", bm.isCharging());
        } catch (Exception e) { put(m, "bateria", -1); }
        try {
            ActivityManager am = (ActivityManager) ctx.getSystemService(Context.ACTIVITY_SERVICE);
            ActivityManager.MemoryInfo mi = new ActivityManager.MemoryInfo();
            am.getMemoryInfo(mi);
            double total = mi.totalMem / 1073741824.0, usada = (mi.totalMem - mi.availMem) / 1073741824.0;
            put(m, "ramTotal", redondear(total));
            put(m, "ramUsada", redondear(usada));
            put(m, "ram", Math.round(usada / total * 100));
        } catch (Exception e) { /* sin datos */ }
        try {
            StatFs fs = new StatFs(Environment.getDataDirectory().getPath());
            long total = fs.getTotalBytes(), libre = fs.getAvailableBytes();
            put(m, "disco", Math.round((total - libre) * 100.0 / total));
            put(m, "discoLibre", Math.round(libre / 1073741824.0));
        } catch (Exception e) { /* sin datos */ }
        // Android no deja leer el uso del procesador a las apps: el bloque de sistema lo oculta.
        long rx = TrafficStats.getTotalRxBytes(), tx = TrafficStats.getTotalTxBytes(), t = SystemClock.elapsedRealtime();
        if (rxAntes >= 0 && t > tAntes && rx >= rxAntes) {
            double seg = (t - tAntes) / 1000.0;
            put(m, "bajada", Math.round((rx - rxAntes) / seg));
            put(m, "subida", Math.round((tx - txAntes) / seg));
        } else { put(m, "bajada", 0); put(m, "subida", 0); }
        rxAntes = rx; txAntes = tx; tAntes = t;
        put(m, "red", red());
        put(m, "encendido", SystemClock.elapsedRealtime() / 1000);
        try {
            AudioManager au = (AudioManager) ctx.getSystemService(Context.AUDIO_SERVICE);
            int max = au.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
            put(m, "volumen", max > 0 ? Math.round(au.getStreamVolume(AudioManager.STREAM_MUSIC) * 100.0 / max) : 0);
            put(m, "silencio", au.getRingerMode() != AudioManager.RINGER_MODE_NORMAL);
        } catch (Exception e) { /* sin datos */ }
        return m;
    }

    private String red() {
        try {
            ConnectivityManager cm = (ConnectivityManager) ctx.getSystemService(Context.CONNECTIVITY_SERVICE);
            Network n = cm.getActiveNetwork();
            NetworkCapabilities c = n == null ? null : cm.getNetworkCapabilities(n);
            if (c == null) return "sin";
            if (c.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) return "wifi";
            if (c.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)) return "cable";
            if (c.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)) return "datos";
            return "wifi";
        } catch (Exception e) { return "wifi"; }
    }

    JSONObject ficha() {
        JSONObject m = mensaje("ficha");
        JSONObject general = config.optJSONObject("general");
        String nombre = general != null ? general.optString("nombre", "") : "";
        if (!nombre.isEmpty()) put(m, "usuario", nombre.split("\\s+")[0]);
        put(m, "equipo", nombreTelefono().replace(' ', '-'));
        put(m, "so", "Android");
        put(m, "version", Build.VERSION.RELEASE);
        String k = System.getProperty("os.version", "");
        int guion = k.indexOf('-');
        put(m, "kernel", "Linux " + (guion > 0 ? k.substring(0, guion) : k));
        put(m, "cpu", procesador());
        put(m, "nucleos", Runtime.getRuntime().availableProcessors());
        try {
            ActivityManager am = (ActivityManager) ctx.getSystemService(Context.ACTIVITY_SERVICE);
            ActivityManager.MemoryInfo mi = new ActivityManager.MemoryInfo();
            am.getMemoryInfo(mi);
            put(m, "ram", redondear(mi.totalMem / 1073741824.0));
        } catch (Exception e) { /* sin datos */ }
        try {
            WindowManager wm = (WindowManager) ctx.getSystemService(Context.WINDOW_SERVICE);
            android.graphics.Rect r = wm.getMaximumWindowMetrics().getBounds();
            DisplayMetrics dm = ctx.getResources().getDisplayMetrics();
            put(m, "resolucion", Math.min(r.width(), r.height()) + "x" + Math.max(r.width(), r.height()));
            put(m, "escala", Math.round(dm.density * 100));
        } catch (Exception e) { /* sin datos */ }
        put(m, "lienzo", version());
        return m;
    }

    private static String procesador() {
        String soc = Build.SOC_MODEL == null ? "" : Build.SOC_MODEL;
        switch (soc.toLowerCase(Locale.ROOT)) {
            case "gs101": return "Google Tensor";
            case "gs201": return "Google Tensor G2";
            case "zuma": return "Google Tensor G3";
            case "zumapro": return "Google Tensor G4";
            case "laguna": return "Google Tensor G5";
        }
        String fab = Build.SOC_MANUFACTURER == null || "unknown".equalsIgnoreCase(Build.SOC_MANUFACTURER) ? "" : Build.SOC_MANUFACTURER + " ";
        return soc.isEmpty() || "unknown".equalsIgnoreCase(soc) ? Build.HARDWARE : fab + soc;
    }

    // ---------------- Utilidades JSON ----------------

    static JSONObject mensaje(String tipo) {
        JSONObject m = new JSONObject();
        put(m, "tipo", tipo);
        return m;
    }

    static void put(JSONObject o, String k, Object v) {
        try { o.put(k, v); } catch (Exception e) { /* nunca pasa con claves de texto */ }
    }

    static JSONObject copiar(JSONObject o) {
        try { return new JSONObject(o.toString()); } catch (Exception e) { return new JSONObject(); }
    }

    private static double redondear(double v) { return Math.round(v * 10) / 10.0; }
}

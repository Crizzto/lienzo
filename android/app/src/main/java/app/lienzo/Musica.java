package app.lienzo;

import android.app.NotificationManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.media.MediaMetadata;
import android.media.session.MediaController;
import android.media.session.MediaSessionManager;
import android.media.session.PlaybackState;
import android.os.SystemClock;
import android.util.Base64;
import android.util.Log;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.util.List;

/**
 * Qué música suena en el teléfono (cualquier app con MediaSession: Spotify, YouTube Music, Deezer…) y sus
 * controles. Android solo da esta información a las apps con permiso de «acceso a notificaciones»
 * (MusicaServicio); sin él, los bloques de música simplemente se quedan sin canción.
 */
final class Musica {
    private final Nucleo nucleo;
    private final ComponentName servicio;
    private MediaSessionManager msm;
    private MediaController actual;
    private boolean escuchando;
    private String portadaDe = null;   // canción de la última portada enviada
    private String portadaUrl = "";

    Musica(Nucleo nucleo) {
        this.nucleo = nucleo;
        this.servicio = new ComponentName(nucleo.ctx, MusicaServicio.class);
    }

    boolean permitida() {
        NotificationManager nm = (NotificationManager) nucleo.ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        return nm != null && nm.isNotificationListenerAccessGranted(servicio);
    }

    private final MediaSessionManager.OnActiveSessionsChangedListener alCambiarSesiones = this::elegir;

    /** Empieza a escuchar las sesiones (se vuelve a llamar cuando el usuario da el permiso). */
    void iniciar() {
        if (escuchando || !permitida()) return;
        try {
            msm = (MediaSessionManager) nucleo.ctx.getSystemService(Context.MEDIA_SESSION_SERVICE);
            msm.addOnActiveSessionsChangedListener(alCambiarSesiones, servicio, nucleo.hilo);
            escuchando = true;
            elegir(msm.getActiveSessions(servicio));
        } catch (SecurityException e) {
            Log.w(Web.TAG, "Sin permiso para ver la música: " + e.getMessage());
        }
    }

    private final MediaController.Callback alCambiar = new MediaController.Callback() {
        @Override public void onPlaybackStateChanged(PlaybackState s) {
            // Si esta se pausó y otra suena, se cambia a la que suena.
            if (msm != null && (s == null || s.getState() != PlaybackState.STATE_PLAYING)) {
                try { if (elegirSinPublicar(msm.getActiveSessions(servicio))) { publicar(true); return; } } catch (SecurityException e) { /* nada */ }
            }
            publicar(false);
        }
        @Override public void onMetadataChanged(MediaMetadata m) { publicar(false); }
        @Override public void onSessionDestroyed() {
            try { elegir(msm.getActiveSessions(servicio)); } catch (Exception e) { soltar(); publicar(true); }
        }
    };

    private void elegir(List<MediaController> sesiones) {
        elegirSinPublicar(sesiones);
        publicar(true);
    }

    /** Se queda con la sesión que está sonando (o la primera). Devuelve true si cambió. */
    private boolean elegirSinPublicar(List<MediaController> sesiones) {
        MediaController mejor = null;
        if (sesiones != null) {
            for (MediaController c : sesiones) {
                PlaybackState s = c.getPlaybackState();
                if (s != null && s.getState() == PlaybackState.STATE_PLAYING) { mejor = c; break; }
            }
            if (mejor == null && !sesiones.isEmpty()) mejor = sesiones.get(0);
        }
        if (mejor != null && actual != null && mejor.getSessionToken().equals(actual.getSessionToken())) return false;
        soltar();
        actual = mejor;
        if (actual != null) actual.registerCallback(alCambiar, nucleo.hilo);
        return true;
    }

    private void soltar() {
        if (actual != null) { try { actual.unregisterCallback(alCambiar); } catch (Exception e) { /* ya no existe */ } }
        actual = null;
    }

    /** Manda a las páginas lo que suena. La portada solo va cuando cambia de canción (o si se pide todo). */
    void publicar(boolean todo) {
        JSONObject m = Nucleo.mensaje("musica");
        MediaController c = actual;
        MediaMetadata md = c == null ? null : c.getMetadata();
        PlaybackState s = c == null ? null : c.getPlaybackState();
        if (md == null || texto(md, MediaMetadata.METADATA_KEY_TITLE).isEmpty()) {
            Nucleo.put(m, "activa", false);
            if (todo || portadaDe != null) Nucleo.put(m, "portada", "");
            portadaDe = null;
            nucleo.difundir(m);
            return;
        }
        String titulo = texto(md, MediaMetadata.METADATA_KEY_TITLE);
        String artista = texto(md, MediaMetadata.METADATA_KEY_ARTIST);
        if (artista.isEmpty()) artista = texto(md, MediaMetadata.METADATA_KEY_ALBUM_ARTIST);
        Nucleo.put(m, "activa", true);
        Nucleo.put(m, "app", nombreApp(c.getPackageName()));
        Nucleo.put(m, "paquete", c.getPackageName());
        Nucleo.put(m, "titulo", titulo);
        Nucleo.put(m, "artista", artista);
        Nucleo.put(m, "album", texto(md, MediaMetadata.METADATA_KEY_ALBUM));
        boolean suena = s != null && s.getState() == PlaybackState.STATE_PLAYING;
        Nucleo.put(m, "reproduciendo", suena);
        long dur = md.getLong(MediaMetadata.METADATA_KEY_DURATION);
        Nucleo.put(m, "duracion", dur > 0 ? dur / 1000.0 : 0);
        double pos = 0;
        if (s != null && s.getPosition() >= 0) {
            pos = s.getPosition();
            if (suena && s.getLastPositionUpdateTime() > 0)
                pos += (SystemClock.elapsedRealtime() - s.getLastPositionUpdateTime()) * s.getPlaybackSpeed();
            pos = pos / 1000.0;
            if (dur > 0) pos = Math.min(pos, dur / 1000.0);
        }
        Nucleo.put(m, "posicion", pos);
        String clave = c.getPackageName() + "|" + titulo + "|" + artista;
        if (todo || !clave.equals(portadaDe)) {
            if (!clave.equals(portadaDe)) portadaUrl = portada(md);
            portadaDe = clave;
            Nucleo.put(m, "portada", portadaUrl);
        }
        nucleo.difundir(m);
    }

    /** Los botones de los bloques: «pausa» (alterna), «siguiente», «anterior». */
    void accion(String accion) {
        MediaController c = actual;
        if (c == null) return;
        MediaController.TransportControls t = c.getTransportControls();
        PlaybackState s = c.getPlaybackState();
        switch (accion) {
            case "siguiente": t.skipToNext(); break;
            case "anterior": t.skipToPrevious(); break;
            default:
                if (s != null && s.getState() == PlaybackState.STATE_PLAYING) t.pause(); else t.play();
        }
    }

    private static String texto(MediaMetadata md, String k) {
        CharSequence v = md.getText(k);
        return v == null ? "" : v.toString();
    }

    private String nombreApp(String paquete) {
        try {
            PackageManager pm = nucleo.ctx.getPackageManager();
            return pm.getApplicationLabel(pm.getApplicationInfo(paquete, 0)).toString();
        } catch (Exception e) { return paquete; }
    }

    private static String portada(MediaMetadata md) {
        Bitmap b = md.getBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART);
        if (b == null) b = md.getBitmap(MediaMetadata.METADATA_KEY_ART);
        if (b == null) b = md.getBitmap(MediaMetadata.METADATA_KEY_DISPLAY_ICON);
        if (b == null) return "";
        try {
            int lado = 320;
            float s = Math.min(1f, lado / (float) Math.max(b.getWidth(), b.getHeight()));
            Bitmap chica = s < 1f ? Bitmap.createScaledBitmap(b, Math.round(b.getWidth() * s), Math.round(b.getHeight() * s), true) : b;
            ByteArrayOutputStream o = new ByteArrayOutputStream();
            chica.compress(Bitmap.CompressFormat.JPEG, 85, o);
            return "data:image/jpeg;base64," + Base64.encodeToString(o.toByteArray(), Base64.NO_WRAP);
        } catch (Exception e) { return ""; }
    }
}

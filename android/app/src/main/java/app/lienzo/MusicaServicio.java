package app.lienzo;

import android.service.notification.NotificationListenerService;

/**
 * Existe solo para que Android le dé a Lienzo acceso a las sesiones de música (MediaSessionManager pide
 * un «oyente de notificaciones» activado). No hace nada con las notificaciones.
 */
public class MusicaServicio extends NotificationListenerService {
    @Override
    public void onListenerConnected() {
        Nucleo.de(this).musica.iniciar();
    }
}

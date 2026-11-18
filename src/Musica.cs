using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Runtime.CompilerServices;
using System.Threading.Tasks;
using Windows.Foundation;
using Windows.Media.Control;
using Windows.Storage.Streams;

namespace Lienzo
{
    /// <summary>
    /// Permite usar "await" con operaciones de WinRT referenciando los .winmd del sistema
    /// (el adaptador oficial de .NET espera el Windows.winmd unificado del SDK, que aquí no hay).
    /// </summary>
    internal static class ExtensionesWinRT
    {
        public static TaskAwaiter<T> GetAwaiter<T>(this IAsyncOperation<T> op)
        {
            return ATarea(op).GetAwaiter();
        }

        public static Task<T> ATarea<T>(IAsyncOperation<T> op)
        {
            var tcs = new TaskCompletionSource<T>();
            op.Completed = (o, estado) =>
            {
                try
                {
                    if (estado == AsyncStatus.Completed) tcs.TrySetResult(o.GetResults());
                    else if (estado == AsyncStatus.Canceled) tcs.TrySetCanceled();
                    else tcs.TrySetException(o.ErrorCode ?? new Exception("Error de WinRT"));
                }
                catch (Exception ex) { tcs.TrySetException(ex); }
            };
            return tcs.Task;
        }
    }

    /// <summary>
    /// Qué música suena (Spotify, YouTube en el navegador, Música de Windows...) con la API de Windows
    /// GlobalSystemMediaTransportControlsSessionManager, y sus controles. Si no hay sesión, usa las teclas multimedia.
    /// </summary>
    internal static class Musica
    {
        private static GlobalSystemMediaTransportControlsSessionManager gestor;
        private static bool iniciando;
        private static string ultimaClave = "", ultimaPortada;

        public static async Task Iniciar()
        {
            if (gestor != null || iniciando) return;
            iniciando = true;
            try { gestor = await GlobalSystemMediaTransportControlsSessionManager.RequestAsync(); }
            catch (Exception ex) { App.Registro("Música no disponible: " + ex.Message); }
            finally { iniciando = false; }
        }

        /// <summary>Estado actual o null si no suena nada. "portada" solo viene cuando cambia la canción.</summary>
        public static async Task<Dictionary<string, object>> Estado()
        {
            if (gestor == null) await Iniciar();
            if (gestor == null) return null;
            GlobalSystemMediaTransportControlsSession s;
            try { s = gestor.GetCurrentSession(); } catch { return null; }
            if (s == null) { ultimaClave = ""; return null; }
            var d = new Dictionary<string, object>();
            try
            {
                var props = await s.TryGetMediaPropertiesAsync();
                var info = s.GetPlaybackInfo();
                var linea = s.GetTimelineProperties();
                string titulo = props != null ? props.Title ?? "" : "";
                string artista = props != null ? (string.IsNullOrEmpty(props.Artist) ? props.AlbumArtist ?? "" : props.Artist) : "";
                d["app"] = NombreApp(s.SourceAppUserModelId);
                d["titulo"] = titulo;
                d["artista"] = artista;
                d["album"] = props != null ? props.AlbumTitle ?? "" : "";
                d["reproduciendo"] = info != null && info.PlaybackStatus == GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing;
                if (linea != null && linea.EndTime.TotalSeconds > 0)
                {
                    double pos = linea.Position.TotalSeconds;
                    if ((bool)d["reproduciendo"]) pos += (DateTimeOffset.Now - linea.LastUpdatedTime).TotalSeconds;
                    d["posicion"] = Math.Max(0, Math.Min(pos, linea.EndTime.TotalSeconds));
                    d["duracion"] = linea.EndTime.TotalSeconds;
                }
                string clave = titulo + "|" + artista;
                if (clave != ultimaClave)
                {
                    ultimaClave = clave;
                    ultimaPortada = props != null && props.Thumbnail != null ? await Portada(props.Thumbnail) : null;
                    d["portada"] = ultimaPortada ?? "";
                    d["cambio"] = true;
                }
            }
            catch (Exception ex) { App.Registro("Música: " + ex.Message); return null; }
            return d;
        }

        public static string PortadaActual { get { return ultimaPortada; } }

        private static async Task<string> Portada(IRandomAccessStreamReference referencia)
        {
            try
            {
                using (var flujo = await referencia.OpenReadAsync())
                {
                    uint tam = (uint)Math.Min(flujo.Size, 8 * 1024 * 1024);
                    if (tam == 0) return null;
                    using (var lector = new DataReader(flujo.GetInputStreamAt(0)))
                    {
                        await lector.LoadAsync(tam);
                        var bytes = new byte[tam];
                        lector.ReadBytes(bytes);
                        using (var ms = new MemoryStream(bytes))
                        using (var img = new Bitmap(ms))
                            return Tareas.DataUrlJpeg(img, Math.Min(256, img.Width));
                    }
                }
            }
            catch { return null; }
        }

        private static string NombreApp(string aumid)
        {
            if (string.IsNullOrEmpty(aumid)) return "";
            string a = aumid.ToLowerInvariant();
            if (a.Contains("spotify")) return "Spotify";
            if (a.Contains("applemusic")) return "Apple Music";
            if (a.Contains("deezer")) return "Deezer";
            if (a.Contains("tidal")) return "TIDAL";
            if (a.Contains("amazonmusic") || a.Contains("amazon music")) return "Amazon Music";
            if (a.Contains("chrome")) return "Chrome";
            if (a.Contains("msedge") || a.Contains("microsoftedge")) return "Edge";
            if (a.Contains("brave")) return "Brave";
            if (a.Contains("firefox")) return "Firefox";
            if (a.Contains("zunemusic") || a.Contains("media")) return "Reproductor";
            int i = aumid.LastIndexOf('!');
            string n = i > 0 ? aumid.Substring(i + 1) : Path.GetFileNameWithoutExtension(aumid);
            return n.Length > 20 ? n.Substring(0, 20) : n;
        }

        public static async Task Accion(string accion)
        {
            GlobalSystemMediaTransportControlsSession s = null;
            try { if (gestor != null) s = gestor.GetCurrentSession(); } catch { }
            bool ok = false;
            if (s != null)
            {
                try
                {
                    if (accion == "pausa") ok = await s.TryTogglePlayPauseAsync();
                    else if (accion == "siguiente") ok = await s.TrySkipNextAsync();
                    else if (accion == "anterior") ok = await s.TrySkipPreviousAsync();
                }
                catch { ok = false; }
            }
            if (!ok)
            {
                ushort vk = accion == "siguiente" ? Nativo.VK_MEDIA_NEXT_TRACK : accion == "anterior" ? Nativo.VK_MEDIA_PREV_TRACK : Nativo.VK_MEDIA_PLAY_PAUSE;
                Nativo.Teclas(vk);
            }
        }
    }
}

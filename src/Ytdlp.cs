using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;

namespace Lienzo
{
    /// <summary>
    /// Videos de YouTube con yt-dlp (github.com/yt-dlp/yt-dlp, libre y gratuito), como hace Lively Wallpaper.
    /// Lienzo lo descarga solo si tú se lo pides desde el panel, a %LOCALAPPDATA%\Lienzo\herramientas, y lo
    /// actualiza cada semana (YouTube cambia seguido y las versiones viejas dejan de funcionar).
    /// </summary>
    internal static class Ytdlp
    {
        private const string Descarga = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe";

        private static string Local { get { return Path.Combine(App.Actual.DirCache, "herramientas", "yt-dlp.exe"); } }

        /// <summary>El yt-dlp de Lienzo o, si ya tenías uno instalado (winget, scoop…), ese.</summary>
        public static string Ruta()
        {
            if (File.Exists(Local)) return Local;
            var dirs = (Environment.GetEnvironmentVariable("PATH") ?? "").Split(';').ToList();
            dirs.Add(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Microsoft", "WinGet", "Links"));
            foreach (var d in dirs)
            {
                try
                {
                    string r = Path.Combine(d.Trim().Trim('"'), "yt-dlp.exe");
                    if (d.Trim().Length > 0 && File.Exists(r)) return r;
                }
                catch { }
            }
            return null;
        }

        public static void Instalar(Action<int> progreso)
        {
            Directory.CreateDirectory(Path.GetDirectoryName(Local));
            App.BajarArchivo(Descarga, Local, 80L * 1024 * 1024, "exe", progreso);
        }

        private static void ActualizarSiHaceFalta()
        {
            try
            {
                if (!File.Exists(Local) || (DateTime.Now - File.GetLastWriteTime(Local)).TotalDays < 7) return;
                string s;
                Ejecutar("-U", null, 90000, out s);
                File.SetLastWriteTime(Local, DateTime.Now); // aunque no hubiera versión nueva, no volver a revisar en una semana
            }
            catch (Exception ex) { App.Registro("Actualizar yt-dlp: " + ex.Message); }
        }

        /// <summary>Un argumento entre comillas según las reglas de Windows (las \ solo se duplican antes de una comilla).</summary>
        private static string Comillas(string s)
        {
            var sb = new StringBuilder("\"");
            int barras = 0;
            foreach (char c in s ?? "")
            {
                if (c == '\\') { barras++; continue; }
                if (c == '"') { sb.Append('\\', barras * 2 + 1).Append('"'); barras = 0; continue; }
                sb.Append('\\', barras).Append(c);
                barras = 0;
            }
            return sb.Append('\\', barras * 2).Append('"').ToString();
        }

        private static int Ejecutar(string argumentos, Action<string> alRenglon, int tope, out string salida)
        {
            string exe = Ruta();
            if (exe == null) throw new Exception("Falta yt-dlp. Descárgalo con el botón del panel.");
            var psi = new ProcessStartInfo(exe, "--ignore-config --no-warnings " + argumentos)
            {
                UseShellExecute = false, CreateNoWindow = true,
                RedirectStandardOutput = true, RedirectStandardError = true,
                StandardOutputEncoding = Encoding.UTF8, StandardErrorEncoding = Encoding.UTF8,
            };
            psi.EnvironmentVariables["PYTHONIOENCODING"] = "utf-8";
            psi.EnvironmentVariables["PYTHONUTF8"] = "1";
            var texto = new StringBuilder();
            var errores = new StringBuilder();
            using (var p = new Process { StartInfo = psi })
            {
                p.OutputDataReceived += (o, e) => { if (e.Data == null) return; lock (texto) texto.AppendLine(e.Data); if (alRenglon != null) alRenglon(e.Data); };
                p.ErrorDataReceived += (o, e) => { if (e.Data == null) return; lock (errores) errores.AppendLine(e.Data); if (alRenglon != null) alRenglon(e.Data); };
                p.Start();
                p.BeginOutputReadLine();
                p.BeginErrorReadLine();
                if (!p.WaitForExit(tope)) { try { p.Kill(); } catch { } throw new Exception("tardó demasiado"); }
                p.WaitForExit();
                salida = texto.ToString();
                if (p.ExitCode != 0)
                {
                    string err = errores.ToString().Split('\n').Select(x => x.Trim()).LastOrDefault(x => x.StartsWith("ERROR")) ?? "";
                    App.Registro("yt-dlp (" + p.ExitCode + "): " + errores.ToString().Trim());
                    if (err.Length > 0) salida = err;
                }
                return p.ExitCode;
            }
        }

        private static bool EsEnlace(string q)
        {
            return Regex.IsMatch(q, @"^https://(www\.|m\.|music\.)?(youtube\.com|youtu\.be)/", RegexOptions.IgnoreCase);
        }

        private static string Duracion(double seg)
        {
            if (seg <= 0) return "";
            var t = TimeSpan.FromSeconds(seg);
            return t.TotalHours >= 1 ? t.ToString(@"h\:mm\:ss") : t.ToString(@"m\:ss");
        }

        private static readonly Regex PalabrasFondo = new Regex(@"wallpaper|fondo|loop|ambien|lofi|lo-fi|aesthetic|animated|motion|screensaver|background|4k|scenery|relax", RegexOptions.IgnoreCase);

        /// <summary>
        /// YouTube: busca «tu búsqueda + live wallpaper» y deja solo lo que parece fondo (por título y duración, sin Shorts).
        /// También acepta un enlace directo a un video.
        /// </summary>
        public static Dictionary<string, object> Buscar(string q, int pagina)
        {
            ActualizarSiHaceFalta();
            string salida;
            if (EsEnlace(q))
            {
                if (Ejecutar("-J --no-playlist " + Comillas(q), null, 60000, out salida) != 0) throw new Exception("No pude leer ese enlace de YouTube. " + salida);
                var v = Json.Objeto(salida);
                return Json.Nuevo("resultados", new List<object> { Elemento(v, Json.Texto(v, "webpage_url", q)) }, "ultima", true);
            }
            if (q.Length == 0) q = "anime";
            int cuantos = 30 * pagina;
            string busqueda = PalabrasFondo.IsMatch(q) ? q : q + " live wallpaper";
            string args = "--flat-playlist -J " + Comillas("ytsearch" + cuantos + ":" + busqueda);
            if (Ejecutar(args, null, 90000, out salida) != 0) throw new Exception("YouTube no respondió. " + salida);
            var j = Json.Objeto(salida);
            var lista = new List<object>();
            foreach (var e in (Json.Lista(j, "entries") ?? new object[0]).OfType<Dictionary<string, object>>().Skip(30 * (pagina - 1)))
            {
                string url = Json.Texto(e, "url", "");
                string titulo = Json.Texto(e, "title", "");
                double dur = Json.Numero(e, "duration", 0);
                if (url.Contains("/shorts/")) continue;                 // verticales
                if (dur > 0 && (dur < 6 || dur > 3600)) continue;       // ni clips de segundos ni transmisiones de horas
                if (!PalabrasFondo.IsMatch(titulo)) continue;           // que parezca un fondo
                url = "https://www.youtube.com/watch?v=" + Json.Texto(e, "id", "");
                lista.Add(Elemento(e, url));
            }
            return Json.Nuevo("resultados", lista, "ultima", pagina >= 3 || lista.Count == 0);
        }

        private static Dictionary<string, object> Elemento(Dictionary<string, object> e, string url)
        {
            string id = Json.Texto(e, "id", "");
            string miniatura = "https://i.ytimg.com/vi/" + id + "/mqdefault.jpg";
            if (miniatura.Length == 0)
            {
                var ts = (Json.Lista(e, "thumbnails") ?? new object[0]).OfType<Dictionary<string, object>>().LastOrDefault();
                if (ts != null) miniatura = Json.Texto(ts, "url", "");
            }
            string titulo = Json.Texto(e, "title", "");
            if (titulo.Length == 0) titulo = Json.Texto(e, "description", "Video de YouTube");
            if (titulo.Length > 90) titulo = titulo.Substring(0, 90) + "…";
            string autor = Json.Texto(e, "channel", Json.Texto(e, "uploader", ""));
            string etiqueta = Duracion(Json.Numero(e, "duration", 0));
            return Json.Nuevo("id", "yt-" + id, "nombre", titulo, "miniatura", miniatura, "descarga", url,
                "etiqueta", (etiqueta.Length > 0 ? etiqueta + " · " : "") + "video", "credito", "YouTube" + (autor.Length > 0 ? " · " + autor : ""), "video", true);
        }

        /// <summary>Descarga solo la imagen (sin audio), en H.264 si se puede (lo decodifica la tarjeta gráfica) y hasta 1440p.</summary>
        public static string Descargar(string url, string carpeta, string baseNombre, Action<int> progreso)
        {
            if (!EsEnlace(url)) throw new Exception("enlace no válido");
            ActualizarSiHaceFalta();
            string formato = "bv*[height<=1440][vcodec^=avc1]/bv*[height<=1440][ext=mp4]/bv*[height<=1440]/b[height<=1440]/b";
            string plantilla = Path.Combine(carpeta, baseNombre + ".%(ext)s");
            int ultimo = -1;
            string salida;
            int codigo = Ejecutar("-f " + Comillas(formato) + " --match-filter " + Comillas("duration <= 3600") +
                " --no-playlist --no-part --newline --progress --print after_move:filepath -o " + Comillas(plantilla) + " " + Comillas(url),
                linea =>
                {
                    var m = Regex.Match(linea, @"\[download\]\s+([\d.]+)%");
                    double pct;
                    if (m.Success && progreso != null && double.TryParse(m.Groups[1].Value, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out pct) && (int)pct >= ultimo + 2)
                    {
                        ultimo = (int)pct;
                        progreso(ultimo);
                    }
                }, 20 * 60000, out salida);
            if (codigo != 0) throw new Exception(salida.Length > 0 ? salida : "yt-dlp no pudo descargarlo");
            string ruta = salida.Split('\n').Select(x => x.Trim()).LastOrDefault(x => x.Length > 0 && File.Exists(x));
            if (ruta == null) throw new Exception("el video era muy largo o no se encontró el archivo");
            string ext = Path.GetExtension(ruta).ToLowerInvariant();
            if (ext != ".mp4" && ext != ".webm")
            {
                try { File.Delete(ruta); } catch { }
                throw new Exception("formato de video no compatible (" + ext + ")");
            }
            return ruta;
        }
    }
}

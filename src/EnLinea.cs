using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;

namespace Lienzo
{
    /// <summary>
    /// Fondos en línea. La búsqueda y la descarga las hace C# (sin problemas de CORS); el panel solo muestra.
    ///   Imágenes: Wikimedia Commons, Wallhaven, Openverse y la colección de rices de github.com/dharmx/walls.
    ///   Videos (fondos animados): MotionBGs, DesktopHut, MoeWalls, y YouTube con yt-dlp.
    /// Las direcciones de descarga se arman aquí a partir de un id o una ruta: el panel nunca manda una URL arbitraria.
    /// </summary>
    internal partial class App
    {
        private const string AgenteWeb = "Lienzo/1.0 (fondos de escritorio)";
        private const string AgenteNavegador = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
        private static readonly HashSet<string> FuentesVideo = new HashSet<string> { "motionbgs", "desktophut", "moewalls", "youtube" };
        private const string RepoWalls = "dharmx/walls";

        static App()
        {
            // .NET Framework no activa TLS 1.2 por defecto en todos los equipos.
            try { ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12; } catch { }
        }

        // ---------------- Red ----------------

        private static HttpWebRequest Pedido(string url, bool navegador)
        {
            var req = (HttpWebRequest)WebRequest.Create(url);
            req.UserAgent = navegador ? AgenteNavegador : AgenteWeb;
            req.Timeout = 20000;
            req.AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate;
            if (navegador) req.Accept = "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8";
            return req;
        }

        private static string BajarTexto(string url, bool navegador = false)
        {
            Uri final;
            return BajarTexto(url, navegador, out final);
        }

        private static string BajarTexto(string url, bool navegador, out Uri final)
        {
            using (var r = (HttpWebResponse)Pedido(url, navegador).GetResponse())
            using (var lector = new StreamReader(r.GetResponseStream(), Encoding.UTF8))
            {
                final = r.ResponseUri;
                return lector.ReadToEnd();
            }
        }

        /// <summary>
        /// Descarga con tope de tamaño, avisando el progreso (0-100), y comprueba que el contenido sea del tipo esperado:
        /// "imagen" (JPEG, PNG, WebP), "video" (MP4, WebM) o "exe".
        /// </summary>
        internal static void BajarArchivo(string url, string destino, long maximo, string tipo, Action<int> progreso)
        {
            var req = Pedido(url, true);
            req.Timeout = 30000;
            req.ReadWriteTimeout = 60000;
            string temporal = destino + ".parcial";
            try
            {
                using (var r = (HttpWebResponse)req.GetResponse())
                {
                    long esperado = r.ContentLength;
                    if (esperado > maximo) throw new Exception("el archivo pesa demasiado (" + (esperado / 1048576) + " MB)");
                    using (var origen = r.GetResponseStream())
                    using (var salida = File.Create(temporal))
                    {
                        var buf = new byte[81920];
                        long total = 0;
                        int n, ultimo = -1;
                        while ((n = origen.Read(buf, 0, buf.Length)) > 0)
                        {
                            total += n;
                            if (total > maximo) throw new Exception("el archivo pesa demasiado");
                            salida.Write(buf, 0, n);
                            if (progreso != null && esperado > 0)
                            {
                                int pct = (int)(total * 100 / esperado);
                                if (pct >= ultimo + 2) { ultimo = pct; progreso(pct); }
                            }
                        }
                    }
                }
                var c = new byte[12];
                using (var f = File.OpenRead(temporal)) f.Read(c, 0, c.Length);
                string asc4 = Encoding.ASCII.GetString(c, 4, 4);
                bool ok;
                if (tipo == "exe") ok = c[0] == 'M' && c[1] == 'Z';
                else if (tipo == "video") ok = asc4 == "ftyp" || (c[0] == 0x1A && c[1] == 0x45 && c[2] == 0xDF && c[3] == 0xA3);
                else ok = (c[0] == 0xFF && c[1] == 0xD8) || (c[0] == 0x89 && c[1] == 0x50 && c[2] == 0x4E && c[3] == 0x47) ||
                          (Encoding.ASCII.GetString(c, 0, 4) == "RIFF" && Encoding.ASCII.GetString(c, 8, 4) == "WEBP");
                if (!ok) throw new Exception(tipo == "video" ? "lo descargado no es un video" : tipo == "exe" ? "lo descargado no es un programa" : "lo descargado no es una imagen");
                if (File.Exists(destino)) File.Delete(destino);
                File.Move(temporal, destino);
            }
            finally { try { if (File.Exists(temporal)) File.Delete(temporal); } catch { } }
        }

        private static string Url(string s) { return Uri.EscapeDataString(s ?? ""); }

        private static Dictionary<string, object> Item(string id, string nombre, string miniatura, string descarga, string etiqueta, string credito, bool video)
        {
            return Json.Nuevo("id", id, "nombre", nombre, "miniatura", miniatura, "descarga", descarga, "etiqueta", etiqueta ?? "", "credito", credito ?? "", "video", video);
        }

        private static string Medidas(double w, double h) { return w > 0 && h > 0 ? Math.Round(w) + "×" + Math.Round(h) : ""; }

        private static string Html(string s)
        {
            return WebUtility.HtmlDecode(Regex.Replace(s ?? "", "<[^>]+>", "")).Trim();
        }

        // ---------------- Buscar ----------------

        private void BuscarFondos(Superficie s, Dictionary<string, object> m)
        {
            string fuente = Json.Texto(m, "fuente", "wikimedia");
            string q = Json.Texto(m, "q", "").Trim();
            string orden = Json.Texto(m, "orden", "");
            string categoria = Json.Texto(m, "categoria", "110");
            string semilla = Json.Texto(m, "semilla", "");
            int pagina = Math.Max(1, (int)Json.Numero(m, "pagina", 1));
            ThreadPool.QueueUserWorkItem(o =>
            {
                Dictionary<string, object> res;
                try
                {
                    switch (fuente)
                    {
                        case "wallhaven": res = BuscarWallhaven(q, orden, categoria, semilla, pagina); break;
                        case "openverse": res = BuscarOpenverse(q, pagina); break;
                        case "walls": res = BuscarWalls(q, semilla, pagina); break;
                        case "motionbgs": res = BuscarMotionBgs(q, semilla, pagina); break;
                        case "desktophut": res = BuscarDesktopHut(q, pagina); break;
                        case "moewalls": res = BuscarMoeWalls(q, pagina); break;
                        case "youtube": res = Ytdlp.Buscar(q, pagina); break;
                        default: res = BuscarWikimedia(q, orden, pagina); break;
                    }
                }
                catch (Exception ex)
                {
                    Registro("Fondos en línea (" + fuente + "): " + ex.Message);
                    var we = ex as WebException;
                    string error = we != null && we.Status == WebExceptionStatus.TrustFailure
                        ? "Tu red o tu antivirus bloquean esta página. Prueba con otra fuente."
                        : we != null ? "No me pude conectar con esa página. ¿Hay internet?" : ex.Message;
                    res = Json.Nuevo("error", error);
                }
                res["fuente"] = fuente;
                res["pagina"] = pagina;
                EnUi(() => s.Enviar("fondosEnLinea", res));
            });
        }

        private Dictionary<string, object> BuscarWikimedia(string q, string orden, int pagina)
        {
            const int porPagina = 40;
            string busqueda = (q.Length > 0 ? q + " " : "") + "incategory:Featured_pictures_on_Wikimedia_Commons filetype:bitmap";
            string url = "https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6" +
                "&gsrlimit=" + porPagina + "&gsroffset=" + ((pagina - 1) * porPagina) + "&gsrsearch=" + Url(busqueda) +
                (orden == "azar" ? "&gsrsort=random" : orden == "recientes" ? "&gsrsort=create_timestamp_desc" : "") +
                "&prop=imageinfo&iiprop=url%7Csize%7Cmime&iiurlwidth=480";
            var j = Json.Objeto(BajarTexto(url));
            var paginas = Json.Ruta(j, "query.pages") as Dictionary<string, object>;
            var lista = new List<KeyValuePair<int, Dictionary<string, object>>>();
            if (paginas != null)
                foreach (var p in paginas.Values.OfType<Dictionary<string, object>>())
                {
                    var info = (Json.Lista(p, "imageinfo") ?? new object[0]).OfType<Dictionary<string, object>>().FirstOrDefault();
                    if (info == null) continue;
                    double w = Json.Numero(info, "width", 0), h = Json.Numero(info, "height", 0);
                    string mime = Json.Texto(info, "mime", "");
                    if (w < 1600 || w < h * 1.2 || w > h * 2.4 || (mime != "image/jpeg" && mime != "image/png")) continue; // horizontales y grandes
                    string titulo = Json.Texto(p, "title", "");
                    string nombre = Regex.Replace(Regex.Replace(titulo, @"^File:", ""), @"\.(jpe?g|png)$", "", RegexOptions.IgnoreCase);
                    lista.Add(new KeyValuePair<int, Dictionary<string, object>>((int)Json.Numero(p, "index", 0),
                        Item("wm-" + Json.Texto(p, "pageid", ""), nombre, Json.Texto(info, "thumburl", ""), titulo, Medidas(w, h), "Wikimedia Commons", false)));
                }
            return Json.Nuevo("resultados", lista.OrderBy(x => x.Key).Select(x => (object)x.Value).ToList(), "ultima", Json.Ruta(j, "continue") == null);
        }

        private Dictionary<string, object> BuscarWallhaven(string q, string orden, string categoria, string semilla, int pagina)
        {
            if (!Regex.IsMatch(categoria, "^[01]{3}$")) categoria = "110";
            string sorting = orden == "recientes" ? "date_added" : orden == "azar" ? "random" : orden == "vistas" ? "views" : "toplist";
            // purity=100: solo contenido apto para todo público.
            string url = "https://wallhaven.cc/api/v1/search?purity=100&ratios=landscape&atleast=1920x1080&categories=" + categoria +
                "&sorting=" + sorting + "&page=" + pagina + (q.Length > 0 ? "&q=" + Url(q) : "") + (semilla.Length > 0 ? "&seed=" + Url(semilla) : "");
            var j = Json.Objeto(BajarTexto(url));
            var lista = new List<object>();
            foreach (var d in (Json.Lista(j, "data") ?? new object[0]).OfType<Dictionary<string, object>>())
            {
                string ruta = Json.Texto(d, "path", "");
                if (ruta.Length == 0) continue;
                lista.Add(Item("wh-" + Json.Texto(d, "id", ""), "Wallhaven " + Json.Texto(d, "id", ""), Json.Texto(d, "thumbs.small", ""), ruta,
                    Medidas(Json.Numero(d, "dimension_x", 0), Json.Numero(d, "dimension_y", 0)), "Wallhaven", false));
            }
            double actual = Json.Numero(j, "meta.current_page", pagina), ultima = Json.Numero(j, "meta.last_page", pagina);
            return Json.Nuevo("resultados", lista, "ultima", actual >= ultima, "semilla", Json.Texto(j, "meta.seed", semilla ?? ""));
        }

        private Dictionary<string, object> BuscarOpenverse(string q, int pagina)
        {
            string url = "https://api.openverse.org/v1/images/?q=" + Url(q.Length > 0 ? q : "landscape wallpaper") + "&page=" + pagina +
                "&page_size=20&aspect_ratio=wide&size=large&mature=false";
            var j = Json.Objeto(BajarTexto(url));
            var lista = new List<object>();
            foreach (var d in (Json.Lista(j, "results") ?? new object[0]).OfType<Dictionary<string, object>>())
            {
                double w = Json.Numero(d, "width", 0), h = Json.Numero(d, "height", 0);
                if (w > 0 && w < 1600) continue;
                string licencia = Json.Texto(d, "license", "").ToUpperInvariant();
                string autor = Json.Texto(d, "creator", "");
                lista.Add(Item("ov-" + Json.Texto(d, "id", ""), Json.Texto(d, "title", "Foto"), Json.Texto(d, "thumbnail", ""), Json.Texto(d, "id", ""),
                    Medidas(w, h), (autor.Length > 0 ? autor + " · " : "") + (licencia == "CC0" || licencia == "PDM" ? "dominio público" : "CC " + licencia), false));
            }
            return Json.Nuevo("resultados", lista, "ultima", pagina >= Json.Numero(j, "page_count", pagina));
        }

        // La colección de fondos para rices de github.com/dharmx/walls (nord, gruvbox, anime, minimal…). Se pide la lista una vez.
        private static List<string> arbolWalls;
        private static DateTime arbolWallsHora;

        private Dictionary<string, object> BuscarWalls(string q, string semilla, int pagina)
        {
            if (arbolWalls == null || (DateTime.Now - arbolWallsHora).TotalHours > 6)
            {
                var j = Json.Objeto(BajarTexto("https://api.github.com/repos/" + RepoWalls + "/git/trees/main?recursive=1"));
                arbolWalls = (Json.Lista(j, "tree") ?? new object[0]).OfType<Dictionary<string, object>>()
                    .Select(x => Json.Texto(x, "path", "")).Where(p => Regex.IsMatch(p, @"^[^/]+/[^/]+\.(jpe?g|png)$", RegexOptions.IgnoreCase)).ToList();
                arbolWallsHora = DateTime.Now;
            }
            var palabras = q.ToLowerInvariant().Split(new[] { ' ', ',' }, StringSplitOptions.RemoveEmptyEntries);
            var lista = arbolWalls.Where(p => { string t = p.ToLowerInvariant().Replace('_', ' ').Replace('-', ' '); return palabras.All(t.Contains); }).ToList();
            int s;
            if (!int.TryParse(semilla, out s)) s = Environment.TickCount;
            var azar = new Random(s);
            lista = lista.OrderBy(x => azar.Next()).ToList(); // mezcladas, pero estables entre páginas gracias a la semilla
            const int porPagina = 40;
            var resultados = lista.Skip((pagina - 1) * porPagina).Take(porPagina).Select(p =>
            {
                string categoria = p.Split('/')[0];
                string nombre = Path.GetFileNameWithoutExtension(p).Replace('_', ' ');
                if (nombre.Length > 0) nombre = char.ToUpper(nombre[0]) + nombre.Substring(1);
                string miniatura = "https://wsrv.nl/?url=" + Url("raw.githubusercontent.com/" + RepoWalls + "/main/" + p) + "&w=480&h=270&fit=cover&output=webp";
                return (object)Item("walls-" + p, nombre, miniatura, p, categoria, "Colección de rices · github.com/" + RepoWalls, false);
            }).ToList();
            return Json.Nuevo("resultados", resultados, "ultima", pagina * porPagina >= lista.Count, "semilla", s.ToString());
        }

        // ---- Fondos animados (videos) ----

        private Dictionary<string, object> BuscarMotionBgs(string q, string semilla, int pagina)
        {
            // La búsqueda redirige a /tag:x/ (que pagina con /2/) o se queda en /search?q= (que pagina con &page=2).
            string url;
            if (pagina == 1 || semilla.Length == 0) url = q.Length > 0 ? "https://motionbgs.com/search?q=" + Url(q).Replace("%20", "+") : "https://motionbgs.com/";
            else url = semilla.Contains("?") ? semilla + "&page=" + pagina : semilla + pagina + "/";
            if (pagina > 1 && semilla.Length == 0) url = q.Length > 0 ? url + "&page=" + pagina : "https://motionbgs.com/" + pagina + "/";
            Uri final;
            string html = BajarTexto(url, true, out final);
            var lista = new List<object>();
            var vistos = new HashSet<string>();
            foreach (Match mt in Regex.Matches(html, @"<a title=""([^""]+)"" href=/([a-z0-9-]+)>((?:(?!</a>).)*?)</a>", RegexOptions.Singleline))
            {
                var img = Regex.Match(mt.Groups[3].Value, @"src=/i/c/364x205/media/(\d+)/([^ >]+)");
                if (!img.Success || !vistos.Add(img.Groups[1].Value)) continue;
                string formato = Html(Regex.Match(mt.Groups[3].Value, @"<span class=frm>(.*?)</span>").Groups[1].Value);
                string nombre = Regex.Replace(Html(mt.Groups[1].Value), @"\s*live wallpaper\s*$", "", RegexOptions.IgnoreCase);
                lista.Add(Item("mbg-" + img.Groups[1].Value, nombre, "https://motionbgs.com/i/c/364x205/media/" + img.Groups[1].Value + "/" + img.Groups[2].Value,
                    img.Groups[1].Value, formato.Length > 0 ? formato + " · video" : "Video", "MotionBGs", true));
            }
            string baseUrl = semilla.Length > 0 ? semilla : final.AbsoluteUri.Contains("/tag:") ? final.AbsoluteUri.TrimEnd('/') + "/" : final.AbsoluteUri.Contains("?") ? final.AbsoluteUri : "https://motionbgs.com/";
            return Json.Nuevo("resultados", lista, "ultima", lista.Count == 0, "semilla", baseUrl);
        }

        private Dictionary<string, object> BuscarDesktopHut(string q, int pagina)
        {
            string url = q.Length > 0 ? "https://www.desktophut.com/search/" + Url(q) + "?page=" + pagina : "https://www.desktophut.com/featured-live-wallpapers?page=" + pagina;
            string html = BajarTexto(url, true);
            var lista = new List<object>();
            var vistos = new HashSet<string>();
            foreach (Match mt in Regex.Matches(html, @"<a href=""/([a-z0-9-]+)"" class=""wallpaper-card"" title=""([^""]*)""[^>]*>\s*<img src=""([^""]+)""", RegexOptions.Singleline))
            {
                if (!vistos.Add(mt.Groups[1].Value)) continue;
                string nombre = Regex.Replace(Html(mt.Groups[2].Value), @"\s*(live wallpaper)?\s*—.*$", "", RegexOptions.IgnoreCase);
                lista.Add(Item("dh-" + mt.Groups[1].Value, nombre, mt.Groups[3].Value, mt.Groups[1].Value, "Video", "DesktopHut", true));
            }
            return Json.Nuevo("resultados", lista, "ultima", lista.Count == 0);
        }

        private Dictionary<string, object> BuscarMoeWalls(string q, int pagina)
        {
            string url = "https://moewalls.com/" + (pagina > 1 ? "page/" + pagina + "/" : "") + (q.Length > 0 ? "?s=" + Url(q) : "");
            string html = BajarTexto(url, true);
            var lista = new List<object>();
            var vistos = new HashSet<string>();
            foreach (Match mt in Regex.Matches(html, @"<a title=""([^""]+)"" class=""g1-frame"" href=""(https://moewalls\.com/[^""]+)"">.*?<img[^>]+src=""([^""]+)""", RegexOptions.Singleline))
            {
                if (!vistos.Add(mt.Groups[2].Value)) continue;
                string nombre = Regex.Replace(Html(mt.Groups[1].Value), @"\s*live wallpaper\s*$", "", RegexOptions.IgnoreCase);
                lista.Add(Item("moe-" + mt.Groups[2].Value.GetHashCode().ToString("x"), nombre, mt.Groups[3].Value, mt.Groups[2].Value, "720p · video", "MoeWalls (anime)", true));
            }
            return Json.Nuevo("resultados", lista, "ultima", lista.Count == 0);
        }

        // ---------------- Descargar y usar ----------------

        /// <summary>De lo que mandó el panel (un id, una ruta o la página del fondo) a la dirección real del archivo.</summary>
        private static string ResolverDescarga(string fuente, string descarga, string calidad)
        {
            switch (fuente)
            {
                case "wikimedia": return UrlWikimedia(descarga);
                case "wallhaven":
                    if (!Regex.IsMatch(descarga, @"^https://w\.wallhaven\.cc/full/[\w/.-]+$")) throw new Exception("dirección no válida");
                    return descarga;
                case "openverse":
                    {
                        if (!Regex.IsMatch(descarga, @"^[0-9a-f-]{36}$")) throw new Exception("imagen no válida");
                        string u = Json.Texto(Json.Objeto(BajarTexto("https://api.openverse.org/v1/images/" + descarga + "/")), "url", "");
                        if (!u.StartsWith("https://") && !u.StartsWith("http://")) throw new Exception("la imagen ya no está disponible");
                        return u;
                    }
                case "walls":
                    if (!Regex.IsMatch(descarga, @"^[\w.-]+/[^/\\]+\.(jpe?g|png)$", RegexOptions.IgnoreCase) || descarga.Contains("..")) throw new Exception("ruta no válida");
                    return "https://raw.githubusercontent.com/" + RepoWalls + "/main/" + string.Join("/", descarga.Split('/').Select(Uri.EscapeDataString));
                case "motionbgs":
                    if (!Regex.IsMatch(descarga, @"^\d+$")) throw new Exception("video no válido");
                    return "https://motionbgs.com/dl/" + (calidad == "4k" ? "4k" : "hd") + "/" + descarga + "/";
                case "desktophut":
                    {
                        if (!Regex.IsMatch(descarga, "^[a-z0-9-]+$")) throw new Exception("video no válido");
                        var mt = Regex.Match(BajarTexto("https://www.desktophut.com/" + descarga, true), @"https://media\.desktophut\.com/files/[\w%.-]+\.mp4");
                        if (!mt.Success) throw new Exception("no encontré el video en la página");
                        return mt.Value;
                    }
                case "moewalls":
                    {
                        if (!Regex.IsMatch(descarga, @"^https://moewalls\.com/[\w/-]+/?$")) throw new Exception("video no válido");
                        var mt = Regex.Match(BajarTexto(descarga, true), @"/wp-content/uploads/preview/[\w/.-]+\.(webm|mp4)");
                        if (!mt.Success) throw new Exception("no encontré el video en la página");
                        return "https://moewalls.com" + mt.Value;
                    }
            }
            throw new Exception("fuente desconocida");
        }

        private void DescargarFondo(Superficie s, Dictionary<string, object> m)
        {
            string fuente = Json.Texto(m, "fuente", ""), descarga = Json.Texto(m, "descarga", ""), nombre = Json.Texto(m, "nombre", "Fondo");
            string id = Json.Texto(m, "id", ""), miniatura = Json.Texto(m, "miniatura", ""), calidad = Json.Texto(m, "calidad", "hd");
            bool video = FuentesVideo.Contains(fuente);
            Action<int> progreso = pct => EnUi(() => s.Enviar("progresoDescarga", Json.Nuevo("id", id, "pct", pct)));
            ThreadPool.QueueUserWorkItem(o =>
            {
                string respaldo = null;
                try
                {
                    string carpeta = Path.Combine(DirDatos, "biblioteca");
                    Directory.CreateDirectory(carpeta);
                    string limpio = Regex.Replace(nombre, @"[^\w\-]+", "-").Trim('-');
                    if (limpio.Length == 0) limpio = "fondo";
                    if (limpio.Length > 40) limpio = limpio.Substring(0, 40);
                    string baseNombre = limpio + "-" + DateTime.Now.ToString("yyMMddHHmmss");
                    string destino;
                    if (fuente == "youtube")
                        destino = Ytdlp.Descargar(descarga, carpeta, baseNombre, progreso);
                    else
                    {
                        string url = ResolverDescarga(fuente, descarga, calidad);
                        string ext = Path.GetExtension(new Uri(url).AbsolutePath).ToLowerInvariant();
                        if (video) { if (ext != ".webm") ext = ".mp4"; }
                        else if (ext != ".png" && ext != ".webp") ext = ".jpg";
                        destino = Path.Combine(carpeta, baseNombre + ext);
                        BajarArchivo(url, destino, video ? 400L * 1024 * 1024 : 60L * 1024 * 1024, video ? "video" : "imagen", progreso);
                    }
                    // Windows no siempre sabe hacer la miniatura de un video (WebM): se usa la del sitio, convertida a JPG.
                    if (video && miniatura.StartsWith("https://"))
                    {
                        try
                        {
                            respaldo = Path.Combine(Path.GetTempPath(), "lienzo-mini-" + baseNombre + ".jpg");
                            BajarArchivo("https://wsrv.nl/?url=" + Url(miniatura) + "&w=640&output=jpg", respaldo, 10L * 1024 * 1024, "imagen", null);
                        }
                        catch (Exception ex) { Registro("Miniatura de respaldo: " + ex.Message); respaldo = null; }
                    }
                    string r = respaldo;
                    EnUi(() => ImportarFondo(s, destino, nombre, r));
                }
                catch (Exception ex)
                {
                    Registro("Descargar fondo (" + fuente + "): " + ex.Message);
                    EnUi(() => s.Enviar("archivoElegido", Json.Nuevo("para", "fondo", "error", "no se pudo descargar: " + ex.Message)));
                }
            });
        }

        /// <summary>Wikimedia: pide una versión del tamaño de tu pantalla (los originales pueden pesar 50 MB).</summary>
        private static string UrlWikimedia(string titulo)
        {
            if (!titulo.StartsWith("File:")) throw new Exception("archivo no válido");
            var mon = Monitor.Principal_();
            int ancho = Math.Max(1920, Math.Min(3840, mon != null ? mon.Area.Width : 2560));
            var j = Json.Objeto(BajarTexto("https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url%7Csize" +
                "&iiurlwidth=" + ancho + "&titles=" + Url(titulo)));
            var paginas = Json.Ruta(j, "query.pages") as Dictionary<string, object>;
            var p = paginas != null ? paginas.Values.OfType<Dictionary<string, object>>().FirstOrDefault() : null;
            var info = p != null ? (Json.Lista(p, "imageinfo") ?? new object[0]).OfType<Dictionary<string, object>>().FirstOrDefault() : null;
            if (info == null) throw new Exception("no encontré la imagen");
            string thumb = Json.Texto(info, "thumburl", "");
            return thumb.Length > 0 && Json.Numero(info, "thumbwidth", 0) < Json.Numero(info, "width", 0) ? thumb : Json.Texto(info, "url", "");
        }

        // ---------------- yt-dlp (YouTube) ----------------

        private void EnviarHerramientas(Superficie s)
        {
            s.Enviar("herramientas", Json.Nuevo("ytdlp", Ytdlp.Ruta() != null));
        }

        private void InstalarYtdlp(Superficie s)
        {
            ThreadPool.QueueUserWorkItem(o =>
            {
                string error = null;
                try { Ytdlp.Instalar(pct => EnUi(() => s.Enviar("progresoHerramienta", Json.Nuevo("pct", pct)))); }
                catch (Exception ex) { error = ex.Message; Registro("Instalar yt-dlp: " + ex); }
                EnUi(() =>
                {
                    EnviarHerramientas(s);
                    s.Enviar("aviso", Json.Nuevo("texto", error == null ? "yt-dlp listo: ya puedes buscar en YouTube." : "No se pudo descargar yt-dlp: " + error));
                });
            });
        }
    }
}

using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Windows.Forms;
using Timer = System.Windows.Forms.Timer;

namespace Lienzo
{
    /// <summary>
    /// Tu rice como archivo (los «dotfiles» de Lienzo): un .lienzo es un zip con rice.json (fondo, colores,
    /// letra, barra y bloques) y, si hace falta, la imagen/video del fondo o la carpeta de la escena HTML.
    /// También: llevar la paleta a Windows Terminal cuando cambia.
    /// </summary>
    internal partial class App
    {
        private static readonly string[] PartesRice = { "fondo", "paleta", "estilo", "barra", "bloques" };
        private static readonly HashSet<string> ExtMedios = new HashSet<string>
            { ".mp4", ".webm", ".mov", ".m4v", ".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".avif" };

        private static string NombreArchivo(string s, string defecto)
        {
            string limpio = Regex.Replace(s ?? "", @"[^\w\- ]+", "").Trim();
            if (limpio.Length > 40) limpio = limpio.Substring(0, 40).Trim();
            return limpio.Length > 0 ? limpio : defecto;
        }

        // ---------------- Exportar ----------------

        private void ExportarRice(Superficie s, string nombre)
        {
            string ruta;
            using (var d = new SaveFileDialog())
            {
                d.Title = "Exportar mi rice";
                d.Filter = "Rice de Lienzo (*.lienzo)|*.lienzo";
                d.FileName = NombreArchivo(nombre, "mi-rice") + ".lienzo";
                if (d.ShowDialog(new Envoltura(s.Handle)) != DialogResult.OK) return;
                ruta = d.FileName;
            }
            var config = new Dictionary<string, object>();
            foreach (var k in PartesRice) if (Config.ContainsKey(k)) config[k] = Config[k];
            var fondo = Json.Ruta(Config, "fondo") as Dictionary<string, object> ?? new Dictionary<string, object>();
            string tipo = Json.Texto(fondo, "tipo", "");
            var bib = (Json.Lista(Config, "biblioteca") ?? new object[0]).OfType<Dictionary<string, object>>()
                .FirstOrDefault(b => Json.Texto(b, "archivo", "") == Json.Texto(fondo, "archivo", ""));
            var rice = Json.Nuevo("formato", "lienzo-rice", "version", 1, "nombre", nombre, "fecha", DateTime.Now.ToString("s"),
                "fondoNombre", bib != null ? Json.Texto(bib, "nombre", "") : "", "config", config);
            string datos = DirDatos;
            EnSta(() =>
            {
                string error = null;
                try
                {
                    string temporal = ruta + ".tmp";
                    if (File.Exists(temporal)) File.Delete(temporal);
                    using (var zip = ZipFile.Open(temporal, ZipArchiveMode.Create))
                    {
                        var e = zip.CreateEntry("rice.json");
                        using (var w = new StreamWriter(e.Open(), new UTF8Encoding(false))) w.Write(Terminal.Bonito(rice));
                        if (tipo == "imagen" || tipo == "video")
                        {
                            string archivo = Path.Combine(datos, Json.Texto(fondo, "archivo", "").Replace('/', '\\'));
                            if (File.Exists(archivo)) zip.CreateEntryFromFile(archivo, "fondo/" + Path.GetFileName(archivo), CompressionLevel.NoCompression);
                        }
                        else if (tipo == "html")
                        {
                            string dir = Path.Combine(datos, "escenas", Json.Texto(fondo, "carpeta", ""));
                            if (Directory.Exists(dir))
                                foreach (var f in Directory.GetFiles(dir, "*", SearchOption.AllDirectories))
                                    zip.CreateEntryFromFile(f, "escena/" + f.Substring(dir.Length).TrimStart('\\').Replace('\\', '/'), CompressionLevel.Optimal);
                        }
                    }
                    if (File.Exists(ruta)) File.Delete(ruta);
                    File.Move(temporal, ruta);
                }
                catch (Exception ex) { error = ex.Message; Registro("Exportar rice: " + ex); }
                EnUi(() => AvisarPanel(error == null ? "Rice exportado: " + Path.GetFileName(ruta) : "No se pudo exportar: " + error));
            });
        }

        // ---------------- Importar ----------------

        private void ImportarRice(Superficie s)
        {
            string ruta;
            using (var d = new OpenFileDialog())
            {
                d.Title = "Importar un rice de Lienzo";
                d.Filter = "Rice de Lienzo (*.lienzo)|*.lienzo|Todos los archivos|*.*";
                if (d.ShowDialog(new Envoltura(s.Handle)) != DialogResult.OK) return;
                ruta = d.FileName;
            }
            string datos = DirDatos;
            EnSta(() =>
            {
                string error = null, nombre = Path.GetFileNameWithoutExtension(ruta);
                Dictionary<string, object> config = null, entrada = null;
                try
                {
                    using (var zip = ZipFile.OpenRead(ruta))
                    {
                        var j = zip.GetEntry("rice.json");
                        if (j == null) throw new Exception("no es un rice de Lienzo");
                        Dictionary<string, object> rice;
                        using (var r = new StreamReader(j.Open(), Encoding.UTF8)) rice = Json.Objeto(r.ReadToEnd());
                        if (rice == null || Json.Texto(rice, "formato", "") != "lienzo-rice") throw new Exception("no es un rice de Lienzo");
                        config = Json.Ruta(rice, "config") as Dictionary<string, object>;
                        if (config == null) throw new Exception("el archivo está incompleto");
                        nombre = NombreArchivo(Json.Texto(rice, "nombre", nombre), nombre);
                        foreach (var k in config.Keys.ToList()) if (!PartesRice.Contains(k)) config.Remove(k); // solo lo visual

                        var fondo = Json.Ruta(config, "fondo") as Dictionary<string, object>;
                        string tipo = fondo != null ? Json.Texto(fondo, "tipo", "") : "";
                        if (tipo == "imagen" || tipo == "video")
                        {
                            var e = zip.Entries.FirstOrDefault(x => x.FullName.StartsWith("fondo/") && x.Name.Length > 0 && ExtMedios.Contains(Path.GetExtension(x.Name).ToLowerInvariant()));
                            if (e == null) fondo["tipo"] = "color";
                            else
                            {
                                string carpeta = Path.Combine(datos, "biblioteca");
                                Directory.CreateDirectory(carpeta);
                                string limpio = Regex.Replace(Path.GetFileNameWithoutExtension(e.Name), @"[^\w\-]+", "-").Trim('-');
                                if (limpio.Length == 0) limpio = "fondo";
                                if (limpio.Length > 40) limpio = limpio.Substring(0, 40);
                                string id = limpio + "-" + DateTime.Now.ToString("yyMMddHHmmss");
                                string destino = Path.Combine(carpeta, id + Path.GetExtension(e.Name).ToLowerInvariant());
                                e.ExtractToFile(destino, true);
                                string visible = Json.Texto(rice, "fondoNombre", "");
                                entrada = EntradaBiblioteca(destino, id, visible.Length > 0 ? visible : limpio);
                                fondo["archivo"] = entrada["archivo"];
                                fondo["tipo"] = entrada["tipo"];
                            }
                        }
                        else if (tipo == "html")
                        {
                            string raiz = Path.Combine(datos, "escenas");
                            string carpeta = NombreArchivo(Json.Texto(fondo, "carpeta", ""), "escena").Replace(' ', '-');
                            string unica = carpeta;
                            for (int n = 2; Directory.Exists(Path.Combine(raiz, unica)); n++) unica = carpeta + "-" + n;
                            string dir = Path.GetFullPath(Path.Combine(raiz, unica));
                            int archivos = 0;
                            foreach (var e in zip.Entries.Where(x => x.FullName.StartsWith("escena/") && x.Name.Length > 0))
                            {
                                // Nada puede salirse de la carpeta de la escena (rutas con ..\ o absolutas).
                                string completo = Path.GetFullPath(Path.Combine(dir, e.FullName.Substring(7).Replace('/', '\\')));
                                if (!completo.StartsWith(dir + "\\", StringComparison.OrdinalIgnoreCase)) continue;
                                Directory.CreateDirectory(Path.GetDirectoryName(completo));
                                e.ExtractToFile(completo, true);
                                archivos++;
                            }
                            if (archivos == 0) fondo["tipo"] = "color"; else fondo["carpeta"] = unica;
                        }
                    }
                }
                catch (InvalidDataException) { error = "el archivo está dañado o no es un rice"; }
                catch (Exception ex) { error = ex.Message; Registro("Importar rice: " + ex); }

                EnUi(() =>
                {
                    if (error != null) { AvisarPanel("No se pudo importar: " + error); return; }
                    var c = Json.Fusionar(Config, null);
                    var actuales = (Json.Lista(c, "bloques") ?? new object[0]).OfType<Dictionary<string, object>>().ToList();
                    foreach (var kv in config) c[kv.Key] = kv.Value;
                    // Como al aplicar un tema: tus bloques de tipos que el rice no trae (apps, clima, letras…) se quedan.
                    var delRice = (Json.Lista(c, "bloques") ?? new object[0]).OfType<Dictionary<string, object>>().ToList();
                    var tipos = new HashSet<string>(delRice.Select(b => Json.Texto(b, "tipo", "")));
                    var ids = new HashSet<string>(delRice.Select(b => Json.Texto(b, "id", "")));
                    var combinados = delRice.Cast<object>().ToList();
                    foreach (var b in actuales.Where(b => !tipos.Contains(Json.Texto(b, "tipo", ""))))
                    {
                        if (ids.Contains(Json.Texto(b, "id", ""))) b["id"] = Json.Texto(b, "tipo", "bloque") + "-" + Guid.NewGuid().ToString("N").Substring(0, 6);
                        combinados.Add(b);
                    }
                    c["bloques"] = combinados;
                    if (entrada != null)
                    {
                        var bib = (Json.Lista(c, "biblioteca") ?? new object[0]).Cast<object>().ToList();
                        bib.Add(entrada);
                        c["biblioteca"] = bib;
                    }
                    string id = "mio-" + DateTime.Now.Ticks.ToString("x");
                    var mis = (Json.Lista(c, "misRices") ?? new object[0]).Cast<object>().ToList();
                    mis.Add(Json.Nuevo("id", id, "nombre", nombre, "config", Json.Fusionar(config, null)));
                    c["misRices"] = mis;
                    c["rice"] = id;
                    CambiarConfig(c);
                    AvisarPanel("«" + nombre + "» importado y aplicado. También quedó en «Mis rices».");
                });
            });
        }

        // ---------------- Colores en Windows Terminal ----------------

        private Timer relojTerminal;
        private bool avisarTerminal;

        /// <summary>Se llama al cambiar la configuración. Espera un poco: la paleta automática cambia varias veces seguidas.</summary>
        private void RevisarTerminal(Dictionary<string, object> anterior)
        {
            bool activo = CfgBool("terminal.colores", false);
            bool cambioOpcion = Cambio(anterior, "terminal.colores");
            if (cambioOpcion && (anterior != null || activo)) ProgramarTerminal(anterior != null);
            else if (activo && Cambio(anterior, "paleta.colores")) ProgramarTerminal(false);
        }

        private void ProgramarTerminal(bool avisar)
        {
            avisarTerminal |= avisar;
            if (relojTerminal == null)
            {
                relojTerminal = new Timer { Interval = 1200 };
                relojTerminal.Tick += (o, e) =>
                {
                    relojTerminal.Stop();
                    bool activo = CfgBool("terminal.colores", false), aviso = avisarTerminal;
                    avisarTerminal = false;
                    var colores = Json.Ruta(Config, "paleta.colores") as Dictionary<string, object> ?? new Dictionary<string, object>();
                    ThreadPool.QueueUserWorkItem(x =>
                    {
                        string texto;
                        try { texto = activo ? Terminal.Aplicar(colores) : Terminal.Quitar(); }
                        catch (Exception ex) { texto = "Windows Terminal: " + ex.Message; Registro("Terminal: " + ex); }
                        if (texto == null && aviso) texto = activo ? "Listo: Windows Terminal usa ahora los colores de tu tema." : "Windows Terminal volvió a sus colores de antes.";
                        if (texto != null && aviso) EnUi(() => AvisarPanel(texto));
                    });
                };
            }
            relojTerminal.Stop();
            relojTerminal.Start();
        }
    }
}

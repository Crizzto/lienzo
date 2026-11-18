using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;

namespace Lienzo
{
    /// <summary>
    /// Lleva la paleta de Lienzo a Windows Terminal (como pywal en Linux): agrega un esquema de colores «Lienzo»
    /// y lo pone como predeterminado. La primera vez guarda una copia de su settings.json y recuerda el esquema
    /// que tenías, para devolverlo al desactivar la opción. Windows Terminal recarga su configuración solo.
    /// </summary>
    internal static class Terminal
    {
        public const string Esquema = "Lienzo";
        private static readonly object candado = new object();

        public static List<string> Rutas()
        {
            string local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            var candidatas = new[]
            {
                Path.Combine(local, "Packages", "Microsoft.WindowsTerminal_8wekyb3d8bbwe", "LocalState", "settings.json"),
                Path.Combine(local, "Packages", "Microsoft.WindowsTerminalPreview_8wekyb3d8bbwe", "LocalState", "settings.json"),
                Path.Combine(local, "Microsoft", "Windows Terminal", "settings.json"),
            };
            return candidatas.Where(File.Exists).ToList();
        }

        private static string ArchivoEstado { get { return Path.Combine(App.Actual.DirDatos, "terminal.json"); } }

        private static Dictionary<string, object> LeerEstado()
        {
            try { if (File.Exists(ArchivoEstado)) return Json.Objeto(File.ReadAllText(ArchivoEstado, Encoding.UTF8)) ?? new Dictionary<string, object>(); }
            catch { }
            return new Dictionary<string, object>();
        }

        private static void GuardarEstado(Dictionary<string, object> e)
        {
            File.WriteAllText(ArchivoEstado, Json.Escribir(e), new UTF8Encoding(false));
        }

        /// <summary>Devuelve un texto para el usuario (o null si no hay nada que decir).</summary>
        public static string Aplicar(Dictionary<string, object> colores)
        {
            lock (candado)
            {
                var rutas = Rutas();
                if (rutas.Count == 0) return "No encontré Windows Terminal. Instálalo desde la Microsoft Store y vuelve a activar la opción.";
                var esquema = Generar(colores);
                var estado = LeerEstado();
                int hechos = 0;
                foreach (var ruta in rutas)
                {
                    try
                    {
                        string original = File.ReadAllText(ruta, Encoding.UTF8);
                        var raiz = Json.Objeto(LimpiarJsonc(original));
                        if (raiz == null) { App.Registro("Terminal: no entendí " + ruta); continue; }

                        var esquemas = new List<object>((Json.Lista(raiz, "schemes") ?? new object[0]).Cast<object>()
                            .Where(x => !(x is Dictionary<string, object>) || Json.Texto((Dictionary<string, object>)x, "name", "") != Esquema));
                        esquemas.Add(esquema);
                        raiz["schemes"] = esquemas;

                        var perfiles = Json.Ruta(raiz, "profiles") as Dictionary<string, object>;
                        if (perfiles != null)
                        {
                            var defecto = perfiles.ContainsKey("defaults") && perfiles["defaults"] is Dictionary<string, object>
                                ? (Dictionary<string, object>)perfiles["defaults"] : new Dictionary<string, object>();
                            if (!estado.ContainsKey(ruta))
                            {
                                object previo;
                                defecto.TryGetValue("colorScheme", out previo);
                                estado[ruta] = Json.Nuevo("previo", previo is string && (string)previo != Esquema ? previo : null);
                            }
                            defecto["colorScheme"] = Esquema;
                            perfiles["defaults"] = defecto;
                        }

                        Escribir(ruta, original, raiz);
                        hechos++;
                    }
                    catch (Exception ex) { App.Registro("Terminal (" + ruta + "): " + ex.Message); }
                }
                GuardarEstado(estado);
                return hechos > 0 ? null : "No pude cambiar la configuración de Windows Terminal (mira el registro de Lienzo).";
            }
        }

        public static string Quitar()
        {
            lock (candado)
            {
                var estado = LeerEstado();
                foreach (var ruta in Rutas())
                {
                    try
                    {
                        string original = File.ReadAllText(ruta, Encoding.UTF8);
                        var raiz = Json.Objeto(LimpiarJsonc(original));
                        if (raiz == null) continue;
                        var lista = Json.Lista(raiz, "schemes");
                        if (lista != null)
                            raiz["schemes"] = lista.Cast<object>().Where(x => !(x is Dictionary<string, object>) || Json.Texto((Dictionary<string, object>)x, "name", "") != Esquema).ToList();
                        var defecto = Json.Ruta(raiz, "profiles.defaults") as Dictionary<string, object>;
                        if (defecto != null && Json.Texto(defecto, "colorScheme", "") == Esquema)
                        {
                            // Las claves del estado son rutas con puntos: se leen directo, no con Json.Ruta.
                            object guardado;
                            var e = estado.TryGetValue(ruta, out guardado) ? guardado as Dictionary<string, object> : null;
                            string previo = e != null ? Json.Texto(e, "previo", null) : null;
                            if (string.IsNullOrEmpty(previo)) defecto.Remove("colorScheme"); else defecto["colorScheme"] = previo;
                        }
                        // Los perfiles que apuntaban a nuestro esquema (p. ej. elegido a mano) se quedarían sin colores.
                        foreach (var p in (Json.Lista(raiz, "profiles.list") ?? new object[0]).OfType<Dictionary<string, object>>())
                            if (Json.Texto(p, "colorScheme", "") == Esquema) p.Remove("colorScheme");
                        Escribir(ruta, original, raiz);
                        estado.Remove(ruta);
                    }
                    catch (Exception ex) { App.Registro("Terminal (quitar " + ruta + "): " + ex.Message); }
                }
                GuardarEstado(estado);
                return null;
            }
        }

        private static void Escribir(string ruta, string original, Dictionary<string, object> raiz)
        {
            string nuevo = Bonito(raiz);
            if (nuevo == original) return;
            string copia = ruta + ".antes-de-lienzo";
            if (!File.Exists(copia)) File.Copy(ruta, copia);
            string temporal = ruta + ".lienzo-tmp";
            File.WriteAllText(temporal, nuevo, new UTF8Encoding(false));
            File.Copy(temporal, ruta, true);
            File.Delete(temporal);
        }

        // ---------------- JSON con comentarios (como lo guarda Windows Terminal) ----------------

        /// <summary>Quita comentarios // y /* */ y comas sobrantes, respetando el texto entre comillas.</summary>
        public static string LimpiarJsonc(string s)
        {
            var sb = new StringBuilder(s.Length);
            bool cadena = false;
            for (int i = 0; i < s.Length; i++)
            {
                char c = s[i];
                if (cadena)
                {
                    sb.Append(c);
                    if (c == '\\' && i + 1 < s.Length) { sb.Append(s[++i]); continue; }
                    if (c == '"') cadena = false;
                    continue;
                }
                if (c == '"') { cadena = true; sb.Append(c); continue; }
                if (c == '/' && i + 1 < s.Length && s[i + 1] == '/') { while (i < s.Length && s[i] != '\n') i++; sb.Append('\n'); continue; }
                if (c == '/' && i + 1 < s.Length && s[i + 1] == '*')
                {
                    int fin = s.IndexOf("*/", i + 2, StringComparison.Ordinal);
                    i = fin < 0 ? s.Length : fin + 1;
                    continue;
                }
                if (c == ',')
                {
                    int j = i + 1;
                    while (j < s.Length && char.IsWhiteSpace(s[j])) j++;
                    // Una coma justo antes de } o ] (o de un comentario que lleva a ellos) se omite.
                    if (j < s.Length && (s[j] == '}' || s[j] == ']')) continue;
                    if (j + 1 < s.Length && s[j] == '/' && (s[j + 1] == '/' || s[j + 1] == '*'))
                    {
                        string resto = LimpiarJsonc(s.Substring(j)).TrimStart();
                        if (resto.StartsWith("}") || resto.StartsWith("]")) continue;
                    }
                }
                sb.Append(c);
            }
            return sb.ToString();
        }

        public static string Bonito(object v)
        {
            var sb = new StringBuilder();
            EscribirBonito(sb, v, 0);
            return sb.Append('\n').ToString();
        }

        private static void EscribirBonito(StringBuilder sb, object v, int nivel)
        {
            var dic = v as Dictionary<string, object>;
            if (dic != null)
            {
                if (dic.Count == 0) { sb.Append("{}"); return; }
                sb.Append("{\n");
                int i = 0;
                foreach (var kv in dic)
                {
                    sb.Append(' ', (nivel + 1) * 4).Append(Cadena(kv.Key)).Append(": ");
                    EscribirBonito(sb, kv.Value, nivel + 1);
                    sb.Append(++i < dic.Count ? ",\n" : "\n");
                }
                sb.Append(' ', nivel * 4).Append('}');
                return;
            }
            var lista = v as IList;
            if (lista != null && !(v is string))
            {
                if (lista.Count == 0) { sb.Append("[]"); return; }
                sb.Append("[\n");
                for (int i = 0; i < lista.Count; i++)
                {
                    sb.Append(' ', (nivel + 1) * 4);
                    EscribirBonito(sb, lista[i], nivel + 1);
                    sb.Append(i + 1 < lista.Count ? ",\n" : "\n");
                }
                sb.Append(' ', nivel * 4).Append(']');
                return;
            }
            if (v is string) { sb.Append(Cadena((string)v)); return; }
            sb.Append(Json.Escribir(v));
        }

        /// <summary>Cadena JSON legible (sin < y compañía, que también son válidos pero feos).</summary>
        private static string Cadena(string s)
        {
            var sb = new StringBuilder("\"");
            foreach (char c in s)
            {
                if (c == '"') sb.Append("\\\"");
                else if (c == '\\') sb.Append("\\\\");
                else if (c == '\n') sb.Append("\\n");
                else if (c == '\r') sb.Append("\\r");
                else if (c == '\t') sb.Append("\\t");
                else if (c < 0x20) sb.Append("\\u").Append(((int)c).ToString("x4"));
                else sb.Append(c);
            }
            return sb.Append('"').ToString();
        }

        // ---------------- Esquema de colores a partir de la paleta ----------------

        public static Dictionary<string, object> Generar(Dictionary<string, object> c)
        {
            var fondo = Hex(c, "fondo", "#14111f"); var texto = Hex(c, "texto", "#f3effc"); var tenue = Hex(c, "tenue", "#a69cc2");
            var acento = Hex(c, "acento", "#ff7eb6"); var acento2 = Hex(c, "acento2", "#8be9fd");
            bool claro = Luz(fondo) > 0.5;
            // Colores ANSI clásicos (rojo, verde…) teñidos un poco con el acento para que combinen con el tema.
            Func<double, double, double, double[]> ansi = (h, s, l) => Mezclar(DeHsl(h, s, claro ? l - 0.24 : l), acento, 0.12);
            Func<double[], double[]> brillante = x => claro ? Mezclar(x, new[] { 0.0, 0, 0 }, 0.12) : Mezclar(x, new[] { 1.0, 1, 1 }, 0.16);
            var rojo = ansi(356, 0.72, 0.64); var verde = ansi(135, 0.48, 0.62); var amarillo = ansi(42, 0.78, 0.66); var azul = ansi(215, 0.72, 0.68);
            return Json.Nuevo(
                "name", Esquema,
                "background", AHex(fondo), "foreground", AHex(texto), "cursorColor", AHex(acento), "selectionBackground", AHex(Mezclar(fondo, acento, 0.35)),
                "black", AHex(Mezclar(fondo, texto, 0.14)), "red", AHex(rojo), "green", AHex(verde), "yellow", AHex(amarillo),
                "blue", AHex(azul), "purple", AHex(acento), "cyan", AHex(acento2), "white", AHex(Mezclar(tenue, texto, 0.5)),
                "brightBlack", AHex(Mezclar(tenue, fondo, 0.2)), "brightRed", AHex(brillante(rojo)), "brightGreen", AHex(brillante(verde)),
                "brightYellow", AHex(brillante(amarillo)), "brightBlue", AHex(brillante(azul)), "brightPurple", AHex(brillante(acento)),
                "brightCyan", AHex(brillante(acento2)), "brightWhite", AHex(texto));
        }

        private static double[] Hex(Dictionary<string, object> c, string rol, string defecto)
        {
            string h = Json.Texto(c, rol, defecto).TrimStart('#');
            if (h.Length == 3) h = string.Concat(h.Select(x => new string(x, 2)));
            int n;
            if (h.Length != 6 || !int.TryParse(h, NumberStyles.HexNumber, CultureInfo.InvariantCulture, out n)) return Hex(new Dictionary<string, object>(), rol, defecto);
            return new[] { ((n >> 16) & 255) / 255.0, ((n >> 8) & 255) / 255.0, (n & 255) / 255.0 };
        }

        private static string AHex(double[] c)
        {
            Func<double, int> b = x => (int)Math.Round(Math.Max(0, Math.Min(1, x)) * 255);
            return "#" + b(c[0]).ToString("X2") + b(c[1]).ToString("X2") + b(c[2]).ToString("X2");
        }

        private static double[] Mezclar(double[] a, double[] b, double t)
        {
            return new[] { a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t };
        }

        private static double Luz(double[] c) { return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }

        private static double[] DeHsl(double h, double s, double l)
        {
            l = Math.Max(0, Math.Min(1, l));
            double c = (1 - Math.Abs(2 * l - 1)) * s, x = c * (1 - Math.Abs((h / 60) % 2 - 1)), m = l - c / 2;
            double r = 0, g = 0, b = 0;
            if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; }
            else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
            return new[] { r + m, g + m, b + m };
        }
    }
}

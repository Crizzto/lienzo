using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

namespace Lienzo
{
    /// <summary>Ajustes de Windows: iconos del escritorio, modo oscuro/claro, color de énfasis, botones de la barra nativa e inicio con Windows.</summary>
    internal static class Aspecto
    {
        private static bool? iconosOriginales;

        // ---------------- Iconos del escritorio ----------------

        public static bool IconosVisibles()
        {
            IntPtr lista = Escritorio.ListaIconos();
            return lista == IntPtr.Zero || Nativo.IsWindowVisible(lista);
        }

        private static string RutaEstadoIconos
        {
            get { return System.IO.Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Lienzo", "estado-iconos.json"); }
        }

        /// <summary>Muestra u oculta los iconos (igual que clic derecho → Ver → Mostrar iconos del escritorio).</summary>
        public static void MostrarIconos(bool mostrar)
        {
            IntPtr lista = Escritorio.ListaIconos();
            if (lista == IntPtr.Zero) return;
            bool visibles = Nativo.IsWindowVisible(lista);
            if (visibles == mostrar) return;
            if (!iconosOriginales.HasValue)
            {
                iconosOriginales = visibles;
                // Se apunta en disco para poder deshacerlo aunque Lienzo se cierre de golpe (restaurar.cmd).
                try { System.IO.File.WriteAllText(RutaEstadoIconos, Json.Escribir(Json.Nuevo("originales", visibles))); } catch { }
            }
            Nativo.PostMessage(Escritorio.DefView, Nativo.WM_COMMAND, new IntPtr(0x7402), IntPtr.Zero);
        }

        /// <summary>Al salir de Lienzo, los iconos vuelven a como estaban.</summary>
        public static void RestaurarIconos()
        {
            if (iconosOriginales.HasValue) MostrarIconos(iconosOriginales.Value);
            iconosOriginales = null;
            try { System.IO.File.Delete(RutaEstadoIconos); } catch { }
        }

        /// <summary>Lienzo.exe --restaurar: deja los iconos como estaban antes de que Lienzo los tocara.</summary>
        public static void RestaurarIconosDeEmergencia()
        {
            try
            {
                if (!System.IO.File.Exists(RutaEstadoIconos)) return;
                bool originales = Json.Bool(Json.Objeto(System.IO.File.ReadAllText(RutaEstadoIconos)), "originales", true);
                MostrarIconos(originales);
                System.IO.File.Delete(RutaEstadoIconos);
            }
            catch { }
        }

        // Tamaño de iconos: IShellWindows → escritorio → IFolderView2.SetViewModeAndIconSize
        [ComImport, Guid("6D5140C1-7436-11CE-8034-00AA006009FA"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        private interface IServiceProvider
        {
            [PreserveSig] int QueryService(ref Guid servicio, ref Guid iid, [MarshalAs(UnmanagedType.IUnknown)] out object objeto);
        }

        [ComImport, Guid("000214E2-0000-0000-C000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        private interface IShellBrowser
        {
            void GetWindow(out IntPtr h); void ContextSensitiveHelp(bool f);
            void InsertMenusSB(IntPtr a, IntPtr b); void SetMenuSB(IntPtr a, IntPtr b, IntPtr c); void RemoveMenusSB(IntPtr a);
            void SetStatusTextSB(IntPtr a); void EnableModelessSB(bool f); void TranslateAcceleratorSB(IntPtr a, ushort b);
            void BrowseObject(IntPtr pidl, uint flags); void GetViewStateStream(uint modo, out IntPtr s); void GetControlWindow(uint id, out IntPtr h);
            void SendControlMsg(uint id, uint msg, IntPtr w, IntPtr l, out IntPtr r);
            void QueryActiveShellView([MarshalAs(UnmanagedType.IUnknown)] out object vista);
        }

        [ComImport, Guid("1af3a467-214f-4298-908e-06b03e0b39f9"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        private interface IFolderView2
        {
            // IFolderView (14 métodos)
            void GetCurrentViewMode(out uint modo); void SetCurrentViewMode(uint modo); void GetFolder(ref Guid iid, out IntPtr p);
            void Item(int i, out IntPtr pidl); void ItemCount(uint f, out int n); void Items(uint f, ref Guid iid, out IntPtr p);
            void GetSelectionMarkedItem(out int i); void GetFocusedItem(out int i); void GetItemPosition(IntPtr pidl, out Nativo.POINT p);
            void GetSpacing(ref Nativo.POINT p); void GetDefaultSpacing(out Nativo.POINT p); void GetAutoArrange();
            void SelectItem(int i, uint f); void SelectAndPositionItems(uint n, IntPtr a, IntPtr b, uint f);
            // IFolderView2 hasta SetViewModeAndIconSize (18 métodos que no usamos)
            void _01(); void _02(); void _03(); void _04(); void _05(); void _06(); void _07(); void _08(); void _09();
            void _10(); void _11(); void _12(); void _13(); void _14(); void _15(); void _16(); void _17(); void _18();
            void SetViewModeAndIconSize(int modo, int tam);
            void GetViewModeAndIconSize(out int modo, out int tam);
        }

        private static IFolderView2 VistaEscritorio()
        {
            Type t = Type.GetTypeFromProgID("Shell.Application");
            dynamic shell = Activator.CreateInstance(t);
            dynamic ventanas = shell.Windows();
            object loc = 0, raiz = null;
            int hwnd;
            object disp = ventanas.FindWindowSW(ref loc, ref raiz, 8 /* SWC_DESKTOP */, out hwnd, 1 /* SWFO_NEEDDISPATCH */);
            var sp = (IServiceProvider)disp;
            Guid sid = new Guid("4C96BE40-915C-11CF-99D3-00AA004AE837"); // SID_STopLevelBrowser
            Guid iid = typeof(IShellBrowser).GUID;
            object nav;
            if (sp.QueryService(ref sid, ref iid, out nav) != 0) return null;
            object vista;
            ((IShellBrowser)nav).QueryActiveShellView(out vista);
            return (IFolderView2)vista;
        }

        public static int TamanoIconos()
        {
            try
            {
                int modo, tam;
                VistaEscritorio().GetViewModeAndIconSize(out modo, out tam);
                return tam;
            }
            catch { return 0; }
        }

        public static void CambiarTamanoIconos(int tam)
        {
            if (tam < 16) return;
            try { VistaEscritorio().SetViewModeAndIconSize(1 /* FVM_ICON */, tam); }
            catch (Exception ex) { App.Registro("Tamaño de iconos: " + ex.Message); }
        }

        // ---------------- Cambios en el registro, con copia de lo que había ----------------
        // Todo lo que Lienzo cambia en Windows se apunta en estado-windows.json (el valor de antes),
        // así el botón «Deshacer mis cambios en Windows» lo deja como estaba aunque hayan pasado días.

        private static Dictionary<string, object> originales;

        private static string RutaOriginales
        {
            get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Lienzo", "estado-windows.json"); }
        }

        private static Dictionary<string, object> Originales()
        {
            if (originales != null) return originales;
            try { if (File.Exists(RutaOriginales)) originales = Json.Objeto(File.ReadAllText(RutaOriginales)); }
            catch (Exception ex) { App.Registro("estado-windows.json: " + ex.Message); }
            if (originales == null) originales = new Dictionary<string, object>();
            return originales;
        }

        public static bool HayCambiosGuardados() { return Originales().Count > 0; }

        private static bool Iguales(object actual, object nuevo)
        {
            if (actual == null) return false;
            var a = actual as byte[];
            var b = nuevo as byte[];
            if (a != null || b != null) return a != null && b != null && a.SequenceEqual(b);
            if (nuevo is int) return actual is int && (int)actual == (int)nuevo;
            return Convert.ToString(actual) == Convert.ToString(nuevo);
        }

        /// <summary>Escribe un valor de HKCU apuntando antes el original. Devuelve true si cambió algo.</summary>
        private static bool Poner(string ruta, string nombre, object valor, RegistryValueKind tipo)
        {
            using (var k = Registry.CurrentUser.CreateSubKey(ruta))
            {
                object actual = k.GetValue(nombre);
                if (Iguales(actual, valor)) return false;
                string clave = ruta + "|" + nombre;
                var o = Originales();
                if (!o.ContainsKey(clave))
                {
                    object antes;
                    if (actual == null) antes = Json.Nuevo("tipo", "ninguno");
                    else
                    {
                        var kind = k.GetValueKind(nombre);
                        if (kind == RegistryValueKind.DWord) antes = Json.Nuevo("tipo", "dword", "valor", Convert.ToInt64(actual) & 0xFFFFFFFFL);
                        else if (kind == RegistryValueKind.Binary) antes = Json.Nuevo("tipo", "binario", "valor", Convert.ToBase64String((byte[])actual));
                        else antes = Json.Nuevo("tipo", "texto", "valor", Convert.ToString(actual));
                    }
                    o[clave] = antes;
                    try { File.WriteAllText(RutaOriginales, Json.Escribir(o)); } catch { }
                }
                k.SetValue(nombre, valor, tipo);
                return true;
            }
        }

        private static bool PonerDword(string ruta, string nombre, uint valor)
        {
            return Poner(ruta, nombre, unchecked((int)valor), RegistryValueKind.DWord);
        }

        private static long? LeerDword(string ruta, string nombre)
        {
            using (var k = Registry.CurrentUser.OpenSubKey(ruta))
            {
                object v = k != null ? k.GetValue(nombre) : null;
                if (v == null) return null;
                try { return Convert.ToInt64(v) & 0xFFFFFFFFL; } catch { return null; }
            }
        }

        /// <summary>Deja como estaba todo lo que Lienzo cambió en Windows. Devuelve cuántos valores restauró.</summary>
        public static int DeshacerCambios()
        {
            var o = Originales();
            int n = 0;
            bool tocoAcento = false;
            foreach (var kv in o.ToList())
            {
                int i = kv.Key.LastIndexOf('|');
                var d = kv.Value as Dictionary<string, object>;
                if (i <= 0 || d == null) continue;
                string ruta = kv.Key.Substring(0, i), nombre = kv.Key.Substring(i + 1);
                if (ruta == RutaAcento || ruta == RutaDwm) tocoAcento = true;
                try
                {
                    using (var k = Registry.CurrentUser.CreateSubKey(ruta))
                    {
                        string tipo = Json.Texto(d, "tipo", "ninguno");
                        if (tipo == "ninguno") k.DeleteValue(nombre, false);
                        else if (tipo == "dword") k.SetValue(nombre, unchecked((int)(uint)Json.Numero(d, "valor", 0)), RegistryValueKind.DWord);
                        else if (tipo == "binario") k.SetValue(nombre, Convert.FromBase64String(Json.Texto(d, "valor", "")), RegistryValueKind.Binary);
                        else k.SetValue(nombre, Json.Texto(d, "valor", ""), RegistryValueKind.String);
                        n++;
                    }
                }
                catch (Exception ex) { App.Registro("Deshacer " + kv.Key + ": " + ex.Message); }
            }
            o.Clear();
            try { File.Delete(RutaOriginales); } catch { }
            if (tocoAcento) RefrescarAcento();
            Avisar("ImmersiveColorSet");
            Avisar("TraySettings");
            return n;
        }

        // ---------------- Tema de Windows ----------------

        private const string RutaTema = @"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize";
        private const string RutaAcento = @"Software\Microsoft\Windows\CurrentVersion\Explorer\Accent";
        private const string RutaDwm = @"Software\Microsoft\Windows\DWM";

        public static string TemaActual()
        {
            using (var k = Registry.CurrentUser.OpenSubKey(RutaTema))
                return k != null && Convert.ToInt32(k.GetValue("AppsUseLightTheme", 0)) == 1 ? "claro" : "oscuro";
        }

        /// <summary>"oscuro", "claro" o "mixto" (Windows oscuro y apps claras, como en Configuración → Personalizado).</summary>
        public static void CambiarTema(string tema)
        {
            if (tema != "claro" && tema != "oscuro" && tema != "mixto") return;
            bool a = PonerDword(RutaTema, "AppsUseLightTheme", tema == "oscuro" ? 0u : 1u);
            bool b = PonerDword(RutaTema, "SystemUsesLightTheme", tema == "claro" ? 1u : 0u);
            if (a || b) Avisar("ImmersiveColorSet");
        }

        public static void Transparencia(string modo)
        {
            if (modo != "si" && modo != "no") return;
            if (PonerDword(RutaTema, "EnableTransparency", modo == "si" ? 1u : 0u)) Avisar("ImmersiveColorSet");
        }

        /// <summary>El color de énfasis también en Inicio y la barra de tareas (Windows solo lo permite en modo oscuro).</summary>
        public static void ColorEnBarra(string modo)
        {
            if (modo != "si" && modo != "no") return;
            if (PonerDword(RutaTema, "ColorPrevalence", modo == "si" ? 1u : 0u)) Avisar("ImmersiveColorSet");
        }

        /// <summary>El color de énfasis en las barras de título y los bordes de las ventanas.</summary>
        public static void ColorEnTitulos(string modo)
        {
            if (modo != "si" && modo != "no") return;
            if (PonerDword(RutaDwm, "ColorPrevalence", modo == "si" ? 1u : 0u)) { RefrescarDwm(); Avisar("ImmersiveColorSet"); }
        }

        // ---------------- Color de énfasis ----------------

        [StructLayout(LayoutKind.Sequential)]
        private struct PreferenciaColor { public uint Inicio, Acento; }   // IMMERSIVE_COLOR_PREFERENCE (ABGR)

        [StructLayout(LayoutKind.Sequential)]
        private struct ParametrosDwm { public uint Color, Brillo, Intensidad, BalanceBrillo, BalanceDesenfoque, Reflejo, Opaco; }

        [DllImport("uxtheme.dll", EntryPoint = "#120")] private static extern int GetUserColorPreference(ref PreferenciaColor p, bool recargar);
        [DllImport("uxtheme.dll", EntryPoint = "#122")] private static extern int SetUserColorPreference(ref PreferenciaColor p, bool forzar);
        [DllImport("dwmapi.dll", EntryPoint = "#127")] private static extern int DwmGetColorizationParameters(ref ParametrosDwm p);
        [DllImport("dwmapi.dll", EntryPoint = "#131")] private static extern int DwmSetColorizationParameters(ref ParametrosDwm p, uint desconocido);

        /// <summary>Pone un color de énfasis en Windows (Inicio, barra de tareas, Configuración, bordes…), como hace Configuración.</summary>
        public static void CambiarAcento(string hex)
        {
            int r, g, b;
            if (!LeerHex(hex, out r, out g, out b)) return;
            double h, s, l;
            AHsl(r, g, b, out h, out s, out l);
            // Windows ilegible con colores casi negros o casi blancos: se acota la luz.
            l = Math.Max(0.28, Math.Min(0.72, l));
            double[] pasos = { 0.30, 0.20, 0.10, 0, -0.08, -0.18, -0.28 };
            var paleta = new byte[32];
            var tonos = new int[7][];
            for (int i = 0; i < 7; i++)
            {
                tonos[i] = DeHsl(h, s, Math.Max(0.04, Math.Min(0.96, l + pasos[i])));
                paleta[i * 4] = (byte)tonos[i][0]; paleta[i * 4 + 1] = (byte)tonos[i][1]; paleta[i * 4 + 2] = (byte)tonos[i][2];
            }
            var comp = DeHsl((h + 0.5) % 1, s, l);   // el octavo: un complementario, como hace Windows
            paleta[28] = (byte)comp[0]; paleta[29] = (byte)comp[1]; paleta[30] = (byte)comp[2];

            uint acento = Abgr(tonos[3]), inicio = Abgr(tonos[4]);
            uint argb = 0xC4000000u | ((uint)tonos[3][0] << 16) | ((uint)tonos[3][1] << 8) | (uint)tonos[3][2];
            bool cambio = false;
            cambio |= Poner(RutaAcento, "AccentPalette", paleta, RegistryValueKind.Binary);
            cambio |= PonerDword(RutaAcento, "AccentColorMenu", acento);
            cambio |= PonerDword(RutaAcento, "StartColorMenu", inicio);
            cambio |= PonerDword(RutaDwm, "AccentColor", acento);
            cambio |= PonerDword(RutaDwm, "ColorizationColor", argb);
            cambio |= PonerDword(RutaDwm, "ColorizationAfterglow", argb);
            // Si Windows sacaba el color del fondo de pantalla, lo pisaría: se desactiva.
            long? auto = LeerDword(@"Control Panel\Desktop", "AutoColorization");
            if (auto.HasValue && auto.Value != 0) cambio |= PonerDword(@"Control Panel\Desktop", "AutoColorization", 0);
            if (!cambio) return;
            RefrescarAcento();
            Avisar("ImmersiveColorSet");
        }

        /// <summary>Hace que Windows lea ya el color guardado en el registro (sin cerrar sesión).</summary>
        private static void RefrescarAcento()
        {
            try
            {
                long? acento = LeerDword(RutaAcento, "AccentColorMenu"), inicio = LeerDword(RutaAcento, "StartColorMenu");
                if (acento.HasValue && inicio.HasValue)
                {
                    var p = new PreferenciaColor();
                    GetUserColorPreference(ref p, false);
                    p.Acento = (uint)acento.Value;
                    p.Inicio = (uint)inicio.Value;
                    SetUserColorPreference(ref p, true);
                }
            }
            catch (Exception ex) { App.Registro("Color de énfasis (uxtheme): " + ex.Message); }
            RefrescarDwm();
        }

        private static void RefrescarDwm()
        {
            try
            {
                long? color = LeerDword(RutaDwm, "ColorizationColor");
                if (!color.HasValue) return;
                var p = new ParametrosDwm();
                if (DwmGetColorizationParameters(ref p) != 0) return;
                p.Color = p.Brillo = (uint)color.Value;
                DwmSetColorizationParameters(ref p, 0);
            }
            catch (Exception ex) { App.Registro("Color de énfasis (DWM): " + ex.Message); }
        }

        private static uint Abgr(int[] rgb) { return 0xFF000000u | ((uint)rgb[2] << 16) | ((uint)rgb[1] << 8) | (uint)rgb[0]; }

        private static bool LeerHex(string hex, out int r, out int g, out int b)
        {
            r = g = b = 0;
            string t = (hex ?? "").Trim().TrimStart('#');
            if (t.Length == 3) t = "" + t[0] + t[0] + t[1] + t[1] + t[2] + t[2];
            int v;
            if (t.Length < 6 || !int.TryParse(t.Substring(0, 6), NumberStyles.HexNumber, CultureInfo.InvariantCulture, out v)) return false;
            r = (v >> 16) & 255; g = (v >> 8) & 255; b = v & 255;
            return true;
        }

        private static void AHsl(int r8, int g8, int b8, out double h, out double s, out double l)
        {
            double r = r8 / 255.0, g = g8 / 255.0, b = b8 / 255.0;
            double max = Math.Max(r, Math.Max(g, b)), min = Math.Min(r, Math.Min(g, b));
            l = (max + min) / 2;
            h = s = 0;
            if (max == min) return;
            double d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            if (max == r) h = (g - b) / d + (g < b ? 6 : 0);
            else if (max == g) h = (b - r) / d + 2;
            else h = (r - g) / d + 4;
            h /= 6;
        }

        private static int[] DeHsl(double h, double s, double l)
        {
            Func<double, double, double, double> canal = (p, q, t) =>
            {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1 / 6.0) return p + (q - p) * 6 * t;
                if (t < 0.5) return q;
                if (t < 2 / 3.0) return p + (q - p) * (2 / 3.0 - t) * 6;
                return p;
            };
            double r, g, b;
            if (s == 0) r = g = b = l;
            else
            {
                double q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
                r = canal(p, q, h + 1 / 3.0); g = canal(p, q, h); b = canal(p, q, h - 1 / 3.0);
            }
            return new[] { (int)Math.Round(r * 255), (int)Math.Round(g * 255), (int)Math.Round(b * 255) };
        }

        // ---------------- Barra de tareas nativa ----------------

        private const string RutaAvanzado = @"Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced";
        private const string RutaBusqueda = @"Software\Microsoft\Windows\CurrentVersion\Search";

        /// <summary>Iconos de la barra de Windows al centro o a la izquierda ("no-tocar" no cambia nada).</summary>
        public static void AlinearBarraWindows(string alineacion)
        {
            if (alineacion != "centro" && alineacion != "izquierda") return;
            try
            {
                long? actual = LeerDword(RutaAvanzado, "TaskbarAl");
                uint v = alineacion == "centro" ? 1u : 0u;
                if (actual == null && v == 1) return; // centrada es lo predeterminado
                if (PonerDword(RutaAvanzado, "TaskbarAl", v)) Avisar("TraySettings");
            }
            catch (Exception ex) { App.Registro("Alinear barra: " + ex.Message); }
        }

        /// <summary>
        /// Botones y comportamiento de la barra de Windows. Devuelve null si todo fue bien o un aviso para el usuario.
        /// cual: busqueda | vistaTareas | widgets | agrupar | esquina.
        /// </summary>
        public static string AjusteBarraWindows(string cual, string valor)
        {
            if (string.IsNullOrEmpty(valor) || valor == "no-tocar") return null;
            string ruta = RutaAvanzado, nombre;
            uint v;
            switch (cual)
            {
                case "busqueda":
                    ruta = RutaBusqueda; nombre = "SearchboxTaskbarMode";
                    v = valor == "oculta" ? 0u : valor == "icono" ? 1u : valor == "cuadro" ? 2u : valor == "icono-texto" ? 3u : 99u;
                    break;
                case "vistaTareas": nombre = "ShowTaskViewButton"; v = valor == "si" ? 1u : valor == "no" ? 0u : 99u; break;
                case "widgets": nombre = "TaskbarDa"; v = valor == "si" ? 1u : valor == "no" ? 0u : 99u; break;
                case "agrupar":
                    nombre = "TaskbarGlomLevel";
                    v = valor == "siempre" ? 0u : valor == "llena" ? 1u : valor == "nunca" ? 2u : 99u;
                    break;
                case "esquina": nombre = "TaskbarSd"; v = valor == "si" ? 1u : valor == "no" ? 0u : 99u; break;
                default: return null;
            }
            if (v == 99u) return null;
            try
            {
                if (!PonerDword(ruta, nombre, v)) return null;
                Avisar("TraySettings");
            }
            catch (UnauthorizedAccessException) { return Bloqueado(cual); }
            catch (System.Security.SecurityException) { return Bloqueado(cual); }
            catch (Exception ex) { App.Registro("Barra de Windows (" + cual + "): " + ex.Message); return "No se pudo cambiar: " + ex.Message; }
            // Algunas versiones de Windows protegen estos valores y deshacen el cambio sin dar error.
            long? leido = LeerDword(ruta, nombre);
            if (!leido.HasValue || leido.Value != v) return Bloqueado(cual);
            return null;
        }

        private static string Bloqueado(string cual)
        {
            string que = cual == "widgets" ? "el botón de Widgets" : "ese ajuste";
            return "Windows no deja que otros programas cambien " + que + ". Cámbialo en Configuración → Personalización → Barra de tareas.";
        }

        private static void Avisar(string area)
        {
            // Se avisa en segundo plano: algunas ventanas tardan en contestar.
            new Thread(() =>
            {
                IntPtr r;
                Nativo.SendMessageTimeoutTexto(Nativo.HWND_BROADCAST, Nativo.WM_SETTINGCHANGE, IntPtr.Zero, area, Nativo.SMTO_ABORTIFHUNG, 2000, out r);
            }) { IsBackground = true }.Start();
        }

        // ---------------- Inicio con Windows ----------------

        private const string RutaRun = @"Software\Microsoft\Windows\CurrentVersion\Run";

        public static void IniciarConWindows(bool si)
        {
            try
            {
                using (var k = Registry.CurrentUser.CreateSubKey(RutaRun))
                {
                    if (si) k.SetValue("Lienzo", "\"" + Application.ExecutablePath + "\" --inicio");
                    else if (k.GetValue("Lienzo") != null) k.DeleteValue("Lienzo");
                }
            }
            catch (Exception ex) { App.Registro("Inicio con Windows: " + ex.Message); }
        }
    }
}

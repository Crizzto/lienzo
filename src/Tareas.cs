using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using Microsoft.Win32;

namespace Lienzo
{
    /// <summary>Ventanas abiertas (como la barra de tareas), sus iconos y las apps instaladas.</summary>
    internal static class Tareas
    {
        public class Ventana
        {
            public IntPtr H;
            public string Titulo, Clave, Ruta, Aumid;
            public bool Activa, Minimizada;
        }

        private static readonly Guid IID_IShellItemImageFactory = new Guid("bcc18b79-ba16-442f-80c4-8a59c30c463b");
        private static readonly Guid IID_IPropertyStore = new Guid("886d8eeb-8cf2-4446-8d02-cdba1dbdcf99");
        private static readonly Nativo.PROPERTYKEY PKEY_AppUserModel_ID = new Nativo.PROPERTYKEY(new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3"), 5);
        private static readonly uint miPid = (uint)Process.GetCurrentProcess().Id;
        private static readonly Dictionary<string, string> cacheIconos = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        private static readonly Dictionary<uint, string> cacheRutas = new Dictionary<uint, string>();

        // ---------------- Lista de ventanas ----------------

        public static List<Ventana> Listar()
        {
            var lista = new List<Ventana>();
            IntPtr activa = Nativo.GetForegroundWindow();
            Nativo.EnumWindows((h, l) =>
            {
                if (!EsDeTareas(h)) return true;
                uint pid;
                Nativo.GetWindowThreadProcessId(h, out pid);
                var v = new Ventana { H = h, Titulo = Nativo.Titulo(h), Activa = h == activa, Minimizada = Nativo.IsIconic(h) };
                v.Aumid = AumidDe(h);
                v.Ruta = RutaDe(pid);
                if (v.Aumid == null && Nativo.Clase(h) == "ApplicationFrameWindow")
                {
                    // App de la Tienda: el proceso real es el de la ventana hija CoreWindow.
                    IntPtr hijo = Nativo.FindWindowEx(h, IntPtr.Zero, "Windows.UI.Core.CoreWindow", null);
                    if (hijo != IntPtr.Zero) { uint p2; Nativo.GetWindowThreadProcessId(hijo, out p2); v.Ruta = RutaDe(p2); v.Aumid = AumidDe(hijo); }
                }
                v.Clave = v.Aumid ?? v.Ruta ?? ("hwnd:" + h.ToInt64());
                lista.Add(v);
                return true;
            }, IntPtr.Zero);
            return lista;
        }

        public static bool EsDeTareas(IntPtr h)
        {
            if (!Nativo.IsWindowVisible(h)) return false;
            long ex = Nativo.EstiloEx(h);
            bool appWindow = (ex & Nativo.WS_EX_APPWINDOW) != 0;
            if (!appWindow)
            {
                if ((ex & Nativo.WS_EX_TOOLWINDOW) != 0 || (ex & Nativo.WS_EX_NOACTIVATE) != 0) return false;
                if (Nativo.GetWindow(h, Nativo.GW_OWNER) != IntPtr.Zero) return false;
            }
            if (Nativo.GetWindowTextLength(h) == 0) return false;
            if (Nativo.Oculta(h)) return false; // apps suspendidas o en otro escritorio virtual
            uint pid;
            Nativo.GetWindowThreadProcessId(h, out pid);
            if (pid == miPid) return false;
            string clase = Nativo.Clase(h);
            if (clase == "Progman" || clase == "WorkerW" || clase == "Shell_TrayWnd" || clase == "Shell_SecondaryTrayWnd" ||
                clase == "Windows.UI.Core.CoreWindow" || clase == "XamlExplorerHostIslandWindow") return false;
            return true;
        }

        private static string RutaDe(uint pid)
        {
            string r;
            if (cacheRutas.TryGetValue(pid, out r)) return r;
            r = Nativo.RutaProceso(pid);
            if (cacheRutas.Count > 500) cacheRutas.Clear();
            cacheRutas[pid] = r;
            return r;
        }

        private static readonly Dictionary<IntPtr, string> cacheAumid = new Dictionary<IntPtr, string>();

        public static void LimpiarCaches()
        {
            cacheAumid.Clear();
            cacheRutas.Clear();
        }

        private static string AumidDe(IntPtr h)
        {
            string a;
            if (cacheAumid.TryGetValue(h, out a)) return a;
            a = LeerAumid(h);
            cacheAumid[h] = a;
            return a;
        }

        private static string LeerAumid(IntPtr h)
        {
            try
            {
                Nativo.IPropertyStore ps;
                Nativo.SHGetPropertyStoreForWindow(h, IID_IPropertyStore, out ps);
                if (ps == null) return null;
                try
                {
                    var k = PKEY_AppUserModel_ID;
                    Nativo.PROPVARIANT pv;
                    ps.GetValue(ref k, out pv);
                    string s = pv.vt == 31 /* VT_LPWSTR */ ? Marshal.PtrToStringUni(pv.puntero) : null;
                    Nativo.PropVariantClear(ref pv);
                    return string.IsNullOrEmpty(s) ? null : s;
                }
                finally { Marshal.ReleaseComObject(ps); }
            }
            catch { return null; }
        }

        // ---------------- Acciones ----------------

        public static void Activar(IntPtr h)
        {
            if (!Nativo.IsWindow(h)) return;
            if (Nativo.IsIconic(h)) Nativo.ShowWindow(h, Nativo.SW_RESTORE);
            IntPtr destino = Nativo.GetLastActivePopup(h);
            if (destino == IntPtr.Zero || !Nativo.IsWindowVisible(destino)) destino = h;
            if (Nativo.GetForegroundWindow() == destino) return;
            if (Nativo.SetForegroundWindow(destino) && Nativo.GetForegroundWindow() == destino) return;

            // Windows solo deja traer ventanas al frente a quien recibió la última entrada; la recibió WebView2,
            // así que nos unimos un momento a la cola de entrada de la ventana activa.
            IntPtr fg = Nativo.GetForegroundWindow();
            uint pidFg;
            uint hiloFg = Nativo.GetWindowThreadProcessId(fg, out pidFg);
            uint miHilo = Nativo.GetCurrentThreadId();
            bool unido = hiloFg != 0 && hiloFg != miHilo && Nativo.AttachThreadInput(miHilo, hiloFg, true);
            Nativo.BringWindowToTop(destino);
            Nativo.SetForegroundWindow(destino);
            if (unido) Nativo.AttachThreadInput(miHilo, hiloFg, false);
            if (Nativo.GetForegroundWindow() != destino) Nativo.SwitchToThisWindow(destino, true);
        }

        public static void Alternar(IntPtr h)
        {
            if (!Nativo.IsWindow(h)) return;
            if (Nativo.GetForegroundWindow() == h && !Nativo.IsIconic(h)) Nativo.ShowWindow(h, Nativo.SW_MINIMIZE);
            else Activar(h);
        }

        public static void Cerrar(IntPtr h)
        {
            if (Nativo.IsWindow(h)) Nativo.PostMessage(h, Nativo.WM_SYSCOMMAND, new IntPtr(Nativo.SC_CLOSE), IntPtr.Zero);
        }

        public static void Lanzar(string destino)
        {
            if (string.IsNullOrEmpty(destino)) return;
            try
            {
                if (destino.StartsWith("shell:", StringComparison.OrdinalIgnoreCase))
                    Process.Start(new ProcessStartInfo("explorer.exe", "\"" + destino + "\"") { UseShellExecute = true });
                else
                    Process.Start(new ProcessStartInfo(destino) { UseShellExecute = true, WorkingDirectory = SeguroDirectorio(destino) });
            }
            catch (Exception ex) { App.Registro("No pude abrir " + destino + ": " + ex.Message); }
        }

        private static string SeguroDirectorio(string ruta)
        {
            try { return File.Exists(ruta) ? Path.GetDirectoryName(ruta) : ""; } catch { return ""; }
        }

        // ---------------- Iconos ----------------

        /// <summary>Icono de una app como data URL PNG. clave = AUMID, ruta de .exe/.lnk o "hwnd:N".</summary>
        public static string Icono(string clave, IntPtr ventana, int tam)
        {
            string id = clave + "|" + tam;
            string r;
            lock (cacheIconos) if (cacheIconos.TryGetValue(id, out r)) return r;
            Bitmap bmp = null;
            try
            {
                if (clave != null && !clave.StartsWith("hwnd:"))
                {
                    string ruta = clave;
                    if (!File.Exists(ruta) && !Directory.Exists(ruta)) ruta = "shell:AppsFolder\\" + clave;
                    bmp = IconoShell(ruta, tam);
                }
                if (bmp == null && ventana != IntPtr.Zero) bmp = IconoVentana(ventana);
                r = bmp != null ? DataUrl(bmp, tam) : null;
            }
            catch (Exception ex) { App.Registro("Icono " + clave + ": " + ex.Message); }
            finally { if (bmp != null) bmp.Dispose(); }
            lock (cacheIconos)
            {
                if (cacheIconos.Count > 400) cacheIconos.Clear();
                cacheIconos[id] = r;
            }
            return r;
        }

        public static Bitmap IconoShell(string ruta, int tam)
        {
            Nativo.IShellItemImageFactory f = null;
            try
            {
                Nativo.SHCreateItemFromParsingName(ruta, IntPtr.Zero, IID_IShellItemImageFactory, out f);
                IntPtr hbmp;
                f.GetImage(new Nativo.SIZE(tam, tam), 0x4 /* SIIGBF_ICONONLY */, out hbmp);
                try { return DeHBitmap(hbmp); }
                finally { Nativo.DeleteObject(hbmp); }
            }
            catch { return null; }
            finally { if (f != null) Marshal.ReleaseComObject(f); }
        }

        /// <summary>Miniatura de un archivo (imagen o video) usando el mismo sistema que el Explorador.</summary>
        public static Bitmap Miniatura(string ruta, int tam)
        {
            Nativo.IShellItemImageFactory f = null;
            try
            {
                Nativo.SHCreateItemFromParsingName(ruta, IntPtr.Zero, IID_IShellItemImageFactory, out f);
                IntPtr hbmp;
                f.GetImage(new Nativo.SIZE(tam, tam), 0x8 /* SIIGBF_THUMBNAILONLY */ | 0x1 /* BIGGERSIZEOK */, out hbmp);
                try { return DeHBitmap(hbmp); }
                finally { Nativo.DeleteObject(hbmp); }
            }
            catch { return null; }
            finally { if (f != null) Marshal.ReleaseComObject(f); }
        }

        private static Bitmap IconoVentana(IntPtr h)
        {
            IntPtr hicon;
            Nativo.SendMessageTimeout(h, Nativo.WM_GETICON, new IntPtr(Nativo.ICON_BIG), IntPtr.Zero, Nativo.SMTO_ABORTIFHUNG, 100, out hicon);
            if (hicon == IntPtr.Zero) hicon = Nativo.GetClassLongPtr(h, Nativo.GCLP_HICON);
            if (hicon == IntPtr.Zero) Nativo.SendMessageTimeout(h, Nativo.WM_GETICON, new IntPtr(Nativo.ICON_SMALL2), IntPtr.Zero, Nativo.SMTO_ABORTIFHUNG, 100, out hicon);
            if (hicon == IntPtr.Zero) return null;
            using (var ic = Icon.FromHandle(hicon)) return ic.ToBitmap();
        }

        /// <summary>HBITMAP de 32 bits (con alfa) a Bitmap, respetando la transparencia.</summary>
        public static Bitmap DeHBitmap(IntPtr hbmp)
        {
            Nativo.DIBSECTION ds;
            if (Nativo.GetObject(hbmp, Marshal.SizeOf(typeof(Nativo.DIBSECTION)), out ds) == 0 ||
                ds.dsBm.bmBits == IntPtr.Zero || ds.dsBm.bmBitsPixel != 32)
                return Image.FromHbitmap(hbmp);
            int w = ds.dsBm.bmWidth, h = ds.dsBm.bmHeight, paso = ds.dsBm.bmWidthBytes;
            bool deAbajoArriba = ds.dsBmih.biHeight > 0;
            var bytes = new byte[w * 4 * h];
            for (int y = 0; y < h; y++)
            {
                int ys = deAbajoArriba ? h - 1 - y : y;
                Marshal.Copy(IntPtr.Add(ds.dsBm.bmBits, ys * paso), bytes, y * w * 4, w * 4);
            }
            bool hayAlfa = false;
            for (int i = 3; i < bytes.Length; i += 4) if (bytes[i] != 0) { hayAlfa = true; break; }
            if (!hayAlfa) for (int i = 3; i < bytes.Length; i += 4) bytes[i] = 255;
            var bmp = new Bitmap(w, h, PixelFormat.Format32bppPArgb);
            var datos = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.WriteOnly, PixelFormat.Format32bppPArgb);
            for (int y = 0; y < h; y++) Marshal.Copy(bytes, y * w * 4, IntPtr.Add(datos.Scan0, y * datos.Stride), w * 4);
            bmp.UnlockBits(datos);
            return bmp;
        }

        public static string DataUrl(Bitmap bmp, int tam)
        {
            Bitmap final = bmp;
            if (bmp.Width != tam || bmp.Height != tam)
            {
                final = new Bitmap(tam, tam, PixelFormat.Format32bppArgb);
                using (var g = Graphics.FromImage(final))
                {
                    g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                    g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                    float esc = Math.Min((float)tam / bmp.Width, (float)tam / bmp.Height);
                    float w = bmp.Width * esc, h = bmp.Height * esc;
                    g.DrawImage(bmp, (tam - w) / 2, (tam - h) / 2, w, h);
                }
            }
            try
            {
                using (var ms = new MemoryStream())
                {
                    final.Save(ms, ImageFormat.Png);
                    return "data:image/png;base64," + Convert.ToBase64String(ms.ToArray());
                }
            }
            finally { if (final != bmp) final.Dispose(); }
        }

        public static string DataUrlJpeg(Bitmap bmp, int ancho)
        {
            int alto = Math.Max(1, (int)Math.Round((double)bmp.Height * ancho / bmp.Width));
            using (var final = new Bitmap(ancho, alto, PixelFormat.Format24bppRgb))
            {
                using (var g = Graphics.FromImage(final))
                {
                    g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                    g.DrawImage(bmp, 0, 0, ancho, alto);
                }
                using (var ms = new MemoryStream())
                {
                    var codec = ImageCodecInfo.GetImageEncoders().First(c => c.FormatID == ImageFormat.Jpeg.Guid);
                    var p = new EncoderParameters(1);
                    p.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, 82L);
                    final.Save(ms, codec, p);
                    return "data:image/jpeg;base64," + Convert.ToBase64String(ms.ToArray());
                }
            }
        }

        // ---------------- Apps instaladas (como "Todas las apps" del menú Inicio) ----------------

        public static List<Dictionary<string, object>> AppsInstaladas()
        {
            var lista = new List<Dictionary<string, object>>();
            try
            {
                Type t = Type.GetTypeFromProgID("Shell.Application");
                dynamic shell = Activator.CreateInstance(t);
                dynamic carpeta = shell.NameSpace("shell:AppsFolder");
                foreach (dynamic item in carpeta.Items())
                {
                    string nombre = item.Name, ruta = item.Path;
                    if (string.IsNullOrEmpty(nombre) || string.IsNullOrEmpty(ruta)) continue;
                    if (ruta.EndsWith(".url", StringComparison.OrdinalIgnoreCase) || ruta.StartsWith("http", StringComparison.OrdinalIgnoreCase)) continue;
                    lista.Add(Json.Nuevo("nombre", nombre, "clave", ruta, "destino", "shell:AppsFolder\\" + ruta));
                }
                Marshal.ReleaseComObject(shell);
            }
            catch (Exception ex) { App.Registro("AppsFolder: " + ex.Message); }
            lista.Sort((a, b) => string.Compare((string)a["nombre"], (string)b["nombre"], StringComparison.CurrentCultureIgnoreCase));
            return lista;
        }

        /// <summary>Ruta real a la que apunta una clave de "Todas las apps" ({GUID de carpeta}\ruta.exe) o un acceso directo.</summary>
        public static string RutaReal(string clave)
        {
            if (string.IsNullOrEmpty(clave)) return null;
            try
            {
                if (clave.StartsWith("{") && clave.IndexOf('}') > 0)
                {
                    string guid = clave.Substring(1, clave.IndexOf('}') - 1);
                    string resto = clave.Substring(clave.IndexOf('}') + 1).TrimStart('\\');
                    string carpeta = CarpetaConocida(new Guid(guid));
                    if (carpeta != null) return Path.Combine(carpeta, resto);
                }
                if (clave.EndsWith(".lnk", StringComparison.OrdinalIgnoreCase) && File.Exists(clave))
                {
                    dynamic wsh = Activator.CreateInstance(Type.GetTypeFromProgID("WScript.Shell"));
                    dynamic acceso = wsh.CreateShortcut(clave);
                    string destino = acceso.TargetPath;
                    Marshal.ReleaseComObject(wsh);
                    return string.IsNullOrEmpty(destino) ? null : destino;
                }
            }
            catch { }
            return clave;
        }

        [DllImport("shell32.dll")]
        private static extern int SHGetKnownFolderPath([MarshalAs(UnmanagedType.LPStruct)] Guid id, uint flags, IntPtr token, out IntPtr ruta);

        private static string CarpetaConocida(Guid id)
        {
            IntPtr p;
            if (SHGetKnownFolderPath(id, 0, IntPtr.Zero, out p) != 0) return null;
            try { return Marshal.PtrToStringUni(p); } finally { Marshal.FreeCoTaskMem(p); }
        }
    }
}

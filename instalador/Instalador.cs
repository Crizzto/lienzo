using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Net;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

// Instalador y desinstalador de Lienzo en un solo .exe (lo arma «node build.js --instalador»).
//   Instalar:     doble clic. Instala solo para tu usuario en %LOCALAPPDATA%\Programs\Lienzo: no pide permisos de administrador.
//   Actualizar:   ejecutar un instalador más nuevo encima (cierra Lienzo, reemplaza los archivos y conserva tus ajustes).
//   Desinstalar:  desde Configuración → Aplicaciones → Aplicaciones instaladas → Lienzo, o con desinstalar.exe.
//   Sin ventanas: /silencioso (instala o desinstala sin preguntar; útil para scripts). /sinytdlp no baja yt-dlp.
// Además instala lo que Lienzo necesita y falte: .NET Framework 4.8 (solo en Windows muy viejos), el motor WebView2
// de Microsoft Edge y, si lo dejas marcado, yt-dlp para los fondos de YouTube.
// Los archivos de Lienzo van dentro de este .exe como recurso (lienzo.zip).

namespace Lienzo.Instalacion
{
    internal static class Programa
    {
        [STAThread]
        private static int Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            bool silencioso = args.Any(a => a == "/silencioso" || a == "/S" || a == "--silencioso");
            bool desinstalar = args.Contains("--desinstalar");
            try
            {
                if (desinstalar)
                {
                    string dir = Valor(args, "--dir") ?? Instalacion.Carpeta;
                    // Un programa no se puede borrar a sí mismo mientras corre: si nos abren desde la carpeta que hay
                    // que borrar, nos copiamos a TEMP y seguimos desde ahí.
                    if (Instalacion.EstaDentro(Application.ExecutablePath, dir))
                    {
                        string tmp = Path.Combine(Path.GetTempPath(), "lienzo-desinstalar-" + Guid.NewGuid().ToString("N").Substring(0, 8) + ".exe");
                        File.Copy(Application.ExecutablePath, tmp, true);
                        Process.Start(new ProcessStartInfo(tmp, "--desinstalar --temporal --dir " + Instalacion.Comillas(dir) + (silencioso ? " /silencioso" : ""))
                        { UseShellExecute = false });
                        return 0;
                    }
                    if (silencioso) Instalacion.Desinstalar(dir, false, null);
                    else Application.Run(new Ventana(true, dir));
                    if (args.Contains("--temporal")) Instalacion.BorrarmeAlSalir();
                    return 0;
                }
                if (silencioso)
                {
                    Instalacion.Instalar(false, !args.Contains("/sinytdlp"), null);
                    if (!args.Contains("/sinabrir")) Instalacion.AbrirLienzo();
                    return 0;
                }
                Application.Run(new Ventana(false, Instalacion.Carpeta));
                return 0;
            }
            catch (Exception ex)
            {
                if (!silencioso) MessageBox.Show(ex.Message, "Lienzo", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return 1;
            }
        }

        private static string Valor(string[] args, string nombre)
        {
            int i = Array.IndexOf(args, nombre);
            return i >= 0 && i + 1 < args.Length ? args[i + 1] : null;
        }
    }

    /// <summary>El trabajo de verdad: copiar archivos, accesos directos y el registro de «Aplicaciones instaladas».</summary>
    internal static class Instalacion
    {
        public const string Nombre = "Lienzo";
        private const string ClaveDesinstalar = @"Software\Microsoft\Windows\CurrentVersion\Uninstall\Lienzo";
        private const string ClaveRun = @"Software\Microsoft\Windows\CurrentVersion\Run";

        public static string Carpeta
        {
            get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "Lienzo"); }
        }

        private static string AccesoInicio
        {
            get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), "Lienzo.lnk"); }
        }

        private static string AccesoEscritorio
        {
            get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "Lienzo.lnk"); }
        }

        public static string Exe { get { return Path.Combine(Carpeta, "Lienzo.exe"); } }

        public static string VersionInstalada()
        {
            using (var k = Registry.CurrentUser.OpenSubKey(ClaveDesinstalar))
                return k != null ? k.GetValue("DisplayVersion") as string : null;
        }

        /// <summary>WebView2 (el motor de Edge que dibuja Lienzo) viene con Windows 11; en Windows 10 a veces falta.</summary>
        public static bool HayWebView2()
        {
            const string id = @"\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}";
            foreach (var ruta in new[] { @"SOFTWARE\WOW6432Node" + id, @"SOFTWARE" + id })
                foreach (var raiz in new[] { Registry.LocalMachine, Registry.CurrentUser })
                {
                    try
                    {
                        using (var k = raiz.OpenSubKey(ruta))
                        {
                            var pv = k != null ? k.GetValue("pv") as string : null;
                            if (!string.IsNullOrEmpty(pv) && pv != "0.0.0.0") return true;
                        }
                    }
                    catch { }
                }
            return false;
        }

        /// <summary>Instala Lienzo y lo que le falte. Devuelve avisos de lo que no se pudo (Lienzo queda instalado igual).</summary>
        public static List<string> Instalar(bool accesoEscritorio, bool conYtdlp, Action<int, string> progreso)
        {
            var avisos = new List<string>();
            Avisar(progreso, 1, "Revisando lo que necesita Lienzo…");
            Dependencias.Instalar(conYtdlp, avisos, progreso);

            Avisar(progreso, 40, "Cerrando Lienzo si está abierto…");
            CerrarLienzo();

            string dir = Carpeta;
            Directory.CreateDirectory(dir);
            // La carpeta web/ se reemplaza entera: así no quedan archivos viejos de otra versión.
            Reintentar(() => { string web = Path.Combine(dir, "web"); if (Directory.Exists(web)) Directory.Delete(web, true); });

            Avisar(progreso, 45, "Copiando archivos…");
            string raiz = Path.GetFullPath(dir).TrimEnd('\\') + "\\";
            using (var s = Assembly.GetExecutingAssembly().GetManifestResourceStream("lienzo.zip"))
            {
                if (s == null) throw new Exception("Este instalador está incompleto (no trae los archivos de Lienzo).");
                using (var zip = new ZipArchive(s, ZipArchiveMode.Read))
                {
                    int total = Math.Max(1, zip.Entries.Count), i = 0;
                    foreach (var e in zip.Entries)
                    {
                        i++;
                        string nombre = e.FullName.Replace('/', '\\');
                        while (nombre.StartsWith(".\\")) nombre = nombre.Substring(2);
                        string destino = Path.GetFullPath(Path.Combine(dir, nombre));
                        if (!destino.StartsWith(raiz, StringComparison.OrdinalIgnoreCase)) continue; // nada fuera de la carpeta
                        if (e.Name.Length == 0) { Directory.CreateDirectory(destino); continue; }
                        Directory.CreateDirectory(Path.GetDirectoryName(destino));
                        var entrada = e;
                        Reintentar(() => entrada.ExtractToFile(destino, true));
                        if (i % 8 == 0) Avisar(progreso, 45 + 42 * i / total,"Copiando archivos…");
                    }
                }
            }

            Avisar(progreso, 88, "Creando accesos directos…");
            string desinstalador = Path.Combine(dir, "desinstalar.exe");
            if (!string.Equals(Path.GetFullPath(Application.ExecutablePath), Path.GetFullPath(desinstalador), StringComparison.OrdinalIgnoreCase))
                Reintentar(() => File.Copy(Application.ExecutablePath, desinstalador, true));
            CrearAcceso(AccesoInicio, Exe, dir);
            if (accesoEscritorio) CrearAcceso(AccesoEscritorio, Exe, dir);

            Avisar(progreso, 94, "Registrando Lienzo en Windows…");
            using (var k = Registry.CurrentUser.CreateSubKey(ClaveDesinstalar))
            {
                k.SetValue("DisplayName", Nombre);
                k.SetValue("DisplayVersion", InfoVersion.Texto);
                k.SetValue("Publisher", Nombre);
                k.SetValue("DisplayIcon", "\"" + Exe + "\",0");
                k.SetValue("InstallLocation", dir);
                k.SetValue("InstallDate", DateTime.Now.ToString("yyyyMMdd"));
                k.SetValue("UninstallString", Comillas(desinstalador) + " --desinstalar");
                k.SetValue("QuietUninstallString", Comillas(desinstalador) + " --desinstalar /silencioso");
                k.SetValue("EstimatedSize", (int)(TamanoCarpeta(dir) / 1024), RegistryValueKind.DWord);
                k.SetValue("NoModify", 1, RegistryValueKind.DWord);
                k.SetValue("NoRepair", 1, RegistryValueKind.DWord);
                if (InfoVersion.Repositorio.Length > 0)
                {
                    k.SetValue("URLInfoAbout", InfoVersion.Repositorio);
                    k.SetValue("HelpLink", InfoVersion.Repositorio + "/issues");
                }
            }
            // Si ya tenías «Iniciar con Windows» (por ejemplo con una copia compilada a mano), que apunte a la instalada.
            using (var k = Registry.CurrentUser.OpenSubKey(ClaveRun, true))
                if (k != null && k.GetValue("Lienzo") != null) k.SetValue("Lienzo", Comillas(Exe) + " --inicio");
            Avisar(progreso, 100, "¡Listo!");
            return avisos;
        }

        public static void Desinstalar(string dir, bool borrarDatos, Action<int, string> progreso)
        {
            Avisar(progreso, 5, "Cerrando Lienzo (tu barra de Windows vuelve a la normalidad)…");
            CerrarLienzo();

            Avisar(progreso, 40, "Quitando accesos directos…");
            using (var k = Registry.CurrentUser.OpenSubKey(ClaveRun, true))
            {
                var v = k != null ? k.GetValue("Lienzo") as string : null;
                if (v != null && v.IndexOf(dir, StringComparison.OrdinalIgnoreCase) >= 0) k.DeleteValue("Lienzo");
            }
            foreach (var acceso in new[] { AccesoInicio, AccesoEscritorio })
                try { if (File.Exists(acceso)) File.Delete(acceso); } catch { }
            try { Registry.CurrentUser.DeleteSubKeyTree(ClaveDesinstalar, false); } catch { }

            Avisar(progreso, 60, "Borrando archivos…");
            Reintentar(() => { if (Directory.Exists(dir)) Directory.Delete(dir, true); });
            if (borrarDatos)
            {
                Avisar(progreso, 80, "Borrando tus ajustes y fondos…");
                foreach (var carpeta in new[] { Environment.SpecialFolder.ApplicationData, Environment.SpecialFolder.LocalApplicationData })
                {
                    string d = Path.Combine(Environment.GetFolderPath(carpeta), "Lienzo");
                    Reintentar(() => { if (Directory.Exists(d)) Directory.Delete(d, true); });
                }
            }
            Avisar(progreso, 100, "Lienzo se desinstaló.");
        }

        /// <summary>Le pide a Lienzo que se cierre bien (restaura la barra de Windows y los iconos) y, si no, lo cierra a la fuerza.</summary>
        public static void CerrarLienzo()
        {
            var procesos = Process.GetProcessesByName("Lienzo");
            if (procesos.Length == 0) return;
            string exe = null;
            foreach (var p in procesos)
            {
                try { exe = p.MainModule.FileName; break; } catch { }
            }
            if (exe == null && File.Exists(Exe)) exe = Exe;
            if (exe != null)
            {
                try
                {
                    using (var salir = Process.Start(new ProcessStartInfo(exe, "--salir") { UseShellExecute = false, CreateNoWindow = true }))
                        salir.WaitForExit(20000);
                }
                catch { }
            }
            bool forzado = false;
            foreach (var p in procesos)
            {
                try
                {
                    if (!p.WaitForExit(5000)) { p.Kill(); p.WaitForExit(3000); forzado = true; }
                }
                catch { }
            }
            // Cerrado a la fuerza: que devuelva la barra de Windows aunque no pudiera hacerlo él.
            if (forzado && exe != null && File.Exists(exe))
            {
                try
                {
                    using (var r = Process.Start(new ProcessStartInfo(exe, "--restaurar") { UseShellExecute = false, CreateNoWindow = true }))
                        r.WaitForExit(15000);
                }
                catch { }
            }
        }

        public static void AbrirLienzo()
        {
            if (File.Exists(Exe)) Process.Start(new ProcessStartInfo(Exe) { UseShellExecute = true, WorkingDirectory = Carpeta });
        }

        public static void BorrarmeAlSalir()
        {
            try
            {
                Process.Start(new ProcessStartInfo("cmd.exe", "/c ping -n 3 127.0.0.1 >nul & del /f /q " + Comillas(Application.ExecutablePath))
                { UseShellExecute = false, CreateNoWindow = true, WindowStyle = ProcessWindowStyle.Hidden });
            }
            catch { }
        }

        private static void CrearAcceso(string ruta, string destino, string dir)
        {
            Type t = Type.GetTypeFromProgID("WScript.Shell");
            if (t == null) return;
            object shell = Activator.CreateInstance(t);
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(ruta));
                dynamic acceso = ((dynamic)shell).CreateShortcut(ruta);
                acceso.TargetPath = destino;
                acceso.WorkingDirectory = dir;
                acceso.Description = "Personaliza tu escritorio: fondos animados, barra propia y bloques.";
                acceso.IconLocation = destino + ",0";
                acceso.Save();
                Marshal.FinalReleaseComObject(acceso);
            }
            finally { Marshal.FinalReleaseComObject(shell); }
        }

        private static long TamanoCarpeta(string dir)
        {
            try { return new DirectoryInfo(dir).EnumerateFiles("*", SearchOption.AllDirectories).Sum(f => f.Length); }
            catch { return 0; }
        }

        /// <summary>Windows (o un antivirus revisando el archivo) puede tener algo abierto un momento: se reintenta.</summary>
        private static void Reintentar(Action accion)
        {
            for (int i = 0; ; i++)
            {
                try { accion(); return; }
                catch (Exception ex)
                {
                    if (i >= 15 || !(ex is IOException || ex is UnauthorizedAccessException)) throw;
                    Thread.Sleep(400);
                }
            }
        }

        private static void Avisar(Action<int, string> progreso, int pct, string texto)
        {
            if (progreso != null) progreso(pct, texto);
        }

        public static bool EstaDentro(string archivo, string dir)
        {
            string a = Path.GetFullPath(archivo), d = Path.GetFullPath(dir).TrimEnd('\\') + "\\";
            return a.StartsWith(d, StringComparison.OrdinalIgnoreCase);
        }

        public static string Comillas(string s) { return "\"" + s.TrimEnd('\\') + "\""; }
    }

    /// <summary>
    /// Lo que Lienzo necesita para funcionar y no viene dentro del instalador: se descarga de Microsoft / GitHub solo si falta.
    ///   .NET Framework 4.6.2+ → viene con Windows 10 (1607 en adelante) y 11; en uno más viejo se instala el 4.8 (pide permiso).
    ///   WebView2 (el motor de Edge que dibuja Lienzo) → viene con Windows 11; si falta se instala solo para tu usuario.
    ///   yt-dlp (fondos de YouTube, opcional) → en %LOCALAPPDATA%\Lienzo\herramientas, donde Lienzo lo busca y lo actualiza.
    /// </summary>
    internal static class Dependencias
    {
        private const string UrlWebView2 = "https://go.microsoft.com/fwlink/p/?LinkId=2124703"; // «Evergreen Bootstrapper» de Microsoft
        private const string UrlNet48 = "https://go.microsoft.com/fwlink/?linkid=2088631";      // .NET Framework 4.8 (sin conexión)
        private const string UrlYtdlp = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe";

        public static string RutaYtdlp
        {
            get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Lienzo", "herramientas", "yt-dlp.exe"); }
        }

        /// <summary>Qué falta, en palabras, para enseñarlo antes de instalar.</summary>
        public static List<string> Faltan()
        {
            var l = new List<string>();
            if (!HayNet()) l.Add(".NET Framework 4.8");
            if (!Instalacion.HayWebView2()) l.Add("el motor WebView2 de Microsoft Edge");
            return l;
        }

        /// <summary>El de Lienzo o uno que ya tengas (winget, scoop…): lo mismo que busca Lienzo en src/Ytdlp.cs.</summary>
        public static bool HayYtdlp()
        {
            if (File.Exists(RutaYtdlp)) return true;
            var dirs = (Environment.GetEnvironmentVariable("PATH") ?? "").Split(';').ToList();
            dirs.Add(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Microsoft", "WinGet", "Links"));
            foreach (var d in dirs)
            {
                try { if (d.Trim().Length > 0 && File.Exists(Path.Combine(d.Trim().Trim('"'), "yt-dlp.exe"))) return true; }
                catch { }
            }
            return false;
        }

        /// <summary>.NET Framework 4.6.2 o más (lo que pide el SDK de WebView2): valor «Release» ≥ 394802.</summary>
        public static bool HayNet()
        {
            try
            {
                using (var hklm = RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, RegistryView.Registry64))
                using (var k = hklm.OpenSubKey(@"SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full"))
                {
                    object v = k != null ? k.GetValue("Release") : null;
                    return v is int && (int)v >= 394802;
                }
            }
            catch { return true; } // si no se puede leer, no estorbar
        }

        public static void Instalar(bool conYtdlp, List<string> avisos, Action<int, string> progreso)
        {
            // 1) .NET Framework: en Windows 10/11 al día ya viene; solo en uno muy viejo hace falta.
            if (!HayNet())
            {
                try
                {
                    string tmp = Temporal("ndp48-instalador.exe");
                    Bajar(UrlNet48, tmp, p => Avisar(progreso, 2 + p * 8 / 100, "Descargando .NET Framework 4.8 de Microsoft… " + p + "%"));
                    Avisar(progreso, 10, "Instalando .NET Framework 4.8 (Windows te pedirá permiso)…");
                    int codigo = Ejecutar(tmp, "/passive /norestart", true, 30 * 60000);
                    Borrar(tmp);
                    if (codigo == 3010 || codigo == 1641) avisos.Add("Reinicia el equipo para terminar de instalar .NET Framework 4.8 antes de abrir Lienzo.");
                    else if (!HayNet()) avisos.Add("No se pudo instalar .NET Framework 4.8 (código " + codigo + "). Descárgalo de https://dotnet.microsoft.com/download/dotnet-framework/net48");
                }
                catch (Exception ex) { avisos.Add("No se pudo instalar .NET Framework 4.8: " + ex.Message + ". Descárgalo de https://dotnet.microsoft.com/download/dotnet-framework/net48"); }
            }

            // 2) WebView2: sin él Lienzo no puede dibujar nada.
            if (!Instalacion.HayWebView2())
            {
                try
                {
                    string tmp = Temporal("MicrosoftEdgeWebview2Setup.exe");
                    Bajar(UrlWebView2, tmp, p => Avisar(progreso, 12 + p * 4 / 100, "Descargando el motor WebView2 de Microsoft… " + p + "%"));
                    // Este programita de Microsoft baja e instala el motor. Sin permisos de administrador se instala para tu usuario.
                    Avisar(progreso, 16, "Instalando el motor WebView2 de Microsoft (puede tardar unos minutos)…");
                    int codigo = Ejecutar(tmp, "/silent /install", false, 20 * 60000);
                    Borrar(tmp);
                    if (!Instalacion.HayWebView2())
                        avisos.Add("No se pudo instalar WebView2 (código " + codigo + "). Descárgalo de https://go.microsoft.com/fwlink/p/?LinkId=2124703 y vuelve a abrir Lienzo.");
                }
                catch (Exception ex) { avisos.Add("No se pudo instalar WebView2: " + ex.Message + ". Descárgalo de https://go.microsoft.com/fwlink/p/?LinkId=2124703"); }
            }

            // 3) yt-dlp para los fondos de YouTube (opcional; si falla, Lienzo lo baja después cuando lo uses).
            if (conYtdlp && !HayYtdlp())
            {
                try
                {
                    Directory.CreateDirectory(Path.GetDirectoryName(RutaYtdlp));
                    Bajar(UrlYtdlp, RutaYtdlp, p => Avisar(progreso, 28 + p * 10 / 100, "Descargando yt-dlp (fondos de YouTube)… " + p + "%"));
                }
                catch (Exception ex) { avisos.Add("No se pudo descargar yt-dlp (" + ex.Message + "). Lienzo lo descargará cuando uses los fondos de YouTube."); }
            }
        }

        /// <summary>Descarga a un .part y lo renombra al final: nunca queda un archivo a medias con el nombre bueno.</summary>
        private static void Bajar(string url, string destino, Action<int> progreso)
        {
            ServicePointManager.SecurityProtocol |= (SecurityProtocolType)3072; // TLS 1.2 (.NET 4 no siempre lo activa solo)
            string parte = destino + ".part";
            for (int intento = 1; ; intento++)
            {
                try
                {
                    var req = (HttpWebRequest)WebRequest.Create(url);
                    req.UserAgent = "Lienzo-Instalador/" + InfoVersion.Texto;
                    req.AllowAutoRedirect = true;
                    req.Timeout = 30000;
                    req.ReadWriteTimeout = 60000;
                    using (var r = (HttpWebResponse)req.GetResponse())
                    using (var s = r.GetResponseStream())
                    using (var f = File.Create(parte))
                    {
                        long total = r.ContentLength, n = 0;
                        var buf = new byte[81920];
                        int k, ultimo = -1;
                        while ((k = s.Read(buf, 0, buf.Length)) > 0)
                        {
                            f.Write(buf, 0, k);
                            n += k;
                            if (total > 0 && progreso != null)
                            {
                                int p = (int)(n * 100 / total);
                                if (p != ultimo) { ultimo = p; progreso(p); }
                            }
                        }
                        if (total > 0 && n < total) throw new IOException("la descarga se cortó");
                    }
                    // Un .exe empieza con «MZ»: si llegó otra cosa (la página de un filtro de red o de un proxy), no sirve.
                    using (var f = File.OpenRead(parte))
                        if (f.ReadByte() != 'M' || f.ReadByte() != 'Z') throw new IOException("no llegó un programa (¿un filtro de red o el antivirus lo bloqueó?)");
                    if (File.Exists(destino)) File.Delete(destino);
                    File.Move(parte, destino);
                    return;
                }
                catch (Exception)
                {
                    Borrar(parte);
                    if (intento >= 3) throw;
                    Thread.Sleep(1500 * intento);
                }
            }
        }

        private static int Ejecutar(string exe, string argumentos, bool shell, int espera)
        {
            using (var p = Process.Start(new ProcessStartInfo(exe, argumentos) { UseShellExecute = shell, CreateNoWindow = !shell }))
            {
                if (!p.WaitForExit(espera)) throw new TimeoutException("tardó demasiado");
                return p.ExitCode;
            }
        }

        private static string Temporal(string nombre)
        {
            string d = Path.Combine(Path.GetTempPath(), "lienzo-instalador");
            Directory.CreateDirectory(d);
            return Path.Combine(d, nombre);
        }

        private static void Borrar(string ruta) { try { if (File.Exists(ruta)) File.Delete(ruta); } catch { } }

        private static void Avisar(Action<int, string> progreso, int pct, string texto)
        {
            if (progreso != null) progreso(pct, texto);
        }
    }

    /// <summary>La ventana del instalador, con los colores de Lienzo.</summary>
    internal class Ventana : Form
    {
        private static readonly Color Fondo = Color.FromArgb(20, 17, 31), Superficie = Color.FromArgb(31, 26, 46),
            Texto = Color.FromArgb(236, 232, 255), Tenue = Color.FromArgb(157, 151, 184),
            Acento = Color.FromArgb(124, 92, 255), Acento2 = Color.FromArgb(255, 95, 162);

        private readonly bool desinstalar;
        private readonly string dir;
        private readonly Label lblEstado, lblDetalle;
        private readonly CheckBox chkA, chkB, chkYtdlp;
        private List<string> avisos;
        private readonly Button btnPrincipal, btnCancelar;
        private readonly Panel barra;
        private int pct = -1;
        private bool terminado, trabajando;
        private Bitmap logo;

        public Ventana(bool desinstalar, string dir)
        {
            this.desinstalar = desinstalar;
            this.dir = dir;
            SuspendLayout();
            AutoScaleDimensions = new SizeF(96f, 96f);
            AutoScaleMode = AutoScaleMode.Dpi;
            Text = desinstalar ? "Desinstalar Lienzo" : "Instalar Lienzo";
            Font = new Font("Segoe UI", 10f);
            BackColor = Fondo;
            ForeColor = Texto;
            FormBorderStyle = FormBorderStyle.FixedSingle;
            MaximizeBox = false;
            StartPosition = FormStartPosition.CenterScreen;
            ClientSize = new Size(540, 400);
            DoubleBuffered = true;
            try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }

            string instalada = Instalacion.VersionInstalada();
            string titulo = desinstalar ? "¿Quitar Lienzo de este equipo?"
                : instalada == null ? "Vas a instalar Lienzo " + InfoVersion.Texto
                : instalada == InfoVersion.Texto ? "Lienzo " + InfoVersion.Texto + " ya está instalado"
                : "Actualizar Lienzo " + instalada + " → " + InfoVersion.Texto;
            string detalle;
            if (desinstalar)
                detalle = "Se cierra Lienzo, tu barra de tareas y tus iconos vuelven a la normalidad y se borran sus archivos. Tus ajustes, temas y fondos se guardan por si vuelves, salvo que marques la casilla.";
            else
            {
                var faltan = Dependencias.Faltan();
                detalle = "Fondos animados, una barra propia y bloques para tu escritorio. Se instala solo para tu usuario en:\n" + dir + "\n" +
                    (faltan.Count > 0
                        ? "También se descarga e instala lo que le falta a tu equipo: " + string.Join(" y ", faltan) + "."
                        : "Tu equipo ya tiene todo lo que Lienzo necesita.");
            }

            lblEstado = Etiqueta(titulo, new Font("Segoe UI Semibold", 12.5f), Texto, new Rectangle(32, 104, 476, 28));
            lblDetalle = Etiqueta(detalle, Font, Tenue, new Rectangle(32, 136, 476, 104));
            if (desinstalar)
            {
                chkA = Casilla("Borrar también mis ajustes, temas y fondos descargados", false, new Point(32, 248));
                chkB = null;
            }
            else
            {
                chkA = Casilla("Crear un acceso directo en el escritorio", true, new Point(32, 244));
                // Si ya tienes yt-dlp no hay nada que preguntar.
                int y = 270;
                if (!Dependencias.HayYtdlp()) { chkYtdlp = Casilla("Descargar yt-dlp para los fondos de YouTube (≈ 20 MB)", true, new Point(32, y)); y += 26; }
                chkB = Casilla("Abrir Lienzo al terminar", true, new Point(32, y));
            }

            barra = new Panel { Bounds = new Rectangle(32, 332, 476, 6), Visible = false, BackColor = Superficie };
            barra.Paint += PintarBarra;
            Controls.Add(barra);

            btnCancelar = Boton("Cancelar", false, new Rectangle(296, 350, 100, 34));
            btnCancelar.Click += (o, e) => Close();
            btnPrincipal = Boton(desinstalar ? "Desinstalar" : instalada == null ? "Instalar" : instalada == InfoVersion.Texto ? "Reinstalar" : "Actualizar",
                true, new Rectangle(408, 350, 100, 34));
            btnPrincipal.Click += (o, e) => AlPrincipal();
            AcceptButton = btnPrincipal;
            CancelButton = btnCancelar;
            ResumeLayout(false);
        }

        protected override void OnHandleCreated(EventArgs e)
        {
            base.OnHandleCreated(e);
            int si = 1; // barra de título oscura (Windows 10 20H1+ / 11)
            try { DwmSetWindowAttribute(Handle, 20, ref si, 4); } catch { }
        }

        [DllImport("dwmapi.dll")] private static extern int DwmSetWindowAttribute(IntPtr h, int attr, ref int valor, int tam);

        private float Escala { get { return DeviceDpi / 96f; } }

        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            var g = e.Graphics;
            float f = Escala;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.ClearTypeGridFit;
            // Franja superior con degradado suave y el logo.
            using (var pincel = new LinearGradientBrush(new Rectangle(0, 0, ClientSize.Width, (int)(84 * f) + 1),
                Color.FromArgb(70, Acento), Color.FromArgb(40, Acento2), LinearGradientMode.Horizontal))
                g.FillRectangle(pincel, 0, 0, ClientSize.Width, 84 * f);
            int t = (int)(52 * f);
            if (logo == null || logo.Width != t) { if (logo != null) logo.Dispose(); logo = Marca.Dibujar(t); }
            g.DrawImage(logo, 32 * f, 16 * f, t, t);
            // Título y subtítulo centrados juntos a la altura del logo (las fuentes ya vienen escaladas por el DPI).
            using (var fTitulo = new Font("Segoe UI Semibold", 17f))
            using (var fSub = new Font("Segoe UI", 9.5f))
            using (var bTitulo = new SolidBrush(Texto))
            using (var bSub = new SolidBrush(Tenue))
            {
                string sub = "Tu escritorio, como un rice de Linux · versión " + InfoVersion.Texto;
                float hT = fTitulo.GetHeight(g), hS = fSub.GetHeight(g);
                float y = 16 * f + (t - hT - hS + 4 * f) / 2;
                g.DrawString("Lienzo", fTitulo, bTitulo, 94 * f, y);
                g.DrawString(sub, fSub, bSub, 97 * f, y + hT - 4 * f);
            }
        }

        private void PintarBarra(object sender, PaintEventArgs e)
        {
            var g = e.Graphics;
            g.Clear(Superficie);
            if (pct <= 0) return;
            int ancho = Math.Max(1, barra.Width * Math.Min(100, pct) / 100);
            using (var pincel = new LinearGradientBrush(new Rectangle(0, 0, barra.Width + 1, barra.Height), Acento, Acento2, LinearGradientMode.Horizontal))
                g.FillRectangle(pincel, 0, 0, ancho, barra.Height);
        }

        private Label Etiqueta(string texto, Font fuente, Color color, Rectangle r)
        {
            var l = new Label { Text = texto, Font = fuente, ForeColor = color, BackColor = Color.Transparent, Bounds = r, AutoSize = false };
            Controls.Add(l);
            return l;
        }

        private CheckBox Casilla(string texto, bool marcada, Point p)
        {
            var c = new CheckBox { Text = texto, Checked = marcada, Location = p, AutoSize = true, ForeColor = Texto, FlatStyle = FlatStyle.Standard }; // System ignora ForeColor (texto negro sobre fondo oscuro)
            Controls.Add(c);
            return c;
        }

        private Button Boton(string texto, bool principal, Rectangle r)
        {
            var b = new Button
            {
                Text = texto, Bounds = r, FlatStyle = FlatStyle.Flat, Cursor = Cursors.Hand,
                BackColor = principal ? Acento : Superficie, ForeColor = Color.White,
                Font = new Font("Segoe UI Semibold", 10f), UseVisualStyleBackColor = false,
            };
            b.FlatAppearance.BorderSize = principal ? 0 : 1;
            b.FlatAppearance.BorderColor = Color.FromArgb(60, 54, 84);
            b.FlatAppearance.MouseOverBackColor = principal ? Color.FromArgb(143, 116, 255) : Color.FromArgb(44, 38, 64);
            Controls.Add(b);
            return b;
        }

        private void AlPrincipal()
        {
            if (terminado)
            {
                if (!desinstalar && chkB != null && chkB.Checked) { try { Instalacion.AbrirLienzo(); } catch { } }
                Close();
                return;
            }
            trabajando = true;
            btnPrincipal.Enabled = btnCancelar.Enabled = false;
            BloquearCasillas(true);
            barra.Visible = true;
            bool opcion = chkA.Checked;
            bool conYtdlp = chkYtdlp != null && chkYtdlp.Checked;
            Action<int, string> progreso = (p, texto) => BeginInvoke((Action)(() =>
            {
                pct = p;
                lblEstado.Text = texto;
                barra.Invalidate();
            }));
            var hilo = new Thread(() =>
            {
                Exception error = null;
                try
                {
                    if (desinstalar) Instalacion.Desinstalar(dir, opcion, progreso);
                    else avisos = Instalacion.Instalar(opcion, conYtdlp, progreso);
                }
                catch (Exception ex) { error = ex; }
                BeginInvoke((Action)(() => AlTerminar(error)));
            }) { IsBackground = true };
            hilo.SetApartmentState(ApartmentState.STA); // los accesos directos usan COM
            hilo.Start();
        }

        /// <summary>Con Enabled = false el texto sale gris oscuro e ilegible sobre el fondo; AutoCheck solo impide cambiarlas.</summary>
        private void BloquearCasillas(bool bloquear)
        {
            foreach (var c in new[] { chkA, chkB, chkYtdlp })
                if (c != null) { c.AutoCheck = !bloquear; c.TabStop = !bloquear; }
        }

        private void AlTerminar(Exception error)
        {
            trabajando = false;
            if (error != null)
            {
                lblEstado.Text = "Algo salió mal";
                lblDetalle.Text = error.Message;
                btnPrincipal.Enabled = btnCancelar.Enabled = true;
                btnPrincipal.Text = "Reintentar";
                BloquearCasillas(false);
                return;
            }
            terminado = true;
            if (desinstalar)
            {
                lblEstado.Text = "Lienzo se desinstaló";
                lblDetalle.Text = opcionTexto(chkA.Checked);
                btnPrincipal.Text = "Cerrar";
            }
            else
            {
                if (avisos != null && avisos.Count > 0)
                {
                    lblEstado.Text = "Lienzo está instalado, pero falta algo";
                    lblDetalle.Text = string.Join("\n", avisos);
                }
                else
                {
                    lblEstado.Text = "¡Lienzo está instalado!";
                    lblDetalle.Text = "Lo encuentras en el menú Inicio como «Lienzo». Para quitarlo: Configuración → Aplicaciones → Aplicaciones instaladas → Lienzo.";
                }
                btnPrincipal.Text = chkB != null && chkB.Checked ? "Abrir" : "Cerrar";
                if (chkB != null) chkB.AutoCheck = true;
                chkB.CheckedChanged += (o, e) => btnPrincipal.Text = chkB.Checked ? "Abrir" : "Cerrar";
            }
            btnPrincipal.Enabled = true;
            btnCancelar.Visible = false;
            btnPrincipal.Focus();
        }

        private static string opcionTexto(bool borroDatos)
        {
            return borroDatos ? "También se borraron tus ajustes, temas y fondos." : "Tus ajustes, temas y fondos siguen guardados por si vuelves a instalarlo.";
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            if (trabajando) { e.Cancel = true; return; } // no dejar a medias
            base.OnFormClosing(e);
        }
    }
}

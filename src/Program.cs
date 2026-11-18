using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;

namespace Lienzo
{
    internal static class Program
    {
        [STAThread]
        private static void Main(string[] args)
        {
            bool nueva;
            using (var mutex = new Mutex(true, "Local\\Lienzo.Instancia", out nueva))
            {
                bool restaurar = args.Contains("--restaurar");
                int orden = args.Contains("--salir") || restaurar ? App.CmdSalir : args.Contains("--editar") ? App.CmdEditar : App.CmdPanel;
                if (!nueva && orden != App.CmdSalir && Nativo.FindWindow(null, App.TituloMensajes) == IntPtr.Zero)
                {
                    // La otra instancia se está cerrando (ya no tiene ventana): la esperamos y seguimos nosotros.
                    try { nueva = mutex.WaitOne(8000); } catch (AbandonedMutexException) { nueva = true; }
                }
                if (!nueva)
                {
                    // Ya hay un Lienzo abierto: le pasamos la orden y salimos (con --salir/--restaurar esperamos a que cierre).
                    IntPtr h = Nativo.FindWindow(null, App.TituloMensajes);
                    if (h != IntPtr.Zero) Nativo.PostMessage(h, (int)App.MsgComando, new IntPtr(orden), IntPtr.Zero);
                    if (orden == App.CmdSalir)
                    {
                        bool cerro;
                        try { cerro = mutex.WaitOne(15000); } catch (AbandonedMutexException) { cerro = true; }
                        if (cerro) try { mutex.ReleaseMutex(); } catch { }
                    }
                    if (!restaurar) return;
                }
                if (restaurar) { BarraWindows.RestaurarDeEmergencia(); return; }
                if (args.Contains("--salir")) return;

                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                Application.ThreadException += (o, e) => App.Fallo(e.Exception);
                AppDomain.CurrentDomain.UnhandledException += (o, e) => App.Fallo(e.ExceptionObject as Exception);
                SynchronizationContext.SetSynchronizationContext(new WindowsFormsSynchronizationContext());

                var app = new App(args);
                app.Arrancar();
                Application.Run();
                try { mutex.ReleaseMutex(); } catch { }
            }
        }
    }

    /// <summary>El corazón de Lienzo: crea las ventanas, guarda la configuración y reparte los mensajes.</summary>
    internal partial class App
    {
        public static App Actual;
        public const string HostApp = "lienzo.example", HostDatos = "datos.lienzo.example";
        public const string TituloMensajes = "Lienzo.Mensajes";
        public const int CmdPanel = 1, CmdSalir = 2, CmdEditar = 3;
        public static readonly uint MsgComando = Nativo.RegisterWindowMessage("Lienzo.Comando");
        public static readonly uint MsgTaskbarCreated = Nativo.RegisterWindowMessage("TaskbarCreated");

        public readonly string DirExe, DirWeb, DirDatos, DirCache;
        public readonly string[] Argumentos;
        public bool ModoDev;
        public CoreWebView2Environment Entorno;
        public Dictionary<string, object> Defecto, Config;
        public VentanaMensajes Mensajes;
        public bool Saliendo;

        private readonly string rutaConfig;
        private static readonly object candadoRegistro = new object();
        private static string rutaRegistro;

        public App(string[] args)
        {
            Actual = this;
            Argumentos = args;
            ModoDev = args.Contains("--dev");
            DirExe = Path.GetDirectoryName(Application.ExecutablePath);
            DirWeb = Path.Combine(DirExe, "web");
            DirDatos = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Lienzo");
            DirCache = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Lienzo");
            Directory.CreateDirectory(DirDatos);
            Directory.CreateDirectory(Path.Combine(DirDatos, "biblioteca"));
            Directory.CreateDirectory(Path.Combine(DirDatos, "escenas"));
            Directory.CreateDirectory(DirCache);
            rutaConfig = Path.Combine(DirDatos, "config.json");
            rutaRegistro = Path.Combine(DirCache, "registro.txt");
            try { if (File.Exists(rutaRegistro) && new FileInfo(rutaRegistro).Length > 512 * 1024) File.Delete(rutaRegistro); } catch { }
        }

        public void Arrancar()
        {
            Registro("---- Lienzo arranca (" + string.Join(" ", Argumentos) + ") ----");
            CargarConfig();
            Mensajes = new VentanaMensajes();
            IniciarAsync();

            // Para pruebas automáticas: --cerrar-tras N (segundos)
            int i = Array.IndexOf(Argumentos, "--cerrar-tras");
            int segundos;
            if (i >= 0 && i + 1 < Argumentos.Length && int.TryParse(Argumentos[i + 1], out segundos))
            {
                var t = new System.Windows.Forms.Timer { Interval = segundos * 1000 };
                t.Tick += (o, e) => { t.Stop(); Salir(); };
                t.Start();
            }
        }

        private async void IniciarAsync()
        {
            try
            {
                // Sin el proceso "de repuesto" que Chromium deja precargado para navegar más rápido (aquí no se navega):
                // ahorra unos 40 MB. Sin tareas de red en segundo plano del navegador.
                string argumentos = "--autoplay-policy=no-user-gesture-required --disable-features=msSmartScreenProtection,SpareRendererForSitePerProcess" +
                    " --disable-background-networking";
                // Modo desarrollo: puerto de depuración local para probar las páginas con herramientas/cdp.js
                if (ModoDev) argumentos += " --remote-debugging-port=9333";
                var opciones = new CoreWebView2EnvironmentOptions(argumentos);
                Entorno = await CoreWebView2Environment.CreateAsync(null, Path.Combine(DirCache, "WebView2"), opciones);
                Registro("WebView2 " + Entorno.BrowserVersionString);
                await IniciarModulos();
            }
            catch (WebView2RuntimeNotFoundException)
            {
                MessageBox.Show("Lienzo necesita el motor WebView2 de Microsoft Edge.\nDescárgalo gratis desde: https://go.microsoft.com/fwlink/p/?LinkId=2124703",
                    "Lienzo", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                Salir();
            }
            catch (Exception ex)
            {
                Fallo(ex);
            }
        }

        // ---------------- Configuración ----------------

        public void CargarConfig()
        {
            try { Defecto = Json.Objeto(File.ReadAllText(Path.Combine(DirWeb, "comun", "defecto.json"), Encoding.UTF8)); }
            catch (Exception ex) { Registro("defecto.json: " + ex.Message); Defecto = new Dictionary<string, object>(); }
            Dictionary<string, object> usuario = null;
            try { if (File.Exists(rutaConfig)) usuario = Json.Objeto(File.ReadAllText(rutaConfig, Encoding.UTF8)); }
            catch (Exception ex) { Registro("config.json dañado, uso valores por defecto: " + ex.Message); }
            PrimeraVez = usuario == null;
            Config = Json.Fusionar(Defecto, usuario);
        }

        public bool PrimeraVez;

        public void GuardarConfig(Dictionary<string, object> nueva)
        {
            Config = Json.Fusionar(Defecto, nueva);
            try
            {
                string tmp = rutaConfig + ".tmp";
                File.WriteAllText(tmp, Json.Escribir(Config), new UTF8Encoding(false));
                if (File.Exists(rutaConfig)) File.Replace(tmp, rutaConfig, null);
                else File.Move(tmp, rutaConfig);
            }
            catch (Exception ex) { Registro("No pude guardar la config: " + ex.Message); }
        }

        public string Cfg(string ruta, string defecto) { return Json.Texto(Config, ruta, defecto); }
        public double CfgNum(string ruta, double defecto) { return Json.Numero(Config, ruta, defecto); }
        public bool CfgBool(string ruta, bool defecto) { return Json.Bool(Config, ruta, defecto); }

        // ---------------- Utilidades ----------------

        public static void Registro(string texto)
        {
            try
            {
                lock (candadoRegistro)
                    File.AppendAllText(rutaRegistro, DateTime.Now.ToString("HH:mm:ss.fff") + "  " + texto + Environment.NewLine);
            }
            catch { }
            if (Actual != null && Actual.ModoDev) Debug.WriteLine(texto);
        }

        public static void Fallo(Exception ex)
        {
            Registro("ERROR: " + ex);
            // Lo más importante si algo explota: que la barra de Windows vuelva a aparecer.
            try { BarraWindows.Restaurar(); } catch { }
        }

        public static void AbrirExterno(string url)
        {
            if (string.IsNullOrEmpty(url)) return;
            Uri u;
            if (!Uri.TryCreate(url, UriKind.Absolute, out u) || (u.Scheme != "https" && u.Scheme != "http" && u.Scheme != "ms-settings")) return;
            try { Process.Start(new ProcessStartInfo(url) { UseShellExecute = true }); } catch { }
        }

        public void Salir()
        {
            if (Saliendo) return;
            Saliendo = true;
            Registro("Lienzo se cierra.");
            try { Detener(); } catch (Exception ex) { Registro("Al cerrar: " + ex.Message); }
            try { BarraWindows.Restaurar(); } catch { }
            if (Mensajes != null) Mensajes.DestroyHandle();
            Application.ExitThread();
        }
    }

    /// <summary>Ventana invisible que recibe avisos de Windows (Explorer reiniciado, sesión bloqueada, órdenes de otra instancia...).</summary>
    internal class VentanaMensajes : NativeWindow
    {
        public event Action<Message> Recibido;

        public VentanaMensajes()
        {
            var cp = new CreateParams { Caption = App.TituloMensajes, Style = unchecked((int)Nativo.WS_POPUP), ExStyle = Nativo.WS_EX_TOOLWINDOW };
            CreateHandle(cp);
        }

        protected override void WndProc(ref Message m)
        {
            var app = App.Actual;
            if (m.Msg == (int)App.MsgComando)
            {
                int orden = m.WParam.ToInt32();
                if (orden == App.CmdSalir) app.Salir();
                else app.Comando(orden);
                return;
            }
            if (m.Msg == (int)App.MsgTaskbarCreated)
            {
                App.Registro("Explorer se reinició (TaskbarCreated).");
                app.AlReiniciarExplorer();
                return;
            }
            if (m.Msg == 0x11 /* WM_QUERYENDSESSION */)
            {
                try { BarraWindows.Restaurar(); } catch { }
                m.Result = new IntPtr(1);
                return;
            }
            var r = Recibido;
            if (r != null) r(m);
            base.WndProc(ref m);
        }
    }
}

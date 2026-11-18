using System;
using System.Collections.Generic;
using System.Drawing;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;

namespace Lienzo
{
    /// <summary>
    /// Una ventana nativa que aloja un WebView2: el fondo (uno por monitor), la barra, el modo edición y el panel.
    /// Las páginas hablan con C# con mensajes JSON {tipo: "...", ...}.
    /// </summary>
    internal class Superficie : NativeWindow
    {
        public readonly string Nombre;
        public CoreWebView2Controller Controlador;
        public bool Lista;                   // la página ya envió "listo"
        public bool SinActivar;              // no robar el foco al hacer clic (barra)
        public bool Transparente;
        public object Etiqueta;              // datos extra (p. ej. el monitor)
        public bool EsVentanaNormal;         // ventana con marco (panel): tamaño mínimo, foco, cambio de DPI
        public Size MinimoDip = new Size(860, 560);
        public event Action<Superficie, Dictionary<string, object>> Mensaje;
        public event Action<Superficie> Destruida;
        public event Action<Superficie> CerrarSolicitado;
        public event Action<Superficie, Message> MensajeVentana;   // para que la barra reciba los avisos de AppBar

        private static readonly IntPtr pincelNegro = Nativo.GetStockObject(4); // BLACK_BRUSH

        public Superficie(string nombre, CreateParams cp)
        {
            Nombre = nombre;
            CreateHandle(cp);
        }

        public CoreWebView2 Web { get { return Controlador != null ? Controlador.CoreWebView2 : null; } }

        public static CreateParams Parametros(string titulo, long estilo, int estiloEx, Rectangle r)
        {
            var cp = new CreateParams();
            cp.Caption = titulo;
            cp.Style = unchecked((int)estilo);
            cp.ExStyle = estiloEx;
            cp.X = r.X; cp.Y = r.Y; cp.Width = r.Width; cp.Height = r.Height;
            return cp;
        }

        public async Task Iniciar(CoreWebView2Environment entorno, string pagina, bool transparente)
        {
            Transparente = transparente;
            Controlador = await entorno.CreateCoreWebView2ControllerAsync(Handle);
            if (Handle == IntPtr.Zero) return; // se destruyó mientras esperábamos
            Controlador.DefaultBackgroundColor = transparente ? Color.FromArgb(0, 0, 0, 0) : Color.Black;
            var s = Controlador.CoreWebView2.Settings;
            s.AreDevToolsEnabled = App.Actual.ModoDev;
            s.AreDefaultContextMenusEnabled = App.Actual.ModoDev || Nombre == "panel";
            s.IsStatusBarEnabled = false;
            s.IsZoomControlEnabled = false;
            s.IsPinchZoomEnabled = false;
            s.IsSwipeNavigationEnabled = false;
            s.AreBrowserAcceleratorKeysEnabled = App.Actual.ModoDev;
            s.IsGeneralAutofillEnabled = false;
            s.IsPasswordAutosaveEnabled = false;

            var web = Controlador.CoreWebView2;
            web.SetVirtualHostNameToFolderMapping(App.HostApp, App.Actual.DirWeb, CoreWebView2HostResourceAccessKind.Allow);
            web.SetVirtualHostNameToFolderMapping(App.HostDatos, App.Actual.DirDatos, CoreWebView2HostResourceAccessKind.Allow);
            web.WebMessageReceived += AlRecibir;
            web.NewWindowRequested += (o, e) =>
            {
                e.Handled = true;
                App.AbrirExterno(e.Uri);
            };
            web.NavigationStarting += (o, e) =>
            {
                Uri u;
                if (!Uri.TryCreate(e.Uri, UriKind.Absolute, out u)) { e.Cancel = true; return; }
                if (u.Host == App.HostApp || u.Host == App.HostDatos || u.Scheme == "about" || u.Scheme == "data") return;
                e.Cancel = true;
                App.AbrirExterno(e.Uri);
            };
            web.ProcessFailed += (o, e) =>
            {
                App.Registro("WebView '" + Nombre + "' falló: " + e.ProcessFailedKind);
                if (e.ProcessFailedKind == CoreWebView2ProcessFailedKind.RenderProcessExited ||
                    e.ProcessFailedKind == CoreWebView2ProcessFailedKind.RenderProcessUnresponsive)
                {
                    try { web.Reload(); } catch { }
                }
            };
            Ajustar();
            web.Navigate("https://" + App.HostApp + "/" + pagina);
        }

        private void AlRecibir(object o, CoreWebView2WebMessageReceivedEventArgs e)
        {
            Dictionary<string, object> m;
            try { m = Json.Objeto(e.WebMessageAsJson); }
            catch { return; }
            if (m == null) return;
            if (Json.Texto(m, "tipo", "") == "listo") Lista = true;
            var h = Mensaje;
            if (h != null) h(this, m);
        }

        public void Enviar(string tipo, object datos)
        {
            var web = Web;
            if (web == null) return;
            var m = new Dictionary<string, object>();
            m["tipo"] = tipo;
            var dic = datos as Dictionary<string, object>;
            if (dic != null) foreach (var kv in dic) m[kv.Key] = kv.Value;
            else if (datos != null) m["datos"] = datos;
            try { web.PostWebMessageAsJson(Json.Escribir(m)); }
            catch (Exception ex) { App.Registro("No se pudo enviar a '" + Nombre + "': " + ex.Message); }
        }

        public void EnviarCrudo(string json)
        {
            var web = Web;
            if (web == null) return;
            try { web.PostWebMessageAsJson(json); } catch { }
        }

        public void Ajustar()
        {
            if (Controlador == null || Handle == IntPtr.Zero) return;
            Nativo.RECT r;
            Nativo.GetClientRect(Handle, out r);
            Controlador.Bounds = new Rectangle(0, 0, Math.Max(1, r.Ancho), Math.Max(1, r.Alto));
        }

        public void Mover(Rectangle r, IntPtr despuesDe, uint banderas)
        {
            Nativo.SetWindowPos(Handle, despuesDe, r.X, r.Y, r.Width, r.Height, banderas | Nativo.SWP_NOACTIVATE);
            Ajustar();
        }

        public bool Visible
        {
            get { return Controlador != null && Controlador.IsVisible; }
            set { if (Controlador != null && Controlador.IsVisible != value) Controlador.IsVisible = value; }
        }

        private bool cerrando;

        public void Cerrar()
        {
            cerrando = true;
            try { if (Controlador != null) Controlador.Close(); } catch { }
            Controlador = null;
            if (Handle != IntPtr.Zero) DestroyHandle();
        }

        protected override void WndProc(ref Message m)
        {
            switch (m.Msg)
            {
                case Nativo.WM_ERASEBKGND:
                    {
                        Nativo.RECT r;
                        Nativo.GetClientRect(m.HWnd, out r);
                        Nativo.FillRect(m.WParam, ref r, pincelNegro);
                        m.Result = new IntPtr(1);
                        return;
                    }
                case Nativo.WM_SIZE:
                    base.WndProc(ref m);
                    Ajustar();
                    return;
                case Nativo.WM_MOUSEACTIVATE:
                    if (SinActivar) { m.Result = new IntPtr(Nativo.MA_NOACTIVATE); return; }
                    break;
                case Nativo.WM_CLOSE:
                    if (CerrarSolicitado != null) { CerrarSolicitado(this); return; }
                    break;
                case Nativo.WM_ACTIVATE:
                case 0x7 /* WM_SETFOCUS */:
                    base.WndProc(ref m);
                    if (Controlador != null && (m.Msg == 0x7 || (m.WParam.ToInt64() & 0xFFFF) != 0) && !SinActivar)
                    {
                        try { Controlador.MoveFocus(CoreWebView2MoveFocusReason.Programmatic); } catch { }
                    }
                    return;
                case Nativo.WM_GETMINMAXINFO:
                    if (EsVentanaNormal)
                    {
                        double esc = Nativo.GetDpiForWindow(m.HWnd) / 96.0;
                        System.Runtime.InteropServices.Marshal.WriteInt32(m.LParam, 24, (int)(MinimoDip.Width * esc));
                        System.Runtime.InteropServices.Marshal.WriteInt32(m.LParam, 28, (int)(MinimoDip.Height * esc));
                        m.Result = IntPtr.Zero;
                        return;
                    }
                    break;
                case Nativo.WM_DPICHANGED:
                    if (EsVentanaNormal && m.LParam != IntPtr.Zero)
                    {
                        var r = (Nativo.RECT)System.Runtime.InteropServices.Marshal.PtrToStructure(m.LParam, typeof(Nativo.RECT));
                        Nativo.SetWindowPos(m.HWnd, IntPtr.Zero, r.Left, r.Top, r.Ancho, r.Alto, Nativo.SWP_NOZORDER | Nativo.SWP_NOACTIVATE);
                        m.Result = IntPtr.Zero;
                        return;
                    }
                    break;
                case Nativo.WM_NCDESTROY:
                    base.WndProc(ref m);
                    // Si no la cerramos nosotros, la destruyó Windows (p. ej. Explorer se reinició): avisar para recrearla.
                    var d = Destruida;
                    if (d != null && !cerrando) d(this);
                    return;
            }
            var mv = MensajeVentana;
            if (mv != null && (m.Msg >= Nativo.WM_USER || m.Msg == Nativo.WM_DPICHANGED)) mv(this, m);
            base.WndProc(ref m);
        }
    }
}

using System;
using System.Drawing;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace Lienzo
{
    /// <summary>
    /// La barra propia de Lienzo: una ventana registrada como AppBar (las ventanas maximizadas la respetan),
    /// en cualquier borde, flotante o pegada, con fondo acrílico, transparente o sólido.
    /// </summary>
    internal partial class App
    {
        public Superficie Barra;
        private static readonly uint MsgAppBar = Nativo.RegisterWindowMessage("Lienzo.AppBar");
        private bool appBarRegistrada, juegoPantallaCompleta, posicionando;
        private Monitor monitorBarra;
        private Timer relojPosicion;

        public async Task CrearBarra()
        {
            CerrarBarra();
            if (!CfgBool("barra.activa", true)) return;
            monitorBarra = Monitor.Principal_();
            if (monitorBarra == null) return;
            var cp = Superficie.Parametros("Lienzo.Barra", Nativo.WS_POPUP | Nativo.WS_CLIPCHILDREN,
                Nativo.WS_EX_TOOLWINDOW | Nativo.WS_EX_NOACTIVATE | Nativo.WS_EX_TOPMOST,
                new Rectangle(monitorBarra.Area.X, monitorBarra.Area.Y, 200, 40));
            Barra = new Superficie("barra", cp) { SinActivar = true };
            Barra.Mensaje += AlMensaje;
            Barra.MensajeVentana += AlMensajeBarra;
            barraEscondida = barraAsomada = condicionEsconder = false;
            if (ReservarEspacio()) RegistrarAppBar();
            AplicarEstiloBarra();
            PosicionarBarra();
            await Barra.Iniciar(Entorno, "barra.html", true);
            IniciarAutoOcultar();
            // La barra es poca cosa: Chromium puede soltar cachés y memoria que no use.
            if (Barra != null && Barra.Web != null) Barra.Web.MemoryUsageTargetLevel = Microsoft.Web.WebView2.Core.CoreWebView2MemoryUsageTargetLevel.Low;
        }

        public void CerrarBarra()
        {
            if (Barra == null) return;
            PararAutoOcultar();
            QuitarAppBar();
            Barra.Cerrar();
            Barra = null;
        }

        private Nativo.APPBARDATA DatosAppBar()
        {
            return new Nativo.APPBARDATA { cbSize = Marshal.SizeOf(typeof(Nativo.APPBARDATA)), hWnd = Barra.Handle, uCallbackMessage = MsgAppBar };
        }

        private void RegistrarAppBar()
        {
            if (appBarRegistrada || Barra == null) return;
            var d = DatosAppBar();
            appBarRegistrada = Nativo.SHAppBarMessage(Nativo.ABM_NEW, ref d) != UIntPtr.Zero;
        }

        private void QuitarAppBar()
        {
            if (!appBarRegistrada || Barra == null) return;
            var d = DatosAppBar();
            Nativo.SHAppBarMessage(Nativo.ABM_REMOVE, ref d);
            appBarRegistrada = false;
        }

        private uint Borde()
        {
            switch (Cfg("barra.posicion", "arriba"))
            {
                case "abajo": return Nativo.ABE_BOTTOM;
                case "izquierda": return Nativo.ABE_LEFT;
                case "derecha": return Nativo.ABE_RIGHT;
                default: return Nativo.ABE_TOP;
            }
        }

        public void PosicionarBarra()
        {
            if (Barra == null || posicionando) return;
            posicionando = true;
            try
            {
                monitorBarra = Monitor.Principal_() ?? monitorBarra;
                var mon = monitorBarra;
                double esc = mon.Escala;
                bool flotante = CfgBool("barra.flotante", true);
                int grosor = (int)Math.Round(Math.Max(24, Math.Min(96, CfgNum("barra.grosor", 38))) * esc);
                int margen = flotante ? (int)Math.Round(Math.Max(0, Math.Min(40, CfgNum("barra.margen", 8))) * esc) : 0;
                int reserva = grosor + margen * 2;
                uint borde = Borde();

                // Con auto-ocultar la barra no aparta las ventanas: se pone encima, dentro del área de trabajo
                // (así no tapa la barra de Windows si esa sigue a la vista).
                bool reservar = ReservarEspacio();
                if (!reservar && appBarRegistrada)
                {
                    QuitarAppBar();
                    mon = Monitor.Principal_() ?? mon;
                    monitorBarra = mon;
                    ProgramarPosicion(); // por si Windows tarda en devolver el espacio que reservábamos
                }
                else if (reservar && !appBarRegistrada) RegistrarAppBar();
                var baseBarra = reservar ? mon.Area : mon.Trabajo;

                var d = DatosAppBar();
                d.uEdge = borde;
                d.rc = new Nativo.RECT(baseBarra.Left, baseBarra.Top, baseBarra.Right, baseBarra.Bottom);
                Recortar(ref d.rc, borde, reserva);
                if (appBarRegistrada) Nativo.SHAppBarMessage(Nativo.ABM_QUERYPOS, ref d);
                Recortar(ref d.rc, borde, reserva);
                if (appBarRegistrada) Nativo.SHAppBarMessage(Nativo.ABM_SETPOS, ref d);

                var r = d.rc.ARect();
                if (margen > 0) r.Inflate(-margen, -margen);
                IntPtr orden = juegoPantallaCompleta && reservar ? Nativo.HWND_BOTTOM : Nativo.HWND_TOPMOST;
                Barra.Mover(r, orden, barraEscondida ? 0 : Nativo.SWP_SHOWWINDOW);
                AplicarRedondeo(r, esc);
            }
            finally { posicionando = false; }
        }

        private static void Recortar(ref Nativo.RECT rc, uint borde, int reserva)
        {
            if (borde == Nativo.ABE_TOP) rc.Bottom = rc.Top + reserva;
            else if (borde == Nativo.ABE_BOTTOM) rc.Top = rc.Bottom - reserva;
            else if (borde == Nativo.ABE_LEFT) rc.Right = rc.Left + reserva;
            else rc.Left = rc.Right - reserva;
        }

        /// <summary>Acrílico (desenfoque de Windows), transparente (solo se ven las "islas") o sólido.</summary>
        public void AplicarEstiloBarra()
        {
            if (Barra == null) return;
            IntPtr h = Barra.Handle;
            string fondo = Cfg("barra.fondo", "acrilico");
            string estilo = Cfg("barra.estilo", "islas");
            if (fondo == "acrilico" && estilo != "islas")
            {
                int alfa = (int)Math.Round(Math.Max(0.02, Math.Min(1, CfgNum("barra.opacidad", 0.55))) * 200);
                Nativo.Acento(h, Nativo.ACCENT_ENABLE_ACRYLICBLURBEHIND, ColorAbgr(Cfg("paleta.colores.fondo", "#14111f"), alfa));
            }
            else Nativo.Acento(h, Nativo.ACCENT_ENABLE_TRANSPARENTGRADIENT, 0);
            if (monitorBarra != null)
            {
                Nativo.RECT r;
                Nativo.GetWindowRect(h, out r);
                AplicarRedondeo(r.ARect(), monitorBarra.Escala);
            }
        }

        private void AplicarRedondeo(Rectangle r, double esc)
        {
            if (Barra == null) return;
            bool continua = Cfg("barra.estilo", "islas") != "islas";
            bool redondear = continua && CfgBool("barra.flotante", true) && CfgNum("barra.redondeo", 14) > 0;
            if (redondear)
            {
                int rad = (int)Math.Round(Math.Min(CfgNum("barra.redondeo", 14), Math.Min(r.Width, r.Height) / 2.0 / esc) * esc * 2);
                // Región redondeada: recorta también el acrílico (las esquinas de DWM solo dan 8 px).
                Nativo.SetWindowRgn(Barra.Handle, Nativo.CreateRoundRectRgn(0, 0, r.Width + 1, r.Height + 1, rad, rad), true);
            }
            else Nativo.SetWindowRgn(Barra.Handle, IntPtr.Zero, true);
        }

        public static uint ColorAbgr(string hex, int alfa)
        {
            int rgb;
            string h = (hex ?? "#000000").TrimStart('#');
            if (h.Length == 3) h = "" + h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
            if (h.Length < 6 || !int.TryParse(h.Substring(0, 6), NumberStyles.HexNumber, CultureInfo.InvariantCulture, out rgb)) rgb = 0;
            uint r = (uint)((rgb >> 16) & 255), g = (uint)((rgb >> 8) & 255), b = (uint)(rgb & 255);
            return ((uint)Math.Max(0, Math.Min(255, alfa)) << 24) | (b << 16) | (g << 8) | r;
        }

        private void AlMensajeBarra(Superficie s, Message m)
        {
            if (m.Msg == (int)MsgAppBar)
            {
                switch (m.WParam.ToInt32())
                {
                    case Nativo.ABN_POSCHANGED:
                        ProgramarPosicion();
                        break;
                    case Nativo.ABN_FULLSCREENAPP:
                        if (!ReservarEspacio()) break; // con auto-ocultar ya se esconde sola
                        // Un juego o video a pantalla completa: la barra se va al fondo para no taparlo.
                        juegoPantallaCompleta = m.LParam != IntPtr.Zero;
                        if (Barra != null)
                            Nativo.SetWindowPos(Barra.Handle, juegoPantallaCompleta ? Nativo.HWND_BOTTOM : Nativo.HWND_TOPMOST, 0, 0, 0, 0,
                                Nativo.SWP_NOMOVE | Nativo.SWP_NOSIZE | Nativo.SWP_NOACTIVATE);
                        break;
                }
            }
            else if (m.Msg == Nativo.WM_DPICHANGED) ProgramarPosicion();
        }

        public void ProgramarPosicion()
        {
            if (relojPosicion == null)
            {
                relojPosicion = new Timer { Interval = 250 };
                relojPosicion.Tick += (o, e) => { relojPosicion.Stop(); PosicionarBarra(); };
            }
            relojPosicion.Stop();
            relojPosicion.Start();
        }
    }
}

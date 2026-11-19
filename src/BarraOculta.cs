using System;
using System.Drawing;
using System.Windows.Forms;

namespace Lienzo
{
    /// <summary>
    /// Auto-ocultar la barra de Lienzo (barra.autoOcultar):
    ///   "no"          siempre a la vista y reservando su espacio (las ventanas maximizadas la respetan);
    ///   "maximizada"  se esconde cuando hay una ventana maximizada o a pantalla completa en su monitor;
    ///   "siempre"     escondida hasta que llevas el ratón al borde.
    /// Escondida, sale al dejar el ratón en el borde donde estaba y se vuelve a ir cuando el ratón se aleja.
    /// </summary>
    internal partial class App
    {
        private Timer relojAutoOcultar;
        private bool barraEscondida, barraAsomada, condicionEsconder;
        private int ticksAuto, generacionAnimacion;
        private DateTime bordeDesde = DateTime.MaxValue, fueraDesde = DateTime.MaxValue;

        private const int BordeSensible = 3;          // px desde el borde de la pantalla que hacen salir la barra
        private const int EsperaAsomar = 200;         // ms con el ratón en el borde (así no estorba al ir a las pestañas)
        private const int EsperaEsconder = 550;       // ms con el ratón fuera de la barra

        private string ModoAutoOcultar { get { return Cfg("barra.autoOcultar", "maximizada"); } }

        /// <summary>La barra reserva su espacio (AppBar) solo mientras está fija a la vista.</summary>
        private bool ReservarEspacio()
        {
            string m = ModoAutoOcultar;
            return m == "no" || (m == "maximizada" && !condicionEsconder);
        }

        /// <summary>Arranca o para la vigilancia según el ajuste. Se llama al crear la barra y al cambiar barra.autoOcultar.</summary>
        public void IniciarAutoOcultar()
        {
            if (relojAutoOcultar == null)
            {
                relojAutoOcultar = new Timer { Interval = 100 };
                relojAutoOcultar.Tick += (o, e) => TickAutoOcultar();
            }
            if (Barra == null || ModoAutoOcultar == "no")
            {
                relojAutoOcultar.Stop();
                bool estaba = barraEscondida || barraAsomada;
                condicionEsconder = false;
                if (Barra != null && estaba) MostrarBarraFija();
                return;
            }
            ticksAuto = 0;
            relojAutoOcultar.Start();
            TickAutoOcultar();
        }

        private void PararAutoOcultar()
        {
            if (relojAutoOcultar != null) relojAutoOcultar.Stop();
            barraEscondida = barraAsomada = condicionEsconder = false;
            generacionAnimacion++;
        }

        private void TickAutoOcultar()
        {
            if (Barra == null || Saliendo || monitorBarra == null) return;

            // Cada ~300 ms: ¿hay algo maximizado o a pantalla completa?
            if (ticksAuto++ % 3 == 0)
            {
                bool c = ModoAutoOcultar == "siempre" || HayVentanaQueTapa(monitorBarra);
                if (c != condicionEsconder)
                {
                    condicionEsconder = c;
                    if (c) EsconderBarra();
                    PosicionarBarra();                 // suelta o vuelve a reservar el espacio
                    if (!c) MostrarBarraFija();
                }
            }
            if (!condicionEsconder) return;

            Nativo.POINT p;
            if (!Nativo.GetCursorPos(out p)) return;
            var ahora = DateTime.Now;
            if (barraEscondida)
            {
                if (EnBordeDeLaBarra(p) && CursorVisible() && !BotonPulsado())
                {
                    if (bordeDesde == DateTime.MaxValue) bordeDesde = ahora;
                    else if ((ahora - bordeDesde).TotalMilliseconds >= EsperaAsomar) AsomarBarra();
                }
                else bordeDesde = DateTime.MaxValue;
            }
            else
            {
                if (ZonaDeLaBarra().Contains(p.X, p.Y) || BotonPulsado()) fueraDesde = DateTime.MaxValue;
                else if (fueraDesde == DateTime.MaxValue) fueraDesde = ahora;
                else if ((ahora - fueraDesde).TotalMilliseconds >= EsperaEsconder) EsconderBarra();
            }
        }

        /// <summary>Una ventana maximizada (visible, de este monitor) o la ventana activa ocupando todo el monitor.</summary>
        private static bool HayVentanaQueTapa(Monitor mon)
        {
            IntPtr fg = Nativo.GetForegroundWindow();
            var a = mon.Area;
            bool hay = false;
            Nativo.EnumWindows((h, l) =>
            {
                if (!Nativo.IsWindowVisible(h) || Nativo.IsIconic(h)) return true;
                uint pid;
                Nativo.GetWindowThreadProcessId(h, out pid);
                if (pid == pidPropio) return true;
                if ((Nativo.EstiloEx(h) & Nativo.WS_EX_TRANSPARENT) != 0) return true;
                string clase = Nativo.Clase(h);
                if (clase == "Progman" || clase == "WorkerW" || clase == "Shell_TrayWnd" || clase == "Shell_SecondaryTrayWnd") return true;
                if (Nativo.Oculta(h)) return true;  // otras ventanas de escritorios virtuales, apps suspendidas
                var r = Nativo.Marco(h);
                if (r.Ancho <= 0 || r.Alto <= 0) return true;
                if (!a.Contains((r.Left + r.Right) / 2, (r.Top + r.Bottom) / 2)) return true;
                if (Nativo.IsZoomed(h)) { hay = true; return false; }
                if (h == fg && r.Left <= a.Left && r.Top <= a.Top && r.Right >= a.Right && r.Bottom >= a.Bottom) { hay = true; return false; }
                return true;
            }, IntPtr.Zero);
            return hay;
        }

        private bool EnBordeDeLaBarra(Nativo.POINT p)
        {
            var a = monitorBarra.Area;
            if (p.X < a.Left || p.X >= a.Right || p.Y < a.Top || p.Y >= a.Bottom) return false;
            uint borde = Borde();
            if (borde == Nativo.ABE_TOP) return p.Y < a.Top + BordeSensible;
            if (borde == Nativo.ABE_BOTTOM) return p.Y >= a.Bottom - BordeSensible;
            if (borde == Nativo.ABE_LEFT) return p.X < a.Left + BordeSensible;
            return p.X >= a.Right - BordeSensible;
        }

        /// <summary>La barra más el hueco hasta el borde de la pantalla (si es flotante) y un poco de holgura.</summary>
        private Rectangle ZonaDeLaBarra()
        {
            Nativo.RECT rr;
            Nativo.GetWindowRect(Barra.Handle, out rr);
            var r = rr.ARect();
            var a = monitorBarra.Area;
            uint borde = Borde();
            if (borde == Nativo.ABE_TOP) r = Rectangle.FromLTRB(r.Left, a.Top, r.Right, r.Bottom);
            else if (borde == Nativo.ABE_BOTTOM) r = Rectangle.FromLTRB(r.Left, r.Top, r.Right, a.Bottom);
            else if (borde == Nativo.ABE_LEFT) r = Rectangle.FromLTRB(a.Left, r.Top, r.Right, r.Bottom);
            else r = Rectangle.FromLTRB(r.Left, r.Top, a.Right, r.Bottom);
            int holgura = (int)Math.Round(10 * monitorBarra.Escala);
            r.Inflate(holgura, holgura);
            return r;
        }

        private static bool CursorVisible()
        {
            var ci = new Nativo.CURSORINFO { cbSize = System.Runtime.InteropServices.Marshal.SizeOf(typeof(Nativo.CURSORINFO)) };
            // Juegos y videos esconden el cursor: así la barra no sale sola mientras juegas.
            return !Nativo.GetCursorInfo(ref ci) || (ci.flags & Nativo.CURSOR_SHOWING) != 0;
        }

        private static bool BotonPulsado()
        {
            return (Nativo.GetAsyncKeyState(0x01) & 0x8000) != 0 || (Nativo.GetAsyncKeyState(0x02) & 0x8000) != 0;
        }

        /// <summary>La página anima la salida y después se oculta la ventana (así no estorba a los clics).</summary>
        private void EsconderBarra()
        {
            if (Barra == null) return;
            barraEscondida = true;
            barraAsomada = false;
            bordeDesde = fueraDesde = DateTime.MaxValue;
            Barra.Enviar("barraVisible", Json.Nuevo("visible", false));
            int gen = ++generacionAnimacion;
            var t = new Timer { Interval = 190 };
            t.Tick += (o, e) =>
            {
                t.Stop();
                t.Dispose();
                if (gen == generacionAnimacion && barraEscondida && Barra != null) Nativo.ShowWindow(Barra.Handle, Nativo.SW_HIDE);
            };
            t.Start();
        }

        private void AsomarBarra()
        {
            barraAsomada = true;
            MostrarVentanaBarra();
        }

        private void MostrarBarraFija()
        {
            barraAsomada = false;
            MostrarVentanaBarra();
        }

        private void MostrarVentanaBarra()
        {
            if (Barra == null) return;
            barraEscondida = false;
            generacionAnimacion++;
            bordeDesde = fueraDesde = DateTime.MaxValue;
            Nativo.SetWindowPos(Barra.Handle, Nativo.HWND_TOPMOST, 0, 0, 0, 0,
                Nativo.SWP_NOMOVE | Nativo.SWP_NOSIZE | Nativo.SWP_NOACTIVATE | Nativo.SWP_SHOWWINDOW);
            Barra.Enviar("barraVisible", Json.Nuevo("visible", true));
        }
    }
}

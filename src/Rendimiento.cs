using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;

namespace Lienzo
{
    /// <summary>
    /// Ahorro de recursos: el fondo se pausa cuando nadie lo ve (ventanas que lo tapan, juego a pantalla completa,
    /// pantalla bloqueada o apagada) y baja el ritmo con batería.
    /// </summary>
    internal partial class App
    {
        private Timer relojRendimiento, relojMouse;
        private bool sesionBloqueada, pantallaApagada, pausaManual;
        private readonly Dictionary<Superficie, string> estadoFondo = new Dictionary<Superficie, string>();
        private readonly Dictionary<Superficie, DateTime> tapadoDesde = new Dictionary<Superficie, DateTime>();
        private static readonly uint pidPropio = (uint)Process.GetCurrentProcess().Id;
        private Nativo.POINT ultimoMouse;

        private void IniciarRendimiento()
        {
            Nativo.WTSRegisterSessionNotification(Mensajes.Handle, 0);
            var g = Nativo.GUID_CONSOLE_DISPLAY_STATE;
            Nativo.RegisterPowerSettingNotification(Mensajes.Handle, ref g, 0);
            Mensajes.Recibido += AlAvisoDeEnergia;

            relojRendimiento = new Timer { Interval = 1000 };
            relojRendimiento.Tick += (o, e) => RevisarRendimiento();
            relojRendimiento.Start();

            relojMouse = new Timer { Interval = 33 };
            relojMouse.Tick += (o, e) => EnviarMouse();
            ActualizarRelojMouse();
        }

        private void AlAvisoDeEnergia(Message m)
        {
            if (m.Msg == Nativo.WM_WTSSESSION_CHANGE)
            {
                int ev = m.WParam.ToInt32();
                if (ev == Nativo.WTS_SESSION_LOCK) sesionBloqueada = true;
                else if (ev == Nativo.WTS_SESSION_UNLOCK) sesionBloqueada = false;
                RevisarRendimiento();
            }
            else if (m.Msg == Nativo.WM_POWERBROADCAST && m.WParam.ToInt32() == Nativo.PBT_POWERSETTINGCHANGE && m.LParam != IntPtr.Zero)
            {
                var s = (Nativo.POWERBROADCAST_SETTING)Marshal.PtrToStructure(m.LParam, typeof(Nativo.POWERBROADCAST_SETTING));
                if (s.PowerSetting == Nativo.GUID_CONSOLE_DISPLAY_STATE)
                {
                    pantallaApagada = s.Data == 0;
                    RevisarRendimiento();
                }
            }
        }

        public void PausaManual(bool pausar)
        {
            pausaManual = pausar;
            RevisarRendimiento();
        }

        public bool EnPausaManual { get { return pausaManual; } }

        private void RevisarRendimiento()
        {
            if (Saliendo) return;
            BarraWindows.Vigilar();
            if (Fondos.Count == 0) return;

            Nativo.SYSTEM_POWER_STATUS p;
            bool bateria = Nativo.GetSystemPowerStatus(out p) && (p.ACLineStatus == 0 || p.SystemStatusFlag == 1);
            string modoBateria = Cfg("rendimiento.bateria", "reducir");
            int estadoNotif;
            bool notifPantallaCompleta = Nativo.SHQueryUserNotificationState(out estadoNotif) == 0 &&
                (estadoNotif == Nativo.QUNS_RUNNING_D3D_FULL_SCREEN || estadoNotif == Nativo.QUNS_PRESENTATION_MODE || estadoNotif == Nativo.QUNS_BUSY);

            foreach (var f in Fondos)
            {
                var mon = (Monitor)f.Etiqueta;
                string motivo = null;
                bool reducir = false;
                if (pausaManual) motivo = "manual";
                else if (sesionBloqueada) motivo = "bloqueo";
                else if (pantallaApagada) motivo = "pantalla";
                else
                {
                    bool completa;
                    double visible = FraccionVisible(mon.Area, out completa);
                    if (mon.Principal && notifPantallaCompleta) completa = true;
                    if (completa && CfgBool("rendimiento.pausarPantallaCompleta", true)) motivo = "pantalla-completa";
                    else if (visible < 0.12 && CfgBool("rendimiento.pausarMaximizada", true)) motivo = "tapado";
                    else if (bateria && modoBateria == "pausar") motivo = "bateria";
                    else if (bateria && modoBateria == "reducir") reducir = true;
                }

                string estado = motivo != null ? "pausa:" + motivo : reducir ? "reducido" : "activo";
                string anterior;
                estadoFondo.TryGetValue(f, out anterior);
                if (estado != anterior)
                {
                    estadoFondo[f] = estado;
                    Registro("Fondo " + mon.Nombre + ": " + estado);
                    f.Enviar("pausa", Json.Nuevo("pausado", motivo != null, "motivo", motivo ?? "", "reducido", reducir));
                    try
                    {
                        if (f.Web != null)
                            f.Web.MemoryUsageTargetLevel = motivo != null ? CoreWebView2MemoryUsageTargetLevel.Low : CoreWebView2MemoryUsageTargetLevel.Normal;
                    }
                    catch { }
                    if (motivo == null)
                    {
                        tapadoDesde.Remove(f);
                        if (!f.Visible) f.Visible = true;
                        // Mientras estaba en pausa no se le mandaban datos: ponerlo al día (música, sistema).
                        if (anterior != null && anterior.StartsWith("pausa")) EnviarInicial(f);
                    }
                    else if (!tapadoDesde.ContainsKey(f)) tapadoDesde[f] = DateTime.Now;
                    ActualizarRelojMouse();
                    ActualizarToques();
                }

                // Si lleva un rato tapado del todo, se suspende el WebView (libera CPU y memoria por completo).
                DateTime desde;
                if (motivo != null && motivo != "manual" && motivo != "bateria" && CfgBool("rendimiento.suspender", true) &&
                    tapadoDesde.TryGetValue(f, out desde) && (DateTime.Now - desde).TotalSeconds > 20 && f.Visible)
                {
                    SuspenderFondo(f);
                }
            }
        }

        private async void SuspenderFondo(Superficie f)
        {
            try
            {
                f.Visible = false;
                if (f.Web != null) await f.Web.TrySuspendAsync();
            }
            catch (Exception ex) { Registro("Suspender: " + ex.Message); }
        }

        public string EstadoDe(Superficie f)
        {
            string e;
            return estadoFondo.TryGetValue(f, out e) ? e : "activo";
        }

        /// <summary>Fracción del monitor donde se ve el escritorio (0 = tapado del todo). También detecta pantalla completa.</summary>
        private static double FraccionVisible(Rectangle mon, out bool pantallaCompleta)
        {
            bool completa = false;
            IntPtr fg = Nativo.GetForegroundWindow();
            IntPtr rgn = Nativo.CreateRectRgn(mon.Left, mon.Top, mon.Right, mon.Bottom);
            bool vacia = false;
            Nativo.EnumWindows((h, l) =>
            {
                if (!Nativo.IsWindowVisible(h) || Nativo.IsIconic(h)) return true;
                uint pid;
                Nativo.GetWindowThreadProcessId(h, out pid);
                if (pid == pidPropio) return true;
                long ex = Nativo.EstiloEx(h);
                if ((ex & Nativo.WS_EX_TRANSPARENT) != 0) return true; // capas que dejan pasar el ratón (overlays)
                string clase = Nativo.Clase(h);
                if (clase == "Progman" || clase == "WorkerW" || clase == "Shell_TrayWnd" || clase == "Shell_SecondaryTrayWnd") return true;
                if (Nativo.Oculta(h)) return true;
                var r = Nativo.Marco(h);
                if (r.Ancho <= 0 || r.Alto <= 0) return true;
                if (r.Right <= mon.Left || r.Left >= mon.Right || r.Bottom <= mon.Top || r.Top >= mon.Bottom) return true;
                if (h == fg && r.Left <= mon.Left && r.Top <= mon.Top && r.Right >= mon.Right && r.Bottom >= mon.Bottom) completa = true;
                IntPtr wr = Nativo.CreateRectRgn(r.Left, r.Top, r.Right, r.Bottom);
                int res = Nativo.CombineRgn(rgn, rgn, wr, Nativo.RGN_DIFF);
                Nativo.DeleteObject(wr);
                if (res == Nativo.NULLREGION) { vacia = true; return false; }
                return true;
            }, IntPtr.Zero);
            double area = vacia ? 0 : AreaRegion(rgn);
            Nativo.DeleteObject(rgn);
            pantallaCompleta = completa;
            return area / Math.Max(1.0, (double)mon.Width * mon.Height);
        }

        private static double AreaRegion(IntPtr rgn)
        {
            uint tam = Nativo.GetRegionData(rgn, 0, IntPtr.Zero);
            if (tam == 0) return 0;
            IntPtr buf = Marshal.AllocHGlobal((int)tam);
            try
            {
                if (Nativo.GetRegionData(rgn, tam, buf) == 0) return 0;
                int n = Marshal.ReadInt32(buf, 8);
                double area = 0;
                for (int i = 0; i < n; i++)
                {
                    IntPtr q = IntPtr.Add(buf, 32 + i * 16);
                    area += (double)(Marshal.ReadInt32(q, 8) - Marshal.ReadInt32(q, 0)) * (Marshal.ReadInt32(q, 12) - Marshal.ReadInt32(q, 4));
                }
                return area;
            }
            finally { Marshal.FreeHGlobal(buf); }
        }

        // ---- Posición del ratón para el parallax y las escenas interactivas (solo si hace falta) ----

        private void ActualizarRelojMouse()
        {
            if (relojMouse == null) return;
            // También con widgets tocables: así la página resalta el botón que tiene el ratón encima.
            bool hace = Fondos.Count > 0 && (CfgNum("fondo.efectos.parallax", 0) > 0 || Cfg("fondo.escena", "") == "constelacion" || HayBloquesTocables());
            bool algunoActivo = false;
            foreach (var f in Fondos) if (!EstadoDe(f).StartsWith("pausa")) algunoActivo = true;
            relojMouse.Enabled = hace && algunoActivo;
        }

        private void EnviarMouse()
        {
            Nativo.POINT p;
            if (!Nativo.GetCursorPos(out p) || (p.X == ultimoMouse.X && p.Y == ultimoMouse.Y)) return;
            ultimoMouse = p;
            foreach (var f in Fondos)
            {
                var a = ((Monitor)f.Etiqueta).Area;
                if (EstadoDe(f).StartsWith("pausa")) continue;
                double x = (p.X - a.Left) / (double)a.Width, y = (p.Y - a.Top) / (double)a.Height;
                f.EnviarCrudo("{\"tipo\":\"mouse\",\"x\":" + x.ToString("0.0000", System.Globalization.CultureInfo.InvariantCulture) +
                    ",\"y\":" + y.ToString("0.0000", System.Globalization.CultureInfo.InvariantCulture) + "}");
            }
        }
    }
}

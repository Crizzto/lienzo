using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Runtime.InteropServices;
using System.Threading;

namespace Lienzo
{
    /// <summary>
    /// Toques en los widgets del escritorio. Los bloques viven detrás de los iconos, así que Windows nunca les manda
    /// el ratón. Mientras haya bloques con botones (apps, clima, WhatsApp, música con controles) se escucha el ratón
    /// con un gancho de bajo nivel en un hilo propio: si un clic corto cae en el escritorio (no en una ventana),
    /// se avisa a la página del fondo de ese monitor con la posición. El clic NO se bloquea ni se cambia.
    /// </summary>
    internal partial class App
    {
        private static readonly HashSet<string> TiposTocables = new HashSet<string> { "app", "atajos", "clima", "whatsapp" };

        private Thread hiloToques;
        private uint idHiloToques;
        private IntPtr gancho;
        private G.LowLevelMouseProc procGancho;   // referencia viva para que el recolector no la libere
        private Nativo.POINT toqueInicio;
        private uint toqueTiempo;
        private bool toqueEnEscritorio;

        private bool HayBloquesTocables()
        {
            var lista = Json.Lista(Config, "bloques");
            if (lista == null) return false;
            foreach (var b in lista.OfType<Dictionary<string, object>>())
            {
                string tipo = Json.Texto(b, "tipo", "");
                if (TiposTocables.Contains(tipo)) return true;
                if (tipo == "musica" && Json.Bool(b, "opciones.controles", false)) return true;
            }
            return false;
        }

        /// <summary>Enciende o apaga la escucha según haya (o no) bloques que se puedan tocar.</summary>
        private void ActualizarToques()
        {
            // Con un juego o video en pantalla completa no se escucha nada (ni un microsegundo de más en cada movimiento).
            bool algunoVisible = Fondos.Any(f => EstadoDe(f) != "pausa:pantalla-completa");
            bool hace = !Saliendo && algunoVisible && HayBloquesTocables();
            if (hace && hiloToques == null) EncenderToques();
            else if (!hace && hiloToques != null) ApagarToques();
        }

        private void EncenderToques()
        {
            var listo = new ManualResetEvent(false);
            hiloToques = new Thread(() =>
            {
                idHiloToques = G.GetCurrentThreadId();
                procGancho = AlGanchoRaton;
                gancho = G.SetWindowsHookEx(G.WH_MOUSE_LL, procGancho, G.GetModuleHandle(null), 0);
                int error = Marshal.GetLastWin32Error();
                listo.Set();
                if (gancho == IntPtr.Zero) { Registro("No pude escuchar los clics del escritorio (error " + error + ")."); return; }
                G.MSG msg;
                while (G.GetMessage(out msg, IntPtr.Zero, 0, 0) > 0) { }
                G.UnhookWindowsHookEx(gancho);
                gancho = IntPtr.Zero;
            }) { IsBackground = true, Name = "Toques" };
            hiloToques.Start();
            listo.WaitOne(2000);
        }

        private void ApagarToques()
        {
            if (hiloToques == null) return;
            if (idHiloToques != 0) G.PostThreadMessage(idHiloToques, G.WM_QUIT, IntPtr.Zero, IntPtr.Zero);
            hiloToques = null;
            idHiloToques = 0;
        }

        // Corre en el hilo "Toques": tiene que ser rapidísimo para no frenar el ratón de todo Windows.
        private IntPtr AlGanchoRaton(int codigo, IntPtr w, IntPtr l)
        {
            try
            {
                int msg = w.ToInt32();
                if (codigo >= 0 && (msg == G.WM_LBUTTONDOWN || msg == G.WM_LBUTTONUP))
                {
                    var d = (G.MSLLHOOKSTRUCT)Marshal.PtrToStructure(l, typeof(G.MSLLHOOKSTRUCT));
                    if (msg == G.WM_LBUTTONDOWN)
                    {
                        toqueInicio = d.pt;
                        toqueTiempo = d.time;
                        toqueEnEscritorio = EsEscritorio(d.pt);
                    }
                    else if (toqueEnEscritorio)
                    {
                        toqueEnEscritorio = false;
                        // Solo clics cortos y quietos: arrastrar (seleccionar iconos) no cuenta.
                        if (Math.Abs(d.pt.X - toqueInicio.X) <= 6 && Math.Abs(d.pt.Y - toqueInicio.Y) <= 6 && unchecked(d.time - toqueTiempo) < 800)
                        {
                            var p = d.pt;
                            EnUi(() => Tocar(p));
                        }
                    }
                }
            }
            catch { }
            return G.CallNextHookEx(IntPtr.Zero, codigo, w, l);
        }

        /// <summary>¿El punto cae en el escritorio (iconos o fondo) y no en una ventana, la barra o un menú?</summary>
        private static bool EsEscritorio(Nativo.POINT p)
        {
            IntPtr h = G.WindowFromPoint(p);
            if (h == IntPtr.Zero) return false;
            string clase = Nativo.Clase(Nativo.GetAncestor(h, Nativo.GA_ROOT));
            return clase == "Progman" || clase == "WorkerW";
        }

        private void Tocar(Nativo.POINT p)
        {
            foreach (var f in Fondos)
            {
                var a = ((Monitor)f.Etiqueta).Area;
                if (!a.Contains(p.X, p.Y)) continue;
                double x = (p.X - a.Left) / (double)a.Width, y = (p.Y - a.Top) / (double)a.Height;
                f.EnviarCrudo("{\"tipo\":\"toque\",\"x\":" + x.ToString("0.0000", CultureInfo.InvariantCulture) +
                    ",\"y\":" + y.ToString("0.0000", CultureInfo.InvariantCulture) + "}");
            }
        }

        private static class G
        {
            public const int WH_MOUSE_LL = 14, WM_LBUTTONDOWN = 0x201, WM_LBUTTONUP = 0x202;
            public const uint WM_QUIT = 0x12;

            public delegate IntPtr LowLevelMouseProc(int codigo, IntPtr w, IntPtr l);

            [StructLayout(LayoutKind.Sequential)]
            public struct MSLLHOOKSTRUCT { public Nativo.POINT pt; public uint mouseData, flags, time; public IntPtr extra; }

            [StructLayout(LayoutKind.Sequential)]
            public struct MSG { public IntPtr hwnd; public uint message; public IntPtr wParam, lParam; public uint time; public Nativo.POINT pt; }

            [DllImport("user32.dll", SetLastError = true)] public static extern IntPtr SetWindowsHookEx(int id, LowLevelMouseProc fn, IntPtr mod, uint hilo);
            [DllImport("user32.dll")] public static extern bool UnhookWindowsHookEx(IntPtr h);
            [DllImport("user32.dll")] public static extern IntPtr CallNextHookEx(IntPtr h, int codigo, IntPtr w, IntPtr l);
            [DllImport("user32.dll")] public static extern int GetMessage(out MSG m, IntPtr h, uint min, uint max);
            [DllImport("user32.dll")] public static extern bool PostThreadMessage(uint hilo, uint msg, IntPtr w, IntPtr l);
            [DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(Nativo.POINT p);
            [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] public static extern IntPtr GetModuleHandle(string nombre);
            [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
        }
    }
}

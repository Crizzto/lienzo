using System;
using System.Collections.Generic;
using System.Drawing;
using System.Threading;

namespace Lienzo
{
    /// <summary>Un monitor físico (coordenadas en píxeles reales, el proceso es PerMonitorV2).</summary>
    internal class Monitor
    {
        public IntPtr Handle;
        public Rectangle Area;        // todo el monitor
        public Rectangle Trabajo;     // sin barras de tareas / AppBars
        public bool Principal;
        public string Nombre;
        public uint Dpi;
        public double Escala { get { return Dpi / 96.0; } }

        public static List<Monitor> Todos()
        {
            var lista = new List<Monitor>();
            Nativo.EnumDisplayMonitors(IntPtr.Zero, IntPtr.Zero, (IntPtr h, IntPtr dc, ref Nativo.RECT r, IntPtr d) =>
            {
                var mi = new Nativo.MONITORINFOEX();
                mi.cbSize = System.Runtime.InteropServices.Marshal.SizeOf(typeof(Nativo.MONITORINFOEX));
                if (Nativo.GetMonitorInfo(h, ref mi))
                {
                    lista.Add(new Monitor
                    {
                        Handle = h,
                        Area = mi.rcMonitor.ARect(),
                        Trabajo = mi.rcWork.ARect(),
                        Principal = (mi.dwFlags & 1) != 0,
                        Nombre = mi.szDevice,
                        Dpi = Nativo.Dpi(h)
                    });
                }
                return true;
            }, IntPtr.Zero);
            lista.Sort((a, b) => b.Principal.CompareTo(a.Principal));
            return lista;
        }

        public static Monitor Principal_()
        {
            var t = Todos();
            return t.Count > 0 ? t[0] : null;
        }
    }

    /// <summary>
    /// Coloca ventanas detrás de los iconos del escritorio.
    /// - Clásico (Windows 10/11 hasta 23H2): un WorkerW de primer nivel detrás del que tiene los iconos.
    /// - "Raised desktop" (Windows 11 24H2+): SHELLDLL_DefView y WorkerW son hijos de Progman, que no tiene superficie
    ///   propia; nuestra ventana debe ser "layered" (alfa 255 antes de SetParent) e ir entre los iconos y el WorkerW.
    /// </summary>
    internal static class Escritorio
    {
        public static IntPtr Progman, WorkerW, DefView;
        public static bool Elevado;
        private const uint GW_CHILD = 5;

        public static bool Preparar()
        {
            Progman = Nativo.FindWindow("Progman", null);
            if (Progman == IntPtr.Zero) { App.Registro("No encontré Progman."); return false; }
            if (!Buscar())
            {
                // Pide a Explorer que separe la capa del fondo de la de los iconos. Se envía UNA vez:
                // repetirlo con otros parámetros puede destruir la capa recién creada.
                IntPtr r;
                Nativo.SendMessageTimeout(Progman, 0x052C, new IntPtr(0xD), new IntPtr(1), Nativo.SMTO_NORMAL, 1000, out r);
                for (int i = 0; i < 20 && !Buscar(); i++) Thread.Sleep(100);
                if (WorkerW == IntPtr.Zero && !Elevado)
                {
                    // Windows antiguos: la variante clásica.
                    Nativo.SendMessageTimeout(Progman, 0x052C, IntPtr.Zero, IntPtr.Zero, Nativo.SMTO_NORMAL, 1000, out r);
                    for (int i = 0; i < 10 && !Buscar(); i++) Thread.Sleep(100);
                }
            }
            App.Registro("Escritorio: " + (Elevado ? "24H2+ (raised)" : "clásico") +
                " progman=" + Progman.ToString("X") + " workerw=" + WorkerW.ToString("X") + " defview=" + DefView.ToString("X"));
            return WorkerW != IntPtr.Zero;
        }

        private static bool Buscar()
        {
            Elevado = (Nativo.EstiloEx(Progman) & Nativo.WS_EX_NOREDIRECTIONBITMAP) != 0;
            IntPtr dv = Nativo.FindWindowEx(Progman, IntPtr.Zero, "SHELLDLL_DefView", null);
            IntPtr ww = Nativo.FindWindowEx(Progman, IntPtr.Zero, "WorkerW", null);
            if (dv != IntPtr.Zero && ww != IntPtr.Zero)
            {
                Elevado = true; DefView = dv; WorkerW = ww;
                return true;
            }
            if (Elevado) { DefView = dv; WorkerW = IntPtr.Zero; return false; }

            IntPtr dvClasico = IntPtr.Zero, wwClasico = IntPtr.Zero;
            Nativo.EnumWindows((h, l) =>
            {
                IntPtr d = Nativo.FindWindowEx(h, IntPtr.Zero, "SHELLDLL_DefView", null);
                if (d != IntPtr.Zero && Nativo.Clase(h) == "WorkerW")
                {
                    dvClasico = d;
                    wwClasico = Nativo.FindWindowEx(IntPtr.Zero, h, "WorkerW", null);
                    return false;
                }
                return true;
            }, IntPtr.Zero);
            DefView = dvClasico != IntPtr.Zero ? dvClasico : dv;
            WorkerW = wwClasico;
            return WorkerW != IntPtr.Zero;
        }

        public static bool Adjuntar(IntPtr hwnd, Rectangle pantalla)
        {
            if (WorkerW == IntPtr.Zero || !Nativo.IsWindow(WorkerW) || !Nativo.IsWindow(Progman))
                if (!Preparar()) return false;
            IntPtr padre = Elevado ? Progman : WorkerW;

            // 1) "layered" con alfa 255 ANTES de SetParent: en 24H2+ una hija normal de Progman nunca se compone.
            Nativo.PonerEstiloEx(hwnd, Nativo.EstiloEx(hwnd) | Nativo.WS_EX_LAYERED | Nativo.WS_EX_NOACTIVATE | Nativo.WS_EX_TOOLWINDOW);
            Nativo.SetLayeredWindowAttributes(hwnd, 0, 255, 2 /* LWA_ALPHA */);
            // 2) Cambiar de padre y convertirla en ventana hija.
            Nativo.SetParent(hwnd, padre);
            Nativo.PonerEstilo(hwnd, (Nativo.Estilo(hwnd) & ~Nativo.WS_POPUP) | Nativo.WS_CHILD | Nativo.WS_CLIPSIBLINGS | Nativo.WS_CLIPCHILDREN);
            // 3) Posición y orden: iconos → nuestro fondo → WorkerW del sistema.
            Colocar(hwnd, pantalla);
            Nativo.ShowWindow(hwnd, Nativo.SW_SHOWNA);
            bool ok = Nativo.GetParent(hwnd) == padre;
            if (!ok) App.Registro("SetParent falló: " + System.Runtime.InteropServices.Marshal.GetLastWin32Error());
            return ok;
        }

        public static void Colocar(IntPtr hwnd, Rectangle pantalla)
        {
            IntPtr padre = Nativo.GetParent(hwnd);
            var p = new Nativo.POINT(pantalla.X, pantalla.Y);
            Nativo.ScreenToClient(padre, ref p);
            if (Elevado)
            {
                Nativo.SetWindowPos(hwnd, DefView, p.X, p.Y, pantalla.Width, pantalla.Height, Nativo.SWP_NOACTIVATE | Nativo.SWP_FRAMECHANGED);
                Nativo.SetWindowPos(WorkerW, Nativo.HWND_BOTTOM, 0, 0, 0, 0, Nativo.SWP_NOMOVE | Nativo.SWP_NOSIZE | Nativo.SWP_NOACTIVATE);
            }
            else
            {
                Nativo.SetWindowPos(hwnd, IntPtr.Zero, p.X, p.Y, pantalla.Width, pantalla.Height,
                    Nativo.SWP_NOZORDER | Nativo.SWP_NOACTIVATE | Nativo.SWP_FRAMECHANGED);
            }
        }

        /// <summary>false si la ventana ya no está colgada del escritorio (Explorer se reinició) y hay que recrearla.</summary>
        public static bool Verificar(IntPtr hwnd, Rectangle pantalla)
        {
            if (hwnd == IntPtr.Zero || !Nativo.IsWindow(hwnd) || !Nativo.IsWindow(Progman)) return false;
            IntPtr padre = Nativo.GetParent(hwnd);
            if (Elevado)
            {
                if (padre != Progman) return false;
                if (!Nativo.IsWindow(WorkerW) || !Nativo.IsWindow(DefView)) Buscar();
                bool iconosArriba = Nativo.GetWindow(Progman, GW_CHILD) == DefView;
                bool fondoAbajo = WorkerW == IntPtr.Zero || Nativo.GetWindow(WorkerW, Nativo.GW_HWNDNEXT) == IntPtr.Zero;
                if (!iconosArriba || !fondoAbajo) Colocar(hwnd, pantalla);
                return true;
            }
            return padre == WorkerW && Nativo.IsWindow(WorkerW);
        }

        /// <summary>La lista de iconos del escritorio (SysListView32), para mostrarla u ocultarla.</summary>
        public static IntPtr ListaIconos()
        {
            if (DefView == IntPtr.Zero || !Nativo.IsWindow(DefView)) Preparar();
            return DefView == IntPtr.Zero ? IntPtr.Zero : Nativo.FindWindowEx(DefView, IntPtr.Zero, "SysListView32", null);
        }
    }
}

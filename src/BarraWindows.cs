using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;

namespace Lienzo
{
    /// <summary>
    /// La barra de tareas nativa de Windows: dejarla como está, en auto-ocultar u ocultarla del todo.
    /// Todo lo que cambiamos se apunta en estado-barra.json para poder deshacerlo aunque Lienzo se cierre mal.
    /// </summary>
    internal static class BarraWindows
    {
        private static bool oculta, cambiamosAuto, autoOriginal;
        private static DateTime pausaVigilancia = DateTime.MinValue;
        private static IntPtr gancho;
        private static uint pidGancho;
        private static Nativo.WinEventProc alEvento; // referencia viva: si el recolector se lo lleva, Windows llamaría a la nada

        private static string RutaEstado
        {
            get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Lienzo", "estado-barra.json"); }
        }

        public static IntPtr Principal { get { return Nativo.FindWindow("Shell_TrayWnd", null); } }

        public static List<IntPtr> Ventanas()
        {
            var l = new List<IntPtr>();
            IntPtr p = Principal;
            if (p != IntPtr.Zero) l.Add(p);
            IntPtr s = IntPtr.Zero;
            while ((s = Nativo.FindWindowEx(IntPtr.Zero, s, "Shell_SecondaryTrayWnd", null)) != IntPtr.Zero) l.Add(s);
            return l;
        }

        private static Nativo.APPBARDATA Datos()
        {
            return new Nativo.APPBARDATA { cbSize = Marshal.SizeOf(typeof(Nativo.APPBARDATA)), hWnd = Principal };
        }

        public static bool EnAutoOcultar()
        {
            var d = Datos();
            return ((int)Nativo.SHAppBarMessage(Nativo.ABM_GETSTATE, ref d).ToUInt32() & Nativo.ABS_AUTOHIDE) != 0;
        }

        private static void PonerAutoOcultar(bool auto)
        {
            var d = Datos();
            int actual = (int)Nativo.SHAppBarMessage(Nativo.ABM_GETSTATE, ref d).ToUInt32();
            int nuevo = (actual & ~Nativo.ABS_AUTOHIDE) | (auto ? Nativo.ABS_AUTOHIDE : 0);
            d = Datos();
            d.lParam = new IntPtr(nuevo);
            Nativo.SHAppBarMessage(Nativo.ABM_SETSTATE, ref d);
        }

        /// <summary>modo: "nativa" (no tocar), "auto" (auto-ocultar) u "oculta" (ocultarla del todo).</summary>
        public static void Aplicar(string modo)
        {
            if (Principal == IntPtr.Zero) return;
            if (modo == "oculta" || modo == "auto")
            {
                if (!EnAutoOcultar())
                {
                    if (!cambiamosAuto) { autoOriginal = false; cambiamosAuto = true; }
                    PonerAutoOcultar(true);
                }
                if (modo == "oculta")
                {
                    oculta = true;
                    foreach (var h in Ventanas()) Nativo.ShowWindow(h, Nativo.SW_HIDE);
                    Enganchar();
                }
                else Mostrar();
            }
            else
            {
                Mostrar();
                if (cambiamosAuto) { PonerAutoOcultar(autoOriginal); cambiamosAuto = false; }
            }
            GuardarEstado();
        }

        private static void Mostrar()
        {
            oculta = false;
            Desenganchar();
            foreach (var h in Ventanas()) if (!Nativo.IsWindowVisible(h)) Nativo.ShowWindow(h, Nativo.SW_SHOWNA);
        }

        /// <summary>
        /// Oculta "de verdad": Windows vuelve a mostrar su barra con la tecla Win, Win+T, Win+número, notificaciones…
        /// Un gancho de eventos (sin inyectar nada en Explorer) avisa en cuanto una de sus barras se muestra y se vuelve
        /// a esconder al instante, sin que llegue a verse. Vigilar() queda de respaldo cada segundo.
        /// </summary>
        private static void Enganchar()
        {
            uint pid;
            Nativo.GetWindowThreadProcessId(Principal, out pid);
            if (pid == 0 || (gancho != IntPtr.Zero && pid == pidGancho)) return;
            Desenganchar();
            if (alEvento == null) alEvento = AlMostrarseAlgo;
            gancho = Nativo.SetWinEventHook(Nativo.EVENT_OBJECT_SHOW, Nativo.EVENT_OBJECT_SHOW, IntPtr.Zero, alEvento, pid, 0, Nativo.WINEVENT_OUTOFCONTEXT);
            pidGancho = gancho != IntPtr.Zero ? pid : 0;
        }

        private static void Desenganchar()
        {
            if (gancho != IntPtr.Zero) Nativo.UnhookWinEvent(gancho);
            gancho = IntPtr.Zero;
            pidGancho = 0;
        }

        private static void AlMostrarseAlgo(IntPtr g, uint evento, IntPtr h, int objeto, int hijo, uint hilo, uint tiempo)
        {
            if (objeto != 0 /* OBJID_WINDOW */ || !oculta || DateTime.Now < pausaVigilancia) return;
            string clase = Nativo.Clase(h);
            if (clase == "Shell_TrayWnd" || clase == "Shell_SecondaryTrayWnd") Nativo.ShowWindow(h, Nativo.SW_HIDE);
        }

        /// <summary>Windows a veces vuelve a mostrar su barra (al abrir Inicio, al reiniciar Explorer): se vuelve a ocultar.</summary>
        public static void Vigilar()
        {
            if (!oculta || DateTime.Now < pausaVigilancia) return;
            Enganchar(); // si Explorer se reinició, el gancho viejo ya no sirve
            foreach (var h in Ventanas()) if (Nativo.IsWindowVisible(h)) Nativo.ShowWindow(h, Nativo.SW_HIDE);
        }

        /// <summary>Muestra un momento la barra nativa con el foco en la bandeja (iconos de Discord, Steam, etc.).</summary>
        public static void MostrarBandeja()
        {
            pausaVigilancia = DateTime.Now.AddSeconds(10);
            foreach (var h in Ventanas()) Nativo.ShowWindow(h, Nativo.SW_SHOWNA);
            Nativo.Teclas(Nativo.VK_LWIN, 0x42 /* B */);
        }

        public static void Restaurar()
        {
            Mostrar();
            if (cambiamosAuto) { PonerAutoOcultar(autoOriginal); cambiamosAuto = false; }
            try { File.Delete(RutaEstado); } catch { }
        }

        private static void GuardarEstado()
        {
            try
            {
                if (!oculta && !cambiamosAuto) { File.Delete(RutaEstado); return; }
                File.WriteAllText(RutaEstado, Json.Escribir(Json.Nuevo("oculta", oculta, "cambiamosAuto", cambiamosAuto, "autoOriginal", autoOriginal)));
            }
            catch { }
        }

        /// <summary>Lienzo.exe --restaurar (lo usa restaurar.cmd): deshace lo apuntado aunque Lienzo se haya cerrado mal.</summary>
        public static void RestaurarDeEmergencia()
        {
            try
            {
                if (File.Exists(RutaEstado))
                {
                    var e = Json.Objeto(File.ReadAllText(RutaEstado));
                    cambiamosAuto = Json.Bool(e, "cambiamosAuto", false);
                    autoOriginal = Json.Bool(e, "autoOriginal", false);
                }
            }
            catch { }
            Restaurar();
            Aspecto.RestaurarIconosDeEmergencia();
            // Si la barra sigue sin verse, reiniciar Explorer lo arregla todo.
            IntPtr p = Principal;
            if (p == IntPtr.Zero || !Nativo.IsWindowVisible(p))
            {
                foreach (var proc in Process.GetProcessesByName("explorer")) { try { proc.Kill(); } catch { } }
                System.Threading.Thread.Sleep(1500);
                if (Process.GetProcessesByName("explorer").Length == 0) Process.Start("explorer.exe");
            }
        }
    }
}

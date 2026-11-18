using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.NetworkInformation;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using Microsoft.Win32;

namespace Lienzo
{
    /// <summary>Datos del sistema para la barra y los bloques: CPU, RAM, batería, red, disco, volumen y la "ficha" estilo neofetch.</summary>
    internal static class Sistema
    {
        private static long inactivoAnt, nucleoAnt, usuarioAnt;
        private static long bajadaAnt = -1, subidaAnt = -1;
        private static DateTime redAnt = DateTime.MinValue;

        public static double Cpu()
        {
            long inactivo, nucleo, usuario;
            if (!Nativo.GetSystemTimes(out inactivo, out nucleo, out usuario)) return 0;
            long di = inactivo - inactivoAnt, dt = (nucleo - nucleoAnt) + (usuario - usuarioAnt);
            inactivoAnt = inactivo; nucleoAnt = nucleo; usuarioAnt = usuario;
            if (dt <= 0) return 0;
            return Math.Max(0, Math.Min(100, 100.0 * (dt - di) / dt));
        }

        public static Dictionary<string, object> Datos()
        {
            var d = new Dictionary<string, object>();
            d["cpu"] = Math.Round(Cpu(), 1);

            var m = new Nativo.MEMORYSTATUSEX { dwLength = (uint)Marshal.SizeOf(typeof(Nativo.MEMORYSTATUSEX)) };
            if (Nativo.GlobalMemoryStatusEx(ref m))
            {
                d["ram"] = (int)m.dwMemoryLoad;
                d["ramTotal"] = Math.Round(m.ullTotalPhys / 1073741824.0, 1);
                d["ramUsada"] = Math.Round((m.ullTotalPhys - m.ullAvailPhys) / 1073741824.0, 1);
            }

            Nativo.SYSTEM_POWER_STATUS p;
            if (Nativo.GetSystemPowerStatus(out p) && p.BatteryFlag != 128 && p.BatteryLifePercent <= 100)
            {
                d["bateria"] = (int)p.BatteryLifePercent;
                d["cargando"] = p.ACLineStatus == 1;
                d["ahorro"] = p.SystemStatusFlag == 1;
            }
            else d["bateria"] = -1;

            try
            {
                var c = new DriveInfo(Path.GetPathRoot(Environment.SystemDirectory));
                d["disco"] = (int)Math.Round(100.0 * (c.TotalSize - c.AvailableFreeSpace) / c.TotalSize);
                d["discoLibre"] = Math.Round(c.AvailableFreeSpace / 1073741824.0, 0);
            }
            catch { }

            Red(d);
            d["encendido"] = (long)(Nativo.GetTickCount64() / 1000);
            Volumen(d);
            return d;
        }

        private static void Red(Dictionary<string, object> d)
        {
            long bajada = 0, subida = 0;
            bool conectado = false;
            string wifi = null;
            try
            {
                foreach (var ni in NetworkInterface.GetAllNetworkInterfaces())
                {
                    if (ni.OperationalStatus != OperationalStatus.Up) continue;
                    if (ni.NetworkInterfaceType == NetworkInterfaceType.Loopback || ni.NetworkInterfaceType == NetworkInterfaceType.Tunnel) continue;
                    if (ni.Description.IndexOf("virtual", StringComparison.OrdinalIgnoreCase) >= 0 ||
                        ni.Description.IndexOf("vpn", StringComparison.OrdinalIgnoreCase) >= 0 ||
                        ni.Description.IndexOf("hyper-v", StringComparison.OrdinalIgnoreCase) >= 0) continue;
                    var s = ni.GetIPv4Statistics();
                    bajada += s.BytesReceived;
                    subida += s.BytesSent;
                    conectado = true;
                    if (ni.NetworkInterfaceType == NetworkInterfaceType.Wireless80211) wifi = "wifi";
                    else if (wifi == null) wifi = "cable";
                }
            }
            catch { }
            var ahora = DateTime.UtcNow;
            double seg = (ahora - redAnt).TotalSeconds;
            if (bajadaAnt >= 0 && seg > 0.2 && seg < 30)
            {
                d["bajada"] = Math.Max(0, (long)((bajada - bajadaAnt) / seg));
                d["subida"] = Math.Max(0, (long)((subida - subidaAnt) / seg));
            }
            else { d["bajada"] = 0; d["subida"] = 0; }
            bajadaAnt = bajada; subidaAnt = subida; redAnt = ahora;
            d["red"] = conectado ? (wifi ?? "cable") : "sin";
        }

        // ---------------- Volumen (Core Audio) ----------------

        [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
        private class MMDeviceEnumeratorCom { }

        [ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        private interface IMMDeviceEnumerator
        {
            [PreserveSig] int EnumAudioEndpoints(int flujo, int estado, out IntPtr dispositivos);
            [PreserveSig] int GetDefaultAudioEndpoint(int flujo, int rol, out IMMDevice dispositivo);
        }

        [ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        private interface IMMDevice
        {
            [PreserveSig] int Activate(ref Guid iid, int ctx, IntPtr parametros, [MarshalAs(UnmanagedType.IUnknown)] out object interfaz);
        }

        [ComImport, Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        private interface IAudioEndpointVolume
        {
            [PreserveSig] int RegisterControlChangeNotify(IntPtr n);
            [PreserveSig] int UnregisterControlChangeNotify(IntPtr n);
            [PreserveSig] int GetChannelCount(out uint n);
            [PreserveSig] int SetMasterVolumeLevel(float db, ref Guid ctx);
            [PreserveSig] int SetMasterVolumeLevelScalar(float nivel, ref Guid ctx);
            [PreserveSig] int GetMasterVolumeLevel(out float db);
            [PreserveSig] int GetMasterVolumeLevelScalar(out float nivel);
            [PreserveSig] int SetChannelVolumeLevel(uint c, float db, ref Guid ctx);
            [PreserveSig] int SetChannelVolumeLevelScalar(uint c, float nivel, ref Guid ctx);
            [PreserveSig] int GetChannelVolumeLevel(uint c, out float db);
            [PreserveSig] int GetChannelVolumeLevelScalar(uint c, out float nivel);
            [PreserveSig] int SetMute([MarshalAs(UnmanagedType.Bool)] bool silencio, ref Guid ctx);
            [PreserveSig] int GetMute([MarshalAs(UnmanagedType.Bool)] out bool silencio);
        }

        private static IMMDeviceEnumerator enumerador;

        private static IAudioEndpointVolume ControlVolumen()
        {
            try
            {
                if (enumerador == null) enumerador = (IMMDeviceEnumerator)new MMDeviceEnumeratorCom();
                IMMDevice disp;
                if (enumerador.GetDefaultAudioEndpoint(0 /* eRender */, 1 /* eMultimedia */, out disp) != 0 || disp == null) return null;
                var iid = typeof(IAudioEndpointVolume).GUID;
                object o;
                int hr = disp.Activate(ref iid, 23 /* CLSCTX_ALL */, IntPtr.Zero, out o);
                Marshal.ReleaseComObject(disp);
                return hr == 0 ? o as IAudioEndpointVolume : null;
            }
            catch { return null; }
        }

        private static void Volumen(Dictionary<string, object> d)
        {
            var v = ControlVolumen();
            if (v == null) { d["volumen"] = -1; return; }
            try
            {
                float nivel; bool mudo;
                v.GetMasterVolumeLevelScalar(out nivel);
                v.GetMute(out mudo);
                d["volumen"] = (int)Math.Round(nivel * 100);
                d["silencio"] = mudo;
            }
            finally { Marshal.ReleaseComObject(v); }
        }

        public static void CambiarVolumen(double? nivel, double? delta, bool alternarSilencio)
        {
            var v = ControlVolumen();
            if (v == null) return;
            try
            {
                var ctx = Guid.Empty;
                if (alternarSilencio)
                {
                    bool mudo; v.GetMute(out mudo);
                    v.SetMute(!mudo, ref ctx);
                    return;
                }
                float actual; v.GetMasterVolumeLevelScalar(out actual);
                float nuevo = nivel.HasValue ? (float)nivel.Value : actual + (float)(delta ?? 0);
                nuevo = Math.Max(0f, Math.Min(1f, nuevo));
                v.SetMasterVolumeLevelScalar(nuevo, ref ctx);
                if (nuevo > 0) v.SetMute(false, ref ctx);
            }
            finally { Marshal.ReleaseComObject(v); }
        }

        // ---------------- Ficha "fetch" (datos fijos) ----------------

        private static Dictionary<string, object> ficha;

        public static Dictionary<string, object> Ficha()
        {
            if (ficha != null) return ficha;
            var f = new Dictionary<string, object>();
            f["usuario"] = Environment.UserName;
            f["equipo"] = Environment.MachineName;
            try
            {
                using (var k = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows NT\CurrentVersion"))
                {
                    string producto = Convert.ToString(k.GetValue("ProductName", "Windows"));
                    int build;
                    int.TryParse(Convert.ToString(k.GetValue("CurrentBuild", "0")), out build);
                    if (build >= 22000) producto = producto.Replace("Windows 10", "Windows 11");
                    f["so"] = producto;
                    f["version"] = Convert.ToString(k.GetValue("DisplayVersion", ""));
                    f["compilacion"] = build + "." + Convert.ToString(k.GetValue("UBR", "0"));
                }
            }
            catch { f["so"] = "Windows"; }
            try
            {
                using (var k = Registry.LocalMachine.OpenSubKey(@"HARDWARE\DESCRIPTION\System\CentralProcessor\0"))
                    f["cpu"] = Convert.ToString(k.GetValue("ProcessorNameString", "")).Trim().Replace("(R)", "").Replace("(TM)", "").Replace("  ", " ");
            }
            catch { }
            f["nucleos"] = Environment.ProcessorCount;
            try
            {
                using (var clase = Registry.LocalMachine.OpenSubKey(@"SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}"))
                {
                    foreach (string sub in clase.GetSubKeyNames().Where(n => n.Length == 4))
                    {
                        try
                        {
                            using (var k = clase.OpenSubKey(sub))
                            {
                                string nombre = Convert.ToString(k.GetValue("DriverDesc", ""));
                                if (nombre.Length > 0 && nombre.IndexOf("Basic", StringComparison.OrdinalIgnoreCase) < 0) { f["gpu"] = nombre.Replace("(R)", ""); break; }
                            }
                        }
                        catch { }
                    }
                }
            }
            catch { }
            var m = new Nativo.MEMORYSTATUSEX { dwLength = (uint)Marshal.SizeOf(typeof(Nativo.MEMORYSTATUSEX)) };
            if (Nativo.GlobalMemoryStatusEx(ref m)) f["ram"] = Math.Round(m.ullTotalPhys / 1073741824.0, 1);
            var mon = Monitor.Principal_();
            if (mon != null)
            {
                f["resolucion"] = mon.Area.Width + "x" + mon.Area.Height;
                f["escala"] = (int)Math.Round(mon.Escala * 100);
            }
            f["lienzo"] = Application.ProductVersion;
            ficha = f;
            return f;
        }
    }
}

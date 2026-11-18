using System;
using System.Runtime.InteropServices;
using System.Text;

namespace Lienzo
{
    /// <summary>Llamadas a la API de Windows (user32, shell32, dwmapi, kernel32...).</summary>
    internal static class Nativo
    {
        // ----- Estilos de ventana -----
        public const int GWL_STYLE = -16, GWL_EXSTYLE = -20;
        public const long WS_POPUP = 0x80000000L, WS_CHILD = 0x40000000L, WS_VISIBLE = 0x10000000L,
            WS_CLIPSIBLINGS = 0x04000000L, WS_CLIPCHILDREN = 0x02000000L, WS_CAPTION = 0x00C00000L,
            WS_THICKFRAME = 0x00040000L, WS_SYSMENU = 0x00080000L, WS_MINIMIZEBOX = 0x00020000L, WS_MAXIMIZEBOX = 0x00010000L,
            WS_OVERLAPPEDWINDOW = 0x00CF0000L;
        public const int WS_EX_TOPMOST = 0x8, WS_EX_TRANSPARENT = 0x20, WS_EX_TOOLWINDOW = 0x80, WS_EX_APPWINDOW = 0x40000,
            WS_EX_LAYERED = 0x80000, WS_EX_NOREDIRECTIONBITMAP = 0x00200000, WS_EX_NOACTIVATE = 0x08000000;

        // ----- SetWindowPos / ShowWindow -----
        public static readonly IntPtr HWND_TOP = IntPtr.Zero, HWND_BOTTOM = new IntPtr(1),
            HWND_TOPMOST = new IntPtr(-1), HWND_NOTOPMOST = new IntPtr(-2), HWND_BROADCAST = new IntPtr(0xFFFF);
        public const uint SWP_NOSIZE = 0x1, SWP_NOMOVE = 0x2, SWP_NOZORDER = 0x4, SWP_NOACTIVATE = 0x10,
            SWP_FRAMECHANGED = 0x20, SWP_SHOWWINDOW = 0x40, SWP_HIDEWINDOW = 0x80, SWP_NOOWNERZORDER = 0x200;
        public const int SW_HIDE = 0, SW_SHOWNORMAL = 1, SW_SHOWMINIMIZED = 2, SW_MAXIMIZE = 3, SW_SHOWNOACTIVATE = 4,
            SW_SHOW = 5, SW_MINIMIZE = 6, SW_SHOWNA = 8, SW_RESTORE = 9;
        public const uint GW_HWNDNEXT = 2, GW_HWNDPREV = 3, GW_OWNER = 4, GA_ROOT = 2, GA_ROOTOWNER = 3;

        // ----- Mensajes -----
        public const int WM_DESTROY = 0x2, WM_SIZE = 0x5, WM_ACTIVATE = 0x6, WM_PAINT = 0xF, WM_CLOSE = 0x10,
            WM_ERASEBKGND = 0x14, WM_SETTINGCHANGE = 0x1A, WM_MOUSEACTIVATE = 0x21, WM_GETMINMAXINFO = 0x24,
            WM_WINDOWPOSCHANGING = 0x46, WM_DISPLAYCHANGE = 0x7E, WM_GETICON = 0x7F, WM_NCDESTROY = 0x82,
            WM_NCHITTEST = 0x84, WM_COMMAND = 0x111, WM_SYSCOMMAND = 0x112, WM_POWERBROADCAST = 0x218,
            WM_WTSSESSION_CHANGE = 0x2B1, WM_DPICHANGED = 0x2E0, WM_USER = 0x400, WM_HOTKEY = 0x312;
        public const int MA_NOACTIVATE = 3;
        public const uint SMTO_NORMAL = 0x0, SMTO_ABORTIFHUNG = 0x2;
        public const int ICON_SMALL = 0, ICON_BIG = 1, ICON_SMALL2 = 2, GCLP_HICON = -14, GCLP_HICONSM = -34;
        public const uint SC_CLOSE = 0xF060;

        // ----- Shell hook -----
        public const int HSHELL_WINDOWCREATED = 1, HSHELL_WINDOWDESTROYED = 2, HSHELL_ACTIVATESHELLWINDOW = 3,
            HSHELL_WINDOWACTIVATED = 4, HSHELL_REDRAW = 6, HSHELL_FLASH = 0x8006, HSHELL_RUDEAPPACTIVATED = 0x8004,
            HSHELL_WINDOWREPLACED = 13, HSHELL_MONITORCHANGED = 16;

        // ----- AppBar -----
        public const uint ABM_NEW = 0, ABM_REMOVE = 1, ABM_QUERYPOS = 2, ABM_SETPOS = 3, ABM_GETSTATE = 4,
            ABM_GETTASKBARPOS = 5, ABM_ACTIVATE = 6, ABM_SETSTATE = 10;
        public const int ABN_STATECHANGE = 0, ABN_POSCHANGED = 1, ABN_FULLSCREENAPP = 2, ABN_WINDOWARRANGE = 3;
        public const uint ABE_LEFT = 0, ABE_TOP = 1, ABE_RIGHT = 2, ABE_BOTTOM = 3;
        public const int ABS_AUTOHIDE = 1, ABS_ALWAYSONTOP = 2;

        // ----- DWM -----
        public const int DWMWA_CLOAKED = 14, DWMWA_EXTENDED_FRAME_BOUNDS = 9, DWMWA_USE_IMMERSIVE_DARK_MODE = 20,
            DWMWA_WINDOW_CORNER_PREFERENCE = 33, DWMWA_BORDER_COLOR = 34, DWMWA_SYSTEMBACKDROP_TYPE = 38,
            DWMWA_TRANSITIONS_FORCEDISABLED = 3;
        public const int DWMWCP_DEFAULT = 0, DWMWCP_DONOTROUND = 1, DWMWCP_ROUND = 2, DWMWCP_ROUNDSMALL = 3;
        public const int WCA_ACCENT_POLICY = 19;
        public const int ACCENT_DISABLED = 0, ACCENT_ENABLE_GRADIENT = 1, ACCENT_ENABLE_TRANSPARENTGRADIENT = 2,
            ACCENT_ENABLE_BLURBEHIND = 3, ACCENT_ENABLE_ACRYLICBLURBEHIND = 4;

        // ----- Teclado -----
        public const ushort VK_LWIN = 0x5B, VK_CONTROL = 0x11, VK_MENU = 0x12, VK_SHIFT = 0x10, VK_TAB = 0x09,
            VK_ESCAPE = 0x1B, VK_MEDIA_NEXT_TRACK = 0xB0, VK_MEDIA_PREV_TRACK = 0xB1, VK_MEDIA_PLAY_PAUSE = 0xB3,
            VK_VOLUME_MUTE = 0xAD, VK_VOLUME_DOWN = 0xAE, VK_VOLUME_UP = 0xAF;
        public const uint KEYEVENTF_EXTENDEDKEY = 0x1, KEYEVENTF_KEYUP = 0x2, INPUT_KEYBOARD = 1;

        // ----- Otros -----
        public const uint MONITOR_DEFAULTTONEAREST = 2, MONITOR_DEFAULTTOPRIMARY = 1;
        public const uint SPI_GETWORKAREA = 0x30, SPI_SETWORKAREA = 0x2F;
        public const uint PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;
        public const int RGN_DIFF = 4, NULLREGION = 1;
        public const int WTS_SESSION_LOCK = 0x7, WTS_SESSION_UNLOCK = 0x8;
        public const int PBT_POWERSETTINGCHANGE = 0x8013, PBT_APMPOWERSTATUSCHANGE = 0xA;
        public static Guid GUID_CONSOLE_DISPLAY_STATE = new Guid("6FE69556-704A-47A0-8F24-C28D936FDA47");
        public const int QUNS_BUSY = 2, QUNS_RUNNING_D3D_FULL_SCREEN = 3, QUNS_PRESENTATION_MODE = 4, QUNS_APP = 7;

        // ===== Estructuras =====
        [StructLayout(LayoutKind.Sequential)]
        public struct RECT
        {
            public int Left, Top, Right, Bottom;
            public RECT(int l, int t, int r, int b) { Left = l; Top = t; Right = r; Bottom = b; }
            public int Ancho { get { return Right - Left; } }
            public int Alto { get { return Bottom - Top; } }
            public System.Drawing.Rectangle ARect() { return new System.Drawing.Rectangle(Left, Top, Right - Left, Bottom - Top); }
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct POINT { public int X, Y; public POINT(int x, int y) { X = x; Y = y; } }

        [StructLayout(LayoutKind.Sequential)]
        public struct SIZE { public int cx, cy; public SIZE(int x, int y) { cx = x; cy = y; } }

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        public struct MONITORINFOEX
        {
            public int cbSize;
            public RECT rcMonitor, rcWork;
            public uint dwFlags;
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string szDevice;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct APPBARDATA
        {
            public int cbSize;
            public IntPtr hWnd;
            public uint uCallbackMessage;
            public uint uEdge;
            public RECT rc;
            public IntPtr lParam;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct MARGINS { public int Izq, Der, Arr, Aba; }

        [StructLayout(LayoutKind.Sequential)]
        public struct ACCENT_POLICY { public int AccentState, AccentFlags; public uint GradientColor; public int AnimationId; }

        [StructLayout(LayoutKind.Sequential)]
        public struct WINDOWCOMPOSITIONATTRIBDATA { public int Attribute; public IntPtr Data; public int SizeOfData; }

        [StructLayout(LayoutKind.Sequential)]
        public struct SYSTEM_POWER_STATUS
        {
            public byte ACLineStatus, BatteryFlag, BatteryLifePercent, SystemStatusFlag;
            public int BatteryLifeTime, BatteryFullLifeTime;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct MEMORYSTATUSEX
        {
            public uint dwLength, dwMemoryLoad;
            public ulong ullTotalPhys, ullAvailPhys, ullTotalPageFile, ullAvailPageFile, ullTotalVirtual, ullAvailVirtual, ullAvailExtendedVirtual;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct KEYBDINPUT { public ushort wVk, wScan; public uint dwFlags, time; public IntPtr dwExtraInfo; }

        [StructLayout(LayoutKind.Sequential)]
        public struct MOUSEINPUT { public int dx, dy; public uint mouseData, dwFlags, time; public IntPtr dwExtraInfo; }

        [StructLayout(LayoutKind.Explicit)]
        public struct INPUTUNION { [FieldOffset(0)] public MOUSEINPUT mi; [FieldOffset(0)] public KEYBDINPUT ki; }

        [StructLayout(LayoutKind.Sequential)]
        public struct INPUT { public uint type; public INPUTUNION u; }

        [StructLayout(LayoutKind.Sequential)]
        public struct BITMAP { public int bmType, bmWidth, bmHeight, bmWidthBytes; public ushort bmPlanes, bmBitsPixel; public IntPtr bmBits; }

        [StructLayout(LayoutKind.Sequential)]
        public struct BITMAPINFOHEADER
        {
            public uint biSize; public int biWidth, biHeight; public ushort biPlanes, biBitCount;
            public uint biCompression, biSizeImage; public int biXPelsPerMeter, biYPelsPerMeter; public uint biClrUsed, biClrImportant;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct DIBSECTION
        {
            public BITMAP dsBm; public BITMAPINFOHEADER dsBmih;
            public uint dsBitfields0, dsBitfields1, dsBitfields2; public IntPtr dshSection; public uint dsOffset;
        }

        [StructLayout(LayoutKind.Sequential, Pack = 4)]
        public struct PROPERTYKEY { public Guid fmtid; public uint pid; public PROPERTYKEY(Guid g, uint p) { fmtid = g; pid = p; } }

        [StructLayout(LayoutKind.Explicit, Size = 24)]
        public struct PROPVARIANT { [FieldOffset(0)] public ushort vt; [FieldOffset(8)] public IntPtr puntero; }

        [StructLayout(LayoutKind.Sequential)]
        public struct POWERBROADCAST_SETTING { public Guid PowerSetting; public uint DataLength; public byte Data; }

        // ===== user32 =====
        public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
        public delegate bool MonitorEnumProc(IntPtr hMon, IntPtr hdc, ref RECT r, IntPtr data);

        [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        public static extern IntPtr FindWindow(string clase, string titulo);
        [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        public static extern IntPtr FindWindowEx(IntPtr padre, IntPtr despuesDe, string clase, string titulo);
        [DllImport("user32.dll", SetLastError = true)]
        public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint msg, IntPtr w, IntPtr l, uint flags, uint timeout, out IntPtr resultado);
        [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true, EntryPoint = "SendMessageTimeoutW")]
        public static extern IntPtr SendMessageTimeoutTexto(IntPtr hWnd, uint msg, IntPtr w, string l, uint flags, uint timeout, out IntPtr resultado);
        [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr hWnd, int msg, IntPtr w, IntPtr l);
        [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hWnd, int msg, IntPtr w, IntPtr l);
        [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr l);
        [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr padre, EnumWindowsProc cb, IntPtr l);
        [DllImport("user32.dll", SetLastError = true)] public static extern IntPtr SetParent(IntPtr hijo, IntPtr padre);
        [DllImport("user32.dll")] public static extern IntPtr GetParent(IntPtr hWnd);
        [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr hWnd, uint flags);
        [DllImport("user32.dll")] public static extern IntPtr GetWindow(IntPtr hWnd, uint cmd);
        [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW")] public static extern IntPtr GetWindowLongPtr(IntPtr hWnd, int i);
        [DllImport("user32.dll", EntryPoint = "SetWindowLongPtrW")] public static extern IntPtr SetWindowLongPtr(IntPtr hWnd, int i, IntPtr v);
        [DllImport("user32.dll", EntryPoint = "GetClassLongPtrW")] public static extern IntPtr GetClassLongPtr(IntPtr hWnd, int i);
        [DllImport("user32.dll", SetLastError = true)] public static extern bool SetLayeredWindowAttributes(IntPtr hWnd, uint color, byte alpha, uint flags);
        [DllImport("user32.dll", SetLastError = true)] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr despuesDe, int x, int y, int cx, int cy, uint flags);
        [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int cmd);
        [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr hWnd);
        [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
        [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
        [DllImport("user32.dll")] public static extern bool IsZoomed(IntPtr hWnd);
        [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT r);
        [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr hWnd, out RECT r);
        [DllImport("user32.dll")] public static extern bool ScreenToClient(IntPtr hWnd, ref POINT p);
        [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
        [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
        [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr hWnd);
        [DllImport("user32.dll")] public static extern void SwitchToThisWindow(IntPtr hWnd, bool altTab);
        [DllImport("user32.dll")] public static extern IntPtr GetLastActivePopup(IntPtr hWnd);
        [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
        [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint a, uint b, bool unir);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder sb, int max);
        [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr hWnd);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetClassName(IntPtr hWnd, StringBuilder sb, int max);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern uint RegisterWindowMessage(string s);
        [DllImport("user32.dll")] public static extern bool RegisterShellHookWindow(IntPtr hWnd);
        [DllImport("user32.dll")] public static extern bool DeregisterShellHookWindow(IntPtr hWnd);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern bool GetMonitorInfo(IntPtr hMon, ref MONITORINFOEX mi);
        [DllImport("user32.dll")] public static extern bool EnumDisplayMonitors(IntPtr hdc, IntPtr clip, MonitorEnumProc cb, IntPtr data);
        [DllImport("user32.dll")] public static extern uint GetDpiForWindow(IntPtr hWnd);
        [DllImport("user32.dll", SetLastError = true)] public static extern bool SystemParametersInfo(uint accion, uint param, ref RECT r, uint ini);
        [DllImport("user32.dll")] public static extern int GetSystemMetrics(int i);
        [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT p);
        [DllImport("user32.dll", SetLastError = true)] public static extern uint SendInput(uint n, INPUT[] entradas, int tam);
        [DllImport("user32.dll")] public static extern bool DestroyIcon(IntPtr h);
        [DllImport("user32.dll")] public static extern int SetWindowCompositionAttribute(IntPtr hWnd, ref WINDOWCOMPOSITIONATTRIBDATA d);
        [DllImport("user32.dll")] public static extern int FillRect(IntPtr hdc, ref RECT r, IntPtr pincel);
        [DllImport("user32.dll", SetLastError = true)] public static extern IntPtr RegisterPowerSettingNotification(IntPtr h, ref Guid g, int flags);

        // ===== shell32 / shcore / dwmapi =====
        [DllImport("shell32.dll")] public static extern UIntPtr SHAppBarMessage(uint msg, ref APPBARDATA d);
        [DllImport("shell32.dll")] public static extern int SHQueryUserNotificationState(out int estado);
        [DllImport("shcore.dll")] public static extern int GetDpiForMonitor(IntPtr hMon, int tipo, out uint dpiX, out uint dpiY);
        [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr hWnd, int attr, out int valor, int tam);
        [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr hWnd, int attr, out RECT valor, int tam);
        [DllImport("dwmapi.dll")] public static extern int DwmSetWindowAttribute(IntPtr hWnd, int attr, ref int valor, int tam);
        [DllImport("dwmapi.dll")] public static extern int DwmExtendFrameIntoClientArea(IntPtr hWnd, ref MARGINS m);
        [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = false)]
        public static extern void SHCreateItemFromParsingName(string ruta, IntPtr bc, [MarshalAs(UnmanagedType.LPStruct)] Guid riid,
            [MarshalAs(UnmanagedType.Interface)] out IShellItemImageFactory fabrica);
        [DllImport("shell32.dll", PreserveSig = false)]
        public static extern void SHGetPropertyStoreForWindow(IntPtr hWnd, [MarshalAs(UnmanagedType.LPStruct)] Guid riid,
            [MarshalAs(UnmanagedType.Interface)] out IPropertyStore almacen);
        [DllImport("ole32.dll")] public static extern int PropVariantClear(ref PROPVARIANT pv);

        // ===== kernel32 / gdi32 / wtsapi32 =====
        [DllImport("kernel32.dll")] public static extern bool GetSystemPowerStatus(out SYSTEM_POWER_STATUS s);
        [DllImport("kernel32.dll")] public static extern bool GetSystemTimes(out long inactivo, out long nucleo, out long usuario);
        [DllImport("kernel32.dll")] public static extern bool GlobalMemoryStatusEx(ref MEMORYSTATUSEX m);
        [DllImport("kernel32.dll")] public static extern ulong GetTickCount64();
        [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
        [DllImport("kernel32.dll")] public static extern IntPtr OpenProcess(uint acceso, bool heredar, uint pid);
        [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr h);
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] public static extern bool QueryFullProcessImageName(IntPtr proc, int flags, StringBuilder sb, ref int tam);
        [DllImport("gdi32.dll")] public static extern IntPtr CreateRectRgn(int l, int t, int r, int b);
        [DllImport("gdi32.dll")] public static extern IntPtr CreateRoundRectRgn(int l, int t, int r, int b, int w, int h);
        [DllImport("gdi32.dll")] public static extern int CombineRgn(IntPtr destino, IntPtr a, IntPtr b, int modo);
        [DllImport("gdi32.dll")] public static extern uint GetRegionData(IntPtr rgn, uint cuenta, IntPtr datos);
        [DllImport("gdi32.dll")] public static extern bool DeleteObject(IntPtr h);
        [DllImport("gdi32.dll")] public static extern IntPtr GetStockObject(int i);
        [DllImport("gdi32.dll")] public static extern int GetObject(IntPtr h, int tam, out DIBSECTION ds);
        [DllImport("user32.dll")] public static extern bool SetWindowRgn(IntPtr hWnd, IntPtr rgn, bool redibujar);
        [DllImport("wtsapi32.dll")] public static extern bool WTSRegisterSessionNotification(IntPtr hWnd, int flags);
        [DllImport("wtsapi32.dll")] public static extern bool WTSUnRegisterSessionNotification(IntPtr hWnd);

        // ===== COM =====
        [ComImport, Guid("bcc18b79-ba16-442f-80c4-8a59c30c463b"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        public interface IShellItemImageFactory
        {
            void GetImage(SIZE tam, int flags, out IntPtr hbitmap);
        }

        [ComImport, Guid("886d8eeb-8cf2-4446-8d02-cdba1dbdcf99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        public interface IPropertyStore
        {
            void GetCount(out uint n);
            void GetAt(uint i, out PROPERTYKEY k);
            void GetValue(ref PROPERTYKEY k, out PROPVARIANT v);
            void SetValue(ref PROPERTYKEY k, ref PROPVARIANT v);
            void Commit();
        }

        // ===== Ayudantes =====
        public static long Estilo(IntPtr h) { return GetWindowLongPtr(h, GWL_STYLE).ToInt64(); }
        public static long EstiloEx(IntPtr h) { return GetWindowLongPtr(h, GWL_EXSTYLE).ToInt64(); }
        public static void PonerEstilo(IntPtr h, long v) { SetWindowLongPtr(h, GWL_STYLE, new IntPtr(v)); }
        public static void PonerEstiloEx(IntPtr h, long v) { SetWindowLongPtr(h, GWL_EXSTYLE, new IntPtr(v)); }

        public static string Clase(IntPtr h)
        {
            var sb = new StringBuilder(256);
            GetClassName(h, sb, sb.Capacity);
            return sb.ToString();
        }

        public static string Titulo(IntPtr h)
        {
            int n = GetWindowTextLength(h);
            if (n <= 0) return "";
            var sb = new StringBuilder(n + 1);
            GetWindowText(h, sb, sb.Capacity);
            return sb.ToString();
        }

        public static bool Oculta(IntPtr h)
        {
            int c;
            return DwmGetWindowAttribute(h, DWMWA_CLOAKED, out c, 4) == 0 && c != 0;
        }

        public static RECT Marco(IntPtr h)
        {
            RECT r;
            if (DwmGetWindowAttribute(h, DWMWA_EXTENDED_FRAME_BOUNDS, out r, Marshal.SizeOf(typeof(RECT))) != 0)
                GetWindowRect(h, out r);
            return r;
        }

        public static string RutaProceso(uint pid)
        {
            IntPtr p = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid);
            if (p == IntPtr.Zero) return null;
            try
            {
                var sb = new StringBuilder(1024);
                int tam = sb.Capacity;
                return QueryFullProcessImageName(p, 0, sb, ref tam) ? sb.ToString() : null;
            }
            finally { CloseHandle(p); }
        }

        public static bool Teclas(params ushort[] vks)
        {
            // Pulsa las teclas en orden y las suelta en orden inverso (p. ej. Win + A).
            var lista = new INPUT[vks.Length * 2];
            for (int i = 0; i < vks.Length; i++)
            {
                lista[i].type = INPUT_KEYBOARD;
                lista[i].u.ki.wVk = vks[i];
                lista[i].u.ki.dwFlags = EsExtendida(vks[i]) ? KEYEVENTF_EXTENDEDKEY : 0;
                int j = vks.Length * 2 - 1 - i;
                lista[j].type = INPUT_KEYBOARD;
                lista[j].u.ki.wVk = vks[i];
                lista[j].u.ki.dwFlags = KEYEVENTF_KEYUP | (EsExtendida(vks[i]) ? KEYEVENTF_EXTENDEDKEY : 0);
            }
            return SendInput((uint)lista.Length, lista, Marshal.SizeOf(typeof(INPUT))) == lista.Length;
        }

        private static bool EsExtendida(ushort vk)
        {
            return vk == VK_LWIN || (vk >= 0xA6 && vk <= 0xB7);
        }

        public static void Acento(IntPtr h, int estado, uint colorAbgr)
        {
            // AccentFlags = 2: usar GradientColor (si no, Windows pone su color por defecto).
            var politica = new ACCENT_POLICY { AccentState = estado, AccentFlags = estado == ACCENT_DISABLED ? 0 : 2, GradientColor = colorAbgr };
            int tam = Marshal.SizeOf(politica);
            IntPtr p = Marshal.AllocHGlobal(tam);
            try
            {
                Marshal.StructureToPtr(politica, p, false);
                var datos = new WINDOWCOMPOSITIONATTRIBDATA { Attribute = WCA_ACCENT_POLICY, Data = p, SizeOfData = tam };
                SetWindowCompositionAttribute(h, ref datos);
            }
            finally { Marshal.FreeHGlobal(p); }
        }

        public static uint Dpi(IntPtr monitor)
        {
            uint x, y;
            return GetDpiForMonitor(monitor, 0, out x, out y) == 0 ? x : 96;
        }
    }
}

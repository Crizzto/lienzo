using System;
using System.Drawing;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;

namespace Lienzo
{
    /// <summary>El panel de ajustes, el modo edición del escritorio y el icono de la bandeja.</summary>
    internal partial class App
    {
        public Superficie Panel, Editor;
        private NotifyIcon iconoBandeja;
        private ToolStripMenuItem itemPausa;
        private Icon iconoGrande, iconoPequeno;

        // ---------------- Icono en la bandeja ----------------

        private void CrearIconoBandeja()
        {
            iconoGrande = IconoDeMarca(32);
            iconoPequeno = IconoDeMarca(Math.Max(16, SystemInformation.SmallIconSize.Width));
            var menu = new ContextMenuStrip { Renderer = new MenuOscuro(), ShowImageMargin = false };
            menu.Items.Add("Abrir Lienzo", null, (o, e) => AbrirPanel(null));
            menu.Items.Add("Editar bloques del escritorio", null, (o, e) => AbrirEditor());
            itemPausa = new ToolStripMenuItem("Pausar el fondo");
            itemPausa.Click += (o, e) => PausaManual(!EnPausaManual);
            menu.Items.Add(itemPausa);
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add("Salir de Lienzo", null, (o, e) => Salir());
            menu.Opening += (o, e) => itemPausa.Text = EnPausaManual ? "Reanudar el fondo" : "Pausar el fondo";
            iconoBandeja = new NotifyIcon { Icon = iconoPequeno, Text = "Lienzo", ContextMenuStrip = menu, Visible = true };
            iconoBandeja.MouseClick += (o, e) => { if (e.Button == MouseButtons.Left) AbrirPanel(null); };
        }

        private static Icon IconoDeMarca(int t)
        {
            using (var bmp = Marca.Dibujar(t)) return Icon.FromHandle(bmp.GetHicon());
        }

        private void QuitarIconoBandeja()
        {
            if (iconoBandeja == null) return;
            iconoBandeja.Visible = false;
            iconoBandeja.Dispose();
            iconoBandeja = null;
        }

        public void Aviso(string titulo, string texto)
        {
            if (iconoBandeja != null) iconoBandeja.ShowBalloonTip(4000, titulo, texto, ToolTipIcon.None);
        }

        // ---------------- Panel de ajustes ----------------

        public async void AbrirPanel(string seccion)
        {
            if (Panel != null)
            {
                Nativo.ShowWindow(Panel.Handle, Nativo.IsIconic(Panel.Handle) ? Nativo.SW_RESTORE : Nativo.SW_SHOW);
                Nativo.SetForegroundWindow(Panel.Handle);
                if (seccion != null) Panel.Enviar("irA", Json.Nuevo("seccion", seccion));
                return;
            }
            if (Entorno == null) return;
            var mon = Monitor.Principal_();
            double esc = mon.Escala;
            int w = Math.Min((int)(1200 * esc), (int)(mon.Trabajo.Width * 0.94));
            int h = Math.Min((int)(800 * esc), (int)(mon.Trabajo.Height * 0.94));
            var r = new Rectangle(mon.Trabajo.X + (mon.Trabajo.Width - w) / 2, mon.Trabajo.Y + (mon.Trabajo.Height - h) / 2, w, h);
            var cp = Superficie.Parametros("Lienzo", Nativo.WS_OVERLAPPEDWINDOW | Nativo.WS_CLIPCHILDREN, Nativo.WS_EX_APPWINDOW, r);
            var p = new Superficie("panel", cp) { EsVentanaNormal = true, MinimoDip = new Size(880, 580) };
            Panel = p;
            p.Mensaje += AlMensaje;
            p.CerrarSolicitado += s => CerrarPanel();
            PonerIconos(p.Handle);
            EstiloVentanaWin11(p.Handle);
            Nativo.ShowWindow(p.Handle, Nativo.SW_SHOWNORMAL);
            Nativo.SetForegroundWindow(p.Handle);
            await p.Iniciar(Entorno, "panel.html" + (seccion != null ? "#" + seccion : ""), true);
        }

        public void CerrarPanel()
        {
            if (Panel == null) return;
            var p = Panel;
            Panel = null;
            p.Cerrar(); // se destruye del todo: así no gasta memoria mientras no se usa
        }

        private void PonerIconos(IntPtr h)
        {
            Nativo.SendMessage(h, 0x80 /* WM_SETICON */, new IntPtr(1), iconoGrande.Handle);
            Nativo.SendMessage(h, 0x80, new IntPtr(0), iconoPequeno.Handle);
        }

        /// <summary>Barra de título oscura y fondo Mica (el material translúcido de Windows 11).</summary>
        private static void EstiloVentanaWin11(IntPtr h)
        {
            int si = 1;
            Nativo.DwmSetWindowAttribute(h, Nativo.DWMWA_USE_IMMERSIVE_DARK_MODE, ref si, 4);
            int mica = 2; // DWMSBT_MAINWINDOW
            if (Nativo.DwmSetWindowAttribute(h, Nativo.DWMWA_SYSTEMBACKDROP_TYPE, ref mica, 4) == 0)
            {
                var m = new Nativo.MARGINS { Izq = -1, Der = -1, Arr = -1, Aba = -1 };
                Nativo.DwmExtendFrameIntoClientArea(h, ref m);
            }
        }

        // ---------------- Modo edición ----------------

        public async void AbrirEditor()
        {
            if (Editor != null) { Nativo.SetForegroundWindow(Editor.Handle); return; }
            if (Entorno == null) return;
            var mon = Monitor.Principal_();
            var cp = Superficie.Parametros("Lienzo · Edición", Nativo.WS_POPUP | Nativo.WS_CLIPCHILDREN,
                Nativo.WS_EX_TOPMOST | Nativo.WS_EX_TOOLWINDOW, mon.Area);
            var ed = new Superficie("editor", cp) { Etiqueta = mon };
            Editor = ed;
            ed.Mensaje += AlMensaje;
            ed.CerrarSolicitado += s => CerrarEditor();
            Nativo.ShowWindow(ed.Handle, Nativo.SW_SHOW);
            Nativo.SetForegroundWindow(ed.Handle);
            await ed.Iniciar(Entorno, "escritorio.html?editar=1&principal=1", false);
            try { if (ed.Controlador != null) ed.Controlador.MoveFocus(CoreWebView2MoveFocusReason.Programmatic); } catch { }
        }

        public void CerrarEditor()
        {
            if (Editor == null) return;
            var e = Editor;
            Editor = null;
            e.Cerrar();
        }

        /// <summary>Para usar las ventanas nativas (p. ej. el panel) como dueñas de los cuadros de diálogo.</summary>
        private class Envoltura : IWin32Window
        {
            public Envoltura(IntPtr h) { Handle = h; }
            public IntPtr Handle { get; private set; }
        }

        /// <summary>Menú contextual oscuro para el icono de la bandeja.</summary>
        private class MenuOscuro : ToolStripProfessionalRenderer
        {
            public MenuOscuro() : base(new Colores()) { RoundedEdges = false; }

            protected override void OnRenderItemText(ToolStripItemTextRenderEventArgs e)
            {
                e.TextColor = Color.FromArgb(240, 236, 250);
                base.OnRenderItemText(e);
            }

            private class Colores : ProfessionalColorTable
            {
                private static readonly Color fondo = Color.FromArgb(28, 25, 38), borde = Color.FromArgb(58, 52, 76), sel = Color.FromArgb(60, 48, 92);
                public override Color ToolStripDropDownBackground { get { return fondo; } }
                public override Color MenuBorder { get { return borde; } }
                public override Color MenuItemBorder { get { return sel; } }
                public override Color MenuItemSelected { get { return sel; } }
                public override Color MenuItemSelectedGradientBegin { get { return sel; } }
                public override Color MenuItemSelectedGradientEnd { get { return sel; } }
                public override Color ImageMarginGradientBegin { get { return fondo; } }
                public override Color ImageMarginGradientMiddle { get { return fondo; } }
                public override Color ImageMarginGradientEnd { get { return fondo; } }
                public override Color SeparatorDark { get { return borde; } }
                public override Color SeparatorLight { get { return fondo; } }
            }
        }
    }
}

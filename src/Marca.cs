using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;

namespace Lienzo
{
    /// <summary>Dibuja el logo de Lienzo (se usa para el .ico del ejecutable y para el icono de la bandeja).</summary>
    internal static class Marca
    {
        public static Bitmap Dibujar(int t)
        {
            var bmp = new Bitmap(t, t, PixelFormat.Format32bppArgb);
            using (var g = Graphics.FromImage(bmp))
            {
                g.SmoothingMode = SmoothingMode.AntiAlias;
                g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                g.Clear(Color.Transparent);

                float m = t * 0.03f;
                var r = new RectangleF(m, m, t - 2 * m, t - 2 * m);
                using (var ruta = Redondeado(r, t * 0.27f))
                using (var pincel = new LinearGradientBrush(new PointF(0, 0), new PointF(t, t),
                    Color.FromArgb(255, 124, 92, 255), Color.FromArgb(255, 255, 95, 162)))
                {
                    g.FillPath(pincel, ruta);
                }

                // Una "L" de trazo redondeado y una luna: el lienzo y la noche de los rices.
                using (var lapiz = new Pen(Color.White, t * 0.15f))
                {
                    lapiz.StartCap = LineCap.Round;
                    lapiz.EndCap = LineCap.Round;
                    lapiz.LineJoin = LineJoin.Round;
                    g.DrawLines(lapiz, new[] {
                        new PointF(t * 0.33f, t * 0.27f),
                        new PointF(t * 0.33f, t * 0.70f),
                        new PointF(t * 0.70f, t * 0.70f)
                    });
                }
                float d = t * 0.18f;
                using (var b = new SolidBrush(Color.FromArgb(240, 255, 255, 255)))
                    g.FillEllipse(b, t * 0.58f, t * 0.22f, d, d);
            }
            return bmp;
        }

        public static GraphicsPath Redondeado(RectangleF r, float rad)
        {
            var p = new GraphicsPath();
            float d = rad * 2;
            p.AddArc(r.X, r.Y, d, d, 180, 90);
            p.AddArc(r.Right - d, r.Y, d, d, 270, 90);
            p.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90);
            p.AddArc(r.X, r.Bottom - d, d, d, 90, 90);
            p.CloseFigure();
            return p;
        }
    }
}

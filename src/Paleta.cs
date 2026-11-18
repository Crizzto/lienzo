using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Linq;
using System.Runtime.InteropServices;

namespace Lienzo
{
    /// <summary>Colores dominantes de una imagen (k-means sobre una miniatura), como hace pywal en Linux.</summary>
    internal static class Paleta
    {
        public static List<Dictionary<string, object>> Dominantes(Bitmap origen, int k)
        {
            const int W = 64;
            int H = Math.Max(1, origen.Height * W / Math.Max(1, origen.Width));
            var pix = new List<double[]>();
            using (var peq = new Bitmap(W, H, PixelFormat.Format32bppArgb))
            {
                using (var g = Graphics.FromImage(peq))
                {
                    g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBilinear;
                    g.DrawImage(origen, 0, 0, W, H);
                }
                var datos = peq.LockBits(new Rectangle(0, 0, W, H), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
                var bytes = new byte[datos.Stride * H];
                Marshal.Copy(datos.Scan0, bytes, 0, bytes.Length);
                peq.UnlockBits(datos);
                for (int y = 0; y < H; y++)
                    for (int x = 0; x < W; x++)
                    {
                        int i = y * datos.Stride + x * 4;
                        if (bytes[i + 3] < 128) continue;
                        pix.Add(new double[] { bytes[i + 2], bytes[i + 1], bytes[i] });
                    }
            }
            if (pix.Count == 0) return new List<Dictionary<string, object>>();

            // Centros iniciales repartidos por luminosidad (resultado estable, sin azar).
            var orden = pix.OrderBy(p => 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]).ToList();
            var centros = new double[k][];
            for (int c = 0; c < k; c++) centros[c] = (double[])orden[(int)((c + 0.5) * orden.Count / k)].Clone();
            var grupo = new int[pix.Count];
            for (int iter = 0; iter < 12; iter++)
            {
                for (int i = 0; i < pix.Count; i++)
                {
                    double mejor = double.MaxValue; int cual = 0;
                    for (int c = 0; c < k; c++)
                    {
                        double dr = pix[i][0] - centros[c][0], dg = pix[i][1] - centros[c][1], db = pix[i][2] - centros[c][2];
                        double d = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;
                        if (d < mejor) { mejor = d; cual = c; }
                    }
                    grupo[i] = cual;
                }
                var suma = new double[k, 3]; var n = new int[k];
                for (int i = 0; i < pix.Count; i++)
                {
                    int c = grupo[i]; n[c]++;
                    suma[c, 0] += pix[i][0]; suma[c, 1] += pix[i][1]; suma[c, 2] += pix[i][2];
                }
                for (int c = 0; c < k; c++)
                    if (n[c] > 0) centros[c] = new[] { suma[c, 0] / n[c], suma[c, 1] / n[c], suma[c, 2] / n[c] };
            }
            var conteo = new int[k];
            foreach (int c in grupo) conteo[c]++;
            var res = new List<Dictionary<string, object>>();
            for (int c = 0; c < k; c++)
            {
                if (conteo[c] == 0) continue;
                string hex = string.Format("#{0:x2}{1:x2}{2:x2}", (int)Math.Round(centros[c][0]), (int)Math.Round(centros[c][1]), (int)Math.Round(centros[c][2]));
                res.Add(Json.Nuevo("color", hex, "peso", Math.Round((double)conteo[c] / pix.Count, 4)));
            }
            res.Sort((a, b) => ((double)b["peso"]).CompareTo((double)a["peso"]));
            return res;
        }
    }
}

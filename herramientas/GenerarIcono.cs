using System;
using System.Collections.Generic;
using System.Drawing.Imaging;
using System.IO;

namespace Lienzo
{
    /// <summary>Herramienta de compilación: crea recursos/lienzo.ico (varios tamaños en PNG) a partir de Marca.Dibujar.</summary>
    internal static class GenerarIcono
    {
        private static void Main(string[] args)
        {
            int[] tamanos = { 16, 20, 24, 32, 40, 48, 64, 96, 128, 256 };
            var imagenes = new List<byte[]>();
            foreach (int t in tamanos)
            {
                using (var bmp = Marca.Dibujar(t))
                using (var ms = new MemoryStream())
                {
                    bmp.Save(ms, ImageFormat.Png);
                    imagenes.Add(ms.ToArray());
                }
            }
            using (var f = new BinaryWriter(File.Create(args[0])))
            {
                f.Write((ushort)0); f.Write((ushort)1); f.Write((ushort)tamanos.Length);
                int desplazamiento = 6 + 16 * tamanos.Length;
                for (int i = 0; i < tamanos.Length; i++)
                {
                    byte lado = (byte)(tamanos[i] >= 256 ? 0 : tamanos[i]);
                    f.Write(lado); f.Write(lado); f.Write((byte)0); f.Write((byte)0);
                    f.Write((ushort)1); f.Write((ushort)32);
                    f.Write((uint)imagenes[i].Length); f.Write((uint)desplazamiento);
                    desplazamiento += imagenes[i].Length;
                }
                foreach (var img in imagenes) f.Write(img);
            }
            Console.WriteLine("Icono creado: " + args[0]);
        }
    }
}

using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.Web.Script.Serialization;

namespace Lienzo
{
    /// <summary>JSON con el serializador que ya trae .NET Framework y ayudantes para leer rutas como "barra.posicion".</summary>
    internal static class Json
    {
        private static readonly JavaScriptSerializer serializador = new JavaScriptSerializer { MaxJsonLength = int.MaxValue, RecursionLimit = 512 };

        public static object Leer(string texto) { return serializador.DeserializeObject(texto); }
        public static Dictionary<string, object> Objeto(string texto) { return Leer(texto) as Dictionary<string, object>; }
        public static string Escribir(object o) { return serializador.Serialize(o); }

        public static Dictionary<string, object> Nuevo(params object[] pares)
        {
            var d = new Dictionary<string, object>();
            for (int i = 0; i + 1 < pares.Length; i += 2) d[(string)pares[i]] = pares[i + 1];
            return d;
        }

        public static object Ruta(Dictionary<string, object> d, string ruta)
        {
            object actual = d;
            foreach (string parte in ruta.Split('.'))
            {
                var dic = actual as Dictionary<string, object>;
                if (dic == null || !dic.TryGetValue(parte, out actual)) return null;
            }
            return actual;
        }

        public static string Texto(Dictionary<string, object> d, string ruta, string defecto)
        {
            object v = Ruta(d, ruta);
            return v == null ? defecto : Convert.ToString(v, CultureInfo.InvariantCulture);
        }

        public static double Numero(Dictionary<string, object> d, string ruta, double defecto)
        {
            object v = Ruta(d, ruta);
            if (v == null || v is string || v is bool) return defecto;
            try { return Convert.ToDouble(v, CultureInfo.InvariantCulture); } catch { return defecto; }
        }

        public static bool Bool(Dictionary<string, object> d, string ruta, bool defecto)
        {
            object v = Ruta(d, ruta);
            return v is bool ? (bool)v : defecto;
        }

        public static IList Lista(Dictionary<string, object> d, string ruta)
        {
            return Ruta(d, ruta) as IList;
        }

        /// <summary>Mezcla profunda: los valores de "encima" ganan; los objetos se mezclan y las listas se reemplazan.</summary>
        public static Dictionary<string, object> Fusionar(Dictionary<string, object> baseD, Dictionary<string, object> encima)
        {
            var r = new Dictionary<string, object>();
            if (baseD != null) foreach (var kv in baseD) r[kv.Key] = kv.Value;
            if (encima == null) return r;
            foreach (var kv in encima)
            {
                var a = r.ContainsKey(kv.Key) ? r[kv.Key] as Dictionary<string, object> : null;
                var b = kv.Value as Dictionary<string, object>;
                r[kv.Key] = (a != null && b != null) ? Fusionar(a, b) : kv.Value;
            }
            return r;
        }
    }
}

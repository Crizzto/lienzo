using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace Lienzo
{
    /// <summary>Los fondos animados: una superficie por monitor colgada detrás de los iconos.</summary>
    internal partial class App
    {
        public readonly List<Superficie> Fondos = new List<Superficie>();
        private Timer relojVerificar, relojRecrear;
        private bool creandoFondos;

        private async Task IniciarModulos()
        {
            Escritorio.Preparar();
            await CrearFondos();

            relojVerificar = new Timer { Interval = 5000 };
            relojVerificar.Tick += (o, e) => VerificarFondos();
            relojVerificar.Start();

            await IniciarResto();
        }

        public async Task CrearFondos()
        {
            if (creandoFondos) return;
            creandoFondos = true;
            try
            {
                foreach (var f in Fondos.ToList()) f.Cerrar();
                Fondos.Clear();
                if (!CfgBool("fondo.activo", true)) return;
                bool soloPrincipal = CfgBool("rendimiento.soloPrincipal", false);
                int n = 0;
                foreach (var mon in Monitor.Todos())
                {
                    if (soloPrincipal && !mon.Principal) continue;
                    var cp = Superficie.Parametros("Lienzo.Fondo", Nativo.WS_POPUP | Nativo.WS_CLIPCHILDREN,
                        Nativo.WS_EX_LAYERED | Nativo.WS_EX_NOACTIVATE | Nativo.WS_EX_TOOLWINDOW, mon.Area);
                    var s = new Superficie("fondo", cp) { SinActivar = true, Etiqueta = mon };
                    if (!Escritorio.Adjuntar(s.Handle, mon.Area))
                    {
                        Registro("No pude colocar el fondo detrás de los iconos en " + mon.Nombre);
                        s.Cerrar();
                        continue;
                    }
                    s.Mensaje += AlMensaje;
                    s.Destruida += x => ProgramarRecreacion();
                    Fondos.Add(s);
                    await s.Iniciar(Entorno, "escritorio.html?monitor=" + n + (mon.Principal ? "&principal=1" : ""), false);
                    n++;
                }
                Registro("Fondos creados: " + Fondos.Count);
            }
            finally { creandoFondos = false; }
        }

        private void VerificarFondos()
        {
            if (Saliendo || creandoFondos) return;
            foreach (var f in Fondos)
            {
                var mon = (Monitor)f.Etiqueta;
                if (!Escritorio.Verificar(f.Handle, mon.Area)) { ProgramarRecreacion(); return; }
            }
        }

        /// <summary>Recrea los fondos un momento después (Explorer reiniciado, monitores cambiados...).</summary>
        public void ProgramarRecreacion()
        {
            if (Saliendo) return;
            if (relojRecrear == null)
            {
                relojRecrear = new Timer { Interval = 1500 };
                relojRecrear.Tick += async (o, e) =>
                {
                    relojRecrear.Stop();
                    if (Saliendo) return;
                    Registro("Recreando fondos…");
                    Escritorio.Preparar();
                    await CrearFondos();
                };
            }
            relojRecrear.Stop();
            relojRecrear.Start();
        }

        public void EnviarAFondos(string tipo, object datos)
        {
            foreach (var f in Fondos) f.Enviar(tipo, datos);
        }
    }
}

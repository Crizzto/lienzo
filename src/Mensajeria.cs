using System;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using Timer = System.Windows.Forms.Timer;

namespace Lienzo
{
    /// <summary>Reparto de mensajes entre las páginas web y Windows, y datos que se envían cada poco.</summary>
    internal partial class App
    {
        private Timer relojDatos, relojVentanas, relojMusica;
        private uint msgShellHook;
        private SynchronizationContext ui;
        private string ultimasVentanasJson = "", ultimaMusicaJson = "";
        private readonly Dictionary<Superficie, HashSet<string>> iconosEnviados = new Dictionary<Superficie, HashSet<string>>();
        private readonly HashSet<long> ventanasAtencion = new HashSet<long>();
        private int vueltas;

        private IEnumerable<Superficie> Todas()
        {
            foreach (var f in Fondos) yield return f;
            if (Barra != null) yield return Barra;
            if (Panel != null) yield return Panel;
            if (Editor != null) yield return Editor;
        }

        private async Task IniciarResto()
        {
            ui = SynchronizationContext.Current;
            PrepararCarpetaEscenas();
            AplicarAjustesWindows(null);
            await CrearBarra();
            IniciarRendimiento();

            msgShellHook = Nativo.RegisterWindowMessage("SHELLHOOK");
            Nativo.RegisterShellHookWindow(Mensajes.Handle);
            Mensajes.Recibido += AlMensajeShell;

            relojVentanas = new Timer { Interval = 120 };
            relojVentanas.Tick += (o, e) => { relojVentanas.Stop(); ActualizarVentanas(false); };
            relojDatos = new Timer { Interval = 2000 };
            relojDatos.Tick += (o, e) => AlTicDatos();
            relojDatos.Start();
            relojMusica = new Timer { Interval = 1500 };
            relojMusica.Tick += (o, e) => ActualizarMusica();
            relojMusica.Start();
            await Musica.Iniciar();
            ActualizarToques();

            CrearIconoBandeja();
            if (PrimeraVez || Argumentos.Contains("--panel")) AbrirPanel(PrimeraVez ? "bienvenida" : null);
            if (Argumentos.Contains("--editar")) AbrirEditor();
        }

        private void Detener()
        {
            foreach (var t in new[] { relojVerificar, relojDatos, relojVentanas, relojMusica, relojRendimiento, relojMouse, relojRecrear, relojPosicion })
                if (t != null) t.Stop();
            try { if (Mensajes != null) Nativo.DeregisterShellHookWindow(Mensajes.Handle); } catch { }
            ApagarToques();
            CerrarEditor();
            CerrarPanel();
            CerrarBarra();
            foreach (var f in Fondos) f.Cerrar();
            Fondos.Clear();
            QuitarIconoBandeja();
            try { Aspecto.RestaurarIconos(); } catch { }
        }

        public void Comando(int orden)
        {
            if (orden == CmdPanel) AbrirPanel(null);
            else if (orden == CmdEditar) AbrirEditor();
        }

        public async void AlReiniciarExplorer()
        {
            // Explorer olvidó nuestra AppBar y destruyó los fondos (eran hijos de su ventana).
            appBarRegistrada = false;
            await Task.Delay(1500);
            if (Saliendo) return;
            if (Barra != null) { RegistrarAppBar(); PosicionarBarra(); }
            BarraWindows.Aplicar(Cfg("barraWindows.modo", "auto"));
            if (Mensajes != null) Nativo.RegisterShellHookWindow(Mensajes.Handle);
            Escritorio.Preparar();
            await CrearFondos();
            AplicarAjustesWindows(null);
            ActualizarToques();
        }

        // ---------------- Mensajes de las páginas ----------------

        private void AlMensaje(Superficie s, Dictionary<string, object> m)
        {
            string tipo = Json.Texto(m, "tipo", "");
            try { Despachar(s, tipo, m); }
            catch (Exception ex) { Registro("Mensaje '" + tipo + "': " + ex); }
        }

        private void Despachar(Superficie s, string tipo, Dictionary<string, object> m)
        {
            switch (tipo)
            {
                case "listo":
                    iconosEnviados[s] = new HashSet<string>();
                    s.Enviar("config", Json.Nuevo("config", Config, "primeraVez", PrimeraVez));
                    EnviarInicial(s);
                    break;
                case "registro":
                    Registro("[" + s.Nombre + "] " + Json.Texto(m, "texto", ""));
                    break;
                case "guardarConfig":
                    {
                        var nueva = Json.Ruta(m, "config") as Dictionary<string, object>;
                        if (nueva != null) CambiarConfig(nueva);
                        break;
                    }
                case "paletaCalculada":
                    if (Cfg("paleta.modo", "auto") == "auto" && Json.Ruta(m, "colores") is Dictionary<string, object>)
                    {
                        var c = Json.Fusionar(Config, null);
                        var paleta = Json.Fusionar(Json.Ruta(c, "paleta") as Dictionary<string, object>, null);
                        if (Json.Escribir(paleta["colores"]) == Json.Escribir(m["colores"])) break;
                        paleta["colores"] = m["colores"];
                        c["paleta"] = paleta;
                        CambiarConfig(c);
                    }
                    break;
                case "guardarBloques":
                    {
                        var c = Json.Fusionar(Config, null);
                        c["bloques"] = Json.Ruta(m, "bloques") ?? new object[0];
                        CambiarConfig(c);
                        if (Json.Bool(m, "cerrar", true)) CerrarEditor();
                        break;
                    }
                case "abrirPanel": AbrirPanel(Json.Texto(m, "seccion", null)); break;
                case "cerrarPanel": CerrarPanel(); break;
                case "abrirEditor": AbrirEditor(); break;
                case "cerrarEditor": CerrarEditor(); break;
                case "ventana":
                    {
                        var h = new IntPtr((long)Json.Numero(m, "h", 0));
                        string accion = Json.Texto(m, "accion", "alternar");
                        if (accion == "activar") Tareas.Activar(h);
                        else if (accion == "minimizar") Nativo.ShowWindow(h, Nativo.SW_MINIMIZE);
                        else if (accion == "cerrar") Tareas.Cerrar(h);
                        else Tareas.Alternar(h);
                        ventanasAtencion.Remove(h.ToInt64());
                        ProgramarVentanas();
                        break;
                    }
                case "lanzar": Tareas.Lanzar(Json.Texto(m, "destino", "")); break;
                case "teclas": Atajo(Json.Texto(m, "combo", "")); break;
                case "toqueBarra": AlTocarBarra(); break;
                case "media": AccionMusica(Json.Texto(m, "accion", "pausa")); break;
                case "volumen":
                    {
                        object nivel = Json.Ruta(m, "nivel"), delta = Json.Ruta(m, "delta");
                        Sistema.CambiarVolumen(nivel != null ? (double?)Json.Numero(m, "nivel", 0) : null,
                            delta != null ? (double?)Json.Numero(m, "delta", 0) : null, Json.Bool(m, "silencio", false));
                        EnviarSistema();
                        break;
                    }
                case "bandeja": BarraWindows.MostrarBandeja(); break;
                case "elegirArchivo": ElegirArchivo(s, Json.Texto(m, "para", "fondo")); break;
                case "pedirApps": PedirApps(s); break;
                case "pedirIconos": PedirIconos(s, Json.Lista(m, "claves"), (int)Json.Numero(m, "tam", 48)); break;
                case "pedirEscenasPropias": s.Enviar("escenasPropias", Json.Nuevo("lista", EscenasPropias())); break;
                case "abrirCarpeta": AbrirCarpeta(Json.Texto(m, "cual", "datos")); break;
                case "borrarArchivo": BorrarDeBiblioteca(s, Json.Texto(m, "archivo", "")); break;
                case "pausarFondo": PausaManual(Json.Bool(m, "pausado", !EnPausaManual)); EnviarEstadoWindows(s); break;
                case "pedirEstadoWindows": EnviarEstadoWindows(s); break;
                case "abrirEnlace": AbrirExterno(Json.Texto(m, "url", "")); break;
                case "buscarFondos": BuscarFondos(s, m); break;
                case "descargarFondo": DescargarFondo(s, m); break;
                case "pedirHerramientas": EnviarHerramientas(s); break;
                case "instalarYtdlp": InstalarYtdlp(s); break;
                case "exportarRice": ExportarRice(s, Json.Texto(m, "nombre", "Mi rice")); break;
                case "importarRice": ImportarRice(s); break;
                case "deshacerWindows": DeshacerWindows(); break;
                case "salir": Salir(); break;
            }
        }

        private void EnviarInicial(Superficie s)
        {
            if (s == Barra) { ultimasVentanasJson = ""; ActualizarVentanas(true); }
            var datos = Sistema.Datos();
            s.Enviar("sistema", datos);
            s.Enviar("ficha", Sistema.Ficha());
            if (ultimaMusicaJson.Length > 0)
            {
                var musica = Json.Objeto(ultimaMusicaJson);
                if (musica != null)
                {
                    musica["portada"] = Musica.PortadaActual ?? "";
                    s.Enviar("musica", musica);
                }
            }
            if (s.Nombre == "fondo") s.Enviar("pausa", Json.Nuevo("pausado", EstadoDe(s).StartsWith("pausa"), "motivo", "", "reducido", EstadoDe(s) == "reducido"));
            if (s == Panel) EnviarEstadoWindows(s);
        }

        private void EnviarEstadoWindows(Superficie s)
        {
            s.Enviar("estadoWindows", Json.Nuevo(
                "iconos", Aspecto.IconosVisibles(),
                "tamanoIconos", Aspecto.TamanoIconos(),
                "tema", Aspecto.TemaActual(),
                "barraAuto", BarraWindows.EnAutoOcultar(),
                "cambiosWindows", Aspecto.HayCambiosGuardados(),
                "pausaManual", EnPausaManual,
                "estadoFondo", Fondos.Count > 0 ? EstadoDe(Fondos[0]) : "sin-fondo",
                "fondos", Fondos.Count,
                "escritorio", Escritorio.Elevado ? "24H2+" : "clásico",
                "version", Application.ProductVersion,
                "terminal", Terminal.Rutas().Count > 0,
                "carpetaDatos", DirDatos));
        }

        // ---------------- Configuración ----------------

        private void CambiarConfig(Dictionary<string, object> nueva)
        {
            var anterior = Config;
            GuardarConfig(nueva);
            PrimeraVez = false;
            foreach (var s in Todas()) s.Enviar("config", Json.Nuevo("config", Config));
            AplicarConfig(anterior);
        }

        private bool Cambio(Dictionary<string, object> anterior, string ruta)
        {
            if (anterior == null) return true;
            return Json.Escribir(Json.Ruta(anterior, ruta)) != Json.Escribir(Json.Ruta(Config, ruta));
        }

        private async void AplicarConfig(Dictionary<string, object> anterior)
        {
            if (Cambio(anterior, "fondo.activo") || Cambio(anterior, "rendimiento.soloPrincipal")) await CrearFondos();
            if (Cambio(anterior, "fondo") || Cambio(anterior, "rendimiento")) { ActualizarRelojMouse(); RevisarRendimiento(); }
            if (Cambio(anterior, "bloques") || Cambio(anterior, "fondo.activo")) { ActualizarToques(); ActualizarRelojMouse(); }

            if (Cambio(anterior, "barra.activa"))
            {
                if (CfgBool("barra.activa", true)) await CrearBarra(); else CerrarBarra();
            }
            else if (Barra != null)
            {
                if (Cambio(anterior, "barra.posicion") || Cambio(anterior, "barra.grosor") || Cambio(anterior, "barra.flotante") || Cambio(anterior, "barra.margen"))
                    PosicionarBarra();
                if (Cambio(anterior, "barra") || Cambio(anterior, "paleta")) AplicarEstiloBarra();
            }
            AplicarAjustesWindows(anterior);
        }

        /// <summary>Ajustes que tocan Windows. Con anterior = null se aplica solo lo que no es "no tocar".</summary>
        private void AplicarAjustesWindows(Dictionary<string, object> anterior)
        {
            if (Cambio(anterior, "barraWindows.modo")) BarraWindows.Aplicar(Cfg("barraWindows.modo", "auto"));
            if (Cambio(anterior, "barraWindows.alineacion")) Aspecto.AlinearBarraWindows(Cfg("barraWindows.alineacion", "no-tocar"));
            if (Cambio(anterior, "escritorio.iconos"))
            {
                bool mostrar = CfgBool("escritorio.iconos", true);
                if (anterior != null || !mostrar) Aspecto.MostrarIconos(mostrar);
            }
            if (Cambio(anterior, "escritorio.tamanoIconos"))
            {
                int tam = (int)CfgNum("escritorio.tamanoIconos", 0);
                if (tam > 0) Aspecto.CambiarTamanoIconos(tam);
            }
            foreach (var cual in new[] { "busqueda", "vistaTareas", "widgets", "agrupar", "esquina" })
                if (Cambio(anterior, "barraWindows." + cual))
                {
                    string aviso = Aspecto.AjusteBarraWindows(cual, Cfg("barraWindows." + cual, "no-tocar"));
                    if (aviso != null && anterior != null) AvisarPanel(aviso);
                }

            if (Cambio(anterior, "windows.tema")) Aspecto.CambiarTema(Cfg("windows.tema", "no-tocar"));
            if (Cambio(anterior, "windows.transparencia")) Aspecto.Transparencia(Cfg("windows.transparencia", "no-tocar"));
            // "lienzo": el color de énfasis de Windows sigue al acento del tema de Lienzo (cambia con cada rice).
            string modoAcento = Cfg("windows.acento", "no-tocar");
            string colorAcento = modoAcento == "lienzo" ? Cfg("paleta.colores.acento", "") : modoAcento == "elegido" ? Cfg("windows.colorAcento", "") : null;
            if (colorAcento != null && (Cambio(anterior, "windows.acento") || Cambio(anterior, "windows.colorAcento") || Cambio(anterior, "paleta.colores.acento")))
                Aspecto.CambiarAcento(colorAcento);
            if (Cambio(anterior, "windows.colorEnBarra")) Aspecto.ColorEnBarra(Cfg("windows.colorEnBarra", "no-tocar"));
            if (Cambio(anterior, "windows.colorEnTitulos")) Aspecto.ColorEnTitulos(Cfg("windows.colorEnTitulos", "no-tocar"));
            if (anterior != null && Panel != null) EnviarEstadoWindows(Panel);
            if (anterior != null && Cambio(anterior, "general.iniciarConWindows")) Aspecto.IniciarConWindows(CfgBool("general.iniciarConWindows", false));
            if (anterior == null && CfgBool("general.iniciarConWindows", false)) Aspecto.IniciarConWindows(true); // por si se movió la carpeta
            RevisarTerminal(anterior);
        }

        private void AvisarPanel(string texto)
        {
            if (Panel != null) Panel.Enviar("aviso", Json.Nuevo("texto", texto));
        }

        /// <summary>Botón «Deshacer mis cambios en Windows»: restaura el registro y deja esos ajustes en "No cambiar".</summary>
        private void DeshacerWindows()
        {
            int n = Aspecto.DeshacerCambios();
            var c = Json.Fusionar(Config, null);
            var bw = Json.Fusionar(Json.Ruta(c, "barraWindows") as Dictionary<string, object>, null);
            foreach (var k in new[] { "alineacion", "busqueda", "vistaTareas", "widgets", "agrupar", "esquina" }) bw[k] = "no-tocar";
            c["barraWindows"] = bw;
            var w = Json.Fusionar(Json.Ruta(c, "windows") as Dictionary<string, object>, null);
            foreach (var k in new[] { "tema", "transparencia", "acento", "colorEnBarra", "colorEnTitulos" }) w[k] = "no-tocar";
            c["windows"] = w;
            CambiarConfig(c);
            AvisarPanel(n > 0 ? "Listo: Windows quedó como estaba antes de Lienzo." : "No había cambios de Lienzo que deshacer.");
        }

        // ---------------- Datos periódicos ----------------

        private void AlTicDatos()
        {
            if (Saliendo) return;
            EnviarSistema();
            ActualizarVentanas(false);
            if (++vueltas % 30 == 0) Tareas.LimpiarCaches(); // cada minuto
        }

        private void EnviarSistema()
        {
            var d = Sistema.Datos();
            d["tipo"] = "sistema";
            string json = Json.Escribir(d);
            foreach (var s in Todas())
                if (s.Nombre != "fondo" || !EstadoDe(s).StartsWith("pausa")) s.EnviarCrudo(json);
        }

        private void AlMensajeShell(Message m)
        {
            if (m.Msg != (int)msgShellHook || msgShellHook == 0) return;
            int codigo = m.WParam.ToInt32() & 0x7FFF;
            long h = m.LParam.ToInt64();
            if (m.WParam.ToInt32() == Nativo.HSHELL_FLASH) ventanasAtencion.Add(h);
            else if (codigo == Nativo.HSHELL_WINDOWACTIVATED) ventanasAtencion.Remove(h);
            else if (codigo == Nativo.HSHELL_WINDOWDESTROYED) ventanasAtencion.Remove(h);
            ProgramarVentanas();
        }

        private void ProgramarVentanas()
        {
            if (relojVentanas == null) return;
            relojVentanas.Stop();
            relojVentanas.Start();
        }

        private void ActualizarVentanas(bool forzar)
        {
            if (Barra == null || !Barra.Lista && !forzar) return;
            var lista = Tareas.Listar();
            var salida = new List<object>();
            foreach (var v in lista)
                salida.Add(Json.Nuevo("h", v.H.ToInt64(), "titulo", v.Titulo, "clave", v.Clave, "ruta", v.Ruta ?? "",
                    "activa", v.Activa, "min", v.Minimizada, "atencion", ventanasAtencion.Contains(v.H.ToInt64())));
            var fijadas = new List<object>();
            var listaFijadas = Json.Lista(Config, "fijadas");
            if (listaFijadas != null)
                foreach (var f in listaFijadas.OfType<Dictionary<string, object>>())
                {
                    string clave = Json.Texto(f, "clave", "");
                    fijadas.Add(Json.Nuevo("clave", clave, "ruta", Tareas.RutaReal(clave) ?? ""));
                }
            string json = Json.Escribir(salida) + Json.Escribir(fijadas);
            if (!forzar && json == ultimasVentanasJson) return;
            ultimasVentanasJson = json;

            HashSet<string> enviados;
            if (!iconosEnviados.TryGetValue(Barra, out enviados)) iconosEnviados[Barra] = enviados = new HashSet<string>();
            var iconos = new Dictionary<string, object>();
            int tam = (int)Math.Round(32 * (monitorBarra != null ? monitorBarra.Escala : 1.5));
            tam = Math.Max(32, Math.Min(64, tam));
            foreach (var v in lista)
                if (!enviados.Contains(v.Clave)) { iconos[v.Clave] = Tareas.Icono(v.Clave, v.H, tam) ?? ""; enviados.Add(v.Clave); }
            if (listaFijadas != null)
                foreach (var f in listaFijadas.OfType<Dictionary<string, object>>())
                {
                    string clave = Json.Texto(f, "clave", "");
                    if (clave.Length > 0 && !enviados.Contains(clave)) { iconos[clave] = Tareas.Icono(clave, IntPtr.Zero, tam) ?? ""; enviados.Add(clave); }
                }
            Barra.Enviar("ventanas", Json.Nuevo("lista", salida, "fijadas", fijadas, "iconos", iconos));
        }

        private bool musicaOcupada;

        private async void ActualizarMusica()
        {
            if (musicaOcupada || Saliendo) return;
            musicaOcupada = true;
            try
            {
                var d = await Musica.Estado();
                string portada = null;
                if (d != null && d.ContainsKey("portada")) { portada = (string)d["portada"]; d.Remove("portada"); }
                bool cambio = d != null && d.ContainsKey("cambio");
                if (d != null) d.Remove("cambio");
                string json = d == null ? "{}" : Json.Escribir(d);
                if (json == ultimaMusicaJson && !cambio) return;
                ultimaMusicaJson = json;
                var envio = d ?? new Dictionary<string, object>();
                envio["activa"] = d != null;
                if (portada != null) envio["portada"] = portada;
                foreach (var s in Todas())
                    if (s.Nombre != "fondo" || !EstadoDe(s).StartsWith("pausa")) s.Enviar("musica", envio);
            }
            catch (Exception ex) { Registro("Actualizar música: " + ex.Message); }
            finally { musicaOcupada = false; }
        }

        private async void AccionMusica(string accion)
        {
            await Musica.Accion(accion);
            await Task.Delay(350);
            ActualizarMusica();
        }

        private static bool AbrirUri(string uri)
        {
            try { Process.Start(new ProcessStartInfo(uri) { UseShellExecute = true }); return true; }
            catch { return false; }
        }

        // ---------------- Menús de Windows abiertos desde la barra ----------------
        // La barra no roba el foco (para no quitárselo a tu ventana), así que un clic en ella no cierra
        // Inicio, los ajustes rápidos ni las notificaciones: Windows solo los cierra cuando pierden el foco.
        // Por eso, al tocar la barra, si uno de esos menús está delante se cierra con Esc, y si era el
        // mismo botón que lo abrió no se vuelve a abrir (funciona como interruptor).

        private static readonly HashSet<string> MenusShell = new HashSet<string> { "inicio", "buscar", "ajustesRapidos", "notificaciones", "widgets" };
        private static readonly HashSet<string> ProcesosMenus = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            { "ShellExperienceHost", "ShellHost", "StartMenuExperienceHost", "SearchHost", "SearchApp", "Widgets", "WidgetBoard" };
        // Ventanas de explorer.exe que son menús emergentes (no el Explorador de archivos ni sus diálogos).
        private static readonly HashSet<string> ClasesMenusExplorer = new HashSet<string>
            { "Windows.UI.Core.CoreWindow", "ApplicationManager_DesktopShellWindow", "XamlExplorerHostIslandWindow",
              "TopLevelWindowForOverflowXamlIsland", "NotifyIconOverflowWindow", "ControlCenterWindow", "Xaml_WindowedPopupClass" };
        private string menuAbierto, menuCerrado;
        private DateTime menuCerradoEn;

        private static bool MenuShellDelante()
        {
            IntPtr h = Nativo.GetForegroundWindow();
            if (h == IntPtr.Zero) return false;
            uint pid;
            Nativo.GetWindowThreadProcessId(h, out pid);
            string ruta = Nativo.RutaProceso(pid);
            if (string.IsNullOrEmpty(ruta)) return false;
            string proceso = Path.GetFileNameWithoutExtension(ruta);
            if (ProcesosMenus.Contains(proceso)) return true;
            return proceso.Equals("explorer", StringComparison.OrdinalIgnoreCase) && ClasesMenusExplorer.Contains(Nativo.Clase(h));
        }

        /// <summary>La página de la barra avisa al pulsar el ratón (antes del clic).</summary>
        private void AlTocarBarra()
        {
            if (!MenuShellDelante()) { menuAbierto = null; return; }
            Nativo.Teclas(Nativo.VK_ESCAPE);
            menuCerrado = menuAbierto;
            menuCerradoEn = DateTime.Now;
            menuAbierto = null;
        }

        private async void Atajo(string combo)
        {
            bool esMenu = MenusShell.Contains(combo);
            if (esMenu && combo == menuCerrado && (DateTime.Now - menuCerradoEn).TotalMilliseconds < 1500)
            {
                menuCerrado = null;   // segundo clic en el mismo botón: solo cerrar
                return;
            }
            // Si se acaba de cerrar otro menú, se le da un momento para que termine de irse.
            if (menuCerrado != null && (DateTime.Now - menuCerradoEn).TotalMilliseconds < 400) await Task.Delay(180);
            menuCerrado = null;
            if (esMenu) menuAbierto = combo;
            Teclear(combo);
        }

        private static void Teclear(string combo)
        {
            ushort win = Nativo.VK_LWIN;
            switch (combo)
            {
                case "inicio":
                    {
                        // El propio Windows abre el menú Inicio con SC_TASKLIST; las teclas quedan de respaldo.
                        IntPtr barra = BarraWindows.Principal;
                        if (barra == IntPtr.Zero || !Nativo.PostMessage(barra, Nativo.WM_SYSCOMMAND, new IntPtr(0xF130), IntPtr.Zero)) Nativo.Teclas(win);
                        break;
                    }
                case "buscar": Nativo.Teclas(win, 0x53); break;            // Win+S
                // Con el atajo, Windows abre el menú con el foco (y se cierra al hacer clic fuera);
                // con el enlace ms-actioncenter se abría sin foco y se quedaba trabado.
                case "ajustesRapidos": if (!Nativo.Teclas(win, 0x41)) AbrirUri("ms-actioncenter:controlcenter/"); break;   // Win+A
                case "notificaciones": if (!Nativo.Teclas(win, 0x4E)) AbrirUri("ms-actioncenter:"); break;                 // Win+N
                case "vistaTareas": Nativo.Teclas(win, Nativo.VK_TAB); break;
                case "widgets": Nativo.Teclas(win, 0x57); break;           // Win+W
                case "explorador": Nativo.Teclas(win, 0x45); break;        // Win+E
                case "escritorio": Nativo.Teclas(win, 0x44); break;        // Win+D
                case "configuracion": Nativo.Teclas(win, 0x49); break;     // Win+I
                case "captura": Nativo.Teclas(win, Nativo.VK_SHIFT, 0x53); break;
                case "emojis": Nativo.Teclas(win, 0xBE); break;            // Win+.
            }
        }

        // ---------------- Archivos, apps y escenas propias ----------------

        private void EnSta(Action trabajo)
        {
            var t = new Thread(() =>
            {
                try { trabajo(); }
                catch (Exception ex) { Registro("Tarea en segundo plano: " + ex.Message); }
            }) { IsBackground = true };
            t.SetApartmentState(ApartmentState.STA);
            t.Start();
        }

        private void EnUi(Action a)
        {
            if (ui != null) ui.Post(o => { if (!Saliendo) a(); }, null); else a();
        }

        private void ElegirArchivo(Superficie s, string para)
        {
            using (var d = new OpenFileDialog())
            {
                if (para == "app")
                {
                    d.Title = "Elige un programa o acceso directo para fijarlo en la barra";
                    d.Filter = "Programas y accesos directos|*.exe;*.lnk;*.bat;*.cmd|Todos los archivos|*.*";
                }
                else
                {
                    d.Title = "Elige una imagen o un video para el fondo";
                    d.Filter = "Imágenes y videos|*.mp4;*.webm;*.mov;*.m4v;*.jpg;*.jpeg;*.png;*.webp;*.gif;*.bmp;*.avif|" +
                               "Videos|*.mp4;*.webm;*.mov;*.m4v|Imágenes|*.jpg;*.jpeg;*.png;*.webp;*.gif;*.bmp;*.avif";
                }
                if (d.ShowDialog(new Envoltura(s.Handle)) != DialogResult.OK)
                {
                    s.Enviar("archivoElegido", Json.Nuevo("para", para, "cancelado", true));
                    return;
                }
                string ruta = d.FileName;
                if (para == "app")
                {
                    string nombre = Path.GetFileNameWithoutExtension(ruta);
                    EnSta(() =>
                    {
                        string icono = Tareas.Icono(ruta, IntPtr.Zero, 64);
                        EnUi(() => s.Enviar("archivoElegido", Json.Nuevo("para", para,
                            "app", Json.Nuevo("nombre", nombre, "clave", ruta, "destino", ruta), "icono", icono ?? "")));
                    });
                }
                else ImportarFondo(s, ruta);
            }
        }

        private void ImportarFondo(Superficie s, string ruta, string nombreVisible = null, string miniaturaRespaldo = null)
        {
            string nombre = string.IsNullOrEmpty(nombreVisible) ? Path.GetFileNameWithoutExtension(ruta) : nombreVisible;
            s.Enviar("importando", Json.Nuevo("nombre", nombre));
            EnSta(() =>
            {
                string carpeta = Path.Combine(DirDatos, "biblioteca");
                string ext = Path.GetExtension(ruta).ToLowerInvariant();
                string limpio = Regex.Replace(nombre, @"[^\w\-]+", "-").Trim('-');
                if (limpio.Length == 0) limpio = "fondo";
                if (limpio.Length > 40) limpio = limpio.Substring(0, 40);
                string id = limpio + "-" + DateTime.Now.ToString("yyMMddHHmmss");
                string destino = Path.Combine(carpeta, id + ext);
                string error = null;
                try
                {
                    if (string.Equals(Path.GetDirectoryName(Path.GetFullPath(ruta)), Path.GetFullPath(carpeta), StringComparison.OrdinalIgnoreCase))
                    { destino = ruta; id = Path.GetFileNameWithoutExtension(ruta); }
                    else File.Copy(ruta, destino, false);
                }
                catch (Exception ex) { error = ex.Message; }

                Dictionary<string, object> entrada = error == null ? EntradaBiblioteca(destino, id, nombre, miniaturaRespaldo) : null;
                if (miniaturaRespaldo != null) try { File.Delete(miniaturaRespaldo); } catch { }
                EnUi(() => s.Enviar("archivoElegido", Json.Nuevo("para", "fondo", "entrada", entrada, "error", error ?? "")));
            });
        }

        /// <summary>Una imagen de disco sin dejar el archivo bloqueado (o null).</summary>
        private static Bitmap CargarImagen(string ruta)
        {
            if (string.IsNullOrEmpty(ruta) || !File.Exists(ruta)) return null;
            try { using (var ms = new MemoryStream(File.ReadAllBytes(ruta))) using (var img = Image.FromStream(ms)) return new Bitmap(img); }
            catch { return null; }
        }

        /// <summary>Datos de un archivo ya copiado en la biblioteca: miniatura y colores dominantes (en un hilo STA).</summary>
        private Dictionary<string, object> EntradaBiblioteca(string destino, string id, string nombre, string miniaturaRespaldo = null)
        {
            string ext = Path.GetExtension(destino).ToLowerInvariant();
            bool video = ext == ".mp4" || ext == ".webm" || ext == ".mov" || ext == ".m4v";
            string miniatura = "";
            var dominantes = new List<Dictionary<string, object>>();
            using (var bmp = Tareas.Miniatura(destino, 360) ?? CargarImagen(miniaturaRespaldo))
            {
                if (bmp != null)
                {
                    Directory.CreateDirectory(Path.Combine(DirDatos, "miniaturas"));
                    string archivoMini = Path.Combine(DirDatos, "miniaturas", id + ".jpg");
                    File.WriteAllBytes(archivoMini, Convert.FromBase64String(Tareas.DataUrlJpeg(bmp, 360).Split(',')[1]));
                    miniatura = "miniaturas/" + id + ".jpg";
                    dominantes = Paleta.Dominantes(bmp, 6);
                }
            }
            return Json.Nuevo("id", id, "nombre", nombre, "tipo", video ? "video" : "imagen",
                "archivo", "biblioteca/" + Path.GetFileName(destino), "miniatura", miniatura,
                "dominantes", dominantes, "fecha", DateTime.Now.ToString("s"));
        }

        private void BorrarDeBiblioteca(Superficie s, string archivo)
        {
            try
            {
                string completo = Path.GetFullPath(Path.Combine(DirDatos, archivo));
                string bib = Path.GetFullPath(Path.Combine(DirDatos, "biblioteca"));
                if (!completo.StartsWith(bib + "\\", StringComparison.OrdinalIgnoreCase)) return;
                if (File.Exists(completo)) File.Delete(completo);
                string mini = Path.Combine(DirDatos, "miniaturas", Path.GetFileNameWithoutExtension(completo) + ".jpg");
                if (File.Exists(mini)) File.Delete(mini);
            }
            catch (Exception ex) { s.Enviar("aviso", Json.Nuevo("texto", "No se pudo borrar el archivo: " + ex.Message)); }
        }

        private void PedirApps(Superficie s)
        {
            EnSta(() =>
            {
                var lista = Tareas.AppsInstaladas();
                EnUi(() => s.Enviar("apps", Json.Nuevo("lista", lista)));
            });
        }

        private void PedirIconos(Superficie s, IList claves, int tam)
        {
            if (claves == null) return;
            tam = Math.Max(16, Math.Min(256, tam));
            var lista = claves.OfType<string>().Take(200).ToList();
            EnSta(() =>
            {
                var iconos = new Dictionary<string, object>();
                foreach (var c in lista) iconos[c] = Tareas.Icono(c, IntPtr.Zero, tam) ?? "";
                EnUi(() => s.Enviar("iconos", Json.Nuevo("iconos", iconos, "tam", tam)));
            });
        }

        private void AbrirCarpeta(string cual)
        {
            string ruta = cual == "escenas" ? Path.Combine(DirDatos, "escenas") : cual == "biblioteca" ? Path.Combine(DirDatos, "biblioteca") : DirDatos;
            Directory.CreateDirectory(ruta);
            Process.Start(new ProcessStartInfo("explorer.exe", "\"" + ruta + "\"") { UseShellExecute = true });
        }

        /// <summary>Escenas HTML propias: carpetas en %APPDATA%\Lienzo\escenas con un index.html.</summary>
        private List<object> EscenasPropias()
        {
            var lista = new List<object>();
            string raiz = Path.Combine(DirDatos, "escenas");
            if (!Directory.Exists(raiz)) return lista;
            foreach (var dir in Directory.GetDirectories(raiz))
            {
                string index = Path.Combine(dir, "index.html");
                if (!File.Exists(index)) continue;
                string carpeta = Path.GetFileName(dir), nombre = carpeta;
                try
                {
                    var mt = Regex.Match(File.ReadAllText(index, Encoding.UTF8), @"<title>([^<]{1,80})</title>", RegexOptions.IgnoreCase);
                    if (mt.Success) nombre = mt.Groups[1].Value.Trim();
                }
                catch { }
                string vista = new[] { "vista.png", "vista.jpg", "preview.png", "preview.jpg" }.FirstOrDefault(v => File.Exists(Path.Combine(dir, v)));
                lista.Add(Json.Nuevo("carpeta", carpeta, "nombre", nombre, "vista", vista != null ? "escenas/" + carpeta + "/" + vista : ""));
            }
            return lista;
        }

        /// <summary>La primera vez se copia una escena de ejemplo para que se vea cómo hacer las tuyas.</summary>
        private void PrepararCarpetaEscenas()
        {
            try
            {
                string raiz = Path.Combine(DirDatos, "escenas");
                string ejemplo = Path.Combine(DirWeb, "ejemplos", "escena-propia");
                if (!Directory.Exists(ejemplo) || Directory.GetDirectories(raiz).Length > 0) return;
                string destino = Path.Combine(raiz, "ejemplo-burbujas");
                Directory.CreateDirectory(destino);
                foreach (var f in Directory.GetFiles(ejemplo)) File.Copy(f, Path.Combine(destino, Path.GetFileName(f)), true);
            }
            catch (Exception ex) { Registro("Escena de ejemplo: " + ex.Message); }
        }
    }
}

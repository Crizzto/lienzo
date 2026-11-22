# Lienzo

Personaliza el escritorio de Windows 11 como los *rices* de Linux que salen en TikTok. Tiene:

- **Fondos animados** detrás de los iconos, como Wallpaper Engine.
- **Una barra propia** que puedes poner arriba, abajo o a un lado.
- **Bloques** que arrastras por el escritorio: reloj, música, ficha del sistema y más.
- **Colores automáticos** sacados del fondo.

Todo gasta lo mínimo: el fondo se pausa solo cuando no se ve.

## Instalar

1. Descarga `Lienzo-Instalador-<versión>.exe` desde **Releases** (en la columna derecha del repositorio).
2. Ábrelo y pulsa **Instalar**. Se instala solo para tu usuario en `%LOCALAPPDATA%\Programs\Lienzo`, sin pedir permisos de administrador, y aparece en el menú Inicio. No hace falta Node ni nada más.
   - Si a tu equipo le falta algo que Lienzo necesita, el instalador lo descarga e instala solo: el motor **WebView2** de Microsoft (viene con Windows 11, a veces falta en Windows 10), **.NET Framework 4.8** (solo en Windows 10 muy viejos) y, si dejas marcada la casilla, **yt-dlp** para los fondos de YouTube.
   - Si Windows muestra «Windows protegió tu PC», pulsa **Más información → Ejecutar de todas formas**. Sale porque el instalador no tiene firma digital (cuesta dinero), no porque haga algo malo.
3. La primera vez aparece la bienvenida. Elige un tema, decide si ocultar los iconos y qué hacer con la barra de Windows.
4. Para volver a los ajustes usa el botón de Lienzo en tu barra o el icono en la bandeja.

- **Actualizar:** abre un instalador más nuevo. Cierra Lienzo, cambia los archivos y conserva tus ajustes.
- **Desinstalar:** Configuración → Aplicaciones → Aplicaciones instaladas → Lienzo. Devuelve la barra de Windows y los iconos y, si quieres, borra también tus ajustes y fondos.

## Compilar desde el código

`node build.js` compila sin instalar nada: usa el compilador de C# que ya trae Windows y descarga una sola vez el SDK de WebView2. El resultado queda en `dist\Lienzo.exe`.

| Comando | Qué hace |
| --- | --- |
| `node build.js --correr` | Cierra Lienzo si está abierto, compila y lo vuelve a abrir. |
| `node build.js --instalador` | Compila y arma `publicar\Lienzo-Instalador-<versión>.exe`: un solo archivo para subir a GitHub. |
| `node build.js --solo-instalador` | Arma solo el instalador con lo que ya hay en `dist\`. |
| `node build.js --solo-web` | Copia solo la carpeta `web/`, para probar cambios de HTML/CSS/JS sin recompilar. |
| `Lienzo.exe --panel` / `--editar` | Abre el panel o el modo edición. Si Lienzo ya está abierto, se lo pide a esa ventana. |
| `Lienzo.exe --salir` | Cierra Lienzo restaurando Windows. |
| `restaurar.cmd` | Por si algo sale mal: devuelve la barra de tareas de Windows aunque Lienzo se haya cerrado de golpe. |
| `node herramientas/servidor.js` | Abre las páginas en el navegador con datos de prueba (`http://localhost:5178/panel.html`, `vista-barra.html`, `escritorio.html?editar=1`…). |

### Publicar una versión nueva

1. Cambia la versión en `src/Ensamblado.cs` (`AssemblyInformationalVersion` y las otras dos).
2. Sube una etiqueta: `git tag v1.1.0` y `git push --tags`.
3. GitHub Actions (`.github/workflows/publicar.yml`) compila, arma el instalador y crea la versión en Releases con el `.exe` adjunto.

### Si el antivirus borra Lienzo.exe

Lienzo es un programa nuevo y sin firma digital que hace cosas parecidas a las de un programa espía:

- se cuelga detrás del escritorio;
- mira qué ventanas están abiertas;
- simula teclas como Win o Win+A para abrir Inicio y los ajustes rápidos.

Por eso algunos antivirus (por ejemplo **Panda Dome**) lo detectan por error. Es un falso positivo: todo el código está en `src/` y puedes revisarlo.

Para usarlo:

1. Restaura el archivo desde la cuarentena del antivirus.
2. Agrega una **exclusión** para la carpeta donde está Lienzo (`%LOCALAPPDATA%ProgramsLienzo` si lo instalaste, o la carpeta `lienzo` si lo compilas). En Panda Dome: *Antivirus → Configuración → Archivos, carpetas y extensiones a excluir*.
3. Vuelve a instalarlo (o a ejecutar `node build.js`).

## Qué tiene

- **Temas (rices) de un clic** (al aplicar uno puedes combinar sus bloques con tus widgets, quedarte solo con los del tema o dejar los tuyos): Noche lo-fi, Neón 2077, Aurora boreal, Sakura, Terminal, Océano, Nord minimal y Cosmos. Además puedes guardar los tuyos en «Mis rices».
- **Fondos:**
  - escenas animadas incluidas;
  - tus imágenes, GIF y videos (MP4/WebM, con aceleración de la tarjeta gráfica);
  - escenas HTML hechas por ti;
  - un color sólido.
  - **Fondos en línea** (Fondo → En línea). Un clic y se descarga a tu biblioteca, se aplica y los colores salen solos:
    - **Imágenes:** colección de rices de GitHub (`dharmx/walls`: nord, gruvbox, anime…), Wikimedia Commons y Openverse (licencias libres) y Wallhaven (arte y anime, solo contenido apto).
    - **Fondos animados (videos):** MotionBGs (HD o 4K), DesktopHut, MoeWalls (anime, 720p), WallpaperWaifu (2K/4K) y FondosAnimados.com (en español; descarga y descifra los videos de MEGA).
    - **YouTube** con [yt-dlp](https://github.com/yt-dlp/yt-dlp): Lienzo lo descarga solo si pulsas el botón y lo actualiza cada semana. Busca fondos y quita Shorts y videos que no lo parecen; también puedes pegar un enlace. Solo para uso personal.
  - **Transiciones** al cambiar de fondo: fundido, círculo (sale desde el cursor), barrido, zoom o persianas.
  - Efectos para cualquier fondo: oscurecer, viñeta, saturación, brillo, grano, desenfoque y parallax con el ratón.
- **Barra:**
  - en cualquier borde, flotante o pegada, con estilo de islas, continua o minimal;
  - fondo acrílico (el desenfoque de Windows 11), transparente o sólido;
  - módulos: Inicio, apps fijadas y ventanas abiertas con su icono, reloj, música con controles, CPU/RAM, volumen (rueda del ratón), batería, red, bandeja, notificaciones y botón de Lienzo;
  - **se esconde sola** cuando maximizas una ventana o algo va a pantalla completa (o siempre, si quieres) y sale al dejar el ratón en el borde donde estaba; con juegos que esconden el cursor no sale;
  - si eliges que no se esconda, las ventanas maximizadas la respetan.
- **Bloques:** reloj (6 estilos), fecha y calendario, saludo, música (tarjeta, vinilo o una línea), sistema (barras o anillos), ficha estilo *neofetch* y frase o nota.
  - **Widgets de tus apps** (como los de Android): en «Añadir bloque → Widgets de tus apps» salen todas las apps instaladas.
    - **Spotify** (y Apple Music, Deezer, TIDAL, Amazon Music): tarjeta de música con botones anterior / pausa / siguiente.
    - **WhatsApp:** tus contactos favoritos (nombre y número); un clic abre el chat en la app o en WhatsApp Web.
    - **Clima:** temperatura, máximas y mínimas y pronóstico de 5 días (datos de Open-Meteo, sin cuenta; se actualiza cada 30 min).
    - **Cualquier otra app:** su icono real (estilo icono, tarjeta o burbuja); un clic y se abre. Con «Atajos de apps» juntas varias en un dock.
    - **Letras en vivo:** la letra de lo que suena (Spotify, YouTube, cualquier reproductor), sincronizada línea por línea, en estilo karaoke, una línea o tarjeta. Las letras vienen de [LRCLIB](https://lrclib.net) (gratis, sin cuenta) y se guardan.
    - Los widgets se tocan con un clic en el escritorio. Lienzo solo escucha el ratón mientras tengas alguno, y deja de hacerlo con juegos en pantalla completa.
  - En el **modo edición** los arrastras, cambias su tamaño desde la esquina, eliges su estilo, los duplicas o los quitas. Tiene imán a la rejilla y al centro, y se deshace con Ctrl+Z.
- **Colores:** automáticos a partir del fondo (como `pywal`), paletas listas o elegidos a mano. También eliges letra, redondeo y opacidad de los paneles.
  - **Windows Terminal con tus colores:** activa «Llevar los colores a otras apps» y la terminal usa un esquema «Lienzo» que cambia con tu paleta. La primera vez se guarda una copia (`settings.json.antes-de-lienzo`) y al apagarlo vuelve tu esquema de antes. Ojo: los comentarios de ese archivo no se conservan (siguen en la copia).
- **Tu rice como archivo (dotfiles):** en Temas → Mis rices, «Exportar mi look» guarda un `.lienzo` (un zip con fondo, colores, letra, barra y bloques, incluida tu imagen, video o escena HTML). «Importar» lo aplica y lo agrega a Mis rices.
- **Windows:**
  - mostrar u ocultar los iconos del escritorio y cambiar su tamaño;
  - la barra de tareas de Windows normal, en auto-ocultar u oculta del todo (aunque Windows intente sacarla con la tecla Win o una notificación, Lienzo la vuelve a esconder al instante; si apagas la barra de Lienzo, la de Windows vuelve);
  - el modo oscuro o claro.
- **Rendimiento:**
  - El fondo se pausa cuando las ventanas lo tapan, con juegos o videos en pantalla completa, con la pantalla bloqueada o apagada, y opcionalmente con batería. En pausa gasta casi 0% de CPU y gráfica.
  - Límite de cuadros por segundo (30 por defecto) y resolución ajustable.
  - El panel de ajustes se destruye al cerrarlo para no ocupar memoria.

## Tus propias escenas

1. Crea una carpeta dentro de `%APPDATA%\Lienzo\escenas\` con un `index.html`. Hay un ejemplo, `ejemplo-burbujas`, y el botón «Abrir la carpeta de escenas» en el panel te lleva ahí.
2. Tu página recibe estos mensajes:

```js
window.addEventListener("message", (e) => {
  const m = e.data;
  if (m.tipo === "lienzo-pausa")  { /* m.pausado: detén tu animación para ahorrar batería */ }
  if (m.tipo === "lienzo-paleta") { /* m.colores: {fondo, superficie, texto, tenue, acento, acento2} */ }
  if (m.tipo === "lienzo-mouse")  { /* m.x, m.y entre 0 y 1 (si activas el parallax) */ }
});
```

3. Si pones un `vista.png` o `vista.jpg` en la carpeta, sale como miniatura en el panel.

### Escenas y bloques dentro de Lienzo

- **Escenas:** cada una es `web/escenas/<id>.js` y llama a `Lienzo.escena({...})`. Mira cualquiera de las incluidas y el motor en `web/comun/escenas.js`. Agrégala a `web/escenas/indice.js`.
- **Bloques:** igual, con `Lienzo.bloque({...})` en `web/bloques/<tipo>.js`, y se agregan a `web/bloques/indice.js`.
- Las opciones que declares aparecen solas en el panel y en el inspector del modo edición.

## Cómo funciona por dentro

```
lienzo/
  build.js              compila src/*.cs con csc.exe y copia web/ a dist/ (y arma el instalador)
  instalador/           el instalador y desinstalador (un solo .exe con Lienzo dentro)
  app.manifest          DPI por monitor + compatibilidad con Windows 8+ (necesaria para el fondo en 24H2/25H2)
  src/
    Program.cs          arranque, instancia única, configuración
    Escritorio.cs       coloca el fondo detrás de los iconos (método clásico y el "raised desktop" de 24H2+)
    Fondos.cs           un fondo por monitor
    Barra.cs            la barra como AppBar
    BarraOculta.cs      la barra que se esconde sola y sale al tocar el borde
    BarraWindows.cs     auto-ocultar / ocultar la barra de Windows y restaurarla
    Tareas.cs           ventanas abiertas, iconos, apps instaladas
    Sistema.cs          CPU, RAM, disco, batería, red, volumen y la ficha
    Musica.cs           lo que suena (API de Windows), con las teclas multimedia de respaldo
    Rendimiento.cs      cuándo pausar
    Aspecto.cs          iconos del escritorio, tema de Windows, inicio con Windows
    Ventanas.cs         panel, modo edición e icono de la bandeja
    Mensajeria.cs       mensajes entre las páginas y Windows
  web/                  todo lo visual: HTML, CSS y JS
  herramientas/         servidor de diseño, banco de pruebas de escenas y generador del icono
```

- Tu configuración vive en `%APPDATA%\Lienzo\config.json`, y tus fondos en `%APPDATA%\Lienzo\biblioteca\`.
- El registro de errores está en `%LOCALAPPDATA%\Lienzo\registro.txt`.

## Límites

- **Barra de Windows:** Windows 11 no deja mover su barra de tareas, por eso Lienzo usa la suya.
  - El menú Inicio de Windows se abre en su lugar de siempre.
  - Los iconos de la bandeja (Discord, Steam…) se ven con el botón «Bandeja».
- **Iconos de todo el sistema:** Lienzo no los cambia. Sí oculta o cambia el tamaño de los del escritorio.
- **Bloques:** en el escritorio son de solo lectura. Los controles de música interactivos están en la barra.

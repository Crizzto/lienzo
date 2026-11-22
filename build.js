// Compila Lienzo (C# + WebView2) sin instalar nada: usa el csc.exe que ya trae Windows (.NET Framework 4.8).
//   node build.js             → dist/Lienzo.exe (+ DLLs de WebView2 y la carpeta web/)
//   node build.js --correr    → cierra Lienzo si está abierto, compila y lo vuelve a abrir
//   node build.js --solo-web  → solo copia web/ a dist/ (para probar cambios de HTML/CSS/JS sin recompilar)
//   node build.js --instalador → además arma publicar/Lienzo-Instalador-<versión>.exe (un solo archivo para subir a GitHub)
//   node build.js --solo-instalador → rearma solo el instalador con lo que ya está en dist/
//   node build.js --android [--instalar] → publicar/Lienzo-<versión>.apk (y lo instala por USB con adb)
"use strict";
const fs = require("fs"), path = require("path"), https = require("https");
const { execFileSync, spawn, spawnSync } = require("child_process");

const dir = __dirname;
const dist = path.join(dir, "dist");
const VERSION_WV2 = "1.0.4314.35";
const FW = "C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319";
const CSC = path.join(FW, "csc.exe");
const WINMD = "C:\\Windows\\System32\\WinMetadata";
const args = process.argv.slice(2);
const exe = path.join(dist, "Lienzo.exe");
const publicar = path.join(dir, "publicar");

// La versión vive en un solo lugar: src/Ensamblado.cs (AssemblyInformationalVersion).
function version() {
  const m = /AssemblyInformationalVersion\("([^"]+)"\)/.exec(fs.readFileSync(path.join(dir, "src", "Ensamblado.cs"), "utf8"));
  return m ? m[1] : "0.0.0";
}

// Dirección del repositorio para «Aplicaciones instaladas» (en GitHub Actions viene en GITHUB_REPOSITORY).
function repositorio() {
  if (process.env.GITHUB_REPOSITORY) return "https://github.com/" + process.env.GITHUB_REPOSITORY;
  const r = spawnSync("git", ["remote", "get-url", "origin"], { cwd: dir, encoding: "utf8" });
  const url = (r.stdout || "").trim().replace(/\.git$/, "");
  return /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.test(url) ? url : "";
}

function descargar(url, destino) {
  return new Promise((ok, mal) => {
    https.get(url, { headers: { "User-Agent": "lienzo-build" } }, (r) => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
        r.resume();
        return descargar(new URL(r.headers.location, url).toString(), destino).then(ok, mal);
      }
      if (r.statusCode !== 200) { r.resume(); return mal(new Error(`HTTP ${r.statusCode} al bajar ${url}`)); }
      const f = fs.createWriteStream(destino);
      r.pipe(f);
      f.on("finish", () => f.close(ok));
      f.on("error", mal);
    }).on("error", mal);
  });
}

// El SDK de WebView2 viene en un paquete NuGet (un .zip). Se baja una sola vez a vendor/.
async function sdkWebView2() {
  const base = path.join(dir, "vendor", "webview2-" + VERSION_WV2);
  const core = path.join(base, "lib", "net462", "Microsoft.Web.WebView2.Core.dll");
  if (fs.existsSync(core)) return base;
  fs.mkdirSync(base, { recursive: true });
  const pkg = path.join(base, "paquete.zip");
  console.log(`Descargando el SDK de WebView2 ${VERSION_WV2} (solo la primera vez)…`);
  await descargar(`https://api.nuget.org/v3-flatcontainer/microsoft.web.webview2/${VERSION_WV2}/microsoft.web.webview2.${VERSION_WV2}.nupkg`, pkg);
  execFileSync("tar", ["-xf", pkg, "-C", base], { stdio: "inherit" });
  fs.unlinkSync(pkg);
  if (!fs.existsSync(core)) throw new Error("El paquete de WebView2 no trae lib/net462/Microsoft.Web.WebView2.Core.dll");
  return base;
}

function csc(salida, fuentes, refs, extra = []) {
  const r = spawnSync(CSC, [
    "/nologo", "/target:winexe", "/platform:x64", "/optimize+", "/codepage:65001", "/utf8output",
    "/warn:4", "/nowarn:1591", `/out:${salida}`, ...extra,
    ...refs.map((x) => `/r:${x}`), ...fuentes,
  ], { encoding: "utf8" });
  const texto = (r.stdout || "") + (r.stderr || "");
  if (texto.trim()) console.log(texto.trim());
  if (r.status !== 0) throw new Error("La compilación falló.");
}

// Genera recursos/lienzo.ico con el mismo dibujo que usa la app (src/Marca.cs), solo si falta.
function icono() {
  const ico = path.join(dir, "recursos", "lienzo.ico");
  if (fs.existsSync(ico)) return ico;
  const tmp = path.join(dir, "vendor", "GenerarIcono.exe");
  fs.mkdirSync(path.dirname(tmp), { recursive: true });
  csc(tmp, [path.join(dir, "herramientas", "GenerarIcono.cs"), path.join(dir, "src", "Marca.cs")],
    ["System.dll", "System.Drawing.dll"], ["/target:exe"]);
  execFileSync(tmp, [ico], { stdio: "inherit" });
  return ico;
}

function copiarWeb() {
  const destino = path.join(dist, "web");
  fs.rmSync(destino, { recursive: true, force: true });
  fs.cpSync(path.join(dir, "web"), destino, { recursive: true });
  fs.copyFileSync(path.join(dir, "restaurar.cmd"), path.join(dist, "restaurar.cmd"));
}

function cerrarSiAbierto() {
  if (!fs.existsSync(exe)) return;
  // Pide a la instancia abierta que se cierre bien (restaura la barra de Windows) y espera.
  spawnSync(exe, ["--salir"], { timeout: 15000 });
}

// Instalador: un .exe que lleva dentro dist/ comprimido (instalador/Instalador.cs lo descomprime al instalar).
function instalador() {
  const v = version();
  const tmp = path.join(dir, "vendor", "instalador");
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  fs.mkdirSync(publicar, { recursive: true });

  // El tar.exe de Windows (bsdtar) sabe hacer .zip; el de Git Bash no.
  const tar = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "tar.exe");
  const zip = path.join(tmp, "lienzo.zip");
  const archivos = ["Lienzo.exe", "Microsoft.Web.WebView2.Core.dll", "WebView2Loader.dll", "restaurar.cmd", "web"];
  execFileSync(tar, ["-a", "-c", "-f", zip, "-C", dist, ...archivos], { stdio: "inherit" });

  const num = (v.match(/\d+/g) || []).concat(["0", "0", "0", "0"]).slice(0, 4).join(".");
  const info = path.join(tmp, "InfoVersion.cs");
  fs.writeFileSync(info, [
    "using System.Reflection;",
    '[assembly: AssemblyTitle("Instalador de Lienzo")]',
    '[assembly: AssemblyDescription("Instala Lienzo: fondos animados, barra propia y bloques para Windows 11.")]',
    '[assembly: AssemblyCompany("Lienzo")]',
    '[assembly: AssemblyProduct("Lienzo")]',
    '[assembly: AssemblyCopyright("Lienzo")]',
    `[assembly: AssemblyVersion("${num}")]`,
    `[assembly: AssemblyFileVersion("${num}")]`,
    `[assembly: AssemblyInformationalVersion("${v}")]`,
    "namespace Lienzo.Instalacion {",
    `  internal static class InfoVersion { public const string Texto = "${v}"; public const string Repositorio = "${repositorio()}"; }`,
    "}",
  ].join("\r\n"));

  const salida = path.join(publicar, `Lienzo-Instalador-${v}.exe`);
  csc(salida, [path.join(dir, "instalador", "Instalador.cs"), path.join(dir, "src", "Marca.cs"), info],
    ["System.dll", "System.Core.dll", "System.Drawing.dll", "System.Windows.Forms.dll", "Microsoft.CSharp.dll",
      "System.IO.Compression.dll", "System.IO.Compression.FileSystem.dll"],
    [`/win32manifest:${path.join(dir, "app.manifest")}`, `/win32icon:${path.join(dir, "recursos", "lienzo.ico")}`, `/resource:${zip},lienzo.zip`]);
  const mb = (fs.statSync(salida).size / 1048576).toFixed(1);
  console.log(`Instalador: publicar\\${path.basename(salida)} (${mb} MB)`);
}

// ---------------- Android ----------------
// Necesita el SDK de Android (lo instala Android Studio, o solo las «command line tools") y un JDK 17 o más nuevo.
function sdkAndroid() {
  const opciones = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT,
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Android", "Sdk")].filter(Boolean);
  const sdk = opciones.find((d) => fs.existsSync(path.join(d, "platforms")));
  if (!sdk) throw new Error("No encontré el SDK de Android. Instala Android Studio (o pon ANDROID_HOME).");
  return sdk;
}

function jdk() {
  if (process.env.JAVA_HOME && fs.existsSync(process.env.JAVA_HOME)) return process.env.JAVA_HOME;
  const pf = process.env.ProgramFiles || "C:\\Program Files";
  const bases = [path.join(pf, "Android", "Android Studio", "jbr")];
  for (const raiz of [path.join(pf, "Java"), path.join(pf, "Eclipse Adoptium"), path.join(pf, "Microsoft")]) {
    if (!fs.existsSync(raiz)) continue;
    fs.readdirSync(raiz).filter((d) => /^jdk-?(1[7-9]|[2-9]\d)/.test(d)).sort().reverse().forEach((d) => bases.push(path.join(raiz, d)));
  }
  return bases.find((d) => fs.existsSync(path.join(d, "bin", "java.exe"))) || "";
}

function android() {
  const raiz = path.join(dir, "android");
  const sdk = sdkAndroid();
  fs.writeFileSync(path.join(raiz, "local.properties"), "sdk.dir=" + sdk.replace(/\\/g, "\\\\").replace(/:/g, "\\:") + "\n");
  const env = Object.assign({}, process.env, { ANDROID_HOME: sdk });
  const java = jdk();
  if (java) env.JAVA_HOME = java;
  console.log("Compilando el APK de Android (la primera vez Gradle baja lo que necesita)…");
  const gradlew = path.join(raiz, process.platform === "win32" ? "gradlew.bat" : "gradlew");
  // gradlew.bat necesita la consola de Windows (shell); la orden va completa en un texto para que Node no avise.
  const r = spawnSync(`"${gradlew}" assembleRelease --console=plain -q`, { cwd: raiz, env, stdio: "inherit", shell: true });
  if (r.status !== 0) throw new Error("Gradle no pudo compilar el APK");
  const apk = path.join(raiz, "app", "build", "outputs", "apk", "release", "app-release.apk");
  fs.mkdirSync(publicar, { recursive: true });
  const salida = path.join(publicar, `Lienzo-${version()}.apk`);
  fs.copyFileSync(apk, salida);
  console.log(`APK: publicar\\${path.basename(salida)} (${(fs.statSync(salida).size / 1048576).toFixed(1)} MB)`);
  if (args.includes("--instalar")) {
    // Con el teléfono conectado por USB (y la depuración USB activada en las opciones de desarrollador).
    const adb = path.join(sdk, "platform-tools", process.platform === "win32" ? "adb.exe" : "adb");
    const i = spawnSync(adb, ["install", "-r", salida], { stdio: "inherit" });
    if (i.status !== 0) throw new Error("adb no pudo instalar el APK (¿está conectado el teléfono?)");
    spawnSync(adb, ["shell", "am", "start", "-n", "app.lienzo/.PanelActivity"], { stdio: "inherit" });
  }
}

async function principal() {
  fs.mkdirSync(dist, { recursive: true });
  // node build.js --android [--instalar] → publicar/Lienzo-<versión>.apk (y lo instala en el teléfono conectado).
  if (args.includes("--android")) { android(); return; }
  if (args.includes("--solo-web")) { copiarWeb(); console.log("web/ copiada a dist/"); return; }
  // Rearma solo el instalador con lo que ya hay en dist/ (sin cerrar Lienzo ni recompilarlo).
  if (args.includes("--solo-instalador")) { icono(); instalador(); return; }

  const sdk = await sdkWebView2();
  const ico = icono();
  if (args.includes("--correr")) cerrarSiAbierto();

  const fuentes = fs.readdirSync(path.join(dir, "src")).filter((f) => f.endsWith(".cs")).map((f) => path.join(dir, "src", f));
  const refs = [
    path.join(sdk, "lib", "net462", "Microsoft.Web.WebView2.Core.dll"),
    "System.dll", "System.Core.dll", "System.Drawing.dll", "System.Windows.Forms.dll",
    "System.Web.Extensions.dll", "System.Management.dll", "Microsoft.CSharp.dll",
    "System.IO.Compression.dll", "System.IO.Compression.FileSystem.dll", // rices exportados (.lienzo = zip)
    // API de Windows (WinRT) para saber qué música suena:
    path.join(FW, "System.Runtime.dll"), path.join(FW, "System.Runtime.WindowsRuntime.dll"),
    path.join(FW, "System.Runtime.InteropServices.WindowsRuntime.dll"), path.join(FW, "System.Threading.Tasks.dll"),
    path.join(FW, "System.IO.dll"),
    path.join(WINMD, "Windows.Foundation.winmd"), path.join(WINMD, "Windows.Media.winmd"), path.join(WINMD, "Windows.Storage.winmd"),
  ];
  csc(exe, fuentes, refs, [`/win32manifest:${path.join(dir, "app.manifest")}`, `/win32icon:${ico}`]);

  fs.copyFileSync(path.join(sdk, "lib", "net462", "Microsoft.Web.WebView2.Core.dll"), path.join(dist, "Microsoft.Web.WebView2.Core.dll"));
  fs.copyFileSync(path.join(sdk, "runtimes", "win-x64", "native", "WebView2Loader.dll"), path.join(dist, "WebView2Loader.dll"));
  copiarWeb();
  const kb = (fs.statSync(exe).size / 1024).toFixed(0);
  console.log(`Listo: dist\\Lienzo.exe (${kb} KB)`);
  if (args.includes("--instalador")) instalador();

  if (args.includes("--correr")) {
    const extra = args.filter((a) => a !== "--correr" && a !== "--instalador");
    spawn(exe, extra, { detached: true, stdio: "ignore" }).unref();
    console.log("Lienzo abierto.");
  }
}

principal().catch((e) => { console.error("Error: " + e.message); process.exit(1); });

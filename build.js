// Compila Lienzo (C# + WebView2) sin instalar nada: usa el csc.exe que ya trae Windows (.NET Framework 4.8).
//   node build.js             → dist/Lienzo.exe (+ DLLs de WebView2 y la carpeta web/)
//   node build.js --correr    → cierra Lienzo si está abierto, compila y lo vuelve a abrir
//   node build.js --solo-web  → solo copia web/ a dist/ (para probar cambios de HTML/CSS/JS sin recompilar)
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

async function principal() {
  fs.mkdirSync(dist, { recursive: true });
  if (args.includes("--solo-web")) { copiarWeb(); console.log("web/ copiada a dist/"); return; }

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

  if (args.includes("--correr")) {
    const extra = args.filter((a) => a !== "--correr");
    spawn(exe, extra, { detached: true, stdio: "ignore" }).unref();
    console.log("Lienzo abierto.");
  }
}

principal().catch((e) => { console.error("Error: " + e.message); process.exit(1); });

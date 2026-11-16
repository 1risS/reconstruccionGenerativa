// Servidor estático para probar en la red local (con soporte Range para audio en iOS).
// Genera QR de prueba en qrs/prueba-local/ apuntando a la IP de esta computadora.
import http from "node:http";
import { createReadStream, statSync, writeFileSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { join, extname, normalize } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const P = (r) => fileURLToPath(new URL(r, import.meta.url));

const ROOT = P("../site/");
const PORT = Number(process.env.PORT) || 8080;
const TIPOS = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript",
  ".m4a": "audio/mp4", ".mp3": "audio/mpeg", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".webp": "image/webp", ".json": "application/json" };

// "Guardar" en deriva-3d/calibrar.html escribe deriva-3d/calibracion.js (sólo en este servidor local)
function guardarCalibracion(req, res) {
  let cuerpo = "";
  req.on("data", (d) => { cuerpo += d; if (cuerpo.length > 4e6) req.destroy(); });
  req.on("end", () => {
    try {
      const c = JSON.parse(cuerpo);
      if (typeof c !== "object" || !c.vistas || !Array.isArray(c.alturas)) throw new Error("formato");
      const js = "// Cámaras calibradas con calibrar.html (se genera solo al tocar \"Guardar\"; no hace falta editarlo).\n" +
        "// Tienen prioridad sobre camara / mira / apertura de recorrido.js.\n" +
        `window.CALIBRACION = ${JSON.stringify({ vistas: c.vistas, alturas: c.alturas }, null, 2)};\n`;
      writeFileSync(join(ROOT, "deriva-3d/calibracion.js"), js);
      res.writeHead(200, { "Content-Type": "application/json" }).end('{"ok":true}');
      console.log("calibracion.js guardado");
    } catch (e) { res.writeHead(400).end("JSON inválido"); }
  });
}

http.createServer((req, res) => {
  if (req.method === "POST" && req.url.split("?")[0] === "/deriva-3d/guardar-calibracion") return guardarCalibracion(req, res);
  if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405).end(); return; }
  let ruta = normalize(decodeURIComponent(req.url.split("?")[0])).replace(/^(\.\.[/\\])+/, "");
  let archivo = join(ROOT, ruta);
  let st;
  try {
    st = statSync(archivo);
    if (st.isDirectory()) {
      // /carpeta → /carpeta/ (si no, las rutas relativas de la página apuntan a la raíz)
      if (!req.url.split("?")[0].endsWith("/")) {
        const [p, q] = req.url.split("?");
        res.writeHead(301, { Location: p + "/" + (q ? "?" + q : "") }).end();
        return;
      }
      archivo = join(archivo, "index.html"); st = statSync(archivo);
    }
  }
  catch { res.writeHead(404).end("No encontrado"); return; }
  const tipo = TIPOS[extname(archivo)] || "application/octet-stream";
  const rango = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
  if (rango) {
    const ini = rango[1] ? +rango[1] : 0;
    const fin = rango[2] ? +rango[2] : st.size - 1;
    res.writeHead(206, { "Content-Type": tipo, "Accept-Ranges": "bytes",
      "Content-Range": `bytes ${ini}-${fin}/${st.size}`, "Content-Length": fin - ini + 1 });
    createReadStream(archivo, { start: ini, end: fin }).pipe(res);
  } else {
    // no-cache: el navegador vuelve a pedir cada archivo; si no, Safari sigue usando módulos JS viejos al recargar
    res.writeHead(200, { "Content-Type": tipo, "Accept-Ranges": "bytes", "Content-Length": st.size, "Cache-Control": "no-cache" });
    createReadStream(archivo).pipe(res);
  }
}).listen(PORT, () => {
  const ip = Object.values(networkInterfaces()).flat().find((i) => i.family === "IPv4" && !i.internal)?.address || "localhost";
  const base = `http://${ip}:${PORT}/`;
  console.log(`Sitio en ${base}  (y http://localhost:${PORT}/)`);
  try {
    execFileSync("node", [P("./generar-qrs.mjs"), base,
      P("../qrs/prueba-local/")], { stdio: "inherit" });
    console.log("Abre qrs/prueba-local/hoja.html y escanea con un teléfono en la misma wifi.");
  } catch {}
});

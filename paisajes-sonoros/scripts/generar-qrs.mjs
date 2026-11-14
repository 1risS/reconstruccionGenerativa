// Genera un QR por punto sonoro (SVG para imprenta + PNG) y una hoja imprimible.
// Uso: npm run qrs -- https://dominio-final.com/ruta/   [carpeta-salida]
import QRCode from "qrcode";
import { mkdirSync, writeFileSync } from "node:fs";
import { MUESTRA, SITIOS } from "./sitios.mjs";
import { fileURLToPath } from "node:url";

let base = process.argv[2];
const out = process.argv[3] || fileURLToPath(new URL("../qrs/", import.meta.url));
if (!base) {
  console.error("Falta la URL base. Ej: npm run qrs -- https://usuario.github.io/little-havana/");
  process.exit(1);
}
if (!base.endsWith("/")) base += "/";
mkdirSync(out, { recursive: true });

const opts = { errorCorrectionLevel: "H", margin: 2, color: { dark: "#000000", light: "#ffffff" } };
const tarjetas = [];
for (const [slug, s] of Object.entries(SITIOS)) {
  const url = base + slug + "/";
  const svg = await QRCode.toString(url, { ...opts, type: "svg" });
  writeFileSync(`${out}/${s.numero}-${slug}.svg`, svg);
  await QRCode.toFile(`${out}/${s.numero}-${slug}.png`, url, { ...opts, width: 1200 });
  tarjetas.push(`<figure>${svg}<figcaption><b>${s.numero} · ${s.nombre}</b><small>${url}</small></figcaption></figure>`);
  console.log(`✓ ${s.numero} ${s.nombre} → ${url}`);
}
writeFileSync(`${out}/hoja.html`, `<!doctype html><meta charset="utf-8"><title>QR · ${MUESTRA.titulo}</title>
<style>
  body{font-family:Helvetica,Arial,sans-serif;margin:0;padding:12mm;display:grid;grid-template-columns:1fr 1fr;gap:10mm}
  figure{margin:0;border:1px dashed #bbb;padding:8mm;text-align:center;break-inside:avoid}
  svg{width:70mm;height:70mm}
  figcaption{display:flex;flex-direction:column;gap:2mm;margin-top:4mm}
  small{color:#777;font-size:8pt;word-break:break-all}
  @page{size:A4;margin:0}
</style>${tarjetas.join("")}`);
console.log(`\nArchivos en ${out}  (hoja imprimible: hoja.html)`);

// Baja de OpenStreetMap (Overpass) los edificios que se ven en la panorámica de la portada y escribe
// site/portada/edificios.json con el mismo formato que deriva-3d/edificios.json: [[altura, base, anillos], …].
// Sólo guarda los que caen dentro del cono de la foto (más un margen): la ciudad se dibuja únicamente donde hay imagen.
//
// Uso:  node scripts/edificios-portada.mjs [osm.json]
//       (con un archivo, usa esa respuesta de Overpass ya bajada en vez de pedirla de nuevo)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const salida = path.join(raiz, 'site/portada/edificios.json');

// cámara de la panorámica (igual que en site/portada/portada.js)
const DRON = { lat: 25.76510167, lng: -80.25260167 };
const RUMBO = -3.7, MARGEN = 48, LEJOS = 2600, CERCA = 60; // grados a cada lado del eje, metros

const RAD = Math.PI / 180;
const local = (lng, lat) => [(lng - DRON.lng) * RAD * Math.cos(DRON.lat * RAD) * 6371000, (lat - DRON.lat) * RAD * 6371000];

async function bajar() {
  const consulta = '[out:json][timeout:120];way["building"](25.7660,-80.2720,25.7900,-80.2330);out geom tags;';
  const r = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST', body: new URLSearchParams({ data: consulta }), headers: { 'User-Agent': 'paisajes-sonoros/1.0' },
  });
  if (!r.ok) throw new Error(`Overpass respondió ${r.status}`);
  return r.json();
}

const osm = process.argv[2] ? JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) : await bajar();
const num = (v) => { const n = parseFloat(String(v || '').replace(',', '.')); return isFinite(n) ? n : null; };
const r6 = (x) => Math.round(x * 1e6) / 1e6;

const datos = [];
for (const e of osm.elements) {
  if (e.type !== 'way' || !e.geometry || e.geometry.length < 4) continue;
  const t = e.tags || {};
  if (/^(roof|carport)$/.test(t.building)) continue; // techos sueltos: cubren el piso donde la foto ve calle
  let anillo = e.geometry.map((p) => [r6(p.lon), r6(p.lat)]);
  const [a, b] = [anillo[0], anillo[anillo.length - 1]];
  if (a[0] === b[0] && a[1] === b[1]) anillo = anillo.slice(0, -1);
  const c = anillo.reduce((s, p) => [s[0] + p[0] / anillo.length, s[1] + p[1] / anillo.length], [0, 0]);
  const [x, y] = local(...c);
  const ang = Math.atan2(x, y) / RAD - RUMBO;
  if (y < CERCA || Math.abs(ang) > MARGEN || Math.hypot(x, y) > LEJOS) continue;
  const base = num(t.min_height) || 0;
  const alto = num(t.height) || (num(t['building:levels']) ? num(t['building:levels']) * 3.2 : null) || 4.5;
  datos.push([Math.round(Math.max(alto, base + 1) * 10) / 10, base, [anillo]]);
}
fs.mkdirSync(path.dirname(salida), { recursive: true });
fs.writeFileSync(salida, JSON.stringify(datos));
console.log(`${datos.length} edificios → ${path.relative(raiz, salida)} (${Math.round(fs.statSync(salida).size / 1024)} KB)`);

// Trae lo que cargó la artista y lo deja listo para usar en la deriva 3D.
//
//   CARGA_CLAVE=… node scripts/traer.mjs [--url https://little-havana-carga.pages.dev] [--fotos]
//
// Escribe:
//   datos/carga.json                  copia de los datos tal como están en el servidor
//   datos/sugerencia-recorrido.js     borrador de puntos y proyecciones con el formato de recorrido.js
//                                     (para copiar a mano lo que sirva: NO se toca recorrido.js)
// Con --fotos además baja los archivos de Google Drive a ../fachadas/drive/<lugar>/ (fuera de git) y
// anota en el borrador el archivo local de cada foto. Sólo se bajan los archivos compartidos como
// "Cualquier persona con el enlace"; las carpetas de Drive no se pueden bajar sin la API y se avisan.

import { mkdir, writeFile, readdir } from 'node:fs/promises';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opcion = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const URL_BASE = (opcion('--url') || 'https://little-havana-carga.pages.dev').replace(/\/$/, '');
const CLAVE = opcion('--clave') || process.env.CARGA_CLAVE;
const FOTOS = args.includes('--fotos');
const DESTINO_FOTOS = join(RAIZ, '..', 'fachadas', 'drive');
const AUDIO_DERIVA = 'deriva_calle_8';

if (!CLAVE) {
  console.error('Falta la clave: CARGA_CLAVE=… node scripts/traer.mjs   (o --clave …)');
  process.exit(1);
}

const fmt = (t) => { const m = Math.floor(t / 60); return `${m}:${(t - m * 60).toFixed(1).padStart(4, '0')}`; };
const slug = (s) => (s || 'sin-nombre').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'sin-nombre';
const cadena = (s) => JSON.stringify(s ?? '').replace(/^"|"$/g, '').replace(/'/g, "\\'");

function idDrive(url) {
  try {
    const u = new URL(url);
    if (!/(^|\.)google\.com$/.test(u.hostname)) return null;
    let m = u.pathname.match(/\/folders\/([\w-]{10,})/);
    if (m) return { id: m[1], carpeta: true };
    m = u.pathname.match(/\/d\/([\w-]{10,})/);
    if (m) return { id: m[1], carpeta: false };
    const id = u.searchParams.get('id');
    if (id) return { id, carpeta: false };
  } catch { /* no es una URL */ }
  return null;
}

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif',
  'image/tiff': 'tif', 'image/gif': 'gif', 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'image/jp2': 'jp2' };

async function bajar(foto, carpeta, base) {
  const d = idDrive(foto.url);
  if (!d) return { aviso: 'no es un link de Google Drive' };
  if (d.carpeta) return { aviso: 'es una carpeta de Drive (bajar a mano o pedir los links de cada archivo)' };
  await mkdir(carpeta, { recursive: true });
  const existentes = (await readdir(carpeta)).filter((f) => f.startsWith(base + '.'));
  if (existentes.length) return { archivo: join(carpeta, existentes[0]), yaEstaba: true };
  const r = await fetch(`https://drive.usercontent.google.com/download?id=${d.id}&export=download&confirm=t`, { redirect: 'follow' });
  const tipo = (r.headers.get('content-type') || '').split(';')[0].trim();
  if (!r.ok || tipo.startsWith('text/html')) return { aviso: 'no se pudo bajar: ¿está compartido como "Cualquier persona con el enlace"?' };
  const nombre = (r.headers.get('content-disposition') || '').match(/filename="?([^";]+)"?/);
  const ext = EXT[tipo] || (nombre && nombre[1].split('.').pop().toLowerCase()) || 'bin';
  const archivo = join(carpeta, `${base}.${ext}`);
  await writeFile(archivo, Buffer.from(await r.arrayBuffer()));
  return { archivo, original: nombre && nombre[1] };
}

// ── traer ──
const r = await fetch(URL_BASE + '/api/datos', { headers: { 'X-Clave': CLAVE } });
if (!r.ok) {
  console.error(`Error ${r.status} al pedir ${URL_BASE}/api/datos: ${await r.text()}`);
  process.exit(1);
}
const doc = await r.json();
if (!doc.datos) { console.error('Todavía no hay nada guardado.'); process.exit(1); }
const { lugares, marcas } = doc.datos;
await mkdir(join(RAIZ, 'datos'), { recursive: true });
await writeFile(join(RAIZ, 'datos', 'carga.json'), JSON.stringify(doc, null, 2) + '\n');
console.log(`✓ datos/carga.json · versión ${doc.version} (${doc.guardado}) · ${lugares.length} lugares, ${marcas.length} momentos`);

// ── fotos ──
const locales = new Map();   // foto.id → ruta relativa al repo
if (FOTOS) {
  for (const l of lugares) {
    const carpeta = join(DESTINO_FOTOS, slug(l.nombre));
    for (const [i, f] of l.fotos.entries()) {
      const base = `${String(i).padStart(2, '0')}-${f.id}`;
      const res = await bajar(f, carpeta, base).catch((e) => ({ aviso: e.message }));
      if (res.archivo) {
        const rel = relative(join(RAIZ, '..'), res.archivo);
        locales.set(f.id, rel);
        console.log(`${res.yaEstaba ? '=' : '↓'} ${rel}${res.original ? '  (' + res.original + ')' : ''}`);
      } else {
        console.warn(`⚠ ${l.nombre || 'sin nombre'} · ${f.url}: ${res.aviso}`);
      }
    }
  }
}

// ── borrador para recorrido.js ──
const lugarPorId = new Map(lugares.map((l) => [l.id, l]));
const L = [];
L.push('// Borrador generado por carga-puntos/scripts/traer.mjs a partir de lo que cargó la artista.');
L.push(`// Versión ${doc.version} de la carga (${doc.guardado}). Copiar a recorrido.js lo que sirva y ajustar a mano.`);
L.push('// ⚠ Momentos marcados con (aprox.) son inciertos. Las cámaras de las fotos van a la altura de los ojos');
L.push('//   (alt 1,6) y miran al punto marcado del edificio: hay que calibrarlas en calibrar.html.');
L.push('');

const porAudio = new Map();
for (const m of marcas) { if (!porAudio.has(m.audio)) porAudio.set(m.audio, []); porAudio.get(m.audio).push(m); }
for (const [audio, lista] of [...porAudio].sort(([a], [b]) => (a === AUDIO_DERIVA ? -1 : b === AUDIO_DERIVA ? 1 : a.localeCompare(b)))) {
  lista.sort((a, b) => a.t - b.t);
  L.push(`// ── ${audio}.m4a · ${lista.length} momentos ──`);
  L.push(`// puntos: [`);
  for (const m of lista) {
    const lugar = lugarPorId.get(m.lugar);
    const pos = m.lat != null ? m : null;
    const nota = [m.oye, lugar && lugar.nombre].filter(Boolean).join(' · ');
    const partes = [`t: '${fmt(m.t)}'`];
    if (m.hasta != null) partes.push(`hasta: '${fmt(m.hasta)}'`);
    if (pos) partes.push(`lat: ${pos.lat}, lng: ${pos.lng}`);
    if (nota) partes.push(`nota: '${cadena(nota)}'`);
    const sinPos = !pos ? (lugar ? `  // sin ubicar: el edificio está en ${lugar.lat}, ${lugar.lng}` : '  // sin ubicar') : '';
    L.push(`//   { ${partes.join(', ')} },${m.aprox ? '  // (aprox.)' : ''}${sinPos}`);
  }
  L.push(`// ],`);
  L.push('');
}

L.push('// ── proyecciones: edificios con fotos ──');
L.push('// desde/hasta: alrededor del primer momento en la deriva en que se oye el edificio (≈ 10 s por vista + viajes).');
L.push('// proyecciones: [');
for (const l of lugares) {
  if (!l.fotos.length) continue;
  const m = marcas.filter((x) => x.lugar === l.id && x.audio === AUDIO_DERIVA).sort((a, b) => a.t - b.t)[0];
  const tramo = m ? `desde: '${fmt(Math.max(0, m.t - 8))}', hasta: '${fmt(m.t + 8 + 10 * l.fotos.length)}', ` : `desde: '?', hasta: '?', `;
  L.push(`//   {`);
  L.push(`//     // ${l.nombre || 'sin nombre'}${l.direccion ? ' · ' + l.direccion : ''}${l.nota ? ' — ' + l.nota.replace(/\s+/g, ' ') : ''}`);
  if (!m) L.push('//     // ⚠ sin momento en la deriva: falta que la artista marque cuándo se oye');
  L.push(`//     ${tramo}lugar: '${cadena(l.nombre)}',`);
  L.push(`//     vistas: [`);
  l.fotos.forEach((f, i) => {
    L.push(`//       // ${f.url}${locales.has(f.id) ? '  →  ' + locales.get(f.id) : ''}${f.nota ? '  (' + f.nota + ')' : ''}`);
    const camara = f.desde ? `{ lat: ${f.desde.lat}, lng: ${f.desde.lng}, alt: 1.6 }` : 'null /* ⚠ falta desde dónde */';
    L.push(`//       { imagen: 'registros/${slug(l.nombre)}-${String(i).padStart(2, '0')}.webp', tipo: '${cadena(f.tipo)}', apertura: 50,`);
    L.push(`//         camara: ${camara}, mira: { lat: ${l.lat}, lng: ${l.lng}, alt: 2 } },`);
  });
  L.push(`//     ]`);
  L.push(`//   },`);
}
L.push('// ]');

await writeFile(join(RAIZ, 'datos', 'sugerencia-recorrido.js'), L.join('\n') + '\n');
console.log('✓ datos/sugerencia-recorrido.js');
const faltan = lugares.filter((l) => l.fotos.length && !marcas.some((m) => m.lugar === l.id));
if (faltan.length) console.log(`  ${faltan.length} edificio(s) con fotos sin momento en el audio: ${faltan.map((l) => l.nombre || 'sin nombre').join(', ')}`);

// Calcula la forma de onda de cada audio del sitio para dibujarla en la herramienta de carga.
//   ../paisajes-sonoros/site/audio/*.m4a  →  site/picos/<nombre>.json
// Cada JSON tiene { duracion, porSegundo, picos: [0–100, …] }: el pico de cada 1/porSegundo s,
// normalizado al máximo del archivo. Necesita ffmpeg. Saltea los que ya están al día.
//   node scripts/picos.mjs            (todos)
//   node scripts/picos.mjs --forzar   (recalcula aunque estén al día)

import { spawn } from 'node:child_process';
import { readdir, stat, writeFile, mkdir } from 'node:fs/promises';
import { join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGEN = join(RAIZ, '..', 'paisajes-sonoros', 'site', 'audio');
const DESTINO = join(RAIZ, 'site', 'picos');
const MUESTREO = 8000;      // Hz (alcanza para la forma de onda)
const POR_SEGUNDO = 20;     // picos por segundo
const forzar = process.argv.includes('--forzar');

function decodificar(archivo) {
  return new Promise((resolver, rechazar) => {
    const ff = spawn('ffmpeg', ['-v', 'error', '-i', archivo, '-ac', '1', '-ar', String(MUESTREO), '-f', 's16le', '-']);
    const partes = [];
    let errores = '';
    ff.stdout.on('data', (b) => partes.push(b));
    ff.stderr.on('data', (b) => (errores += b));
    ff.on('error', (e) => rechazar(new Error('No se pudo ejecutar ffmpeg: ' + e.message)));
    ff.on('close', (codigo) => (codigo === 0 ? resolver(Buffer.concat(partes)) : rechazar(new Error(errores || `ffmpeg salió con ${codigo}`))));
  });
}

async function procesar(archivo) {
  const nombre = basename(archivo, '.m4a');
  const salida = join(DESTINO, nombre + '.json');
  if (!forzar) {
    const [a, s] = await Promise.all([stat(archivo), stat(salida).catch(() => null)]);
    if (s && s.mtimeMs >= a.mtimeMs) { console.log(`= ${nombre} (al día)`); return; }
  }
  const pcm = await decodificar(archivo);
  const muestras = new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.byteLength / 2));
  const paso = MUESTREO / POR_SEGUNDO;
  const crudos = [];
  let max = 1;
  for (let i = 0; i < muestras.length; i += paso) {
    let p = 0;
    const fin = Math.min(i + paso, muestras.length);
    for (let j = i; j < fin; j++) { const v = Math.abs(muestras[j]); if (v > p) p = v; }
    crudos.push(p);
    if (p > max) max = p;
  }
  const picos = crudos.map((p) => Math.round((p / max) * 100));
  const duracion = Math.round((muestras.length / MUESTREO) * 1000) / 1000;
  await writeFile(salida, JSON.stringify({ duracion, porSegundo: POR_SEGUNDO, picos }));
  console.log(`✓ ${nombre}: ${duracion.toFixed(1)} s, ${picos.length} picos`);
}

await mkdir(DESTINO, { recursive: true });
const archivos = (await readdir(ORIGEN)).filter((f) => f.endsWith('.m4a')).sort();
if (!archivos.length) {
  console.error(`No hay audios en ${ORIGEN}. Correr antes "npm run audios" en paisajes-sonoros/.`);
  process.exit(1);
}
for (const f of archivos) await procesar(join(ORIGEN, f));

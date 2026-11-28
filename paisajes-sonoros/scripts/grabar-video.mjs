// Graba la deriva 3D como video en loop: panorámica → partida → recorrido → vuelta al dron → panorámica, dos veces,
// sin la pantalla de inicio ni la de «fin del recorrido».
//
// Se dibuja cuadro a cuadro con un RELOJ VIRTUAL: performance.now, Date.now, requestAnimationFrame, los timers, las
// transiciones CSS y el audio (currentTime, play, ended) siguen un tiempo que avanza exactamente 1/FPS por cuadro, y
// antes de cada captura se espera a que lleguen las teselas y las imágenes. Así el video sale fluido aunque la escena
// tarde en dibujarse. El audio se arma después con ffmpeg a partir de los momentos en que sonó.
//
// Se calienta empezando cerca del final (?t=…) para llegar a la primera vuelta al dron; desde ahí se graba un ciclo
// entero (panorámica, Start again, recorrido, vuelta, panorámica) y el video final repite ese ciclo dos veces. El corte
// cae en mitad de la panorámica (quieta en pantalla apaisada), así que el loop no se nota.
//
// Uso (con el servidor local corriendo, p. ej. PORT=8123 npm run local):
//   node scripts/grabar-video.mjs [salida.mp4]
// Variables: BASE (http://localhost:8123/), ANCHO, ALTO, ESCALA, FPS, QUIETO (segundos en la panorámica), DESDE (calentamiento)
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const PW = process.env.PLAYWRIGHT || '/Users/iriss/.npm/_npx/c61c9351a0dbcfa7/node_modules/playwright/index.mjs';
const { chromium } = await import(PW);

const BASE = process.env.BASE || 'http://localhost:8123/';
// vertical, como la ve el público: viewport de teléfono (540×960) dibujado a escala 2 → 1080×1920
const ANCHO = Number(process.env.ANCHO) || 540, ALTO = Number(process.env.ALTO) || 960, ESCALA = Number(process.env.ESCALA) || 2;
const FPS = Number(process.env.FPS) || 30;
const QUIETO = Number(process.env.QUIETO) || 8;    // segundos en la panorámica después de llegar al dron
const DESDE = process.env.DESDE || '700';          // segundo del audio en que arranca el calentamiento
const VUELTA_SEG = 12;                             // mapa.js → VUELTA_SEG
const SALIDA = path.resolve(process.argv[2] || 'deriva-loop.mp4');
fs.mkdirSync(path.dirname(SALIDA), { recursive: true });
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'grabar-deriva-'));
const AUDIO = fileURLToPath(new URL('../site/audio/deriva_calle_8.m4a', import.meta.url));
const DT = 1000 / FPS;
fs.mkdirSync(path.join(TMP, 'muestras'));
console.log('temporales en', TMP);

// ── reloj virtual (corre en la página antes que cualquier script) ──
function relojVirtual() {
  let vt = 0;
  const realNow = performance.now.bind(performance), dateBase = Date.now();
  performance.now = () => vt;
  Date.now = () => dateBase + vt;
  // timers
  let sig = 1;
  const timers = new Map();
  window.setTimeout = (f, ms = 0, ...a) => { const id = sig++; timers.set(id, { t: vt + Math.max(0, +ms || 0), f, a }); return id; };
  window.setInterval = (f, ms = 0, ...a) => { const id = sig++; timers.set(id, { t: vt + Math.max(1, +ms || 0), f, a, cada: Math.max(1, +ms || 0) }); return id; };
  window.clearTimeout = window.clearInterval = (id) => timers.delete(id);
  // requestAnimationFrame
  let raf = new Map(), rid = 1;
  window.requestAnimationFrame = (f) => { const id = rid++; raf.set(id, f); return id; };
  window.cancelAnimationFrame = (id) => raf.delete(id);
  // red: pedidos en curso (fetch, XHR, imágenes)
  let red = 0;
  const of = window.fetch;
  window.fetch = (...a) => { red++; return of(...a).finally(() => red--); };
  const oxs = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (...a) { red++; this.addEventListener('loadend', () => red--, { once: true }); return oxs.apply(this, a); };
  const dsrc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  Object.defineProperty(HTMLImageElement.prototype, 'src', { ...dsrc, set(v) {
    red++; let hecho = false;
    const fin = () => { if (!hecho) { hecho = true; red--; } };
    this.addEventListener('load', fin, { once: true }); this.addEventListener('error', fin, { once: true });
    dsrc.set.call(this, v);
    if (this.complete) fin();
  } });
  // audio: el elemento real sólo da la duración; la reproducción sigue el reloj virtual (y no suena)
  const eventos = [];
  const est = new WeakMap();
  const S = (el) => { let s = est.get(el); if (!s) est.set(el, (s = { paused: true, cur: 0, ini: 0, ended: false })); return s; };
  const P = HTMLMediaElement.prototype, d = (n) => Object.getOwnPropertyDescriptor(P, n);
  const dCT = d('currentTime'), dPa = d('paused'), dEn = d('ended'), dSk = d('seeking'), dDu = d('duration');
  const oPlay = P.play, oPause = P.pause;
  const esAudio = (el) => el instanceof HTMLAudioElement;
  const dur = (el) => dDu.get.call(el) || Infinity;
  const emitir = (el, tipo) => setTimeout(() => el.dispatchEvent(new Event(tipo)), 0);
  const ahora = (el) => { const s = S(el); return s.paused ? s.cur : Math.min(dur(el), (vt - s.ini) / 1000); };
  Object.defineProperty(P, 'currentTime', { configurable: true, get() { return esAudio(this) ? ahora(this) : dCT.get.call(this); },
    set(v) {
      if (!esAudio(this)) return dCT.set.call(this, v);
      const s = S(this); s.cur = +v; s.ini = vt - s.cur * 1000; s.ended = false;
      eventos.push({ tipo: 'seek', vt, cur: s.cur });
    } });
  Object.defineProperty(P, 'paused', { configurable: true, get() { return esAudio(this) ? S(this).paused : dPa.get.call(this); } });
  Object.defineProperty(P, 'ended', { configurable: true, get() { return esAudio(this) ? S(this).ended : dEn.get.call(this); } });
  Object.defineProperty(P, 'seeking', { configurable: true, get() { return esAudio(this) ? false : dSk.get.call(this); } });
  P.play = function () {
    if (!esAudio(this)) return oPlay.call(this);
    const s = S(this);
    if (s.ended) { s.cur = 0; s.ended = false; }
    if (s.paused) { s.paused = false; s.ini = vt - s.cur * 1000; eventos.push({ tipo: 'play', vt, cur: s.cur }); emitir(this, 'play'); emitir(this, 'playing'); }
    return Promise.resolve();
  };
  P.pause = function () {
    if (!esAudio(this)) return oPause.call(this);
    const s = S(this);
    if (!s.paused) { s.cur = ahora(this); s.paused = true; eventos.push({ tipo: 'pause', vt, cur: s.cur }); emitir(this, 'pause'); }
  };
  const audios = new Set();
  const oAudio = window.Audio;
  window.Audio = function (...a) { const el = new oAudio(...a); audios.add(el); return el; };
  window.Audio.prototype = oAudio.prototype;
  // transiciones y animaciones CSS: en pausa, con el tiempo virtual
  const inicioAnim = new WeakMap();
  function animaciones() {
    for (const a of document.getAnimations()) {
      if (!inicioAnim.has(a)) { inicioAnim.set(a, vt - (a.currentTime || 0)); a.pause(); }
      try { a.currentTime = vt - inicioAnim.get(a); } catch (e) {}
    }
  }
  window.__reloj = {
    paso(ms) {
      vt += ms;
      for (const el of audios) {   // final del audio
        const s = S(el);
        if (!s.paused && (vt - s.ini) / 1000 >= dur(el)) {
          s.cur = dur(el); s.paused = true; s.ended = true;
          eventos.push({ tipo: 'ended', vt, cur: s.cur });
          emitir(el, 'pause'); emitir(el, 'ended');
        }
      }
      for (let vueltas = 0; vueltas < 1000; vueltas++) {   // timers vencidos (también los que se agendan ahora)
        let prox = null;
        for (const [id, x] of timers) if (x.t <= vt && (!prox || x.t < prox[1].t)) prox = [id, x];
        if (!prox) break;
        const [id, x] = prox;
        if (x.cada) x.t += x.cada; else timers.delete(id);
        try { typeof x.f === 'function' ? x.f(...x.a) : eval(x.f); } catch (e) { console.error(e); }
      }
      animaciones();
      const cbs = raf; raf = new Map();
      for (const f of cbs.values()) { try { f(vt); } catch (e) { console.error(e); } }
      return vt;
    },
    get vt() { return vt; },
    get red() { return red; },
    eventos,
    realNow,
  };
}

// ── grabación ──
const navegador = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const pagina = await navegador.newPage({ viewport: { width: ANCHO, height: ALTO }, deviceScaleFactor: ESCALA });
pagina.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[página]', m.text()); });
pagina.on('crash', () => console.log('[la página se colgó]'));
navegador.on('disconnected', () => console.log('[se cerró el navegador]'));
pagina.on('pageerror', (e) => console.log('[error]', e.message));
await pagina.addInitScript(relojVirtual);
// sin la pantalla de inicio ni la del final (ni los controles de MapLibre)
await pagina.addInitScript(() => document.addEventListener('DOMContentLoaded', () => {
  const st = document.createElement('style');
  st.textContent = '#inicio, #fin, .maplibregl-ctrl { display: none !important; }';
  document.head.appendChild(st);
}));
await pagina.goto(`${BASE}deriva-3d/?sin-marco&sinvideo&t=${DESDE}`);
const cdp = await pagina.context().newCDPSession(pagina);

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
async function paso(ms) {
  await pagina.evaluate((ms) => window.__reloj.paso(ms), ms);
  // espera las teselas y las imágenes (sin avanzar el reloj)
  const t0 = Date.now();
  for (;;) {
    const listo = await pagina.evaluate(() => {
      const m = window.__mapa;
      return window.__reloj.red === 0 && (!m || (m.isStyleLoaded() && m.areTilesLoaded()));
    });
    if (listo || Date.now() - t0 > 8000) {
      if (!listo) console.log('  (espera agotada)', await pagina.evaluate(() => [window.__reloj.vt, window.__reloj.red, window.__mapa?.isStyleLoaded(), window.__mapa?.areTilesLoaded()]));
      break;
    }
    await dormir(25);
    await pagina.evaluate(() => window.__reloj.paso(0));
  }
}
const estado = () => pagina.evaluate(() => ({
  vt: window.__reloj.vt,
  listo: !!document.querySelector('#comenzar') && !document.querySelector('#comenzar').disabled,
  fin: !!document.querySelector('#fin.visible'),
}));

// 1) carga
console.log('cargando…');
for (;;) { await paso(DT); const e = await estado(); if (e.listo) break; if (e.vt > 120000) throw new Error('no apareció Start'); }
await pagina.evaluate(() => document.querySelector('#comenzar').click());
// 2) calentamiento hasta la primera vuelta al dron
console.log('calentando desde', DESDE, 's…');
let e;
for (;;) { await paso(DT); e = await estado(); if (e.fin) break; if (e.vt > 600000) throw new Error('no terminó'); }
const fin1 = e.vt;
console.log('vuelta al dron 1 en', (fin1 / 1000).toFixed(2));

// 3) se graba desde acá
const crudo = path.join(TMP, 'crudo.mp4');
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
  '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '10', '-pix_fmt', 'yuv420p', crudo], { stdio: ['pipe', 'inherit', 'inherit'] });
let cuadros = 0;
const grabarDesde = (await estado()).vt;
async function capturar() {
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 95, optimizeForSpeed: true, clip: { x: 0, y: 0, width: ANCHO, height: ALTO, scale: ESCALA } });
  const buf = Buffer.from(data, 'base64');
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  if (cuadros % (FPS * 5) === 0) fs.writeFileSync(path.join(TMP, 'muestras', `${String(cuadros / FPS).padStart(4, '0')}.jpg`), buf);
  cuadros++;
}
const reiniciarEn = fin1 + (VUELTA_SEG + QUIETO) * 1000;
let reiniciado = false, fin2 = null, t0 = Date.now();
await capturar();
for (;;) {
  await paso(DT);
  e = await estado();
  if (!reiniciado && e.vt >= reiniciarEn) {
    reiniciado = true;
    await pagina.evaluate(() => document.querySelector('#reiniciar').click());
    console.log('start again en', (e.vt / 1000).toFixed(2));
  }
  if (reiniciado && !fin2 && e.fin && e.vt > reiniciarEn + 60000) { fin2 = e.vt; console.log('vuelta al dron 2 en', (fin2 / 1000).toFixed(2)); }
  await capturar();
  if (cuadros % (FPS * 10) === 0) {
    const seg = (Date.now() - t0) / 1000;
    console.log(`  ${(cuadros / FPS).toFixed(0)} s grabados · ${(cuadros / seg).toFixed(1)} cuadros/s`);
  }
  if (fin2 && e.vt >= fin2 + (VUELTA_SEG + QUIETO) * 1000) break;
}
ff.stdin.end();
await new Promise((r) => ff.on('close', r));
const eventos = await pagina.evaluate(() => window.__reloj.eventos);
await navegador.close();
fs.writeFileSync(path.join(TMP, 'eventos.json'), JSON.stringify({ fin1, fin2, grabarDesde, reiniciarEn, eventos }, null, 1));

// ── montaje: el ciclo (de mitad de panorámica a mitad de panorámica) dos veces, con su audio ──
const cuadro = (vt) => Math.round((vt - grabarDesde) / DT);
const mitad = (VUELTA_SEG + QUIETO / 2) * 1000;
const a = cuadro(fin1 + mitad), b = cuadro(fin2 + mitad);   // [a, b): un ciclo
const n = b - a, largo = n / FPS;
const play = eventos.find((x) => x.tipo === 'play' && x.vt >= reiniciarEn - 1);
const retraso = (play.vt - (grabarDesde + a * DT)) / 1000;   // segundos de silencio antes de que arranque el audio
console.log(`ciclo: cuadros ${a}–${b} (${largo.toFixed(2)} s), audio a los ${retraso.toFixed(3)} s`);
// el ciclo se codifica una vez y se repite sin recodificar (un split+concat en ffmpeg guardaba en memoria la primera
// copia entera); el audio de las dos vueltas se arma aparte y se suma al final
const ciclo = path.join(TMP, 'ciclo.mp4'), lista = path.join(TMP, 'lista.txt'), dos = path.join(TMP, 'dos.mp4');
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', crudo, '-vf', `trim=start_frame=${a}:end_frame=${b},setpts=PTS-STARTPTS`,
  '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(FPS), ciclo], { stdio: 'inherit' });
fs.writeFileSync(lista, `file '${ciclo}'\nfile '${ciclo}'\n`);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lista, '-c', 'copy', dos], { stdio: 'inherit' });
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', dos, '-i', AUDIO, '-filter_complex',
  `[1:a]aresample=48000,adelay=${Math.round(retraso * 1000)}:all=1,apad,atrim=end_sample=${Math.round(largo * 48000)},asplit[a1][a2];` +
  `[a1][a2]concat=n=2:v=0:a=1[a]`,
  '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', SALIDA], { stdio: 'inherit' });
// control del loop: el último cuadro y el primero tienen que ser iguales
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', crudo, '-vf', `select='eq(n\\,${a})+eq(n\\,${b})'`, '-vsync', '0',
  path.join(TMP, 'borde-%d.png')]);
console.log('listo:', SALIDA, `(${(2 * largo / 60).toFixed(1)} min)`, '· temporales en', TMP);

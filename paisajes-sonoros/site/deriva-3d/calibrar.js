// Calibración de las proyecciones anamórficas.
// Se marcan pares "este píxel de la imagen = este punto de la ciudad" y se calcula la cámara
// (posición, orientación con giro, apertura y, opcionalmente, centro óptico) que mejor los explica.
// Sobre la imagen se dibujan los contornos de la ciudad vistos desde esa cámara: si calzan, la proyección calza.

import * as C from './camara.js';
import { aplicarAlturas, dentro } from './ciudad.js';

const $ = (s) => document.querySelector(s);
const R = window.RECORRIDO;
const RAD = Math.PI / 180;
const CLAVE = 'deriva3d-calibracion';

// ── coordenadas locales (idénticas a las de mapa.js) ──
const ORIGEN = maplibregl.MercatorCoordinate.fromLngLat([R.puntos[0].lng, R.puntos[0].lat], 0);
const ESCALA = ORIGEN.meterInMercatorCoordinateUnits();
const aLocal = ([lng, lat]) => {
  const mc = maplibregl.MercatorCoordinate.fromLngLat([lng, lat], 0);
  return [(mc.x - ORIGEN.x) / ESCALA, -(mc.y - ORIGEN.y) / ESCALA];
};
const aLngLat = (x, y) => new maplibregl.MercatorCoordinate(ORIGEN.x + x * ESCALA, ORIGEN.y - y * ESCALA, 0).toLngLat();
const aSeg = (v) => (typeof v === 'number' ? v : String(v).split(':').map(Number).reduce((a, b) => a * 60 + b, 0));
const red = (x, n) => Math.round(x * 10 ** n) / 10 ** n;

// ── datos guardados: borrador (localStorage) > calibracion.js > recorrido.js ──
const ARCHIVO = window.CALIBRACION || { vistas: {}, alturas: [] };
let borrador = null;
try { borrador = JSON.parse(localStorage.getItem(CLAVE) || 'null'); } catch (e) {}
let ALTURAS = (borrador && borrador.alturas) || [...(ARCHIVO.alturas || [])];

const LISTA = [];
(R.proyecciones || []).forEach((p) => p.vistas.forEach((v, k) => LISTA.push({ p, k, def: v })));
if (!LISTA.length) { document.body.innerHTML = '<p style="padding:2rem">No hay proyecciones en recorrido.js</p>'; throw new Error('sin vistas'); }

const trabajo = {}; // imagen → { v, pares, calculada, errores, tocada }
function abrirTrabajo(item) {
  const img = item.def.imagen;
  if (trabajo[img]) return trabajo[img];
  const guardada = (borrador && borrador.vistas && borrador.vistas[img]) || (ARCHIVO.vistas || {})[img];
  let v = C.normalizar(guardada ? { ...item.def, ...guardada, imagen: img } : item.def, aLocal);
  // protección: una cámara absurda (muy lejos o con zoom extremo) vuelve a la de recorrido.js, conservando los pares.
  // Las vistas isométricas (dioramas de IA, ver camara.js) están lejos y con teleobjetivo a propósito.
  const iso = !!item.def.isometrica;
  if (iso ? v.apertura < 0.3 || v.pos[2] > 3000 || Math.hypot(v.pos[0] - v.mira[0], v.pos[1] - v.mira[1]) > 4000
    : v.apertura < 2 || v.pos[2] > 1500 || Math.hypot(v.pos[0] - v.mira[0], v.pos[1] - v.mira[1]) > 3000) {
    v = C.normalizar(item.def, aLocal);
    setTimeout(() => aviso('La cámara guardada de esta vista era absurda (muy lejos o con zoom extremo); volví a la original. Tus pares se conservan.', 7000), 500);
  }
  const pares = ((guardada && guardada.pares) || []).map((q) => ({
    uv: q.u != null ? [q.u, q.v] : null, ll: q.lat != null ? { lat: q.lat, lng: q.lng } : null,
    alt: q.alt || 0, techo: !!q.techo, b: null,
  }));
  pares.forEach((q) => { if (q.ll) q.b = edificioEn([q.ll.lng, q.ll.lat], true); });
  trabajo[img] = { item, v, pares, calculada: clonar(v), errores: [], tocada: !!guardada };
  return trabajo[img];
}
const clonar = (v) => JSON.parse(JSON.stringify(v));

// ── edificios ──
let ORIG = [], DATOS = [], CAJAS = [], CENTROS = [], CARAS = [];
function prepararEdificios() {
  DATOS = aplicarAlturas(ORIG, ALTURAS);
  CARAS = [];
  DATOS.forEach(([h, mh, anillos], b) => {
    anillos.forEach((an, k) => {
      let r = an.map((p) => aLocal(p));
      if (r.length > 1 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1]) r = r.slice(0, -1);
      if (r.length < 3) return;
      const area = r.reduce((a, p, i) => { const q = r[(i + 1) % r.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0);
      if ((k === 0) !== (area > 0)) r.reverse();
      for (let i = 0; i < r.length; i++) {
        const a = r[i], c = r[(i + 1) % r.length];
        const dx = c[0] - a[0], dy = c[1] - a[1], L = Math.hypot(dx, dy);
        if (L < 0.05) continue;
        CARAS.push({ b, n: [dy / L, -dx / L], pts: [[a[0], a[1], mh], [c[0], c[1], mh], [c[0], c[1], h], [a[0], a[1], h]] });
      }
      if (k === 0) CARAS.push({ b, n: null, pts: r.map((p) => [p[0], p[1], h]) });
    });
  });
}
function edificioEn(ll, cercano = false) {
  for (let i = 0; i < DATOS.length; i++) {
    const c = CAJAS[i];
    if (ll[0] < c[0] - 1e-6 || ll[0] > c[2] + 1e-6 || ll[1] < c[1] - 1e-6 || ll[1] > c[3] + 1e-6) continue;
    if (dentro(ll, DATOS[i][2][0])) return i;
    if (cercano && DATOS[i][2][0].some((q) => Math.abs(q[0] - ll[0]) < 1e-7 && Math.abs(q[1] - ll[1]) < 1e-7)) return i;
  }
  return null;
}
function puntoInterior(anillo) {
  const n = anillo.length;
  const c = [anillo.reduce((s, p) => s + p[0], 0) / n, anillo.reduce((s, p) => s + p[1], 0) / n];
  if (dentro(c, anillo)) return c;
  const xs = [];
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = anillo[i], [xj, yj] = anillo[j];
    if ((yi > c[1]) !== (yj > c[1])) xs.push(xi + ((c[1] - yi) / (yj - yi)) * (xj - xi));
  }
  xs.sort((a, b) => a - b);
  return xs.length >= 2 ? [(xs[0] + xs[1]) / 2, c[1]] : anillo[0];
}

// ── estado ──
let T = null;                    // trabajo de la vista actual
let activo = -1;                 // par seleccionado
let edificioSel = null;
const img = new Image();
let W = 1, H = 1;
const asp = () => W / H;
const libres = () => ({ giro: $('#libre-giro').checked, apertura: $('#libre-apertura').checked, centro: $('#libre-centro').checked });
const altPar = (q) => (q.techo && q.b != null ? DATOS[q.b][0] : q.alt);
const completos = () => T.pares.filter((q) => q.uv && q.ll);
const aPar = (q) => { const [x, y] = aLocal([q.ll.lng, q.ll.lat]); return { uv: q.uv, X: [x, y, altPar(q)] }; };

// ─────────────────────────── IMAGEN ───────────────────────────
const lienzo = $('#lienzo'), ctx = lienzo.getContext('2d');
const fuera = document.createElement('canvas'), ctxF = fuera.getContext('2d');
let dpr = 1, esc = 1, ox = 0, oy = 0, pedido = false;
const anchoL = () => lienzo.clientWidth, altoL = () => lienzo.clientHeight;
function encuadrar() {
  const m = 30;
  esc = Math.min((anchoL() - 2 * m) / W, (altoL() - 2 * m) / H);
  ox = (anchoL() - W * esc) / 2; oy = (altoL() - H * esc) / 2;
  dibujar();
}
new ResizeObserver(() => {
  dpr = window.devicePixelRatio || 1;
  for (const c of [lienzo, fuera]) { c.width = anchoL() * dpr; c.height = altoL() * dpr; }
  if (img.complete && W > 1) encuadrar();
}).observe(lienzo);
const aPantalla = (uv) => [ox + uv[0] * W * esc, oy + uv[1] * H * esc];
const aImagen = (x, y) => [(x - ox) / (W * esc), (y - oy) / (H * esc)];

function dibujar() {
  if (pedido) return;
  pedido = true;
  requestAnimationFrame(() => { pedido = false; pintar(); });
}
function pintar() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, anchoL(), altoL());
  if (!T || W <= 1) return;
  ctx.fillStyle = '#1a1716';
  ctx.fillRect(ox, oy, W * esc, H * esc);
  ctx.globalAlpha = $('#opacidad').value / 100;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, ox, oy, W * esc, H * esc);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.strokeRect(ox, oy, W * esc, H * esc);
  if ($('#ver-contornos').checked) {
    ctx.save(); ctx.beginPath(); ctx.rect(ox, oy, W * esc, H * esc); ctx.clip();
    contornos();
    ctx.restore();
  }

  // pares: marcado (amarillo) → donde la cámara actual pone su punto 3D (rosa)
  const res = C.residuos(T.v, T.pares.map((q) => (q.uv && q.ll ? aPar(q) : { uv: [0, 0], X: [0, 0, -1e6] })), W, H);
  T.pares.forEach((q, i) => {
    if (!q.uv) return;
    const [x, y] = aPantalla(q.uv);
    if (q.ll && res[i]) {
      const [px, py] = aPantalla([q.uv[0] + res[i][0] / W, q.uv[1] + res[i][1] / H]);
      ctx.strokeStyle = '#ff4fa3'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(px, py); ctx.stroke();
      ctx.fillStyle = '#ff4fa3';
      ctx.beginPath(); ctx.arc(px, py, 3, 0, 7); ctx.fill();
    }
    ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x - 9, y); ctx.lineTo(x + 9, y); ctx.moveTo(x, y - 9); ctx.lineTo(x, y + 9); ctx.stroke();
    ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 1.2;
    ctx.stroke();
    if (i === activo) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 12, 0, 7); ctx.stroke(); }
    ctx.font = '600 12px -apple-system, Helvetica, sans-serif';
    ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeText(i + 1, x + 7, y - 7);
    ctx.fillStyle = '#ffd23f'; ctx.fillText(i + 1, x + 7, y - 7);
  });
}

// recorta un polígono (en coordenadas de cámara) contra el plano cercano z ≥ cerca
function recortar(pol, cerca) {
  const out = [];
  for (let i = 0; i < pol.length; i++) {
    const a = pol[i], b = pol[(i + 1) % pol.length];
    const ad = a[2] >= cerca, bd = b[2] >= cerca;
    if (ad) out.push(a);
    if (ad !== bd) { const t = (cerca - a[2]) / (b[2] - a[2]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, cerca]); }
  }
  return out;
}
// contornos de la ciudad vistos desde la cámara actual (pintor: de lejos a cerca, cada cara tapa lo de atrás)
function contornos() {
  const v = T.v, E = C.ejes(v), th = Math.tan((v.apertura * RAD) / 2), tv = th / asp(), c = v.centro || [0, 0];
  const [px, py, pz] = v.pos, Wd = W * esc, Hd = H * esc;
  const lista = [];
  for (const f of CARAS) {
    const ce = CENTROS[f.b];
    if (Math.hypot(ce[0] - px, ce[1] - py) > 900) continue;
    if (f.n) { const a = f.pts[0]; if (f.n[0] * (px - a[0]) + f.n[1] * (py - a[1]) <= 0) continue; }
    else if (pz <= f.pts[0][2]) continue;
    let cam = f.pts.map((p) => {
      const d0 = p[0] - px, d1 = p[1] - py, d2 = p[2] - pz;
      return [d0 * E.der[0] + d1 * E.der[1] + d2 * E.der[2], d0 * E.arr[0] + d1 * E.arr[1] + d2 * E.arr[2], d0 * E.f[0] + d1 * E.f[1] + d2 * E.f[2]];
    });
    cam = recortar(cam, 0.5);
    if (cam.length < 3) continue;
    let prof = 0, x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    const pant = cam.map((q) => {
      prof += q[2];
      const x = ox + ((q[0] / q[2] / th + c[0] + 1) / 2) * Wd, y = oy + ((1 - (q[1] / q[2] / tv + c[1])) / 2) * Hd;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      return [x, y];
    });
    if (x1 < 0 || y1 < 0 || x0 > anchoL() || y0 > altoL()) continue;
    lista.push({ pant, prof: prof / cam.length, sel: f.b === edificioSel || (activo >= 0 && T.pares[activo] && T.pares[activo].b === f.b) });
  }
  lista.sort((a, b) => b.prof - a.prof);
  const ocultar = $('#ver-ocultas').checked;
  ctxF.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctxF.clearRect(0, 0, anchoL(), altoL());
  ctxF.lineJoin = 'round';
  for (const { pant, sel } of lista) {
    ctxF.beginPath();
    pant.forEach(([x, y], i) => (i ? ctxF.lineTo(x, y) : ctxF.moveTo(x, y)));
    ctxF.closePath();
    if (ocultar) { ctxF.globalCompositeOperation = 'destination-out'; ctxF.fill(); ctxF.globalCompositeOperation = 'source-over'; }
    ctxF.strokeStyle = sel ? '#ffffff' : 'rgba(95,240,255,0.85)';
    ctxF.lineWidth = sel ? 2 : 1;
    ctxF.stroke();
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(fuera, 0, 0);
  ctx.restore();
}

// interacción con la imagen
(() => {
  let ini = null;
  lienzo.addEventListener('pointerdown', (ev) => {
    if (!T) return;
    lienzo.setPointerCapture(ev.pointerId);
    const r = lienzo.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top;
    let tomado = -1;
    T.pares.forEach((q, i) => { if (q.uv) { const [a, b] = aPantalla(q.uv); if (Math.hypot(a - x, b - y) < 10) tomado = i; } });
    ini = { x, y, ox, oy, tomado, movio: false };
    if (tomado >= 0) seleccionar(tomado);
  });
  lienzo.addEventListener('pointermove', (ev) => {
    if (!ini) return;
    const r = lienzo.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top;
    if (Math.hypot(x - ini.x, y - ini.y) > 3) ini.movio = true;
    if (!ini.movio) return;
    if (ini.tomado >= 0) {
      const [u, w] = aImagen(x, y);
      T.pares[ini.tomado].uv = [Math.max(0, Math.min(1, u)), Math.max(0, Math.min(1, w))];
      lienzo.style.cursor = 'grabbing';
    } else { ox = ini.ox + x - ini.x; oy = ini.oy + y - ini.y; lienzo.style.cursor = 'grabbing'; }
    dibujar();
  });
  lienzo.addEventListener('pointerup', (ev) => {
    if (!ini) return;
    lienzo.style.cursor = '';
    const r = lienzo.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top;
    if (ini.tomado >= 0 && ini.movio) cambio({ pares: true });
    else if (!ini.movio && ini.tomado < 0) {
      const [u, w] = aImagen(x, y);
      if (u >= 0 && u <= 1 && w >= 0 && w <= 1) marcarImagen([u, w]);
    }
    ini = null;
  });
  lienzo.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    const r = lienzo.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top;
    const f = Math.exp(-ev.deltaY * (ev.ctrlKey ? 0.01 : 0.0018));
    const nuevo = Math.max(0.05, Math.min(40, esc * f)), k = nuevo / esc;
    ox = x - (x - ox) * k; oy = y - (y - oy) * k; esc = nuevo;
    dibujar();
  }, { passive: false });
})();

function marcarImagen(uv) {
  let q = T.pares[activo];
  if (!q || q.uv) { q = nuevoPar(); }
  q.uv = uv;
  cambio({ pares: true });
}
function nuevoPar() {
  // reutiliza un par vacío si lo hay
  let i = T.pares.findIndex((q) => !q.uv && !q.ll);
  if (i < 0) { T.pares.push({ uv: null, ll: null, alt: 0, techo: false, b: null }); i = T.pares.length - 1; }
  activo = i;
  return T.pares[i];
}

// ─────────────────────────── MAPA ───────────────────────────
const mapa = new maplibregl.Map({
  container: 'mapa',
  style: {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: {
      sat: { type: 'raster', tileSize: 256, maxzoom: 19,
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        attribution: 'Imágenes © Esri, Maxar, Earthstar Geographics · Edificios © OpenStreetMap' },
    },
    layers: [
      { id: 'fondo', type: 'background', paint: { 'background-color': '#1c1a1a' } },
      { id: 'sat', type: 'raster', source: 'sat', paint: { 'raster-saturation': -0.3 } },
    ],
  },
  center: [R.puntos[0].lng, R.puntos[0].lat], zoom: 17, maxZoom: 22.5, pitchWithRotate: false,
  attributionControl: { compact: true },
});
mapa.touchPitch.disable();
mapa.addControl(new maplibregl.NavigationControl({ visualizePitch: false, showCompass: true }), 'top-right');
let marcasPares = [], marcaCamara = null, marcaMira = null;

function geoEdificios() {
  return { type: 'FeatureCollection', features: DATOS.map(([h, mh, an], i) => ({
    type: 'Feature', id: i, properties: { i, h, corr: h !== ORIG[i][0] ? 1 : 0 },
    geometry: { type: 'Polygon', coordinates: an } })) };
}
function geoVertices() {
  const f = [];
  DATOS.forEach(([, , an]) => an.forEach((r) => r.forEach((p) => f.push({ type: 'Feature', geometry: { type: 'Point', coordinates: p } }))));
  return { type: 'FeatureCollection', features: f };
}
function geoCampo() {
  const v = T.v, a = asp(), f = [];
  const suelo = (u, w) => {
    const d = C.rayo(v, a, u, w);
    const t = d[2] < -1e-3 ? Math.min(-v.pos[2] / d[2], 600) : 600;
    const ll = aLngLat(v.pos[0] + d[0] * t, v.pos[1] + d[1] * t);
    return [ll.lng, ll.lat];
  };
  const cam = aLngLat(v.pos[0], v.pos[1]);
  const esq = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([u, w]) => suelo(u, w));
  f.push({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[...esq, esq[0]]] } });
  for (const e of [esq[0], esq[1]]) f.push({ type: 'Feature', properties: { rayo: 1 }, geometry: { type: 'LineString', coordinates: [[cam.lng, cam.lat], e] } });
  const m = suelo(0.5, 0.5);
  f.push({ type: 'Feature', properties: { eje: 1 }, geometry: { type: 'LineString', coordinates: [[cam.lng, cam.lat], m] } });
  return { type: 'FeatureCollection', features: f };
}

mapa.on('load', async () => {
  ORIG = await (await fetch('edificios.json')).json();
  CAJAS = ORIG.map(([, , an]) => {
    const xs = an[0].map((p) => p[0]), ys = an[0].map((p) => p[1]);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  });
  CENTROS = ORIG.map(([, , an]) => aLocal([an[0].reduce((s, p) => s + p[0], 0) / an[0].length, an[0].reduce((s, p) => s + p[1], 0) / an[0].length]));
  prepararEdificios();
  mapa.addSource('edificios', { type: 'geojson', data: geoEdificios() });
  mapa.addSource('vertices', { type: 'geojson', data: geoVertices() });
  mapa.addSource('campo', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  mapa.addLayer({ id: 'campo-area', type: 'fill', source: 'campo', filter: ['==', ['geometry-type'], 'Polygon'],
    paint: { 'fill-color': '#8c9fc4', 'fill-opacity': 0.12 } });
  mapa.addLayer({ id: 'campo-lineas', type: 'line', source: 'campo',
    paint: { 'line-color': '#8c9fc4', 'line-width': ['case', ['has', 'eje'], 1, 1.5], 'line-dasharray': [3, 2] } });
  mapa.addLayer({ id: 'ed-relleno', type: 'fill', source: 'edificios',
    paint: { 'fill-color': ['case', ['==', ['get', 'corr'], 1], '#ffd23f', '#5ff0ff'],
      'fill-opacity': ['case', ['boolean', ['feature-state', 'sel'], false], 0.35, 0.08] } });
  mapa.addLayer({ id: 'ed-borde', type: 'line', source: 'edificios',
    paint: { 'line-color': ['case', ['boolean', ['feature-state', 'sel'], false], '#ffffff', ['==', ['get', 'corr'], 1], '#ffd23f', '#5ff0ff'],
      'line-width': ['case', ['boolean', ['feature-state', 'sel'], false], 2.5, 1], 'line-opacity': 0.9 } });
  mapa.addLayer({ id: 'ed-vertices', type: 'circle', source: 'vertices', minzoom: 17.5,
    paint: { 'circle-radius': 2.2, 'circle-color': '#5ff0ff', 'circle-stroke-color': '#000', 'circle-stroke-width': 0.5 } });
  mapa.addLayer({ id: 'ed-altura', type: 'symbol', source: 'edificios', minzoom: 18.3,
    layout: { 'text-field': ['concat', ['to-string', ['get', 'h']], ' m'], 'text-size': 10, 'text-font': ['Noto Sans Regular'] },
    paint: { 'text-color': '#fff', 'text-halo-color': '#000', 'text-halo-width': 1 } });
  iniciar();
});
mapa.on('error', (e) => { if (!/glyphs|font/i.test(String(e && e.error && e.error.message))) console.warn('mapa:', e && e.error); });

// esquina de edificio más cercana (en pantalla) al punto tocado
function pegar(ll) {
  const p = mapa.project(ll), m = 30 / 111320;
  let mejor = null;
  DATOS.forEach(([, , an], i) => {
    const c = CAJAS[i];
    if (ll.lng < c[0] - m || ll.lng > c[2] + m || ll.lat < c[1] - m || ll.lat > c[3] + m) return;
    for (const r of an) for (const q of r) {
      const s = mapa.project(q), d = Math.hypot(s.x - p.x, s.y - p.y);
      if (d < 14 && (!mejor || d < mejor.d)) mejor = { d, ll: { lng: q[0], lat: q[1] }, b: i };
    }
  });
  return mejor || { ll: { lng: ll.lng, lat: ll.lat }, b: edificioEn([ll.lng, ll.lat]) };
}
mapa.on('click', (e) => {
  if (!T) return;
  if (e.originalEvent.shiftKey) { elegirEdificio(edificioEn([e.lngLat.lng, e.lngLat.lat])); return; }
  const s = pegar(e.lngLat);
  let q = T.pares[activo];
  if (!q || q.ll) q = nuevoPar();
  q.ll = s.ll; q.b = s.b;
  if (q.b == null) q.techo = false;
  cambio({ pares: true });
});

function actualizarMapa() {
  if (!mapa.getSource('campo') || !T) return;
  mapa.getSource('campo').setData(geoCampo());
  const cam = aLngLat(T.v.pos[0], T.v.pos[1]);
  if (!marcaCamara) {
    const el = document.createElement('div');
    el.className = 'marca-camara'; el.textContent = '◉'; el.title = 'Cámara (arrastrar para moverla)';
    marcaCamara = new maplibregl.Marker({ element: el, draggable: true }).setLngLat(cam).addTo(mapa);
    marcaCamara.on('drag', () => {
      const ll = marcaCamara.getLngLat(), [x, y] = aLocal([ll.lng, ll.lat]);
      T.v.pos = [x, y, T.v.pos[2]];
      mapa.getSource('campo').setData(geoCampo());
      dibujar(); pintarAjustes();
    });
    marcaCamara.on('dragend', () => cambio({ manual: true }));
  } else marcaCamara.setLngLat(cam);
  marcasPares.forEach((m) => m.remove());
  marcasPares = T.pares.map((q, i) => {
    if (!q.ll) return null;
    const el = document.createElement('div');
    el.className = 'marca-mapa' + (i === activo ? ' activo' : '');
    el.textContent = i + 1;
    const mk = new maplibregl.Marker({ element: el, draggable: true }).setLngLat(q.ll).addTo(mapa);
    el.addEventListener('click', (ev) => { ev.stopPropagation(); seleccionar(i); });
    mk.on('dragend', () => { const s = pegar(mk.getLngLat()); q.ll = s.ll; q.b = s.b; activo = i; cambio({ pares: true }); });
    return mk;
  }).filter(Boolean);
}
let selPrevio = null;
function marcarEdificioMapa(b) {
  if (!mapa.getSource('edificios')) return;
  if (selPrevio != null) mapa.setFeatureState({ source: 'edificios', id: selPrevio }, { sel: false });
  if (b != null) mapa.setFeatureState({ source: 'edificios', id: b }, { sel: true });
  selPrevio = b;
}

// ─────────────────────────── EDIFICIO SELECCIONADO ───────────────────────────
function elegirEdificio(b) {
  edificioSel = b;
  $('#edificio').hidden = b == null;
  marcarEdificioMapa(b);
  if (b != null) {
    $('#alto-edificio').value = DATOS[b][0];
    const corr = DATOS[b][0] !== ORIG[b][0];
    $('#alto-original').textContent = corr ? `corregido · OpenStreetMap: ${ORIG[b][0]} m` : 'altura de OpenStreetMap (muchas son 3 m por defecto)';
    $('#quitar-alto').hidden = !corr;
  }
  dibujar();
}
function fijarAltura(b, alt) {
  const an = ORIG[b][2][0];
  ALTURAS = ALTURAS.filter((a) => !dentro([a.lng, a.lat], an));
  if (alt != null && alt !== ORIG[b][0]) {
    const [lng, lat] = puntoInterior(an);
    ALTURAS.push({ lat: red(lat, 7), lng: red(lng, 7), alt });
  }
  prepararEdificios();
  mapa.getSource('edificios').setData(geoEdificios());
  elegirEdificio(b);
  for (const t of Object.values(trabajo)) if (t.pares.some((q) => q.techo && q.b === b)) t.tocada = true;
  cambio({ pares: true, alturas: true });
}
$('#alto-edificio').addEventListener('change', () => {
  const a = parseFloat($('#alto-edificio').value);
  if (edificioSel != null && a > 0) fijarAltura(edificioSel, a);
});
$('#quitar-alto').addEventListener('click', () => edificioSel != null && fijarAltura(edificioSel, null));

// ─────────────────────────── LISTA DE PARES ───────────────────────────
function seleccionar(i) {
  activo = i;
  const q = T.pares[i];
  if (q && q.b != null) elegirEdificio(q.b);
  pintarLista(); actualizarMapa(); dibujar();
}
function pintarLista() {
  const tb = $('#lista-pares');
  const errs = T.errores || [];
  const ok = errs.filter(isFinite).sort((a, b) => a - b);
  const mediana = ok.length ? ok[Math.floor(ok.length / 2)] : 0;
  tb.innerHTML = '';
  T.pares.forEach((q, i) => {
    const tr = document.createElement('tr');
    if (i === activo) tr.className = 'activo';
    const e = errs[i];
    const malo = isFinite(e) && ok.length >= 5 && e > Math.max(8, mediana * 3);
    tr.innerHTML = `<td><span class="num">${i + 1}</span></td>
      <td class="${q.uv ? 'si' : 'no'}">${q.uv ? '✓' : '—'}</td>
      <td class="${q.ll ? 'si' : 'no'}">${q.ll ? '✓' : '—'}</td>
      <td><div class="alt"><input type="number" step="0.5" min="0" value="${red(altPar(q), 2)}" ${q.techo ? 'disabled' : ''} title="altura del punto sobre el piso">
        <button data-a="piso" title="punto a nivel del piso">piso</button>
        <button data-a="techo" ${q.b == null ? 'disabled' : ''} title="borde del techo del edificio (sigue su altura)">${q.techo ? '<u>techo</u>' : 'techo'}</button></div></td>
      <td class="${malo ? 'malo' : ''}">${isFinite(e) && q.uv && q.ll ? e.toFixed(1) : ''}</td>
      <td><button class="x" title="borrar">✕</button></td>`;
    tr.addEventListener('click', (ev) => { if (!ev.target.closest('input,button')) seleccionar(i); });
    tr.querySelector('input').addEventListener('change', (ev) => { q.alt = parseFloat(ev.target.value) || 0; q.techo = false; activo = i; cambio({ pares: true }); });
    tr.querySelector('[data-a=piso]').addEventListener('click', () => { q.alt = 0; q.techo = false; activo = i; cambio({ pares: true }); });
    tr.querySelector('[data-a=techo]').addEventListener('click', () => { q.techo = true; activo = i; if (q.b != null) elegirEdificio(q.b); cambio({ pares: true }); });
    tr.querySelector('.x').addEventListener('click', () => borrarPar(i));
    tb.appendChild(tr);
  });
  // instrucción
  const n = completos().length, q = T.pares[activo];
  let txt;
  if (!T.pares.length) txt = 'Hacé clic en un punto reconocible de la imagen (lo mejor: la esquina de un edificio al nivel del piso) y después en el mismo punto del mapa.';
  else if (q && q.uv && !q.ll) txt = `Ahora marcá el punto ${activo + 1} en el mapa.`;
  else if (q && q.ll && !q.uv) txt = `Ahora marcá el punto ${activo + 1} en la imagen.`;
  else if (n < 4) txt = `Faltan ${4 - n} pares para calcular. Conviene llegar a 8–12, repartidos por toda la imagen, cerca y lejos, en varias fachadas.`;
  else if (n < 8) txt = 'Ya se puede calcular. Con más pares bien repartidos el resultado es más firme.';
  else txt = 'Revisá los contornos celestes sobre la imagen: donde no calzan, agregá o corregí pares. En rosa: dónde la cámara pone cada punto.';
  $('#instruccion').textContent = txt;
}
function borrarPar(i) {
  T.pares.splice(i, 1);
  activo = Math.min(activo, T.pares.length - 1);
  cambio({ pares: true });
}
$('#nuevo-par').addEventListener('click', () => { nuevoPar(); pintarLista(); actualizarMapa(); dibujar(); });

// ─────────────────────────── CÁLCULO ───────────────────────────
function calcular(avisar) {
  const ps = completos().map(aPar);
  const lib = libres();
  if (ps.length < 4) {
    if (avisar) aviso('Hacen falta al menos 4 pares completos (con punto en la imagen y en el mapa).');
    return false;
  }
  const r = C.calibrar(ps, W, H, T.v, { ...lib, centro: lib.centro }, {
    original: C.normalizar(T.item.def, aLocal),
    dist: parseFloat($('#dist-max').value) || 300, apMin: parseFloat($('#ap-min').value) || 12,
  });
  if (!r) return false;
  T.v = { ...T.v, ...r.vista };
  T.calculada = clonar(T.v);
  T.ultimo = r;
  return true;
}
$('#original').addEventListener('click', () => {
  T.v = C.normalizar(T.item.def, aLocal); T.calculada = clonar(T.v); T.ultimo = null;
  cambio({ manual: true });
  aviso('Volví a la cámara puesta a mano en recorrido.js.', 2500);
});
function actualizarErrores() {
  const res = C.residuos(T.v, T.pares.map((q) => (q.uv && q.ll ? aPar(q) : { uv: [0, 0], X: [0, 0, -1e6] })), W, H);
  T.errores = res.map((r, i) => (r && T.pares[i].uv && T.pares[i].ll ? Math.hypot(r[0], r[1]) : NaN));
  const ok = T.errores.filter(isFinite);
  const v = T.v;
  let txt = '';
  if (ok.length) {
    const medio = Math.sqrt(ok.reduce((s, e) => s + e * e, 0) / ok.length);
    const max = Math.max(...ok), imax = T.errores.indexOf(max);
    txt += `<b>${ok.length}</b> pares · error medio <b>${medio.toFixed(1)} px</b> (${((medio / W) * 100).toFixed(1)} % del ancho)` +
      ` · máx. <span class="${max > Math.max(8, medio * 3) ? 'malo' : ''}">${max.toFixed(1)} px en #${imax + 1}</span><br>`;
  }
  // avisos sobre la calidad del cálculo
  const comp = completos(), n = comp.length, avisos = [];
  if (n >= 4) {
    const alts = comp.map(altPar);
    if (Math.max(...alts) - Math.min(...alts) < 1) avisos.push('Todos los puntos están a la misma altura (el piso): así no se puede saber bien la altura de la cámara. Sumá 2 o 3 puntos en <b>techos</b> o en lo alto de la torre, con la altura correcta del edificio.');
    const u = comp.map((q) => q.uv[0]), w = comp.map((q) => q.uv[1]);
    if (Math.max(...u) - Math.min(...u) < 0.4 || Math.max(...w) - Math.min(...w) < 0.25) avisos.push('Los puntos están amontonados en una parte de la imagen: repartilos hacia los bordes.');
    if (n < 6) avisos.push(`Con ${n} pares la apertura queda fija (${red(v.apertura, 1)}°). Desde 6 pares se calcula también.`);
    if (T.ultimo && T.ultimo.limitada) avisos.push('La cámara llegó a un límite (distancia máxima o apertura mínima). Pasa con imágenes casi sin perspectiva, como los dioramas: los contornos van a calzar en el centro y menos en los bordes. Podés subir la distancia máxima para probar.');
    if ($('#libre-centro').checked && n < 8) avisos.push('El centro óptico se calcula recién desde 8 pares.');
  }
  if (avisos.length) txt += '<span class="avisos">' + avisos.map((a) => '⚠ ' + a).join('<br>') + '</span><br>';
  txt += `cámara a <b>${red(v.pos[2], 1)} m</b> de altura · apertura ${red(v.apertura, 1)}° · giro ${red(v.giro, 1)}°` +
    (v.centro[0] || v.centro[1] ? ` · centro ${red(v.centro[0], 3)}, ${red(v.centro[1], 3)}` : '');
  $('#resultado').innerHTML = txt;
}
$('#calcular').addEventListener('click', () => { if (calcular(true)) cambio({ calculo: true }); });
['#libre-giro', '#libre-apertura', '#libre-centro', '#dist-max', '#ap-min'].forEach((s) => $(s).addEventListener('change', () => {
  if ($('#auto').checked && calcular(false)) cambio({ calculo: true });
}));

// ─────────────────────────── AJUSTE MANUAL ───────────────────────────
const AJUSTES = [
  { id: 'adelante', nombre: 'adelante', rango: 30, u: 'm', val: () => '' },
  { id: 'lateral', nombre: 'lateral', rango: 30, u: 'm', val: () => '' },
  { id: 'altura', nombre: 'altura', rango: 30, u: 'm', val: (v) => red(v.pos[2], 1) + ' m' },
  { id: 'rumbo', nombre: 'rumbo', rango: 15, u: '°', val: (v) => red(((v.rumbo % 360) + 360) % 360, 1) + '°' },
  { id: 'cabeceo', nombre: 'mira abajo', rango: 10, u: '°', val: (v) => red(v.cabeceo, 1) + '°' },
  { id: 'giro', nombre: 'giro', rango: 10, u: '°', val: (v) => red(v.giro, 2) + '°' },
  { id: 'apertura', nombre: 'apertura', rango: 15, u: '°', val: (v) => red(v.apertura, 1) + '°' },
  { id: 'cx', nombre: 'centro ←→', rango: 0.3, u: '', val: (v) => red(v.centro[0], 3) },
  { id: 'cy', nombre: 'centro ↑↓', rango: 0.3, u: '', val: (v) => red(v.centro[1], 3) },
];
function aplicarAjuste(b, id, d) {
  const v = clonar(b), r = v.rumbo * RAD;
  if (id === 'adelante') { v.pos[0] += Math.sin(r) * d; v.pos[1] += Math.cos(r) * d; }
  else if (id === 'lateral') { v.pos[0] += Math.cos(r) * d; v.pos[1] -= Math.sin(r) * d; }
  else if (id === 'altura') v.pos[2] = Math.max(1, v.pos[2] + d);
  else if (id === 'rumbo') v.rumbo += d;
  else if (id === 'cabeceo') v.cabeceo = Math.max(-89, Math.min(89, v.cabeceo + d));
  else if (id === 'giro') v.giro += d;
  else if (id === 'apertura') v.apertura = Math.max(3, Math.min(150, v.apertura + d));
  else if (id === 'cx') v.centro = [v.centro[0] + d, v.centro[1]];
  else if (id === 'cy') v.centro = [v.centro[0], v.centro[1] + d];
  return v;
}
(() => {
  const cont = $('#ajustes');
  for (const a of AJUSTES) {
    const et = document.createElement('label'); et.textContent = a.nombre; et.htmlFor = 'aj-' + a.id;
    const sl = document.createElement('input');
    Object.assign(sl, { type: 'range', id: 'aj-' + a.id, min: -1000, max: 1000, value: 0 });
    const val = document.createElement('span'); val.className = 'val'; val.id = 'val-' + a.id;
    let base = null;
    sl.addEventListener('input', () => {
      if (!T) return;
      if (!base) base = clonar(T.v);
      const x = sl.value / 1000;
      const d = Math.sign(x) * x * x * a.rango; // más fino cerca del centro
      T.v = aplicarAjuste(base, a.id, d);
      val.textContent = (d >= 0 ? '+' : '') + red(d, a.u === 'm' ? 2 : 3) + a.u;
      dibujar(); actualizarErrores(); if (mapa.getSource('campo')) mapa.getSource('campo').setData(geoCampo());
    });
    sl.addEventListener('change', () => {
      base = null; sl.value = 0;
      cambio({ manual: true });
    });
    cont.append(et, sl, val);
  }
})();
function pintarAjustes() { for (const a of AJUSTES) $('#val-' + a.id).textContent = T ? a.val(T.v) : ''; }
$('#deshacer').addEventListener('click', () => { T.v = clonar(T.calculada); cambio({ manual: true }); });

// ─────────────────────────── GUARDAR ───────────────────────────
function exportarVista(t) {
  const v = t.v, a = t.item && W > 1 && T === t ? asp() : (t.aspecto || 1.45);
  const E = C.ejes(v);
  const ps = t.pares.filter((q) => q.uv && q.ll);
  // la "mira" (punto al que apunta el centro de la imagen, para el vuelo de la cámara): a la profundidad media de los pares
  let D = 80;
  if (ps.length) D = ps.reduce((s, q) => {
    const [x, y] = aLocal([q.ll.lng, q.ll.lat]), z = q.techo && q.b != null ? DATOS[q.b][0] : q.alt;
    return s + ((x - v.pos[0]) * E.f[0] + (y - v.pos[1]) * E.f[1] + (z - v.pos[2]) * E.f[2]);
  }, 0) / ps.length;
  const d = C.rayoCentro(v, a);
  const m = [0, 1, 2].map((i) => v.pos[i] + d[i] * Math.max(10, D));
  const cam = aLngLat(v.pos[0], v.pos[1]), mi = aLngLat(m[0], m[1]);
  return {
    camara: { lat: red(cam.lat, 7), lng: red(cam.lng, 7), alt: red(v.pos[2], 2) },
    mira: { lat: red(mi.lat, 7), lng: red(mi.lng, 7), alt: red(Math.max(0, m[2]), 2) },
    rumbo: red(v.rumbo, 3), cabeceo: red(v.cabeceo, 3), giro: red(v.giro, 3),
    apertura: red(v.apertura, 3), centro: [red(v.centro[0], 4), red(v.centro[1], 4)],
    pares: t.pares.filter((q) => q.uv || q.ll).map((q) => ({
      ...(q.uv ? { u: red(q.uv[0], 5), v: red(q.uv[1], 5) } : {}),
      ...(q.ll ? { lat: red(q.ll.lat, 7), lng: red(q.ll.lng, 7) } : {}),
      alt: red(q.alt, 2), ...(q.techo ? { techo: true } : {}),
    })),
  };
}
function todo() {
  const vistas = { ...(ARCHIVO.vistas || {}) };
  if (borrador && borrador.vistas) Object.assign(vistas, borrador.vistas);
  for (const [k, t] of Object.entries(trabajo)) if (t.tocada) vistas[k] = exportarVista(t);
  return { vistas, alturas: ALTURAS };
}
const ESTADO_ARCHIVO = JSON.stringify({ vistas: ARCHIVO.vistas || {}, alturas: ARCHIVO.alturas || [] });
function guardarBorrador() {
  const c = todo();
  try { localStorage.setItem(CLAVE, JSON.stringify(c)); } catch (e) {}
  const sucio = JSON.stringify(c) !== ESTADO_ARCHIVO;
  $('#estado').textContent = sucio ? 'cambios sin guardar en calibracion.js' : 'guardado';
  $('#estado').classList.toggle('sucio', sucio);
}
$('#guardar').addEventListener('click', async () => {
  const c = todo();
  try {
    const r = await fetch('guardar-calibracion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(c) });
    if (!r.ok) throw new Error(r.status);
    ARCHIVO.vistas = c.vistas; ARCHIVO.alturas = c.alturas;
    try { localStorage.removeItem(CLAVE); } catch (e) {}
    borrador = null;
    $('#estado').textContent = 'guardado en calibracion.js';
    $('#estado').classList.remove('sucio');
    aviso('Guardado en calibracion.js. La página del recorrido ya usa estas cámaras.', 2500);
  } catch (e) {
    const js = `window.CALIBRACION = ${JSON.stringify(c, null, 2)};\n`;
    try { await navigator.clipboard.writeText(js); } catch (er) {}
    aviso('No se pudo escribir el archivo (hace falta abrir esta página con "npm run local"). ' +
      'Copié el contenido completo de calibracion.js al portapapeles: pegalo en site/deriva-3d/calibracion.js.', 9000);
  }
});
$('#probar').addEventListener('click', () => {
  guardarBorrador();
  // los tramos se calculan en la página del recorrido (por cercanía del caminante): se pide el lugar
  window.open(`./?prueba&lugar=${encodeURIComponent(T.item.p.lugar || '')}`, '_blank');
});
$('#copiar').addEventListener('click', async () => {
  const e = exportarVista(T);
  const f = (o) => `{ lat: ${o.lat}, lng: ${o.lng}, alt: ${o.alt} }`;
  const txt = `        { imagen: '${T.item.def.imagen}', apertura: ${e.apertura}, rumbo: ${e.rumbo}, cabeceo: ${e.cabeceo}, giro: ${e.giro}, centro: [${e.centro}],\n` +
    `          camara: ${f(e.camara)}, mira: ${f(e.mira)} },`;
  try { await navigator.clipboard.writeText(txt); aviso('Bloque de la vista copiado (para pegar en recorrido.js).', 2500); }
  catch (er) { aviso(txt, 12000); }
});

let tAviso = null;
function aviso(txt, ms = 4000) {
  const el = $('#aviso');
  el.textContent = txt; el.hidden = false;
  clearTimeout(tAviso);
  tAviso = setTimeout(() => (el.hidden = true), ms);
}

// ─────────────────────────── CICLO ───────────────────────────
// todo cambio pasa por aquí: recalcula si corresponde, redibuja y guarda el borrador
function cambio({ pares, manual, calculo } = {}) {
  if (!T) return;
  if (pares || manual || calculo) T.tocada = true;
  if (pares && $('#auto').checked) calcular(false);
  actualizarErrores();
  pintarLista(); pintarAjustes(); actualizarMapa(); dibujar();
  guardarBorrador();
}

// límites del ajuste: las vistas isométricas pueden (y deben) irse lejos con un teleobjetivo
function limitesPara(item) {
  const iso = !!item.def.isometrica;
  $('#dist-max').value = iso ? Math.round(C.DIST_ISO * 1.25) : 300;
  $('#ap-min').value = iso ? 0.5 : 12;
}
function abrirVista(i) {
  const item = LISTA[i];
  limitesPara(item);
  T = abrirTrabajo(item);
  activo = T.pares.length ? 0 : -1;
  edificioSel = null; $('#edificio').hidden = true; marcarEdificioMapa(null);
  try { localStorage.setItem(CLAVE + '-vista', String(i)); } catch (e) {}
  W = H = 1;
  img.onload = () => {
    W = img.naturalWidth; H = img.naturalHeight; T.aspecto = W / H;
    encuadrar();
    cambio();
    const cam = aLngLat(T.v.pos[0], T.v.pos[1]), m = aLngLat(T.v.mira[0], T.v.mira[1]);
    // vistas isométricas: la cámara está a ~1 km; el mapa se encuadra en el lugar, que es donde se marcan los pares
    const b = item.def.isometrica ? new maplibregl.LngLatBounds(m, m) : new maplibregl.LngLatBounds(cam, cam).extend(m);
    if (item.def.isometrica && !T.pares.some((q) => q.ll)) b.extend([m.lng - 0.0006, m.lat - 0.0005]).extend([m.lng + 0.0006, m.lat + 0.0005]);
    T.pares.forEach((q) => q.ll && b.extend(q.ll));
    mapa.fitBounds(b, { padding: 70, maxZoom: 18.3, duration: 600 });
  };
  img.onerror = () => aviso('No se pudo cargar ' + item.def.imagen);
  img.src = item.def.imagen;
}

function iniciar() {
  const sel = $('#vista');
  sel.innerHTML = LISTA.map((it, i) => `<option value="${i}">${it.p.lugar} · vista ${it.k + 1} · ${it.def.imagen.replace('registros/', '')}</option>`).join('');
  let i0 = 0;
  try { i0 = Math.min(LISTA.length - 1, parseInt(localStorage.getItem(CLAVE + '-vista') || '0', 10) || 0); } catch (e) {}
  sel.value = i0;
  sel.addEventListener('change', () => abrirVista(+sel.value));
  abrirVista(i0);
}

['#ver-contornos', '#ver-ocultas', '#opacidad'].forEach((s) => $(s).addEventListener('input', dibujar));
$('#ver-satelite').addEventListener('change', (e) => mapa.setLayoutProperty('sat', 'visibility', e.target.checked ? 'visible' : 'none'));
$('#ver-edificios').addEventListener('change', (e) => ['ed-relleno', 'ed-borde', 'ed-vertices', 'ed-altura']
  .forEach((l) => mapa.setLayoutProperty(l, 'visibility', e.target.checked ? 'visible' : 'none')));
window.addEventListener('keydown', (ev) => {
  if (ev.target.closest('input,select,textarea') || !T) return;
  if ((ev.key === 'Backspace' || ev.key === 'Delete') && activo >= 0) { ev.preventDefault(); borrarPar(activo); }
  else if (ev.key === 'n') { nuevoPar(); pintarLista(); actualizarMapa(); dibujar(); }
  else if (ev.key === '0') encuadrar();
  else if (ev.key === 'Escape') { activo = -1; elegirEdificio(null); pintarLista(); actualizarMapa(); }
});

// para depurar desde la consola
window.__calibrar = { estado: () => T, cambio, abrirVista, aLocal, aLngLat, mapa, pantalla: aPantalla };

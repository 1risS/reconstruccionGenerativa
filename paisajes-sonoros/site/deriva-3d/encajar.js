// Encajar fachadas: cambiar a mano el tamaño y la posición de cada imagen proyectada para que calce con los
// volúmenes de edificios.json, y, si hace falta, mover el proyector (la cámara desde donde se tomó).
//
// Cada imagen es un proyector (camara.js). Lo que acá se llama "ancho", "alto" y "posición" se traduce así:
//   ancho    → apertura (el centro óptico se corrige para que la imagen crezca desde su centro)
//   alto     → estirar (sin la proporción, el alto cambia solo); con la proporción, la apertura
//   posición → centro (desplazamiento del centro óptico), medido en metros sobre la pared que mira la foto
//   giro     → giro
// Y en "Proyector":
//   costado / adelante → pos, sobre los ejes horizontales de la foto (derecha de la imagen y hacia la pared)
//   altura   → pos[2] · rumbo, cabeceo → orientación
// Cambiar el tamaño sólo puede encajar una pared. Una foto que dobla una esquina (una ochava, dos fachadas) se pliega
// bien únicamente si el proyector está donde estaba el fotógrafo: eso se corrige moviendo el proyector, con la apertura
// de la lente real y sin desplazar el centro.
// Las medidas en metros son a la distancia de la `mira` de la vista (el punto de la pared al que apunta).
// "Guardar" escribe calibracion.js con el mismo POST que calibrar.html (sólo con npm run local) y conserva
// los pares que se hayan marcado allá.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as C from './camara.js';
import { crearCiudad, dentro } from './ciudad.js';
import { ESTILOS } from './estilos.js';

const $ = (s) => document.querySelector(s);
const RAD = Math.PI / 180;
const R = window.RECORRIDO;
const clonar = (o) => JSON.parse(JSON.stringify(o));
const red = (x, d) => Math.round(x * 10 ** d) / 10 ** d;
const fmt = (x, d = 2) => (Math.round(x * 10 ** d) / 10 ** d).toLocaleString('es-AR', { maximumFractionDigits: d });
const CLAVE_PRUEBA = 'deriva3d-calibracion'; // el borrador que lee la deriva con ?prueba (el mismo de calibrar.html)
const MAQUETA = ESTILOS.find((e) => e.id === 'maqueta');

// ── coordenadas locales en metros (las mismas que mapa.js y calibrar.js: Mercator de MapLibre, origen en el
//    primer punto del recorrido) ──
const mx = (lng) => (180 + lng) / 360;
const my = (lat) => (180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))) / 360;
const O = R.puntos[0];
const OX = mx(O.lng), OY = my(O.lat);
const ESC = 1 / (2 * Math.PI * 6371008.8) / Math.cos(O.lat * RAD); // meterInMercatorCoordinateUnits
const aLocal = ([lng, lat]) => [(mx(lng) - OX) / ESC, -(my(lat) - OY) / ESC];
const aLngLat = (x, y) => {
  const X = OX + x * ESC, Y = OY - y * ESC;
  return { lng: X * 360 - 180, lat: (360 / Math.PI) * Math.atan(Math.exp((180 - Y * 360) * RAD)) - 90 };
};

// ── vistas ──
const ARCHIVO = window.CALIBRACION || { vistas: {}, alturas: [] };
let ALTURAS = clonar(ARCHIVO.alturas || []);
const ALTURAS_GUARDADAS = JSON.stringify(ALTURAS);
const ITEMS = [];
for (const p of R.proyecciones || []) {
  for (const def of p.vistas) {
    const cal = (ARCHIVO.vistas || {})[def.imagen] || null;
    const v = C.normalizar(cal ? { ...def, ...cal, imagen: def.imagen } : def, aLocal);
    const it = { idx: ITEMS.length, lugar: p.lugar, tipo: def.tipo || p.tipo || '', def, cal, v, D: 1,
      guardada: clonar(v), aspecto: 1.45, hist: [] };
    distancia(it);
    ITEMS.push(it);
  }
}
// distancia a la pared, sobre el eje: a esa distancia se miden los metros. La mira (el punto de la pared al que
// apunta la foto) queda fija cuando se mueve el proyector.
function distancia(it) {
  const v = it.v, E = C.ejes(v);
  it.D = Math.max(1, [0, 1, 2].reduce((s, i) => s + (v.mira[i] - v.pos[i]) * E.f[i], 0));
}
// mueve el proyector sobre los ejes horizontales de la foto: a la derecha de la imagen, hacia la pared, arriba (m)
function moverProyector(it, der, adel, arr) {
  const r = it.v.rumbo * RAD, s = Math.sin(r), c = Math.cos(r);
  it.v.pos = [it.v.pos[0] + der * c + adel * s, it.v.pos[1] - der * s + adel * c, it.v.pos[2] + arr];
}
// cuánto se movió el proyector respecto de lo guardado, en los mismos ejes (los de la vista guardada)
function corrimiento(it) {
  const g = it.guardada, r = g.rumbo * RAD, s = Math.sin(r), c = Math.cos(r);
  const dx = it.v.pos[0] - g.pos[0], dy = it.v.pos[1] - g.pos[1];
  return { der: dx * c - dy * s, adel: dx * s + dy * c };
}
const VISTAS = ITEMS.map((it) => it.v);
ITEMS.forEach((it) => {
  const im = new Image();
  im.onload = () => { it.aspecto = im.naturalWidth / im.naturalHeight; if (it === T) pintar(); };
  im.src = it.def.imagen;
});

const sel = $('#vista');
for (const it of ITEMS) {
  const o = document.createElement('option');
  o.value = it.idx;
  o.textContent = `${it.lugar} · ${it.tipo} · ${it.def.imagen.replace('registros/', '')}`;
  sel.append(o);
}
let T = null; // la vista que se está encajando

// ── medidas de la imagen sobre la pared ──
const th = (v) => Math.tan((v.apertura * RAD) / 2);
const tv = (it, v = it.v) => C.tanV(v, it.aspecto);
const medidas = (it, v = it.v) => ({
  ancho: 2 * it.D * th(v),
  alto: 2 * it.D * tv(it, v),
  // dónde cae el centro de la imagen respecto del eje óptico (m, derecha y arriba positivos)
  x: -v.centro[0] * th(v) * it.D,
  y: -v.centro[1] * tv(it, v) * it.D,
});
const lim = (x, a, b) => Math.max(a, Math.min(b, x));

function setAncho(it, m, proporcion) {
  const v = it.v, t0 = th(v), t1 = Math.tan(lim(2 * Math.atan(m / (2 * it.D)), 0.02 * RAD, 170 * RAD) / 2);
  v.apertura = (2 * Math.atan(t1)) / RAD;
  v.centro[0] *= t0 / t1;                          // crece desde su centro
  if (proporcion) v.centro[1] *= t0 / t1;          // el alto escala igual
  else v.estirar = lim((v.estirar || 1) * (t0 / t1), 0.1, 10);   // el alto queda como estaba
}
function setAlto(it, m, proporcion) {
  const v = it.v, a = medidas(it);
  if (proporcion) return setAncho(it, (a.ancho * m) / a.alto, true);
  const k = lim(m / a.alto, 0.1 / (v.estirar || 1), 10 / (v.estirar || 1));
  v.estirar = (v.estirar || 1) * k;
  v.centro[1] /= k;
}
// posición absoluta del centro de la imagen (m)
function setX(it, x) { it.v.centro[0] = -x / (th(it.v) * it.D); }
function setY(it, y) { it.v.centro[1] = -y / (tv(it) * it.D); }

// ── historial ──
function recordar() {
  T.hist.push(clonar(T.v));
  if (T.hist.length > 300) T.hist.shift();
}
function deshacer() {
  if (!T.hist.length) return aviso('No hay nada para deshacer.', 1200);
  Object.assign(T.v, T.hist.pop());
  aplicar();
}
const tocada = (it) => {
  const a = it.v, b = it.guardada, e = 1e-7;
  return Math.abs(a.apertura - b.apertura) > e || Math.abs(a.giro - b.giro) > e || Math.abs((a.estirar || 1) - (b.estirar || 1)) > e ||
    Math.abs(a.centro[0] - b.centro[0]) > e || Math.abs(a.centro[1] - b.centro[1]) > e || movido(it) ||
    Math.abs(a.rumbo - b.rumbo) > e || Math.abs(a.cabeceo - b.cabeceo) > e;
};
const movido = (it) => [0, 1, 2].some((i) => Math.abs(it.v.pos[i] - it.guardada.pos[i]) > 1e-4);

// ── escena ──
const lienzo = $('#lienzo');
const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true });
renderer.setPixelRatio(1); // el tamaño se pone en píxeles del dispositivo (prepasar de ciudad.js trabaja así)
renderer.setClearColor(new THREE.Color(...MAQUETA.niebla));
const escena = new THREE.Scene();
const camPov = new THREE.PerspectiveCamera(40, 1, 0.3, 6000);
const camLibre = new THREE.PerspectiveCamera(50, 1, 0.5, 6000);
camLibre.up.set(0, 0, 1);
const controles = new OrbitControls(camLibre, lienzo);
controles.enableDamping = true;
controles.dampingFactor = 0.15;
controles.enabled = false;

// aristas de los volúmenes: un poco adelantadas hacia la cámara para que no se peleen con las paredes
const matAristas = new THREE.ShaderMaterial({
  uniforms: { uColor: { value: new THREE.Color(0x00b8d9) } },
  vertexShader: 'void main() { vec4 p = modelViewMatrix * vec4(position, 1.0); p.xyz *= 0.997; gl_Position = projectionMatrix * p; }',
  fragmentShader: 'uniform vec3 uColor; void main() { gl_FragColor = vec4(uColor, 1.0); }',
  depthWrite: false,
});
let ciudad = null, aristas = null, DATOS = null;

async function armarCiudad() {
  const nueva = await crearCiudad(THREE, {
    url: 'edificios.json', local: aLocal, sol: { azimut: 235, elevacion: 14 },
    vistas: VISTAS, alturas: ALTURAS, repintar: () => {},
  });
  nueva.setEstilo(MAQUETA);
  nueva.setSuelo(1);
  if (ciudad) { escena.remove(ciudad.grupo); ciudad.liberar(); }
  ciudad = nueva;
  escena.add(ciudad.grupo);
  if (aristas) { escena.remove(aristas); aristas.geometry.dispose(); }
  aristas = new THREE.LineSegments(new THREE.EdgesGeometry(ciudad.edificios.geometry, 25), matAristas);
  aristas.frustumCulled = false;
  aristas.renderOrder = 5;
  aristas.visible = $('#ver-aristas').checked;
  escena.add(aristas);
  if (T) enfocar(false);
}

// ── vista desde la foto: la cámara es el proyector, con la imagen entera en pantalla (más zoom y desplazamiento) ──
const pov = { zoom: 1, pan: [0, 0] };
let W = 1, H = 1;
function escalaPov() {
  const v = T.v, a = T.aspecto, ca = W / H, t0 = th(v), t1 = tv(T);
  const thD = (Math.max(t0, t1 * ca) * 1.1) / pov.zoom, tvD = thD / ca;
  return { t0, t1, thD, tvD, sx: t0 / thD, sy: t1 / tvD, a };
}
function camaraPov() {
  const v = T.v, e = escalaPov();
  const dv = { ...v, apertura: (2 * Math.atan(e.thD)) / RAD, estirar: 1,
    centro: [v.centro[0] * e.sx + pov.pan[0], v.centro[1] * e.sy + pov.pan[1]] };
  camPov.near = v.isometrica ? Math.max(1, T.D * 0.3) : 0.3;
  camPov.far = T.D * 2 + 3000;
  C.configurarThree(THREE, camPov, dv, W / H);
  // borde de la imagen: su centro queda en `pan` y mide sx × sy de la pantalla (en unidades −1…1)
  const m = $('#marco'), dpr = devicePixelRatio || 1, cw = W / dpr, ch = H / dpr;
  m.style.left = `${((pov.pan[0] - e.sx + 1) / 2) * cw}px`;
  m.style.width = `${e.sx * cw}px`;
  m.style.top = `${((1 - pov.pan[1] - e.sy) / 2) * ch}px`;
  m.style.height = `${e.sy * ch}px`;
}

let modo = 'pov';
function setModo(m) {
  modo = m;
  controles.enabled = m === 'libre';
  $('#modo-pov').classList.toggle('activo', m === 'pov');
  $('#modo-libre').classList.toggle('activo', m === 'libre');
  $('#escena').classList.toggle('pov', m === 'pov');
  $('#marco').hidden = m !== 'pov';
  $('#ayuda').textContent = m === 'pov'
    ? 'arrastrar = desplazar · rueda = zoom · doble clic o 0 = encuadrar · ⇧ clic = altura del edificio'
    : 'arrastrar = girar · clic derecho o ⇧ arrastrar = desplazar · rueda = acercar · ⇧ clic = altura del edificio';
}
// cámara libre: frente al lugar, del lado del proyector
function enfocar(mover = true) {
  const v = T.v, m = v.mira;
  if (!mover) return;
  let dx = v.pos[0] - m[0], dy = v.pos[1] - m[1];
  const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
  const d = Math.min(45, Math.max(18, T.D * (v.isometrica ? 0.03 : 1.2)));
  controles.target.set(m[0], m[1], Math.max(2, m[2]));
  camLibre.position.set(m[0] + dx * d, m[1] + dy * d, Math.max(4, m[2]) + d * 0.35);
  controles.update();
}

function elegir(idx) {
  T = ITEMS[idx];
  sel.value = idx;
  try { localStorage.setItem('encajar-vista', T.def.imagen); } catch (e) {}
  pov.zoom = 1; pov.pan = [0, 0];
  $('#plana').src = T.def.imagen;
  $('#edificio').hidden = true;
  enfocar();
  pintar();
}
sel.addEventListener('change', () => elegir(+sel.value));

// ── panel ──
function pintar() {
  if (!T) return;
  const a = medidas(T), g = medidas(T, T.guardada);
  const enFoco = (el) => document.activeElement === el;
  const poner = (id, x) => { const el = $(id); if (!enFoco(el)) el.value = red(x, 2); };
  poner('#ancho', a.ancho); poner('#alto', a.alto);
  poner('#mover-x', a.x - g.x); poner('#mover-y', a.y - g.y);
  poner('#giro', T.v.giro || 0);
  const cm = corrimiento(T);
  poner('#p-der', cm.der); poner('#p-adel', cm.adel); poner('#p-alt', T.v.pos[2]);
  poner('#p-rumbo', T.v.rumbo); poner('#p-cabeceo', T.v.cabeceo);
  const ll = aLngLat(T.v.pos[0], T.v.pos[1]);
  const est = T.v.estirar || 1;
  $('#proporcion-nota').textContent = Math.abs(est - 1) < 1e-4 ? 'Proporción original de la foto.'
    : `La imagen está ${est > 1 ? 'estirada' : 'aplastada'} ${fmt(Math.abs(est - 1) * 100, 1)} % en alto respecto de la foto.`;
  $('#valores').textContent =
    `apertura  ${fmt(T.v.apertura, 3)}°   (guardada ${fmt(T.guardada.apertura, 3)}°)\n` +
    `estirar   ${fmt(est, 4)}\n` +
    `centro    ${fmt(T.v.centro[0], 4)}, ${fmt(T.v.centro[1], 4)}\n` +
    `giro      ${fmt(T.v.giro || 0, 2)}°\n` +
    `pared a   ${fmt(T.D, 1)} m del proyector${T.v.isometrica ? ' (diorama, cámara lejana)' : ''}\n` +
    `proyector ${red(ll.lat, 7)}, ${red(ll.lng, 7)} · ${fmt(T.v.pos[2], 2)} m\n` +
    `rumbo     ${fmt(T.v.rumbo, 2)}° · cabeceo ${fmt(T.v.cabeceo, 2)}°\n` +
    `imagen    ${fmt(a.ancho, 2)} × ${fmt(a.alto, 2)} m`;
  const sucio = ITEMS.some(tocada) || JSON.stringify(ALTURAS) !== ALTURAS_GUARDADAS;
  $('#estado').textContent = sucio ? 'cambios sin guardar' : 'como está en calibracion.js';
  $('#estado').classList.toggle('sucio', sucio);
}
function aplicar() {
  distancia(T);
  if (ciudad) ciudad.reajustar(T.idx);
  pintar();
}

// campos numéricos: valor absoluto (la posición es relativa a lo guardado)
const prop = () => $('#proporcion').checked;
function campo(id, f) {
  $(id).addEventListener('change', () => {
    const x = parseFloat($(id).value);
    if (!isFinite(x)) return pintar();
    recordar(); f(x); aplicar();
  });
}
campo('#ancho', (x) => x > 0 && setAncho(T, x, prop()));
campo('#alto', (x) => x > 0 && setAlto(T, x, prop()));
campo('#mover-x', (x) => setX(T, x + medidas(T, T.guardada).x));
campo('#mover-y', (x) => setY(T, x + medidas(T, T.guardada).y));
campo('#giro', (x) => (T.v.giro = x));
campo('#p-der', (x) => moverProyector(T, x - corrimiento(T).der, 0, 0));
campo('#p-adel', (x) => moverProyector(T, 0, x - corrimiento(T).adel, 0));
campo('#p-alt', (x) => (T.v.pos[2] = x));
campo('#p-rumbo', (x) => (T.v.rumbo = x));
campo('#p-cabeceo', (x) => (T.v.cabeceo = lim(x, -89, 89)));

// deslizadores relativos: se mueven alrededor del valor que había al empezar a arrastrar y vuelven a 0 al soltar
function deslizador(id, f) {
  const el = $(id);
  let base = null;
  el.addEventListener('input', () => {
    if (!base) { recordar(); base = { ...medidas(T), giro: T.v.giro || 0, pos: [...T.v.pos], rumbo: T.v.rumbo, cabeceo: T.v.cabeceo }; }
    f(base, parseFloat(el.value));
    aplicar();
  });
  el.addEventListener('change', () => { base = null; el.value = 0; });
}
deslizador('#ancho-r', (b, r) => setAncho(T, b.ancho * (1 + r / 100), prop()));
deslizador('#alto-r', (b, r) => setAlto(T, b.alto * (1 + r / 100), prop()));
deslizador('#mover-x-r', (b, r) => setX(T, b.x + r));
deslizador('#mover-y-r', (b, r) => setY(T, b.y + r));
deslizador('#giro-r', (b, r) => (T.v.giro = b.giro + r));
deslizador('#p-der-r', (b, r) => { T.v.pos = [...b.pos]; moverProyector(T, r, 0, 0); });
deslizador('#p-adel-r', (b, r) => { T.v.pos = [...b.pos]; moverProyector(T, 0, r, 0); });
deslizador('#p-alt-r', (b, r) => (T.v.pos[2] = b.pos[2] + r));
deslizador('#p-rumbo-r', (b, r) => (T.v.rumbo = b.rumbo + r));
deslizador('#p-cabeceo-r', (b, r) => (T.v.cabeceo = lim(b.cabeceo + r, -89, 89)));

$('#deshacer').addEventListener('click', deshacer);
$('#restablecer').addEventListener('click', () => { recordar(); Object.assign(T.v, clonar(T.guardada)); aplicar(); });
// la vista tal como está escrita en recorrido.js, sin lo que haya en calibracion.js (queda sin guardar)
$('#de-recorrido').addEventListener('click', () => {
  recordar();
  Object.assign(T.v, C.normalizar(T.def, aLocal));
  aplicar();
  aviso('Vista de recorrido.js. Si calza, apretá Guardar para que pase a calibracion.js.', 3500);
});
$('#modo-pov').addEventListener('click', () => setModo('pov'));
$('#modo-libre').addEventListener('click', () => setModo('libre'));
$('#ver-aristas').addEventListener('change', (e) => { if (aristas) aristas.visible = e.target.checked; });
$('#ver-marco').addEventListener('change', (e) => $('#marco').classList.toggle('sin-borde', !e.target.checked));
$('#opacidad-plana').addEventListener('input', (e) => ($('#plana').style.opacity = e.target.value / 100));

// ── teclado ──
addEventListener('keydown', (e) => {
  if (!T || e.target.matches('input, select, textarea')) return;
  const k = e.key, paso = e.shiftKey ? 0.5 : 0.05, pct = e.shiftKey ? 0.05 : 0.01;
  if ((e.metaKey || e.ctrlKey) && k.toLowerCase() === 'z') { e.preventDefault(); deshacer(); return; }
  if (e.metaKey || e.ctrlKey) return;
  const a = medidas(T);
  let hecho = true;
  if (e.altKey && k === 'ArrowRight') { recordar(); setAncho(T, a.ancho * (1 + pct), prop()); }
  else if (e.altKey && k === 'ArrowLeft') { recordar(); setAncho(T, a.ancho / (1 + pct), prop()); }
  else if (e.altKey && k === 'ArrowUp') { recordar(); setAlto(T, a.alto * (1 + pct), prop()); }
  else if (e.altKey && k === 'ArrowDown') { recordar(); setAlto(T, a.alto / (1 + pct), prop()); }
  else if (k === 'ArrowRight') { recordar(); setX(T, a.x + paso); }
  else if (k === 'ArrowLeft') { recordar(); setX(T, a.x - paso); }
  else if (k === 'ArrowUp') { recordar(); setY(T, a.y + paso); }
  else if (k === 'ArrowDown') { recordar(); setY(T, a.y - paso); }
  else if (k === '+' || k === '=') { recordar(); setAncho(T, a.ancho * (1 + pct), true); }
  else if (k === '-' || k === '_') { recordar(); setAncho(T, a.ancho / (1 + pct), true); }
  else if (k.toLowerCase() === 'q') { recordar(); T.v.giro = (T.v.giro || 0) + (e.shiftKey ? 1 : 0.1); }
  else if (k.toLowerCase() === 'e') { recordar(); T.v.giro = (T.v.giro || 0) - (e.shiftKey ? 1 : 0.1); }
  else if (k.toLowerCase() === 'l') { recordar(); moverProyector(T, paso, 0, 0); }
  else if (k.toLowerCase() === 'j') { recordar(); moverProyector(T, -paso, 0, 0); }
  else if (k.toLowerCase() === 'i') { recordar(); moverProyector(T, 0, paso, 0); }
  else if (k.toLowerCase() === 'k') { recordar(); moverProyector(T, 0, -paso, 0); }
  else if (k.toLowerCase() === 'v') { setModo(modo === 'pov' ? 'libre' : 'pov'); return e.preventDefault(); }
  else if (k.toLowerCase() === 'a') { $('#ver-aristas').click(); return; }
  else if (k === '0') { pov.zoom = 1; pov.pan = [0, 0]; return; }
  else hecho = false;
  if (hecho) { e.preventDefault(); aplicar(); }
});

// ── mouse: zoom y desplazamiento desde la foto; ⇧ clic = elegir edificio (en los dos modos) ──
let arrastre = null;
lienzo.addEventListener('pointerdown', (e) => {
  arrastre = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, shift: e.shiftKey, boton: e.button };
  if (modo === 'pov') lienzo.setPointerCapture(e.pointerId);
});
lienzo.addEventListener('pointermove', (e) => {
  if (!arrastre || modo !== 'pov' || arrastre.shift) return;
  const r = lienzo.getBoundingClientRect();
  pov.pan[0] += ((e.clientX - arrastre.x) * 2) / r.width;
  pov.pan[1] -= ((e.clientY - arrastre.y) * 2) / r.height;
  arrastre.x = e.clientX; arrastre.y = e.clientY;
});
lienzo.addEventListener('pointerup', (e) => {
  const a = arrastre; arrastre = null;
  if (a && a.shift && a.boton === 0 && Math.hypot(e.clientX - a.x0, e.clientY - a.y0) < 5) elegirEdificio(e);
});
lienzo.addEventListener('wheel', (e) => {
  if (modo !== 'pov') return;
  e.preventDefault();
  const r = lienzo.getBoundingClientRect();
  const p = [((e.clientX - r.left) / r.width) * 2 - 1, 1 - ((e.clientY - r.top) / r.height) * 2];
  const z0 = pov.zoom, z1 = lim(z0 * Math.exp(-e.deltaY * 0.0015), 0.3, 40);
  // el punto bajo el mouse queda quieto
  pov.pan = pov.pan.map((q, i) => p[i] - ((p[i] - q) * z1) / z0);
  pov.zoom = z1;
}, { passive: false });
lienzo.addEventListener('dblclick', () => { if (modo === 'pov') { pov.zoom = 1; pov.pan = [0, 0]; } });

// ── alturas de los edificios ──
let edificio = null; // índice en DATOS
const ray = new THREE.Raycaster();
function elegirEdificio(e) {
  if (!ciudad || !DATOS) return;
  const r = lienzo.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, 1 - ((e.clientY - r.top) / r.height) * 2),
    modo === 'pov' ? camPov : camLibre);
  edificio = null;
  const hit = ray.intersectObject(ciudad.edificios, false)[0];
  if (!hit) return aviso('Ahí no hay ningún edificio.', 1200);
  const n = hit.face ? hit.face.normal : new THREE.Vector3();
  // el punto está en el borde: se prueba un poco hacia adentro de cada lado de la cara
  for (const s of [-0.3, 0.3, 0]) {
    const ll = aLngLat(hit.point.x + n.x * s, hit.point.y + n.y * s);
    const b = DATOS.findIndex((d) => dentro([ll.lng, ll.lat], d[2][0]));
    if (b >= 0) { edificio = { b, ll }; break; }
  }
  if (!edificio) return;
  const d = DATOS[edificio.b], c = ALTURAS.find((a) => dentro([a.lng, a.lat], d[2][0]));
  $('#edificio').hidden = false;
  $('#alto-edificio').value = red(c ? c.alt : d[0], 2);
  $('#alto-original').textContent = `en edificios.json: ${fmt(d[0], 1)} m${c ? ' · corregido' : ''}`;
  $('#alto-edificio').focus();
}
async function cambiarAltura(alt) {
  const d = DATOS[edificio.b];
  ALTURAS = ALTURAS.filter((a) => !dentro([a.lng, a.lat], d[2][0]));
  if (alt != null) ALTURAS.push({ lat: red(edificio.ll.lat, 7), lng: red(edificio.ll.lng, 7), alt: red(alt, 2) });
  $('#alto-original').textContent = `en edificios.json: ${fmt(d[0], 1)} m${alt != null ? ' · corregido' : ''}`;
  await armarCiudad();
  pintar();
}
$('#alto-edificio').addEventListener('change', (e) => {
  const x = parseFloat(e.target.value);
  if (edificio && isFinite(x) && x > 0) cambiarAltura(x);
});
$('#quitar-alto').addEventListener('click', () => {
  if (!edificio) return;
  $('#alto-edificio').value = red(DATOS[edificio.b][0], 2);
  cambiarAltura(null);
});

// ── guardar ──
function exportar(it) {
  const v = it.v, base = it.cal ? clonar(it.cal) : {};
  // si el proyector no se movió, se conserva su posición tal como estaba escrita
  let camara = movido(it) ? null : base.camara;
  if (!camara && !v.isometrica && !movido(it)) camara = it.def.camara;
  if (!camara) { const ll = aLngLat(v.pos[0], v.pos[1]); camara = { lat: red(ll.lat, 7), lng: red(ll.lng, 7), alt: red(v.pos[2], 2) }; }
  // la mira (centro de la imagen, para el vuelo de la cámara) a la misma distancia que antes
  const g = it.guardada, D0 = Math.hypot(g.mira[0] - g.pos[0], g.mira[1] - g.pos[1], g.mira[2] - g.pos[2]);
  const d = C.rayoCentro(v, it.aspecto), m = [0, 1, 2].map((i) => v.pos[i] + d[i] * D0), ml = aLngLat(m[0], m[1]);
  const out = { ...base, camara, mira: { lat: red(ml.lat, 7), lng: red(ml.lng, 7), alt: red(Math.max(0, m[2]), 2) },
    rumbo: red(v.rumbo, 3), cabeceo: red(v.cabeceo, 3), giro: red(v.giro || 0, 3),
    apertura: red(v.apertura, 4), centro: [red(v.centro[0], 5), red(v.centro[1], 5)] };
  if (Math.abs((v.estirar || 1) - 1) > 1e-4) out.estirar = red(v.estirar, 4); else delete out.estirar;
  return out;
}
function todo() {
  const vistas = { ...(ARCHIVO.vistas || {}) };
  for (const it of ITEMS) if (tocada(it)) vistas[it.def.imagen] = exportar(it);
  return { vistas, alturas: ALTURAS };
}
$('#guardar').addEventListener('click', async () => {
  const c = todo();
  try {
    const r = await fetch('guardar-calibracion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(c) });
    if (!r.ok) throw new Error(r.status);
    ARCHIVO.vistas = c.vistas; ARCHIVO.alturas = clonar(c.alturas);
    for (const it of ITEMS) if (tocada(it)) { it.cal = c.vistas[it.def.imagen]; it.guardada = clonar(it.v); }
    saliendo = true;
    aviso('Guardado en calibracion.js. La deriva ya usa estas medidas.', 2500);
    // para que "sin guardar" se compare con lo nuevo
    setTimeout(() => location.reload(), 900);
  } catch (e) {
    const js = `window.CALIBRACION = ${JSON.stringify(c, null, 2)};\n`;
    try { await navigator.clipboard.writeText(js); } catch (er) {}
    aviso('No se pudo escribir el archivo (hace falta abrir esta página con "npm run local"). ' +
      'Copié el contenido completo de calibracion.js al portapapeles.', 9000);
  }
});
$('#probar').addEventListener('click', () => {
  try { localStorage.setItem(CLAVE_PRUEBA, JSON.stringify(todo())); } catch (e) {}
  window.open(`./?prueba&lugar=${encodeURIComponent(T.lugar || '')}`, '_blank');
});
let saliendo = false;
addEventListener('beforeunload', (e) => {
  if (!saliendo && (ITEMS.some(tocada) || JSON.stringify(ALTURAS) !== ALTURAS_GUARDADAS)) { e.preventDefault(); e.returnValue = ''; }
});

let tAviso = null;
function aviso(txt, ms = 2000) {
  const el = $('#aviso');
  el.textContent = txt; el.hidden = false;
  clearTimeout(tAviso); tAviso = setTimeout(() => (el.hidden = true), ms);
}

// ── tamaño y dibujo ──
new ResizeObserver(() => {
  const r = $('#escena').getBoundingClientRect(), dpr = devicePixelRatio || 1;
  W = Math.max(1, Math.round(r.width * dpr)); H = Math.max(1, Math.round(r.height * dpr));
  renderer.setSize(W, H, false);
  camLibre.aspect = W / H; camLibre.updateProjectionMatrix();
}).observe($('#escena'));

function cuadro() {
  requestAnimationFrame(cuadro);
  if (!ciudad || !T) return;
  let cam;
  if (modo === 'pov') {
    camaraPov(); cam = camPov;
    // un poco detrás del proyector: justo en su posición se encendería el "fondo" plano de los dioramas
    const f = C.ejes(T.v).f;
    ciudad.setCamara(T.v.pos[0] - f[0], T.v.pos[1] - f[1], T.v.pos[2] - f[2]);
  } else {
    controles.update(); cam = camLibre;
    ciudad.setCamara(camLibre.position.x, camLibre.position.y, camLibre.position.z);
  }
  ciudad.setCaminante(T.v.mira[0], T.v.mira[1], 0);   // sombras finas y foco alrededor del lugar
  // dioramas: como en la deriva, se ocultan los volúmenes entre la cámara y el lugar (CORTE en ciudad.js)
  ciudad.setCorte(T.v.isometrica ? T.v.mira : null, T.v.isometrica ? 1 : 0);
  ciudad.setTiempo((performance.now() / 1000) % 3600);
  const k = $('#intensidad').value / 100;
  ciudad.setIntensidades(VISTAS.map((_, i) => (i === T.idx ? k : 0)));
  ciudad.prepasar(renderer, W, H);
  renderer.setRenderTarget(null);
  renderer.setViewport(0, 0, W, H);
  renderer.render(escena, cam);
}

// ── inicio ──
setModo('pov');
let inicial = 0;
try {
  const q = new URLSearchParams(location.search).get('imagen') || localStorage.getItem('encajar-vista');
  const i = ITEMS.findIndex((it) => it.def.imagen === q || it.def.imagen === 'registros/' + q);
  if (i >= 0) inicial = i;
} catch (e) {}
elegir(inicial);
DATOS = await (await fetch('edificios.json')).json();
await armarCiudad();
requestAnimationFrame(cuadro);

// ─────────────────────────────────────────────────────────────
// Herramienta de carga de puntos para la deriva de Little Havana.
//
// La artista carga dos cosas:
//  · LUGARES (edificios): nombre, posición y links de Google Drive a sus fotos. De cada foto, opcionalmente,
//    desde dónde la tomó (la "camara" de una proyección anamórfica; el lugar es la "mira").
//  · MARCAS (momentos de un audio): instante t, qué se oye, dónde estaba quien camina, el lugar asociado y,
//    si hubo pausa, hasta cuándo (es el formato de RECORRIDO.puntos en paisajes-sonoros/site/deriva-3d/recorrido.js).
//
// Datos (lo que guarda /api/datos y lo que baja scripts/traer.mjs):
//  { lugares: [{ id, nombre, direccion, nota, lat, lng, fotos: [{ id, url, tipo, nota, desde: {lat,lng}|null }] }],
//    marcas:  [{ id, audio, t, hasta|null, lat|null, lng|null, lugar: id|null, oye, aprox }] }
// Tiempos en segundos (con décimas). Coordenadas WGS84 con 7 decimales (≈ 1 cm).
//
// Guardado: cada cambio se copia en localStorage y, a los pocos segundos, se sube al servidor (PUT con número
// de versión). Si no hay conexión, sigue reintentando; si al volver otra pestaña guardó antes, se pregunta.
// ─────────────────────────────────────────────────────────────

const C = window.CARGA;

// ─────────────────────────── UTILIDADES ───────────────────────────
const $ = (s) => document.querySelector(s);

// Crea un elemento: el('button', { class: 'boton', onclick: fn }, 'texto', otroNodo)
function el(tag, props = {}, ...hijos) {
  const e = document.createElement(tag);
  const despues = {};
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'value' || k === 'checked') despues[k] = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const h of hijos.flat()) {
    if (h == null || h === false) continue;
    e.append(h instanceof Node ? h : document.createTextNode(String(h)));
  }
  Object.assign(e, despues);
  return e;
}

const nuevoId = (p) => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const redondear = (x) => Math.round(x * 1e7) / 1e7;
const redondearT = (t) => Math.max(0, Math.round(t * 10) / 10);

// 125.4 → "2:05.4"  (el mismo formato que acepta recorrido.js)
function fmt(t, decimas = true) {
  if (t == null || !isFinite(t)) return '—';
  t = decimas ? Math.round(t * 10) / 10 : Math.floor(t);
  const m = Math.floor(t / 60), s = t - m * 60;
  return decimas ? `${m}:${s.toFixed(1).padStart(4, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

function leerLS(k) { try { return localStorage.getItem(k); } catch { return null; } }
function escribirLS(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } }
const LS = { clave: 'carga.clave', datos: 'carga.datos', audio: 'carga.audio', ayuda: 'carga.ayuda-vista' };

function descargarJSON(obj, nombre) {
  const a = el('a', {
    href: URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })),
    download: `${nombre}-${new Date().toISOString().slice(0, 16).replace(':', '')}.json`,
  });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// Links de Google Drive: /file/d/ID/…, /open?id=ID, /uc?id=ID, docs.google.com/…/d/ID, /drive/folders/ID
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
function urlMiniatura(url) {
  const d = idDrive(url);
  if (d) return d.carpeta ? null : `https://drive.google.com/thumbnail?id=${d.id}&sz=w400`;
  return /\.(jpe?g|png|webp|gif|avif)(\?|#|$)/i.test(url) ? url : null;
}

// ─────────────────────────── ESTADO ───────────────────────────
let datos = { lugares: [], marcas: [] };
let version = 0;            // versión del servidor sobre la que se está trabajando
let clave = '';
let audioId = C.audios[0].id;
let picos = null;           // forma de onda del audio actual (site/picos/<id>.json)
let pestana = 'marcas';
let sel = null;             // { tipo: 'marca' | 'lugar', id, foto? }
let modo = null;            // clic en el mapa pendiente: { alClic(pos) }

const buscarLugar = (id) => datos.lugares.find((l) => l.id === id);
const buscarMarca = (id) => datos.marcas.find((m) => m.id === id);
const nombreAudio = (id) => (C.audios.find((a) => a.id === id) || { nombre: id }).nombre;
const marcasAudio = () => datos.marcas.filter((m) => m.audio === audioId).sort((a, b) => a.t - b.t);
const marcasDeLugar = (id) => datos.marcas.filter((m) => m.lugar === id).sort((a, b) => a.audio.localeCompare(b.audio) || a.t - b.t);
const numeroMarca = (m) => marcasAudio().indexOf(m) + 1;

function normalizar(d) {
  const lugares = Array.isArray(d && d.lugares) ? d.lugares : [];
  const marcas = Array.isArray(d && d.marcas) ? d.marcas : [];
  for (const l of lugares) if (!Array.isArray(l.fotos)) l.fotos = [];
  return { lugares, marcas };
}

function semilla() {
  return {
    lugares: (C.semilla || []).map((s) => ({ id: nuevoId('l'), nombre: s.nombre, direccion: s.direccion || '',
      nota: '', lat: s.lat, lng: s.lng, fotos: [] })),
    marcas: [],
  };
}

function nuevoLugar(pos) {
  const l = { id: nuevoId('l'), nombre: '', direccion: '', nota: '', lat: pos.lat, lng: pos.lng, fotos: [] };
  datos.lugares.push(l);
  return l;
}

function nuevaMarca(extra = {}) {
  const m = { id: nuevoId('m'), audio: audioId, t: redondearT(audio.currentTime), hasta: null,
    lat: null, lng: null, lugar: null, oye: '', aprox: false, ...extra };
  datos.marcas.push(m);
  return m;
}

// ─────────────────────────── GUARDADO ───────────────────────────
let pendiente = false, guardando = false, temporizador = null;

function estado(texto, clase = '') {
  const e = $('#estado');
  e.textContent = texto;
  e.className = 'estado ' + clase;
}
const hora = (iso) => new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });

async function api(metodo, cuerpo) {
  const r = await fetch('api/datos', {
    method: metodo,
    headers: { 'X-Clave': clave, ...(cuerpo ? { 'Content-Type': 'application/json' } : {}) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  let j = null;
  try { j = await r.json(); } catch { /* respuesta vacía */ }
  return { status: r.status, j };
}

function copiaLocal() {
  escribirLS(LS.datos, JSON.stringify({ version, datos, pendiente }));
}

function programarGuardado(ms = 3000) {
  clearTimeout(temporizador);
  temporizador = setTimeout(guardar, ms);
}

// Llamar después de cada cambio en "datos". lista: false cuando se está escribiendo en un campo del panel
// (volver a dibujar el panel le quitaría el foco).
function cambio({ lista = true } = {}) {
  pendiente = true;
  copiaLocal();
  estado('Cambios sin guardar…', 'pendiente');
  if (lista) renderPanel(); else contadores();
  renderMapa();
  dibujarOnda();
  programarGuardado();
}

async function guardar() {
  if (!pendiente) return;
  if (guardando) { programarGuardado(1000); return; }
  guardando = true;
  estado('Guardando…', 'pendiente');
  const enviado = JSON.stringify(datos);
  try {
    const r = await api('PUT', { version, datos });
    if (r.status === 200) {
      version = r.j.version;
      pendiente = JSON.stringify(datos) !== enviado;   // ¿se siguió editando mientras se guardaba?
      copiaLocal();
      if (pendiente) programarGuardado();
      else estado('Guardado ' + hora(r.j.guardado), 'ok');
    } else if (r.status === 409) {
      conflicto(r.j);
    } else if (r.status === 401) {
      clave = await pedirClave(true);
      programarGuardado(0);
    } else {
      estado('No se pudo guardar (' + ((r.j && r.j.error) || r.status) + '). Reintentando…', 'error');
      programarGuardado(20000);
    }
  } catch {
    estado('Sin conexión: los cambios quedan en este navegador. Reintentando…', 'error');
    programarGuardado(15000);
  } finally {
    guardando = false;
  }
}

function conflicto(j) {
  const pisar = confirm(
    'Mientras tanto se guardaron cambios desde otra pestaña o computadora.\n\n' +
    'Aceptar: guardar lo de esta pantalla (lo otro se descarga en un archivo, por las dudas).\n' +
    'Cancelar: descartar lo de esta pantalla y cargar lo otro (lo de esta pantalla se descarga en un archivo).');
  if (pisar) {
    if (j.datos) descargarJSON(j.datos, 'carga-de-internet');
    version = j.version;
    programarGuardado(0);
  } else {
    descargarJSON(datos, 'carga-descartada');
    datos = normalizar(j.datos);
    version = j.version;
    pendiente = false;
    sel = null;
    copiaLocal();
    renderTodo();
    estado('Se cargó la versión guardada en internet', 'ok');
  }
}

function pedirClave(incorrecta) {
  const d = $('#pedir-clave');
  $('#clave-error').hidden = !incorrecta;
  $('#clave').value = '';
  d.showModal();
  return new Promise((resolver) => {
    $('#form-clave').onsubmit = (e) => {
      e.preventDefault();
      d.close();
      resolver($('#clave').value.trim());
    };
  });
}

async function iniciarDatos() {
  const q = new URLSearchParams(location.search);
  if (q.get('clave')) {        // link con ?clave=… : se guarda y se saca de la barra de direcciones
    escribirLS(LS.clave, q.get('clave'));
    q.delete('clave');
    history.replaceState(null, '', location.pathname + (q.size ? '?' + q : '') + location.hash);
  }
  clave = leerLS(LS.clave) || '';
  let local = null;
  try { local = JSON.parse(leerLS(LS.datos)); } catch { /* nada guardado */ }

  for (;;) {
    if (!clave) clave = await pedirClave(false);
    let r;
    try {
      r = await api('GET');
    } catch {
      if (local && local.datos) {
        datos = normalizar(local.datos);
        version = local.version || 0;
        pendiente = !!local.pendiente;
        estado('Sin conexión: se trabaja en este navegador y se sube cuando vuelva', 'error');
        if (pendiente) programarGuardado(15000);
      } else {
        estado('No se pudo conectar. Revisá internet y recargá la página.', 'error');
      }
      return;
    }
    if (r.status === 401) { escribirLS(LS.clave, null); clave = await pedirClave(true); continue; }
    if (r.status !== 200) { estado((r.j && r.j.error) || 'Error del servidor (' + r.status + ')', 'error'); return; }
    escribirLS(LS.clave, clave);

    const remoto = r.j;
    if (local && local.pendiente && local.datos) {
      const recuperar = local.version === remoto.version || confirm(
        'Quedaron cambios de este navegador sin subir, y en internet hay una versión más nueva.\n\n' +
        'Aceptar: recuperar los cambios de este navegador (la versión de internet se descarga en un archivo).\n' +
        'Cancelar: usar la versión de internet (los cambios de este navegador se descargan en un archivo).');
      if (recuperar) {
        if (local.version !== remoto.version && remoto.datos) descargarJSON(remoto.datos, 'carga-de-internet');
        datos = normalizar(local.datos);
        version = remoto.version;
        pendiente = true;
        estado('Recuperando cambios sin subir…', 'pendiente');
        programarGuardado(0);
        return;
      }
      descargarJSON(local.datos, 'carga-sin-subir');
    }
    if (remoto.datos) {
      datos = normalizar(remoto.datos);
      version = remoto.version;
      pendiente = false;
      copiaLocal();
      estado(remoto.guardado ? 'Guardado ' + hora(remoto.guardado) : 'Listo', 'ok');
    } else {
      datos = semilla();            // primera vez: arranca con los lugares que ya usa el recorrido
      version = remoto.version;
      pendiente = true;
      copiaLocal();
      programarGuardado(0);
    }
    return;
  }
}

addEventListener('beforeunload', (e) => {
  if (pendiente) { e.preventDefault(); e.returnValue = ''; }
});

// ─────────────────────────── AUDIO ───────────────────────────
const audio = new Audio();
audio.preload = 'auto';

const duracion = () => (isFinite(audio.duration) && audio.duration > 0 ? audio.duration : (picos && picos.duracion) || 0);

function ir(t, reproducir = false) {
  const destino = Math.max(0, Math.min(t, duracion() || t));
  if (audio.readyState >= 1) audio.currentTime = destino;
  else audio.addEventListener('loadedmetadata', () => { audio.currentTime = destino; }, { once: true });
  if (reproducir) audio.play().catch(() => {});
  actualizarTiempo();
}

async function elegirAudio(id) {
  audioId = id;
  escribirLS(LS.audio, id);
  $('#audio-elegir').value = id;
  audio.src = new URL('audio/' + id + '.m4a', C.sitio).href;
  audio.defaultPlaybackRate = audio.playbackRate = Number($('#velocidad').value);
  picos = null;
  if (sel && sel.tipo === 'marca') sel = null;
  renderTodo();
  try {
    const r = await fetch('picos/' + id + '.json');
    if (r.ok && audioId === id) picos = await r.json();
  } catch { /* sin forma de onda: se dibuja una línea */ }
  $('#tiempo-total').textContent = fmt(duracion(), false);
  dibujarOnda();
}

function alternar() {
  if (audio.paused) audio.play().catch(() => estado('No se pudo reproducir el audio', 'error'));
  else audio.pause();
}

function actualizarTiempo() {
  $('#tiempo-actual').textContent = fmt(audio.currentTime);
  for (const b of document.querySelectorAll('[data-ahora]')) b.textContent = b.dataset.ahora.replace('#', fmt(audio.currentTime, false));
  dibujarOnda();
  moverCaminante();
}

function tic() {
  actualizarTiempo();
  if (!audio.paused) requestAnimationFrame(tic);
}
audio.addEventListener('play', () => { $('#reproducir').textContent = '❚❚'; $('#reproducir').setAttribute('aria-label', 'Pausa'); requestAnimationFrame(tic); });
audio.addEventListener('pause', () => { $('#reproducir').textContent = '▶'; $('#reproducir').setAttribute('aria-label', 'Reproducir'); actualizarTiempo(); });
audio.addEventListener('seeked', actualizarTiempo);
audio.addEventListener('loadedmetadata', () => { $('#tiempo-total').textContent = fmt(duracion(), false); dibujarOnda(); });
audio.addEventListener('error', () => { if (audio.src) estado('No se pudo cargar el audio ' + nombreAudio(audioId), 'error'); });

function marcarAhora() {
  const m = nuevaMarca();
  cambio();
  seleccionar('marca', m.id, { volar: false });
  elegirEnMapa(`¿Dónde estabas a los ${fmt(m.t)}? Hacé clic en el mapa`, (p) => {
    const M = buscarMarca(m.id);
    if (M) { M.lat = p.lat; M.lng = p.lng; cambio(); }
  });
}

// ─────────────────────────── FORMA DE ONDA ───────────────────────────
const lienzo = $('#onda');
const ctx = lienzo.getContext('2d');
const FRANJA = 16;          // alto de la franja de arriba, con los números de los momentos
let cursorX = null;

function ventana() {
  const d = duracion() || 1, z = Number($('#zoom').value);
  if (!z || z >= d) return [0, d];
  const ini = Math.max(0, Math.min(d - z, audio.currentTime - z / 2));
  return [ini, ini + z];
}

function dibujarOnda() {
  const dpr = devicePixelRatio || 1, w = lienzo.clientWidth, h = lienzo.clientHeight;
  if (!w || !h) return;
  if (lienzo.width !== Math.round(w * dpr) || lienzo.height !== Math.round(h * dpr)) {
    lienzo.width = Math.round(w * dpr); lienzo.height = Math.round(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const [a, b] = ventana();
  const x = (t) => ((t - a) / (b - a)) * w;
  const ahora = audio.currentTime;
  const alto = h - FRANJA, medio = FRANJA + alto / 2;
  const marcas = marcasAudio();

  // pausas
  ctx.fillStyle = 'rgba(176, 96, 90, 0.16)';
  for (const m of marcas) if (m.hasta != null && m.hasta > m.t) ctx.fillRect(x(m.t), FRANJA, x(m.hasta) - x(m.t), alto);

  // onda
  if (picos && picos.picos.length) {
    const P = picos.picos, ps = picos.porSegundo;
    for (let i = 0; i < w; i++) {
      const t0 = a + (i / w) * (b - a), t1 = a + ((i + 1) / w) * (b - a);
      let p = 0;
      for (let k = Math.floor(t0 * ps), fin = Math.max(k + 1, Math.ceil(t1 * ps)); k < fin && k < P.length; k++) if (P[k] > p) p = P[k];
      const hh = Math.max(1, (p / 100) * (alto / 2 - 2));
      ctx.fillStyle = t0 < ahora ? '#2b2a29' : '#a9a7a3';
      ctx.fillRect(i, medio - hh, 1, hh * 2);
    }
  } else {
    ctx.fillStyle = '#a9a7a3';
    ctx.fillRect(0, medio, w, 1);
  }

  // escala de tiempo
  const pasos = [1, 2, 5, 10, 15, 30, 60, 120, 300];
  const paso = pasos.find((p) => (b - a) / p <= w / 70) || 600;
  ctx.font = '10px "Barlow Semi Condensed", sans-serif';
  ctx.fillStyle = '#6a6b6d';
  for (let t = Math.ceil(a / paso) * paso; t < b; t += paso) {
    ctx.fillRect(x(t), h - 4, 1, 4);
    ctx.fillText(fmt(t, false), x(t) + 3, h - 2);
  }

  // momentos
  ctx.font = '600 11px "Barlow Semi Condensed", sans-serif';
  ctx.textAlign = 'center';
  marcas.forEach((m, i) => {
    const xm = x(m.t);
    if (xm < -20 || xm > w + 20) return;
    const elegida = sel && sel.tipo === 'marca' && sel.id === m.id;
    ctx.fillStyle = elegida ? '#111111' : '#b0605a';
    ctx.fillRect(xm - (elegida ? 1 : 0.5), FRANJA - 2, elegida ? 2 : 1, alto + 2);
    const etiqueta = String(i + 1), an = ctx.measureText(etiqueta).width + 8;
    ctx.beginPath();
    ctx.roundRect(xm - an / 2, 0, an, FRANJA - 2, 3);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(etiqueta, xm, FRANJA - 5);
  });
  ctx.textAlign = 'start';

  // cabezal
  ctx.fillStyle = '#111111';
  ctx.fillRect(x(ahora) - 1, FRANJA - 2, 2, alto + 2);

  // tiempo bajo el puntero
  if (cursorX != null) {
    const t = a + (cursorX / w) * (b - a), texto = fmt(t);
    ctx.font = '600 11px "Barlow Semi Condensed", sans-serif';
    const an = ctx.measureText(texto).width + 8, xx = Math.min(w - an, Math.max(0, cursorX + 6));
    ctx.fillStyle = 'rgba(17, 17, 17, 0.85)';
    ctx.fillRect(xx, FRANJA + 2, an, 15);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(texto, xx + 4, FRANJA + 13);
  }
}

function tiempoEnX(px) {
  const [a, b] = ventana();
  return a + (Math.max(0, Math.min(px, lienzo.clientWidth)) / lienzo.clientWidth) * (b - a);
}
let arrastrando = false;
lienzo.addEventListener('pointerdown', (e) => {
  const r = lienzo.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
  if (py < FRANJA) {          // clic sobre el número de un momento → abrirlo
    const [a, b] = ventana();
    const cerca = marcasAudio().map((m) => ({ m, d: Math.abs(((m.t - a) / (b - a)) * r.width - px) })).sort((p, q) => p.d - q.d)[0];
    if (cerca && cerca.d < 10) { seleccionar('marca', cerca.m.id); return; }
  }
  arrastrando = true;
  lienzo.setPointerCapture(e.pointerId);
  ir(tiempoEnX(px));
});
lienzo.addEventListener('pointermove', (e) => {
  const px = e.clientX - lienzo.getBoundingClientRect().left;
  cursorX = px;
  if (arrastrando) ir(tiempoEnX(px)); else dibujarOnda();
});
lienzo.addEventListener('pointerup', () => { arrastrando = false; });
lienzo.addEventListener('pointerleave', () => { cursorX = null; dibujarOnda(); });
addEventListener('resize', dibujarOnda);

// ─────────────────────────── MAPA ───────────────────────────
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/';
const vacio = { type: 'FeatureCollection', features: [] };
const mapa = new maplibregl.Map({
  container: 'mapa',
  style: {
    version: 8,
    sources: {
      sat: { type: 'raster', tileSize: 256, maxzoom: 19, tiles: [ESRI + 'World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        attribution: 'Imágenes © Esri, Maxar, Earthstar Geographics' },
      ref: { type: 'raster', tileSize: 256, maxzoom: 19, tiles: [ESRI + 'Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}'] },
      calles: { type: 'raster', tileSize: 256, maxzoom: 19, tiles: [ESRI + 'World_Street_Map/MapServer/tile/{z}/{y}/{x}'],
        attribution: 'Calles © Esri, HERE, OpenStreetMap' },
      camino: { type: 'geojson', data: vacio },
      visuales: { type: 'geojson', data: vacio },
    },
    layers: [
      { id: 'fondo', type: 'background', paint: { 'background-color': '#d8d6d2' } },
      { id: 'sat', type: 'raster', source: 'sat', paint: { 'raster-saturation': -0.35 } },
      { id: 'ref', type: 'raster', source: 'ref', paint: { 'raster-opacity': 0.7 } },
      { id: 'calles', type: 'raster', source: 'calles', layout: { visibility: 'none' }, paint: { 'raster-saturation': -0.6 } },
      { id: 'visuales-borde', type: 'line', source: 'visuales',
        paint: { 'line-color': '#f4f3f1', 'line-width': 5, 'line-opacity': 0.6 } },
      { id: 'visuales', type: 'line', source: 'visuales',
        paint: { 'line-color': '#4f6b4a', 'line-width': 3, 'line-dasharray': [1.5, 1] } },
      { id: 'camino-borde', type: 'line', source: 'camino', layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#f4f3f1', 'line-width': 6, 'line-opacity': 0.7 } },
      { id: 'camino', type: 'line', source: 'camino', layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#b0605a', 'line-width': 3 } },
    ],
  },
  center: [C.centro.lng, C.centro.lat], zoom: C.zoom, maxZoom: 21,
  dragRotate: false, pitchWithRotate: false, attributionControl: { compact: true },
});
mapa.touchZoomRotate.disableRotation();
mapa.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
mapa.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-right');

for (const b of document.querySelectorAll('.capa')) {
  b.addEventListener('click', () => {
    const sat = b.dataset.capa === 'sat';
    mapa.setLayoutProperty('sat', 'visibility', sat ? 'visible' : 'none');
    mapa.setLayoutProperty('ref', 'visibility', sat ? 'visible' : 'none');
    mapa.setLayoutProperty('calles', 'visibility', sat ? 'none' : 'visible');
    for (const o of document.querySelectorAll('.capa')) o.classList.toggle('activa', o === b);
  });
}

function elegirEnMapa(texto, alClic) {
  modo = { alClic };
  $('#aviso-texto').textContent = texto;
  $('#aviso-mapa').hidden = false;
  $('#mapa').classList.add('eligiendo');
}
function cancelarModo() {
  modo = null;
  $('#aviso-mapa').hidden = true;
  $('#mapa').classList.remove('eligiendo');
}
$('#aviso-cancelar').addEventListener('click', cancelarModo);
mapa.on('click', (e) => {
  if (!modo) return;
  const f = modo.alClic;
  cancelarModo();
  f({ lat: redondear(e.lngLat.lat), lng: redondear(e.lngLat.lng) });
});

// Posición de quien camina en el instante t, interpolando entre los momentos ubicados
// (en línea recta y a velocidad constante, como en recorrido.js; quieto durante las pausas).
function nodosCamino() {
  const n = [];
  for (const m of marcasAudio()) {
    if (m.lat == null) continue;
    n.push({ t: m.t, p: [m.lng, m.lat] });
    if (m.hasta != null && m.hasta > m.t) n.push({ t: m.hasta, p: [m.lng, m.lat] });
  }
  return n.sort((a, b) => a.t - b.t);
}
function posicionEn(t) {
  const n = nodosCamino();
  if (!n.length) return null;
  if (t <= n[0].t) return n[0].p;
  for (let i = 0; i < n.length - 1; i++) {
    if (t < n[i + 1].t) {
      const f = (t - n[i].t) / (n[i + 1].t - n[i].t || 1);
      return [n[i].p[0] + (n[i + 1].p[0] - n[i].p[0]) * f, n[i].p[1] + (n[i + 1].p[1] - n[i].p[1]) * f];
    }
  }
  return n[n.length - 1].p;
}

const caminante = new maplibregl.Marker({ element: el('div', { class: 'm-caminante', title: 'caminante' }) });
function moverCaminante() {
  const p = posicionEn(audio.currentTime);
  if (p) caminante.setLngLat(p).addTo(mapa); else caminante.remove();
}

const marcadores = new Map();   // clave → maplibregl.Marker

// Crea o actualiza un marcador arrastrable. alSoltar(pos) recibe la posición nueva.
function marcador(clave, lngLat, crearElemento, alClic, alSoltar) {
  let mk = marcadores.get(clave);
  if (!mk) {
    const e = crearElemento();
    e.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (!modo) { alClic(); return; }
      // eligiendo una posición: un clic sobre un marcador usa la posición de ese marcador
      const p = mk.getLngLat(), f = modo.alClic;
      cancelarModo();
      f({ lat: redondear(p.lat), lng: redondear(p.lng) });
    });
    mk = new maplibregl.Marker({ element: e, draggable: true }).setLngLat(lngLat).addTo(mapa);
    mk.on('dragend', () => { const p = mk.getLngLat(); alSoltar({ lat: redondear(p.lat), lng: redondear(p.lng) }); });
    marcadores.set(clave, mk);
  } else {
    mk.setLngLat(lngLat);
  }
  return mk.getElement();
}

function renderMapa() {
  const vivos = new Set();
  const lineas = [];

  for (const l of datos.lugares) {
    const k = 'l:' + l.id;
    vivos.add(k);
    const e = marcador(k, [l.lng, l.lat],
      () => el('div', { class: 'm-lugar' }, el('div', { class: 'cuadro' }), el('div', { class: 'nombre' })),
      () => seleccionar('lugar', l.id, { volar: false }),
      (p) => { const L = buscarLugar(l.id); if (L) { L.lat = p.lat; L.lng = p.lng; cambio(); } });
    e.querySelector('.nombre').textContent = l.nombre || 'sin nombre';
    e.title = l.nombre || 'Edificio sin nombre';
    e.classList.toggle('seleccionado', !!sel && sel.tipo === 'lugar' && sel.id === l.id);

    for (const f of l.fotos) {
      if (!f.desde) continue;
      const kf = 'f:' + f.id;
      vivos.add(kf);
      const ef = marcador(kf, [f.desde.lng, f.desde.lat], () => el('div', { class: 'm-foto' }),
        () => seleccionar('lugar', l.id, { volar: false, foto: f.id }),
        (p) => { const F = (buscarLugar(l.id) || { fotos: [] }).fotos.find((x) => x.id === f.id); if (F) { F.desde = p; cambio(); } });
      ef.title = `Foto de ${l.nombre || 'edificio sin nombre'} (desde acá)`;
      ef.classList.toggle('seleccionado', !!sel && sel.foto === f.id);
      lineas.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[f.desde.lng, f.desde.lat], [l.lng, l.lat]] } });
    }
  }

  marcasAudio().forEach((m, i) => {
    if (m.lat == null) return;
    const k = 'm:' + m.id;
    vivos.add(k);
    const e = marcador(k, [m.lng, m.lat], () => el('div', { class: 'm-marca' }),
      () => seleccionar('marca', m.id, { volar: false }),
      (p) => { const M = buscarMarca(m.id); if (M) { M.lat = p.lat; M.lng = p.lng; cambio(); } });
    e.textContent = i + 1;
    e.title = `${fmt(m.t)} ${m.oye || ''}`.trim();
    e.classList.toggle('aprox', !!m.aprox);
    e.classList.toggle('seleccionado', !!sel && sel.tipo === 'marca' && sel.id === m.id);
  });

  for (const [k, mk] of marcadores) if (!vivos.has(k)) { mk.remove(); marcadores.delete(k); }

  const n = nodosCamino();
  const camino = n.length > 1 ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: n.map((x) => x.p) } }] : [];
  const fuente = (id, features) => { const s = mapa.getSource(id); if (s) s.setData({ type: 'FeatureCollection', features }); };
  fuente('camino', camino);
  fuente('visuales', lineas);
  moverCaminante();
}
mapa.on('load', renderMapa);

// ─────────────────────────── PANEL ───────────────────────────
function cambiarPestana(p) {
  pestana = p;
  for (const b of document.querySelectorAll('.pestana')) {
    const activa = b.dataset.pestana === p;
    b.classList.toggle('activa', activa);
    b.setAttribute('aria-selected', String(activa));
  }
  $('#panel-marcas').hidden = p !== 'marcas';
  $('#panel-lugares').hidden = p !== 'lugares';
}
for (const b of document.querySelectorAll('.pestana')) b.addEventListener('click', () => cambiarPestana(b.dataset.pestana));

function posicionDe(tipo, id) {
  if (tipo === 'marca') { const m = buscarMarca(id); return m && m.lat != null ? m : null; }
  if (tipo === 'lugar') return buscarLugar(id) || null;
  return null;
}

function seleccionar(tipo, id, { volar = true, foto = null } = {}) {
  sel = tipo ? { tipo, id, foto } : null;
  if (tipo === 'marca') cambiarPestana('marcas');
  if (tipo === 'lugar') cambiarPestana('lugares');
  renderPanel();
  renderMapa();
  dibujarOnda();
  if (volar && tipo) {
    const p = posicionDe(tipo, id);
    if (p && !mapa.getBounds().contains([p.lng, p.lat])) mapa.easeTo({ center: [p.lng, p.lat], duration: 600 });
  }
  const t = document.querySelector('.panel-contenido:not([hidden]) .tarjeta.abierta');
  if (t) t.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function contadores() {
  $('#cuenta-marcas').textContent = marcasAudio().length;
  $('#cuenta-lugares').textContent = datos.lugares.length;
}

function renderPanel() {
  renderMarcas();
  renderLugares();
  contadores();
}

function renderTodo() {
  renderPanel();
  renderMapa();
  actualizarTiempo();
}

const boton = (texto, onclick, clase = 'boton chico', extra = {}) => el('button', { type: 'button', class: clase, onclick, ...extra }, texto);

function ajustes(valor, aplicar) {
  return [[-1, '−1 s'], [-0.2, '−0,2'], [0.2, '+0,2'], [1, '+1 s']].map(([d, txt]) =>
    boton(txt, () => aplicar(redondearT(valor() + d)), 'boton chico secundario'));
}

// ── momentos del audio ──
function renderMarcas() {
  const caja = $('#panel-marcas');
  const lista = marcasAudio();
  const ubicadas = lista.filter((m) => m.lat != null).length;
  caja.replaceChildren(
    el('p', { class: 'vacio' }, lista.length
      ? [el('b', {}, nombreAudio(audioId)), ` · ${lista.length} momento${lista.length === 1 ? '' : 's'}, ${ubicadas} ubicado${ubicadas === 1 ? '' : 's'} en el mapa`]
      : ['Todavía no hay momentos en ', el('b', {}, nombreAudio(audioId)), '. Dale ▶ abajo y, cuando oigas algo que reconocés, tocá ',
        el('b', {}, '＋ Marcar este momento'), ' o la tecla M.']),
    ...lista.map((m, i) => tarjetaMarca(m, i)));
}

function tarjetaMarca(m, i) {
  const abierta = !!sel && sel.tipo === 'marca' && sel.id === m.id;
  const lugar = buscarLugar(m.lugar);
  const cabeza = el('div', { class: 'tarjeta-cabeza', onclick: () => seleccionar(abierta ? null : 'marca', m.id) },
    el('span', { class: 'etiqueta' }, i + 1),
    el('button', { type: 'button', class: 'tiempo-chip', title: 'Escuchar desde 2 s antes',
      onclick: (e) => { e.stopPropagation(); ir(m.t - 2, true); } }, fmt(m.t)),
    el('span', { class: 'resumen' }, m.oye || el('small', {}, '(sin descripción)'), lugar ? el('small', {}, ' · ' + (lugar.nombre || 'edificio sin nombre')) : null),
    m.hasta != null ? el('span', { class: 'etiqueta' }, 'pausa') : null,
    m.lat == null ? el('span', { class: 'etiqueta aviso' }, 'sin ubicar') : null);
  if (!abierta) return el('div', { class: 'tarjeta' }, cabeza);

  const ubicar = () => elegirEnMapa(`Hacé clic donde estabas a los ${fmt(m.t)}`, (p) => { m.lat = p.lat; m.lng = p.lng; cambio(); });

  const elegirLugar = el('select', {
    onchange: (e) => {
      const v = e.target.value;
      if (v === '__nuevo') {
        e.target.value = m.lugar || '';
        elegirEnMapa('Hacé clic sobre el edificio nuevo', (p) => {
          const L = nuevoLugar(p);
          m.lugar = L.id;
          cambio();
          seleccionar('lugar', L.id, { volar: false });
          const nombre = document.querySelector('.tarjeta.abierta input');
          if (nombre) nombre.focus();
        });
      } else { m.lugar = v || null; cambio(); }
    },
  },
  el('option', { value: '' }, '— ninguno —'),
  ...[...datos.lugares].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'))
    .map((l) => el('option', { value: l.id }, l.nombre || 'edificio sin nombre')),
  el('option', { value: '__nuevo' }, '＋ nuevo edificio…'));
  elegirLugar.value = m.lugar || '';

  return el('div', { class: 'tarjeta abierta' }, cabeza,
    el('label', { class: 'campo' }, el('span', {}, '¿Qué se oye?'),
      el('input', { type: 'text', value: m.oye, placeholder: 'p. ej. música desde la puerta del Ball & Chain',
        oninput: (e) => { m.oye = e.target.value; cambio({ lista: false }); } })),
    el('label', { class: 'campo' }, el('span', {}, 'Edificio o lugar (si se oye o se ve uno que fotografiaste)'), elegirLugar),

    el('div', { class: 'fila' }, el('span', { class: 'rotulo' }, 'Dónde estabas:'),
      m.lat != null
        ? el('span', { class: 'estado-pos' }, '📍 en el mapa (se puede arrastrar)')
        : el('span', { class: 'estado-pos falta' }, 'sin ubicar')),
    el('div', { class: 'fila' },
      boton(m.lat != null ? 'Reubicar en el mapa' : 'Ubicar en el mapa', ubicar, 'boton chico principal'),
      lugar ? boton('Usar la posición del edificio', () => { m.lat = lugar.lat; m.lng = lugar.lng; cambio(); }) : null,
      m.lat != null ? boton('Quitar', () => { m.lat = m.lng = null; cambio(); }, 'boton chico peligro') : null),

    el('div', { class: 'fila' }, el('span', { class: 'rotulo' }, 'Corregir el momento:'),
      ...ajustes(() => m.t, (t) => { m.t = t; if (m.hasta != null && m.hasta <= t) m.hasta = redondearT(t + 1); cambio(); }),
      boton('= ahora', () => { m.t = redondearT(audio.currentTime); if (m.hasta != null && m.hasta <= m.t) m.hasta = redondearT(m.t + 1); cambio(); })),

    el('label', { class: 'casilla' },
      el('input', { type: 'checkbox', checked: m.hasta != null,
        onchange: (e) => {
          m.hasta = e.target.checked ? redondearT(audio.currentTime > m.t + 1 ? audio.currentTime : m.t + 10) : null;
          cambio();
        } }),
      'Hubo una pausa sin caminar, hasta…'),
    m.hasta != null ? el('div', { class: 'fila' },
      el('button', { type: 'button', class: 'tiempo-chip', title: 'Escuchar desde 2 s antes', onclick: () => ir(m.hasta - 2, true) }, fmt(m.hasta)),
      ...ajustes(() => m.hasta, (t) => { m.hasta = Math.max(t, redondearT(m.t + 0.2)); cambio(); }),
      boton('= ahora', () => { m.hasta = Math.max(redondearT(audio.currentTime), redondearT(m.t + 0.2)); cambio(); })) : null,

    el('label', { class: 'casilla' },
      el('input', { type: 'checkbox', checked: !!m.aprox, onchange: (e) => { m.aprox = e.target.checked; cambio(); } }),
      'Aproximado (no hay certeza del momento o del lugar)'),

    el('div', { class: 'pie-tarjeta' },
      boton('Borrar momento', () => {
        if (!confirm(`¿Borrar el momento ${fmt(m.t)}${m.oye ? ' («' + m.oye + '»)' : ''}?`)) return;
        datos.marcas = datos.marcas.filter((x) => x.id !== m.id);
        sel = null;
        cambio();
      }, 'boton chico peligro')));
}

// ── edificios y fotos ──
function renderLugares() {
  const caja = $('#panel-lugares');
  const lugares = [...datos.lugares].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));
  const faltan = lugares.filter((l) => l.fotos.length && !marcasDeLugar(l.id).length).length;
  caja.replaceChildren(
    el('div', { class: 'acciones-lista' },
      boton('＋ Nuevo edificio', () => elegirEnMapa('Hacé clic en el mapa sobre el edificio', (p) => {
        const L = nuevoLugar(p);
        cambio();
        seleccionar('lugar', L.id, { volar: false });
        const nombre = document.querySelector('#panel-lugares .tarjeta.abierta input');
        if (nombre) nombre.focus();
      }), 'boton principal'),
      faltan ? el('span', { class: 'error' }, `${faltan} con fotos y sin momento en el audio`) : null),
    lugares.length ? null : el('p', { class: 'vacio' }, 'Todavía no hay edificios. Tocá ', el('b', {}, '＋ Nuevo edificio'), ' y hacé clic en el mapa.'),
    ...lugares.map(tarjetaLugar));
}

function tarjetaLugar(l) {
  const abierta = !!sel && sel.tipo === 'lugar' && sel.id === l.id;
  const momentos = marcasDeLugar(l.id);
  const cabeza = el('div', { class: 'tarjeta-cabeza', onclick: () => seleccionar(abierta ? null : 'lugar', l.id) },
    el('span', { class: 'resumen' }, l.nombre || el('small', {}, '(sin nombre)'), l.direccion ? el('small', {}, ' · ' + l.direccion) : null),
    el('span', { class: 'etiqueta' }, l.fotos.length + (l.fotos.length === 1 ? ' foto' : ' fotos')),
    momentos.length
      ? el('span', { class: 'etiqueta ok' }, momentos.length + (momentos.length === 1 ? ' momento' : ' momentos'))
      : l.fotos.length ? el('span', { class: 'etiqueta aviso' }, 'sin momento') : null);
  if (!abierta) return el('div', { class: 'tarjeta' }, cabeza);

  const campo = (rotulo, clave, tipo = 'input', extra = {}) => el('label', { class: 'campo' }, el('span', {}, rotulo),
    el(tipo, { type: tipo === 'input' ? 'text' : null, value: l[clave] || '', ...extra,
      oninput: (e) => { l[clave] = e.target.value; cambio({ lista: false }); } }));

  const entrada = el('textarea', { rows: 2, placeholder: 'Pegá acá el link de Google Drive de una foto (o varios, uno por renglón)' });
  const errorLink = el('p', { class: 'error', hidden: true });
  const agregar = () => {
    const links = entrada.value.split(/\s+/).map((s) => s.trim()).filter(Boolean);
    const malos = links.filter((s) => !/^https?:\/\//i.test(s));
    if (!links.length) return;
    if (malos.length) { errorLink.textContent = 'Esto no parece un link: ' + malos[0]; errorLink.hidden = false; return; }
    for (const url of links) l.fotos.push({ id: nuevoId('f'), url, tipo: C.tiposFoto[0], nota: '', desde: null });
    cambio();
  };
  entrada.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); agregar(); } });

  return el('div', { class: 'tarjeta abierta' }, cabeza,
    campo('Nombre', 'nombre', 'input', { placeholder: 'p. ej. Tower Theater' }),
    campo('Dirección', 'direccion', 'input', { placeholder: 'p. ej. 1508 SW 8 St' }),
    campo('Notas', 'nota', 'textarea', { rows: 2 }),
    el('div', { class: 'fila' }, el('span', { class: 'rotulo' }, 'Posición:'),
      el('span', { class: 'estado-pos' }, 'arrastrá el cuadrado en el mapa para corregirla'),
      boton('Reubicar', () => elegirEnMapa(`Hacé clic sobre ${l.nombre || 'el edificio'}`, (p) => { l.lat = p.lat; l.lng = p.lng; cambio(); }))),

    el('h3', { class: 'subtitulo' }, 'Fotos y registros'),
    el('div', { class: 'fotos' }, l.fotos.length ? l.fotos.map((f) => tarjetaFoto(l, f)) : el('p', { class: 'vacio' }, 'Sin fotos todavía.')),
    el('div', { class: 'agregar-foto' }, entrada, boton('Agregar', agregar, 'boton principal')),
    errorLink,

    el('h3', { class: 'subtitulo' }, 'En el audio'),
    el('div', { class: 'fila' },
      momentos.length ? momentos.map((m) => el('button', {
        type: 'button', class: 'tiempo-chip', title: m.oye || 'Abrir este momento',
        onclick: async () => {
          if (m.audio !== audioId) await elegirAudio(m.audio);
          seleccionar('marca', m.id);
          ir(m.t - 2, true);
        },
      }, (m.audio !== audioId ? nombreAudio(m.audio) + ' · ' : '') + fmt(m.t))) : el('span', { class: 'vacio' },
        l.fotos.length ? 'Falta el momento: dale ▶ y tocá el botón cuando se oiga o se pase frente a este edificio.' : 'Ningún momento.')),
    el('div', { class: 'fila' },
      boton(`＋ Se oye ahora (${fmt(audio.currentTime, false)})`, () => {
        const m = nuevaMarca({ lugar: l.id });
        cambio();
        elegirEnMapa(`¿Dónde estabas a los ${fmt(m.t)}? Hacé clic en el mapa`, (p) => {
          const M = buscarMarca(m.id);
          if (M) { M.lat = p.lat; M.lng = p.lng; cambio(); }
        });
      }, 'boton chico principal', { 'data-ahora': '＋ Se oye ahora (#)', title: 'Crea un momento en «' + nombreAudio(audioId) + '» en el instante actual' })),

    el('div', { class: 'pie-tarjeta' },
      boton('Borrar edificio', () => {
        const extra = momentos.length ? `\n(Sus ${momentos.length} momentos del audio quedan, pero sin edificio.)` : '';
        if (!confirm(`¿Borrar «${l.nombre || 'edificio sin nombre'}» y sus ${l.fotos.length} links de fotos?${extra}`)) return;
        datos.lugares = datos.lugares.filter((x) => x.id !== l.id);
        for (const m of datos.marcas) if (m.lugar === l.id) m.lugar = null;
        sel = null;
        cambio();
      }, 'boton chico peligro')));
}

function tarjetaFoto(l, f) {
  const src = urlMiniatura(f.url), drive = idDrive(f.url);
  const sinVista = (texto, error = false) => el('div', { class: 'miniatura' + (error ? ' error' : '') }, texto);
  let mini;
  if (src) {
    mini = el('img', { class: 'miniatura', src, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' });
    mini.addEventListener('error', () => mini.replaceWith(sinVista('No se ve: compartilo como «Cualquier persona con el enlace»', true)), { once: true });
  } else {
    mini = sinVista(drive && drive.carpeta ? 'Carpeta de Drive' : 'Sin vista previa');
  }

  const tipo = el('select', { onchange: (e) => { f.tipo = e.target.value; cambio({ lista: false }); } },
    ...C.tiposFoto.map((t) => el('option', { value: t }, t)));
  tipo.value = f.tipo;

  const ubicar = () => elegirEnMapa('Hacé clic en el lugar desde donde tomaste la foto', (p) => { f.desde = p; cambio(); seleccionar('lugar', l.id, { volar: false, foto: f.id }); });

  return el('div', { class: 'foto' + (sel && sel.foto === f.id ? ' seleccionada' : '') }, mini,
    el('div', { class: 'foto-datos' }, tipo,
      el('input', { type: 'text', value: f.nota, placeholder: 'nota (opcional)', oninput: (e) => { f.nota = e.target.value; cambio({ lista: false }); } }),
      el('div', { class: 'fila' },
        f.desde
          ? [el('span', { class: 'estado-pos' }, '◉ desde dónde: ubicado'), boton('Mover', ubicar), boton('Quitar', () => { f.desde = null; cambio(); }, 'boton chico peligro')]
          : boton('Ubicar desde dónde', ubicar, 'boton chico', { title: 'El lugar desde donde tomaste la foto: es el punto de vista de la proyección' })),
      el('div', { class: 'fila' },
        el('a', { href: f.url, target: '_blank', rel: 'noopener noreferrer' }, drive && drive.carpeta ? 'Abrir carpeta ↗' : 'Abrir ↗'),
        boton('Quitar foto', () => {
          if (!confirm('¿Quitar este link? (La foto sigue en Google Drive.)')) return;
          l.fotos = l.fotos.filter((x) => x.id !== f.id);
          cambio();
        }, 'boton chico peligro'))));
}

// ─────────────────────────── CONTROLES Y TECLADO ───────────────────────────
$('#reproducir').addEventListener('click', alternar);
$('#atras').addEventListener('click', () => ir(audio.currentTime - 5));
$('#adelante').addEventListener('click', () => ir(audio.currentTime + 5));
$('#marcar').addEventListener('click', marcarAhora);
$('#velocidad').addEventListener('change', (e) => { audio.defaultPlaybackRate = audio.playbackRate = Number(e.target.value); });
$('#zoom').addEventListener('change', dibujarOnda);
$('#audio-elegir').addEventListener('change', (e) => { audio.pause(); elegirAudio(e.target.value); });
$('#descargar').addEventListener('click', () => descargarJSON({ exportado: new Date().toISOString(), version, ...datos }, 'little-havana-carga'));
$('#ayuda-abrir').addEventListener('click', () => $('#ayuda').showModal());
$('#pedir-clave').addEventListener('cancel', (e) => e.preventDefault());   // sin clave no se puede seguir

addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modo) { e.preventDefault(); cancelarModo(); return; }
  if (e.metaKey || e.ctrlKey || e.altKey || document.querySelector('dialog[open]')) return;
  if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable]')) return;
  if (e.code === 'Space') { e.preventDefault(); alternar(); }
  else if (e.key === 'm' || e.key === 'M') { e.preventDefault(); marcarAhora(); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); ir(audio.currentTime - 5); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); ir(audio.currentTime + 5); }
});

// ─────────────────────────── INICIO ───────────────────────────
$('#audio-elegir').replaceChildren(...C.audios.map((a) => el('option', { value: a.id }, a.nombre)));
const audioGuardado = leerLS(LS.audio);
elegirAudio(C.audios.some((a) => a.id === audioGuardado) ? audioGuardado : C.audios[0].id);
await iniciarDatos();
renderTodo();
if (!leerLS(LS.ayuda)) { $('#ayuda').showModal(); escribirLS(LS.ayuda, '1'); }

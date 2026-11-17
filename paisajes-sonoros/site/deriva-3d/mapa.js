// Deriva Calle 8 — mapa 3D sincronizado con el audio.
// Los datos del recorrido y de los registros están en recorrido.js; este archivo no necesita editarse.
// Las cámaras calibradas (calibrar.html) están en calibracion.js y tienen prioridad sobre recorrido.js.

import { normalizar, factorIso } from './camara.js';
import { iniciarEstilos } from './estilos.js';
import { FOTO as PANO, telonDe, encuadre as encuadrePano } from '../portada/panoramica.js';

const $ = (s) => document.querySelector(s);
const M = window.MUESTRA;
const R = window.RECORRIDO;
const PARAMS = new URLSearchParams(location.search);
const EDITAR = PARAMS.has('editar');
// vista de la experiencia: siempre a pie (la cámara se mueve sola); ?vista=aerea o ?vista=general sólo para revisar
const VISTA = ['calle', 'aerea', 'general'].includes(PARAMS.get('vista')) ? PARAMS.get('vista') : 'calle';
// calibración guardada en calibracion.js; con ?prueba, además lo que está sin guardar en calibrar.html
const CAL = (() => {
  const c = { vistas: { ...((window.CALIBRACION || {}).vistas || {}) }, alturas: [...((window.CALIBRACION || {}).alturas || [])] };
  if (PARAMS.has('prueba')) {
    try {
      const b = JSON.parse(localStorage.getItem('deriva3d-calibracion') || 'null');
      if (b) { Object.assign(c.vistas, b.vistas || {}); if (b.alturas) c.alturas = b.alturas; }
    } catch (e) {}
  }
  return c;
})();
const COLOR = (window.SITIOS && window.SITIOS['deriva-calle-8'] && window.SITIOS['deriva-calle-8'].color) || '#685236';
document.documentElement.style.setProperty('--accent', COLOR);
// artista, muestra y espacios que la auspician, debajo de la descripción
if (M) $('#muestra').innerHTML = `<span class="m-artista">${M.artista}</span><span class="m-titulo">${M.titulo}: ${M.subtitulo}</span><span class="m-sede">${M.sede}</span>`;

// cámara de calle
const OJO = 1.65;           // altura de los ojos, en metros
const PITCH_CALLE = 84;     // 90 = horizonte; más de ~84 hace que MapLibre dibuje hasta el horizonte y se cuelgue
const FOV_CALLE = 62;       // campo de visión vertical en la vereda (el del mapa es 36.87)
const FOV_CALLE_H = 80;     // …pero nunca más de 80° a lo ancho: en pantallas apaisadas (tableta, computadora sin
                            // marco) 62° verticales serían ~95° horizontales y la calle se vería deformada
// campo de visión vertical de la vereda para esta pantalla (en un celular vertical es siempre FOV_CALLE)
function fovCalle() {
  const aspecto = window.innerWidth / Math.max(1, window.innerHeight);
  return Math.min(FOV_CALLE, (2 * Math.atan(Math.tan((FOV_CALLE_H / 2) * RAD) / aspecto)) / RAD);
}
const FOV_MAPA = 36.87;
// Pantalla de inicio: la panorámica del dron (la misma de la portada) proyectada sobre la ciudad, vista desde el
// punto donde se tomó. En un celular vertical se ve una franja y la cámara la recorre girando sobre sí misma; al
// girar el celular, la foto entra casi entera. Al comenzar, la proyección se apaga y la cámara vuela a la vereda.
// Al terminar el recorrido la cámara vuelve al dron y la panorámica se recompone, hasta que se vuelve a empezar.
// No se usa al editar (ahí hace falta ver el recorrido desde el principio).
const INICIO_PANO = !EDITAR;
const QUIETA = matchMedia('(prefers-reduced-motion: reduce)').matches;
const PANEO_SEG = 80;       // segundos de una ida y vuelta del paneo
const PANO_APAGA = 2.5;     // segundos que tarda en apagarse la proyección al comenzar
const VUELTA_SEG = 9;       // segundos del vuelo de vuelta al dron al terminar el recorrido
const VUELTA_ALTO = 400;    // altura (m) a la que cruza la ciudad en ese vuelo
const PASO = 0.75;          // largo del paso, en metros (para el balanceo)

// ── utilidades ─────────────────────────────────────
const aSeg = (v) => (typeof v === 'number' ? v : String(v).split(':').map(Number).reduce((a, b) => a * 60 + b, 0));
const RAD = Math.PI / 180;
const metros = (a, b) => {
  const x = (b.lng - a.lng) * RAD * Math.cos(((a.lat + b.lat) / 2) * RAD);
  const y = (b.lat - a.lat) * RAD;
  return Math.hypot(x, y) * 6371000;
};
const rumbo = (a, b) => Math.atan2((b.lng - a.lng) * Math.cos(a.lat * RAD), b.lat - a.lat) / RAD;
const desplazar = (p, rumboDeg, m) => ({
  lat: p.lat + (m * Math.cos(rumboDeg * RAD)) / 111320,
  lng: p.lng + (m * Math.sin(rumboDeg * RAD)) / (111320 * Math.cos(p.lat * RAD)),
});
const quieto = (a, b) => a.lng === b.lng && a.lat === b.lat;
const difAng = (a, b) => ((b - a + 540) % 360) - 180;
const suave = (x) => x * x * (3 - 2 * x);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// ── fotogramas clave del recorrido ─────────────────
const K = [];
R.puntos.forEach((p) => {
  const t = aSeg(p.t);
  K.push({ t, lng: p.lng, lat: p.lat, nota: p.nota || '' });
  if (p.hasta != null) K.push({ t: aSeg(p.hasta), lng: p.lng, lat: p.lat, nota: p.nota || '' });
});
for (let i = 1; i < K.length; i++) if (K[i].t < K[i - 1].t) console.warn('recorrido.js: tiempos fuera de orden en', K[i]);

K[0].d = 0;
for (let i = 1; i < K.length; i++) K[i].d = K[i - 1].d + metros(K[i - 1], K[i]);
const LARGO = K[K.length - 1].d || 1;
let ultimoRumbo = 0;
for (let i = 0; i < K.length - 1; i++) {
  if (!quieto(K[i], K[i + 1])) ultimoRumbo = rumbo(K[i], K[i + 1]);
  K[i].rumbo = ultimoRumbo;
}
const primerRumbo = (K.find((k, i) => i < K.length - 1 && !quieto(k, K[i + 1])) || K[0]).rumbo || 0;
for (let i = 0; i < K.length - 1 && quieto(K[i], K[i + 1]); i++) K[i].rumbo = primerRumbo;
K[K.length - 1].rumbo = ultimoRumbo;

const coordsRuta = K.filter((k, i) => i === 0 || !quieto(k, K[i - 1])).map((k) => [k.lng, k.lat]);

// coordenadas locales en metros (x = este, y = norte) alrededor del inicio, iguales a las de la capa 3D
const ORIGEN = maplibregl.MercatorCoordinate.fromLngLat([K[0].lng, K[0].lat], 0);
const ESCALA = ORIGEN.meterInMercatorCoordinateUnits();
const aLocal = ([lng, lat]) => {
  const mc = maplibregl.MercatorCoordinate.fromLngLat([lng, lat], 0);
  return [(mc.x - ORIGEN.x) / ESCALA, -(mc.y - ORIGEN.y) / ESCALA];
};
const aLngLat = (x, y) => new maplibregl.MercatorCoordinate(ORIGEN.x + x * ESCALA, ORIGEN.y - y * ESCALA, 0).toLngLat();

function estado(t) {
  const n = K.length - 1;
  if (t <= K[0].t) return { ...K[0], k: 0, pausa: false, caminando: false };
  if (t >= K[n].t) return { ...K[n], k: n, pausa: false, caminando: false };
  let k = 0;
  while (k < n - 1 && K[k + 1].t <= t) k++;
  const a = K[k], b = K[k + 1];
  const f = b.t > a.t ? (t - a.t) / (b.t - a.t) : 0;
  const pausa = quieto(a, b);
  let nota = '';
  if (pausa || t - a.t < 7) nota = a.nota;
  else if (b.t - t < 7) nota = b.nota;
  return {
    lng: a.lng + (b.lng - a.lng) * f,
    lat: a.lat + (b.lat - a.lat) * f,
    d: a.d + (b.d - a.d) * f,
    rumbo: a.rumbo, k, pausa, nota, caminando: !pausa,
    tPausa: pausa ? t - a.t : 0,
  };
}

// ── miradas (registros en las fachadas) ────────────
const MIRADAS = (R.miradas || []).map((m) => {
  const ancho = m.ancho || 5, alto = m.alto || 3.4, base = m.base != null ? m.base : 1.4;
  const frente = desplazar(m, m.rumbo || 0, 1.0); // el cuadro flota 1 m delante de la fachada
  return { ...m, ancho, alto, base, desde: aSeg(m.desde), hasta: aSeg(m.hasta),
    imagenes: m.imagenes || [], c: frente, zc: base + alto / 2 };
});
// intensidad de cada mirada en el tiempo t (0…1 con entrada y salida suaves)
const FUNDIDO = 2.5;
function intensidad(m, t) {
  if (t < m.desde - FUNDIDO || t > m.hasta + FUNDIDO) return 0;
  return suave(clamp(Math.min((t - m.desde + FUNDIDO) / FUNDIDO, (m.hasta + FUNDIDO - t) / FUNDIDO), 0, 1));
}
const miradaEn = (t) => {
  let mejor = null, iMax = 0;
  for (const m of MIRADAS) { const i = intensidad(m, t); if (i > iMax) { iMax = i; mejor = m; } }
  return mejor ? { m: mejor, i: iMax } : null;
};

// ── proyecciones anamórficas y vuelos de cámara ────
// No hay límite de vistas: ciudad.js proyecta a la vez sólo las que se están viendo (máximo 6 simultáneas).
const VISTAS = [];
const RADIO_LUGAR = 15; // m alrededor del punto de la foto en que el caminante dispara el travelling
const LUGARES = (R.proyecciones || []).map((p, grupo) => {
  const vistas = p.vistas.map((v) => {
    const c = CAL.vistas[v.imagen];
    const vista = { ...normalizar(c ? { ...v, ...c, imagen: v.imagen } : v, aLocal), idx: VISTAS.length, aspecto: 1.45,
      tipo: v.tipo || p.tipo || '' };   // el pie dice qué es la imagen que se está viendo
    // vistas isométricas (camara.js): la cámara está a ~1 km con un teleobjetivo. El vuelo se calcula con su
    // equivalente CERCANA (misma dirección, apertura de 40°, `iso` veces más cerca) y recién al final la cámara se
    // aleja por su eje cerrando el campo de visión en la misma proporción: un dolly zoom (ver camaraCalle).
    vista.iso = factorIso(vista);
    vista.lnIso = Math.log(vista.iso);
    vista.posEq = vista.pos.map((x, i) => vista.mira[i] + (x - vista.mira[i]) / vista.iso);
    const im = new Image();
    im.onload = () => (vista.aspecto = im.naturalWidth / im.naturalHeight);
    im.src = v.imagen;
    VISTAS.push(vista);
    return vista;
  });
  // huella: la vista que queda proyectada (tenue) fuera del tramo; la marcada con huella: true, o la primera
  const iHuella = Math.max(0, p.vistas.findIndex((v) => v.huella)), huella = vistas[iHuella];
  // punto que dispara el travelling: donde se tomó la foto que queda como huella (o `punto` en recorrido.js)
  const ref = p.punto || (CAL.vistas[huella.imagen] || {}).camara || p.vistas[iHuella].camara;
  return { ...p, grupo, huella, vistas, centro: aLocal([ref.lng, ref.lat]), radio: p.radio || RADIO_LUGAR,
    repite: (p.repite || []).map((i) => vistas[i]).filter(Boolean) };
});
// TRAVELLING POR CERCANÍA: cuando el caminante entra a RADIO_LUGAR metros del punto de una foto, la cámara lo deja,
// recorre los puntos de vista del lugar (una sola excursión, con la ola entre una imagen y otra) y vuelve a sus ojos.
// Como la caminata está fijada en el tiempo (puntos de recorrido.js), los tramos se calculan de antemano: cada
// lugar se dispara la primera vez que el caminante se acerca; en las pasadas siguientes sólo si tiene `repite`
// (con esas vistas). Si dos lugares se pisan, el segundo espera a que la cámara haya vuelto del primero.
// La cámara "presta atención" al lugar desde ANTICIPA segundos antes: el caminante gira la cabeza hacia él y ve la
// proyección fragmentada en las fachadas. Al volver a la vereda suelta la mirada de a poco (SUELTA).
const ANTICIPA = 20, SUELTA = 5;
const TRASLADO = 6, POST = 3, REPOSO = 0.7;
const CONTEMPLA = 6; // segundos quieto en cada punto de vista
const PASO_T = 0.5;
function pasadas(L) {
  const fin = K[K.length - 1].t, res = [];
  let dentro = false;
  for (let t = 0; t <= fin; t += PASO_T) {
    const e = estado(t), [x, y] = aLocal([e.lng, e.lat]);
    const d = Math.hypot(x - L.centro[0], y - L.centro[1]);
    if (!dentro && d < L.radio) { dentro = true; res.push(t); }
    else if (dentro && d > L.radio * 1.4) dentro = false; // histéresis: no se dispara dos veces en el borde
  }
  return res;
}
// viaje de ida y de vuelta: 5–8 s según la distancia entre los ojos del caminante y el punto de vista
const viaje = (t, v) => {
  const e = estado(t), [x, y] = aLocal([e.lng, e.lat]);
  return clamp(4 + Math.hypot(v.posEq[0] - x, v.posEq[1] - y, v.posEq[2] - OJO) / 6, 5, 8);
};
const PROYS = LUGARES.flatMap((L) => pasadas(L).map((t, i) => ({ ...L, desde: t, vistas: i === 0 ? L.vistas : L.repite })))
  .filter((p) => p.vistas.length).sort((a, b) => a.desde - b.desde);
PROYS.forEach((p, i) => {
  const prev = PROYS[i - 1];
  if (prev) p.desde = Math.max(p.desde, prev.hasta + SUELTA + 2);
  const n = p.vistas.length, ult = p.vistas[n - 1];
  p.subida = viaje(p.desde, p.vistas[0]);
  const resto = n * CONTEMPLA + (n - 1) * TRASLADO;
  p.bajada = viaje(p.desde + p.subida + resto + 6, ult);
  p.hasta = p.desde + p.subida + resto + p.bajada;
  p.inicio = p.desde;
  // la anticipación no empieza antes de que termine de soltarse el lugar anterior (si no, la cabeza salta de uno a otro)
  p.anticipa = prev ? clamp(p.inicio - (prev.hasta + SUELTA), 2, ANTICIPA) : ANTICIPA;
});
// el último puede terminar después del audio: el recorrido cierra con la imagen recompuesta. Pero si la cámara ni
// siquiera llegaría al primer punto de vista antes del final, ese travelling no se hace.
for (let i = PROYS.length - 1; i >= 0; i--) if (PROYS[i].desde + PROYS[i].subida > K[K.length - 1].t - 2) PROYS.splice(i, 1);
const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
if (PARAMS.has('tramos')) console.log('travellings:\n' + PROYS.map((p) => `${mmss(p.desde)}–${mmss(p.hasta)}  ${p.lugar} (${p.vistas.length} vista${p.vistas.length > 1 ? 's' : ''})`).join('\n'));

// peso de cada vista de una proyección en el momento t (una a la vez, con fundidos). El tiempo entre la
// llegada (después de la subida) y la partida (antes de la bajada) se reparte en partes iguales.
function pesosProy(p, t) {
  const n = p.vistas.length, a = p.desde + p.subida, D = Math.max(0, p.hasta - p.bajada - a);
  const pesos = [1];
  for (let k = 1; k < n; k++) {
    const f = suave(clamp((t - (a + (k * D) / n) + TRASLADO / 2) / TRASLADO, 0, 1));
    for (let j = 0; j < k; j++) pesos[j] *= 1 - f;
    pesos[k] = f;
  }
  return pesos;
}
// OLA: cuando un lugar pasa de una imagen a otra (entre dos vistas, al empezar si la huella no es la primera vista,
// y al terminar si la última no es la huella) no hay fundido: las dos quedan encendidas y un frente sale del lugar y
// se expande por la ciudad cambiando una por otra (ver ola() en ciudad.js). f = avance 0…1.
const olaEntre = (p, sale, entra, f) => ({
  lados: { [sale.idx]: -1, [entra.idx]: 1 },
  centro: entra.mira,
  radio: p.radioOla * Math.pow(f, 1.6),
  luz: Math.sqrt(Math.sin(Math.PI * clamp(f, 0, 1))),
});
// la saliente se termina de apagar al final de la ola (por si algo de su imagen cae más allá del radio)
const resto = (f) => 1 - suave(clamp((f - 0.8) / 0.2, 0, 1));
PROYS.forEach((p) => {
  // hasta dónde llega la ola: un poco más que la distancia de las cámaras al lugar (120…320 m)
  const d = Math.max(...p.vistas.map((v) => Math.hypot(v.pos[0] - v.mira[0], v.pos[1] - v.mira[1], v.pos[2] - v.mira[2])));
  p.radioOla = clamp(d * 1.5 + 60, 120, 320);
});
function intensidades(t) {
  const arr = new Array(VISTAS.length).fill(0);
  let ola = null;
  // un lugar con varios tramos (vuelve) aparece varias veces en PROYS: manda el tramo en curso o más cercano
  const activo = (p) => t >= p.inicio - p.anticipa && t < p.hasta + POST;
  const enCurso = new Set(PROYS.filter(activo).map((p) => p.grupo));
  // mientras se mira un lugar (desde que la cabeza gira hacia él hasta que vuelve la huella) las huellas de los
  // demás se apagan: si no, se superponen a la imagen (p. ej. el dron del Tower cubre toda la vereda sur)
  let foco = 0;
  for (const p of PROYS) {
    if (!activo(p)) continue;
    const f = t < p.inicio ? suave((t - p.inicio + p.anticipa) / p.anticipa)
      : t <= p.hasta ? 1 : 1 - suave((t - p.hasta) / POST);
    foco = Math.max(foco, f);
  }
  const hechos = new Set();
  for (const p of PROYS) {
    if (activo(p) ? false : enCurso.has(p.grupo) || hechos.has(p.grupo)) continue;
    hechos.add(p.grupo);
    const v0 = p.vistas[0].idx, ult = p.vistas[p.vistas.length - 1].idx, h = p.huella.idx;
    if (t >= p.inicio && t <= p.hasta) {
      const pesos = pesosProy(p, t);
      pesos.forEach((w, k) => (arr[p.vistas[k].idx] = w));
      // entre dos vistas: las dos enteras, y la ola decide qué se ve dónde
      for (let k = 1; k < pesos.length; k++) {
        const f = pesos[k] / (pesos[k] + pesos[k - 1] || 1);
        if (f > 0 && f < 1 && pesos[k] + pesos[k - 1] > 0.99) {
          arr[p.vistas[k - 1].idx] = resto(f);
          arr[p.vistas[k].idx] = 1;
          ola = olaEntre(p, p.vistas[k - 1], p.vistas[k], f);
        }
      }
    } else if (t > p.hasta && t < p.hasta + POST) { // la última vista se apaga y vuelve la huella
      const f = suave((t - p.hasta) / POST);
      if (ult !== h) {
        arr[ult] = resto(f);
        arr[h] = REPOSO;
        ola = olaEntre(p, p.vistas[p.vistas.length - 1], p.huella, f);
      } else arr[h] = 1 - (1 - REPOSO) * f;
    } else if (t >= p.inicio - p.anticipa && t < p.inicio) { // la huella cede el lugar a la primera vista
      const f = suave((t - p.inicio + p.anticipa) / p.anticipa);
      if (v0 !== h) {
        arr[h] = REPOSO * resto(f);
        arr[v0] = REPOSO + (1 - REPOSO) * f;
        ola = olaEntre(p, p.huella, p.vistas[0], f);
      } else arr[h] = REPOSO + (1 - REPOSO) * f; // la huella es la primera vista: sube de REPOSO a 1
    } else arr[h] = REPOSO * (1 - foco);
  }
  return { arr, ola };
}
const polar = (c, m) => ({ th: Math.atan2(c[0] - m[0], c[1] - m[1]) / RAD, r: Math.hypot(c[0] - m[0], c[1] - m[1]), z: c[2] });
const desdePolar = (m, th, r, z) => [m[0] + r * Math.sin(th * RAD), m[1] + r * Math.cos(th * RAD), z];
// orientación (rumbo y pitch de MapLibre) para mirar desde c hacia el punto m; `alto` es el pitch sin tope
function mirarA(c, m) {
  const dx = m[0] - c[0], dy = m[1] - c[1];
  const alto = 90 - Math.atan2(c[2] - m[2], Math.hypot(dx, dy)) / RAD;
  return { rumbo: Math.atan2(dx, dy) / RAD, pitch: Math.min(PITCH_CALLE, alto), alto };
}
// La cámara viaja apuntando a la mira, pero al llegar tiene que mirar por el EJE de la foto (rumbo y cabeceo del
// proyector), que no siempre pasa por la mira: dR y dP son la diferencia entre una dirección y la otra.
VISTAS.forEach((v) => {
  v.polar = polar(v.posEq, v.mira);
  const L = mirarA(v.posEq, v.mira);
  v.dR = difAng(L.rumbo, v.rumbo ?? L.rumbo);
  v.dP = v.cabeceo == null ? 0 : 90 - v.cabeceo - L.alto;
});
// zona libre de la pantalla: entre el indicador de arriba y el pie del registro (que está sobre el panel).
// El pie cambia de alto según el texto: se toma el mayor que se vio, para que el encuadre no salte.
let altoPie = 0;
function zonaLibre() {
  const H = window.innerHeight, panel = $('#panel').hidden ? 0 : $('#panel').offsetHeight;
  altoPie = Math.max(altoPie, $('#pie').offsetHeight || 0);
  const arriba = Math.min(76, H * 0.1);
  let abajo = panel + (altoPie ? altoPie + 24 : 0);
  // (en un celular apaisado el panel ocupa casi todo el alto: se garantiza un mínimo para que la imagen no desaparezca)
  abajo = Math.min(abajo, H - arriba - 0.35 * H);
  return { arriba, alto: H - arriba - abajo };
}
// Encuadre de una vista en esta pantalla: la foto entra entera y queda CENTRADA en la zona libre.
// La posición y la orientación de la cámara son exactas (eso es lo que recompone la imagen). Para centrar sin
// moverlas se corre el centro óptico de la pantalla (el `padding` de MapLibre es un frustum descentrado: no
// cambia los rayos, sólo dónde caen en la pantalla). yp = altura del centro óptico, en fracción del alto.
// Si MapLibre no puede inclinar la cámara tanto como la foto (pitch entre 0 y PITCH_CALLE), la diferencia d también
// se compensa corriendo el centro óptico.
function encuadre(v) {
  const W = window.innerWidth, H = window.innerHeight, z = zonaLibre();
  const tanH = Math.tan((v.apertura * RAD) / 2), aV = Math.atan(tanH / v.aspecto);
  const P = 90 - (v.cabeceo ?? 45), d = (P - clamp(P, 0, PITCH_CALLE)) * RAD; // d > 0: la foto mira más arriba
  const sup = Math.tan(Math.min(d + aV, 1.4)), inf = Math.tan(Math.max(d - aV, -1.4)); // bordes, arriba positivo
  const f = Math.min(W / 2 / (1.06 * tanH), z.alto / (1.04 * (sup - inf)));
  const yp = z.arriba + z.alto / 2 + (f * (sup + inf)) / 2;
  return { fov: (2 * Math.atan(H / 2 / f)) / RAD, yp: clamp(yp / H, 0.06, 0.94) };
}
// encuadre de la equivalente cercana de una vista isométrica: el mismo cuadro con `iso` veces más campo de visión
function encuadreEq(v) {
  const e = encuadre(v);
  if (v.iso <= 1) return e;
  return { fov: (2 * Math.atan(Math.tan((e.fov / 2) * RAD) * v.iso)) / RAD, yp: e.yp };
}
// vuelo activo en t: w = 0 (ojos del caminante) … 1 (punto de vista de la imagen)
function vuelo(t) {
  for (const p of PROYS) {
    if (t < p.inicio || t > p.hasta) continue;
    const pesos = pesosProy(p, t);
    const v0 = p.vistas[0], e0 = encuadreEq(v0);
    let m = [...v0.mira], { th, r, z } = v0.polar, fov = e0.fov, yp = e0.yp, giro = v0.giro, lnIso = v0.lnIso;
    let dR = v0.dR, dP = v0.dP;
    for (let k = 1; k < pesos.length; k++) {
      const f = pesos[k] / (pesos[k] + pesos[k - 1] || 1);
      if (f <= 0) continue;
      const v = p.vistas[k], ev = encuadreEq(v);
      m = m.map((c, i) => c + (v.mira[i] - c) * f);
      th += difAng(th, v.polar.th) * f; r += (v.polar.r - r) * f; z += (v.polar.z - z) * f;
      fov += (ev.fov - fov) * f; yp += (ev.yp - yp) * f; giro += (v.giro - giro) * f; lnIso += (v.lnIso - lnIso) * f;
      dR += (v.dR - dR) * f; dP += (v.dP - dP) * f;
      // entre una vista y otra la cámara se aleja y sube un poco: la imagen se deshace antes de rearmarse
      const b = Math.sin(Math.PI * f);
      r *= 1 + 0.3 * b; z *= 1 + 0.35 * b;
    }
    const w = suave(clamp((t - p.inicio) / p.subida, 0, 1)) * suave(clamp((p.hasta - t) / p.bajada, 0, 1));
    return { p, w, k: pesos.indexOf(Math.max(...pesos)), T: m, polarV: { th, r, z }, fov, yp, dR, dP, giro, lnIso };
  }
  return null;
}
// atención: lista de { a = 0…1 (cuánto mira el caminante hacia el lugar), T = punto mirado }, en orden de
// tiempo. Se aplican siempre en ese orden (el lugar que viene después manda sobre el que se está soltando):
// así, cuando dos se superponen, la mirada pasa de uno a otro sin saltos.
function atencion(t, vu) {
  if (vu) return [{ p: vu.p, a: 1, T: vu.T }];
  const lista = [];
  for (const p of PROYS) {
    let a = 0, T = null;
    if (t >= p.inicio - p.anticipa && t < p.inicio) { a = suave((t - p.inicio + p.anticipa) / p.anticipa); T = p.vistas[0].mira; }
    else if (t > p.hasta && t <= p.hasta + SUELTA) { a = 1 - suave((t - p.hasta) / SUELTA); T = p.vistas[p.vistas.length - 1].mira; }
    if (a > 0) lista.push({ p, a, T });
  }
  return lista;
}

// ── audio ──────────────────────────────────────────
const audio = new Audio();
window.__audio = audio; // para depurar desde la consola
audio.preload = 'metadata';
audio.src = R.audio;
const duracion = () => (isFinite(audio.duration) && audio.duration) || K[K.length - 1].t;

// ── mapa ───────────────────────────────────────────
const map = window.__map = new maplibregl.Map({ // DEPURAR-QUITAR
  container: 'mapa',
  style: 'https://tiles.openfreemap.org/styles/dark',
  center: [-80.2195, 25.7657],
  zoom: 16,
  pitch: 55,
  bearing: -25,
  maxPitch: 85,
  maxZoom: 24,
  attributionControl: { compact: true },
  canvasContextAttributes: { antialias: true },
});
window.__mapa = map; // para depurar desde la consola

// panorámica: { vista, ciudad (cuando cargó), listo (momento en que se vio), apagando (al comenzar),
//              vuelta (al terminar: de dónde sale la cámara y cuándo llega al dron) }
const VISTA_PANO = INICIO_PANO ? { ...normalizar(PANO, aLocal), lejos: PANO.lejos } : null;
const nuevoPano = () => ({ vista: VISTA_PANO, ciudad: null, listo: 0, cuadros: 0, apagando: 0, vuelta: null });
let pano = INICIO_PANO ? nuevoPano() : null;
let crear3D = null;   // { THREE, crearCiudad }: para volver a armar la ciudad de la panorámica al terminar

const elCaminante = document.createElement('div');
elCaminante.className = 'caminante';
const marcador = new maplibregl.Marker({ element: elCaminante }).setLngLat([K[0].lng, K[0].lat]);
const bounds = coordsRuta.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(coordsRuta[0], coordsRuta[0]));

let capaRegistros = null;
let ciudad = null;
let estilos = null;   // estilos visuales intercambiables (estilos.js)

map.on('load', async () => {
  const capas = map.getStyle().layers;
  const primeraEtiqueta = (capas.find((l) => l.type === 'symbol') || {}).id;
  if (map.getLayer('building')) map.setLayoutProperty('building', 'visibility', 'none');
  etiquetas(true);

  // ancho real en metros a cualquier zoom
  const real = (m) => ['interpolate', ['exponential', 2], ['zoom'], 12, m * 0.058, 24, m * 238];
  const porClase = (extra, f) => ['match', ['get', 'class'],
    ['motorway', 'trunk', 'primary'], (15 + extra) * f, 'secondary', (13 + extra) * f, 'tertiary', (11 + extra) * f,
    ['minor', 'service'], (8.5 + extra) * f, 0];
  const anchoCalle = (extra) => ['interpolate', ['exponential', 2], ['zoom'], 12, porClase(extra, 0.058), 24, porClase(extra, 238)];
  const filtroCalles = ['all', ['==', ['geometry-type'], 'LineString'],
    ['match', ['get', 'class'], ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service'], true, false]];
  // suelo a la luz rasante del atardecer (las sombras las pone la capa 3D encima)
  const pintar = (id, prop, v) => { if (map.getLayer(id)) map.setPaintProperty(id, prop, v); };
  pintar('background', 'background-color', '#4b3c3f');
  pintar('landuse_residential', 'fill-color', '#514144');
  pintar('landuse_park', 'fill-color', '#3f4a3d');
  pintar('landcover_wood', 'fill-color', '#3f4a3d');
  pintar('water', 'fill-color', '#2b3552');
  map.addLayer({ id: 'veredas', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation', minzoom: 15,
    filter: filtroCalles, layout: { 'line-cap': 'square', 'line-join': 'round' },
    paint: { 'line-color': '#a38674', 'line-width': anchoCalle(7) } }, primeraEtiqueta);
  map.addLayer({ id: 'calzadas', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation', minzoom: 15,
    filter: filtroCalles, layout: { 'line-cap': 'butt', 'line-join': 'round' },
    paint: { 'line-color': '#3f3539', 'line-width': anchoCalle(0) } }, primeraEtiqueta);
  map.addLayer({ id: 'carriles', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation', minzoom: 17,
    filter: ['all', filtroCalles, ['match', ['get', 'class'], ['primary', 'secondary', 'trunk'], true, false]],
    paint: { 'line-color': '#f2d3a4', 'line-opacity': 0.5, 'line-width': real(0.15), 'line-dasharray': [10, 14] } }, primeraEtiqueta);

  const alto = ['coalesce', ['get', 'render_height'], 6];
  // fachadas: pasteles apagados (de noche), variando por edificio
  const tono = ['%', ['floor', ['/', ['to-number', ['id'], 0], 10]], 5]; // los id de OSM terminan en 0
  map.addLayer({
    id: 'edificios-3d', type: 'fill-extrusion', source: 'openmaptiles', 'source-layer': 'building',
    paint: {
      'fill-extrusion-color': ['match', tono, 0, '#5e4b45', 1, '#5c5443', 2, '#3f4c4a', 3, '#524840', '#4c4452'],
      'fill-extrusion-height': alto,
      'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
      'fill-extrusion-opacity': 1,
      'fill-extrusion-vertical-gradient': true,
    },
  }, primeraEtiqueta);

  try { map.setLight({ anchor: 'map', position: [1.4, 235, 76], intensity: 0.6, color: '#ffc890' }); } catch (e) {}
  // cielo de atardecer: cenit índigo, horizonte encendido (el sol cae hacia el oeste, al fondo de Calle 8)
  try {
    map.setSky({ 'sky-color': '#2a2852', 'horizon-color': '#f39a62', 'fog-color': '#7d5560',
      'sky-horizon-blend': 0.55, 'horizon-fog-blend': 0.45, 'fog-ground-blend': 0.8, 'atmosphere-blend': 0 });
  } catch (e) {}

  map.addSource('ruta', {
    type: 'geojson', lineMetrics: true,
    data: { type: 'Feature', geometry: { type: 'LineString', coordinates: coordsRuta } },
  });
  // ancho fijo en pantalla de lejos; de cerca, ancho real en metros sobre la vereda
  const anchoLinea = (minPx, m) => ['interpolate', ['exponential', 2], ['zoom'], 14, minPx, 18, Math.max(minPx, m * 3.7), 24, m * 238];
  map.addLayer({
    id: 'ruta-base', type: 'line', source: 'ruta',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': COLOR, 'line-opacity': 0.4, 'line-width': anchoLinea(2, 0.14), 'line-dasharray': [2, 3] },
  });
  map.addLayer({
    id: 'ruta-hecha', type: 'line', source: 'ruta',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-width': anchoLinea(4, 0.3), 'line-gradient': gradiente(0), 'line-blur': anchoLinea(0, 0.15) },
  });

  marcador.addTo(map);
  const attrib = document.querySelector('.maplibregl-ctrl-attrib');
  if (attrib) attrib.classList.remove('maplibregl-compact-show');
  if (pano) etiquetas(false);   // los nombres de las calles no van sobre la foto
  else vistaGeneral(0);

  // ciudad dibujada + proyecciones + registros en las fachadas (Three.js).
  // Si algo falla, quedan los volúmenes simples de MapLibre y la experiencia sigue.
  try {
    const THREE = await import('https://unpkg.com/three@0.169.0/build/three.module.js');
    try {
      const { crearCiudad } = await import('./ciudad.js');
      crear3D = { THREE, crearCiudad };
      // la ciudad de la panorámica (otros edificios, 3,5 km al oeste) se arma en paralelo y no demora el inicio
      if (pano) armarCiudadPano(pano);
      ciudad = await crearCiudad(THREE, {
        url: 'edificios.json', local: aLocal, sol: { azimut: 235, elevacion: 14 },
        vistas: VISTAS, alturas: CAL.alturas, repintar: () => map.triggerRepaint(),
      });
      map.setLayoutProperty('edificios-3d', 'visibility', 'none');
      window.__ciudad = ciudad; // para depurar desde la consola
    } catch (e) { console.warn('No se pudo armar la ciudad 3D', e); }
    capaRegistros = crearCapaRegistros(THREE);
    map.addLayer(capaRegistros, 'ruta-base'); // la línea del recorrido queda sobre el piso dibujado
  } catch (e) { console.warn('No se pudieron cargar los registros 3D', e); }
  // los estilos se aplican a la ciudad del recorrido y a la de la panorámica (si ya está)
  const ambas = { setEstilo: (est) => { if (ciudad) ciudad.setEstilo(est); if (pano && pano.ciudad) pano.ciudad.setEstilo(est); } };
  try { estilos = iniciarEstilos(map, ambas); } catch (e) { console.warn('No se pudieron armar los estilos', e); }

  const btn = $('#comenzar');
  btn.disabled = false;
  btn.textContent = 'Comenzar';
});
map.on('error', (e) => console.warn('mapa:', e && e.error));

function gradiente(p) {
  p = Math.min(0.99999, Math.max(0.00001, p));
  return ['step', ['line-progress'], COLOR, p, 'rgba(0,0,0,0)'];
}

// ── capa Three.js: cuadros con los registros sobre las fachadas ──
function crearCapaRegistros(THREE) {
  const O = ORIGEN, s = ESCALA;
  // coordenadas locales en metros: x = este, y = norte, z = arriba
  const local = (p) => aLocal([p.lng, p.lat]);
  const camara = new THREE.Camera();
  const escena = new THREE.Scene();
  if (ciudad) escena.add(ciudad.grupo);
  const cargador = new THREE.TextureLoader();
  let renderer;

  const cuadros = MIRADAS.map((m) => {
    const grupo = new THREE.Group();
    const [x, y] = local(m.c);
    grupo.position.set(x, y, m.zc);
    grupo.rotation.z = -((m.rumbo || 0) - 180) * RAD;
    escena.add(grupo);

    const plano = (w, h) => new THREE.PlaneGeometry(w, h).rotateX(Math.PI / 2);
    // resplandor detrás del cuadro
    const halo = new THREE.Mesh(plano(m.ancho + 1.6, m.alto + 1.6), new THREE.MeshBasicMaterial({
      map: texturaHalo(THREE), color: COLOR, transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    }));
    halo.position.y = 0.05;
    grupo.add(halo);

    // imágenes (o un cuadro "material pendiente")
    const texturas = m.imagenes.length ? m.imagenes.map((src) => {
      const tx = cargador.load(src, () => map.triggerRepaint());
      tx.colorSpace = THREE.SRGBColorSpace;
      tx.anisotropy = 4;
      return tx;
    }) : [texturaPendiente(THREE, m)];
    const capas = texturas.map((tx, i) => {
      const mesh = new THREE.Mesh(plano(m.ancho, m.alto), new THREE.MeshBasicMaterial({
        map: tx, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: i === 0,
      }));
      mesh.position.y = -0.01 * i;
      grupo.add(mesh);
      return mesh;
    });

    // marco fino
    const w = m.ancho / 2 + 0.12, h = m.alto / 2 + 0.12;
    const marco = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints([[-w, -h], [w, -h], [w, h], [-w, h]].map(([a, b]) => new THREE.Vector3(a, -0.02, b))),
      new THREE.LineBasicMaterial({ color: COLOR, transparent: true, opacity: 0 }));
    grupo.add(marco);

    return { m, halo, capas, marco, centro: new THREE.Vector3(x, y, m.zc) };
  });
  const camPos = new THREE.Vector3(), camH = new THREE.Vector4(), inversa = new THREE.Matrix4();
  window.__camPos = camPos; // para depurar: posición real de la cámara, en metros locales
  // opacidades finales de los cuadros: las de actualizar() × lo que pide el estilo
  function opacidadesCuadros() {
    const est = estilos ? estilos.actual : null, cfg = (est && est.cuadros) || { k: 1 };
    for (const c of cuadros) {
      const k = cfg.k * (cfg.cerca ? suave(clamp((58 - c.centro.distanceTo(camPos)) / 38, 0, 1)) : 1);
      for (const o of [...c.capas, c.halo, c.marco]) {
        o.material.opacity = (o.userData.op || 0) * k;
        o.visible = o.material.opacity > 0.001;
        if (o.material.map && o !== c.halo) o.material.color.setRGB(...(cfg.tinte || [1, 1, 1]));
      }
    }
  }

  let modoActual = 'general', tActualCapa = 0;

  return {
    id: 'registros', type: 'custom', renderingMode: '3d', escena, camPos,
    onAdd(mapa, gl) {
      renderer = new THREE.WebGLRenderer({ canvas: mapa.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
    },
    render(gl, args) {
      const mat = new THREE.Matrix4().fromArray(args.defaultProjectionData.mainMatrix);
      const l = new THREE.Matrix4().makeTranslation(O.x, O.y, O.z).scale(new THREE.Vector3(s, -s, s));
      camara.projectionMatrix = mat.multiply(l);
      // posición de la cámara en metros locales: el punto que la proyección manda a (0, 0, z, 0)
      camH.set(0, 0, 1, 0).applyMatrix4(inversa.copy(camara.projectionMatrix).invert());
      if (Math.abs(camH.w) > 1e-12) camPos.set(camH.x / camH.w, camH.y / camH.w, camH.z / camH.w);
      const ciudades = [ciudad, pano && pano.ciudad].filter(Boolean);
      for (const c of ciudades) { c.setCamara(camPos.x, camPos.y, camPos.z); c.setTiempo((performance.now() / 1000) % 3600); }
      opacidadesCuadros();
      renderer.resetState();
      renderer.setViewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      for (const c of ciudades) c.prepasar(renderer, gl.drawingBufferWidth, gl.drawingBufferHeight);
      renderer.render(escena, camara);
      // la panorámica ya está proyectada: se deja ver el 3D (desde el punto de vista calza con la foto fija)
      if (pano && pano.ciudad && !pano.listo && pano.ciudad.ranuras()[0] && ++pano.cuadros > 3 && map.areTilesLoaded()) {
        pano.listo = performance.now();
        document.body.classList.add('pano-lista');
      }
      if (estilos && estilos.actual.animado) map.triggerRepaint();
    },
    // opacidades según el momento del audio y el modo de vista
    actualizar(t, modo) {
      if (t === tActualCapa && modo === modoActual) return;
      tActualCapa = t; modoActual = modo;
      for (const c of cuadros) {
        const { m } = c;
        const i = intensidad(m, t);
        const visto = t > m.hasta;
        const reposo = modo === 'calle' ? (visto ? 0.35 : 0.0) : (visto ? 0.8 : 0.35);
        const op = reposo + (1 - reposo) * i;
        // fundido entre imágenes durante la mirada
        const n = c.capas.length;
        const tramo = (m.hasta - m.desde) / n;
        const pos = clamp((t - m.desde) / tramo, 0, n - 1);
        const idx = Math.floor(pos);
        const mezcla = n > 1 ? suave(clamp((pos - idx - 0.85) / 0.15, 0, 1)) : 0;
        c.capas.forEach((mesh, j) => {
          let w = j === idx ? 1 : 0;
          if (j === idx + 1) w = mezcla;
          if (visto && j === 0) w = 1; // después, queda la primera imagen como huella
          if (visto && j > 0) w = 0;
          mesh.userData.op = op * w;
        });
        c.marco.userData.op = Math.max(op * 0.9, modo === 'calle' ? 0 : 0.5);
        c.halo.userData.op = 0.55 * i;
      }
      map.triggerRepaint();
    },
  };
}

function texturaHalo(THREE) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 10, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(cv);
}

function texturaPendiente(THREE, m) {
  const W = 1024, H = Math.round((W * m.alto) / m.ancho);
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.fillStyle = '#e4e3e0';   // papel del flyer
  g.fillRect(0, 0, W, H);
  // grano
  const img = g.getImageData(0, 0, W, H);
  for (let i = 0; i < img.data.length; i += 4) {
    const r = (Math.random() - 0.5) * 18;
    img.data[i] += r; img.data[i + 1] += r; img.data[i + 2] += r;
  }
  g.putImageData(img, 0, 0);
  // trama diagonal
  g.strokeStyle = 'rgba(104,82,54,0.08)';
  g.lineWidth = 2;
  for (let x = -H; x < W; x += 28) { g.beginPath(); g.moveTo(x, H); g.lineTo(x + H, 0); g.stroke(); }
  g.strokeStyle = COLOR;
  g.lineWidth = 3;
  g.strokeRect(24, 24, W - 48, H - 48);
  g.textAlign = 'center';
  g.fillStyle = '#111111';
  g.font = '400 96px "Barlow Condensed", "Arial Narrow", sans-serif';
  g.fillText(m.lugar || '', W / 2, H / 2 - 10);
  g.fillStyle = COLOR;
  g.font = '500 40px "Barlow Semi Condensed", "Arial Narrow", sans-serif';
  g.fillText((m.tipo || '').toLowerCase(), W / 2, H / 2 + 56);
  const tx = new THREE.CanvasTexture(cv);
  tx.colorSpace = THREE.SRGBColorSpace;
  return tx;
}

// ── estado de la experiencia ───────────────────────
let iniciado = false;
let modo = 'general';          // 'calle' | 'aerea' | 'general'
let seguir = true;             // en vista aérea: la cámara acompaña
let enTransicion = false;
let arrastrando = false;
let tPrevia = 0;
let camRumbo = K[0].rumbo, camPitch = PITCH_CALLE;
let mirarYaw = 0, mirarPitch = 0, ultimoToque = 0;
let orbita = 0;
let ultimoP = -1;
let ultimoCuadro = performance.now();
let terminado = false;

const elEstado = $('#estado');
const elNota = $('#nota');
const elPie = $('#pie');
const rango = $('#rango');
const btnPlay = $('#play');
const btnSeguir = $('#seguir');

function altoPanel() {
  const h = $('#panel').hidden ? 0 : $('#panel').offsetHeight;
  document.documentElement.style.setProperty('--alto-panel', h + 'px');
  return h;
}
const SIN_RELLENO = { top: 0, bottom: 0, left: 0, right: 0 };
const rellenoAereo = () => ({ top: window.innerHeight * 0.28, bottom: altoPanel(), left: 0, right: 0 });
const tActual = () => (arrastrando ? tPrevia : audio.currentTime || 0);

function vistaGeneral(dur = 1600) {
  map.fitBounds(bounds, {
    padding: { top: 90, bottom: altoPanel() + 60, left: 40, right: 40 },
    pitch: 55, bearing: -25, duration: dur,
  });
}

// La cámara en vuelo no atraviesa edificios: si su trayecto pasa por un volumen (o a menos de 4 m), sube por encima
// del techo con 1,5 m de margen, como un dron que pasa sobre la cuadra y baja del otro lado. Cerca de los extremos
// del viaje (los ojos del caminante y cada punto de vista, que están en la vereda pegados a las fachadas) el
// margen suave se apaga para llegar exacto; dentro de un volumen, nunca. Sube al instante y baja suave.
// Devuelve cuántos metros hay que sumarle a la altura de la cámara.
let elevVuelo = 0, tElev = 0;
function esquivarEdificios(c, ojos, vu) {
  const ahora = performance.now() / 1000, dt = Math.min(0.1, ahora - tElev);
  tElev = ahora;
  if (!ciudad || !ciudad.alturaCerca) return 0;
  const extremos = [ojos, ...vu.p.vistas.map((v) => v.pos)];
  const dMin = Math.min(...extremos.map((p) => Math.hypot(c[0] - p[0], c[1] - p[1])));
  const adentro = ciudad.alturaCerca(c[0], c[1], 0);
  const cerca = ciudad.alturaCerca(c[0], c[1], 4) * suave(clamp((dMin - 1) / 4, 0, 1));
  const techo = Math.max(adentro, cerca);
  const falta = techo > 0 ? Math.max(0, techo + 1.5 - c[2]) : 0;
  elevVuelo = Math.max(falta, elevVuelo * Math.exp(-dt * 2.5));
  return elevVuelo;
}
function camaraCalle(e, rumboCam, pitchCam, vu) {
  const fase = (e.d / PASO) * Math.PI;
  const andando = e.caminando && iniciado;
  const alt = OJO + (andando ? 0.035 * Math.abs(Math.sin(fase)) : 0);
  const roll = andando ? 0.35 * Math.sin(fase) : 0;
  if (!vu || vu.w <= 0) {
    elevVuelo = 0;
    return { ...map.calculateCameraOptionsFromCameraLngLatAltRotation([e.lng, e.lat], alt, rumboCam, pitchCam, roll), padding: SIN_RELLENO };
  }
  // viaje directo de los ojos del caminante al punto de vista de la imagen (sin rodeos: un paso al costado,
  // un cruce de calle o una subida), siempre apuntando al lugar. Si el punto de vista está alto (dron), primero
  // sube en vertical y recién después se desplaza; a la vuelta, al revés (nunca atraviesa los edificios de la vereda).
  const [x, y] = aLocal([e.lng, e.lat]);
  const T = vu.T, w = vu.w;
  const V = desdePolar(T, vu.polarV.th, vu.polarV.r, vu.polarV.z);
  const alto = V[2] - alt > 3;
  const wz = alto ? suave(clamp(w / 0.55, 0, 1)) : w;
  const wh = alto ? suave(clamp((w - 0.3) / 0.7, 0, 1)) : w;
  let c = [x + (V[0] - x) * wh, y + (V[1] - y) * wh, alt + (V[2] - alt) * wz];
  // la cabeza ya venía girando hacia el lugar (ANTICIPA): el resto del giro se reparte en la primera mitad del viaje
  const fv = suave(clamp(w / 0.5, 0, 1));
  // DOLLY ZOOM hacia las vistas isométricas: en la segunda mitad del viaje la cámara se aleja del lugar por la misma
  // línea (la dirección de la mirada no cambia) y el campo de visión se cierra en la misma proporción. El lugar
  // conserva su tamaño en pantalla mientras la perspectiva se aplana hasta volverse isometría: la ciudad se vuelve
  // maqueta justo cuando el diorama se recompone. g = 1 en las vistas comunes.
  const g = Math.exp((vu.lnIso || 0) * suave(clamp((w - 0.45) / 0.55, 0, 1)));
  if (g > 1.0001) c = c.map((v, i) => T[i] + (v - T[i]) * g);
  c[2] += esquivarEdificios(c, [x, y], vu);
  const L = mirarA(c, T);
  const fc = fovCalle(), fovEq = fc + (vu.fov - fc) * w;
  const fov = (2 * Math.atan(Math.tan((fovEq / 2) * RAD) / g)) / RAD;
  if (Math.abs(map.getVerticalFieldOfView() - fov) > 0.001) map.setVerticalFieldOfView(fov);
  // al llegar, la cámara mira por el eje de la foto (MapLibre: pitch entre 0 y PITCH_CALLE; un pitch negativo lo
  // recorta DESPUÉS de ubicar la cámara y la corre del punto de vista). El centrado lo hace el padding.
  const pitchObj = clamp(L.alto + vu.dP, 0, PITCH_CALLE);
  const o = (vu.yp - 0.5) * window.innerHeight * w;
  return {
    ...map.calculateCameraOptionsFromCameraLngLatAltRotation(aLngLat(c[0], c[1]), c[2],
      rumboCam + difAng(rumboCam, L.rumbo + vu.dR) * fv, Math.max(0, pitchCam + (pitchObj - pitchCam) * fv), roll * (1 - w) + vu.giro * w),
    padding: { top: Math.max(0, 2 * o), bottom: Math.max(0, -2 * o), left: 0, right: 0 },
  };
}

let etiquetasVisibles = true;
function etiquetas(ver) {
  etiquetasVisibles = ver;
  for (const l of map.getStyle().layers) {
    if (l.type !== 'symbol') continue;
    const fijo = /oneway/.test(l.id); // flechas de sentido: demasiados íconos, nunca se muestran
    map.setLayoutProperty(l.id, 'visibility', ver && !fijo ? 'visible' : 'none');
  }
}

function transicion(fn) {
  enTransicion = true;
  fn();
  map.once('moveend', () => (enTransicion = false));
}

function manejadores(on) {
  ['dragPan', 'dragRotate', 'scrollZoom', 'touchZoomRotate', 'touchPitch', 'keyboard', 'doubleClickZoom', 'boxZoom']
    .forEach((h) => map[h] && (on ? map[h].enable() : map[h].disable()));
}

function setModo(nuevo, { dur } = {}) {
  modo = nuevo;
  document.body.classList.toggle('modo-calle', modo === 'calle');
  manejadores(modo !== 'calle');
  // en la vereda: campo de visión amplio y sin etiquetas (a ras del piso se amontonan)
  // al bajar a la vereda el campo de visión cambia de golpe; al subir, de a poco en el bucle
  // (un cambio brusco a ras del piso hace fallar a MapLibre)
  if (modo === 'calle') map.setVerticalFieldOfView(fovCalle());
  if (modo === 'calle') etiquetas(false); // se vuelven a mostrar en el bucle, cuando la cámara ya subió
  elCaminante.style.display = modo === 'calle' ? 'none' : '';
  elCaminante.style.opacity = '';
  btnSeguir.hidden = true;
  seguir = true;
  const e = estado(tActual());
  if (modo === 'calle') {
    camRumbo = e.rumbo; camPitch = PITCH_CALLE; mirarYaw = mirarPitch = 0;
    transicion(() => map.flyTo({ ...camaraCalle(e, camRumbo, camPitch), duration: dur ?? 2600, essential: true }));
  } else if (modo === 'aerea') {
    camRumbo = e.rumbo; orbita = 0;
    transicion(() => map.easeTo({ center: [e.lng, e.lat], zoom: 17.7, pitch: 62, roll: 0, bearing: camRumbo, padding: rellenoAereo(), duration: dur ?? 1800 }));
  } else {
    transicion(() => {
      map.easeTo({ roll: 0, padding: SIN_RELLENO, duration: 0 });
      vistaGeneral(dur ?? 1800);
    });
  }
}

// interacción manual en vista aérea → deja de seguir
['dragstart', 'rotatestart', 'pitchstart', 'zoomstart'].forEach((ev) =>
  map.on(ev, (e) => {
    if (e.originalEvent && iniciado && modo === 'aerea' && seguir) { seguir = false; btnSeguir.hidden = false; }
  }));

// en vista de calle: arrastrar = mirar alrededor (la mirada vuelve sola al soltar)
(() => {
  const el = map.getCanvasContainer();
  let ini = null;
  el.addEventListener('pointerdown', (ev) => { if (modo === 'calle') ini = { x: ev.clientX, y: ev.clientY, yaw: mirarYaw, pitch: mirarPitch }; });
  window.addEventListener('pointermove', (ev) => {
    if (!ini || modo !== 'calle') return;
    mirarYaw = ini.yaw - (ev.clientX - ini.x) * 0.25;
    mirarPitch = clamp(ini.pitch - (ev.clientY - ini.y) * 0.15, -25, 0);
    ultimoToque = performance.now();
  });
  window.addEventListener('pointerup', () => { if (ini) ultimoToque = performance.now(); ini = null; });
})();

// ── panorámica del inicio ──────────────────────────
// La cámara queda en el punto de vista del dron, con el campo de visión justo para que la foto cubra la pantalla.
// Con la pantalla vertical gira despacio de un lado a otro (sin moverse de lugar, así la imagen sigue entera).
let encuadrePanoCache = null;
function encuadreActual() {
  const W = window.innerWidth, H = window.innerHeight;
  if (!encuadrePanoCache || encuadrePanoCache.W !== W || encuadrePanoCache.H !== H)
    encuadrePanoCache = { W, H, ...encuadrePano(W, H, PITCH_CALLE) };
  return encuadrePanoCache;
}
function camaraPano(ahora) {
  const e = encuadreActual(), v = pano.vuelta, P = pano.vista.pos;
  // progreso del vuelo de vuelta (1 = ya en el dron, o nunca hubo vuelo)
  let f = 1;
  if (v && !v.llega) { f = clamp((ahora - v.ini) / 1000 / VUELTA_SEG, 0, 1); if (f >= 1) v.llega = ahora; }
  // el paneo arranca centrado: al aparecer la proyección (donde está la foto fija) o al llegar el vuelo
  const desde = v ? v.llega : pano.listo;
  const s = desde ? (ahora - desde) / 1000 : 0;
  const desvio = QUIETA ? 0 : e.paneo * Math.sin((2 * Math.PI * s) / PANEO_SEG);
  let pos = P, rumboCam = pano.vista.rumbo + desvio, pitch = PITCH_CALLE, fov = e.fov;
  if (f < 1) {
    // sube primero en vertical (en la vereda hay edificios pegados), cruza alto y baja hasta el dron
    const a = v.desde, wh = suave(clamp((f - 0.12) / 0.88, 0, 1));
    const sube = suave(clamp(f / 0.4, 0, 1)), baja = suave(clamp((f - 0.6) / 0.4, 0, 1));
    const cima = Math.max(VUELTA_ALTO, a.pos[2]);
    pos = [a.pos[0] + (P[0] - a.pos[0]) * wh, a.pos[1] + (P[1] - a.pos[1]) * wh, a.pos[2] + (cima - a.pos[2]) * sube + (P[2] - cima) * baja];
    rumboCam = a.rumbo + difAng(a.rumbo, pano.vista.rumbo) * wh;
    pitch = a.pitch + (PITCH_CALLE - a.pitch) * wh;
    fov = a.fov + (e.fov - a.fov) * wh;
  }
  if (Math.abs(map.getVerticalFieldOfView() - fov) > 0.01) map.setVerticalFieldOfView(fov);
  map.jumpTo({ ...map.calculateCameraOptionsFromCameraLngLatAltRotation(aLngLat(pos[0], pos[1]), pos[2],
    rumboCam, pitch, 0), padding: SIN_RELLENO });
}
// arma la ciudad de la panorámica para el estado `est` (al cargar la página, y otra vez al terminar el recorrido)
function armarCiudadPano(est) {
  if (!crear3D) return;
  crear3D.crearCiudad(crear3D.THREE, {
    url: PANO.edificios, local: aLocal, sol: PANO.sol, vistas: [est.vista], telon: telonDe(est.vista),
    repintar: () => map.triggerRepaint(),
  }).then((c) => {
    if (pano !== est || est.apagando) return c.liberar();   // ya se comenzó antes de que terminara de cargar
    c.setRadio(1700, 2700);
    c.uniforms.uFoco.value.set(est.vista.pos[0] - 60, est.vista.pos[1] + 1100);
    if (estilos) c.setEstilo(estilos.actual);
    est.ciudad = c;
    const sumar = () => (capaRegistros ? capaRegistros.escena.add(c.grupo) : setTimeout(sumar, 100));
    sumar();
    map.triggerRepaint();
  }).catch((e) => { console.warn('No se pudo armar la panorámica 3D', e); });
}
// final del recorrido: la cámara vuela de vuelta al dron y la panorámica se recompone
function volverAPano() {
  // posición actual de la cámara en metros locales (la de MapLibre, o la que calcula la capa 3D en cada cuadro)
  let pos;
  try { const ll = map.transform.getCameraLngLat(); pos = [...aLocal([ll.lng, ll.lat]), map.transform.getCameraAltitude()]; }
  catch (e) { pos = capaRegistros ? capaRegistros.camPos.toArray() : [...aLocal(map.getCenter().toArray()), 300]; }
  pano = nuevoPano();
  pano.vuelta = { ini: performance.now(), llega: 0,
    desde: { pos, rumbo: map.getBearing(), pitch: map.getPitch(), fov: map.getVerticalFieldOfView() } };
  map.stop();
  modo = 'general';   // sin setModo: la cámara la maneja camaraPano (al volver a empezar, setModo restituye todo)
  document.body.classList.remove('modo-calle');
  manejadores(false);
  etiquetas(false);
  elCaminante.style.display = 'none';
  btnSeguir.hidden = true;
  document.body.classList.add('pano-final');
  armarCiudadPano(pano);
}
// se apaga la proyección (y la cámara queda libre para bajar a la vereda)
function salirDePano() {
  if (!pano || pano.apagando) return false;
  pano.apagando = performance.now();
  document.body.classList.add('pano-fuera');
  document.body.classList.remove('pano-final');
  return true;
}
const panoActiva = () => pano && !pano.apagando;
// foto fija mientras carga el 3D, ubicada exactamente donde la va a dibujar la proyección
function ubicarFotoPano() {
  const el = $('#pano-foto');
  if (!el) return;
  const f = encuadreActual().foto;
  Object.assign(el.style, { width: `${f.ancho}px`, height: `${f.alto}px`, left: `${f.x}px`, top: `${f.y}px` });
}
// intensidad de la proyección; al comenzar se apaga y después se suelta la memoria
function panoCuadro(ahora) {
  const s = pano.apagando ? (ahora - pano.apagando) / 1000 : 0;
  // en la vuelta, la imagen aparece en el último tramo del vuelo
  const v = pano.vuelta;
  const entra = v && !v.llega ? suave(clamp(((ahora - v.ini) / 1000 / VUELTA_SEG - 0.55) / 0.45, 0, 1)) : 1;
  if (pano.ciudad) pano.ciudad.setIntensidades([entra * (1 - suave(clamp(s / PANO_APAGA, 0, 1)))]);
  if (s > PANO_APAGA + 0.5) {
    if (pano.ciudad) {
      if (capaRegistros) capaRegistros.escena.remove(pano.ciudad.grupo);
      pano.ciudad.liberar();
    }
    pano = null;
    const el = $('#pano-foto');
    if (el) el.remove();
    map.triggerRepaint();
  }
}

// ── bucle de animación ─────────────────────────────
function cuadro(ahora) {
  const dt = Math.min(0.1, (ahora - ultimoCuadro) / 1000);
  ultimoCuadro = ahora;

  if (map.isStyleLoaded()) {
    const t = tActual();
    const e = estado(t);
    const mir = miradaEn(t);
    const vu = iniciado ? vuelo(t) : null;
    const at = iniciado ? atencion(t, vu) : null;

    marcador.setLngLat([e.lng, e.lat]);
    elCaminante.classList.toggle('quieto', e.pausa);
    elEstado.classList.toggle('en-pausa', e.pausa && iniciado);
    if (e.nota) elNota.textContent = e.nota;
    elNota.classList.toggle('visible', !!e.nota && iniciado && !mir && !vu && !panoActiva());

    // pie del registro
    if (vu && (modo !== 'calle' || vu.w > 0.4)) {
      $('#pie-lugar').textContent = vu.p.lugar || '';
      $('#pie-tipo').textContent = (vu.p.vistas[vu.k] || {}).tipo || vu.p.tipo || '';   // la vista dominante
      const n = vu.p.vistas.length;
      $('#pie-n').textContent = n > 1 ? `punto de vista ${vu.k + 1} / ${n}` : '';
      elPie.classList.add('visible');
    } else if (mir && mir.i > 0.5 && iniciado) {
      const m = mir.m;
      $('#pie-lugar').textContent = m.lugar || '';
      $('#pie-tipo').textContent = m.tipo || '';
      const n = m.imagenes.length;
      $('#pie-n').textContent = n > 1 ? `${Math.min(n, 1 + Math.floor(((t - m.desde) / (m.hasta - m.desde)) * n))} / ${n}` : '';
      elPie.classList.add('visible');
    } else elPie.classList.remove('visible');
    if (panoActiva()) elPie.classList.remove('visible');   // sobre la panorámica del final, sin pie

    const p = e.d / LARGO;
    if (Math.abs(p - ultimoP) > 0.0002 && map.getLayer('ruta-hecha')) {
      map.setPaintProperty('ruta-hecha', 'line-gradient', gradiente(p));
      ultimoP = p;
    }
    if (capaRegistros) capaRegistros.actualizar(t, iniciado ? modo : 'general');
    if (ciudad) {
      const [cx, cy] = aLocal([e.lng, e.lat]);
      ciudad.setCaminante(cx, cy, modo === 'calle' && iniciado ? 1 - (vu ? vu.w : 0) * 0.6 : 0.5);
      if (modo === 'general' || !iniciado) { const [gx, gy] = aLocal(bounds.getCenter().toArray()); ciudad.uniforms.uFoco.value.set(gx, gy); ciudad.setRadio(420, 720); }
      else ciudad.setRadio(260, 540);
      if (at && at.length && modo === 'calle') { // la ciudad se revela también alrededor del lugar mirado
        let fx = cx, fy = cy;
        for (const { a, T } of at) { const f = 0.5 * a + 0.5 * (vu ? vu.w : 0); fx += (T[0] - fx) * f; fy += (T[1] - fy) * f; }
        ciudad.uniforms.uFoco.value.set(fx, fy);
      }
      // piso propio y opaco en la vereda (tapa las calles de MapLibre, que a ras del piso titilan al cambiar de tiles)
      ciudad.setSuelo(modo === 'calle' && iniciado ? 1 : 0, dt);
      const { arr, ola } = intensidades(t);
      ciudad.setIntensidades(arr, ola);
    }
    if (modo === 'calle') {
      // el caminante se ve sólo durante el viaje y sólo si el punto de vista es alto (dron, dioramas), para no
      // perderlo de vista desde arriba. Con fotos tomadas desde la vereda la cámara viaja a ras del piso y el
      // caminante queda en cuadro sobre la imagen (p. ej. Cuban Cigars, justo enfrente): ahí no se muestra.
      // Al llegar al punto de vista se desvanece.
      const op = vu ? clamp((vu.w - 0.3) / 0.1, 0, 1) * clamp((0.97 - vu.w) / 0.2, 0, 1) * clamp((vu.polarV.z - 5) / 10, 0, 1) : 0;
      elCaminante.style.display = op > 0 ? '' : 'none';
      elCaminante.style.opacity = op;
    }
    if (modo !== 'calle' && !enTransicion && !map.isMoving() && !panoActiva()) {
      const fov = map.getVerticalFieldOfView();
      if (Math.abs(fov - FOV_MAPA) > 0.05) map.setVerticalFieldOfView(fov + (FOV_MAPA - fov) * (1 - Math.exp(-dt * 2.5)));
    }
    if (!etiquetasVisibles && modo !== 'calle' && !enTransicion && !map.isMoving() && map.getPitch() < 70 && !panoActiva()) etiquetas(true);

    const k = 1 - Math.exp(-dt * 1.6);
    if (pano) panoCuadro(ahora);
    if (panoActiva()) camaraPano(ahora);
    else if (!iniciado || (modo === 'general' && terminado)) {
      if (!map.isMoving()) map.setBearing(map.getBearing() + dt * 2.5);
    } else if (!enTransicion && modo === 'calle') {
      // hacia dónde mira: adelante, o la fachada del registro, o alrededor durante la escucha
      let objR = e.rumbo, objP = PITCH_CALLE;
      if (mir) {
        const dist = metros(e, mir.m.c);
        const rM = rumbo(e, mir.m.c);
        const pM = Math.min(PITCH_CALLE, 90 + Math.atan2(mir.m.zc - OJO, dist) / RAD);
        objR = e.rumbo + difAng(e.rumbo, rM) * mir.i;
        objP = PITCH_CALLE + (pM - PITCH_CALLE) * mir.i;
      } else if (e.pausa) {
        objR = e.rumbo + 38 * Math.sin(e.tPausa * 0.22);
        objP = PITCH_CALLE + 3 * Math.sin(e.tPausa * 0.13);
      }
      for (const { a, T } of at || []) { // la cabeza se va girando hacia el lugar de enfrente que se va a revelar
        const L = mirarA([...aLocal([e.lng, e.lat]), OJO], T);
        objR += difAng(objR, L.rumbo) * a;
        objP += (L.pitch - objP) * a;
      }
      if (performance.now() - ultimoToque > 2500) {
        mirarYaw *= Math.exp(-dt * 0.9);
        mirarPitch *= Math.exp(-dt * 0.9);
      }
      camRumbo += difAng(camRumbo, objR + mirarYaw) * k;
      camPitch += (clamp(objP + mirarPitch, 55, PITCH_CALLE) - camPitch) * k;
      if (!vu && Math.abs(map.getVerticalFieldOfView() - fovCalle()) > 0.01) map.setVerticalFieldOfView(fovCalle());
      map.jumpTo(camaraCalle(e, camRumbo, camPitch, vu));
    } else if (!enTransicion && modo === 'aerea' && seguir) {
      if (e.pausa && !audio.paused) orbita += dt * 7;
      else orbita *= Math.exp(-dt * 0.8);
      camRumbo += difAng(camRumbo, e.rumbo + orbita) * k;
      map.jumpTo({ center: [e.lng, e.lat], bearing: camRumbo, padding: rellenoAereo() });
    }

    if (!arrastrando) {
      const d = duracion();
      rango.value = (t / d) * 1000;
      rango.style.setProperty('--p', (t / d) * 100 + '%');
    }
    if (terminado && t < duracion() - 1) ocultarFin();
  }
  requestAnimationFrame(cuadro);
}
// arranque de la panorámica (acá, cuando ya están definidas todas las constantes que usa)
if (pano) {
  document.body.classList.add('con-pano');
  ubicarFotoPano();
  addEventListener('resize', ubicarFotoPano);
  camaraPano(performance.now());
} else {
  const el = document.getElementById('pano-foto');
  if (el) el.remove();
}
requestAnimationFrame(cuadro);

// ── comenzar ───────────────────────────────────────
let wakeLock = null;
async function mantenerPantalla() {
  try { if ('wakeLock' in navigator && !wakeLock) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) {}
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !audio.paused) { wakeLock = null; mantenerPantalla(); }
});

$('#comenzar').addEventListener('click', () => {
  // ?t=4:00 → empezar en ese momento del audio (lo usa "Probar en la página" de calibrar.html)
  // ?lugar=Tower Theater → 22 s antes del travelling de ese lugar (lo usa "Probar en la página" de calibrar.html)
  const tramo = PARAMS.get('lugar') && PROYS.find((p) => p.lugar === PARAMS.get('lugar'));
  if (PARAMS.get('t') || tramo) {
    const t0 = tramo ? Math.max(0, tramo.desde - 22) : aSeg(PARAMS.get('t'));
    if (audio.readyState >= 1) audio.currentTime = t0;
    else audio.addEventListener('loadedmetadata', () => (audio.currentTime = t0), { once: true });
  }
  play();
  iniciado = true;
  $('#inicio').classList.add('oculto');
  $('#panel').hidden = false;
  altoPanel();
  // descenso a la vereda (desde el dron de la panorámica, un vuelo más largo)
  setModo(VISTA, { dur: salirDePano() ? 6500 : 4200 });
  setTimeout(() => $('#inicio').remove(), 900);
});

// ── controles ──────────────────────────────────────
function play() {
  btnPlay.classList.add('cargando');
  audio.play().catch((e) => { btnPlay.classList.remove('cargando'); console.warn(e); });
  mantenerPantalla();
}
function ir(t) {
  t = Math.max(0, Math.min(duracion() - 0.1, t));
  audio.currentTime = t;
  if (modo !== 'calle' && !(modo === 'aerea' && seguir) && !panoActiva()) {
    const e = estado(t);
    map.easeTo({ center: [e.lng, e.lat], duration: 800 });
  }
}

btnPlay.addEventListener('click', () => (audio.paused ? play() : audio.pause()));
const tiemposPuntos = R.puntos.map((p) => aSeg(p.t));
$('#siguiente').addEventListener('click', () => {
  const t = tiemposPuntos.find((x) => x > audio.currentTime + 0.5);
  if (t != null) ir(t);
});
$('#anterior').addEventListener('click', () => {
  const t = [...tiemposPuntos].reverse().find((x) => x < audio.currentTime - 2);
  ir(t != null ? t : 0);
});
btnSeguir.addEventListener('click', () => setModo('aerea'));

rango.addEventListener('input', () => {
  arrastrando = true;
  tPrevia = (rango.value / 1000) * duracion();
  rango.style.setProperty('--p', rango.value / 10 + '%');
});
rango.addEventListener('change', () => {
  audio.currentTime = (rango.value / 1000) * duracion();
  arrastrando = false;
});

audio.addEventListener('playing', () => {
  // si se vuelve a reproducir después del final (play, anterior, la línea de tiempo…), se baja otra vez a la vereda
  // (desde la panorámica, con el mismo vuelo largo que al comenzar)
  if (iniciado && (modo !== VISTA || panoActiva())) { ocultarFin(); setModo(VISTA, { dur: salirDePano() ? 6500 : 3500 }); }
  btnPlay.classList.remove('cargando');
  btnPlay.setAttribute('aria-pressed', 'true');
  btnPlay.setAttribute('aria-label', 'Pausar');
});
audio.addEventListener('waiting', () => btnPlay.classList.add('cargando'));
audio.addEventListener('pause', () => {
  btnPlay.classList.remove('cargando');
  btnPlay.setAttribute('aria-pressed', 'false');
  btnPlay.setAttribute('aria-label', 'Reproducir');
});
audio.addEventListener('loadedmetadata', () => altoPanel());
audio.addEventListener('error', () => console.warn('No se pudo cargar el audio', audio.error));
// final: la cámara vuelve al dron de la panorámica (al editar, se eleva y muestra el recorrido completo)
audio.addEventListener('ended', () => {
  terminado = true;
  $('#fin').classList.add('visible');
  $('#reiniciar').tabIndex = 0;
  if (INICIO_PANO) volverAPano();
  else setModo('general', { dur: 6000 });
});
function ocultarFin() {
  terminado = false;
  $('#fin').classList.remove('visible');
  $('#reiniciar').tabIndex = -1;
}
$('#reiniciar').addEventListener('click', () => {
  ocultarFin();
  audio.currentTime = 0;
  play();
});

// tocar la ruta en el mapa (vistas aérea y mapa) → saltar a ese momento
function tiempoEnRuta(punto) {
  let mejor = null;
  for (let i = 0; i < K.length - 1; i++) {
    const a = map.project([K[i].lng, K[i].lat]);
    const b = map.project([K[i + 1].lng, K[i + 1].lat]);
    const vx = b.x - a.x, vy = b.y - a.y;
    const l2 = vx * vx + vy * vy;
    const u = l2 ? clamp(((punto.x - a.x) * vx + (punto.y - a.y) * vy) / l2, 0, 1) : 0;
    const dist = Math.hypot(a.x + u * vx - punto.x, a.y + u * vy - punto.y);
    if (!mejor || dist < mejor.dist) mejor = { dist, t: K[i].t + u * (K[i + 1].t - K[i].t) };
  }
  return mejor && mejor.dist < 30 ? mejor.t : null;
}

map.on('click', (e) => {
  if (!iniciado) return;
  if (EDITAR) return marcarPunto(e.lngLat);
  if (modo === 'calle') return;
  const t = tiempoEnRuta(e.point);
  if (t != null) ir(t);
});

// ── controles del sistema (pantalla bloqueada, auriculares) ──
if ('mediaSession' in navigator) {
  navigator.mediaSession.metadata = new MediaMetadata({
    title: 'Deriva Calle 8', artist: M ? M.artista : '', album: M ? `${M.titulo}: ${M.subtitulo}` : '',
  });
  const h = (a, f) => { try { navigator.mediaSession.setActionHandler(a, f); } catch (e) {} };
  h('play', play);
  h('pause', () => audio.pause());
  h('seekbackward', () => ir(audio.currentTime - 15));
  h('seekforward', () => ir(audio.currentTime + 15));
  h('seekto', (d) => ir(d.seekTime));
}

window.addEventListener('resize', altoPanel);

// ── modo edición: ?editar ──────────────────────────
const marcados = [];
function marcarPunto(ll) {
  const t = audio.currentTime;
  const m = Math.floor(t / 60), s = (t % 60).toFixed(1).padStart(4, '0');
  marcados.push(`    { t: '${m}:${s}', lat: ${ll.lat.toFixed(6)}, lng: ${ll.lng.toFixed(6)}, nota: '' },`);
  $('#lista-puntos').textContent = marcados.join('\n');
  new maplibregl.Marker({ color: COLOR, scale: 0.6 }).setLngLat(ll).addTo(map);
}
if (EDITAR) {
  document.body.classList.add('editando');
  $('#editor').hidden = false;
  $('#lista-puntos').textContent = 'Reproducí el audio y hacé clic en el mapa en cada esquina o pausa.\n' +
    'Para una pausa: un clic al detenerse y otro al retomar (luego se combinan con "hasta").\n' +
    'Tip: usá la vista Aérea o Mapa para marcar con más precisión.';
  map.getCanvas().style.cursor = 'crosshair';
  $('#copiar').addEventListener('click', () => navigator.clipboard.writeText(marcados.join('\n')));
  $('#borrar').addEventListener('click', () => { marcados.length = 0; $('#lista-puntos').textContent = ''; });
}

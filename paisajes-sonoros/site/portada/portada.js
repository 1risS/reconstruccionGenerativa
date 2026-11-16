// Portada: la panorámica de Little Havana proyectada sobre la ciudad 3D, con la misma lógica anamórfica de la deriva.
// La cámara del dron y el encuadre están en panoramica.js (los comparte con el inicio de la deriva 3D).
//
// Recorrido de la cámara (en bucle): arranca en el punto de vista del dron, donde la imagen está entera (y calza
// con la foto fija que se ve mientras carga); se aparta y la imagen se deshace sobre techos y fachadas; vuelve.
// Lo que de la foto no cae sobre la ciudad (el cielo, el horizonte lejano) cae sobre un telón curvo a 2,75 km.
//
// Usa ciudad.js, camara.js y estilos.js de la deriva 3D.

import { normalizar } from '../deriva-3d/camara.js';
import { iniciarEstilos } from '../deriva-3d/estilos.js';
import { FOTO, telonDe, encuadre as encuadrePanoramica } from './panoramica.js';

const PITCH_MAX = 84;   // más que eso MapLibre dibuja hasta el horizonte y se cuelga
const RAD = Math.PI / 180;
const suave = (x) => x * x * (3 - 2 * x);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, f) => a.map((v, i) => v + (b[i] - v) * f);

const contenedor = document.getElementById('portada');
const foto = contenedor.querySelector('.portada-foto');
const QUIETA = matchMedia('(prefers-reduced-motion: reduce)').matches;

// coordenadas locales en metros (x = este, y = norte) con origen bajo el dron
const ORIGEN = maplibregl.MercatorCoordinate.fromLngLat([FOTO.camara.lng, FOTO.camara.lat], 0);
const ESCALA = ORIGEN.meterInMercatorCoordinateUnits();
const aLocal = ([lng, lat]) => {
  const mc = maplibregl.MercatorCoordinate.fromLngLat([lng, lat], 0);
  return [(mc.x - ORIGEN.x) / ESCALA, -(mc.y - ORIGEN.y) / ESCALA];
};
const aLngLat = (x, y) => new maplibregl.MercatorCoordinate(ORIGEN.x + x * ESCALA, ORIGEN.y - y * ESCALA, 0).toLngLat();

const VISTA = { ...normalizar(FOTO, aLocal), lejos: FOTO.lejos, idx: 0 };

// ── encuadre en el punto de vista ──
// La foto cubre la pantalla entera, y la foto fija de la carga se ubica exactamente donde la va a dibujar el 3D
// (así el paso de una a otra no se nota).
const encuadre = () => encuadrePanoramica(innerWidth, innerHeight, PITCH_MAX);
function ubicarFoto() {
  const e = encuadre().foto;
  Object.assign(foto.style, { width: `${e.ancho}px`, height: `${e.alto}px`, left: `${e.x}px`, top: `${e.y}px` });
}
ubicarFoto();
addEventListener('resize', ubicarFoto);

// ── recorrido de la cámara ──
// Cada pose: posición [x, y, z] y punto mirado. La del dron mira a lo largo de su eje óptico.
const DIR = [Math.sin(VISTA.rumbo * RAD), Math.cos(VISTA.rumbo * RAD)];
const POV = { pos: VISTA.pos, mira: [DIR[0] * 1535, DIR[1] * 1535, 0] };
const POSES = [
  POV,
  { pos: [520, 260, 230], mira: [-60, 1050, 0] },    // se corre al este y sube: la foto se desarma sobre los techos
  { pos: [-180, 820, 70], mira: [-230, 1250, 10] },  // baja entre los edificios altos de Flagler
  { pos: [-620, 380, 190], mira: [-80, 1150, 0] },   // cruza al oeste
  POV,
];
// segundos: quieta en el punto de vista, y cuánto dura cada tramo entre poses
const QUIETO = 9, TRAMOS = [11, 10, 10, 12];
const CICLO = QUIETO + TRAMOS.reduce((a, b) => a + b, 0);

function pose(t) {
  t %= CICLO;
  if (QUIETA || t < QUIETO) return { ...POV, w: 0 };
  t -= QUIETO;
  let k = 0;
  while (k < TRAMOS.length - 1 && t > TRAMOS[k]) t -= TRAMOS[k++];
  const f = suave(clamp(t / TRAMOS[k], 0, 1));
  const a = POSES[k], b = POSES[k + 1];
  // w: cuánto se apartó del punto de vista (para el campo de visión)
  const w = k === 0 ? f : k === TRAMOS.length - 1 ? 1 - f : 1;
  return { pos: lerp(a.pos, b.pos, f), mira: lerp(a.mira, b.mira, f), w };
}

// ── mapa ──
const map = new maplibregl.Map({
  container: 'portada-mapa',
  style: 'https://tiles.openfreemap.org/styles/positron',
  center: aLngLat(POV.mira[0], POV.mira[1]).toArray(),
  zoom: 15, pitch: 80, bearing: VISTA.rumbo,
  maxPitch: 85, maxZoom: 22,
  interactive: false,
  attributionControl: { compact: true },
  canvasContextAttributes: { antialias: true },
});

let ciudad = null, listo = false, t0 = null;

map.on('load', async () => {
  const attrib = document.querySelector('.maplibregl-ctrl-attrib');
  if (attrib) attrib.classList.remove('maplibregl-compact-show');
  for (const l of map.getStyle().layers) if (l.type === 'symbol' || l.id === 'building' || /building/.test(l.id)) map.setLayoutProperty(l.id, 'visibility', 'none');
  const primera = (map.getStyle().layers.find((l) => l.type === 'symbol') || {}).id;
  const filtro = ['all', ['==', ['geometry-type'], 'LineString'],
    ['match', ['get', 'class'], ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service'], true, false]];
  const ancho = (extra) => ['interpolate', ['exponential', 2], ['zoom'], 12, (10 + extra) * 0.058, 24, (10 + extra) * 238];
  map.addLayer({ id: 'veredas', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation', minzoom: 13,
    filter: filtro, paint: { 'line-color': '#c4a096', 'line-width': ancho(7) } }, primera);
  map.addLayer({ id: 'calzadas', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation', minzoom: 13,
    filter: filtro, paint: { 'line-color': '#9c9b98', 'line-width': ancho(0) } }, primera);

  try {
    const THREE = await import('https://unpkg.com/three@0.169.0/build/three.module.js');
    const { crearCiudad } = await import('../deriva-3d/ciudad.js');
    ciudad = await crearCiudad(THREE, {
      url: FOTO.edificios, local: aLocal, sol: FOTO.sol,
      vistas: [VISTA], repintar: () => map.triggerRepaint(),
      telon: telonDe(VISTA),
    });
    ciudad.setRadio(1700, 2700);
    ciudad.uniforms.uFoco.value.set(-60, 1100);
    map.addLayer(capa(THREE));
    iniciarEstilos(map, ciudad, { fijo: 'maqueta' });
  } catch (e) {
    console.warn('No se pudo armar la portada 3D; queda la foto', e);
  }
});

function capa(THREE) {
  const camara = new THREE.Camera(), escena = new THREE.Scene();
  escena.add(ciudad.grupo);
  const camH = new THREE.Vector4(), inversa = new THREE.Matrix4();
  let renderer, cuadros = 0;
  return {
    id: 'portada-3d', type: 'custom', renderingMode: '3d',
    onAdd(mapa, gl) {
      renderer = new THREE.WebGLRenderer({ canvas: mapa.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
    },
    render(gl, args) {
      const mat = new THREE.Matrix4().fromArray(args.defaultProjectionData.mainMatrix);
      const l = new THREE.Matrix4().makeTranslation(ORIGEN.x, ORIGEN.y, ORIGEN.z).scale(new THREE.Vector3(ESCALA, -ESCALA, ESCALA));
      camara.projectionMatrix = mat.multiply(l);
      camH.set(0, 0, 1, 0).applyMatrix4(inversa.copy(camara.projectionMatrix).invert());
      if (Math.abs(camH.w) > 1e-12) ciudad.setCamara(camH.x / camH.w, camH.y / camH.w, camH.z / camH.w);
      renderer.resetState();
      renderer.setViewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      ciudad.prepasar(renderer, gl.drawingBufferWidth, gl.drawingBufferHeight);
      renderer.render(escena, camara);
      // la imagen proyectada ya está: se deja ver el 3D (desde el punto de vista calza con la foto fija)
      if (!listo && ciudad.ranuras()[0] && ++cuadros > 3 && map.areTilesLoaded()) {
        listo = true;
        contenedor.classList.add('lista');
      }
    },
  };
}

function cuadro(ahora) {
  requestAnimationFrame(cuadro);
  if (!map.isStyleLoaded()) return;
  if (ciudad) ciudad.setIntensidades([1]);   // toma la ranura de proyección en cuanto la imagen termina de cargar
  // el reloj del recorrido arranca cuando el 3D terminó de aparecer sobre la foto
  if (listo && t0 == null) t0 = ahora + 2500;
  const t = t0 == null ? 0 : Math.max(0, ahora - t0) / 1000;
  const p = pose(t);
  const e = encuadre();
  const fov = e.fov + (52 - e.fov) * suave(clamp(p.w, 0, 1));
  if (Math.abs(map.getVerticalFieldOfView() - fov) > 0.01) map.setVerticalFieldOfView(fov);
  let rumbo, pitch;
  if (p.w <= 0) { rumbo = VISTA.rumbo; pitch = Math.min(PITCH_MAX, 90 - VISTA.cabeceo); }
  else {
    const dx = p.mira[0] - p.pos[0], dy = p.mira[1] - p.pos[1];
    rumbo = Math.atan2(dx, dy) / RAD;
    pitch = Math.min(PITCH_MAX, 90 - Math.atan2(p.pos[2] - p.mira[2], Math.hypot(dx, dy)) / RAD);
  }
  map.jumpTo(map.calculateCameraOptionsFromCameraLngLatAltRotation(aLngLat(p.pos[0], p.pos[1]), p.pos[2], rumbo, pitch, 0));
}
requestAnimationFrame(cuadro);

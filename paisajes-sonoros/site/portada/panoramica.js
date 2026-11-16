// La panorámica de Little Havana: datos de la cámara y encuadre. La usan la portada (portada.js) y la pantalla
// de inicio de la deriva 3D (deriva-3d/mapa.js).
//
// La foto se tomó con un dron sobre Calle 8 y SW 37 Av. (Douglas Rd.), el borde oeste de Little Havana, a 118 m
// de altura y mirando al norte, hacia Flagler y el Magic City Casino. Posición, altura y cabeceo salen del XMP de
// DJI; el rumbo se corrigió superponiendo los edificios de OSM sobre la foto (el compás del dron marcaba +1,7°).
// Los edificios (edificios.json) se generan con scripts/edificios-portada.mjs.

import { ejes } from '../deriva-3d/camara.js';

const RAD = Math.PI / 180;

// rutas absolutas: el módulo se importa desde páginas en carpetas distintas
export const FOTO = {
  imagen: new URL('panoramica.webp', import.meta.url).href, tipo: 'fotografía aérea',
  edificios: new URL('edificios.json', import.meta.url).href,
  camara: { lat: 25.76510167, lng: -80.25260167, alt: 118 },
  rumbo: -3.7, cabeceo: 4.4, giro: 0, apertura: 73.74,   // 24 mm equivalentes → 73,7° horizontales
  aspecto: 16 / 9,
  lejos: 3300,
  // lo que de la foto no cae sobre la ciudad (el cielo, el horizonte lejano) cae sobre un telón curvo
  telon: { radio: 2750, abre: 44, alto: 1150 },
  sol: { azimut: 235, elevacion: 14 },
};

// Telón para crearCiudad, con centro en la posición del dron (en coordenadas locales de quien lo llama).
export const telonDe = (vista) => ({
  centro: [vista.pos[0], vista.pos[1]], radio: FOTO.telon.radio,
  desde: vista.rumbo - FOTO.telon.abre, hasta: vista.rumbo + FOTO.telon.abre, alto: FOTO.telon.alto,
});

// ── encuadre desde el punto de vista del dron ──
// MapLibre no inclina más de 84° (la cámara mira 6° hacia abajo y la foto 4,4°). Dada una pantalla de W × H y un
// giro `desvio` (grados) de la cámara respecto del eje de la foto, distancia focal mínima (en píxeles) para que la
// pantalla entera caiga dentro de la foto. Una homografía lleva el rectángulo de la pantalla a un cuadrilátero
// convexo en el plano de la foto: alcanza con que las cuatro esquinas queden adentro.
function focal(W, H, pitch, desvio) {
  const cam = ejes({ rumbo: FOTO.rumbo + desvio, cabeceo: 90 - pitch, giro: 0 });
  const foto = ejes(FOTO);
  const tH = Math.tan((FOTO.apertura / 2) * RAD), tV = tH / FOTO.aspecto;
  const p = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cabe = (f) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].every(([sx, sy]) => {
    const r = [0, 1, 2].map((i) => cam.f[i] * f + cam.der[i] * sx * W / 2 + cam.arr[i] * sy * H / 2);
    const z = p(r, foto.f);
    return z > 0 && Math.abs(p(r, foto.der) / z) <= tH && Math.abs(p(r, foto.arr) / z) <= tV;
  });
  let a = 10, b = 1e6;
  if (!cabe(b)) return Infinity;
  for (let i = 0; i < 60; i++) { const m = Math.sqrt(a * b); if (cabe(m)) b = m; else a = m; }
  return b;
}

// Encuadre para una pantalla: { fov (vertical, grados), paneo (grados a cada lado del eje), foto (rectángulo donde
// queda la foto en pantalla con la cámara en el eje: para ubicar la imagen fija mientras carga el 3D) }.
// En una pantalla vertical se ve una franja de la panorámica, y la cámara la recorre girando sobre sí misma
// (desde el punto de vista la imagen sigue entera): `paneo` es hasta dónde puede girar a cada lado sin salirse
// de la foto, cerrando el campo de visión a lo sumo un 10 %. En una apaisada la foto entra casi entera y no hay paneo.
export function encuadre(W, H, pitch) {
  const f0 = focal(W, H, pitch, 0) * 1.01;
  let paneo = 0;
  if (focal(W, H, pitch, 2) < f0 * 1.1) {
    let a = 2, b = FOTO.apertura / 2;
    for (let i = 0; i < 30; i++) { const m = (a + b) / 2; if (focal(W, H, pitch, m) < f0 * 1.1) a = m; else b = m; }
    paneo = a;
  }
  const f = Math.max(f0, focal(W, H, pitch, paneo) * 1.01);
  const tH = Math.tan((FOTO.apertura / 2) * RAD);
  const d = Math.tan(((90 - pitch) - FOTO.cabeceo) * RAD);   // el centro de la foto sube d·f píxeles
  const ancho = 2 * f * tH, alto = ancho / FOTO.aspecto;
  return {
    fov: (2 * Math.atan(H / 2 / f)) / RAD, paneo,
    foto: { ancho, alto, x: (W - ancho) / 2, y: H / 2 - f * d - alto / 2 },
  };
}

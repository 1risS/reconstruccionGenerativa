// Estilos visuales del mapa 3D. Cada estilo es una rama de los shaders de ciudad.js (uEstilo) más una paleta para el
// mapa base de MapLibre y el cielo. No cambian el recorrido, la cámara, el audio ni la interfaz: sólo cómo se dibuja
// la ciudad. La deriva usa dos, sin botonera: FANTASMA en la panorámica del principio y del final (la ciudad no está,
// sólo la luz de la foto) y MAQUETA durante el recorrido; mapa.js los funde con `mezclar(t)`. Los demás quedan
// definidos (las ramas de los shaders siguen ahí) pero no se usan.

// colores [r, g, b] en 0…1 tal cual se ven en pantalla (los shaders no convierten el espacio de color)
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

const CIELO_ATARDECER = { 'sky-color': '#2a2852', 'horizon-color': '#f39a62', 'fog-color': '#7d5560',
  'sky-horizon-blend': 0.55, 'horizon-fog-blend': 0.45, 'fog-ground-blend': 0.8, 'atmosphere-blend': 0 };
const cieloOscuro = (cenit, horizonte, niebla) => ({ 'sky-color': cenit, 'horizon-color': horizonte, 'fog-color': niebla,
  'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.5, 'fog-ground-blend': 0.9, 'atmosphere-blend': 0 });

// base: null = la paleta original del mapa (la de mapa.js). tono: 'claro' | 'oscuro' (viñeta y halos de la interfaz)
// texto: colores de las etiquetas de calles { color, halo }; si falta, quedan las del mapa base.
export const ESTILOS = [
  {
    // la del flyer: volúmenes de maqueta (fachadas rosa, crema y blanco) sobre papel gris claro, luz de estudio
    id: 'maqueta', nombre: 'Maqueta', nota: 'como el diorama del flyer: yeso pintado sobre papel',
    indice: 7, niebla: hex('#eaeaea'), tinta: hex('#685236'), piso: hex('#a8a6a2'), tono: 'claro',
    base: { fondo: '#e6e5e2', relleno: '#dedcd7', parque: '#bcc4a8', agua: '#c3cdd1', linea: '#d2d0cb',
      veredas: '#c4a096', calzadas: '#9c9b98', carriles: '#f2efe6' },
    texto: { color: '#6a6763', halo: '#eaeaea' },
    cielo: { 'sky-color': '#eaeaea', 'horizon-color': '#eaeaea', 'fog-color': '#eaeaea',
      'sky-horizon-blend': 0.5, 'horizon-fog-blend': 0.5, 'fog-ground-blend': 0.9, 'atmosphere-blend': 0 },
    cuadros: { k: 1 },
    muestra: 'linear-gradient(170deg, #f6d4c9 0 48%, #e5bf71 48% 56%, #a17656 56% 70%, #4a3022 70%)',
  },
  {
    id: 'atardecer', nombre: 'Atardecer', nota: 'luz rasante, sombras y proyecciones',
    indice: 0, niebla: [0.42, 0.30, 0.33], tinta: [0.62, 0.78, 1.0], piso: [0.30, 0.235, 0.245],
    base: null, cielo: CIELO_ATARDECER, cuadros: { k: 1 },
    muestra: 'linear-gradient(160deg, #2a2852 10%, #f39a62 95%)',
  },
  {
    id: 'aristas', nombre: 'Aristas', nota: 'sólo los bordes de la malla, en rayos X',
    indice: 1, niebla: hex('#06060b'), tinta: [0.62, 0.78, 1.0], piso: hex('#06060b'), transparente: true,
    base: { fondo: '#06060b', relleno: '#08080f', parque: '#070a0b', agua: '#070a16', linea: '#14141f',
      veredas: '#12121c', calzadas: '#09090f', carriles: '#6f7aa8' },
    cielo: cieloOscuro('#03030a', '#1c1a36', '#06060b'), cuadros: { k: 0.3 },
    muestra: 'repeating-linear-gradient(60deg, transparent 0 6px, #9fc6ff 6px 7px), #06060b',
  },
  {
    id: 'fantasma', nombre: 'Fantasma', nota: 'la ciudad no está: sólo las imágenes',
    indice: 2, niebla: hex('#0b0909'), tinta: [1, 1, 1], piso: hex('#0b0909'), transparente: true, ocluye: true,
    base: { fondo: '#0b0909', relleno: '#0d0b0b', parque: '#0b0c0b', agua: '#090a10', linea: '#181414',
      veredas: '#171313', calzadas: '#0e0b0b', carriles: '#5a4a44' },
    cielo: cieloOscuro('#050404', '#2a1a16', '#0b0909'), cuadros: { k: 1 },
    muestra: 'radial-gradient(circle at 45% 55%, #f3c08a 0 18%, #6d4a6b 40%, #0b0909 70%)',
  },
  {
    id: 'cercania', nombre: 'Cercanía', nota: 'las imágenes aparecen sólo de cerca, o al llegar a su punto de vista',
    indice: 3, niebla: [0.42, 0.30, 0.33], tinta: [0.62, 0.78, 1.0], piso: [0.30, 0.235, 0.245],
    base: null, cielo: CIELO_ATARDECER, cuadros: { k: 1, cerca: true },
    muestra: 'radial-gradient(circle at 50% 50%, #ffe2b0 0 14%, #c87a62 15% 30%, #3d3458 55%)',
  },
  {
    id: 'cianotipo', nombre: 'Cianotipo', nota: 'plano azul, trazo blanco, copias al ferroprusiato',
    indice: 4, niebla: hex('#1a3c6e'), tinta: [0.9, 0.95, 1.0], piso: hex('#1a3c6e'),
    base: { fondo: '#1a3c6e', relleno: '#1c4074', parque: '#1b446f', agua: '#12305a', linea: '#2d5a92',
      veredas: '#2c5890', calzadas: '#173866', carriles: '#e8f1ff' },
    cielo: { 'sky-color': '#0f2a52', 'horizon-color': '#3d6ea8', 'fog-color': '#1a3c6e',
      'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.5, 'fog-ground-blend': 0.9, 'atmosphere-blend': 0 },
    cuadros: { k: 1, tinte: [0.72, 0.86, 1.0] },
    muestra: 'linear-gradient(#e8f1ff 1px, transparent 1px) 0 0 / 8px 8px, linear-gradient(90deg, #e8f1ff 1px, transparent 1px) 0 0 / 8px 8px, #1a3c6e',
  },
  {
    id: 'sonar', nombre: 'Sonar', nota: 'la ciudad se oye: ecos que salen del caminante',
    indice: 5, niebla: hex('#020608'), tinta: [0.25, 0.95, 0.82], piso: hex('#020608'), animado: true,
    base: { fondo: '#020608', relleno: '#03080a', parque: '#030a09', agua: '#020610', linea: '#0a1a1e',
      veredas: '#071417', calzadas: '#03090b', carriles: '#2c8a7c' },
    cielo: cieloOscuro('#010304', '#062024', '#020608'), cuadros: { k: 0.85 },
    muestra: 'repeating-radial-gradient(circle at 50% 60%, #020608 0 4px, #3ff2d1 5px, #020608 7px 9px)',
  },
  {
    id: 'puntos', nombre: 'Nube de puntos', nota: 'un relevamiento láser, coloreado por altura',
    indice: 6, niebla: hex('#05040a'), tinta: [1, 1, 1], piso: hex('#05040a'), animado: true,
    base: { fondo: '#05040a', relleno: '#07060e', parque: '#06080b', agua: '#050614', linea: '#100e1c',
      veredas: '#0f0d1b', calzadas: '#08070f', carriles: '#5d4fa8' },
    cielo: cieloOscuro('#020106', '#1a1238', '#05040a'), cuadros: { k: 1 },
    muestra: 'radial-gradient(circle, #ff9e52 1.4px, transparent 1.8px) 0 0 / 7px 7px, radial-gradient(circle, #26d9eb 1.4px, transparent 1.8px) 3.5px 3.5px / 7px 7px, #05040a',
  },
];

const PROPIAS = ['veredas', 'calzadas', 'carriles'];
const FANTASMA = ESTILOS.find((e) => e.id === 'fantasma'), MAQUETA = ESTILOS.find((e) => e.id === 'maqueta');

// mezcla de colores: '#rrggbb' o [r, g, b] en 0…1
const aRGB = (c) => (Array.isArray(c) ? c : hex(c));
const mix = (a, b, t) => aRGB(a).map((x, i) => x + (aRGB(b)[i] - x) * t);
const css = (c) => `rgb(${c.map((x) => Math.round(x * 255)).join(',')})`;
function mezclarCielo(a, b, t) {
  const c = {};
  for (const k of Object.keys(a)) c[k] = typeof a[k] === 'number' ? a[k] + (b[k] - a[k]) * t : css(mix(a[k], b[k], t));
  return c;
}

/**
 * Pinta el mapa base y la ciudad. Llamar después de que mapa.js pintó el mapa base y armó la ciudad.
 * Con { fijo: '<id>' } aplica ese estilo y nada más (lo usa la portada). Sin `fijo` arranca en Fantasma y devuelve
 * `mezclar(t)`: t = 0 Fantasma, 1 Maqueta, y en el medio un fundido (la rama de la maqueta con uFantasma = 1 − t).
 * @returns { actual, mezclar } — `actual` es el estilo vigente (lo lee la capa Three.js en cada cuadro)
 */
export function iniciarEstilos(map, ciudad, { fijo = null } = {}) {
  // paleta original de cada capa de relleno y de línea
  const originales = [];
  for (const l of map.getStyle().layers) {
    if (/^ruta/.test(l.id)) continue;
    const props = l.type === 'background' ? ['background-color']
      : l.type === 'fill' ? ['fill-color', 'fill-outline-color']
      : l.type === 'line' ? ['line-color', 'line-opacity']
      : l.type === 'symbol' ? ['text-color', 'text-halo-color'] : [];
    for (const p of props) originales.push({ id: l.id, tipo: l.type, p, v: map.getPaintProperty(l.id, p) });
  }
  const pintar = (id, p, v) => { try { map.setPaintProperty(id, p, v); } catch (e) {} };

  // b: la paleta `base` de un estilo; con b2 y t, la mezcla de las dos
  const color = (b, o) => (o.tipo === 'background' ? b.fondo : PROPIAS.includes(o.id) ? b[o.id] : /water/.test(o.id) ? b.agua
    : o.tipo === 'line' ? b.linea : /park|wood|grass|landcover/.test(o.id) ? b.parque : b.relleno);
  function base(b, b2 = null, t = 0) {
    for (const o of originales) {
      if (!b) { pintar(o.id, o.p, o.v); continue; }
      if (o.tipo === 'symbol') {
        const bt = (b2 && t >= 0.5 ? b2 : b).texto;
        pintar(o.id, o.p, bt ? bt[o.p === 'text-color' ? 'color' : 'halo'] : o.v);
        continue;
      }
      if (o.p === 'line-opacity') { if (!PROPIAS.includes(o.id)) pintar(o.id, o.p, 0.6); continue; }
      pintar(o.id, o.p, b2 ? css(mix(color(b, o), color(b2, o), t)) : color(b, o));
    }
  }

  const ctl = { actual: fijo ? null : FANTASMA, t: -1, mezclar };
  function aplicar(est, { cielo = est.cielo, paleta = () => base(est.base), tono = est.tono } = {}) {
    ctl.actual = est;
    if (ciudad) ciudad.setEstilo(est);
    paleta();
    try { map.setSky(cielo); } catch (e) {}
    document.body.dataset.tono = tono || 'oscuro';
    // detrás del canvas: a la altura del horizonte MapLibre deja una franja sin dibujar (transparente) y se veía el
    // fondo claro de la página como una raya blanca en los estilos oscuros. Se pinta con el color de la niebla.
    map.getContainer().style.background = css(est.niebla);
    map.triggerRepaint();
  }
  // t = 0 Fantasma … 1 Maqueta
  function mezclar(t) {
    t = Math.max(0, Math.min(1, t));
    if (t === ctl.t || (t > 0 && t < 1 && Math.abs(t - ctl.t) < 0.004)) return;
    ctl.t = t;
    if (t === 0) return aplicar(FANTASMA);
    if (t === 1) return aplicar(MAQUETA);
    const est = { ...MAQUETA, id: 'fundido', fantasma: 1 - t, transparente: true, ocluye: true,
      niebla: mix(FANTASMA.niebla, MAQUETA.niebla, t), tinta: mix(FANTASMA.tinta, MAQUETA.tinta, t),
      piso: mix(FANTASMA.piso, MAQUETA.piso, t) };
    aplicar(est, { cielo: mezclarCielo(FANTASMA.cielo, MAQUETA.cielo, t), paleta: () => base(FANTASMA.base, MAQUETA.base, t),
      tono: t >= 0.5 ? MAQUETA.tono : FANTASMA.tono });
  }

  if (fijo) aplicar(ESTILOS.find((e) => e.id === fijo) || MAQUETA);
  else {
    // el fundido pinta el mapa base en cada cuadro: sin la transición propia de MapLibre (300 ms), que lo atrasaría
    try { map.style.stylesheet.transition = { duration: 0, delay: 0 }; } catch (e) {}
    mezclar(0);
  }
  return ctl;
}

// Estilos visuales del mapa 3D, intercambiables con una botonera (arriba a la derecha) o con las teclas 1–8.
// Cada estilo es una rama de los shaders de ciudad.js (uEstilo) más una paleta para el mapa base de MapLibre
// y el cielo. No cambian el recorrido, la cámara, el audio ni la interfaz: sólo cómo se dibuja la ciudad.
// El estilo elegido se recuerda en este navegador; ?estilo=<id> en la URL lo fuerza.

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
const CLAVE = 'deriva3d-estilo-v2';   // v2: la Maqueta pasó a ser la predeterminada

/**
 * Arma la botonera y aplica el estilo inicial. Llamar después de que mapa.js pintó el mapa base y armó la ciudad.
 * Con { fijo: '<id>' } aplica ese estilo sin botonera y sin recordarlo (lo usa la portada).
 * @returns { actual } — el estilo vigente (lo lee la capa Three.js en cada cuadro)
 */
export function iniciarEstilos(map, ciudad, { fijo = null } = {}) {
  // paleta original de cada capa de relleno y de línea, para poder volver a ella
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

  function base(b) {
    for (const o of originales) {
      if (!b) { pintar(o.id, o.p, o.v); continue; }
      if (o.tipo === 'symbol') { pintar(o.id, o.p, b.texto ? b.texto[o.p === 'text-color' ? 'color' : 'halo'] : o.v); continue; }
      if (o.p === 'line-opacity') { if (!PROPIAS.includes(o.id)) pintar(o.id, o.p, 0.6); continue; }
      let c;
      if (o.tipo === 'background') c = b.fondo;
      else if (PROPIAS.includes(o.id)) c = b[o.id];
      else if (/water/.test(o.id)) c = b.agua;
      else if (o.tipo === 'line') c = b.linea;
      else if (/park|wood|grass|landcover/.test(o.id)) c = b.parque;
      else c = b.relleno;
      pintar(o.id, o.p, c);
    }
  }

  const ctl = { actual: ESTILOS[0] };
  function aplicar(est) {
    ctl.actual = est;
    if (ciudad) ciudad.setEstilo(est);
    base(est.base);
    try { map.setSky(est.cielo); } catch (e) {}
    document.body.dataset.tono = est.tono || 'oscuro';
    map.triggerRepaint();
    if (fijo) return;
    try { localStorage.setItem(CLAVE, est.id); } catch (e) {}
    nav.querySelector('.estilos-abrir').setAttribute('aria-label', `Estilo: ${est.nombre}`);
    nav.querySelector('.estilos-abrir span').style.background = est.muestra;
    nav.querySelectorAll('[data-estilo]').forEach((b) => b.setAttribute('aria-checked', b.dataset.estilo === est.id));
    map.triggerRepaint();
  }

  if (fijo) { aplicar(ESTILOS.find((e) => e.id === fijo) || ESTILOS[0]); return ctl; }

  // ── botonera ──
  const css = document.createElement('style');
  css.textContent = `
.estilos { position: fixed; z-index: 11; top: max(0.75rem, env(safe-area-inset-top)); right: 0.75rem;
  display: flex; flex-direction: column; align-items: flex-end; gap: 0.4rem; font-size: 0.85rem; }
.estilos-abrir { width: 2.4rem; height: 2.4rem; padding: 0.3rem; border-radius: 50%; cursor: pointer;
  border: 1px solid var(--line, rgba(255,255,255,0.2)); background: var(--panel, rgba(18,16,16,0.86)); }
.estilos-abrir[aria-expanded="true"] { border-color: var(--accent); }
.estilos-abrir span, .estilos-lista i { display: block; width: 100%; height: 100%; border-radius: 50%;
  box-shadow: inset 0 0 0 1px rgba(0,0,0,0.15); }
.estilos-lista { margin: 0; padding: 0.35rem; list-style: none; width: 16.5rem; max-width: calc(100vw - 1.5rem);
  border-radius: 14px; border: 1px solid var(--line, rgba(255,255,255,0.2));
  background: var(--panel, rgba(18,16,16,0.86)); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); }
.estilos-lista button { display: grid; grid-template-columns: 1.6rem 1fr auto; align-items: center; gap: 0 0.65rem;
  width: 100%; padding: 0.45rem 0.5rem; border: 0; border-radius: 9px; background: none; text-align: left; cursor: pointer; }
.estilos-lista button:hover { background: rgba(0,0,0,0.05); }
.estilos-lista button[aria-checked="true"] { background: rgba(0,0,0,0.08); }
.estilos-lista button[aria-checked="true"] b { color: var(--accent); }
.estilos-lista i { width: 1.6rem; height: 1.6rem; grid-row: span 2; }
.estilos-lista b { font-family: var(--display); font-weight: 500; font-size: 1.05rem; }
.estilos-lista small { grid-column: 2; color: var(--muted, #aaa); font-size: 0.72rem; line-height: 1.25; }
.estilos-lista kbd { grid-row: 1; grid-column: 3; font: inherit; font-size: 0.7rem; color: var(--muted, #aaa); opacity: 0.7; }
@media (hover: none) { .estilos-lista kbd { display: none; } }`;
  document.head.appendChild(css);

  const nav = document.createElement('nav');
  nav.className = 'estilos';
  nav.setAttribute('aria-label', 'Estilo del mapa');
  nav.innerHTML = `<button class="estilos-abrir" aria-expanded="false" aria-controls="estilos-lista"><span></span></button>
<ul class="estilos-lista" id="estilos-lista" role="radiogroup" aria-label="Estilo del mapa" hidden>${ESTILOS.map((e, i) =>
    `<li><button role="radio" data-estilo="${e.id}" aria-checked="false"><i style="background:${e.muestra}"></i><b>${e.nombre}</b><kbd>${i + 1}</kbd><small>${e.nota}</small></button></li>`).join('')}</ul>`;
  document.body.appendChild(nav);
  const abrir = nav.querySelector('.estilos-abrir'), lista = nav.querySelector('.estilos-lista');
  const mostrar = (ver) => { lista.hidden = !ver; abrir.setAttribute('aria-expanded', ver); };
  abrir.addEventListener('click', () => mostrar(lista.hidden));
  lista.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-estilo]');
    if (b) aplicar(ESTILOS.find((e) => e.id === b.dataset.estilo));
  });
  document.addEventListener('pointerdown', (ev) => { if (!nav.contains(ev.target)) mostrar(false); });
  document.addEventListener('keydown', (ev) => {
    if (ev.metaKey || ev.ctrlKey || ev.altKey || /INPUT|TEXTAREA/.test(ev.target.tagName) && ev.target.type !== 'range') return;
    const i = Number(ev.key) - 1;
    if (Number.isInteger(i) && ESTILOS[i]) aplicar(ESTILOS[i]);
    if (ev.key === 'Escape') mostrar(false);
  });

  let inicial = new URLSearchParams(location.search).get('estilo');
  if (!inicial) try { inicial = localStorage.getItem(CLAVE); } catch (e) {}
  aplicar(ESTILOS.find((e) => e.id === inicial) || ESTILOS[0]);
  return ctl;
}

// Deriva Calle 8 — mapa 3D sincronizado con el audio.
// Los datos del recorrido y de los registros están en recorrido.js; este archivo no necesita editarse.
// Las cámaras calibradas (calibrar.html) están en calibracion.js y tienen prioridad sobre recorrido.js.

import { normalizar, factorIso, ejes } from './camara.js';
import { iniciarEstilos } from './estilos.js';
import { FOTO as PANO, telonDe, encuadre as encuadrePano, homografia } from '../portada/panoramica.js';

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
// en la portada manda la muestra (título grande y sedes) y la deriva va debajo, más chica; sin el nombre de la artista
if (M) $('#muestra').innerHTML = `<h1 class="m-titulo">${M.titulo}:<span>${M.subtitulo}</span></h1><p class="m-sede">${M.sede}</p>`;

// ── carga ──────────────────────────────────────────
// Start no aparece hasta que está todo: el mapa con sus teselas, la ciudad 3D, las fotos, la panorámica proyectada,
// el audio y, al final, unos cuadros seguidos sin tirones (los shaders ya compilados y las texturas en la GPU).
// Mientras tanto, el caminante avanza por la línea del recorrido. Cada etapa tiene una sonda (0…1) que se consulta
// en cada cuadro; las sondas leen variables que se definen más abajo (corren recién después de evaluar el módulo).
// Si algo se cuelga o falla, la etapa se da por hecha: la experiencia sigue igual que antes, con lo que haya.
const CARGA = (() => {
  const T0 = performance.now();
  const MAX_SEG = 45;         // pase lo que pase, a los 45 s aparece Start
  const AUDIO_ESPERA = 4;     // segundos que se espera al audio con todo lo demás listo (iOS no lo baja sin un toque)
  const FLUIDO_CUADROS = 40;  // cuadros seguidos de menos de FLUIDO_MS para dar por fluido el sitio…
  const FLUIDO_MS = 34;       // …(≈ 30 fps o más)
  const FLUIDO_SEG = 6;       // …y si no lo logra en este tiempo, se sigue igual
  const imgs = { total: 0, listas: 0 };
  let mapaListo = false, ciudadLista = false, todoMenosAudio = 0, fluidoDesde = 0, buenos = 0, previo = 0;
  let mostrado = 0, objetivo = 0, terminado = false;
  const hechas = new Set();   // una etapa que llegó a 1 queda hecha (las teselas, p. ej., vuelven a cargar al mover la cámara)
  const etapas = [   // el texto que se ve es el de la primera etapa que falta
    { texto: 'Loading the map', peso: 2, sonda: () => (mapaListo ? (map.areTilesLoaded() ? 1 : 0.6) : 0) },
    { texto: 'Building the street', peso: 2, sonda: () => (ciudadLista ? 1 : crear3D ? 0.5 : 0) },
    { texto: 'Developing the photographs', peso: 3, sonda: () => (imgs.total ? imgs.listas / imgs.total : 1) },
    { texto: 'Placing the aerial view', peso: 1,
      sonda: () => (!pano || pano.listo || pano.fallo ? 1 : pano.ciudad ? 0.6 : 0) },
    { texto: 'Tuning the sound', peso: 2, sonda: (ahora) => {
      if (audio.readyState >= 4 || audio.error) return 1;
      if (todoMenosAudio && ahora - todoMenosAudio > AUDIO_ESPERA * 1000) return 1;
      return [0, 0.3, 0.45, 0.7][audio.readyState];
    } },
    { texto: 'Getting ready', peso: 1, sonda: (ahora) => {
      if (!fluidoDesde) return 0;
      if (ahora - fluidoDesde > FLUIDO_SEG * 1000) return 1;
      return Math.min(1, buenos / FLUIDO_CUADROS);
    } },
  ];
  const pesoTotal = etapas.reduce((a, e) => a + e.peso, 0);
  const el = { carga: $('#carga'), hecho: $('#carga-hecho'), punto: $('#carga-punto'), etapa: $('#carga-etapa'),
    pct: $('#carga-pct'), inicio: $('#inicio'), btn: $('#comenzar') };

  function terminar() {
    terminado = true;
    el.inicio.classList.add('cargado');
    el.btn.disabled = false;
    el.btn.removeAttribute('tabindex');
    el.carga.setAttribute('aria-valuenow', '100');
    el.carga.setAttribute('aria-hidden', 'true');
  }
  function tick(ahora) {
    if (terminado) return;
    // cuadros sin tirones (con la pestaña oculta no hay cuadros: no cuenta)
    const dt = previo ? Math.min(0.25, (ahora - previo) / 1000) : 0;
    if (previo && fluidoDesde) buenos = ahora - previo < FLUIDO_MS ? buenos + 1 : 0;
    previo = ahora;
    let suma = 0, etapa = null;
    const vals = etapas.map((e) => {
      if (hechas.has(e)) return 1;
      const v = Math.max(0, Math.min(1, e.sonda(ahora) || 0));
      if (v >= 1) hechas.add(e);
      return v;
    });
    vals.forEach((v, i) => { suma += v * etapas[i].peso; if (v < 1 && !etapa) etapa = etapas[i]; });
    if (vals.slice(0, 4).every((v) => v >= 1) && !todoMenosAudio) todoMenosAudio = ahora;
    if (vals.slice(0, 5).every((v) => v >= 1) && !fluidoDesde) { fluidoDesde = ahora; buenos = 0; }
    const forzar = ahora - T0 > MAX_SEG * 1000;
    if (forzar && etapa) console.warn('carga: Start sin esperar a', etapa.texto);
    objetivo = Math.max(objetivo, forzar ? 1 : suma / pesoTotal);
    // la línea avanza suave (nunca para atrás, a la misma velocidad con cualquier cantidad de cuadros por segundo)
    // y llega a la punta antes de dar paso a Start
    mostrado += (objetivo - mostrado) * (1 - Math.exp(-dt * (objetivo >= 1 ? 6 : 2.5)));
    if (objetivo >= 1) mostrado = Math.min(1, mostrado + dt * 0.25);
    const pct = Math.round(mostrado * 100);
    el.hecho.style.width = el.punto.style.left = `${mostrado * 100}%`;
    el.pct.textContent = `${pct}%`;
    el.carga.setAttribute('aria-valuenow', String(pct));
    if (etapa && el.etapa.textContent !== etapa.texto) el.etapa.textContent = etapa.texto;
    if (mostrado >= 1) { el.etapa.textContent = 'Ready'; setTimeout(terminar, 350); terminado = true; return; }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  return {
    // precarga una imagen y la cuenta (las texturas de Three.js la toman después de la caché del navegador)
    imagen(src, alCargar) {
      const im = new Image();
      imgs.total++;
      let contada = false;
      const listo = () => { if (!contada) { contada = true; imgs.listas++; } };
      im.onload = () => { if (alCargar) alCargar(im); (im.decode ? im.decode() : Promise.resolve()).then(listo, listo); };
      im.onerror = listo;
      im.src = src;
      return im;
    },
    mapa() { mapaListo = true; },
    ciudad() { ciudadLista = true; },
  };
})();

// cámara de calle
const OJO = 1.8;            // altura de los ojos, en metros (con 1,6 m y el gran angular de la vereda se sentía como la vista de un chico)
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
const PANEO_ENTRA = 10;     // segundos en que el paneo pasa de quieto a su amplitud (arranca sin sacudón)
const FUNDIDO_FOTO = 1.5;   // segundos del fundido de la foto fija al 3D (igual que .pano-foto en mapa.css)
const PANO_APAGA = 2.5;     // segundos que tarda en apagarse la proyección al comenzar
const VUELTA_SEG = 9;       // segundos del vuelo de vuelta al dron al terminar el recorrido
const FOTO_VUELTA = [0.12, 0.45];   // tramo de la vuelta en que aparece la foto fija de la panorámica (tapa el vuelo sobre negro)
const VUELTA_ALTO = 400;    // altura (m) a la que cruza la ciudad en ese vuelo
const PARTIDA_SEG = 12;     // segundos del travelling del dron a los ojos del caminante (al comenzar)
// Estilo de la ciudad: FANTASMA (sólo la luz de las imágenes) en la panorámica y MAQUETA durante el recorrido.
const MAQUETA_PARTIDA = [0.66, 0.8];    // tramo de la partida en que pasa a Maqueta: recién cuando ya baja y se ven
                                        // de cerca los techos de Little Havana (antes, aunque estén en cuadro, es Fantasma)
const FANTASMA_VUELTA = [0, 0.14];   // tramo de la vuelta al dron en que vuelve a Fantasma: apenas empieza a subir
// En los travellings a los puntos de vista también es Fantasma (sólo las fotos): se funde en la segunda mitad de la
// subida (la cámara llegando) y vuelve a Maqueta en la primera mitad de la bajada (la cámara volviendo al caminante).
// (los viajes desde y hacia los ojos del caminante se ven con la maqueta; entre una vista y otra, sólo las imágenes)
const FANTASMA_LLEGA = [0.5, 1];     // tramo de la subida
const MAQUETA_SALE = [0, 0.5];       // tramo de la bajada
const MAQUETA_SALE_ALTA = [0.45, 0.75];   // ídem, bajando de un diorama (la cámara ya en la calle: ver bajadaAlta)
const FUNDIDO_ESTILO = 2.5;           // segundos del fundido en los demás casos
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
  K.push({ t, lng: p.lng, lat: p.lat, nota: p.nota || '', abre: p.abre });
  if (p.hasta != null) K.push({ t: aSeg(p.hasta), lng: p.lng, lat: p.lat, nota: p.nota || '', abre: p.abre });
});
for (let i = 1; i < K.length; i++) if (K[i].t < K[i - 1].t) console.warn('recorrido.js: tiempos fuera de orden en', K[i]);

K[0].d = 0;
for (let i = 1; i < K.length; i++) K[i].d = K[i - 1].d + metros(K[i - 1], K[i]);
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

// ── manos de la Calle 8 ────────────────────────────
// El eje de la calle sale del propio recorrido (ida por una vereda y vuelta por la otra): la dirección principal de
// los puntos, centrado entre las dos veredas. mano(x, y) > 0 de un lado del eje y < 0 del otro (≈ ±8,5 m en las veredas).
// La cámara mira siempre hacia las fachadas de la vereda por la que camina, y sólo se hacen los travellings de los
// lugares de esa misma mano (los de enfrente no).
const EJE = (() => {
  const P = K.map((k) => aLocal([k.lng, k.lat]));
  const mx = P.reduce((s, p) => s + p[0], 0) / P.length, my = P.reduce((s, p) => s + p[1], 0) / P.length;
  let sxx = 0, syy = 0, sxy = 0;
  for (const [x, y] of P) { sxx += (x - mx) ** 2; syy += (y - my) ** 2; sxy += (x - mx) * (y - my); }
  const a = 0.5 * Math.atan2(2 * sxy, sxx - syy), n = [-Math.sin(a), Math.cos(a)];   // n: normal al eje
  const lat = P.map(([x, y]) => (x - mx) * n[0] + (y - my) * n[1]);
  return { mx, my, n, c: (Math.min(...lat) + Math.max(...lat)) / 2, rumboN: Math.atan2(n[0], n[1]) / RAD };
})();
const mano = (x, y) => (x - EJE.mx) * EJE.n[0] + (y - EJE.my) * EJE.n[1] - EJE.c;
const MIRA_VEREDA = 8;    // grados que la mirada se abre de la dirección de la marcha hacia las fachadas de su vereda:
                          // mira casi siempre al frente; a las paredes sólo en los travellings y en las pausas
const MIRA_PAUSA = 35;    // hasta dónde gira la cabeza hacia sus fachadas en las pausas (nunca hacia las de enfrente)
// rumbo de la mirada del caminante: adelante y abierto `abre` grados hacia su vereda (cruzando la calle, sólo adelante).
// Sin `abre`, el del tramo: `abre` del punto donde empieza (recorrido.js) o MIRA_VEREDA. Negativo = hacia la calle
// (donde la línea va pegada a las fachadas, abrir hacia ellas llenaba media pantalla de pared).
function rumboVereda(e, abre = K[e.k] && K[e.k].abre != null ? K[e.k].abre : MIRA_VEREDA) {
  const [x, y] = aLocal([e.lng, e.lat]), m = mano(x, y);
  const fachadas = m >= 0 ? EJE.rumboN : EJE.rumboN + 180;
  const w = clamp((Math.abs(m) - 2) / 4, 0, 1);
  return e.rumbo + clamp(difAng(e.rumbo, fachadas), -Math.abs(abre), Math.abs(abre)) * Math.sign(abre) * w;
}

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
MIRADAS.forEach((m) => m.imagenes.forEach((src) => CARGA.imagen(src)));
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
      tipo: v.tipo || p.tipo || '',     // el pie dice qué es la imagen que se está viendo
      llega: v.llega,                   // 'fundido': sin vuelo desde la vista anterior (ver TRASLADO_FUNDIDO)
      lugar: v.lugar,                   // (opcional) otro nombre en el pie para esta vista (p. ej. el Domino Park en el Tower)
      corte: !!v.corte };               // (opcional) oculta los volúmenes de adelante, como en los dioramas (ver CORTE)
    // el cielo de la foto del arranque se ve desde lejos: se la mira desde que la partida baja y mientras la cámara
    // camina hasta el caminante (ver ARRANQUE y ciudad.js → cieloLlega). Ya no llena la pantalla (`cubrir`): entra
    // entera, con margen a los costados como todas (pedido de la artista, 27/11)
    if (p.arranque) Object.assign(vista, { cieloLlega: 150 });
    // las huellas que acompañan toda la caminata (la del arranque, desdeLejos, conCaminante) no ceden su ranura a las
    // de los lugares cercanos (ver prio en intensidades): si no, la foto del arbolito, que pinta toda la cuadra, se
    // apagaba de golpe al acercarse a El Cristo
    vista.siempre = !!(p.arranque || p.desdeLejos || p.conCaminante);
    // profundidad (recorrido.js): la mira va sobre el eje, a esa distancia del punto de vista. calibrar.html la pone a la
    // profundidad media de sus pares y, sin pares, a 80 m: detrás de la fachada, adentro de la manzana. Con la mira
    // tan lejos la ola entre una imagen y otra nacía ahí (tardaba en llegar a la pared) y el vuelo giraba alrededor
    // de ese punto en vez de ir hacia la pared.
    if (v.profundidad) {
      const d = vista.mira.map((m, i) => m - vista.pos[i]), n = Math.hypot(...d) || 1;
      vista.mira = vista.pos.map((q, i) => q + (d[i] / n) * v.profundidad);
      vista.profundidad = v.profundidad;
    }
    // vistas isométricas (camara.js): la cámara está a ~1 km con un teleobjetivo. El vuelo se calcula con su
    // equivalente CERCANA (misma dirección, apertura de 40°, `iso` veces más cerca) y recién al final la cámara se
    // aleja por su eje cerrando el campo de visión en la misma proporción: un dolly zoom (ver camaraCalle).
    vista.iso = factorIso(vista);
    vista.lnIso = Math.log(vista.iso);
    vista.posEq = vista.pos.map((x, i) => vista.mira[i] + (x - vista.mira[i]) / vista.iso);
    // retroceso (recorrido.js): la foto se sigue proyectando desde donde se tomó, pero se la mira desde unos metros más
    // atrás por el mismo eje, donde abarca menos ángulo (alejar: cuánto más chica se ve lo que está a la distancia de la
    // mira). Para un gran angular que, desde su punto de vista, pide más campo del que MapLibre puede dibujar en un
    // celular vertical y no entraba con márgenes (la segunda de Guantanamera, 102°, pedido de la artista, 27/11).
    if (v.retroceso > 0 && vista.iso <= 1) {
      const d = vista.pos.map((x, i) => x - vista.mira[i]), D = Math.hypot(...d) || 1;
      vista.alejar = (D + v.retroceso) / D;
      vista.posEq = vista.mira.map((m, i) => m + d[i] * vista.alejar);
    }
    CARGA.imagen(v.imagen, (im) => (vista.aspecto = im.naturalWidth / im.naturalHeight));
    VISTAS.push(vista);
    return vista;
  });
  // huella: la vista que queda proyectada (tenue) fuera del tramo; la marcada con huella: true, o la primera.
  // Si hay varias marcadas, quedan todas superpuestas (huellas), la que va antes en la lista ENCIMA de las demás
  // (capa: ciudad.js las compone de la capa 0 hacia arriba). `huella` es la primera de ellas.
  const iHuella = Math.max(0, p.vistas.findIndex((v) => v.huella)), huella = vistas[iHuella];
  const huellas = vistas.filter((v, i) => p.vistas[i].huella);
  if (!huellas.length) huellas.push(huella);
  huellas.forEach((v, i) => (v.capa = huellas.length > 1 ? huellas.length - 1 - i : 0));
  // desdeLejos (recorrido.js): sus imágenes van una capa por encima de las demás (p. ej. sobre la foto del arranque)
  if (p.desdeLejos) vistas.forEach((v) => (v.capa = (v.capa || 0) + 1));
  // fondo (recorrido.js): mientras la cámara está con el caminante, la vista queda encendida como textura DEBAJO de
  // las demás vistas del lugar (también de la huella). Ver intensidades().
  vistas.forEach((v, i) => (v.fondo = !!p.vistas[i].fondo));
  if (vistas.some((v) => v.fondo)) vistas.forEach((v) => (v.capa = v.fondo ? 0 : (v.capa || 0) + 1));
  // sobre (recorrido.js): mientras se mira esa vista, la otra vista del lugar que indica queda encendida DEBAJO, como su
  // contexto (el detalle de la entrada de Cubaocho, dentro de la foto frontal). Va una capa por encima de ella.
  vistas.forEach((v, i) => {
    const d = vistas[p.vistas[i].sobre];
    if (p.vistas[i].sobre == null || !d || d === v) return;
    v.sobre = d;
    v.capa = Math.max(v.capa || 0, (d.capa || 0) + 1);
  });
  // punto que dispara el travelling: donde se tomó la foto que queda como huella (o `punto` en recorrido.js)
  const ref = p.punto || (CAL.vistas[huella.imagen] || {}).camara || p.vistas[iHuella].camara;
  // mano del lugar: de qué lado de la calle está la fachada que muestra la huella
  return { ...p, grupo, huella, huellas, vistas, centro: aLocal([ref.lng, ref.lat]), radio: p.radio || RADIO_LUGAR,
    mano: Math.sign(mano(huella.mira[0], huella.mira[1])),
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
const OLA_HUELLA = 3;   // segundos de la ola con que aparece una huella sobre una vista `fondo` (ver intensidades)
const GIRO_VUELTA = 20, GIRO_VUELTA_MAX = 10;   // °/s del giro de vuelta a los ojos del caminante, y su tope en segundos
const CONTEMPLA = 6; // segundos quieto en cada punto de vista (un lugar puede pedir menos: `contempla` en recorrido.js)
// vistas con `llega: 'fundido'` (recorrido.js): no se vuela hasta ellas. La imagen anterior se apaga en su punto de
// vista, la cámara corta a oscuras y la nueva se enciende ya recompuesta. Para los tramos en que el vuelo sólo mostraría
// mapa vacío (p. ej. de un diorama, a 1 km con teleobjetivo, a la foto cenital del Tower, pasando por el nadir).
const TRASLADO_FUNDIDO = 2.4;
const esFundido = (v) => v.llega === 'fundido';
// (`traslado` en recorrido.js: un lugar cuyas vistas están cerca puede pedir un viaje más corto entre una y otra)
const traslado = (v, p) => (esFundido(v) ? TRASLADO_FUNDIDO : (p && p.traslado) || TRASLADO);
const PASO_T = 0.5;
function pasadas(L) {
  const fin = K[K.length - 1].t, res = [];
  let dentro = false;
  for (let t = 0; t <= fin; t += PASO_T) {
    const e = estado(t), [x, y] = aLocal([e.lng, e.lat]);
    const d = Math.hypot(x - L.centro[0], y - L.centro[1]);
    // sólo cuenta si el caminante va por la vereda del lugar (no se miran los de enfrente)
    if (!dentro && d < L.radio && mano(x, y) * L.mano > 0) { dentro = true; res.push(t); }
    else if (dentro && d > L.radio * 1.4) dentro = false; // histéresis: no se dispara dos veces en el borde
  }
  return res;
}
// viaje de ida y de vuelta: 5–8 s según la distancia entre los ojos del caminante y el punto de vista
const viaje = (t, v) => {
  const e = estado(t), [x, y] = aLocal([e.lng, e.lat]);
  return clamp(4 + Math.hypot(v.posEq[0] - x, v.posEq[1] - y, v.posEq[2] - OJO) / 6, 5, 8);
};
// (el lugar con `arranque`, la foto del punto de partida, va siempre al principio: ver ARRANQUE más abajo)
const PROYS = LUGARES.flatMap((L) => (L.arranque ? [0] : pasadas(L)).map((t, i) => ({ ...L, desde: t, vistas: i === 0 ? L.vistas : L.repite })))
  .filter((p) => p.vistas.length).sort((a, b) => a.desde - b.desde);
PROYS.forEach((p, i) => {
  const prev = PROYS[i - 1];
  if (prev) p.desde = Math.max(p.desde, prev.hasta + SUELTA + 2);
  const n = p.vistas.length, ult = p.vistas[n - 1];
  p.subida = viaje(p.desde, p.vistas[0]);
  const resto = n * (p.contempla || CONTEMPLA) + p.vistas.slice(1).reduce((s, v) => s + traslado(v, p), 0);
  p.bajada = viaje(p.desde + p.subida + resto + 6, ult);
  // si la última foto mira lejos de hacia donde va el caminante (Cubaocho: la esquina mira al ENE y él camina al oeste,
  // 157°), la vuelta dura lo que pide ese giro a GIRO_VUELTA °/s: si no, la cámara se daba vuelta en 2 s, de golpe
  const giroVuelta = Math.abs(difAng(ult.rumbo, estado(p.desde + p.subida + resto).rumbo));
  p.bajada = Math.max(p.bajada, Math.min(GIRO_VUELTA_MAX, giroVuelta / GIRO_VUELTA));
  p.hasta = p.desde + p.subida + resto + p.bajada;
  p.inicio = p.desde;
  // la anticipación no empieza antes de que termine de soltarse el lugar anterior (si no, la cabeza salta de uno a otro)
  p.anticipa = prev ? clamp(p.inicio - (prev.hasta + SUELTA), 2, ANTICIPA) : ANTICIPA;
});
// el último puede terminar después del audio: el recorrido cierra con la imagen recompuesta. Pero si la cámara ni
// siquiera llegaría al primer punto de vista antes del final, ese travelling no se hace.
for (let i = PROYS.length - 1; i >= 0; i--) if (PROYS[i].desde + PROYS[i].subida > K[K.length - 1].t - 2) PROYS.splice(i, 1);
// conCaminanteDesde (recorrido.js): la huella pasa a acompañar al caminante como una `conCaminante` (entera, desde lejos,
// apagada sólo mientras la cámara se va a un punto de vista) recién cuando la cámara empieza a volver a sus ojos después
// del travelling de ese otro lugar (el Tower desde El Pub). Antes, la huella se comporta como cualquier otra.
for (const p of PROYS) {
  if (!p.conCaminanteDesde) continue;
  const q = PROYS.find((o) => o.lugar === p.conCaminanteDesde);
  if (!q) { console.warn(`recorrido.js: conCaminanteDesde '${p.conCaminanteDesde}' no es un lugar con travelling`); continue; }
  p.desdeCaminante = q.hasta - q.bajada;
  for (const v of p.huellas) v.siempreDesde = p.desdeCaminante;   // desde ahí tampoco cede su ranura (ver prio)
}
// ── ARRANQUE: la foto del punto de partida (recorrido.js → lugar con `arranque: true`) ──
// La partida (el travelling del dron a la vereda, ver iniciarPartida) no baja a los ojos del caminante sino al punto
// exacto donde se tomó la foto, y la foto se va encendiendo mientras baja: al llegar, la imagen ocupa la pantalla
// recompuesta sobre la cuadra en 3D (Fantasma). La cámara termina de acomodarse al eje de la foto (ARRANQUE_GIRO), se
// queda quieta CONTEMPLA segundos y después avanza por la vereda hasta alcanzar al caminante, que ya empezó a andar:
// se entra en la escena y la foto se descompone sobre las fachadas. Los tiempos de ese tramo se fijan al llegar (la
// partida va con el reloj, no con el audio). Si no hay partida (sin panorámica, ?t=…), es un travelling común desde t = 0.
const ARRANQUE = PROYS.find((p) => p.arranque) || null;
const ARRANQUE_QUIETO = 7;  // segundos quieta en la foto al llegar
const ARRANQUE_PASO = 3.4;   // metros por segundo con que la cámara camina de la foto hasta alcanzar al caminante
const ARRANQUE_GIRO = 0.05;  // segundos en que la cámara pasa de la mirada de la partida al eje de la foto (casi nada:
                             // la partida ya llega con el cuadro exacto de la foto)
const ARRANQUE_MIRADA = 3;   // segundos en que, al echar a andar desde la foto, la mirada pasa del eje de la foto (13,6° hacia
                             // abajo) a la del caminante: si seguía el peso del travelling (w), miraba el piso media caminata
const ARRANQUE_FANTASMA = [0.86, 1];   // tramo de la partida en que la maqueta vuelve a Fantasma al llegar a la foto
let arranqueListo = true;    // false mientras dura la partida que baja a la foto
if (ARRANQUE) ARRANQUE.orig = { desde: ARRANQUE.desde, inicio: ARRANQUE.inicio, subida: ARRANQUE.subida, bajada: ARRANQUE.bajada, hasta: ARRANQUE.hasta };
// al empezar (o volver a empezar): con partida, la foto espera la llegada; sin partida, tramo común
function prepararArranque(conPartida) {
  if (!ARRANQUE) return;
  Object.assign(ARRANQUE, ARRANQUE.orig, { desdeFoto: false });
  arranqueListo = !conPartida;
}
// la partida llegó al punto de vista de la foto en el momento t del audio
function reprogramarArranque(t) {
  if (!ARRANQUE || arranqueListo) return;
  arranqueListo = true;
  if (t > ARRANQUE.orig.hasta) return;   // se empezó más adelante (?t=…): ya no corresponde
  const p = ARRANQUE, n = p.vistas.length;
  // (la quietud en la foto es un poco más corta que CONTEMPLA: el giro ya la hace quieta y el caminante se aleja)
  const resto = n * ARRANQUE_QUIETO + p.vistas.slice(1).reduce((s, v) => s + traslado(v, p), 0);
  p.desde = p.inicio = t;
  p.subida = ARRANQUE_GIRO;
  // la bajada es una caminata por la vereda hasta alcanzar al caminante: dura lo que pide la distancia que hay que
  // recorrer a ARRANQUE_PASO (el caminante también avanza mientras tanto)
  const tb = t + p.subida + resto, V = p.vistas[n - 1].pos;
  let b = 8;
  // (el camino es el de caminoArranque: hasta el comienzo del recorrido y de ahí por donde fue el caminante)
  const e0 = estado(0), P0 = aLocal([e0.lng, e0.lat]), D0 = Math.hypot(V[0] - P0[0], V[1] - P0[1]);
  for (let i = 0; i < 4; i++) b = clamp((D0 + estado(tb + b).d - e0.d) / ARRANQUE_PASO, 6, 24);
  p.bajada = b;
  p.hasta = tb + p.bajada;
  p.desdeFoto = true;   // hasta la bajada, la cámara sale del punto de vista y no de los ojos del caminante
  const i = PROYS.indexOf(p), sig = PROYS[i + 1];
  if (sig && sig.inicio < p.hasta + SUELTA + 2) console.warn('arranque: se pisa con', sig.lugar);
  if (sig) sig.anticipa = clamp(sig.inicio - (p.hasta + SUELTA), 2, ANTICIPA);
}
// 0…1: la cámara del arranque ya dejó la foto y camina por la vereda (0 durante la partida y mientras mira la foto)
const CAMINA_FUNDIDO = 2.5;   // segundos en que se encienden las huellas `desdeLejos` al echar a andar
function caminaArranque(t) {
  if (!ARRANQUE) return 1;
  if (!arranqueListo) return 0;
  return suave(clamp((t - (ARRANQUE.hasta - ARRANQUE.bajada)) / CAMINA_FUNDIDO, 0, 1));
}
// posición del punto de vista de la foto del arranque (adonde baja la partida)
const posArranque = () => ARRANQUE && ARRANQUE.vistas[0].pos;
const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
if (PARAMS.has('tramos')) console.log('travellings:\n' + PROYS.map((p) => `${mmss(p.desde)}–${mmss(p.hasta)}  ${p.lugar} (${p.vistas.length} vista${p.vistas.length > 1 ? 's' : ''})`).join('\n'));

// peso de cada vista de una proyección en el momento t (una a la vez, con fundidos). El tiempo entre la
// llegada (después de la subida) y la partida (antes de la bajada) se reparte en partes iguales.
function pesosProy(p, t) {
  const n = p.vistas.length, a = p.desde + p.subida, D = Math.max(0, p.hasta - p.bajada - a);
  const pesos = [1];
  for (let k = 1; k < n; k++) {
    const tr = traslado(p.vistas[k], p);
    const f = suave(clamp((t - (a + (k * D) / n) + tr / 2) / tr, 0, 1));
    for (let j = 0; j < k; j++) pesos[j] *= 1 - f;
    pesos[k] = f;
  }
  return pesos;
}
// OLA: cuando un lugar pasa de una imagen a otra (entre dos vistas, al empezar si la huella no es la primera vista,
// y al terminar si la última no es la huella) no hay fundido: las dos quedan encendidas y un frente sale del lugar y
// se expande por la ciudad cambiando una por otra (ver ola() en ciudad.js). f = avance 0…1.
// (sale y entra pueden ser listas: las huellas superpuestas de un lugar se van o vuelven juntas)
// (centro: de dónde sale la ola si `entra` está vacío; por defecto, la mira de la primera que entra)
const olaEntre = (p, sale, entra, f, centro) => ({
  lados: Object.fromEntries([...[sale].flat().map((v) => [v.idx, -1]), ...[entra].flat().map((v) => [v.idx, 1])]),
  centro: centro || [entra].flat()[0].mira,
  radio: p.radioOla * Math.pow(f, 1.6),
  luz: Math.sqrt(Math.sin(Math.PI * clamp(f, 0, 1))),
  fin: suave(clamp((f - 0.8) / 0.2, 0, 1)),   // lo que queda más allá del frente se completa con un fundido (ver ola())
  p,   // (de qué lugar es: ver SALEN CON LA OLA en intensidades)
  f,   // (el cielo de la saliente se apaga al empezar: ver actualizarCielos en ciudad.js)
});
// la saliente se termina de apagar al final de la ola (por si algo de su imagen cae más allá del radio)
const resto = (f) => 1 - suave(clamp((f - 0.8) / 0.2, 0, 1));
PROYS.forEach((p) => {
  // la última vista es un diorama (isométrica, alta): la bajada no va en diagonal sobre los techos (ver bajadaAlta)
  p.ultAlta = !!p.vistas[p.vistas.length - 1].isometrica;
  // hasta dónde llega la ola: un poco más que la distancia de las cámaras al lugar (120…320 m)
  const d = Math.max(...p.vistas.map((v) => Math.hypot(v.pos[0] - v.mira[0], v.pos[1] - v.mira[1], v.pos[2] - v.mira[2])));
  p.radioOla = clamp(d * 1.5 + 60, 120, 320);
});
const PRIO_ADELANTE = 25;   // s: ver prio en intensidades()
function intensidades(t) {
  const arr = new Array(VISTAS.length).fill(0);
  let ola = null;
  // un lugar con varios tramos (vuelve) aparece varias veces en PROYS: manda el tramo en curso o más cercano
  const activo = (p) => t >= p.inicio - p.anticipa && t < p.hasta + POST;
  const enCurso = new Set(PROYS.filter(activo).map((p) => p.grupo));
  // mientras se mira un lugar (desde que la cabeza gira hacia él hasta que vuelve la huella) las huellas de los
  // demás se apagan: si no, se superponen a la imagen (p. ej. el dron del Tower cubre toda la vereda sur)
  // (la foto del arranque sólo apaga las huellas mientras se la mira quieta: cuando la cámara echa a andar por la
  // vereda, las huellas `desdeLejos` se encienden encima de ella; ver caminaArranque)
  let foco = 0, focoLejos = 0, focoAntes = 0;
  for (const p of PROYS) {
    if (!activo(p)) continue;
    const f = t < p.inicio ? suave((t - p.inicio + p.anticipa) / p.anticipa)
      : t <= p.hasta ? 1 : 1 - suave((t - p.hasta) / POST);
    foco = Math.max(foco, f);
    if (t < p.inicio) focoAntes = Math.max(focoAntes, f);   // (sólo la cabeza girando hacia el lugar: ver `fondo`)
    focoLejos = Math.max(focoLejos, p === ARRANQUE ? f * (1 - caminaArranque(t)) : f);
  }
  // las huellas aparecen de a poco a medida que el caminante se acerca (entre 150 y 70 m de la fachada): así no
  // saltan de golpe y, como se ordenan por intensidad, las 6 ranuras quedan para los lugares más cercanos
  const e = estado(t), [cx, cy] = aLocal([e.lng, e.lat]);
  // (las `desdeLejos` no esperan a que el caminante se acerque: se ven desde el principio de la cuadra)
  const conCam = (p) => p.conCaminante || t >= p.desdeCaminante;   // (ver conCaminanteDesde)
  const cerca = (p) => p.desdeLejos || conCam(p) ? 1 : suave(clamp((150 - Math.hypot(p.huella.mira[0] - cx, p.huella.mira[1] - cy)) / 80, 0, 1));
  // (las `conCaminante` se ven siempre que la cámara está en los ojos del caminante, aunque él esté mirando otro lugar:
  // sólo se apagan mientras la cámara se va a un punto de vista, o mientras se mira quieta la foto del arranque)
  const vu = vuelo(t);
  // (cuánto se fue la cámara de los ojos del caminante: las huellas que lo acompañan vuelven recién cuando la cámara
  // está por llegar a la vereda; si no, se encendían desde 30 m de altura, deformadas sobre los techos)
  const fueraDe = (w) => suave(clamp(w / 0.2, 0, 1));
  const fuera = vu && vu.p !== ARRANQUE ? fueraDe(vu.w) : ARRANQUE ? 1 - caminaArranque(t) : 0;
  const apaga = (p) => (conCam(p) ? fuera : p.desdeLejos ? focoLejos : foco);
  // SALEN CON LA OLA: mientras la cabeza gira hacia un lugar (anticipación), las huellas de los demás que se apagan
  // por el foco no se van con un fundido sino con la ola, que sale de la primera vista de ese lugar. Con el fundido,
  // a mitad de camino la imagen que se encendía les quitaba la ranura del shader y desaparecían de golpe (la esquina
  // de la 17 Av. al girar hacia 1652, ~8:02). `salen`: { idx, base } con la intensidad que tendrían sin el foco.
  const gira = PROYS.find((p) => t >= p.inicio - p.anticipa && t < p.inicio && !(p === ARRANQUE && !arranqueListo));
  const fGira = gira ? suave((t - gira.inicio + gira.anticipa) / gira.anticipa) : 0;
  const salen = [];
  const conOla = (p) => gira && p.grupo !== gira.grupo && !conCam(p);
  const hechos = new Set();
  for (const p of PROYS) {
    if (activo(p) ? false : enCurso.has(p.grupo) || hechos.has(p.grupo)) continue;
    hechos.add(p.grupo);
    const v0 = p.vistas[0].idx, ult = p.vistas[p.vistas.length - 1].idx, h = p.huella.idx;
    // la foto del arranque se enciende mientras la partida baja hacia su punto de vista (ARRANQUE)
    if (p === ARRANQUE && !arranqueListo) {
      arr[v0] = pano && pano.partida ? suave(clamp((pano.partida.f - 0.6) / 0.35, 0, 1)) : 0;
      continue;
    }
    // huellas superpuestas (varias vistas con huella: true): en reposo están todas; al empezar se van todas menos la
    // primera vista, y al terminar vuelven todas menos la última (ésas pasan de 1 a REPOSO sin ola)
    if (p.huellas.length > 1 && !(t >= p.inicio && t <= p.hasta)) {
      const H = p.huellas, vUlt = p.vistas[p.vistas.length - 1], vPri = p.vistas[0];
      if (t > p.hasta && t < p.hasta + POST) {
        const f = suave((t - p.hasta) / POST), vuelven = H.filter((v) => v !== vUlt);
        for (const v of vuelven) arr[v.idx] = REPOSO;
        if (H.includes(vUlt)) arr[ult] = 1 - (1 - REPOSO) * f; else arr[ult] = resto(f);
        if (vuelven.length) ola = olaEntre(p, H.includes(vUlt) ? [] : vUlt, vuelven, f);
      } else if (t >= p.inicio - p.anticipa && t < p.inicio) {
        const f = suave((t - p.inicio + p.anticipa) / p.anticipa), salen = H.filter((v) => v !== vPri);
        for (const v of salen) arr[v.idx] = REPOSO * resto(f);
        arr[v0] = REPOSO + (1 - REPOSO) * f;
        // si la primera vista ya estaba como huella no "entra" con la ola (se borraba y reaparecía en granos al
        // acercarse: el detalle de El Cristo): sólo se van las otras, desde ella
        if (salen.length) ola = H.includes(vPri) ? olaEntre(p, salen, [], f, vPri.mira) : olaEntre(p, salen, vPri, f);
      } else for (const v of H) {
        arr[v.idx] = REPOSO * (1 - apaga(p)) * cerca(p);
        if (conOla(p)) salen.push({ idx: v.idx, base: REPOSO * cerca(p) });
      }
      continue;
    }
    if (t >= p.inicio && t <= p.hasta) {
      const pesos = pesosProy(p, t);
      pesos.forEach((w, k) => (arr[p.vistas[k].idx] = w));
      // entre dos vistas: las dos enteras, y la ola decide qué se ve dónde
      for (let k = 1; k < pesos.length; k++) {
        const f = pesos[k] / (pesos[k] + pesos[k - 1] || 1);
        if (f > 0 && f < 1 && pesos[k] + pesos[k - 1] > 0.99 && esFundido(p.vistas[k])) {
          // fundido: primero se apaga la anterior y después se enciende la nueva (sin ola)
          arr[p.vistas[k - 1].idx] = 1 - suave(clamp(f / 0.5, 0, 1));
          arr[p.vistas[k].idx] = suave(clamp((f - 0.5) / 0.5, 0, 1));
        } else if (f > 0 && f < 1 && pesos[k] + pesos[k - 1] > 0.99) {
          const vA = p.vistas[k - 1], vB = p.vistas[k];
          // si la cámara sube o baja de una a otra (un diorama, un dron), la saliente se apaga al principio del vuelo:
          // desde el aire se ve sólo la imagen que se está por mirar (si no, quedaba aplastada en una tira sobre los
          // techos). Entre dos fotos de la vereda, la ola cambia una por otra.
          const aRas = vA.pos[2] < 3 && vB.pos[2] < 3;
          arr[vA.idx] = aRas ? resto(f) : 1 - suave(clamp(f / 0.3, 0, 1));
          arr[vB.idx] = 1;
          ola = olaEntre(p, aRas ? vA : [], vB, f);
        }
      }
      // vistas con `sobre`: la vista de abajo sigue encendida mientras pesa la de arriba, y la ola no la borra
      p.vistas.forEach((v, k) => {
        if (!v.sobre || !(arr[v.idx] > 0)) return;
        arr[v.sobre.idx] = Math.max(arr[v.sobre.idx] || 0, arr[v.idx]);
        if (ola && ola.lados[v.sobre.idx] === -1 && ola.lados[v.idx] === 1) delete ola.lados[v.sobre.idx];
      });
    } else if (t > p.hasta && t < p.hasta + POST) { // la última vista se apaga y vuelve la huella
      const f = suave((t - p.hasta) / POST);
      if (ult !== h) {
        arr[ult] = resto(f);
        arr[h] = REPOSO;
        ola = olaEntre(p, p.vistas[p.vistas.length - 1], p.huella, f);
      } else arr[h] = p.sinHuella ? 1 - f : 1 - (1 - REPOSO) * f;   // sinHuella: se apaga del todo
    } else if (t >= p.inicio - p.anticipa && t < p.inicio) { // la huella cede el lugar a la primera vista
      const f = suave((t - p.inicio + p.anticipa) / p.anticipa);
      if (v0 !== h) {
        arr[h] = REPOSO * resto(f);
        arr[v0] = REPOSO + (1 - REPOSO) * f;
        ola = olaEntre(p, p.huella, p.vistas[0], f);
      } else if (p.entraConOla && !ola) {
        // entraConOla (El Pub): en vez de subir de REPOSO a 1 con un fundido, la foto entra entera con la ola, desde
        // su centro (la mira) hacia afuera. Mientras tanto, lo que el frente todavía no alcanzó queda sin imagen.
        arr[h] = 1;
        ola = olaEntre(p, [], p.huella, f);
      } else arr[h] = REPOSO + (1 - REPOSO) * f; // la huella es la primera vista: sube de REPOSO a 1
    } else if (p.entraConOla && t < p.inicio) {
      // entraConOla (El Pub): antes de su travelling la foto no está (ni siquiera como huella tenue, que aparecía con un
      // fundido al acercarse): la primera vez que se ve es cuando entra con la ola
      arr[h] = 0;
    } else if (!p.sinHuella && (p.entraConOla || p.vistas.some((v) => v.fondo))) {
      // (entraConOla, después de su travelling: si la huella se apagó mientras se miraba otro lugar, vuelve con la ola)
      // sobre una vista `fondo` (Ball & Chain: la esquina) la huella no aparece con un fundido a medida que el caminante
      // se acerca, sino con la ola, desde el centro de la foto hacia afuera. (La ola es una sola: si en ese momento la
      // usa otro lugar, queda el fundido.)
      // Mientras se mira otro lugar está apagada; cuando ese travelling termina del todo (con su ola de vuelta), la ola
      // de ésta corre OLA_HUELLA segundos. (La ola es una sola: si en ese momento la usa otro lugar, queda el fundido.)
      const libre = Math.max(-1e9, ...PROYS.filter((q) => q.grupo !== p.grupo && q.hasta + POST <= t).map((q) => q.hasta + POST));
      const c0 = Math.min(cerca(p), clamp((t - libre) / OLA_HUELLA, 0, 1));
      const c = apaga(p) > 0.001 ? 0 : c0;
      if (conOla(p) && c0 >= 1) salen.push({ idx: h, base: REPOSO * c0 });
      if (c > 0 && c < 1 && !ola) { arr[h] = REPOSO; ola = olaEntre(p, [], p.huella, c); }
      else arr[h] = REPOSO * c;
    } else {
      arr[h] = p.sinHuella ? 0 : REPOSO * (1 - apaga(p)) * cerca(p);
      if (!p.sinHuella && conOla(p)) salen.push({ idx: h, base: REPOSO * cerca(p) });
    }
  }
  // (la ola es una sola: si el lugar hacia el que se gira ya tiene la suya, las huellas de los demás se suman a ella;
  // si la está usando otro lugar, queda el fundido)
  const olaGira = salen.some((s) => s.base > 0.002) && (!ola || ola.p === gira);
  if (olaGira) {
    if (!ola) ola = olaEntre(gira, [], [], fGira, gira.vistas[0].mira);
    for (const s of salen) if (s.base > 0.002) { arr[s.idx] = s.base * resto(fGira); ola.lados[s.idx] = -1; }
  }
  // la imagen del lugar hacia el que se gira: si al empezar el giro no estaba proyectada (le faltaba ranura o todavía no
  // se veía), entra con la misma ola, desde su centro, en vez de aparecer de golpe cuando consigue la ranura
  for (const p of PROYS) if (p !== gira) p.olaEntraDesde = null;
  const hGira = gira && gira.huellas.length <= 1 && gira.vistas[0] === gira.huella && !gira.entraConOla ? gira.huella.idx : -1;
  if (hGira >= 0 && gira.olaEntraDesde !== gira.inicio) {
    gira.olaEntraDesde = gira.inicio;
    gira.olaEntra = !!ciudad && !ciudad.enRanura(hGira);
  }
  if (hGira >= 0 && gira.olaEntra && (!ola || ola.p === gira)) {
    if (!ola) ola = olaEntre(gira, [], gira.huella, fGira);
    ola.lados[hGira] = 1;
  }
  // vistas `fondo`: sólo mientras la cámara está con el caminante (en los ojos del que recorre la vereda), tenues
  // como una huella y DEBAJO de las demás vistas del lugar (que van en capas más altas). En cuanto la cámara sale hacia
  // un punto de vista se apagan: desde ahí se ve sólo la imagen que se está por mirar (la vista `fondo` misma, si es
  // la que toca, se enciende por su peso como cualquier otra).
  // Mientras se mira OTRO lugar también se apagan, pero vuelven ya en la vuelta de la cámara al caminante (en la primera
  // mitad de la bajada), no después: al volver de la esquina de Cubaocho la cámara gira hacia la esquina de enfrente
  // (la tabaquería y Ball & Chain), que quedaba gris, sin textura, hasta que la última foto se apagaba.
  const vuelveFondo = vu && vu.baja ? 1 - suave(clamp((1 - vu.xb) / 0.5, 0, 1)) : vu ? 1 : focoAntes;
  for (const p of PROYS) {
    const sale = activo(p) ? (vu && vu.p === p ? fueraDe(vu.w) : 0) : vuelveFondo;
    for (const v of p.vistas) if (v.fondo) {
      arr[v.idx] = Math.max(arr[v.idx] || 0, REPOSO * cerca(p) * (1 - sale));
      // (mientras la cabeza gira hacia otro lugar, también se van con la ola: ver SALEN CON LA OLA)
      if (olaGira && !vu && !activo(p) && p.grupo !== gira.grupo) { arr[v.idx] = REPOSO * cerca(p) * resto(fGira); ola.lados[v.idx] = -1; }
    }
  }
  // prioridad para las 6 ranuras del shader (ver setIntensidades en ciudad.js): la intensidad más la cercanía de la
  // fachada al caminante. En reposo todas las huellas valen lo mismo (REPOSO) y, sin esto, las de los lugares que
  // quedaron atrás no soltaban la ranura: la foto grande de El Cristo no llegaba a verse al acercarse.
  // La cercanía se mide desde donde va a estar el caminante dentro de PRIO_ADELANTE s: así ganan los lugares hacia los
  // que camina y no los que dejó atrás (si no, Ball & Chain retenía la ranura y El Cristo aparecía recién encima).
  const [ax, ay] = aLocal((({ lng, lat }) => [lng, lat])(estado(t + PRIO_ADELANTE)));
  const prio = arr.map((a, k) => (a > 0 ? a + 0.6 * (VISTAS[k].siempre || t >= VISTAS[k].siempreDesde ? 1 : clamp(1 - Math.hypot(VISTAS[k].mira[0] - ax, VISTAS[k].mira[1] - ay) / 200, 0, 1)) : 0));
  // una vista `fondo` va con la huella de su lugar (la foto 1 de Ball & Chain encima de la esquina): con 13 imágenes
  // encendidas quedaba séptima y perdía la ranura justo cuando aparecía la foto 1. Vale lo mismo que la huella.
  for (const p of PROYS) for (const v of p.vistas) if (v.fondo && prio[v.idx] > 0) prio[v.idx] = Math.max(prio[v.idx], prio[p.huella.idx] - 0.001);
  // las que se van con la ola (SALEN CON LA OLA) miden la cercanía desde donde está el caminante AHORA: son las que lo
  // rodean, y si pierden la ranura antes de que pase el frente desaparecen de golpe (la esquina de la 17 Av., que ya
  // quedó atrás del punto adelantado, la perdía con la foto de 1652)
  // (y la imagen del lugar hacia el que se gira tiene ranura desde que empieza el giro: si no, la conseguía a mitad de
  // camino, cuando subía lo suficiente, y aparecía de golpe)
  if (gira) prio[gira.vistas[0].idx] += 2;
  // (lo mismo, un poco menos, la del próximo lugar al que se va a mirar: si no, la huella de un lugar que ya quedó atrás
  // le quitaba la ranura a la de 1652 mientras el caminante caminaba hacia ella y desaparecía de golpe, ~7:52)
  const proximo = PROYS.find((p) => t < p.inicio - p.anticipa);
  if (proximo && prio[proximo.huella.idx] > 0) prio[proximo.huella.idx] += 1;
  if (olaGira) for (const s of salen) if (prio[s.idx] > 0 && !VISTAS[s.idx].siempre)
    prio[s.idx] = arr[s.idx] + 0.6 * clamp(1 - Math.hypot(VISTAS[s.idx].mira[0] - cx, VISTAS[s.idx].mira[1] - cy) / 200, 0, 1);
  return { arr, ola, prio };
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
// Encuadre de una vista en esta pantalla: la foto entra entera y queda CENTRADA en la zona libre, como un
// rectángulo (sin trapecio). La pantalla que se busca es la de una cámara en la posición del proyector que mira
// exactamente por su eje (rumbo, cabeceo y giro de la foto): desde ahí el plano de la imagen es paralelo a la
// pantalla. Para centrar sin mover ni girar la cámara se corre el centro óptico de la pantalla (xp, yp, en
// fracción del ancho y del alto), compensando también el `centro` de la foto (el centro óptico de la imagen no
// siempre es el centro de la imagen). MapLibre no puede mirar por ese eje cuando la foto mira al horizonte o más
// arriba (pitch máximo PITCH_CALLE): la diferencia la corrige rectificar(), con una homografía sobre el canvas.
const MARGEN_LADOS = 0.06;   // fracción del ancho de la pantalla que queda libre a cada lado de la foto
function encuadre(v) {
  const W = window.innerWidth, H = window.innerHeight, z = zonaLibre();
  const th = Math.tan((v.apertura * RAD) / 2) / (v.alejar || 1), tv = (th / v.aspecto) * (v.estirar || 1), c = v.centro || [0, 0];
  if (v.cubrir) {   // llena toda la pantalla (se recorta lo que sobra), centrada
    const f = Math.max(W / (2 * th), H / (2 * tv));
    return { fov: (2 * Math.atan(H / 2 / f)) / RAD, xp: 0.5 + (f * c[0] * th) / W, yp: 0.5 - (f * c[1] * tv) / H, ax: 1, ay: 1 };
  }
  // (siempre con margen a los costados: con el 3 % que tenía, las fotos apaisadas en un celular vertical parecían
  // ocupar todo el ancho y otras quedaban con margen; ahora todas dejan MARGEN_LADOS a cada lado, como mínimo)
  const f = Math.min((W * (1 - 2 * MARGEN_LADOS)) / (2 * th), z.alto / (2 * 1.04 * tv));
  // en la imagen proyectada, el centro de la foto está en (−c0·th, −c1·tv) respecto del eje (tangentes)
  // (ax, ay: medio ancho y medio alto de la foto en pantalla, en fracción del ancho y del alto: ver dibujar → foto)
  return { fov: (2 * Math.atan(H / 2 / f)) / RAD, xp: 0.5 + (f * c[0] * th) / W, yp: (z.arriba + z.alto / 2 - f * c[1] * tv) / H,
    ax: (f * th) / W, ay: (f * tv) / H };
}
// encuadre de la equivalente cercana de una vista isométrica: el mismo cuadro con `iso` veces más campo de visión
function encuadreEq(v) {
  const e = encuadre(v);
  if (v.iso <= 1) return e;
  return { ...e, fov: (2 * Math.atan(Math.tan((e.fov / 2) * RAD) * v.iso)) / RAD, ax: e.ax / v.iso, ay: e.ay / v.iso };
}
// avance de 0 a 1 con velocidad trapezoidal: acelera en el primer 30 %, parejo en el medio, frena en el último 30 %
function parejo(u, a = 0.3) {
  const vp = 1 / (1 - a);
  if (u < a) return (vp * u * u) / (2 * a);
  if (u > 1 - a) return 1 - (vp * (1 - u) * (1 - u)) / (2 * a);
  return vp * (u - a / 2);
}
// vuelo activo en t: w = 0 (ojos del caminante) … 1 (punto de vista de la imagen)
function vuelo(t) {
  for (const p of PROYS) {
    if (t < p.inicio || t > p.hasta || (p === ARRANQUE && !arranqueListo)) continue;
    const pesos = pesosProy(p, t);
    // hacia una vista con fundido la cámara no viaja: salta de un punto de vista al otro a mitad del fundido (a oscuras)
    for (let k = 1; k < pesos.length; k++) {
      const s = pesos[k] + pesos[k - 1];
      if (esFundido(p.vistas[k]) && pesos[k] > 0 && pesos[k - 1] > 0) { const f = pesos[k] / s; pesos[k] = f < 0.5 ? 0 : s; pesos[k - 1] = s - pesos[k]; }
    }
    const v0 = p.vistas[0], e0 = encuadreEq(v0);
    let m = [...v0.mira], { th, r, z } = v0.polar, fov = e0.fov, xp = e0.xp, yp = e0.yp, ax = e0.ax, ay = e0.ay, giro = v0.giro, lnIso = v0.lnIso;
    let dR = v0.dR, dP = v0.dP;
    for (let k = 1; k < pesos.length; k++) {
      const f = pesos[k] / (pesos[k] + pesos[k - 1] || 1);
      if (f <= 0) continue;
      const v = p.vistas[k], ev = encuadreEq(v), vA0 = p.vistas[k - 1];
      // entre dos fotos tomadas a la altura de la calle la cámara va EN LÍNEA RECTA de un punto de vista al otro (por
      // la vereda). En polares (ángulo y distancia alrededor de la mira) describía un arco que se alejaba de la
      // fachada y se metía en los volúmenes de enfrente: subía por encima de los techos de a saltos y la imagen se
      // duplicaba y se rompía (Ball & Chain, de la primera foto a la de la esquina)
      const recta = v.pos[2] < 3 && vA0.pos[2] < 3;
      const cA = recta ? desdePolar(m, th, r, z) : null;
      m = m.map((c, i) => c + (v.mira[i] - c) * f);
      if (recta) ({ th, r, z } = polar(cA.map((c, i) => c + (v.posEq[i] - c) * f), m));
      else { th += difAng(th, v.polar.th) * f; r += (v.polar.r - r) * f; z += (v.polar.z - z) * f; }
      fov += (ev.fov - fov) * f; xp += (ev.xp - xp) * f; yp += (ev.yp - yp) * f; ax += (ev.ax - ax) * f; ay += (ev.ay - ay) * f; giro += (v.giro - giro) * f; lnIso += (v.lnIso - lnIso) * f;
      dR += (v.dR - dR) * f; dP += (v.dP - dP) * f;
      // entre una vista y otra la cámara se aleja y sube un poco: la imagen se deshace antes de rearmarse. Si los dos
      // puntos de vista están cerca (p. ej. las dos fotos de Guantanamera, a 3 m), no: la cámara va derecho de uno
      // al otro acompañando la ola (alejarse y subir, pegada a la pared, la hacía cabecear y abrir el campo de visión)
      // Tampoco entre dos fotos tomadas a la altura de la calle: alejarse de la fachada metía la cámara en los volúmenes
      // de la vereda de enfrente y tenía que subir por encima de los techos (Ball & Chain: de la primera foto a la de la
      // esquina subía a 10 m y la imagen se rompía en el camino)
      const vA = p.vistas[k - 1], dV = Math.hypot(v.pos[0] - vA.pos[0], v.pos[1] - vA.pos[1], v.pos[2] - vA.pos[2]);
      const b = v.pos[2] < 3 && vA.pos[2] < 3 ? 0 : Math.sin(Math.PI * f) * suave(clamp((dV - 5) / 25, 0, 1));
      r *= 1 + 0.3 * b; z *= 1 + 0.35 * b;
    }
    // (en el arranque, la bajada es una caminata: acelera, va a paso parejo y se funde con el paso del caminante)
    const xb = clamp((p.hasta - t) / p.bajada, 0, 1);
    // (el arranque no tiene subida: la partida ya llega con el cuadro exacto de la foto; un tramo de subida, aunque
    // fuera de 0,05 s, pasaba por un encuadre intermedio y daba un tirón de tres cuadros al llegar)
    const w = (p.desdeFoto ? 1 : suave(clamp((t - p.inicio) / p.subida, 0, 1))) * (p.desdeFoto ? 1 - parejo(1 - xb) : suave(xb));
    // cuánto pesan los dioramas en este momento (para ocultar lo que los tapa: ciudad.setCorte)
    const kIso = pesos.reduce((a, q, i) => a + (p.vistas[i].isometrica ? q : 0), 0);
    // …y las fotos con `corte` (recorrido.js), cuya cámara queda dentro o detrás de volúmenes de la vereda de enfrente
    const kCorte = pesos.reduce((a, q, i) => a + (p.vistas[i].corte ? q : 0), 0);
    // bajada desde una foto tomada de cerca (a menos de CERCANA m de lo que mira): ver camaraCalle
    // (las vistas con `profundidad` tienen la mira sobre la fachada: hasta CERCANA_PROF m también. Top Cigars, la foto de
    // enfrente, a 18 m: apuntándole a la mira la cámara giraba +30° al pasar a su costado y después barría 110° en 2 s)
    const vU = p.vistas[p.vistas.length - 1];
    const bajaCerca = t > p.hasta - p.bajada && vU.polar.r < (vU.profundidad ? CERCANA_PROF : CERCANA);
    // las vistas entre las que va la cámara están todas a la altura de la calle (ver esquivarEdificios)
    const aRas = pesos.every((q, i) => q <= 0 || p.vistas[i].pos[2] < 3);
    const baja = t > p.hasta - p.bajada;   // la cámara vuelve a los ojos del caminante (ver camaraCalle → fv)
    // bajada desde una vista alta (un diorama): primero se acerca a la imagen y después gira hacia el caminante
    // (ver bajadaAlta). ub = avance de la bajada, de 0 a 1
    const bajaAlta = !p.desdeFoto && p.ultAlta && baja;
    return { p, w, k: pesos.indexOf(Math.max(...pesos)), T: m, polarV: { th, r, z }, fov, xp, yp, ax, ay, dR, dP, giro, lnIso, kIso, kCorte, bajaCerca, aRas, baja, xb, bajaAlta, ub: 1 - xb };
  }
  return null;
}
const CERCANA = 12, CERCANA_PROF = 20;
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
audio.preload = 'auto';   // se baja mientras carga el resto: al tocar Start, el sonido arranca sin cortes
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
// relleno: la foto cae también en lo que el dron no ve (ciudad.js → proy), sin huecos oscuros al descomponerse
const VISTA_PANO = INICIO_PANO ? { ...normalizar(PANO, aLocal), lejos: PANO.lejos, relleno: true } : null;
const nuevoPano = () => ({ vista: VISTA_PANO, ciudad: null, listo: 0, cuadros: 0, apagando: 0, vuelta: null });
let pano = INICIO_PANO ? nuevoPano() : null;
let crear3D = null;   // { THREE, crearCiudad }: para volver a armar la ciudad de la panorámica al terminar

const elCaminante = document.createElement('div');
elCaminante.className = 'caminante';
const marcador = new maplibregl.Marker({ element: elCaminante }).setLngLat([K[0].lng, K[0].lat]);
const bounds = coordsRuta.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(coordsRuta[0], coordsRuta[0]));

let capaRegistros = null;
let ciudad = null;
let estilos = null;   // Fantasma y Maqueta, y el fundido entre los dos (estilos.js)
let mezclaEstilo = INICIO_PANO ? 0 : 1;   // 0 = Fantasma, 1 = Maqueta
// fondo Vacío (sin mapa base ni horizonte, estilos.js → VACIO) en vez de Fantasma: en la panorámica y la partida,
// hasta que la maqueta termina de aparecer, y otra vez en la vuelta al dron
let fondoVacio = INICIO_PANO;

// (estilo listo: se marca una sola vez; ver cuadro)
let estiloListo = false;
map.on('load', async () => {
  estiloListo = true;
  CARGA.mapa();
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
        // frames del video de la caminata en las fachadas (paredes-video.js); ?sinvideo los apaga
        // la textura arranca oculta (opacidad 0): sólo se enciende con la tecla T
        paredes: PARAMS.has('sinvideo') || !window.PAREDES_VIDEO ? null : { ...window.PAREDES_VIDEO, opacidad: 0, collage: PARAMS.has('collage') },
      });
      map.setLayoutProperty('edificios-3d', 'visibility', 'none');
      window.__ciudad = ciudad; // para depurar desde la consola
    } catch (e) { console.warn('No se pudo armar la ciudad 3D', e); }
    capaRegistros = crearCapaRegistros(THREE);
    map.addLayer(capaRegistros);
  } catch (e) { console.warn('No se pudieron cargar los registros 3D', e); }
  // los estilos se aplican a la ciudad del recorrido y a la de la panorámica (si ya está)
  const ambas = { setEstilo: (est) => { if (ciudad) ciudad.setEstilo(est); if (pano && pano.ciudad) pano.ciudad.setEstilo(est); } };
  try { estilos = iniciarEstilos(map, ambas); estilos.mezclar(mezclaEstilo, fondoVacio); } catch (e) { console.warn('No se pudieron armar los estilos', e); }

  CARGA.ciudad();   // Start aparece cuando termina la carga (ver CARGA)
});
map.on('error', (e) => console.warn('mapa:', e && e.error));

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

    return { m, halo, capas, centro: new THREE.Vector3(x, y, m.zc) };
  });
  const camPos = new THREE.Vector3(), camH = new THREE.Vector4(), inversa = new THREE.Matrix4();
  window.__camPos = camPos; // para depurar: posición real de la cámara, en metros locales
  // opacidades finales de los cuadros: las de actualizar() × lo que pide el estilo
  function opacidadesCuadros() {
    const est = estilos ? estilos.actual : null, cfg = (est && est.cuadros) || { k: 1 };
    for (const c of cuadros) {
      const k = cfg.k * (cfg.cerca ? suave(clamp((58 - c.centro.distanceTo(camPos)) / 38, 0, 1)) : 1);
      for (const o of [...c.capas, c.halo]) {
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
      // (en la vuelta, recién con la cámara en el dron: mientras vuela, se ve la foto fija)
      if (pano && pano.ciudad && !pano.listo && (!pano.vuelta || pano.vuelta.llega) && pano.ciudad.ranuras()[0] && ++pano.cuadros > 3 && map.areTilesLoaded()) {
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
let ultimoCuadro = performance.now();
let terminado = false;

const elEstado = $('#estado');
const elNota = $('#nota');
const elPie = $('#pie');
const rango = $('#rango');
const btnSeguir = $('#seguir');

// NOTA DE ESQUINA (arriba): el momento que marcó la artista (nota de los puntos) y, entre uno y otro, el descriptor
// del audio (recorrido.js → sonidos). Se ve durante todo el recorrido, también con la interfaz oculta (tecla H),
// salvo sobre la panorámica y mientras se miran las fotos. Al cambiar de texto, el anterior se apaga y el nuevo se
// enciende (no se pisan).
const SONIDOS = (R.sonidos || []).map((s) => ({ desde: aSeg(s.desde), hasta: aSeg(s.hasta), texto: s.texto }))
  .sort((a, b) => a.desde - b.desde);
let sonidoTexto = '', sonidoDesde = 0;
function sonido(t, ahora, enFotos, nota) {
  const ver = !enFotos && iniciado && !terminado && !(pano && !pano.apagando);
  const s = ver && !nota && SONIDOS.find((x) => t >= x.desde && t < x.hasta);
  const txt = !ver ? '' : nota || (s ? s.texto : '');
  if (txt !== sonidoTexto) {
    sonidoTexto = txt;
    elNota.classList.remove('visible');
    sonidoDesde = ahora + (elNota.textContent ? 650 : 0);   // espera a que se apague el anterior
  }
  if (txt && ahora >= sonidoDesde) {
    if (elNota.textContent !== txt) elNota.textContent = txt;
    elNota.classList.add('visible');
  }
}

function altoPanel() {
  const h = $('#panel').hidden ? 0 : $('#panel').offsetHeight;
  document.documentElement.style.setProperty('--alto-panel', h + 'px');
  return h;
}
const SIN_RELLENO = { top: 0, bottom: 0, left: 0, right: 0 };
// MIRADA AL FRENTE: MapLibre no deja pasar de PITCH_CALLE (84°), así que en la vereda la cámara miraba 6° hacia abajo y
// el piso llenaba casi el 60 % de la pantalla: se sentía la vista de alguien muy bajo. Se corre el centro óptico hacia
// abajo (padding arriba) lo justo para que el horizonte quede en la mitad, como una persona que mira de frente. La
// cámara no se mueve: sólo cambia el encuadre. k = 1 en la vereda; los vuelos que salen de ella o llegan a ella lo funden.
const MIRADA_ELEVA = 90 - PITCH_CALLE;
const ocCalle = (fov) => (window.innerHeight / 2 / Math.tan((fov / 2) * RAD)) * Math.tan(MIRADA_ELEVA * RAD);
const rellenoCalle = (fov, k = 1) => ({ top: 2 * ocCalle(fov) * k, bottom: 0, left: 0, right: 0 });
const fundirRelleno = (p, k) => ({ top: (p.top || 0) * k, bottom: (p.bottom || 0) * k, left: (p.left || 0) * k, right: (p.right || 0) * k });
const rellenoAereo = () => ({ top: window.innerHeight * 0.28, bottom: altoPanel(), left: 0, right: 0 });
// EPÍLOGO: si al terminar el audio hay un travelling en curso (el último lugar, en la esquina), el tiempo sigue
// corriendo con el reloj hasta que la cámara vuelve a la vereda; recién entonces aparece "fin del recorrido".
let epilogo = null;   // { desde: performance.now() al terminar el audio, base: duración, hasta: momento de cierre }
const tActual = () => (arrastrando ? tPrevia
  : epilogo ? Math.min(epilogo.hasta, epilogo.base + (performance.now() - epilogo.desde) / 1000)
  : relojSuave());
// RELOJ SUAVE: audio.currentTime avanza a saltos irregulares (en Chrome, de 5 a 19 ms entre cuadros iguales de 16 ms;
// en Safari de iPhone, más gruesos todavía) y la cámara, que lo sigue, se movía a tirones: las fotos temblaban en los
// vuelos. Mientras suena, el tiempo avanza con el reloj de la pantalla y se acerca de a poco al del audio (si se
// separan más de 0,25 s, por un salto o un corte, lo toma tal cual). En pausa o buscando, es el del audio.
let relojT = 0, relojAhora = 0;
function relojSuave() {
  const ta = audio.currentTime || 0, ahora = performance.now();
  if (audio.paused || audio.seeking || !relojAhora) { relojT = ta; relojAhora = ahora; return ta; }
  const dt = Math.max(0, (ahora - relojAhora) / 1000);
  let t = relojT + dt * (audio.playbackRate || 1);
  const err = ta - t;
  t = Math.abs(err) > 0.25 ? ta : t + err * Math.min(1, dt * 2);
  relojT = t; relojAhora = ahora;
  return t;
}

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
// diferencia de rumbo (cámara del caminante → la del vuelo) del cuadro anterior: ver camaraCalle → giroVuelo
let giroPrevio = null;
function esquivarEdificios(c, ojos, vu) {
  const ahora = performance.now() / 1000, dt = Math.min(0.1, ahora - tElev);
  tElev = ahora;
  if (!ciudad || !ciudad.alturaCerca) return 0;
  const extremos = [ojos, ...vu.p.vistas.map((v) => v.pos)];
  const dMin = Math.min(...extremos.map((p) => Math.hypot(c[0] - p[0], c[1] - p[1])));
  const adentro = ciudad.alturaCerca(c[0], c[1], 0);
  const cerca = ciudad.alturaCerca(c[0], c[1], 4) * suave(clamp((dMin - 1) / 4, 0, 1));
  // mientras va hacia un diorama (o vuelve de él) los volúmenes del medio están ocultos (CORTE): no hay nada que
  // esquivar, y subir de golpe sobre un techo invisible era un salto desconcertante a la salida de la foto del Tower
  const corte = vu.w * ((vu.kIso || 0) + (vu.kCorte || 0)) > 0.001;
  // en el arranque la cámara camina por la vereda (de la foto al caminante), pegada a las fachadas: sólo se esquiva
  // lo que quedaría adentro de un volumen, no lo que está cerca (si no, subía hasta los techos)
  // Lo mismo si la foto se tomó a la altura de la calle: el vuelo va por la vereda, junto a las fachadas (de vuelta de
  // Guantanamera, pegada a un volumen de 27 m, subía hasta 11 m y volvía a bajar). Cuentan sólo las vistas entre las que
  // va la cámara en este momento: en Ball & Chain las dos fotos son a ras del piso aunque después vengan los dioramas
  // (de la primera foto a la de la esquina subía a 10 m sobre el volumen y la foto se desarmaba en el camino).
  const techo = corte ? 0 : vu.p.desdeFoto || vu.aRas ? adentro : Math.max(adentro, cerca);
  const falta = techo > 0 ? Math.max(0, techo + 1.5 - c[2]) : 0;
  elevVuelo = Math.max(falta, elevVuelo * Math.exp(-dt * 2.5));
  return elevVuelo;
}
// Camino de la cámara del arranque en la bajada: del punto de vista de la foto (V) en línea recta hasta el comienzo del
// recorrido (bajando a la altura de los ojos) y de ahí por el mismo camino del caminante, atrasada, hasta alcanzarlo.
// u: avance de 0 a 1 (velocidad pareja, ver parejo); el largo total crece mientras el caminante sigue andando.
function caminoArranque(p, V, e) {
  const t = tActual();
  const u = parejo(1 - clamp((p.hasta - t) / p.bajada, 0, 1));
  const e0 = estado(0), P0 = aLocal([e0.lng, e0.lat]);
  const D0 = Math.hypot(V[0] - P0[0], V[1] - P0[1]);
  const s = u * (D0 + Math.max(0, e.d - e0.d));
  if (s < D0) {
    const f = s / (D0 || 1);
    return { u, c: [V[0] + (P0[0] - V[0]) * f, V[1] + (P0[1] - V[1]) * f, V[2] + (OJO - V[2]) * suave(f)] };
  }
  const dQuiero = e0.d + (s - D0);
  let a = 0, b = t;
  for (let i = 0; i < 24; i++) { const m = (a + b) / 2; if (estado(m).d < dQuiero) a = m; else b = m; }
  const q = estado(b), [qx, qy] = aLocal([q.lng, q.lat]);
  return { u, c: [qx, qy, OJO] };
}
function camaraCalle(e, rumboCam, pitchCam, vu) {
  const fase = (e.d / PASO) * Math.PI;
  const andando = e.caminando && iniciado;
  const alt = OJO + (andando ? 0.035 * Math.abs(Math.sin(fase)) : 0);
  const roll = andando ? 0.35 * Math.sin(fase) : 0;
  if (!vu || vu.w <= 0) {
    elevVuelo = 0;
    giroPrevio = null;
    rectificar(null);
    return { ...map.calculateCameraOptionsFromCameraLngLatAltRotation([e.lng, e.lat], alt, rumboCam, pitchCam, roll), padding: rellenoCalle(map.getVerticalFieldOfView()) };
  }
  // viaje directo de los ojos del caminante al punto de vista de la imagen (sin rodeos: un paso al costado,
  // un cruce de calle o una subida), siempre apuntando al lugar. Si el punto de vista está alto (dron), primero
  // sube en vertical y recién después se desplaza; a la vuelta, al revés (nunca atraviesa los edificios de la vereda).
  const [x, y] = aLocal([e.lng, e.lat]);
  const T = vu.T, w = vu.w;
  const V = desdePolar(T, vu.polarV.th, vu.polarV.r, vu.polarV.z);
  if (vu.bajaAlta && !e.enFoto) return bajadaAlta(vu, T, V, [x, y], alt, roll, rumboCam, pitchCam);
  const alto = V[2] - alt > 3;
  // (arranque: hasta la bajada la cámara ya está en el punto de vista, con su altura; sólo se acomodan la mirada y el
  // encuadre. Si no, al aterrizar caía a la altura de los ojos y volvía a subir)
  const wz = e.enFoto ? 1 : alto ? suave(clamp(w / 0.55, 0, 1)) : w;
  const wh = e.enFoto ? 1 : alto ? suave(clamp((w - 0.3) / 0.7, 0, 1)) : w;
  let c = [x + (V[0] - x) * wh, y + (V[1] - y) * wh, alt + (V[2] - alt) * wz];
  // arranque: de la foto al caminante la cámara camina por donde caminó él (caminoArranque), con el balanceo de sus
  // pasos (los que se oyen). Nada de líneas rectas: cortaban las esquinas de los edificios de la vereda.
  const caminando = vu.p.desdeFoto && !e.enFoto;
  // peso de la foto en la mirada y el encuadre (rumbo, pitch, giro, campo de visión y centro óptico): w, salvo en la
  // caminata del arranque, donde pasa a la mirada al frente del caminante en los primeros ARRANQUE_MIRADA segundos
  // (con w, la cámara seguía media caminata con el cabeceo de la foto: a la altura de los ojos, mirando el piso)
  const wm = caminando ? w * (1 - suave(clamp((tActual() - (vu.p.hasta - vu.p.bajada)) / ARRANQUE_MIRADA, 0, 1))) : w;
  let rollViaje = 0;
  if (caminando) {
    const { c: cc, u } = caminoArranque(vu.p, V, e);
    c = cc;
    const m = clamp(u * 6, 0, 1);   // (arranca quieta)
    c[2] += (alt - OJO) * m;
    rollViaje = roll * m - roll * (1 - wm);   // (el roll de la vereda ya entra abajo con 1 − wm)
  }
  // la cabeza ya venía girando hacia el lugar (ANTICIPA): el resto del giro se reparte en la primera mitad del viaje.
  // A la vuelta, en casi toda la vuelta: la cabeza no viene girada hacia donde va el caminante y, concentrado en la
  // última mitad, el giro era un latigazo (157° en 2 s al volver de la esquina de Cubaocho)
  // (parejo sobre el tiempo de la vuelta, no sobre w, que ya viene suavizado: el giro quedaba concentrado en el medio)
  const fv = caminando ? wm : vu.baja && !vu.p.desdeFoto ? parejo(clamp(vu.xb, 0, 1)) : suave(clamp(w / 0.5, 0, 1));
  // DOLLY ZOOM hacia las vistas isométricas: en la segunda mitad del viaje la cámara se aleja del lugar por la misma
  // línea (la dirección de la mirada no cambia) y el campo de visión se cierra en la misma proporción. El lugar
  // conserva su tamaño en pantalla mientras la perspectiva se aplana hasta volverse isometría: la ciudad se vuelve
  // maqueta justo cuando el diorama se recompone. g = 1 en las vistas comunes.
  const g = Math.exp((vu.lnIso || 0) * suave(clamp((w - 0.45) / 0.55, 0, 1)));
  if (g > 1.0001) c = c.map((v, i) => T[i] + (v - T[i]) * g);
  if (!caminando) c[2] += esquivarEdificios(c, [x, y], vu);
  // al volver de una foto tomada de cerca, la mira queda a pocos metros: apuntarle mientras la cámara se va hacía girar
  // la cabeza de golpe hacia atrás. En la bajada se conserva la dirección del eje de la foto, que pasa de a poco a la
  // mirada del caminante.
  const L = vu.bajaCerca || caminando ? mirarA(V, T) : mirarA(c, T);   // (caminando: el arranque, ídem)
  // la pantalla que se quiere ver (ver encuadre): al llegar, la cámara mira por el eje de la foto, con el campo de
  // visión y el centro óptico que dejan la foto entera y centrada. En el viaje, todo pasa de a poco de la vereda a eso.
  const W = window.innerWidth, H = window.innerHeight;
  const fc = e.enFoto ? vu.fov : fovCalle(), fovEq = fc + (vu.fov - fc) * wm;   // (arranque: ya llegó con el de la foto)
  const quiero = {
    rumbo: rumboCam + giroVuelo(difAng(rumboCam, L.rumbo + vu.dR)) * fv,
    pitch: pitchCam + (L.alto + vu.dP - pitchCam) * fv,      // puede pasar de PITCH_CALLE (fotos al horizonte)
    giro: roll * (1 - wm) + vu.giro * wm + rollViaje,
    f: (g * H) / 2 / Math.tan((fovEq / 2) * RAD),
    cx: W * (0.5 + (vu.xp - 0.5) * wm), cy: H * (0.5 + (vu.yp - 0.5) * wm) + ocCalle(fc) * (1 - wm),   // (mirada al frente)
  };
  // dónde queda el CENTRO DE LA FOTO respecto del centro óptico (encuadre la centra en la zona libre; con un `centro`
  // calibrado grande, como la segunda de Guantanamera, −0,70, están lejos): dibujar() corre la foto, no el centro óptico
  const zl = zonaLibre();
  quiero.dfx = (W / 2 - W * vu.xp) * wm;
  quiero.dfy = (zl.arriba + zl.alto / 2 - H * vu.yp) * wm;
  // lo que MapLibre tiene que dibujar sin falta (marcoQueCubre): al llegar, sólo la foto y un borde; el resto del margen
  // es el fondo oscuro. Con toda la pantalla, una foto muy abierta en un celular vertical (la segunda de Guantanamera,
  // 102°) pedía más campo del que MapLibre abre, se acercaba y llenaba todo el ancho, sin márgenes (pedido de la
  // artista, 27/11). El centro va en tangentes desde el centro óptico (acompaña a correr y acercar en dibujar()); el
  // tamaño, en píxeles fijos: si creciera con el acercamiento, acercar no ayudaría a cubrir y el acercamiento saltaba.
  quiero.foto = { ux: quiero.dfx / quiero.f, uy: quiero.dfy / quiero.f, hx: W * vu.ax + BORDE_FOTO,
    hy: H * vu.ay + BORDE_FOTO, s: suave(clamp((wm - 0.6) / 0.4, 0, 1)) };
  // En el viaje, cuando la cámara pasa cerca de la mira, L.alto da saltos grandes: lo que se corrige por fuera del
  // rango de MapLibre se limita (al llegar, la diferencia es la de la foto: unos pocos grados).
  quiero.pitch = clamp(quiero.pitch, -EXCESO_MAX, PITCH_CALLE + EXCESO_MAX);
  return dibujar(c, quiero);
}
// BAJADA DESDE UNA VISTA ALTA (los dioramas): bajar en diagonal desde lo alto hasta el caminante mostraba los techos
// de las cuadras vecinas. En cambio, en dos tramos:
// · ACERCAMIENTO (u 0…BAJA_ACERCA): la cámara avanza por el eje de la imagen hacia la fachada, sin girar, hasta
//   BAJA_CERCA m de ella, y en el final del tramo baja a la altura de los ojos. Mientras está más lejos que la
//   equivalente cercana es un dolly zoom (la imagen conserva su tamaño y la isometría vuelve a perspectiva); de ahí
//   en adelante el campo de visión queda fijo y la imagen crece: la cámara se acerca a ella.
// · GIRO (u BAJA_GIRA…1): desde la calle, frente a la fachada, gira hacia la mirada del caminante y camina hasta él.
const BAJA_ACERCA = 0.6, BAJA_GIRA = 0.5, BAJA_CERCA = 14;
function bajadaAlta(vu, T, V, [x, y], alt, roll, rumboCam, pitchCam) {
  const u = vu.ub;
  const s = suave(clamp(u / BAJA_ACERCA, 0, 1));
  const r = suave(clamp((u - BAJA_GIRA) / (1 - BAJA_GIRA), 0, 1));
  const eje = V.map((v, i) => v - T[i]), dEq = Math.hypot(...eje), un = eje.map((v) => v / dEq);
  const dLejos = dEq * Math.exp(vu.lnIso || 0), dCerca = Math.min(BAJA_CERCA, dEq);
  const d = dLejos * Math.exp(Math.log(dCerca / dLejos) * s);
  const P = T.map((m, i) => m + un[i] * d);
  P[2] += (alt - P[2]) * suave(clamp((s - 0.55) / 0.45, 0, 1));   // (a la altura de los ojos, frente a la fachada)
  const c = [P[0] + (x - P[0]) * r, P[1] + (y - P[1]) * r, P[2] + (alt - P[2]) * r];
  const g = Math.max(1, d / dEq);
  const L = mirarA(c, T), q = 1 - s;   // (la diferencia entre el eje de la imagen y la mira se va con el acercamiento)
  const rumboV = L.rumbo + vu.dR * q, pitchV = L.alto + vu.dP * q;
  const W = window.innerWidth, H = window.innerHeight, fc = fovCalle(), fov = vu.fov + (fc - vu.fov) * r;
  const quiero = {
    rumbo: rumboV + difAng(rumboV, rumboCam) * r,
    pitch: clamp(pitchV + (pitchCam - pitchV) * r, -EXCESO_MAX, PITCH_CALLE + EXCESO_MAX),
    giro: vu.giro * (1 - r) + roll * r,
    f: (g * H) / 2 / Math.tan((fov / 2) * RAD),
    cx: W * (0.5 + (vu.xp - 0.5) * (1 - r)), cy: H * (0.5 + (vu.yp - 0.5) * (1 - r)) + ocCalle(fc) * r,
  };
  return dibujar(c, quiero);
}
// Al volver de una foto que mira lejos de hacia donde va el caminante (la esquina de Cubaocho, 161°), cerca del final
// la mira queda justo a sus espaldas y la diferencia de rumbo cruza los 180°: difAng saltaba de −176° a +176° y el
// giro, que venía por un lado, se daba vuelta por el otro (un salto de ~50° de la cámara justo antes de llegar). Se
// sigue por la misma rama que en el cuadro anterior.
// (sólo cerca de los 180°: si se salta en el audio, la rama del cuadro anterior ya no vale y no se acumulan vueltas)
function giroVuelo(d) {
  const crudo = d;
  if (giroPrevio != null) { while (d - giroPrevio > 180) d -= 360; while (d - giroPrevio < -180) d += 360; }
  if (Math.abs(d) > 240) d = crudo;
  giroPrevio = d;
  return d;
}
// Lleva la cámara a `c` mostrando la pantalla `quiero` ({ rumbo, pitch, giro, f, cx, cy }): elige lo que puede dibujar
// MapLibre y lo rectifica (lo usan camaraCalle y el final de la partida al arranque)
function dibujar(c, quiero) {
  const W = window.innerWidth, H = window.innerHeight;
  // lo que dibuja MapLibre: una cámara en el mismo punto, con el pitch dentro de su rango (un pitch negativo lo
  // recorta DESPUÉS de ubicar la cámara y la corre del punto de vista), orientada y con el campo de visión y el
  // centro óptico (padding) justos para que toda la pantalla buscada quede adentro con el menor campo posible.
  // rectificar() lleva una a la otra. Si MapLibre dibuja de más, la imagen se amplía y pierde definición; si de
  // menos, queda a la vista el fondo de la página (parpadeos blancos).
  let dibujo = mejorDibujo(quiero, W, H);
  // si ni así entra (una foto muy ancha en un celular vertical pide más de lo que MapLibre puede abrir), se acerca
  // la pantalla buscada: la foto se recorta un poco a los costados, pero nunca queda a la vista el fondo
  // (búsqueda binaria del menor acercamiento que alcanza: una foto muy abierta y con el centro corrido, como la segunda
  // de Guantanamera, 126°, pide rayos a más de 74° del eje y ninguna cámara de dibujo la cubre; antes se
  // extrapolaba desde ese resultado inválido y la rectificación ampliaba el canvas miles de veces)
  const fMin = H / 2 / Math.tan((FOV_DIBUJO_MAX / 2) * RAD);
  // El acercamiento se mide con una cámara de dibujo FIJA (apuntada al centro de la pantalla buscada, que acercar no
  // mueve), no con mejorDibujo: su búsqueda tiene algo de ruido y el acercamiento saltaba de un cuadro a otro (la foto
  // temblaba). Así varía de manera continua; si esa cámara alcanza, la de mejorDibujo (que cubre con más focal) también.
  {
    // Antes de acercar, la foto se corre hacia el centro de la pantalla: el encuadre la centra en la zona libre (más
    // arriba, por el pie) y con eso los rayos de una esquina se van más lejos del eje. Una foto muy abierta (Top Cigars,
    // 102°) en un celular vertical entra entera centrada en la pantalla, pero no en la zona libre: se acercaba ~2 veces,
    // con los costados recortados, y al pasar a la vista siguiente el acercamiento se soltaba de golpe. Tanto el
    // corrimiento como el acercamiento se miden con una cámara de dibujo fija, así varían de manera continua durante el
    // vuelo: la del centro de la pantalla buscada si con ella alcanza sin tocar nada (como antes); si no, la del eje de
    // la pantalla centrada (la del centro de la pantalla sin correr puede apuntar 30° más abajo que la foto, y desde
    // ahí ningún corrimiento alcanzaba).
    // (lo que se lleva al centro es la FOTO: su centro está a dfx, dfy del centro óptico. Llevar el centro óptico, con
    // una foto de centro calibrado muy corrido, la dejaba ~50 px más arriba)
    const fx = quiero.cx + (quiero.dfx || 0), fy = quiero.cy + (quiero.dfy || 0);
    const correr = (s) => ({ ...quiero, cx: quiero.cx + (W / 2 - fx) * s, cy: quiero.cy + (H / 2 - fy) * s });
    const dibujoFijo = (q) => { const c = apuntarAlCentro(q, W, H); return { rumbo: c.rumbo, pitch: clamp(c.pitch, 0, PITCH_CALLE), giro: quiero.giro }; };
    // (Siempre con la MISMA cámara fija, la del eje de la pantalla centrada, y sin depender de si mejorDibujo alcanza:
    // con una cámara para decidir si hacía falta correr y otra para medir cuánto, al cambiar de una rama a la otra el
    // corrimiento volvía a cero de golpe y la foto saltaba ~25 px al terminar la vista.)
    const d0 = dibujoFijo(correr(1));
    // Cuánto correr no se busca como «lo mínimo que alcanza» (correr no siempre ayuda: cerca del límite, con la foto
    // corrida no alcanzaba y sin correr sí, y el corrimiento saltaba de 1 a 0 en un cuadro: la foto bajaba ~25 px de
    // golpe). Se corre de a poco según cuánto haría falta acercar SIN correr (k0, que varía de manera continua), y
    // después se busca el acercamiento para esa posición (alcanzar sólo mejora al acercar: es continuo).
    const acercar = (q, k) => (k > 1 ? { ...q, f: q.f * k, cx: W / 2 + (q.cx - W / 2) * k, cy: H / 2 + (q.cy - H / 2) * k } : q);
    const alcanza = (q, k) => marcoQueCubre(acercar(q, k), d0, W, H).f >= fMin;
    const minK = (q) => {
      if (alcanza(q, 1)) return 1;
      let a = 1, b = 2;
      while (!alcanza(q, b) && b < 64) { a = b; b *= 2; }
      for (let i = 0; i < 16; i++) { const m = (a + b) / 2; if (alcanza(q, m)) b = m; else a = m; }
      return b;
    };
    const k0 = minK(correr(0));
    const sCorre = suave(clamp((k0 - 1) / 0.25, 0, 1));
    const base = correr(sCorre), k = sCorre > 0 ? minK(base) : k0;
    if (sCorre > 0 || k > 1) { Object.assign(quiero, acercar(base, k)); dibujo = mejorDibujo(quiero, W, H); }
    // (si la búsqueda de mejorDibujo no llegara a cubrir la pantalla, la cámara fija sí: con ella se midió todo esto)
    if (dibujo.f < fMin) { const m = marcoQueCubre(quiero, d0, W, H); if (m.f > dibujo.f) dibujo = { ...d0, ...m }; }
  }
  const fov = Math.min(FOV_DIBUJO_MAX, (2 * Math.atan(H / 2 / dibujo.f)) / RAD);
  dibujo.f = H / 2 / Math.tan((fov / 2) * RAD);
  if (Math.abs(map.getVerticalFieldOfView() - fov) > 0.001) map.setVerticalFieldOfView(fov);
  rectificar(homografiaVista(dibujo, quiero));
  const ox = dibujo.cx - W / 2, oy = dibujo.cy - H / 2;
  return {
    ...map.calculateCameraOptionsFromCameraLngLatAltRotation(aLngLat(c[0], c[1]), c[2], dibujo.rumbo, dibujo.pitch, dibujo.giro),
    padding: { top: Math.max(0, 2 * oy), bottom: Math.max(0, -2 * oy), left: Math.max(0, 2 * ox), right: Math.max(0, -2 * ox) },
  };
}
const BORDE_FOTO = 12;        // píxeles alrededor de la foto que MapLibre dibuja siempre (ver camaraCalle → foto)
const EXCESO_MAX = 30;        // grados que la rectificación puede inclinar por fuera del rango de MapLibre
const FOV_DIBUJO_MAX = 148;   // campo de visión vertical máximo con que se le pide dibujar a MapLibre (su tope es 150°). En un
                              // celular vertical, una foto de 72° de ancho entra a lo ancho con ~115° de alto
// ── rectificación: de la cámara que puede dibujar MapLibre a la que se quiere ver ──
// Una cámara es { rumbo, pitch, giro, f (focal en píxeles), cx, cy (centro óptico en píxeles) }; las dos están en
// el mismo punto, así que de una pantalla a la otra hay una homografía exacta (sólo cambia hacia dónde miran).
const ejesCam = (k) => ejes({ rumbo: k.rumbo, cabeceo: 90 - k.pitch, giro: k.giro });
const prod = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
// rayo (en el mundo) del píxel (x, y) de la cámara k
const rayoPx = (k, E, x, y) => [0, 1, 2].map((i) => E.f[i] * k.f + E.der[i] * (x - k.cx) - E.arr[i] * (y - k.cy));
// rumbo y pitch del rayo que pasa por el centro de la pantalla de `quiero`
function apuntarAlCentro(quiero, W, H) {
  const r = rayoPx(quiero, ejesCam(quiero), W / 2, H / 2);
  const elev = Math.atan2(r[2], Math.hypot(r[0], r[1])) / RAD;
  return { rumbo: Math.atan2(r[0], r[1]) / RAD, pitch: 90 + elev };
}
// la cámara de dibujo que cubre la pantalla de `quiero` con la mayor focal (el menor campo de visión): búsqueda
// ternaria del pitch (dentro del rango de MapLibre) y después del rumbo, alrededor del rayo del centro
function mejorDibujo(quiero, W, H) {
  const c = apuntarAlCentro(quiero, W, H), giro = quiero.giro;
  const prueba = (rumbo, pitch) => ({ rumbo, pitch, giro, ...marcoQueCubre(quiero, { rumbo, pitch, giro }, W, H) });
  const ternaria = (a, b, f) => {
    for (let i = 0; i < 18; i++) {
      const m1 = a + (b - a) / 3, m2 = b - (b - a) / 3;
      if (f(m1).f < f(m2).f) a = m1; else b = m2;
    }
    return f((a + b) / 2);
  };
  const p0 = clamp(c.pitch, 0, PITCH_CALLE);
  const d = ternaria(Math.max(0, p0 - 20), Math.min(PITCH_CALLE, p0 + 20), (p) => prueba(c.rumbo, p));
  return ternaria(c.rumbo - 15, c.rumbo + 15, (r) => prueba(r, d.pitch));
}
// focal y centro óptico de `dibujo` con los que las cuatro esquinas de la pantalla de `quiero` caen adentro; lo que
// sobra se reparte a los dos lados (el centro óptico de MapLibre tiene que quedar dentro de la pantalla)
function marcoQueCubre(quiero, dibujo, W, H) {
  const Eq = ejesCam(quiero), Ed = ejesCam(dibujo);
  let izq = 0.02, der = 0.02, arr = 0.02, aba = 0.02;     // tangentes desde el eje de `dibujo`
  // (lo que hay que cubrir: toda la pantalla o, al llegar a una foto, la foto con su borde: ver camaraCalle → foto)
  let [x0, y0, x1, y1] = [0, 0, W, H];
  const ft = quiero.foto;
  if (ft && ft.s > 0) {
    const fx = quiero.cx + quiero.f * ft.ux, fy = quiero.cy + quiero.f * ft.uy, hx = ft.hx, hy = ft.hy;
    x0 = Math.max(0, (fx - hx) * ft.s); x1 = Math.min(W, W + (fx + hx - W) * ft.s);
    y0 = Math.max(0, (fy - hy) * ft.s); y1 = Math.min(H, H + (fy + hy - H) * ft.s);
  }
  for (const [x, y] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]) {
    const r = rayoPx(quiero, Eq, x, y), z = prod(r, Ed.f);
    if (z <= 1e-3) return { f: 1e-3, cx: W / 2, cy: H / 2 };
    const u = prod(r, Ed.der) / z, v = prod(r, Ed.arr) / z;
    der = Math.max(der, u); izq = Math.max(izq, -u); arr = Math.max(arr, v); aba = Math.max(aba, -v);
  }
  const f = Math.min(W / (izq + der), H / (arr + aba)) * 0.99;
  return { f, cx: f * izq + (W - f * (izq + der)) / 2, cy: f * arr + (H - f * (arr + aba)) / 2 };
}
// matrix3d (transform-origin 0 0) que lleva el canvas dibujado con `dibujo` a la pantalla de `quiero`.
// null si son la misma.
function homografiaVista(dibujo, quiero) {
  const Ed = ejesCam(dibujo), Eq = ejesCam(quiero), d = dibujo;
  // columnas: rayo del píxel (x, y, 1) del dibujo; filas: coordenadas en la cámara buscada
  const A = [Ed.der, Ed.arr.map((a) => -a), rayoPx(d, Ed, 0, 0)];
  const q = (fila) => A.map((col) => prod(col, fila));           // [coef x, coef y, coef 1]
  const qx = q(Eq.der), qy = q(Eq.arr), qz = q(Eq.f);
  const fila = (i) => [quiero.f * qx[i] + quiero.cx * qz[i], -quiero.f * qy[i] + quiero.cy * qz[i], qz[i]];
  const [cX, cY, c1] = [fila(0), fila(1), fila(2)];   // columnas de la homografía (x, y, 1)
  const n = c1[2];
  const m = [cX[0], cX[1], 0, cX[2], cY[0], cY[1], 0, cY[2], 0, 0, 1, 0, c1[0], c1[1], 0, c1[2]].map((x, i) => (i === 10 ? 1 : x / n));
  const ident = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  if (m.every((x, i) => Math.abs(x - ident[i]) < 1e-6)) return null;
  return `matrix3d(${m.map((x) => +x.toFixed(9)).join(',')})`;
}
let rectActual = '';
// (No se cambia la resolución del canvas durante el vuelo: cada map.setPixelRatio vuelve a crear el buffer y se
// veía un cuadro en blanco. Con la cámara de dibujo apuntada al centro, la ampliación es mínima.)
// La homografía se aplica recién cuando MapLibre dibuja (evento render), no al calcularla: jumpTo pide el cuadro para
// el próximo requestAnimationFrame, y si el canvas se transformaba enseguida, durante un cuadro la homografía nueva
// quedaba sobre el dibujo viejo. En los vuelos casi no se nota (cambian poco de un cuadro a otro), pero al tocar Start
// la partida pasa de golpe de sin rectificación a rectificada y la panorámica daba un salto de un cuadro.
let rectPendiente = null;
function rectificar(css) {
  css = css || '';
  if (css === (rectPendiente ?? rectActual)) return;
  rectPendiente = css;
  map.triggerRepaint();
}
map.on('render', () => {
  if (rectPendiente === null) return;
  rectActual = rectPendiente;
  rectPendiente = null;
  const cv = map.getCanvas();
  cv.style.transformOrigin = '0 0';
  cv.style.transform = rectActual;
});

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
    camRumbo = rumboVereda(e); camPitch = PITCH_CALLE; mirarYaw = mirarPitch = 0;
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
  // (al inicio, recién cuando terminó el fundido de la foto fija: mientras se funden, la cámara no se mueve y la foto
  // y la proyección calzan exactas). La amplitud crece de a poco, así el giro arranca con velocidad cero.
  const desde = pano.listo && pano.listo + FUNDIDO_FOTO * 1000 + 300;
  const s = desde ? Math.max(0, (ahora - desde) / 1000) : 0;
  const desvio = QUIETA ? 0 : e.paneo * suave(clamp(s / PANEO_ENTRA, 0, 1)) * Math.sin((2 * Math.PI * s) / PANEO_SEG);
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
  // VUELTA: la foto del dron está a 3,5 km y mira al norte, así que casi todo el vuelo pasaba sobre negro (sin mapa base
  // y sin la foto en cuadro). La foto fija aparece apenas la cámara sube y tapa el vuelo; al llegar al dron, la cámara
  // ya calza con ella y se funde al 3D como al cargar la página (.pano-lista, sin mover la cámara durante el fundido).
  const foto = $('#pano-foto');
  if (foto && f < 1) {
    foto.style.transition = 'none';
    foto.style.opacity = String(suave(clamp((f - FOTO_VUELTA[0]) / (FOTO_VUELTA[1] - FOTO_VUELTA[0]), 0, 1)));
  } else if (foto && foto.style.opacity !== '') {
    foto.style.opacity = ''; foto.style.transition = '';
  }
  if (Math.abs(map.getVerticalFieldOfView() - fov) > 0.01) map.setVerticalFieldOfView(fov);
  map.jumpTo({ ...map.calculateCameraOptionsFromCameraLngLatAltRotation(aLngLat(pos[0], pos[1]), pos[2],
    rumboCam, pitch, 0), padding: f < 1 ? fundirRelleno(v.desde.padding, 1 - suave(clamp(f / 0.5, 0, 1))) : SIN_RELLENO });
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
  }).catch((e) => { est.fallo = true; console.warn('No se pudo armar la panorámica 3D', e); });
}
// final del recorrido: la cámara vuela de vuelta al dron y la panorámica se recompone
// posición actual de la cámara en metros locales (la de MapLibre, o la que calcula la capa 3D en cada cuadro)
function posCamara() {
  try { const ll = map.transform.getCameraLngLat(); return [...aLocal([ll.lng, ll.lat]), map.transform.getCameraAltitude()]; }
  catch (e) { return capaRegistros ? capaRegistros.camPos.toArray() : [...aLocal(map.getCenter().toArray()), 300]; }
}
function volverAPano() {
  const pos = posCamara();
  pano = nuevoPano();
  pano.vuelta = { ini: performance.now(), llega: 0,
    desde: { pos, rumbo: map.getBearing(), pitch: map.getPitch(), fov: map.getVerticalFieldOfView(), padding: { ...map.getPadding() } } };
  map.stop();
  modo = 'general';   // sin setModo: la cámara la maneja camaraPano (al volver a empezar, setModo restituye todo)
  document.body.classList.remove('modo-calle');
  manejadores(false);
  etiquetas(false);
  elCaminante.style.display = 'none';
  btnSeguir.hidden = true;
  const foto = $('#pano-foto');
  if (foto) { foto.style.transition = 'none'; foto.style.opacity = '0'; }
  document.body.classList.remove('pano-fuera', 'pano-lista');   // (la foto fija vuelve: ver camaraPano)
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
const panoActiva = () => pano && !pano.apagando && !pano.partida;

// ── partida: del dron a los ojos del caminante ──
// Al comenzar (y al volver a empezar desde la panorámica final), la cámara deja el punto de vista sin apagar la
// imagen: primero se corre al este y sube SIN DEJAR DE MIRAR la zona de la foto, que se descompone sobre techos,
// fachadas y el telón (desde cualquier otro lugar la proyección es estiramiento y fragmento). Después gira hacia el
// caminante y baja por detrás de él, a lo largo de la calle, hasta sus ojos; en ese tramo la imagen se apaga.
// La trayectoria es una curva de Bézier (sin paradas) y la mirada pasa de la foto a la vereda.
// Sólo en la vista de calle y con la proyección ya a la vista; si no, queda el flyTo de siempre.
function iniciarPartida() {
  if (!pano || pano.apagando || pano.partida || VISTA !== 'calle' || !pano.ciudad || !pano.listo) return false;
  const c = posCamara();
  // lo que mira ahora (a 1,5 km por el eje de la cámara): la mirada arranca exactamente de ahí
  const r = map.getBearing() * RAD, b = (90 - map.getPitch()) * RAD;
  const mira0 = [c[0] + Math.sin(r) * Math.cos(b) * 1500, c[1] + Math.cos(r) * Math.cos(b) * 1500, c[2] - Math.sin(b) * 1500];
  pano.partida = { ini: performance.now(), f: 0, llega: false, desde: c, mira0, fov0: map.getVerticalFieldOfView() };
  map.stop();
  modo = 'calle';       // sin setModo: la cámara la maneja camaraPartida hasta llegar a la vereda
  seguir = true;
  enTransicion = true;  // el bucle no mueve la cámara de calle mientras tanto
  mirarYaw = mirarPitch = 0;
  manejadores(false);
  etiquetas(false);
  elCaminante.style.display = 'none';
  btnSeguir.hidden = true;
  document.body.classList.remove('pano-final');
  return true;
}
let rectificaPartida = false;   // la partida al arranque se dibuja con rectificación (ver camaraPartida)
function camaraPartida(ahora) {
  const pa = pano.partida;
  const f = clamp((ahora - pa.ini) / 1000 / PARTIDA_SEG, 0, 1);
  pa.f = f;
  const u = f * f * f * (f * (f * 6 - 15) + 10);   // arranca y llega con velocidad y aceleración cero
  const e = estado(tActual());
  // con la foto del arranque, baja al punto donde se tomó (a la altura de los ojos) en vez de a los ojos del caminante
  const pA = !arranqueListo && posArranque();
  // (al punto de vista exacto, con su altura: si llegaba a la de los ojos, después subía y giraba hasta la foto)
  const E = pA ? [...pA] : [...aLocal([e.lng, e.lat]), OJO];
  const d = [Math.sin(e.rumbo * RAD), Math.cos(e.rumbo * RAD)];
  const P = pano.vista.pos, A = pa.desde;
  const C1 = [P[0] + 420, P[1] + 380, P[2] + 90];                  // al noreste y arriba del dron, cerca del cono de la foto
  // detrás del caminante, sobre la calle. Con la foto del arranque, en cambio, justo encima del punto de vista: la
  // cámara viene del dron (al oeste) y baja derecho a la foto, sin pasarse 40 m al este y volver
  const C2 = pA ? [E[0], E[1], E[2] + 140] : [E[0] - d[0] * 450, E[1] - d[1] * 450, E[2] + 140];
  const c = [0, 1, 2].map((i) => (1 - u) ** 3 * A[i] + 3 * (1 - u) ** 2 * u * C1[i] + 3 * (1 - u) * u * u * C2[i] + u ** 3 * E[i]);
  // nunca dentro de un edificio (salvo al final, que llega exacto a los ojos en la vereda)
  if (ciudad && ciudad.alturaCerca) {
    const techo = ciudad.alturaCerca(c[0], c[1], 3);
    if (techo > 0 && techo + 2 > c[2]) c[2] += (techo + 2 - c[2]) * (1 - suave(clamp((f - 0.95) / 0.05, 0, 1)));
  }
  // la mirada: de la foto (lo que miraba el dron) a la vereda, adelante del caminante y hacia sus fachadas, con el
  // pitch de la calle (la misma con que sigue la cámara de calle)
  // Con la foto del arranque, la mirada final es la de la foto, a un punto lejano (a 60 m, en los últimos metros de la
  // bajada la cámara se desplaza de costado y el rumbo daba un tirón de ~10° justo antes de llegar), y termina de girar
  // antes, cuando la cámara todavía está alta.
  const w = pA ? suave(clamp((f - 0.3) / 0.5, 0, 1)) : suave(clamp((f - 0.35) / 0.55, 0, 1));
  const rv = pA ? ARRANQUE.vistas[0].rumbo : rumboVereda(e), dv = [Math.sin(rv * RAD), Math.cos(rv * RAD)];
  const dT = pA ? 400 : 60;
  let Tf = [E[0] + dv[0] * dT, E[1] + dv[1] * dT, OJO - dT * Math.tan((90 - PITCH_CALLE) * RAD)];
  let fovFin = fovCalle();
  if (pA) {
    // el encuadre centra la foto en la zona libre, que descuenta el alto del pie (el mayor que se vio: zonaLibre). Al
    // empezar, el pie todavía no tuvo texto: la partida encuadraba con un pie vacío y, al aparecer el pie de la foto
    // («Bird's tree · start») un momento después de llegar, la foto subía de golpe. Se carga su texto desde ya (el
    // pie sigue invisible: sin .visible).
    pieDeVista(ARRANQUE, 0);
    // llega con el encuadre de la foto (encuadre: el campo de visión que la llena): mirando al rayo que cae en el
    // centro de la pantalla (el eje de la foto, corrido por su centro óptico). Así el giro que sigue (ARRANQUE_GIRO)
    // casi no tiene nada que acomodar y no queda a la vista lo que está fuera de la foto
    // (el mismo cuadro que arma camaraCalle al llegar, w = 1: la dirección del rayo que cae en el centro de la pantalla)
    const v = ARRANQUE.vistas[0], en = encuadreEq(v), W = window.innerWidth, H = window.innerHeight;
    const Lv = mirarA(v.pos, v.mira);
    const centro = apuntarAlCentro({ rumbo: Lv.rumbo + v.dR, pitch: Lv.alto + v.dP, giro: v.giro || 0,
      f: H / 2 / Math.tan((en.fov / 2) * RAD), cx: W * en.xp, cy: H * en.yp }, W, H);
    const r = centro.rumbo * RAD, cb = (90 - centro.pitch) * RAD;
    Tf = [E[0] + Math.sin(r) * Math.cos(cb) * dT, E[1] + Math.cos(r) * Math.cos(cb) * dT, E[2] - Math.sin(cb) * dT];
    fovFin = en.fov;
  }
  const L = mirarA(c, [0, 1, 2].map((i) => pa.mira0[i] + (Tf[i] - pa.mira0[i]) * w));
  const fov = pa.fov0 + (fovFin - pa.fov0) * w;
  if (Math.abs(map.getVerticalFieldOfView() - fov) > 0.01) map.setVerticalFieldOfView(fov);
  if (pA) {
    // Con la foto del arranque, el final de la partida se dibuja como camaraCalle (dibujar: con rectificación): la
    // pantalla pasa de a poco de la mirada del vuelo al cuadro exacto de la foto, el mismo que muestra camaraCalle al
    // llegar (w = 1). Así la partida termina en el punto de vista correcto, sin una parada con franjas negras para
    // reacomodarse después (MapLibre solo no puede: la foto pide mirar más arriba de su pitch máximo y descentrada).
    const v = ARRANQUE.vistas[0], en = encuadreEq(v), W = window.innerWidth, H = window.innerHeight;
    const Lv = mirarA(v.pos, v.mira);
    const qFin = { rumbo: Lv.rumbo + v.dR, pitch: Lv.alto + v.dP, giro: v.giro || 0,
      f: H / 2 / Math.tan((en.fov / 2) * RAD), cx: W * en.xp, cy: H * en.yp };
    const q = { rumbo: L.rumbo, pitch: L.alto, giro: 0, f: H / 2 / Math.tan((fov / 2) * RAD), cx: W / 2, cy: H / 2 };
    const k = suave(clamp((f - 0.5) / 0.45, 0, 1));
    const quiero = {
      rumbo: q.rumbo + difAng(q.rumbo, qFin.rumbo) * k, pitch: q.pitch + (qFin.pitch - q.pitch) * k,
      giro: q.giro + (qFin.giro - q.giro) * k, f: q.f + (qFin.f - q.f) * k,
      cx: q.cx + (qFin.cx - q.cx) * k, cy: q.cy + (qFin.cy - q.cy) * k,
    };
    quiero.pitch = clamp(quiero.pitch, -EXCESO_MAX, PITCH_CALLE + EXCESO_MAX);
    rectificaPartida = true;
    map.jumpTo(dibujar(c, quiero));
  } else {
    rectificaPartida = false;
    map.jumpTo({ ...map.calculateCameraOptionsFromCameraLngLatAltRotation(aLngLat(c[0], c[1]), c[2], L.rumbo, L.pitch, 0),
      padding: rellenoCalle(map.getVerticalFieldOfView(), suave(clamp((f - 0.6) / 0.4, 0, 1))) });
  }
  if (f >= 1) {   // en la vereda: la cámara de calle sigue desde acá
    pa.llega = true;
    rectificaPartida = false;
    enTransicion = false;
    camRumbo = L.rumbo; camPitch = pA ? clamp(L.pitch, 55, PITCH_CALLE) : PITCH_CALLE;
    document.body.classList.add('modo-calle');
    salirDePano();
    reprogramarArranque(tActual());
  }
}
// foto fija mientras carga el 3D, ubicada exactamente donde la va a dibujar la proyección
function ubicarFotoPano() {
  const el = $('#pano-foto');
  if (!el) return;
  // homografía exacta con la cámara de MapLibre (no un rectángulo aproximado): el fundido al 3D no se nota
  const e = encuadreActual(), w = 1600, h = w / PANO.aspecto;
  Object.assign(el.style, { width: `${w}px`, height: `${h}px`, left: '0px', top: '0px', transformOrigin: '0 0',
    transform: homografia(e.W, e.H, PITCH_CALLE, e.fov, w, h) });
}
// intensidad de la proyección; al comenzar se apaga y después se suelta la memoria
function panoCuadro(ahora) {
  const s = pano.apagando ? (ahora - pano.apagando) / 1000 : 0;
  // en la vuelta, la imagen aparece en el último tramo del vuelo
  const v = pano.vuelta;
  const entra = v && !v.llega ? suave(clamp(((ahora - v.ini) / 1000 / VUELTA_SEG - 0.55) / 0.45, 0, 1)) : 1;
  // en la partida, la imagen sigue entera mientras se descompone y se apaga cuando la cámara ya va hacia la calle
  const sale = pano.partida ? 1 - suave(clamp((pano.partida.f - 0.3) / 0.4, 0, 1)) : 1;
  if (pano.ciudad) pano.ciudad.setIntensidades([entra * sale * (1 - suave(clamp(s / PANO_APAGA, 0, 1)))]);
  // el telón (el cielo de la foto) se va con la imagen, apenas antes: si se apagaba solo al principio, el cielo
  // quedaba oscuro mientras la ciudad seguía entera y la foto parecía oscurecerse. Cuando la cámara gira hacia la
  // calle (y el telón se vería como un panel suelto) ya no está.
  if (pano.ciudad && pano.ciudad.setTelon) pano.ciudad.setTelon(pano.partida ? 1 - suave(clamp((pano.partida.f - 0.22) / 0.3, 0, 1)) : 1);
  if (s > PANO_APAGA + 0.5) {
    if (pano.ciudad) {
      if (capaRegistros) capaRegistros.escena.remove(pano.ciudad.grupo);
      pano.ciudad.liberar();
    }
    pano = null;   // (la foto fija queda, oculta con .pano-fuera: vuelve en la vuelta al dron)
    map.triggerRepaint();
  }
}

// textos del pie para la vista k del lugar p (no lo muestra: eso lo decide el bucle)
function pieDeVista(p, k) {
  const vk = p.vistas[k] || {};   // la vista dominante
  $('#pie-lugar').textContent = vk.lugar || p.lugar || '';
  $('#pie-tipo').textContent = vk.tipo || p.tipo || '';
  // la numeración cuenta sólo las vistas con el mismo nombre (el Domino Park dentro del Tower no suma al Tower)
  const mismas = p.vistas.filter((v) => (v.lugar || p.lugar) === (vk.lugar || p.lugar)), n = mismas.length;
  $('#pie-n').textContent = n > 1 ? `viewpoint ${mismas.indexOf(vk) + 1} / ${n}` : '';
}

// ── bucle de animación ─────────────────────────────
function cuadro(ahora) {
  const dt = Math.min(0.1, (ahora - ultimoCuadro) / 1000);
  ultimoCuadro = ahora;

  // (no map.isStyleLoaded(): da false cada vez que se están bajando teselas, y en los vuelos eso pasa todo el tiempo.
  // La cámara quedaba congelada 4–5 cuadros y después saltaba: los «saltos» al ir a las fotos)
  if (estiloListo) {
    const t = tActual();
    const e = estado(t);
    const mir = miradaEn(t);
    const vu = iniciado ? vuelo(t) : null;
    const at = iniciado ? atencion(t, vu) : null;

    marcador.setLngLat([e.lng, e.lat]);
    elCaminante.classList.toggle('quieto', e.pausa);
    elEstado.classList.toggle('en-pausa', e.pausa && iniciado);
    // nota de esquina: el momento que marcó la artista o, si no hay, el descriptor del audio. Sin texto mientras se
    // miran las fotos (el mismo criterio que el pie del registro)
    sonido(t, ahora, vu && (modo !== 'calle' || vu.w > 0.4), mir ? '' : e.nota);

    // pie del registro
    if (vu && (modo !== 'calle' || vu.w > 0.4)) {
      pieDeVista(vu.p, vu.k);
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

    if (capaRegistros) capaRegistros.actualizar(t, iniciado ? modo : 'general');
    if (ciudad) {
      const [cx, cy] = aLocal([e.lng, e.lat]);
      ciudad.setCaminante(cx, cy, modo === 'calle' && iniciado ? 1 - (vu ? vu.w : 0) * 0.6 : 0.5);
      if (peli) {   // modo video: aparece y desaparece en ~0,7 s
        const obj = modoVideo && modo === 'calle' && iniciado && !terminado ? 1 : 0;
        opVivo += clamp(obj - opVivo, -dt * 1.5, dt * 1.5);
        sincronizarPelicula(t);
        ciudad.setVivo(cx, cy, opVivo);
      }
      // mientras se mira un diorama, los edificios entre la cámara y el lugar (la vereda de enfrente) desaparecen de
      // golpe, sin fundido, apenas la cámara empieza a ir hacia el diorama (en el viaje la cámara sube y se aleja, y
      // pasaba por detrás de esos volúmenes: llenaban la pantalla), y vuelven recién cuando llega a la vista siguiente
      const kCorte = vu && modo === 'calle' && vu.w * (vu.kIso + vu.kCorte) > 0.001 ? 1 : 0;
      ciudad.setCorte(kCorte ? vu.T : null, kCorte);
      if (modo === 'general' || !iniciado) { const [gx, gy] = aLocal(bounds.getCenter().toArray()); ciudad.uniforms.uFoco.value.set(gx, gy); ciudad.setRadio(420, 720); }
      else ciudad.setRadio(260, 540);
      if (at && at.length && modo === 'calle') { // la ciudad se revela también alrededor del lugar mirado
        let fx = cx, fy = cy;
        for (const { a, T } of at) { const f = 0.5 * a + 0.5 * (vu ? vu.w : 0); fx += (T[0] - fx) * f; fy += (T[1] - fy) * f; }
        ciudad.uniforms.uFoco.value.set(fx, fy);
      }
      // piso propio y opaco en la vereda (tapa las calles de MapLibre, que a ras del piso titilan al cambiar de tiles)
      ciudad.setSuelo(modo === 'calle' && iniciado ? 1 : 0, dt);
      const { arr, ola, prio } = intensidades(t);
      ciudad.setIntensidades(arr, ola, prio);
    }
    if (modo === 'calle') {
      // (pedido: el punto del caminante no sale nunca en cámara en la vereda; queda sólo para las vistas Aérea y Mapa)
      elCaminante.style.display = 'none';
    }
    if (modo !== 'calle' && !enTransicion && !map.isMoving() && !panoActiva()) {
      const fov = map.getVerticalFieldOfView();
      if (Math.abs(fov - FOV_MAPA) > 0.05) map.setVerticalFieldOfView(fov + (FOV_MAPA - fov) * (1 - Math.exp(-dt * 2.5)));
    }
    if (!etiquetasVisibles && modo !== 'calle' && !enTransicion && !map.isMoving() && map.getPitch() < 70 && !panoActiva()) etiquetas(true);

    const k = 1 - Math.exp(-dt * 1.6);
    if (pano) panoCuadro(ahora);
    if (pano && pano.partida && !pano.partida.llega) camaraPartida(ahora);
    else if (panoActiva()) camaraPano(ahora);
    else if (!iniciado || (modo === 'general' && terminado)) {
      if (!map.isMoving()) map.setBearing(map.getBearing() + dt * 2.5);
    } else if (!enTransicion && modo === 'calle') {
      // hacia dónde mira: al frente (apenas abierto hacia su vereda), o la fachada del registro, o en la escucha
      // va y viene entre el frente y las fachadas de su vereda (nunca hacia las de enfrente)
      const base = rumboVereda(e);
      let objR = base, objP = PITCH_CALLE;
      if (mir) {
        const dist = metros(e, mir.m.c);
        const rM = rumbo(e, mir.m.c);
        const pM = Math.min(PITCH_CALLE, 90 + Math.atan2(mir.m.zc - OJO, dist) / RAD);
        objR = base + difAng(base, rM) * mir.i;
        objP = PITCH_CALLE + (pM - PITCH_CALLE) * mir.i;
      } else if (e.pausa) {
        objR = base + difAng(base, rumboVereda(e, MIRA_PAUSA)) * (0.5 - 0.5 * Math.cos(e.tPausa * 0.22));
        objP = PITCH_CALLE + 3 * Math.sin(e.tPausa * 0.13);
      }
      for (const { a, T } of at || []) { // la cabeza se va girando hacia el lugar de su vereda que se va a revelar
        const L = mirarA([...aLocal([e.lng, e.lat]), OJO], T);
        // …salvo que ya haya quedado atrás (el caminante sigue andando durante el travelling): darse vuelta a mirarlo
        // era un giro de 140° al volver de Guantanamera. De costado (90°) cuenta entero; desde ~125°, nada.
        const delante = suave(clamp((Math.cos(difAng(base, L.rumbo) * RAD) + 0.6) / 0.5, 0, 1));
        objR += difAng(objR, L.rumbo) * a * delante;
        objP += (L.pitch - objP) * a * delante;
      }
      if (performance.now() - ultimoToque > 2500) {
        mirarYaw *= Math.exp(-dt * 0.9);
        mirarPitch *= Math.exp(-dt * 0.9);
      }
      // (arranque, mientras la cámara está en el punto de vista de la foto: la mirada queda en la de la llegada; si
      // seguía la del caminante, durante el giro la foto se deslizaba de costado y volvía)
      const quietaEnFoto = vu && vu.p.desdeFoto && t < vu.p.hasta - vu.p.bajada;
      if (!quietaEnFoto) {
        camRumbo += difAng(camRumbo, objR + mirarYaw) * k;
        camPitch += (clamp(objP + mirarPitch, 55, PITCH_CALLE) - camPitch) * k;
      }
      if (!vu && Math.abs(map.getVerticalFieldOfView() - fovCalle()) > 0.01) map.setVerticalFieldOfView(fovCalle());
      // arranque: hasta la bajada, la cámara parte del punto de vista de la foto (adonde la dejó la partida), quieta;
      // en la bajada vuelve a ser la de los ojos del caminante y la cámara avanza por la vereda hasta alcanzarlo
      let eCam = e;
      if (vu && vu.p.desdeFoto && t < vu.p.hasta - vu.p.bajada) {
        const pA = vu.p.vistas[0].pos, ll = aLngLat(pA[0], pA[1]);
        eCam = { ...e, lng: ll.lng, lat: ll.lat, caminando: false, enFoto: true };
      }
      map.jumpTo(camaraCalle(eCam, camRumbo, camPitch, vu));
    } else if (!enTransicion && modo === 'aerea' && seguir) {
      if (e.pausa && !audio.paused) orbita += dt * 7;
      else orbita *= Math.exp(-dt * 0.8);
      camRumbo += difAng(camRumbo, e.rumbo + orbita) * k;
      map.jumpTo({ center: [e.lng, e.lat], bearing: camRumbo, padding: rellenoAereo() });
    }
    if ((modo !== 'calle' || enTransicion) && !(rectificaPartida && pano && pano.partida && !pano.partida.llega)) rectificar(null);   // la rectificación es sólo para los vuelos a las fotos

    if (!arrastrando) {
      const d = duracion();
      rango.value = Math.min(1, t / d) * 1000;
      rango.style.setProperty('--p', Math.min(1, t / d) * 100 + '%');
    }
    if (terminado && t < duracion() - 1) ocultarFin();
    if (epilogo && t >= epilogo.hasta) terminar();
    estiloCuadro(ahora, dt, vu, t);
  }
  // la interfaz se ve sólo durante el recorrido: no en la panorámica (ni en la partida ni en la vuelta) ni al final;
  // y aun ahí arranca oculta: sólo aparece con la tecla H
  document.body.classList.toggle('ui-visible', enRecorrido() && !uiOcultaUsuario);
  requestAnimationFrame(cuadro);
}
// Fantasma en la panorámica, Maqueta en el recorrido. En la partida y en la vuelta el fundido va atado al vuelo
// de la cámara; en los demás casos (sin panorámica, o si se comenzó antes de que estuviera lista) dura FUNDIDO_ESTILO.
function estiloCuadro(ahora, dt, vu, t) {
  if (!estilos) return;
  const rampa = (f, [a, b]) => suave(clamp((f - a) / (b - a), 0, 1));
  const v = pano && !pano.apagando && pano.vuelta;
  let transparencia = 0;   // ver sinFantasma
  // si la partida baja a la foto del arranque, la maqueta aparece igual al bajar, pero vuelve a Fantasma al llegar al
  // punto de vista, mientras la foto termina de encenderse (como en los demás travellings)
  if (pano && pano.partida && !pano.partida.llega) {
    mezclaEstilo = rampa(pano.partida.f, MAQUETA_PARTIDA) * (arranqueListo ? 1 : 1 - rampa(pano.partida.f, ARRANQUE_FANTASMA));
  }
  else if (v) {
    // parte de donde estaba (si el recorrido terminó mirando una foto, ya es Fantasma)
    if (v.m0 == null) v.m0 = mezclaEstilo;
    mezclaEstilo = v.m0 * (1 - rampa(clamp((ahora - v.ini) / 1000 / VUELTA_SEG, 0, 1), FANTASMA_VUELTA));
  } else if (vu && (!pano || (pano.partida && pano.partida.llega && vu.p.desdeFoto))) {
    // en un travelling: atado al vuelo de la cámara (va con el audio; si se salta, salta con la cámara)
    const p = vu.p, sube = (t - p.inicio) / p.subida, baja = (t - (p.hasta - p.bajada)) / p.bajada;
    // el arranque llega ya en Fantasma (desde la partida) y pasa a Maqueta recién al alcanzar al caminante
    // (bajando de una vista alta, la maqueta vuelve recién cuando la cámara ya está en la calle: ver bajadaAlta)
    const sale = p.ultAlta && !p.desdeFoto ? MAQUETA_SALE_ALTA : MAQUETA_SALE;
    // sinFantasma (El Pub): la ciudad no pasa a Fantasma, sigue en Maqueta, pero se vuelve transparente a medida que la
    // cámara se acerca al punto de vista (toda la subida) y vuelve a opaca mientras baja a los ojos del caminante (toda
    // la bajada). La foto entra con la ola (entraConOla).
    mezclaEstilo = p.sinFantasma ? 1 : p.desdeFoto ? rampa(baja, sale) : 1 - rampa(sube, FANTASMA_LLEGA) * (1 - rampa(baja, sale));
    if (p.sinFantasma) transparencia = rampa(sube, [0, 1]) * (1 - rampa(baja, [0, 1]));
  } else {
    const obj = pano && !pano.apagando ? 0 : 1;
    mezclaEstilo += clamp(obj - mezclaEstilo, -dt / FUNDIDO_ESTILO, dt / FUNDIDO_ESTILO);
  }
  if (v || (pano && !pano.apagando && !pano.partida)) fondoVacio = true;
  else if (mezclaEstilo >= 1) fondoVacio = false;   // la maqueta ya está entera: los travellings vuelven a Fantasma
  // en los travellings el mapa base no se ve (Vacío en vez de Fantasma: el fundido va de la maqueta a Vacío y vuelve):
  // · hacia un diorama la cámara se aleja ~1 km y las manzanas y calles oscuras de Fantasma cambiaban de nivel de detalle
  //   a la vista, achicándose de a saltos alrededor del diorama
  // · a los costados de las fotos se cortaba el fondo en el horizonte: cielo marrón arriba, piso negro abajo
  const enTravelling = vu && modo === 'calle';
  estilos.mezclar(mezclaEstilo, fondoVacio || enTravelling ? 1 : 0, transparencia);
}
// MODO VIDEO (tecla V, sin botón): la película de la caminata (paredes-video.js → pelicula), armada a 12 fps con
// el tiempo del audio, se ve en un panel sobre la pared de la vereda del caminante. Como cada cuadro sale de dónde está
// el caminante, cuando se detiene la imagen se congela y cuando avanza corre en stop motion. Sigue al audio: se
// reproduce con él y se corrige si se desfasa más de un tercio de segundo (o al arrastrar la línea).
const PELICULA = !PARAMS.has('sinvideo') && window.PAREDES_VIDEO && window.PAREDES_VIDEO.pelicula;
let modoVideo = false, opVivo = 0, peli = null;
function alternarVideo() {
  if (!PELICULA || !ciudad) return;
  if (!peli) {
    peli = document.createElement('video');
    peli.muted = true; peli.playsInline = true; peli.preload = 'auto';
    peli.setAttribute('playsinline', ''); peli.setAttribute('muted', '');
    peli.src = PELICULA;
    ciudad.setPelicula(peli);
    window.__peli = peli; // para depurar desde la consola
  }
  modoVideo = !modoVideo;
}
function sincronizarPelicula(t) {
  if (opVivo < 0.01) { if (!peli.paused) peli.pause(); return; }
  const tt = peli.duration ? Math.min(t, peli.duration - 0.05) : t;
  const desfase = Math.abs(peli.currentTime - tt);
  if (audio.paused) {
    if (!peli.paused) peli.pause();
    if (!peli.seeking && desfase > 0.09) peli.currentTime = tt;   // al arrastrar la línea se ve el cuadro de ese lugar
  } else {
    if (peli.paused) peli.play().catch(() => {});
    if (!peli.seeking && desfase > 0.35) peli.currentTime = tt;
    peli.playbackRate = audio.playbackRate;
  }
}
// tecla H: oculta o vuelve a mostrar la interfaz durante el recorrido; tecla T, la textura del video en las paredes
// la interfaz arranca oculta en cada recorrido; la H sólo funciona durante el recorrido (antes y después no hace nada)
let uiOcultaUsuario = true, texturaVideo = false;   // la textura del video arranca oculta
const enRecorrido = () => iniciado && !terminado && !(pano && !pano.apagando);
document.addEventListener('keydown', (ev) => {
  if (ev.metaKey || ev.ctrlKey || ev.altKey || ev.repeat || /INPUT|TEXTAREA|SELECT/.test(ev.target.tagName) && ev.target.type !== 'range') return;
  if ((ev.key === 'h' || ev.key === 'H') && enRecorrido()) uiOcultaUsuario = !uiOcultaUsuario;
  if (ev.key === ' ' && !/BUTTON|INPUT/.test(ev.target.tagName)) { ev.preventDefault(); alternarPausa(); }
  if (ev.key === 'v' || ev.key === 'V') alternarVideo();
  if ((ev.key === 't' || ev.key === 'T') && ciudad && window.PAREDES_VIDEO) {
    texturaVideo = !texturaVideo;
    ciudad.setVideo(texturaVideo ? window.PAREDES_VIDEO.opacidad ?? 0.9 : 0);
  }
});
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
  uiOcultaUsuario = true;
  $('#inicio').classList.add('oculto');
  $('#panel').hidden = false;
  altoPanel();
  // descenso a la vereda: desde la panorámica, el travelling en que la imagen se descompone (si no, un flyTo)
  prepararArranque(true);   // la partida baja a la foto del arranque (si no hay partida, se deshace)
  if (!iniciarPartida()) { prepararArranque(false); setModo(VISTA, { dur: salirDePano() ? 6500 : 4200 }); }
  setTimeout(() => $('#inicio').remove(), 900);
});

// ── controles ──────────────────────────────────────
// El audio arranca con "Start" (o "start again"). El botón de pausa (o la barra espaciadora) lo corta y lo
// retoma; saltar de punto o soltar la línea también lo retoma (final del audio, una llamada, el celular que lo pausó).
let reanudando = false;   // retomar desde la pausa no vuelve a bajar a la vereda (se queda en la vista elegida)
function alternarPausa() {
  if (!iniciado || terminado) return;
  if (audio.paused) { reanudando = !audio.ended; play(); }
  else audio.pause();
}
function marcarPausa() {
  const p = audio.paused;
  $('#pausa').classList.toggle('en-pausa', p);
  $('#pausa').setAttribute('aria-label', p ? 'Play' : 'Pause');
}
$('#pausa').addEventListener('click', alternarPausa);
audio.addEventListener('pause', marcarPausa);
audio.addEventListener('play', marcarPausa);
function play() {
  audio.play().catch((e) => console.warn(e));
  mantenerPantalla();
}
function ir(t) {
  epilogo = null;
  t = Math.max(0, Math.min(duracion() - 0.1, t));
  // un salto al tramo del arranque (volver al principio con anterior o con la línea) repite la secuencia de Start, sin
  // el vuelo del dron: la cámara corta al punto de vista de la foto, se queda quieta y camina hasta el caminante. (Antes
  // quedaba como un travelling común, de los ojos del caminante a la foto y de vuelta, y se veía peor.)
  // Un salto más adelante deja el arranque como un travelling común: la partida ya no está.
  const partidaEnCurso = pano && pano.partida && !pano.partida.llega;
  if (ARRANQUE && iniciado && !partidaEnCurso && t < ARRANQUE.orig.hasta) { prepararArranque(true); reprogramarArranque(t); }
  else if (ARRANQUE && arranqueListo && ARRANQUE.desdeFoto) prepararArranque(false);
  audio.currentTime = t;
  if (iniciado && audio.paused) play();
  if (modo !== 'calle' && !(modo === 'aerea' && seguir) && !panoActiva()) {
    const e = estado(t);
    map.easeTo({ center: [e.lng, e.lat], duration: 800 });
  }
}

// PUNTOS DE INTERÉS para anterior / siguiente: los momentos que marcó la artista (puntos con nota en
// recorrido.js) y el comienzo de cada travelling. Si un momento cae dentro de un travelling, se salta al
// comienzo del travelling (si no, se entraría con la cámara a mitad de camino).
const INTERES = (() => {
  const tr = PROYS.map((p) => ({ t: p.desde, hasta: p.hasta, nombre: p.lugar }));
  const notas = R.puntos.filter((p) => p.nota).map((p) => ({ t: aSeg(p.t), nombre: p.nota }))
    .filter((n) => !tr.some((x) => n.t >= x.t - 1 && n.t <= x.hasta));
  const lista = [...tr, ...notas].sort((a, b) => a.t - b.t);
  // momentos a menos de 3 s (o dos pasadas del mismo lugar): queda uno, y si uno es un travelling, ése
  const final = [];
  for (const x of lista) {
    const u = final[final.length - 1];
    if (!u || x.t - u.t > 3) final.push(x);
    else if (x.hasta != null && u.hasta == null) final[final.length - 1] = x;
  }
  return final;
})();
if (PARAMS.has('tramos')) console.log('puntos de interés:\n' + INTERES.map((x) => `${mmss(x.t)}  ${x.nombre}`).join('\n'));
$('#siguiente').addEventListener('click', () => {
  const x = INTERES.find((x) => x.t > audio.currentTime + 0.5);
  if (x) ir(x.t);
});
$('#anterior').addEventListener('click', () => {
  // si se está a poco de empezar un punto, va al anterior; si no, vuelve al comienzo del actual
  const x = [...INTERES].reverse().find((x) => x.t < audio.currentTime - 3);
  ir(x ? x.t : 0);
});
btnSeguir.addEventListener('click', () => setModo('aerea'));

rango.addEventListener('input', () => {
  arrastrando = true;
  tPrevia = (rango.value / 1000) * duracion();
  rango.style.setProperty('--p', rango.value / 10 + '%');
});
rango.addEventListener('change', () => {
  arrastrando = false;
  ir((rango.value / 1000) * duracion());
});

audio.addEventListener('playing', () => {
  if (reanudando) { reanudando = false; return; }
  // si se vuelve a reproducir después del final (anterior, la línea, volver a empezar), se baja otra vez a la vereda
  // (desde la panorámica, con el mismo vuelo largo que al comenzar)
  if (iniciado && (modo !== VISTA || panoActiva())) {
    ocultarFin();
    prepararArranque(true);   // la partida baja a la foto del arranque (si no hay partida, se deshace)
    if (!iniciarPartida()) { prepararArranque(false); setModo(VISTA, { dur: salirDePano() ? 6500 : 3500 }); }
  }
});
audio.addEventListener('loadedmetadata', () => altoPanel());
audio.addEventListener('error', () => console.warn('No se pudo cargar el audio', audio.error));
// final: la cámara vuelve al dron de la panorámica (al editar, se eleva y muestra el recorrido completo)
audio.addEventListener('ended', () => {
  const d = duracion(), ult = PROYS.filter((p) => p.hasta > d && p.inicio < d).pop();
  if (ult && !epilogo) { epilogo = { desde: performance.now(), base: d, hasta: ult.hasta + POST }; return; }
  terminar();
});
function terminar() {
  epilogo = null;
  terminado = true;
  $('#fin').classList.add('visible');
  $('#reiniciar').tabIndex = 0;
  if (INICIO_PANO) volverAPano();
  else setModo('general', { dur: 6000 });
}
function ocultarFin() {
  terminado = false;
  $('#fin').classList.remove('visible');
  $('#reiniciar').tabIndex = -1;
}
$('#reiniciar').addEventListener('click', () => {
  ocultarFin();
  uiOcultaUsuario = true;   // el nuevo recorrido también arranca sin interfaz
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
    title: 'Calle Ocho Walk', artist: M ? M.artista : '', album: M ? `${M.titulo}: ${M.subtitulo}` : '',
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

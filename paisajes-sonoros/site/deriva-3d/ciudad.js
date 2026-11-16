// Ciudad dibujada: los volúmenes de OpenStreetMap (edificios.json) con luz rasante de atardecer,
// sombras proyectadas, tramado de grabado en las sombras, ventanas encendidas y
// PROYECCIONES ANAMÓRFICAS: cada imagen se proyecta como desde un proyector ubicado en el punto
// de vista donde fue tomada. Desde ese punto (y sólo desde ahí) la imagen se recompone entera;
// desde cualquier otro lugar aparece fragmentada y estirada sobre fachadas, techos y piso.

import { configurarThree } from './camara.js';

const MAX_PROY = 6;   // proyecciones SIMULTÁNEAS: cada una usa 2 texturas (imagen + profundidad); 6·2 + sol = 13 ≤ 16 (mínimo en celulares)
const R_FOCO = [260, 520];   // radio (m) alrededor del caminante a partir del cual la ciudad se disuelve

// ESTILOS (uEstilo, ver estilos.js): 0 atardecer · 1 aristas · 2 fantasma · 3 cercanía · 4 cianotipo · 5 sonar · 6 nube de puntos
//   · 7 maqueta
const COMUN = /* glsl */ `
uniform sampler2D uSolProf; uniform mat4 uSolVP; uniform vec3 uSolDir; uniform vec2 uSolTexel; uniform float uSolBiasM;
uniform sampler2D uSolProfC; uniform mat4 uSolVPC; uniform vec2 uSolTexelC; uniform float uSolBiasC; uniform float uSolCerca;
uniform mat4 uProyVP[${MAX_PROY}]; uniform vec3 uProyPos[${MAX_PROY}]; uniform vec2 uProyNF[${MAX_PROY}];
uniform float uProyInt[${MAX_PROY}]; uniform sampler2D uProyTex[${MAX_PROY}]; uniform sampler2D uProyProf[${MAX_PROY}];
uniform float uProyLado[${MAX_PROY}]; uniform float uProyTol[${MAX_PROY}]; uniform vec4 uOla; uniform float uOlaLuz;
uniform vec3 uCaminante; uniform float uLinterna; uniform vec2 uFoco; uniform vec2 uRadio; uniform vec3 uNiebla;
uniform float uEstilo; uniform vec3 uCamara; uniform float uTiempo; uniform vec3 uTinta; uniform vec3 uPisoCol;
varying vec3 vPos;

// Sombras del sol con dos mapas de profundidad ortográficos: uno CERCANO, fino, alrededor del foco (se rehace
// cuando el foco se mueve), y uno LEJANO para toda la ciudad. En el borde del cercano se funden.
float cmpSol(sampler2D m, vec2 uv, float z) { return step(z, texture2D(m, uv).r); }
// PCF bilineal: cuatro comparaciones interpoladas según la posición dentro del texel (el borde no escalona)
float pcfBil(sampler2D m, vec2 uv, float z, vec2 tx) {
  vec2 st = uv / tx - 0.5; vec2 f = fract(st); vec2 b = (floor(st) + 0.5) * tx;
  return mix(mix(cmpSol(m, b, z), cmpSol(m, b + vec2(tx.x, 0.0), z), f.x),
             mix(cmpSol(m, b + vec2(0.0, tx.y), z), cmpSol(m, b + tx, z), f.x), f.y);
}
// cuatro bilineales a ±0,75 texel: filtro de carpa de ~3 texels → penumbra suave
float pcf(sampler2D m, vec2 uv, float z, vec2 tx) {
  vec2 o = tx * 0.75;
  return 0.25 * (pcfBil(m, uv + vec2(-o.x, -o.y), z, tx) + pcfBil(m, uv + vec2(o.x, -o.y), z, tx)
               + pcfBil(m, uv + vec2(-o.x,  o.y), z, tx) + pcfBil(m, uv + vec2(o.x,  o.y), z, tx));
}
// ndl = coseno entre la superficie y el sol: con sol rasante, el sesgo crece con la pendiente (evita el rayado)
float sombraSol(vec3 p, float ndl) {
  float tg = sqrt(max(1.0 - ndl * ndl, 0.0)) / max(ndl, 0.08);
  float k = 0.6 + 1.2 * min(tg, 8.0);
  vec4 c = uSolVPC * vec4(p, 1.0);
  vec3 q = c.xyz / c.w * 0.5 + 0.5;
  vec2 e = min(q.xy, 1.0 - q.xy);
  float wc = uSolCerca * smoothstep(0.0, 0.08, min(e.x, e.y));   // 1 adentro del mapa cercano, 0 afuera
  float sc = 1.0, sl = 1.0;
  if (wc > 0.0) sc = pcf(uSolProfC, q.xy, q.z - uSolBiasC * k, uSolTexelC);
  if (wc < 1.0) {
    c = uSolVP * vec4(p, 1.0);
    q = c.xyz / c.w * 0.5 + 0.5;
    if (q.x > 0.0 && q.y > 0.0 && q.x < 1.0 && q.y < 1.0) sl = pcf(uSolProf, q.xy, q.z - uSolBiasM * k, uSolTexel);
  }
  return mix(sl, sc, wc);
}
float lineal(float d, vec2 nf) { float z = d * 2.0 - 1.0; return 2.0 * nf.x * nf.y / (nf.y + nf.x - z * (nf.y - nf.x)); }
// imagen proyectada sobre el punto p (con normal n): rgb + alfa
// tol: cuánto puede estar el punto detrás de lo que ve el proyector (por metro de distancia), según el tamaño del texel
vec4 proy(vec3 p, vec3 n, mat4 vp, vec3 pos, vec2 nf, float inten, sampler2D tex, sampler2D prof, float tol) {
  if (inten < 0.002) return vec4(0.0);
  vec3 h = pos - p; float dh = length(h);
  float fr = dot(n, h / dh);
  if (fr < 0.01) return vec4(0.0);
  vec4 c = vp * vec4(p + n * 0.12, 1.0);
  if (c.w <= 0.0) return vec4(0.0);
  vec3 q = c.xyz / c.w;
  if (abs(q.x) > 1.0 || abs(q.y) > 1.0) return vec4(0.0);
  vec2 uv = q.xy * 0.5 + 0.5;
  float visto = lineal(texture2D(prof, uv).r, nf);
  if (lineal(q.z * 0.5 + 0.5, nf) > visto + 0.35 + tol * visto) return vec4(0.0);
  vec4 col = texture2D(tex, uv);
  // las superficies que reciben la imagen muy de costado se atenúan (vistas desde otro lugar son estiramientos).
  // Desde el punto de vista del proyector no hay estiramiento: ahí la imagen va entera, aunque caiga rasante
  // (p. ej. la vereda en las fotos tomadas a la altura de los ojos, que si no quedaba grisada).
  float rasante = mix(smoothstep(0.01, 0.12, fr), 1.0, smoothstep(12.0, 2.0, distance(uCamara, pos)));
  return vec4(col.rgb, col.a * inten * rasante);
}
// líneas paralelas con antialias que se funden en un gris al alejarse (evita el moiré)
float rayado(float x, float grosor) {
  float w = fwidth(x);
  float d = abs(fract(x) - 0.5);
  float l = smoothstep(grosor * 0.5 + w, grosor * 0.5 - w, 0.5 - d);
  return mix(l, grosor, smoothstep(0.3, 0.7, w));
}
float azar(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
// ruido suave (valor interpolado) en 0…1
float ruido(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  vec2 o = vec2(0.0, 1.0);
  return mix(mix(mix(azar(i), azar(i + o.yxx), f.x), mix(azar(i + o.xyx), azar(i + o.yyx), f.x), f.y),
             mix(mix(azar(i + o.xxy), azar(i + o.yxy), f.x), mix(azar(i + o.xyy), azar(i + o.yyy), f.x), f.y), f.z);
}
// OLA: el paso de una imagen a otra del mismo lugar (ver mapa.js → intensidades). En vez de un fundido, un
// frente de bordes irregulares sale del lugar (uOla.xyz) y se expande por la ciudad hasta el radio uOla.w:
// adentro ya está la imagen nueva (uProyLado = +1), afuera sigue la anterior (−1). En el borde las dos se
// reparten grano a grano, y una línea de luz recorre las superficies. uOla.w < 0 = no hay ola.
// Devuelve x = cuánto queda de la imagen saliente (0 adentro … 1 afuera, ya tramado), y = brillo del borde.
vec2 ola(vec3 p) {
  if (uOla.w < 0.0) return vec2(1.0, 0.0);
  float d = distance(p, uOla.xyz) + (ruido(p * 0.08) - 0.5) * 26.0 + (ruido(p * 0.45) - 0.5) * 5.0 - uOla.w;
  float e = smoothstep(-9.0, 2.0, d);
  vec3 q = floor(p * 2.5) + 0.5;
  float w = length(fwidth(p * 2.5));
  float s = mix(step(azar(q), e), e, smoothstep(0.5, 1.5, w));   // granos de 40 cm; de lejos, fundido (sin moiré)
  return vec2(s, exp(-abs(d + 1.0) / 1.4) * uOlaLuz);
}
float mascara(float lado, float s) { return lado > 0.5 ? 1.0 - s : (lado < -0.5 ? s : 1.0); }
const vec3 LUZ_OLA = vec3(1.0, 0.86, 0.62);
// composición "sobre" con color premultiplicado
void sobre(inout vec3 P, inout float A, vec3 c, float a) { P = c * a + P * (1.0 - a); A = a + A * (1.0 - a); }

// cercanía: las imágenes se materializan sólo alrededor de la cámara, con un borde de celdas al azar
float cerca(vec3 p) {
  float d = distance(p, uCamara) + (azar(floor(p * 1.4)) - 0.5) * 12.0;
  return smoothstep(58.0, 20.0, d);
}
// …y cada imagen entera cuando la cámara llega al lugar desde donde fue tomada
float llega(vec3 proyector) { return smoothstep(40.0, 6.0, distance(uCamara, proyector)); }
// sonar: frentes de onda que salen del caminante, se apagan con la distancia
float sonar(vec3 p) {
  float d = distance(p, uCaminante);
  float f = fract((d - uTiempo * 21.0) / 72.0);
  return pow(f, 9.0) * exp(-d / 210.0) + 0.7 * pow(f, 80.0) * exp(-d / 420.0);
}
// grilla de líneas de 1 px que se apaga cuando se vuelve más densa que la pantalla
float grilla(vec2 p, float paso) {
  vec2 q = p / paso; vec2 w = fwidth(q);
  vec2 g = abs(fract(q - 0.5) - 0.5) / max(w, vec2(1e-5));
  return (1.0 - min(min(g.x, g.y), 1.0)) * (1.0 - smoothstep(0.15, 0.45, max(w.x, w.y)));
}
// puntos de una nube LiDAR sobre la superficie (p en metros de la superficie). denso → 1 cuando ya no se distinguen
float puntos(vec2 p, float paso, float semilla, out float denso) {
  vec2 g = p / paso; float w = length(fwidth(g));
  float r = length(fract(g) - 0.5);
  float rad = 0.15 + 0.15 * azar(vec3(floor(g), semilla));
  denso = smoothstep(0.3, 0.8, w);
  return mix(1.0 - smoothstep(rad - w * 0.7, rad + w * 0.7, r), 1.0, denso);
}
// lo mismo, con el paso duplicándose a medida que la cámara se aleja (fundido entre dos niveles, sin saltos)
float puntosLod(vec2 p, float paso, float semilla, float dist, out float denso) {
  float lod = log2(max(dist / 45.0, 1.0)), l0 = floor(lod), f = fract(lod);
  float d0, d1;
  float a = puntos(p, paso * exp2(l0), semilla, d0), b = puntos(p, paso * exp2(l0 + 1.0), semilla + 1.0, d1);
  denso = mix(d0, d1, f);
  return mix(a, b, smoothstep(0.0, 1.0, f));
}
// copia en cianotipo: luminancia → del azul de Prusia al blanco
vec3 cianotipo(vec3 c) { float l = dot(c, vec3(0.3, 0.59, 0.11)); return mix(vec3(0.03, 0.11, 0.30), vec3(0.92, 0.97, 1.0), smoothstep(0.06, 0.9, l)); }
`;

const VERT = /* glsl */ `
attribute vec4 aW; attribute vec4 aI; attribute vec3 aB;
varying vec3 vPos; varying vec3 vN; varying vec4 vW; varying vec4 vI; varying vec3 vB;
void main() {
  vPos = position; vN = normal; vW = aW; vI = aI; vB = aB;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// aW = (u a lo largo del muro, largo del muro, altura del edificio, base)   aI = (tono, techo, esquina inicial, esquina final)
// aB = coordenadas baricéntricas del triángulo (para dibujar sus aristas)
const FRAG_EDIFICIOS = /* glsl */ `
${COMUN}
varying vec3 vN; varying vec4 vW; varying vec4 vI; varying vec3 vB;
void main() {
  vec3 n = normalize(vN);
  // las normales apuntan hacia afuera: una cara vista de espaldas sólo se ve desde ADENTRO del volumen (o un techo
  // desde abajo). Si la cámara quedara dentro de un edificio, sus paredes no se dibujan y se ve hacia afuera.
  if (dot(n, uCamara - vPos) < -0.05) discard;
  bool techo = vI.y > 0.5;
  float tono = vI.x;
  int e = int(uEstilo + 0.5);
  float sol = sombraSol(vPos + n * 0.4, max(dot(n, uSolDir), 0.0));
  float lam = techo ? 0.62 : clamp(dot(n, uSolDir) * 1.6, 0.0, 1.0);
  float kl = smoothstep(0.04, 0.45, sol * lam);
  float lejos = smoothstep(uRadio.x, uRadio.y, distance(vPos.xy, uFoco));
  vec2 hc = techo ? vPos.xy : vec2(vW.x, vPos.z);

  // imágenes proyectadas, compuestas aparte: P premultiplicado, A cobertura
  float kc = e == 3 ? cerca(vPos) : 1.0;
  vec2 ol = ola(vPos);
  vec3 P = vec3(0.0); float A = 0.0; vec4 pr;
  #pragma unroll_loop_start
  for ( int i = 0; i < ${MAX_PROY}; i ++ ) {
    pr = proy(vPos, n, uProyVP[ i ], uProyPos[ i ], uProyNF[ i ], uProyInt[ i ], uProyTex[ i ], uProyProf[ i ], uProyTol[ i ]);
    sobre(P, A, pr.rgb, pr.a * mascara(uProyLado[ i ], ol.x) * (e == 3 ? max(kc, llega(uProyPos[ i ])) : 1.0));
  }
  #pragma unroll_loop_end
  vec3 img = P / max(A, 1e-4);
  float luzOla = ol.y * (0.35 + 0.65 * A);

  // ventanas y trazo del contorno de las fachadas (aristas verticales y bordes superior e inferior)
  float lin = 0.0, linFina = 0.0, ventana = 0.0, on = 0.0;
  if (!techo) {
    vec2 cel = vec2(vW.x / 3.0, (vPos.z - vW.w) / 3.3);
    vec2 f = fract(cel), id = floor(cel);
    float pisos = floor((vW.z - vW.w) / 3.3);
    ventana = step(0.24, f.x) * step(f.x, 0.76) * step(0.3, f.y) * step(f.y, 0.78)
            * step(2.6, vW.y) * step(id.y, pisos - 1.0) * step(1.0, id.x) * step(id.x, floor(vW.y / 3.0) - 2.0);
    ventana *= 1.0 - smoothstep(0.08, 0.25, fwidth(cel.x));
    on = step(0.6, azar(vec3(id, tono * 97.0)));
    float wu = max(fwidth(vW.x), 1e-4), wz = max(fwidth(vPos.z), 1e-4);
    float dU = min(vI.z > 0.5 ? vW.x / wu : 1e3, vI.w > 0.5 ? (vW.y - vW.x) / wu : 1e3);
    float dZ = min((vW.z - vPos.z) / wz, (vPos.z - vW.w) / wz + 1e3 * step(vW.w, 0.01));
    lin = 1.0 - smoothstep(0.5, 1.7, min(dU, dZ));
    linFina = 1.0 - smoothstep(0.0, 1.0, min(dU, dZ));   // trazo de medio píxel, con antialias
  }

  if (e == 1) {
    // ARISTAS: sólo los bordes de los triángulos de la malla, en rayos X; las imágenes tiñen las líneas
    vec3 eb = smoothstep(vec3(0.0), fwidth(vB) * 1.5, vB);
    float a = max(1.0 - min(min(eb.x, eb.y), eb.z), lin);
    a *= (1.0 - lejos) * mix(1.0, 0.5, smoothstep(25.0, 600.0, distance(vPos, uCamara)));
    a *= mix(0.7, 1.0, A);
    vec3 c = mix(uTinta * (0.6 + 0.4 * lin), img * 1.3 + 0.05, min(A * 1.4, 1.0));
    if (a < 0.004) discard;
    gl_FragColor = vec4(c * a, a);
    return;
  }
  if (e == 2) {
    // FANTASMA: la malla no se ve; sólo la luz de las imágenes donde cae
    if (A < 0.004) discard;
    gl_FragColor = vec4(P, A);
    return;
  }

  vec3 col;
  if (e == 4) {
    // CIANOTIPO: plano azul, trazo blanco, sombras rayadas; las imágenes se revelan como copias al ferroprusiato
    col = uNiebla * mix(0.62, 1.2, kl) * (techo ? 1.08 : 1.0);
    col = mix(col, vec3(0.85, 0.93, 1.0), rayado((hc.x - hc.y) * 2.2, 0.14) * (1.0 - kl) * 0.55);
    col = mix(col, vec3(0.85, 0.93, 1.0), ventana * 0.2);
    col = mix(col, vec3(0.95, 0.98, 1.0), lin);
    col = mix(col, cianotipo(img), A);
    col = mix(col, uNiebla, lejos);
  } else if (e == 5) {
    // SONAR: oscuridad; los frentes de onda que salen del caminante revelan las superficies y las imágenes
    float s = sonar(vPos);
    float fr = 0.35 + 0.65 * abs(dot(n, normalize(uCaminante - vPos)));
    col = uNiebla + uTinta * (s * fr * 1.5 + lin * (0.05 + s * 1.6) + ventana * on * 0.05);
    col += uTinta * 0.22 * smoothstep(30.0, 0.0, distance(vPos, uCaminante)) * fr;
    col = mix(col, img, A * clamp(0.12 + s * 2.5, 0.0, 1.0));
    col = mix(col, uNiebla, lejos);
  } else if (e == 6) {
    // NUBE DE PUNTOS: un relevamiento LiDAR coloreado por altura, con un barrido que sube
    float denso;
    float pt = puntosLod(hc, 0.5, tono * 31.0 + (techo ? 7.0 : 0.0), distance(vPos, uCamara), denso);
    if (pt < 0.5 || lejos > 0.98) discard;
    float h = clamp(vPos.z / 22.0, 0.0, 1.0);
    col = mix(mix(vec3(0.24, 0.16, 0.66), vec3(0.15, 0.85, 0.92), smoothstep(0.0, 0.35, h)), vec3(1.0, 0.62, 0.32), smoothstep(0.35, 0.9, h));
    col *= 0.4 + 0.8 * kl;
    col += vec3(0.85, 1.0, 1.0) * exp(-abs(vPos.z - (fract(uTiempo * 0.07) * 40.0 - 5.0)) * 1.2) * 0.7;
    col = mix(col, img * 1.15, A);
    col *= mix(1.0, 0.45, denso);
    col = mix(col, uNiebla, lejos);
  } else if (e == 7) {
    // MAQUETA: como el diorama del flyer. Fachadas de yeso pintado (rosa, crema, blanco) y techos grises
    // bajo una luz de estudio pareja: la sombra no es negra, apenas un gris cálido. Sin tramado, linterna
    // ni ventanas; sólo un trazo muy fino en las aristas, del color de la cara pero más oscuro.
    vec3 cLuz = techo ? vec3(0.85, 0.85, 0.83)
              : mix(mix(vec3(0.96, 0.83, 0.79), vec3(0.95, 0.93, 0.88), step(0.4, tono)), vec3(0.91, 0.88, 0.79), step(0.8, tono));
    col = mix(cLuz * vec3(0.70, 0.69, 0.71), cLuz, 0.3 + 0.7 * kl);
    col = mix(col, col * 0.62, linFina * 0.85);   // trazo: el mismo color de la cara, más oscuro
    col = mix(col, uNiebla, lejos);                           // se funde con el papel
    col = P + col * (1.0 - A);
  } else {
    // ATARDECER (y CERCANÍA, que sólo cambia las imágenes)
    vec3 cSol = techo ? mix(vec3(0.86, 0.66, 0.52), vec3(0.80, 0.60, 0.56), tono)
                      : mix(mix(vec3(0.98, 0.72, 0.46), vec3(0.94, 0.56, 0.48), tono), vec3(0.93, 0.80, 0.60), step(0.72, tono));
    vec3 cSom = mix(vec3(0.24, 0.25, 0.42), vec3(0.32, 0.26, 0.42), tono);
    float hz = clamp(vPos.z / 7.0, 0.0, 1.0);
    cSom *= mix(0.7, 1.1, hz);
    cSol *= mix(0.86, 1.06, hz);
    col = mix(cSom, cSol, kl);
    // tramado de grabado en la sombra
    col = mix(col, vec3(0.11, 0.10, 0.22), rayado((hc.x + hc.y) * 3.0, 0.34) * (1.0 - kl) * 0.5);
    // ventanas: algunas encendidas del lado en sombra
    col = mix(col, vec3(1.0, 0.8, 0.45), ventana * on * (1.0 - kl * 0.75) * 0.9);
    col = mix(col, col * 0.62, ventana * (1.0 - on) * 0.6);
    col = mix(col, mix(vec3(0.70, 0.71, 0.95), vec3(0.36, 0.20, 0.15), kl), lin * 0.9);
    // la linterna del caminante
    vec3 dl = uCaminante - vPos; float dd = length(dl);
    col += vec3(1.0, 0.78, 0.5) * uLinterna * smoothstep(20.0, 0.0, dd) * max(dot(n, dl / dd), 0.0) * 0.5;
    // la ciudad se disuelve lejos del recorrido
    col = mix(col, uNiebla, lejos);
    col = P + col * (1.0 - A);
  }
  col += (LUZ_OLA - col) * luzOla * 0.8 * (1.0 - lejos);
  gl_FragColor = vec4(col, 1.0);
}`;

// piso: sombras, tramado, linterna y proyecciones. Desde arriba es una capa transparente sobre las calles
// del mapa; en la vereda (uSuelo = 1) es opaco: a ras del piso las calles de MapLibre cambian de nivel de
// detalle al moverse la cámara y aparecen y desaparecen manchas de vereda.
const FRAG_PISO = /* glsl */ `
${COMUN}
uniform float uSuelo;
void main() {
  vec3 n = vec3(0.0, 0.0, 1.0);
  int e = int(uEstilo + 0.5);
  float kc = e == 3 ? cerca(vPos) : 1.0;
  vec2 ol = ola(vPos);
  vec3 Q = vec3(0.0); float B = 0.0; vec4 pr;
  #pragma unroll_loop_start
  for ( int i = 0; i < ${MAX_PROY}; i ++ ) {
    pr = proy(vPos, n, uProyVP[ i ], uProyPos[ i ], uProyNF[ i ], uProyInt[ i ], uProyTex[ i ], uProyProf[ i ], uProyTol[ i ]);
    sobre(Q, B, pr.rgb, pr.a * mascara(uProyLado[ i ], ol.x) * (e == 3 ? max(kc, llega(uProyPos[ i ])) : 1.0));
  }
  #pragma unroll_loop_end
  vec3 img = Q / max(B, 1e-4);
  float ki = 1.0;   // cuánto se ven las imágenes en el piso

  vec3 P = vec3(0.0); float A = 0.0;
  sobre(P, A, uPisoCol, uSuelo);   // asfalto (o el fondo del estilo)
  if (e == 1) {
    // grilla métrica teñida por las imágenes (las imágenes no se ven: sólo líneas)
    float g = grilla(vPos.xy, 10.0) * mix(0.3, 0.1, smoothstep(30.0, 300.0, distance(vPos, uCamara)));
    sobre(P, A, mix(uTinta, img * 1.3 + 0.05, min(B * 1.5, 1.0)), min(g * mix(1.0, 1.8, B), 1.0));
    ki = 0.0;
  } else if (e == 4) {
    float sh = 1.0 - sombraSol(vPos + vec3(0.0, 0.0, 0.25), uSolDir.z);
    sobre(P, A, vec3(0.85, 0.93, 1.0), rayado((vPos.x - vPos.y) * 1.6, 0.12) * sh * 0.6);
    sobre(P, A, vec3(0.85, 0.93, 1.0), grilla(vPos.xy, 10.0) * 0.18);
    img = cianotipo(img);
  } else if (e == 5) {
    float s = sonar(vPos);
    sobre(P, A, uTinta, clamp(s * 1.1, 0.0, 1.0));
    sobre(P, A, uTinta, grilla(vPos.xy, 4.0) * min(s * 3.0, 1.0) * 0.6);
    ki = clamp(0.12 + s * 2.5, 0.0, 1.0);
  } else if (e == 6) {
    float denso;
    float pt = puntosLod(vPos.xy, 0.7, 3.0, distance(vPos, uCamara), denso) * (1.0 - denso);
    float cer = smoothstep(120.0, 0.0, distance(vPos.xy, uCaminante.xy));
    sobre(P, A, vec3(0.20, 0.14, 0.50) * (0.5 + cer), pt * (0.35 + 0.5 * cer));
    ki = pt;
  } else if (e == 7) {
    // maqueta: sólo una sombra gris suave, sin tramado
    float sh = 1.0 - sombraSol(vPos + vec3(0.0, 0.0, 0.25), uSolDir.z);
    sobre(P, A, vec3(0.36, 0.34, 0.33), sh * 0.32);
  } else if (e != 2) {
    float sh = 1.0 - sombraSol(vPos + vec3(0.0, 0.0, 0.25), uSolDir.z);
    sobre(P, A, vec3(0.14, 0.14, 0.30), sh * 0.6);
    sobre(P, A, vec3(0.08, 0.07, 0.17), rayado((vPos.x + vPos.y) * 2.2, 0.3) * sh * 0.45);
    sobre(P, A, vec3(1.0, 0.8, 0.52), uLinterna * smoothstep(14.0, 0.0, distance(vPos.xy, uCaminante.xy)) * 0.25);
  }
  float lejos = 1.0 - smoothstep(uRadio.x, uRadio.y, distance(vPos.xy, uFoco));
  // lejos del recorrido: transparente (desde arriba) o niebla, como los edificios (en la vereda)
  P = mix(uNiebla * uSuelo, P, lejos); A = mix(uSuelo, A, lejos);
  sobre(P, A, img, B * ki);
  sobre(P, A, LUZ_OLA, ol.y * 0.7 * B * ki);   // la línea de la ola, sólo donde hay imagen
  gl_FragColor = vec4(P, A);
}`;

// telón: una pantalla curva, lejos, que recibe lo que de una imagen no cae sobre la ciudad (el cielo, el horizonte).
// Sólo se ve donde hay imagen proyectada; el resto es transparente.
const VERT_TELON = /* glsl */ `
varying vec3 vPos; varying vec3 vN;
void main() { vPos = position; vN = normal; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAG_TELON = /* glsl */ `
${COMUN}
varying vec3 vN;
void main() {
  vec3 n = normalize(vN);
  vec2 ol = ola(vPos);
  vec3 Q = vec3(0.0); float B = 0.0; vec4 pr;
  #pragma unroll_loop_start
  for ( int i = 0; i < ${MAX_PROY}; i ++ ) {
    pr = proy(vPos, n, uProyVP[ i ], uProyPos[ i ], uProyNF[ i ], uProyInt[ i ], uProyTex[ i ], uProyProf[ i ], uProyTol[ i ]);
    sobre(Q, B, pr.rgb, pr.a * mascara(uProyLado[ i ], ol.x));
  }
  #pragma unroll_loop_end
  if (B < 0.004) discard;
  gl_FragColor = vec4(Q, B);
}`;

const VERT_PISO = /* glsl */ `
varying vec3 vPos;
void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

// ¿el punto [lng, lat] está dentro del anillo?
export function dentro(p, anillo) {
  let d = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i], [xj, yj] = anillo[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) d = !d;
  }
  return d;
}
// edificios.json = [[altura, base, anillos], …]; cada corrección cambia la altura del edificio que contiene su punto
export function aplicarAlturas(datos, alturas) {
  if (!alturas || !alturas.length) return datos;
  return datos.map((b) => {
    const c = alturas.find((a) => dentro([a.lng, a.lat], b[2][0]));
    return c ? [Math.max(c.alt, b[1] + 0.5), b[1], b[2]] : b;
  });
}

/**
 * @param THREE      módulo three
 * @param opciones   { url, local([lng,lat]→[x,y]), sol:{azimut, elevacion}, vistas: [vista normalizada de camara.js],
 *                     alturas: [{lat, lng, alt}] (corrige la altura del edificio que contiene ese punto), repintar,
 *                     telon: { centro: [x, y], radio, desde, hasta (rumbos en grados), alto } (opcional) }
 *                   Cada vista puede tener `lejos`: hasta cuántos metros alcanza su proyector (900 si no se indica).
 */
export async function crearCiudad(THREE, { url, local, sol, vistas, alturas = [], repintar, telon = null }) {
  const datos = aplicarAlturas(await (await fetch(url)).json(), alturas);

  // ── geometría ──
  const P = [], N = [], W = [], I = [];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const area = (r) => r.reduce((a, p, i) => { const q = r[(i + 1) % r.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
  const vert = (x, y, z, n, w, inf) => { P.push(x, y, z); N.push(...n); W.push(...w); I.push(...inf); };

  const volumenes = []; // contornos en metros, para que la cámara esquive los edificios (alturaCerca)
  for (const [h, mh, anillos] of datos) {
    const rs = anillos.map((r) => r.map(([lng, lat]) => local([lng, lat]))).filter((r) => r.length >= 3);
    if (!rs.length) continue;
    rs.forEach((r, k) => { if ((k === 0) !== (area(r) > 0)) r.reverse(); });
    {
      const xs = rs[0].map((p) => p[0]), ys = rs[0].map((p) => p[1]);
      volumenes.push({ h, anillo: rs[0], caja: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] });
    }
    const [ax, ay] = rs[0][0];
    const tono = Math.abs(Math.sin(ax * 12.9898 + ay * 78.233) * 43758.5453) % 1;
    for (const r of rs) {
      const n = r.length;
      const esq = r.map((p, i) => {
        const a = r[(i - 1 + n) % n], c = r[(i + 1) % n];
        const u = Math.atan2(p[1] - a[1], p[0] - a[0]), v = Math.atan2(c[1] - p[1], c[0] - p[0]);
        return Math.abs(((v - u + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) > 0.4 ? 1 : 0;
      });
      for (let i = 0; i < n; i++) {
        const a = r[i], b = r[(i + 1) % n];
        const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
        if (L < 0.05) continue;
        const nm = [dy / L, -dx / L, 0];
        const inf = [tono, 0, esq[i], esq[(i + 1) % n]];
        const A0 = [a[0], a[1], mh, [0, L, h, mh]], B0 = [b[0], b[1], mh, [L, L, h, mh]];
        const B1 = [b[0], b[1], h, [L, L, h, mh]], A1 = [a[0], a[1], h, [0, L, h, mh]];
        for (const v of [A0, B0, B1, A0, B1, A1]) vert(v[0], v[1], v[2], nm, v[3], inf);
        x0 = Math.min(x0, a[0]); y0 = Math.min(y0, a[1]); x1 = Math.max(x1, a[0]); y1 = Math.max(y1, a[1]);
      }
    }
    // techo
    const contorno = rs[0].map((p) => new THREE.Vector2(p[0], p[1]));
    const huecos = rs.slice(1).map((r) => r.map((p) => new THREE.Vector2(p[0], p[1])));
    const todos = contorno.concat(...huecos);
    for (const tri of THREE.ShapeUtils.triangulateShape(contorno, huecos))
      for (const k of tri) vert(todos[k].x, todos[k].y, h, [0, 0, 1], [0, 0, h, mh], [tono, 1, 0, 0]);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  geo.setAttribute('aW', new THREE.Float32BufferAttribute(W, 4));
  geo.setAttribute('aI', new THREE.Float32BufferAttribute(I, 4));
  // baricéntricas: los vértices van de a tres por triángulo (sin índices)
  const nv = P.length / 3, B = new Float32Array(nv * 3);
  for (let i = 0; i < nv; i++) B[i * 3 + (i % 3)] = 1;
  geo.setAttribute('aB', new THREE.BufferAttribute(B, 3));
  geo.computeBoundingSphere();

  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const hMax = datos.reduce((a, b) => Math.max(a, b[0]), 0);
  const medio = Math.max(x1 - x0, y1 - y0) / 2 + 40;

  // ── sol: dos mapas de profundidad ortográficos con la misma orientación ──
  // LEJANO (toda la ciudad, se calcula una vez): el encuadre se ajusta a la caja de la ciudad vista desde el sol.
  // Con el sol rasante el piso se ve muy escorzado, así que el eje vertical del mapa queda corto y fino.
  const az = sol.azimut * Math.PI / 180, el = sol.elevacion * Math.PI / 180;
  const solDir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.cos(az) * Math.cos(el), Math.sin(el));
  const camSol = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 4000);
  camSol.up.set(0, 0, 1);
  camSol.position.set(cx, cy, 0).addScaledVector(solDir, 2000);
  camSol.lookAt(cx, cy, 0);
  camSol.updateMatrixWorld();
  {
    const v = new THREE.Vector3(); let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity;
    for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [0, hMax]) {
      v.set(x, y, z).applyMatrix4(camSol.matrixWorldInverse);
      a = Math.min(a, v.x); b = Math.max(b, v.x); c = Math.min(c, v.y); d = Math.max(d, v.y);
    }
    camSol.left = a - 10; camSol.right = b + 10; camSol.bottom = c - 10; camSol.top = d + 10;
    camSol.updateProjectionMatrix();
  }
  // CERCANO (alrededor del foco): ±R_SOMBRA m sobre el piso. Usa la misma vista que el lejano y sólo corre la ventana,
  // ajustada a la grilla de texels para que las sombras no tiemblen cuando se rehace.
  const R_SOMBRA = 150, TAM_CERCA = 2048, MUEVE_CERCA = 20;
  const camCerca = camSol.clone();
  const semiX = R_SOMBRA, semiY = R_SOMBRA * Math.sin(el) + Math.min(hMax, 45) * Math.cos(el);
  const pasoX = (2 * semiX) / TAM_CERCA, pasoY = (2 * semiY) / TAM_CERCA;
  let centroCerca = null, rtCerca = null;
  const enLuz = new THREE.Vector3();
  function encuadrarCerca(x, y) {
    enLuz.set(x, y, 0).applyMatrix4(camSol.matrixWorldInverse);
    const ox = Math.round(enLuz.x / pasoX) * pasoX, oy = Math.round(enLuz.y / pasoY) * pasoY;
    camCerca.left = ox - semiX; camCerca.right = ox + semiX; camCerca.bottom = oy - semiY; camCerca.top = oy + semiY;
    camCerca.updateProjectionMatrix();
    uniforms.uSolVPC.value.multiplyMatrices(camCerca.projectionMatrix, camSol.matrixWorldInverse);
    centroCerca = [x, y];
  }

  const objetivo = (tam) => {
    const rt = new THREE.WebGLRenderTarget(tam, tam, { depthBuffer: true });
    rt.depthTexture = new THREE.DepthTexture(tam, tam);
    return rt;
  };
  let tamSol = 4096;
  let rtSol = null;

  // ── proyectores ──
  const vacia = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
  vacia.needsUpdate = true;
  const cargador = new THREE.TextureLoader();
  // Hay más vistas que lugares en el shader (MAX_PROY): cada vista tiene su cámara y su imagen, y sólo las
  // que están a la vista en ese momento (intensidad > 0) ocupan una RANURA, con su mapa de profundidad.
  // Como las vistas de un mismo lugar se muestran de a una, alcanza con 6 ranuras aunque haya muchas imágenes.
  const ranuras = Array.from({ length: MAX_PROY }, () => ({ p: null, rt: null, sucio: false }));
  const proys = vistas.map((v, idx) => {
    // alcance del proyector: 900 m, o más si la cámara está lejos (vistas isométricas, panorámica)
    const dist = Math.hypot(v.pos[0] - v.mira[0], v.pos[1] - v.mira[1], v.pos[2] - v.mira[2]);
    const cam = new THREE.PerspectiveCamera(30, 1.45, v.isometrica ? Math.max(2, dist * 0.3) : 2, v.lejos || Math.max(900, dist * 1.6 + 300));
    // tolerancia de profundidad: 0,004 por metro con una apertura de 40° (el valor de siempre), y proporcional al
    // ángulo de un texel para las demás. Con un teleobjetivo a 1 km, un 0,4 % fijo dejaría pasar la imagen a paredes tapadas.
    const tol = 0.004 * Math.min(1, Math.tan(((v.apertura || 40) / 2) * Math.PI / 180) / Math.tan(20 * Math.PI / 180));
    const p = { v, idx, cam, tol, listo: false, vp: new THREE.Matrix4() };
    const ajustar = (aspecto) => {
      configurarThree(THREE, cam, v, aspecto); // posición, orientación con giro, apertura y centro óptico
      p.vp.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
      for (const r of ranuras) if (r.p === p) r.sucio = true;
    };
    ajustar(1.45);
    p.tex = cargador.load(v.imagen, (tx) => { ajustar(tx.image.width / tx.image.height); p.listo = true; repintar(); });
    p.tex.anisotropy = 8;
    p.tex.generateMipmaps = true;
    return p;
  });
  const uniforms = {
    uSolProf: { value: vacia }, uSolVP: { value: new THREE.Matrix4().multiplyMatrices(camSol.projectionMatrix, camSol.matrixWorldInverse) },
    uSolDir: { value: solDir }, uSolTexel: { value: new THREE.Vector2(1 / tamSol, 1 / tamSol) }, uSolBiasM: { value: 0.5 / 3999 },
    uSolProfC: { value: vacia }, uSolVPC: { value: new THREE.Matrix4() }, uSolTexelC: { value: new THREE.Vector2(1 / TAM_CERCA, 1 / TAM_CERCA) },
    uSolBiasC: { value: 0.22 / 3999 }, uSolCerca: { value: 0 },
    uProyVP: { value: Array.from({ length: MAX_PROY }, () => new THREE.Matrix4()) },
    uProyPos: { value: Array.from({ length: MAX_PROY }, () => new THREE.Vector3()) },
    uProyNF: { value: Array.from({ length: MAX_PROY }, () => new THREE.Vector2(2, 900)) },
    uProyInt: { value: new Array(MAX_PROY).fill(0) },
    uProyTex: { value: new Array(MAX_PROY).fill(vacia) },
    uProyProf: { value: new Array(MAX_PROY).fill(vacia) },
    uProyLado: { value: new Array(MAX_PROY).fill(0) }, uProyTol: { value: new Array(MAX_PROY).fill(0.004) }, uOla: { value: new THREE.Vector4(0, 0, 0, -1) }, uOlaLuz: { value: 0 },
    uCaminante: { value: new THREE.Vector3() }, uLinterna: { value: 0 },
    uFoco: { value: new THREE.Vector2(cx, cy) }, uRadio: { value: new THREE.Vector2(...R_FOCO) },
    uNiebla: { value: new THREE.Color(0.42, 0.30, 0.33) },
    uSuelo: { value: 0 },
    // estilos (estilos.js)
    uEstilo: { value: 0 }, uCamara: { value: new THREE.Vector3(0, 0, 1e4) }, uTiempo: { value: 0 },
    uTinta: { value: new THREE.Vector3(0.62, 0.78, 1.0) }, uPisoCol: { value: new THREE.Vector3(0.30, 0.235, 0.245) },
  };

  const matEdificios = new THREE.ShaderMaterial({
    uniforms, vertexShader: VERT, fragmentShader: FRAG_EDIFICIOS, side: THREE.DoubleSide,
  });
  const edificios = new THREE.Mesh(geo, matEdificios);
  edificios.frustumCulled = false;

  const geoPiso = new THREE.PlaneGeometry(medio * 2 + 400, medio * 2 + 400);
  geoPiso.translate(cx, cy, 0.04);
  const piso = new THREE.Mesh(geoPiso, new THREE.ShaderMaterial({
    uniforms, vertexShader: VERT_PISO, fragmentShader: FRAG_PISO,
    transparent: true, depthWrite: false,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  }));
  piso.renderOrder = -1;
  piso.frustumCulled = false;

  // oclusor: en los estilos transparentes con `ocluye`, los volúmenes se dibujan primero sólo en profundidad
  // (invisibles) para que las imágenes proyectadas en techos y edificios de atrás no se vean a través de la
  // pared más cercana. Sin esto, desde la vereda las capas de la proyección se superponen fuera de orden.
  const oclusor = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    side: THREE.DoubleSide, colorWrite: false, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
  }));
  oclusor.material.side = THREE.FrontSide; // vista desde adentro de un volumen, no tapa (ver el discard de FRAG_EDIFICIOS)
  oclusor.renderOrder = -2; // antes que el piso (-1) y que la malla visible (0)
  oclusor.frustumCulled = false;
  oclusor.visible = false;

  const grupo = new THREE.Group();
  grupo.add(oclusor, edificios, piso);

  // telón: arco de cilindro vertical alrededor de `centro`, con la cara hacia adentro
  if (telon) {
    const { centro: [tx, ty], radio, desde, hasta, alto } = telon;
    const seg = 48, pos = [], nor = [], idx = [];
    for (let i = 0; i <= seg; i++) {
      const a = (desde + ((hasta - desde) * i) / seg) * Math.PI / 180, sx = Math.sin(a), cy = Math.cos(a);
      for (const z of [0, alto]) { pos.push(tx + sx * radio, ty + cy * radio, z); nor.push(-sx, -cy, 0); }
      if (i < seg) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.ShaderMaterial({
      uniforms, vertexShader: VERT_TELON, fragmentShader: FRAG_TELON, side: THREE.DoubleSide,
      transparent: true, depthWrite: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    }));
    m.frustumCulled = false;
    m.renderOrder = 1;
    grupo.add(m);
  }

  // escena sólo de profundidad (para el sol y los proyectores)
  const escenaProf = new THREE.Scene();
  escenaProf.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, colorWrite: false })));
  escenaProf.children[0].frustumCulled = false;

  // distancia (m) de un punto al borde de un contorno
  const distBorde = (x, y, r) => {
    let d = Infinity;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [ax, ay] = r[j], [bx, by] = r[i], dx = bx - ax, dy = by - ay;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
      d = Math.min(d, Math.hypot(x - ax - t * dx, y - ay - t * dy));
    }
    return d;
  };

  return {
    grupo,
    uniforms,
    // Altura de techo que la cámara tiene que superar en (x, y), en metros locales: la del edificio que contiene el
    // punto, o, a menos de r metros de uno, una fracción que crece suave al acercarse (para subir antes de llegar
    // a la pared y no de golpe). 0 = aire libre. La usa el vuelo de la cámara para no atravesar edificios.
    alturaCerca(x, y, r = 4) {
      let alto = 0;
      for (const v of volumenes) {
        const [a, b, c, d] = v.caja;
        if (x < a - r || x > c + r || y < b - r || y > d + r || v.h <= alto) continue;
        if (dentro([x, y], v.anillo)) { alto = v.h; continue; }
        const s = 1 - distBorde(x, y, v.anillo) / r;
        if (s > 0) alto = Math.max(alto, v.h * s * s * (3 - 2 * s));
      }
      return alto;
    },
    // se llama dentro del render de MapLibre, antes de dibujar la escena
    prepasar(renderer, ancho, alto) {
      const f = uniforms.uFoco.value;
      const moverCerca = !centroCerca || Math.hypot(f.x - centroCerca[0], f.y - centroCerca[1]) > MUEVE_CERCA;
      if (rtSol && !moverCerca && !ranuras.some((r) => r.sucio)) return;
      // MapLibre comprime el rango de profundidad de cada capa: para los mapas de sombra hace falta el rango completo
      const gl = renderer.getContext();
      const rango = gl.getParameter(gl.DEPTH_RANGE);
      gl.depthRange(0, 1);
      let hizo = false;
      if (!rtSol) {
        tamSol = Math.min(4096, renderer.capabilities.maxTextureSize);
        uniforms.uSolTexel.value.set(1 / tamSol, 1 / tamSol);
        rtSol = objetivo(tamSol);
        renderer.setRenderTarget(rtSol); renderer.clear(); renderer.render(escenaProf, camSol);
        uniforms.uSolProf.value = rtSol.depthTexture;
        hizo = true;
      }
      if (moverCerca) {
        encuadrarCerca(f.x, f.y);
        if (!rtCerca) rtCerca = objetivo(TAM_CERCA);
        renderer.setRenderTarget(rtCerca); renderer.clear(); renderer.render(escenaProf, camCerca);
        uniforms.uSolProfC.value = rtCerca.depthTexture;
        uniforms.uSolCerca.value = 1;
        hizo = true;
      }
      ranuras.forEach((r, i) => {
        if (!r.sucio) return;
        r.sucio = false;
        if (!r.p) return;
        if (!r.rt) r.rt = objetivo(2048);
        renderer.setRenderTarget(r.rt); renderer.clear(); renderer.render(escenaProf, r.p.cam);
        uniforms.uProyProf.value[i] = r.rt.depthTexture;
        uniforms.uProyVP.value[i] = r.p.vp;
        uniforms.uProyPos.value[i] = r.p.cam.position;
        uniforms.uProyNF.value[i].set(r.p.cam.near, r.p.cam.far);
        uniforms.uProyTol.value[i] = r.p.tol;
        uniforms.uProyTex.value[i] = r.p.tex;
        hizo = true;
      });
      if (hizo) { renderer.setRenderTarget(null); renderer.setViewport(0, 0, ancho, alto); }
      gl.depthRange(rango[0], rango[1]);
    },
    // arr[k] = intensidad de vistas[k]. Reparte las ranuras: la vista que ya tiene una la conserva mientras se vea;
    // si hay más vistas encendidas que ranuras, quedan afuera las más tenues.
    // ola (opcional): { lados: { [k]: +1 entra | −1 sale }, centro: [x, y, z], radio, luz } → ver ola() en los shaders
    setIntensidades(arr, ola = null) {
      const w = (p) => (p && p.listo ? arr[p.idx] || 0 : 0);
      for (const r of ranuras) if (r.p && w(r.p) < 0.002) r.p = null;
      const faltan = proys.filter((p) => w(p) >= 0.002 && !ranuras.some((r) => r.p === p)).sort((a, b) => w(b) - w(a));
      for (const p of faltan) {
        let r = ranuras.find((q) => !q.p);
        if (!r) {
          r = ranuras.reduce((a, b) => (w(b.p) < w(a.p) ? b : a));
          if (w(r.p) + 0.05 >= w(p)) continue;
        }
        r.p = p; r.sucio = true; // el mapa de profundidad y las texturas se cambian en prepasar, antes de dibujar
      }
      ranuras.forEach((r, i) => {
        uniforms.uProyInt.value[i] = r.p && !r.sucio ? w(r.p) : 0;
        uniforms.uProyLado.value[i] = (ola && r.p && ola.lados[r.p.idx]) || 0;
      });
      if (ola) uniforms.uOla.value.set(ola.centro[0], ola.centro[1], ola.centro[2], ola.radio);
      else uniforms.uOla.value.w = -1;
      uniforms.uOlaLuz.value = ola ? ola.luz : 0;
    },
    setCaminante(x, y, linterna) {
      uniforms.uCaminante.value.set(x, y, 2.2);
      uniforms.uLinterna.value = linterna;
      uniforms.uFoco.value.set(x, y);
    },
    // para depurar: qué imagen ocupa cada ranura y con qué intensidad
    ranuras: () => ranuras.map((r, i) => r.p && [r.p.v.imagen.replace('registros/', ''), +uniforms.uProyInt.value[i].toFixed(2)]),
    setRadio(a, b) { uniforms.uRadio.value.set(a, b); },
    // estilo: { indice, niebla, tinta, piso ([r,g,b] tal cual se ven), transparente (la malla se mezcla en vez de tapar),
    //          ocluye (transparente pero sin dejar ver lo que está detrás de la superficie más cercana) }
    setEstilo({ indice, niebla, tinta, piso, transparente, ocluye }) {
      oclusor.visible = !!(transparente && ocluye);
      uniforms.uEstilo.value = indice;
      uniforms.uNiebla.value.setRGB(...niebla);
      uniforms.uTinta.value.set(...tinta);
      uniforms.uPisoCol.value.set(...piso);
      matEdificios.transparent = !!transparente;
      matEdificios.depthWrite = !transparente;
      matEdificios.blending = transparente ? THREE.CustomBlending : THREE.NormalBlending;
      matEdificios.blendSrc = THREE.OneFactor; matEdificios.blendDst = THREE.OneMinusSrcAlphaFactor;
      matEdificios.needsUpdate = true;
    },
    setCamara(x, y, z) { uniforms.uCamara.value.set(x, y, z); },
    setTiempo(s) { uniforms.uTiempo.value = s; },
    // opacidad del piso propio (0 = se ven las calles del mapa, 1 = piso opaco); con dt, se acerca de a poco
    setSuelo(v, dt) {
      const u = uniforms.uSuelo;
      u.value = dt == null ? v : u.value + (v - u.value) * (1 - Math.exp(-dt * 2));
      if (Math.abs(u.value - v) < 0.002) u.value = v;
    },
  };
}

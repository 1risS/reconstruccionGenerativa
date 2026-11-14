// Ciudad dibujada: los volúmenes de OpenStreetMap (edificios.json) con luz rasante de atardecer,
// sombras proyectadas, tramado de grabado en las sombras, ventanas encendidas y
// PROYECCIONES ANAMÓRFICAS: cada imagen se proyecta como desde un proyector ubicado en el punto
// de vista donde fue tomada. Desde ese punto (y sólo desde ahí) la imagen se recompone entera;
// desde cualquier otro lugar aparece fragmentada y estirada sobre fachadas, techos y piso.

import { configurarThree } from './camara.js';

const MAX_PROY = 6;   // cada proyector usa 2 texturas (imagen + profundidad); 6·2 + sol = 13 ≤ 16 (mínimo en celulares)
const R_FOCO = [260, 520];   // radio (m) alrededor del caminante a partir del cual la ciudad se disuelve

const COMUN = /* glsl */ `
uniform sampler2D uSolProf; uniform mat4 uSolVP; uniform vec3 uSolDir; uniform float uSolTexel; uniform float uSolBiasM;
uniform mat4 uProyVP[${MAX_PROY}]; uniform vec3 uProyPos[${MAX_PROY}]; uniform vec2 uProyNF[${MAX_PROY}];
uniform float uProyInt[${MAX_PROY}]; uniform sampler2D uProyTex[${MAX_PROY}]; uniform sampler2D uProyProf[${MAX_PROY}];
uniform vec3 uCaminante; uniform float uLinterna; uniform vec2 uFoco; uniform vec2 uRadio; uniform vec3 uNiebla;
varying vec3 vPos;

// ndl = coseno entre la superficie y el sol: con sol rasante, el sesgo crece con la pendiente (evita el rayado)
float sombraSol(vec3 p, float ndl) {
  vec4 c = uSolVP * vec4(p, 1.0);
  vec3 q = c.xyz / c.w * 0.5 + 0.5;
  if (q.x < 0.0 || q.y < 0.0 || q.x > 1.0 || q.y > 1.0) return 1.0;
  float tg = sqrt(max(1.0 - ndl * ndl, 0.0)) / max(ndl, 0.08);
  float uSolBias = uSolBiasM * (0.6 + 1.2 * min(tg, 8.0));
  float o = uSolTexel * 0.9, s = 0.0;
  s += step(q.z - uSolBias, texture2D(uSolProf, q.xy + vec2(-o, -o)).r);
  s += step(q.z - uSolBias, texture2D(uSolProf, q.xy + vec2( o, -o)).r);
  s += step(q.z - uSolBias, texture2D(uSolProf, q.xy + vec2(-o,  o)).r);
  s += step(q.z - uSolBias, texture2D(uSolProf, q.xy + vec2( o,  o)).r);
  return s * 0.25;
}
float lineal(float d, vec2 nf) { float z = d * 2.0 - 1.0; return 2.0 * nf.x * nf.y / (nf.y + nf.x - z * (nf.y - nf.x)); }
// imagen proyectada sobre el punto p (con normal n): rgb + alfa
vec4 proy(vec3 p, vec3 n, mat4 vp, vec3 pos, vec2 nf, float inten, sampler2D tex, sampler2D prof) {
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
  if (lineal(q.z * 0.5 + 0.5, nf) > visto + 0.35 + 0.004 * visto) return vec4(0.0);
  vec4 col = texture2D(tex, uv);
  return vec4(col.rgb, col.a * inten * smoothstep(0.01, 0.12, fr));
}
// líneas paralelas con antialias que se funden en un gris al alejarse (evita el moiré)
float rayado(float x, float grosor) {
  float w = fwidth(x);
  float d = abs(fract(x) - 0.5);
  float l = smoothstep(grosor * 0.5 + w, grosor * 0.5 - w, 0.5 - d);
  return mix(l, grosor, smoothstep(0.3, 0.7, w));
}
float azar(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
`;

const VERT = /* glsl */ `
attribute vec4 aW; attribute vec4 aI;
varying vec3 vPos; varying vec3 vN; varying vec4 vW; varying vec4 vI;
void main() {
  vPos = position; vN = normal; vW = aW; vI = aI;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// aW = (u a lo largo del muro, largo del muro, altura del edificio, base)   aI = (tono, techo, esquina inicial, esquina final)
const FRAG_EDIFICIOS = /* glsl */ `
${COMUN}
varying vec3 vN; varying vec4 vW; varying vec4 vI;
void main() {
  vec3 n = normalize(vN);
  bool techo = vI.y > 0.5;
  float tono = vI.x;
  float sol = sombraSol(vPos + n * 0.4, max(dot(n, uSolDir), 0.0));
  float lam = techo ? 0.62 : clamp(dot(n, uSolDir) * 1.6, 0.0, 1.0);
  float kl = smoothstep(0.04, 0.45, sol * lam);

  vec3 cSol = techo ? mix(vec3(0.86, 0.66, 0.52), vec3(0.80, 0.60, 0.56), tono)
                    : mix(mix(vec3(0.98, 0.72, 0.46), vec3(0.94, 0.56, 0.48), tono), vec3(0.93, 0.80, 0.60), step(0.72, tono));
  vec3 cSom = mix(vec3(0.24, 0.25, 0.42), vec3(0.32, 0.26, 0.42), tono);
  float hz = clamp(vPos.z / 7.0, 0.0, 1.0);
  cSom *= mix(0.7, 1.1, hz);
  cSol *= mix(0.86, 1.06, hz);
  vec3 col = mix(cSom, cSol, kl);

  // tramado de grabado en la sombra
  vec2 hc = techo ? vPos.xy : vec2(vW.x, vPos.z);
  float tr = rayado((hc.x + hc.y) * 3.0, 0.34) * (1.0 - kl);
  col = mix(col, vec3(0.11, 0.10, 0.22), tr * 0.5);

  if (!techo) {
    // ventanas: algunas encendidas del lado en sombra
    vec2 cel = vec2(vW.x / 3.0, (vPos.z - vW.w) / 3.3);
    vec2 f = fract(cel), id = floor(cel);
    float pisos = floor((vW.z - vW.w) / 3.3);
    float dentro = step(0.24, f.x) * step(f.x, 0.76) * step(0.3, f.y) * step(f.y, 0.78)
                 * step(2.6, vW.y) * step(id.y, pisos - 1.0) * step(1.0, id.x) * step(id.x, floor(vW.y / 3.0) - 2.0);
    dentro *= 1.0 - smoothstep(0.08, 0.25, fwidth(cel.x));
    float on = step(0.6, azar(vec3(id, tono * 97.0)));
    col = mix(col, vec3(1.0, 0.8, 0.45), dentro * on * (1.0 - kl * 0.75) * 0.9);
    col = mix(col, col * 0.62, dentro * (1.0 - on) * 0.6);

    // trazo: aristas verticales y bordes superior e inferior
    float wu = max(fwidth(vW.x), 1e-4), wz = max(fwidth(vPos.z), 1e-4);
    float dU = min(vI.z > 0.5 ? vW.x / wu : 1e3, vI.w > 0.5 ? (vW.y - vW.x) / wu : 1e3);
    float dZ = min((vW.z - vPos.z) / wz, (vPos.z - vW.w) / wz + 1e3 * step(vW.w, 0.01));
    float lin = 1.0 - smoothstep(0.5, 1.7, min(dU, dZ));
    col = mix(col, mix(vec3(0.70, 0.71, 0.95), vec3(0.36, 0.20, 0.15), kl), lin * 0.9);
  }

  // la linterna del caminante
  vec3 dl = uCaminante - vPos; float dd = length(dl);
  col += vec3(1.0, 0.78, 0.5) * uLinterna * smoothstep(20.0, 0.0, dd) * max(dot(n, dl / dd), 0.0) * 0.5;

  // la ciudad se disuelve lejos del recorrido
  col = mix(col, uNiebla, smoothstep(uRadio.x, uRadio.y, distance(vPos.xy, uFoco)));
  vec4 pr;

  #pragma unroll_loop_start
  for ( int i = 0; i < ${MAX_PROY}; i ++ ) {
    pr = proy(vPos, n, uProyVP[ i ], uProyPos[ i ], uProyNF[ i ], uProyInt[ i ], uProyTex[ i ], uProyProf[ i ]);
    col = mix(col, pr.rgb, pr.a);
  }
  #pragma unroll_loop_end
  gl_FragColor = vec4(col, 1.0);
}`;

// piso: capa transparente sobre las calles del mapa (sombras, tramado, linterna, proyecciones)
const FRAG_PISO = /* glsl */ `
${COMUN}
void sobre(inout vec3 P, inout float A, vec3 c, float a) { P = c * a + P * (1.0 - a); A = a + A * (1.0 - a); }
void main() {
  vec3 n = vec3(0.0, 0.0, 1.0);
  float sh = 1.0 - sombraSol(vPos + vec3(0.0, 0.0, 0.25), uSolDir.z);
  vec3 P = vec3(0.0); float A = 0.0;
  sobre(P, A, vec3(0.14, 0.14, 0.30), sh * 0.6);
  sobre(P, A, vec3(0.08, 0.07, 0.17), rayado((vPos.x + vPos.y) * 2.2, 0.3) * sh * 0.45);
  sobre(P, A, vec3(1.0, 0.8, 0.52), uLinterna * smoothstep(14.0, 0.0, distance(vPos.xy, uCaminante.xy)) * 0.25);
  float lejos = 1.0 - smoothstep(uRadio.x, uRadio.y, distance(vPos.xy, uFoco));
  P *= lejos; A *= lejos;
  vec4 pr;
  #pragma unroll_loop_start
  for ( int i = 0; i < ${MAX_PROY}; i ++ ) {
    pr = proy(vPos, n, uProyVP[ i ], uProyPos[ i ], uProyNF[ i ], uProyInt[ i ], uProyTex[ i ], uProyProf[ i ]);
    sobre(P, A, pr.rgb, pr.a);
  }
  #pragma unroll_loop_end
  gl_FragColor = vec4(P, A);
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
 *                     alturas: [{lat, lng, alt}] (corrige la altura del edificio que contiene ese punto), repintar }
 */
export async function crearCiudad(THREE, { url, local, sol, vistas, alturas = [], repintar }) {
  const datos = aplicarAlturas(await (await fetch(url)).json(), alturas);

  // ── geometría ──
  const P = [], N = [], W = [], I = [];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const area = (r) => r.reduce((a, p, i) => { const q = r[(i + 1) % r.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
  const vert = (x, y, z, n, w, inf) => { P.push(x, y, z); N.push(...n); W.push(...w); I.push(...inf); };

  for (const [h, mh, anillos] of datos) {
    const rs = anillos.map((r) => r.map(([lng, lat]) => local([lng, lat]))).filter((r) => r.length >= 3);
    if (!rs.length) continue;
    rs.forEach((r, k) => { if ((k === 0) !== (area(r) > 0)) r.reverse(); });
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
  geo.computeBoundingSphere();

  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const medio = Math.max(x1 - x0, y1 - y0) / 2 + 40;

  // ── sol: mapa de profundidad ortográfico (se calcula una sola vez) ──
  const az = sol.azimut * Math.PI / 180, el = sol.elevacion * Math.PI / 180;
  const solDir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.cos(az) * Math.cos(el), Math.sin(el));
  const radioSol = medio * 1.42;
  const camSol = new THREE.OrthographicCamera(-radioSol, radioSol, radioSol, -radioSol, 1, 4000);
  camSol.up.set(0, 0, 1);
  camSol.position.set(cx, cy, 0).addScaledVector(solDir, 2000);
  camSol.lookAt(cx, cy, 0);
  camSol.updateMatrixWorld(); camSol.updateProjectionMatrix();

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
  const proys = vistas.slice(0, MAX_PROY).map((v) => {
    const cam = new THREE.PerspectiveCamera(30, 1.45, 2, 900);
    const p = { v, cam, rt: null, sucio: true, tex: vacia, vp: new THREE.Matrix4() };
    const ajustar = (aspecto) => {
      configurarThree(THREE, cam, v, aspecto); // posición, orientación con giro, apertura y centro óptico
      p.vp.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
      p.sucio = true;
    };
    ajustar(1.45);
    p.tex = cargador.load(v.imagen, (tx) => { ajustar(tx.image.width / tx.image.height); repintar(); });
    p.tex.anisotropy = 8;
    p.tex.generateMipmaps = true;
    return p;
  });

  const uniforms = {
    uSolProf: { value: vacia }, uSolVP: { value: new THREE.Matrix4().multiplyMatrices(camSol.projectionMatrix, camSol.matrixWorldInverse) },
    uSolDir: { value: solDir }, uSolTexel: { value: 1 / tamSol }, uSolBiasM: { value: 0.5 / 3999 },
    uProyVP: { value: Array.from({ length: MAX_PROY }, (_, i) => (proys[i] ? proys[i].vp : new THREE.Matrix4())) },
    uProyPos: { value: Array.from({ length: MAX_PROY }, (_, i) => (proys[i] ? proys[i].cam.position : new THREE.Vector3())) },
    uProyNF: { value: Array.from({ length: MAX_PROY }, () => new THREE.Vector2(2, 900)) },
    uProyInt: { value: new Array(MAX_PROY).fill(0) },
    uProyTex: { value: Array.from({ length: MAX_PROY }, (_, i) => (proys[i] ? proys[i].tex : vacia)) },
    uProyProf: { value: new Array(MAX_PROY).fill(vacia) },
    uCaminante: { value: new THREE.Vector3() }, uLinterna: { value: 0 },
    uFoco: { value: new THREE.Vector2(cx, cy) }, uRadio: { value: new THREE.Vector2(...R_FOCO) },
    uNiebla: { value: new THREE.Color(0.42, 0.30, 0.33) },
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

  const grupo = new THREE.Group();
  grupo.add(edificios, piso);

  // escena sólo de profundidad (para el sol y los proyectores)
  const escenaProf = new THREE.Scene();
  escenaProf.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, colorWrite: false })));
  escenaProf.children[0].frustumCulled = false;

  return {
    grupo,
    uniforms,
    // se llama dentro del render de MapLibre, antes de dibujar la escena
    prepasar(renderer, ancho, alto) {
      if (rtSol && !proys.some((p) => p.sucio)) return;
      // MapLibre comprime el rango de profundidad de cada capa: para los mapas de sombra hace falta el rango completo
      const gl = renderer.getContext();
      const rango = gl.getParameter(gl.DEPTH_RANGE);
      gl.depthRange(0, 1);
      let hizo = false;
      if (!rtSol) {
        tamSol = Math.min(4096, renderer.capabilities.maxTextureSize);
        uniforms.uSolTexel.value = 1 / tamSol;
        rtSol = objetivo(tamSol);
        renderer.setRenderTarget(rtSol); renderer.clear(); renderer.render(escenaProf, camSol);
        uniforms.uSolProf.value = rtSol.depthTexture;
        hizo = true;
      }
      proys.forEach((p, i) => {
        if (!p.sucio) return;
        p.sucio = false;
        if (!p.rt) p.rt = objetivo(2048);
        renderer.setRenderTarget(p.rt); renderer.clear(); renderer.render(escenaProf, p.cam);
        uniforms.uProyProf.value[i] = p.rt.depthTexture;
        hizo = true;
      });
      if (hizo) { renderer.setRenderTarget(null); renderer.setViewport(0, 0, ancho, alto); }
      gl.depthRange(rango[0], rango[1]);
    },
    setIntensidades(arr) { for (let i = 0; i < MAX_PROY; i++) uniforms.uProyInt.value[i] = arr[i] || 0; },
    setCaminante(x, y, linterna) {
      uniforms.uCaminante.value.set(x, y, 2.2);
      uniforms.uLinterna.value = linterna;
      uniforms.uFoco.value.set(x, y);
    },
    setRadio(a, b) { uniforms.uRadio.value.set(a, b); },
  };
}

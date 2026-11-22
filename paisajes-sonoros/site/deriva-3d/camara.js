// Modelo de cámara compartido: proyectores de la ciudad (ciudad.js), vuelo (mapa.js) y calibración (calibrar.js).
//
// Coordenadas locales en metros: x = este, y = norte, z = arriba.
// Una vista normalizada es:
//   { pos: [x, y, z], rumbo, cabeceo, giro, apertura, centro: [cx, cy] }
//   rumbo    → hacia dónde apunta el eje óptico: 0 = norte, 90 = este (grados)
//   cabeceo  → cuánto mira hacia abajo respecto del horizonte (grados, positivo = abajo)
//   giro     → rotación alrededor del eje óptico (grados). Positivo = la escena aparece girada en sentido
//              antihorario en la imagen (la misma convención que el `roll` de MapLibre)
//   apertura → ángulo horizontal de la imagen (grados)
//   centro   → desplazamiento del centro óptico respecto del centro de la imagen, en unidades
//              normalizadas (−1…1 = de borde a borde). [0, 0] = centrado.
//   estirar  → (opcional) cuánto más alta se proyecta la imagen respecto de su proporción original
//              (1 = sin estirar, 1.1 = 10 % más alta con el mismo ancho). Se ajusta en encajar.html.

export const RAD = Math.PI / 180;

const cruz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const punto = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norma = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// rumbo y cabeceo para mirar desde pos hacia mira
export function orientacion(pos, mira) {
  const dx = mira[0] - pos[0], dy = mira[1] - pos[1], dz = mira[2] - pos[2];
  return { rumbo: Math.atan2(dx, dy) / RAD, cabeceo: Math.atan2(-dz, Math.hypot(dx, dy)) / RAD };
}

// ejes de la cámara: f = adelante, der = derecha de la imagen, arr = arriba de la imagen
export function ejes(v) {
  const r = v.rumbo * RAD, p = v.cabeceo * RAD, g = (v.giro || 0) * RAD;
  const f = [Math.sin(r) * Math.cos(p), Math.cos(r) * Math.cos(p), -Math.sin(p)];
  const r0 = [Math.cos(r), -Math.sin(r), 0];
  const u0 = cruz(r0, f);
  const c = Math.cos(g), s = Math.sin(g);
  return {
    f,
    der: [c * r0[0] - s * u0[0], c * r0[1] - s * u0[1], c * r0[2] - s * u0[2]],
    arr: [s * r0[0] + c * u0[0], s * r0[1] + c * u0[1], s * r0[2] + c * u0[2]],
  };
}

const tanH = (v) => Math.tan((v.apertura * RAD) / 2);
// tangente del semiángulo vertical: la de la proporción de la imagen, por `estirar`
export const tanV = (v, aspecto) => (tanH(v) / aspecto) * (v.estirar || 1);

// punto 3D → posición en la imagen: [u, v] con u = 0…1 de izquierda a derecha y v = 0…1 de arriba abajo.
// Devuelve null si el punto está detrás de la cámara.
export function proyectar(v, aspecto, X, E = ejes(v)) {
  const d = [X[0] - v.pos[0], X[1] - v.pos[1], X[2] - v.pos[2]];
  const zc = punto(d, E.f);
  if (zc <= 0.05) return null;
  const th = tanH(v), tv = tanV(v, aspecto), c = v.centro || [0, 0];
  const nx = punto(d, E.der) / zc / th + c[0];
  const ny = punto(d, E.arr) / zc / tv + c[1];
  return [(nx + 1) / 2, (1 - ny) / 2, zc];
}

// dirección (unitaria) del rayo que pasa por el centro de la imagen
export function rayoCentro(v, aspecto, E = ejes(v)) {
  const th = tanH(v), tv = tanV(v, aspecto), c = v.centro || [0, 0];
  return norma([0, 1, 2].map((i) => E.f[i] - c[0] * th * E.der[i] - c[1] * tv * E.arr[i]));
}
// dirección del rayo que pasa por (u, v) de la imagen
export function rayo(v, aspecto, u, w, E = ejes(v)) {
  const th = tanH(v), tv = tanV(v, aspecto), c = v.centro || [0, 0];
  const nx = u * 2 - 1 - c[0], ny = 1 - w * 2 - c[1];
  return norma([0, 1, 2].map((i) => E.f[i] + nx * th * E.der[i] + ny * tv * E.arr[i]));
}

// configura una THREE.PerspectiveCamera para que proyecte exactamente como proyectar()
export function configurarThree(THREE, cam, v, aspecto) {
  const E = ejes(v);
  cam.position.set(v.pos[0], v.pos[1], v.pos[2]);
  const m = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(...E.der), new THREE.Vector3(...E.arr), new THREE.Vector3(-E.f[0], -E.f[1], -E.f[2]));
  cam.quaternion.setFromRotationMatrix(m);
  cam.aspect = tanH(v) / tanV(v, aspecto);
  cam.fov = (2 * Math.atan(tanV(v, aspecto))) / RAD;
  cam.updateProjectionMatrix();
  const c = v.centro || [0, 0];
  cam.projectionMatrix.elements[8] = -c[0];
  cam.projectionMatrix.elements[9] = -c[1];
  cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  cam.updateMatrixWorld(true);
}

// ── vistas ISOMÉTRICAS (dioramas de IA) ──
// Las imágenes de IA "en isometría" casi no tienen perspectiva: sus verticales y sus paralelas no convergen. Ninguna
// cámara cercana las reproduce; una cámara MUY lejos con un teleobjetivo, sí (en el límite, es una proyección
// ortográfica). Con isometrica: true la vista se aleja a DIST_ISO metros de la mira por su mismo eje y cierra la
// apertura en la misma proporción: sobre el lugar la imagen cubre lo mismo, pero sin perspectiva.
export const DIST_ISO = 1200;
// apertura de la cámara cercana "equivalente" (la que usa el vuelo antes del dolly zoom, ver mapa.js)
export const APERTURA_EQ = 40;
export function alejar(n, dist = DIST_ISO) {
  const d = Math.hypot(n.pos[0] - n.mira[0], n.pos[1] - n.mira[1], n.pos[2] - n.mira[2]);
  if (d >= dist * 0.5) return n; // ya está lejos (p. ej. calibrada)
  const k = dist / d;
  return { ...n, pos: [0, 1, 2].map((i) => n.mira[i] + (n.pos[i] - n.mira[i]) * k),
    apertura: (2 * Math.atan(Math.tan((n.apertura / 2) * RAD) / k)) / RAD };
}
// cuánto más lejos que su equivalente cercana (APERTURA_EQ) está una vista: 1 = vista común
export function factorIso(n) {
  if (!n.isometrica) return 1;
  return Math.max(1, Math.tan((APERTURA_EQ / 2) * RAD) / Math.tan((n.apertura / 2) * RAD));
}

// vista de recorrido.js (+ calibración) → vista normalizada. local([lng, lat]) → [x, y]
export function normalizar(v, local) {
  const [cx, cy] = local([v.camara.lng, v.camara.lat]);
  const pos = [cx, cy, v.camara.alt];
  let mira = null;
  if (v.mira) { const [mx, my] = local([v.mira.lng, v.mira.lat]); mira = [mx, my, v.mira.alt || 0]; }
  const o = v.rumbo != null && v.cabeceo != null ? { rumbo: v.rumbo, cabeceo: v.cabeceo } : orientacion(pos, mira);
  const n = { imagen: v.imagen, pos, rumbo: o.rumbo, cabeceo: o.cabeceo, giro: v.giro || 0,
    apertura: v.apertura || 40, centro: v.centro || [0, 0], estirar: v.estirar || 1, isometrica: !!v.isometrica };
  if (!mira) { const d = rayoCentro(n, 1.45); mira = [0, 1, 2].map((i) => pos[i] + d[i] * 80); }
  n.mira = mira;
  return n.isometrica ? alejar(n) : n;
}

// ─────────────────────────────────────────────────────────────
// CALIBRACIÓN: encontrar la cámara a partir de pares imagen ↔ ciudad
//   pares: [{ uv: [u, v], X: [x, y, z] }]   (u, v en 0…1)
//   ancho, alto: tamaño de la imagen en píxeles (los errores se miden en píxeles)
//   libres: { giro, apertura, centro } → qué parámetros puede mover el ajuste
// ─────────────────────────────────────────────────────────────

const NOMBRES = ['x', 'y', 'z', 'rumbo', 'cabeceo', 'giro', 'lt', 'cx', 'cy'];
const PASOS = [0.01, 0.01, 0.01, 0.005, 0.005, 0.005, 1e-4, 1e-4, 1e-4];
const aVector = (v) => [v.pos[0], v.pos[1], v.pos[2], v.rumbo, v.cabeceo, v.giro || 0,
  Math.log(tanH(v)), (v.centro || [0, 0])[0], (v.centro || [0, 0])[1]];
const aVistaBase = (p) => ({ pos: [p[0], p[1], p[2]], rumbo: p[3], cabeceo: p[4], giro: p[5],
  apertura: (2 * Math.atan(Math.exp(p[6]))) / RAD, centro: [p[7], p[8]] });

export function residuos(v, pares, ancho, alto) {
  const E = ejes(v), asp = ancho / alto;
  return pares.map((q) => {
    const r = proyectar(v, asp, q.X, E);
    if (!r) return null;
    return [(r[0] - q.uv[0]) * ancho, (r[1] - q.uv[1]) * alto];
  });
}
// lim = { dist, apMin, cm }: límites de plausibilidad. Las imágenes casi isométricas (dioramas de IA) se explican
// "mejor" con una cámara infinitamente lejos y un zoom infinito; estos términos lo impiden empujando la cámara
// de vuelta a una distancia y una apertura razonables (cuestan como varios píxeles de error por metro o grado de exceso).
function vectorResiduos(v, pares, ancho, alto, lim) {
  const out = [];
  for (const r of residuos(v, pares, ancho, alto)) out.push(...(r || [5000, 5000]));
  if (lim) {
    const d = Math.hypot(v.pos[0] - lim.cm[0], v.pos[1] - lim.cm[1], v.pos[2] - lim.cm[2]);
    out.push(d > lim.dist ? (d - lim.dist) * 8 : 0);
    out.push(v.apertura < lim.apMin ? (lim.apMin - v.apertura) * 60 : 0);
    out.push(v.pos[2] < 2 ? (2 - v.pos[2]) * 40 : 0);
  }
  return out;
}
const costo = (r) => r.reduce((a, b) => a + b * b, 0);

// Levenberg–Marquardt con jacobiano numérico
function levenberg(v0, pares, ancho, alto, libres, lim, iter = 150) {
  const idx = [0, 1, 2, 3, 4];
  if (libres.giro) idx.push(5);
  if (libres.apertura) idx.push(6);
  if (libres.centro) idx.push(7, 8);
  const est = v0.estirar || 1, aVista = (q) => ({ ...aVistaBase(q), estirar: est }); // el ajuste no toca `estirar`
  let p = aVector(v0);
  let r = vectorResiduos(aVista(p), pares, ancho, alto, lim), c = costo(r);
  let lam = 1e-3;
  for (let it = 0; it < iter; it++) {
    const J = idx.map((k) => {
      const a = [...p], b = [...p];
      a[k] += PASOS[k]; b[k] -= PASOS[k];
      const ra = vectorResiduos(aVista(a), pares, ancho, alto, lim), rb = vectorResiduos(aVista(b), pares, ancho, alto, lim);
      return ra.map((x, i) => (x - rb[i]) / (2 * PASOS[k]));
    });
    const n = idx.length;
    const A = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => J[i].reduce((s, x, m) => s + x * J[j][m], 0)));
    const g = J.map((col) => col.reduce((s, x, m) => s + x * r[m], 0));
    let mejoro = false;
    for (let intento = 0; intento < 12; intento++) {
      const M = A.map((fila, i) => fila.map((x, j) => (i === j ? x + lam * (x + 1e-9) : x)));
      const d = resolverLineal(M, g.map((x) => -x));
      if (!d) { lam *= 10; continue; }
      const q = [...p];
      idx.forEach((k, i) => (q[k] += d[i]));
      q[4] = Math.max(-89, Math.min(89, q[4]));
      const rq = vectorResiduos(aVista(q), pares, ancho, alto, lim), cq = costo(rq);
      if (cq < c) {
        const rel = (c - cq) / (c || 1);
        p = q; r = rq; c = cq; lam = Math.max(lam / 4, 1e-9); mejoro = true;
        if (rel < 1e-10) it = iter;
        break;
      }
      lam *= 6;
    }
    if (!mejoro) break;
  }
  const v = aVista(p);
  v.rumbo = ((v.rumbo % 360) + 540) % 360 - 180;
  return { v, costo: c };
}

function resolverLineal(A, b) {
  const n = b.length, M = A.map((f, i) => [...f, b[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let i = c + 1; i < n; i++) if (Math.abs(M[i][c]) > Math.abs(M[piv][c])) piv = i;
    if (Math.abs(M[piv][c]) < 1e-14) return null;
    [M[c], M[piv]] = [M[piv], M[c]];
    for (let i = 0; i < n; i++) {
      if (i === c) continue;
      const f = M[i][c] / M[c][c];
      for (let j = c; j <= n; j++) M[i][j] -= f * M[c][j];
    }
  }
  return M.map((f, i) => f[n] / f[i]);
}

// autovector del menor autovalor de una matriz simétrica (Jacobi)
function menorAutovector(S) {
  const n = S.length, A = S.map((f) => [...f]);
  const V = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  for (let barrido = 0; barrido < 60; barrido++) {
    let off = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] * A[i][j];
    if (off < 1e-22) break;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
      if (Math.abs(A[p][q]) < 1e-30) continue;
      const th = (A[q][q] - A[p][p]) / (2 * A[p][q]);
      const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < n; k++) {
        const akp = A[k][p], akq = A[k][q];
        A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq;
      }
      for (let k = 0; k < n; k++) {
        const apk = A[p][k], aqk = A[q][k];
        A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk;
      }
      for (let k = 0; k < n; k++) {
        const vkp = V[k][p], vkq = V[k][q];
        V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq;
      }
    }
  }
  let m = 0;
  for (let i = 1; i < n; i++) if (A[i][i] < A[m][m]) m = i;
  return V.map((f) => f[m]);
}

// DLT: estimación lineal de la cámara (necesita ≥ 6 pares que no estén todos en un plano)
export function dlt(pares, ancho, alto) {
  if (pares.length < 6) return null;
  const n = pares.length;
  // normalización de Hartley
  const img = pares.map((q) => [q.uv[0] * ancho, q.uv[1] * alto]);
  const mi = [0, 1].map((k) => img.reduce((s, p) => s + p[k], 0) / n);
  const si = Math.SQRT2 / (img.reduce((s, p) => s + Math.hypot(p[0] - mi[0], p[1] - mi[1]), 0) / n || 1);
  const mw = [0, 1, 2].map((k) => pares.reduce((s, q) => s + q.X[k], 0) / n);
  const sw = Math.sqrt(3) / (pares.reduce((s, q) => s + Math.hypot(q.X[0] - mw[0], q.X[1] - mw[1], q.X[2] - mw[2]), 0) / n || 1);
  const S = Array.from({ length: 12 }, () => new Array(12).fill(0));
  const suma = (fila) => { for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) S[i][j] += fila[i] * fila[j]; };
  pares.forEach((q, k) => {
    const X = [(q.X[0] - mw[0]) * sw, (q.X[1] - mw[1]) * sw, (q.X[2] - mw[2]) * sw, 1];
    const x = (img[k][0] - mi[0]) * si, y = (img[k][1] - mi[1]) * si;
    suma([...X, 0, 0, 0, 0, ...X.map((a) => -x * a)]);
    suma([0, 0, 0, 0, ...X, ...X.map((a) => -y * a)]);
  });
  const pv = menorAutovector(S);
  const Pn = [pv.slice(0, 4), pv.slice(4, 8), pv.slice(8, 12)];
  // desnormalizar: P = Ti⁻¹ · Pn · Tw
  const Ti = [[1 / si, 0, mi[0]], [0, 1 / si, mi[1]], [0, 0, 1]];
  const Tw = [[sw, 0, 0, -sw * mw[0]], [0, sw, 0, -sw * mw[1]], [0, 0, sw, -sw * mw[2]], [0, 0, 0, 1]];
  const mul = (A, B) => A.map((f) => B[0].map((_, j) => f.reduce((s, a, k) => s + a * B[k][j], 0)));
  let P = mul(mul(Ti, Pn), Tw);
  // que los puntos queden delante de la cámara
  const w0 = P[2][0] * pares[0].X[0] + P[2][1] * pares[0].X[1] + P[2][2] * pares[0].X[2] + P[2][3];
  if (w0 < 0) P = P.map((f) => f.map((a) => -a));
  const m1 = P[0].slice(0, 3), m2 = P[1].slice(0, 3), m3 = P[2].slice(0, 3);
  const k33 = Math.hypot(...m3);
  const r3 = norma(m3);
  const k23 = punto(m2, r3);
  const r2 = norma([0, 1, 2].map((i) => m2[i] - k23 * r3[i]));
  const k13 = punto(m1, r3), k12 = punto(m1, r2);
  const r1 = norma([0, 1, 2].map((i) => m1[i] - k12 * r2[i] - k13 * r3[i]));
  const fx = punto(m1, r1) / k33, fy = punto(m2, r2) / k33;
  const cxp = k13 / k33, cyp = k23 / k33;
  // centro de la cámara: M · C = −p4
  const Mi = [m1, m2, m3];
  const C = resolverLineal(Mi, [-P[0][3], -P[1][3], -P[2][3]]);
  if (!C || !isFinite(fx) || fx <= 0 || fy <= 0) return null;
  const f = r3, der = r1;
  const rumbo = Math.atan2(f[0], f[1]) / RAD, cabeceo = Math.asin(Math.max(-1, Math.min(1, -f[2]))) / RAD;
  const rr = rumbo * RAD, r0 = [Math.cos(rr), -Math.sin(rr), 0], u0 = cruz(r0, f);
  const giro = Math.atan2(-punto(der, u0), punto(der, r0)) / RAD;
  const fm = (fx + fy) / 2; // focal media en píxeles (píxeles cuadrados)
  return {
    pos: C, rumbo, cabeceo, giro,
    apertura: (2 * Math.atan(ancho / (2 * fm))) / RAD,
    centro: [(2 * cxp) / ancho - 1, -((2 * cyp) / alto - 1)],
  };
}

// ajuste completo: prueba varios puntos de partida y se queda con el mejor
// opciones: { dist: distancia máxima de la cámara a los puntos (m), apMin: apertura mínima (°),
//             original: vista de partida de recorrido.js (se prueba siempre, por si la actual se fue lejos) }
export function calibrar(pares, ancho, alto, inicial, libres = { giro: true, apertura: true, centro: false }, opciones = {}) {
  const minimo = libres.centro ? 6 : 4;
  if (pares.length < minimo) return null;
  const cm = [0, 1, 2].map((k) => pares.reduce((s, q) => s + q.X[k], 0) / pares.length);
  const lim = { dist: opciones.dist || 300, apMin: opciones.apMin || 12, cm };
  // con pocos pares la apertura queda fija: si no, sobran libertades y la cámara se escapa
  libres = { ...libres, apertura: libres.apertura && pares.length >= 6, centro: libres.centro && pares.length >= 8 };
  // si la cámara actual quedó fuera de los límites, se parte de la original
  const lejos = (v) => Math.hypot(v.pos[0] - cm[0], v.pos[1] - cm[1], v.pos[2] - cm[2]) > lim.dist * 1.5 || v.apertura < lim.apMin * 0.7;
  if (lejos(inicial) && opciones.original) inicial = opciones.original;
  if (inicial.apertura < lim.apMin) inicial = { ...inicial, apertura: lim.apMin };
  const fijo = (v) => ({ ...v,
    giro: libres.giro ? v.giro : inicial.giro || 0,
    apertura: libres.apertura ? v.apertura : inicial.apertura,
    centro: libres.centro ? v.centro : inicial.centro || [0, 0] });
  const inicios = [{ ...inicial, centro: inicial.centro || [0, 0], giro: inicial.giro || 0 }];
  const d = dlt(pares, ancho, alto);
  if (opciones.original && opciones.original !== inicial) inicios.push({ ...opciones.original, centro: inicial.centro || [0, 0] });
  if (d && d.cabeceo > -60 && d.apertura > 5 && d.apertura < 150 && !lejos(d)) {
    inicios.push(fijo(d));
    inicios.push(fijo({ ...d, centro: [0, 0] }));
  }
  // apuntando al centro de los puntos marcados, desde la posición actual
  inicios.push({ ...inicios[0], ...orientacion(inicial.pos, cm) });
  for (const v of inicios) v.estirar = inicial.estirar || 1;
  let mejor = null;
  for (const v0 of inicios) {
    const r = levenberg(v0, pares, ancho, alto, libres, lim);
    if (!mejor || r.costo < mejor.costo) mejor = r;
  }
  const res = residuos(mejor.v, pares, ancho, alto);
  const errs = res.map((r) => (r ? Math.hypot(r[0], r[1]) : Infinity));
  return { vista: mejor.v, libres, limitada: lejos(mejor.v) || Math.hypot(mejor.v.pos[0] - cm[0], mejor.v.pos[1] - cm[1], mejor.v.pos[2] - cm[2]) > lim.dist * 1.02 || mejor.v.apertura < lim.apMin * 0.98, errores: errs, medio: Math.sqrt(errs.reduce((s, e) => s + e * e, 0) / errs.length) };
}

export { NOMBRES };

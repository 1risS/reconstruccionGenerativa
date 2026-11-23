// ─────────────────────────────────────────────────────────────
// Fotos en loop como fondo de la página (SITIOS[slug].fotos, ver sitios.js).
// No hay vista general: una cámara recorre de cerca los detalles de cada foto, en orden, sin detenerse
// (curva Catmull-Rom que pasa por todos los puntos). Entre una foto y la siguiente hay un fundido.
//
// Cámara: { x, y, z } con x, y el centro de la vista (0–1 sobre la foto) y z el zoom.
// z = 1 es la foto llenando toda la pantalla (cover); en un teléfono vertical eso ya muestra un tercio del ancho.
// El centro se corrige para que nunca se vea el borde de la foto.
// Script clásico: define window.iniciarFotos(contenedor, fotos).
// ─────────────────────────────────────────────────────────────
(function () {
  const VIAJE = 6.5;      // s de un detalle al siguiente
  const UNO = 9;          // s de una foto con un solo punto (o ninguno)
  const DERIVA = 0.012;   // zoom que sigue sumando por segundo después del último punto, durante el fundido

  const entre = (v, a, b) => Math.min(b, Math.max(a, v));
  const cr = (p0, p1, p2, p3, u) =>
    0.5 * (2 * p1 + (p2 - p0) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (3 * p1 - p0 - 3 * p2 + p3) * u * u * u);

  function plan(foto, quieto) {
    let det = (foto.detalles || []).map(([x, y, z]) => ({ x, y, z: Math.log(z || 1) }));
    if (!det.length) det = [{ x: 0.25, y: 0.5, z: 0 }, { x: 0.75, y: 0.5, z: 0 }];
    if (quieto) return { p: [det[0]], fin: UNO };
    if (det.length === 1) det.push({ ...det[0], z: det[0].z + 0.08 });
    const fin = det.length === 2 ? UNO : (det.length - 1) * VIAJE;
    return { p: det, fin };
  }

  function pose(pl, t) {
    const p = pl.p, n = p.length;
    if (n === 1) return { x: p[0].x, y: p[0].y, z: Math.exp(p[0].z) };
    if (t >= pl.fin) {
      const u = p[n - 1];
      return { x: u.x, y: u.y, z: Math.exp(u.z) * (1 + DERIVA * (t - pl.fin)) };
    }
    const s = (t / pl.fin) * (n - 1);
    const i = Math.min(n - 2, Math.floor(s)), u = s - i;
    const a = p[Math.max(0, i - 1)], b = p[i], c = p[i + 1], d = p[Math.min(n - 1, i + 2)];
    return {
      x: cr(a.x, b.x, c.x, d.x, u),
      y: cr(a.y, b.y, c.y, d.y, u),
      z: Math.exp(cr(a.z, b.z, c.z, d.z, u)),
    };
  }

  window.iniciarFotos = function (cont, fotos) {
    const quieto = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const capas = [0, 1].map(() => {
      const d = document.createElement("div");
      d.className = "foto";
      cont.appendChild(d);
      return { d, img: null, pl: null, t: 0 };
    });
    const cargadas = [];
    let W = 0, H = 0;
    let frente = null;
    let pidiendo = false;

    function cargar(i) {
      if (!cargadas[i]) {
        const img = new Image();
        img.alt = "";
        img.src = fotos[i].src;
        cargadas[i] = img.decode().then(() => img, () => img);
      }
      return cargadas[i];
    }

    // tamaño de la foto llenando la pantalla (z = 1)
    function ajustar(c) {
      if (!c.img || !c.img.naturalWidth) return;
      const f = Math.max(W / c.img.naturalWidth, H / c.img.naturalHeight);
      c.w0 = c.img.naturalWidth * f;
      c.h0 = c.img.naturalHeight * f;
      c.img.style.width = c.w0 + "px";
      c.img.style.height = c.h0 + "px";
    }

    function dibujar(c) {
      if (!c.pl || !c.w0) return;
      const p = pose(c.pl, c.t);
      const z = Math.max(1, p.z);
      const vw = c.w0 * z, vh = c.h0 * z;
      const cx = entre(p.x, W / 2 / vw, 1 - W / 2 / vw);
      const cy = entre(p.y, H / 2 / vh, 1 - H / 2 / vh);
      c.img.style.transform =
        `translate3d(${(W / 2 - cx * vw).toFixed(2)}px,${(H / 2 - cy * vh).toFixed(2)}px,0) scale(${z.toFixed(5)})`;
    }

    async function poner(i) {
      let img = await cargar(i);
      cargar((i + 1) % fotos.length);
      const c = frente === capas[0] ? capas[1] : capas[0];
      if (img.parentNode && img.parentNode !== c.d) img = img.cloneNode();
      c.d.replaceChildren(img);
      c.img = img;
      c.i = i;
      c.pl = plan(fotos[i], quieto);
      c.t = 0;
      ajustar(c);
      dibujar(c);
      const vieja = frente;
      frente = c;
      requestAnimationFrame(() => {
        c.d.classList.add("visible");
        if (vieja && vieja !== c) vieja.d.classList.remove("visible");
      });
    }

    function medir() {
      W = cont.clientWidth;
      H = cont.clientHeight;
      capas.forEach((c) => { ajustar(c); dibujar(c); });
    }

    let antes = performance.now();
    function cuadro(ahora) {
      const dt = Math.min(0.1, (ahora - antes) / 1000);
      antes = ahora;
      capas.forEach((c) => {
        if (!c.pl) return;
        c.t += dt;
        dibujar(c);
      });
      if (frente && !pidiendo && frente.t >= frente.pl.fin) {
        pidiendo = true;
        poner((frente.i + 1) % fotos.length).then(() => (pidiendo = false));
      }
      requestAnimationFrame(cuadro);
    }

    medir();
    new ResizeObserver(medir).observe(cont);
    pidiendo = true;
    poner(0).then(() => (pidiendo = false));
    requestAnimationFrame(cuadro);
  };
})();

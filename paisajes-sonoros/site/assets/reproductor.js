(function () {
  const slug = document.body.dataset.sitio;
  const sitio = window.SITIOS[slug];
  const M = window.MUESTRA;
  const $ = (s) => document.querySelector(s);

  if (!sitio) {
    $("#app").innerHTML = '<p class="error">Punto sonoro no encontrado.</p>';
    return;
  }

  document.documentElement.style.setProperty("--accent", sitio.color);
  document.title = `${sitio.nombre} · ${M.titulo}`;
  $(".muestra").innerHTML = `<span class="m-titulo">${M.titulo}: ${M.subtitulo}</span><span class="m-sede">${M.sede}</span>`;
  $(".numero").textContent = sitio.numero;
  $(".nombre").textContent = sitio.nombre;
  $(".lugar").textContent = sitio.lugar;
  $(".texto").textContent = sitio.texto || "";
  $(".texto").hidden = !sitio.texto;
  if (sitio.frases && sitio.frases.length) iniciarFrases($(".frases"), sitio.frases);

  // fotos en loop como fondo de la página (assets/fotos.js)
  const cuerpo = document.body;
  const conFotos = !!(sitio.fotos && sitio.fotos.length && window.iniciarFotos);
  if (conFotos) {
    const escena = document.createElement("div");
    escena.className = "fotos";
    escena.setAttribute("aria-hidden", "true");
    cuerpo.prepend(escena);
    cuerpo.classList.add("con-fotos");
    window.iniciarFotos(escena, sitio.fotos);
  }

  // punto sin audio todavía (pistas vacío): sólo las frases y un aviso
  if (!sitio.pistas || !sitio.pistas.length) {
    $(".reproductor").classList.add("sin-audio");
    $(".aviso").textContent = "El paisaje sonoro estará disponible pronto.";
    return;
  }

  const audio = new Audio();
  audio.preload = "metadata";
  const boton = $(".boton");
  const avance = $(".anillo .avance");
  const rango = $("#rango");
  const tActual = $("#actual");
  const tTotal = $("#total");
  const aviso = $(".aviso");
  const contPistas = $(".pistas");

  const R = 52;
  const C = 2 * Math.PI * R;
  avance.style.strokeDasharray = C;
  avance.style.strokeDashoffset = C;

  let idx = 0;
  let arrastrando = false;

  // botones de pista (sólo si hay más de una)
  if (sitio.pistas.length > 1) {
    sitio.pistas.forEach((p, i) => {
      const b = document.createElement("button");
      b.textContent = p.titulo;
      b.setAttribute("aria-label", `Parte ${i + 1}`);
      b.addEventListener("click", () => cargar(i, true));
      contPistas.appendChild(b);
    });
  }

  function fmt(s) {
    if (!isFinite(s)) return "–:––";
    s = Math.floor(s);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }

  function cargar(i, reproducir) {
    idx = i;
    audio.src = sitio.pistas[i].src;
    [...contPistas.children].forEach((b, j) => b.setAttribute("aria-current", j === i));
    rango.value = 0;
    tActual.textContent = "0:00";
    tTotal.textContent = "–:––";
    avance.style.strokeDashoffset = C;
    actualizarMedia();
    if (reproducir) play();
  }

  function play() {
    boton.classList.add("cargando");
    audio.play().catch((e) => {
      boton.classList.remove("cargando");
      if (e.name !== "AbortError") aviso.textContent = "Toca el botón para escuchar.";
    });
  }

  boton.addEventListener("click", () => (audio.paused ? play() : audio.pause()));

  // ── interfaz que se desvanece sobre las fotos ──
  // Con fotos, mientras suena el audio los controles se desvanecen y quedan las fotos. Al tocar la pantalla
  // vuelven por unos segundos. Recién un momento después de aparecer aceptan toques (.ui-llegando),
  // así el mismo toque que los muestra no pausa el audio.
  let relojUI = null;
  function ocultarUI() {
    if (audio.paused || arrastrando) return programarOcultar(4000);
    cuerpo.classList.add("ui-oculta");
  }
  function programarOcultar(ms) {
    clearTimeout(relojUI);
    if (conFotos && !audio.paused) relojUI = setTimeout(ocultarUI, ms);
  }
  function mostrarUI() {
    clearTimeout(relojUI);
    if (!cuerpo.classList.contains("ui-oculta")) return;
    cuerpo.classList.remove("ui-oculta");
    cuerpo.classList.add("ui-llegando");
    setTimeout(() => cuerpo.classList.remove("ui-llegando"), 450);
  }
  if (conFotos) {
    document.addEventListener("pointerdown", () => { mostrarUI(); programarOcultar(4000); }, true);
    $(".reproductor").addEventListener("focusin", () => { mostrarUI(); programarOcultar(4000); });
    audio.addEventListener("playing", () => programarOcultar(1500));
    audio.addEventListener("pause", mostrarUI);
  }

  audio.addEventListener("playing", () => {
    boton.classList.remove("cargando");
    boton.setAttribute("aria-pressed", "true");
    boton.setAttribute("aria-label", "Pausar");
    aviso.textContent = "Se recomienda usar auriculares.";
    aviso.classList.remove("error");
  });
  audio.addEventListener("waiting", () => boton.classList.add("cargando"));
  audio.addEventListener("pause", () => {
    boton.classList.remove("cargando");
    boton.setAttribute("aria-pressed", "false");
    boton.setAttribute("aria-label", "Reproducir");
  });
  audio.addEventListener("loadedmetadata", () => (tTotal.textContent = fmt(audio.duration)));
  audio.addEventListener("timeupdate", () => {
    const d = audio.duration || 0;
    const p = d ? audio.currentTime / d : 0;
    avance.style.strokeDashoffset = C * (1 - p);
    if (!arrastrando) {
      rango.value = p * 1000;
      tActual.textContent = fmt(audio.currentTime);
    }
  });
  audio.addEventListener("ended", () => {
    const sig = idx + 1;
    if (sig < sitio.pistas.length) cargar(sig, true);
    else if (sitio.loop) cargar(0, true);
    else cargar(0, false);
  });
  audio.addEventListener("error", () => {
    boton.classList.remove("cargando");
    aviso.textContent = "No se pudo cargar el audio. Revisa la conexión e intentá de nuevo.";
    aviso.classList.add("error");
  });

  rango.addEventListener("input", () => {
    arrastrando = true;
    tActual.textContent = fmt((rango.value / 1000) * (audio.duration || 0));
  });
  rango.addEventListener("change", () => {
    if (audio.duration) audio.currentTime = (rango.value / 1000) * audio.duration;
    arrastrando = false;
  });

  // controles en pantalla bloqueada / auriculares
  function actualizarMedia() {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: sitio.pistas.length > 1 ? `${sitio.nombre} · ${sitio.pistas[idx].titulo}` : sitio.nombre,
      artist: M.artista,
      album: `${M.titulo}: ${M.subtitulo}`,
    });
  }
  if ("mediaSession" in navigator) {
    navigator.mediaSession.setActionHandler("play", play);
    navigator.mediaSession.setActionHandler("pause", () => audio.pause());
    if (sitio.pistas.length > 1) {
      navigator.mediaSession.setActionHandler("previoustrack", () => cargar(Math.max(0, idx - 1), true));
      navigator.mediaSession.setActionHandler("nexttrack", () => cargar((idx + 1) % sitio.pistas.length, true));
    }
  }

  cargar(0, false);

  // ── frases que se alternan ──────────────────────────
  // Cada frase entra palabra por palabra (sube y se enfoca), queda un rato según su largo y sale hacia arriba.
  // Debajo, un filete del color del punto marca cuánto falta para la siguiente. Se detiene con la pestaña oculta.
  // El contenedor toma el alto de la frase más larga, así la página no salta. Para lectores de pantalla va la lista completa.
  function iniciarFrases(cont, frases) {
    cont.hidden = false;
    cont.innerHTML =
      '<ul class="sr-only"></ul>' +
      '<div class="frases-escena" aria-hidden="true"></div>' +
      '<div class="frases-pie" aria-hidden="true"><span class="frases-n"></span><span class="frases-filete"><i></i></span></div>';
    const lista = cont.querySelector("ul");
    const escena = cont.querySelector(".frases-escena");
    const num = cont.querySelector(".frases-n");
    const filete = cont.querySelector(".frases-filete i");
    frases.forEach((f) => {
      const li = document.createElement("li");
      li.textContent = f;
      lista.appendChild(li);
    });

    const SALIDA = 700; // ms, igual que la transición de .frase.sale en estilo.css
    const total = String(frases.length).padStart(2, "0");
    let i = -1;
    let reloj = null;

    function crear(texto) {
      const p = document.createElement("p");
      p.className = "frase";
      texto.split(" ").forEach((palabra, k) => {
        const s = document.createElement("span");
        s.textContent = palabra;
        s.style.setProperty("--k", k);
        p.appendChild(s);
        p.appendChild(document.createTextNode(" "));
      });
      return p;
    }

    function medir() {
      let alto = 0;
      frases.forEach((f) => {
        const p = crear(f);
        p.classList.add("midiendo");
        escena.appendChild(p);
        alto = Math.max(alto, p.offsetHeight);
        p.remove();
      });
      escena.style.height = alto + "px";
    }

    function siguiente() {
      i = (i + 1) % frases.length;
      const vieja = escena.querySelector(".frase:not(.sale)");
      if (vieja) {
        vieja.classList.add("sale");
        setTimeout(() => vieja.remove(), SALIDA);
      }
      const nueva = crear(frases[i]);
      escena.appendChild(nueva);
      requestAnimationFrame(() => requestAnimationFrame(() => nueva.classList.add("entra")));

      const palabras = frases[i].split(" ").length;
      const dur = Math.min(9000, Math.max(4200, 2200 + frases[i].length * 65)) + palabras * 70;
      num.textContent = `${String(i + 1).padStart(2, "0")} / ${total}`;
      filete.style.transition = "none";
      filete.style.transform = "scaleX(0)";
      void filete.offsetWidth;
      filete.style.transition = `transform ${dur}ms linear`;
      filete.style.transform = "scaleX(1)";
      reloj = setTimeout(siguiente, dur);
    }

    medir();
    let ancho = cont.clientWidth;
    addEventListener("resize", () => {
      if (cont.clientWidth !== ancho) { ancho = cont.clientWidth; medir(); }
    });
    if (document.fonts) document.fonts.ready.then(medir);
    document.addEventListener("visibilitychange", () => {
      clearTimeout(reloj);
      if (!document.hidden) { i -= 1; siguiente(); }
    });
    siguiente();
  }
})();

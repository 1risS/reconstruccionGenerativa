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
  $(".muestra").innerHTML = `<span class="m-artista">${M.artista}</span><span class="m-titulo">${M.titulo}: ${M.subtitulo}</span><span class="m-sede">${M.sede}</span>`;
  $(".numero").textContent = sitio.numero;
  $(".nombre").textContent = sitio.nombre;
  $(".lugar").textContent = sitio.lugar;
  $(".texto").textContent = sitio.texto;

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
})();

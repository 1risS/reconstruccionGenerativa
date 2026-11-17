// Marco de celular para computadoras.
// La obra está pensada para el teléfono. En una computadora (mouse o trackpad y ventana apaisada) la página se abre
// dentro de /marco/, que la muestra en una pantalla vertical (sin dibujar el aparato) aprovechando el alto de la ventana. Adentro
// del marco la página ve un viewport de teléfono, así que el encuadre de la cámara y de las proyecciones es el mismo
// que verá el público.
// Va en el <head> de cada página, antes de cargar cualquier otra cosa.
// Sin marco: ?sin-marco (y nunca con ?editar, que se usa en la computadora).
(function () {
  try {
    if (window.top !== window.self) return;   // ya está dentro del marco (o embebida en otra página)
  } catch (e) { return; }
  var q = new URLSearchParams(location.search);
  if (q.has('sin-marco') || q.has('editar')) return;
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;   // celulares y tabletas
  if (innerWidth < 600 || innerWidth < innerHeight * 0.8) return;          // la ventana ya es angosta
  var marco = new URL('../marco/', document.currentScript.src);
  marco.hash = encodeURIComponent(location.pathname + location.search + location.hash);
  location.replace(marco.href);
})();

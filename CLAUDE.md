# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Proyecto de la muestra de Viviana Zargón "Little Havana" (Miami Photographic Observatory y Aluna Art Foundation, Miami). Todo el código, los comentarios,
los nombres de variables y los mensajes de commit están en **español**: mantener esa convención.

## Qué hay en el repo

- `paisajes-sonoros/`: el proyecto principal. Es un sitio estático: cada QR impreso abre una página que reproduce el paisaje sonoro de un punto de la Calle Ocho, y hay además una deriva en un mapa 3D. **Leer `paisajes-sonoros/README.md`**, que documenta el uso, los formatos de datos y el deploy.
- `carga-puntos/`: web app aparte (Cloudflare Pages `little-havana-carga`, datos en KV) para que la artista cargue los edificios con links de Drive a sus fotos y los momentos del audio con su ubicación. `npm run traer` baja lo cargado y arma un borrador de `puntos`/`proyecciones` para `recorrido.js`. **Leer `carga-puntos/README.md`.**
- `tests-video/`: experimentos aparte (partículas a partir de imagen o video). No dependen del sitio.
- `foto_profundidad.toe`: archivo de TouchDesigner (binario).
- `audios/`, `fachadas/`, `dioramas/`, `drone/`: originales pesados que están **fuera de git** (ver `.gitignore`). Los scripts los leen desde `../` respecto de `paisajes-sonoros/`.

## Comandos (desde `paisajes-sonoros/`)

```bash
npm install
npm run local      # servidor en la wifi local (puerto 8080 o $PORT) + QR de prueba en qrs/prueba-local/
npm run audios     # ../audios/*.WAV → site/audio/*.m4a (necesita ffmpeg; saltea los que ya están al día)
npm run qrs -- https://little-havana-sonoro.pages.dev/   # regenera los QR definitivos en qrs/
npm run deploy     # wrangler pages deploy site → https://little-havana-sonoro.pages.dev/
```

No hay build, linter ni tests. Los cambios se verifican abriendo las páginas con `npm run local`, idealmente
también en un iPhone con Safari (es el caso más delicado para el audio).

`site/audio/` está en `.gitignore` pero `npm run deploy` lo publica: en un clon nuevo hay que correr `npm run audios` antes del deploy, porque si no se sube el sitio sin audio.

## Restricciones que no se ven en el código

- **Los QR ya están impresos.** No cambiar el dominio ni los slugs/carpetas de `site/` (`tower-hotel`, `ball-and-chain`, `casa-de-tabaco`, `domino-park`, `deriva-calle-8`). `/deriva-calle-8/` redirige a `/deriva-3d/` (`site/_redirects` y una página de redirección para el servidor local). Los textos visibles para el público van en inglés (el código sigue en español).
- **Peticiones Range para el audio:** Safari en iOS necesita respuestas 206. Eso está implementado en `scripts/servidor-local.mjs` y en `functions/audio/[[path]].js` (y su copia para la película del modo video, `functions/deriva-3d/video/[[path]].js`) (Pages Function, porque Cloudflare Pages sirve los estáticos completos). Si se toca una de las dos, revisar la otra.

## Arquitectura

### Páginas de los puntos sonoros
- `site/assets/sitios.js` es la única fuente de los textos, colores y pistas de cada punto. Es un script clásico que define `window.MUESTRA` y `window.SITIOS`.
- Cada `site/<slug>/index.html` es una plantilla mínima con `<body data-sitio="slug">`. `assets/reproductor.js` la completa con los datos de `SITIOS[slug]`.
- Node reutiliza el mismo `sitios.js`: `scripts/sitios.mjs` lo ejecuta con `vm` usando un `window` falso, y `generar-qrs.mjs` lo importa. Por eso tiene que seguir siendo JS de navegador válido y sin imports.

### Deriva 3D (`site/deriva-3d/`)
Usa MapLibre 5.6 desde unpkg y Three.js dentro del mapa. Los datos se cargan como scripts clásicos que definen globales, y la lógica va en módulos ES:

- `recorrido.js` → `window.RECORRIDO`: puntos con su tiempo en el audio, miradas y proyecciones. Es el archivo que se edita a mano. El formato está documentado en su encabezado.
- `calibracion.js` → `window.CALIBRACION`: **se genera solo**. Lo escribe el botón "Guardar" de `calibrar.html` con un POST a `/deriva-3d/guardar-calibracion`, que sólo existe en el servidor local. No editarlo a mano.
- Prioridad de las cámaras: borrador en `localStorage` (sólo con `?prueba`) > `calibracion.js` > `camara`/`mira`/`apertura` de `recorrido.js`.
- `camara.js` tiene el modelo de cámara que comparten `ciudad.js`, `mapa.js` y `calibrar.js`. Coordenadas locales en metros: x = este, y = norte, z = arriba, con origen en `RECORRIDO.puntos[0]`. Una vista es `{ pos, rumbo, cabeceo, giro, apertura, centro }`, y las convenciones de signo están en su encabezado. `mapa.js` y `calibrar.js` tienen que usar la misma conversión de coordenadas.
- `ciudad.js` dibuja los volúmenes de `edificios.json`, una copia fija de OSM ya editada (el Tower Theatre se modeló a mano con medidas tomadas de la foto del dron). Agrega sombras de sol y las proyecciones anamórficas en shaders GLSL.
- `mapa.js` sincroniza el audio con la cámara y maneja las vistas Calle, Aérea y Mapa. La partida no baja a los ojos del caminante sino al punto de vista de la foto del arbolito (lugar con `arranque` en `recorrido.js`, constante `ARRANQUE`); de ahí la cámara avanza por la vereda hasta alcanzarlo. Un lugar con varias vistas `huella: true` deja las huellas superpuestas, la primera encima (`capa`, compuesta por capas en `ciudad.js` → `componer`). Parámetros de URL: `?editar` (marcar puntos), `?prueba&t=…` (probar una calibración sin guardar).
- La pantalla de inicio de la deriva muestra la panorámica del dron proyectada desde su punto de vista (Calle 8 y SW 37 Av., 3,5 km al oeste del recorrido), con una segunda ciudad (`portada/edificios.json`) que se libera al comenzar. Al terminar el audio la cámara vuela de vuelta al dron, la ciudad se vuelve a armar y la panorámica queda hasta que se vuelve a empezar. Los datos de esa cámara y el cálculo del encuadre están en `site/portada/panoramica.js`, que comparten la portada y la deriva.
- Estilo de la ciudad (`estilos.js`, sin selector): **Fantasma** en la panorámica y en los travellings a los puntos de vista (mientras se miran las fotos), y **Maqueta** en la vereda. El fundido (`mezclar(t)`, uniform `uFantasma` en `ciudad.js`) va atado al vuelo de la cámara: en la partida, cuando ya se ven de cerca los techos de Little Havana; en cada travelling, al llegar al punto de vista y al volver al caminante; al final, apenas la cámara empieza a subir hacia el dron (constantes `MAQUETA_PARTIDA`, `FANTASMA_LLEGA`, `MAQUETA_SALE` y `FANTASMA_VUELTA` en `mapa.js`). La interfaz (`body.ui-visible`) sólo se ve durante el recorrido, y la tecla H la oculta o la vuelve a mostrar. La tecla T oculta o muestra la textura del video en las paredes (`paredes-video.js`), y la V el modo video (sin botón). Al final quedan sólo «fin del recorrido» y el botón.

Límites fijos que hay que respetar:
- `MAX_PROY = 6` proyecciones. Cada una usa 2 texturas y los celulares admiten 16 en total.
- El pitch máximo es 84°. Por encima, MapLibre dibuja hasta el horizonte y se cuelga.
- Si una foto proyectada sobresale por encima de un edificio, se corrige la altura del edificio en `calibracion.js` → `alturas` (con ⇧ clic en `calibrar.html`). No se cambia `edificios.json`.

### Scripts de Python
`scripts/versiones-audios.py` (separa voces con Demucs y divide en bandas) y `scripts/recortar-diorama.py` usan el venv `.venv/`. El README explica la instalación.

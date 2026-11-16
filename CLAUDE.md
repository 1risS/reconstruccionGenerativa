# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Proyecto de la muestra de Viviana Zargón "Little Havana" (Miami Photographic Observatory y Aluna Art Foundation, Miami). Todo el código, los comentarios,
los nombres de variables y los mensajes de commit están en **español**: mantener esa convención.

## Qué hay en el repo

- `paisajes-sonoros/`: el proyecto principal. Es un sitio estático: cada QR impreso abre una página que reproduce el paisaje sonoro de un punto de la Calle Ocho, y hay además una deriva en un mapa 3D. **Leer `paisajes-sonoros/README.md`**, que documenta el uso, los formatos de datos y el deploy.
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

- **Los QR ya están impresos.** No cambiar el dominio ni los slugs/carpetas de `site/` (`tower-hotel`, `ball-and-chain`, `casa-de-tabaco`, `domino-park`, `deriva-calle-8`). `/deriva-3d/` es una página aparte y no reemplaza a `/deriva-calle-8/`.
- **Peticiones Range para el audio:** Safari en iOS necesita respuestas 206. Eso está implementado dos veces, en `scripts/servidor-local.mjs` y en `functions/audio/[[path]].js` (Pages Function, porque Cloudflare Pages sirve los estáticos completos). Si se toca una de las dos, revisar la otra.

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
- `mapa.js` sincroniza el audio con la cámara y maneja las vistas Calle, Aérea y Mapa. Parámetros de URL: `?editar` (marcar puntos), `?prueba&t=…` (probar una calibración sin guardar).

Límites fijos que hay que respetar:
- `MAX_PROY = 6` proyecciones. Cada una usa 2 texturas y los celulares admiten 16 en total.
- El pitch máximo es 84°. Por encima, MapLibre dibuja hasta el horizonte y se cuelga.
- Si una foto proyectada sobresale por encima de un edificio, se corrige la altura del edificio en `calibracion.js` → `alturas` (con ⇧ clic en `calibrar.html`). No se cambia `edificios.json`.

### Scripts de Python
`scripts/versiones-audios.py` (separa voces con Demucs y divide en bandas) y `scripts/recortar-diorama.py` usan el venv `.venv/`. El README explica la instalación.

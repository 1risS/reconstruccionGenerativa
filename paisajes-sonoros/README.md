# Little Havana — paisajes sonoros (QR)

Muestra de Viviana Zargón en Aluma Art Center, Miami.
Cada QR abre una página que reproduce el paisaje sonoro de uno de los cinco puntos.

| # | Punto | URL |
|---|-------|-----|
| 01 | Tower Hotel | `/tower-hotel/` |
| 02 | Ball & Chain | `/ball-and-chain/` |
| 03 | Casa de Tabaco | `/casa-de-tabaco/` |
| 04 | Domino Park | `/domino-park/` |
| 05 | Deriva Calle 8 | `/deriva-calle-8/` |

## Estructura

```
site/                 ← lo que se publica (sitio estático, sin build)
  assets/sitios.js    ← TEXTOS, COLORES y LISTA DE AUDIOS de cada punto (editar aquí)
  assets/reproductor.js, estilo.css
  audio/*.m4a         ← generados desde ../audios/*.WAV
  <punto>/index.html  ← una página por QR
scripts/
  convertir-audios.sh ← WAV → AAC 160k (.m4a)
  generar-qrs.mjs     ← QR en SVG (imprenta) + PNG + hoja.html imprimible
  servidor-local.mjs  ← prueba en la wifi local
qrs/                  ← QR definitivos
```

## Uso

```bash
npm install                 # una vez
npm run audios              # reconvertir tras cambiar los WAV en ../audios
npm run local               # sirve el sitio en la red local + QR de prueba en qrs/prueba-local/
npm run qrs -- https://DOMINIO-FINAL/ruta/   # QR definitivos en qrs/
```

**Importante:** los QR codifican la URL. Una vez impresos, no cambies el dominio ni los nombres
de las carpetas (`tower-hotel`, etc.). Los audios y textos se pueden cambiar cuando quieras sin reimprimir.

## Agregar o cambiar audios

1. Pon el WAV en `../audios/` (p. ej. `domino_park_01.WAV`).
2. `npm run audios`
3. Agrega la pista en `site/assets/sitios.js` → `pistas: [{ titulo: "II", src: "../audio/domino_park_01.m4a" }]`

Las pistas de un punto se reproducen en secuencia y luego vuelven a empezar (`loop: true`).

## Versiones procesadas (separación y bandas)

`scripts/versiones-audios.py` genera en `../audios/versiones/<nombre>/` (los WAV originales no se tocan):
voces aisladas, voces limpias, percusivo, ambiente, sin voces (separación con Demucs `htdemucs_ft`),
cuatro bandas de frecuencia que suman el original (graves <200 Hz, medios-bajos 200–1k, medios-altos 1–4k,
agudos >4k) y una versión con reducción de ruido de fondo. Las pistas conservan el nivel original, así que
se pueden volver a mezclar (se guardan en float 32-bit como los originales, que tienen picos > 0 dBFS). `informe.txt` resume niveles y proporción de voz por archivo.

```bash
python3 -m venv .venv && .venv/bin/pip install "torch<2.9" "torchaudio<2.9" demucs soundfile numpy scipy noisereduce
.venv/bin/python scripts/versiones-audios.py              # todos (≈2,3× la duración en CPU)
.venv/bin/python scripts/versiones-audios.py ../audios/tower_01.WAV
```

## Prueba de concepto: deriva en mapa 3D (`/deriva-3d/`)

Página aparte (no reemplaza a `/deriva-calle-8/`, cuyo QR ya está impreso). Mapa 3D (MapLibre + OpenFreeMap,
sin claves ni costo) que reproduce el recorrido sincronizado con `deriva_calle_8.m4a`.

- `site/deriva-3d/recorrido.js` ← **puntos del recorrido** (tiempo del audio + coordenadas, `hasta` para las pausas)
  y **miradas**: tramos en que la cámara gira hacia una fachada y aparece un registro (imágenes en `site/deriva-3d/registros/`)
- Vistas: **Calle** (cámara a 1,65 m sobre la vereda; arrastrar = mirar alrededor), **Aérea** (sigue desde arriba), **Mapa** (recorrido completo)
- Los cuadros sobre las fachadas se dibujan con Three.js dentro del mapa; sin imágenes muestran "material pendiente"
- `site/deriva-3d/mapa.js`, `mapa.css` ← lógica y estilo
- **Ciudad dibujada** (`ciudad.js` + `edificios.json`): volúmenes de OpenStreetMap con sol rasante de atardecer,
  sombras, tramado en las sombras y ventanas. `edificios.json` es una copia fija de la zona (Calle 8 entre 12 y 18 Av, hasta la calle 2 al norte)
- **Proyecciones anamórficas** (`proyecciones` en `recorrido.js`): cada imagen se proyecta sobre la ciudad desde el
  punto de vista donde fue tomada (`camara`, `mira`, `apertura`). La cámara deja al caminante, sube a ese punto y ahí
  la imagen se recompone; desde la vereda queda fragmentada en las paredes. Máximo 6 vistas en total.
- **Calibrar las proyecciones** (`/deriva-3d/calibrar.html`, con `npm run local`): se marcan pares
  "este punto de la imagen = esta esquina de la ciudad" (imagen a la izquierda, satélite con los edificios a la derecha)
  y se calcula la cámara que los explica: posición, rumbo, inclinación, giro, apertura y, opcionalmente, centro óptico
  (`camara.js`). Sobre la imagen se dibujan los contornos de la ciudad vistos desde esa cámara; donde calzan, la
  proyección calza. Después se puede retocar a mano y corregir alturas de edificios (⇧ clic en el mapa).
  **Guardar** escribe `site/deriva-3d/calibracion.js`, que tiene prioridad sobre los valores de `recorrido.js`.
  **Probar en la página** abre el recorrido con lo que todavía no se guardó (`?prueba&t=…`).
  Puntos ideales: esquinas de edificios al nivel del piso, 8–12 por imagen, cerca y lejos, en varias fachadas.
- Para recortar el fondo liso de un diorama: `.venv/bin/python scripts/recortar-diorama.py entrada.jpg site/deriva-3d/registros/salida.webp`
- Abrir con `?editar` (p. ej. `/deriva-3d/?editar`) para marcar puntos haciendo clic en el mapa mientras suena el audio
- QR de prueba en `qrs/prueba-3d/` (wifi local y URL en línea)

## Publicar

Sitio en línea: **https://little-havana-sonoro.pages.dev/** (Cloudflare Pages, proyecto `little-havana-sonoro`).

```bash
npm run deploy     # sube la carpeta site/ (pide iniciar sesión en Cloudflare la primera vez)
```

`functions/audio/[[path]].js` es una Pages Function que permite pedir el audio por partes (Range → 206).
Safari en iPhone lo necesita para reproducir y adelantar. Cloudflare sirve los archivos estáticos
siempre completos, así que no hay que borrarla.

Los QR definitivos ya están en `qrs/` y apuntan a esa URL.

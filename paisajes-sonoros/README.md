# Little Havana — paisajes sonoros (QR)

Muestra de Viviana Zargón "Little Havana: Studies on Simulation and Generative Reconstruction", en Miami Photographic Observatory y Aluna Art Foundation (Miami).
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
  **Excepción:** el Tower Theatre (en OSM era un solo bloque de 5 m) se reemplazó por volúmenes medidos sobre la foto del dron:
  auditorio de 10 m, cuerpo curvo del frente de 5 m, torre de entrada de 8 m y aguja de 18 m.
- **Recorrido real** (desde el 17/11/2026): los `puntos` salen de los momentos que marcó la artista en
  `../carga-puntos/` (ella marcó los edificios que se oyen; se pasaron a la vereda, a 8,5 m del eje de la calle). Ida por
  la vereda norte desde Pajaritos (1421 SW 8 St) hasta enfrente de Tumba'o, cruce, y vuelta por la sur hasta El Exquisito.
  Los criterios están en el encabezado de `recorrido.js`.
- **Proyecciones activas** (abrir con `?tramos` para ver la tabla): a la ida, en el momento en que ella marcó que se oyen,
  Guantanamera (0:45), Ball & Chain (1:53: la foto y después dos dioramas de IA), El Cristo (3:51), Top Cigars (4:23) y
  Mr. Cigars (5:48); a la vuelta, en el orden en que se los cruza, Cuban Cigars (11:29) y el Tower Theatre, que cierra
  (11:52: dron, dos dioramas y la cenital). El Tower termina después del audio: el **epílogo** (`mapa.js`) deja correr
  el tiempo con el reloj hasta que la cámara vuelve a la vereda, y recién ahí aparece "fin del recorrido".
  Guantanamera, El Cristo y Mr. Cigars son fotos de Drive (originales en `../fachadas/drive/`): las cámaras se
  ubicaron analizando cada foto contra los volúmenes (qué local es cuál, dónde empieza el edificio vecino, la línea del
  piso; los criterios están en los comentarios de `recorrido.js`), sin pares en `calibrar.html`. Los dioramas de Ball &
  Chain siguen estimados. Los dos del Tower ya están
  calibrados (esquinas del teatro, ~22 px de error medio por las proporciones inventadas por la IA). El diorama de
  336 SW 15 Av queda comentado.
- **Proyecciones anamórficas** (`proyecciones` en `recorrido.js`): cada imagen se proyecta sobre la ciudad desde el
  punto de vista donde fue tomada (`camara`, `mira`, `apertura`). Las fotos quedan siempre como textura tenue en
  las paredes. **Travelling por cercanía**: cuando el caminante pasa a menos de `radio` m (15 por defecto) del punto
  donde se tomó la foto, gira la cabeza, la cámara lo deja, recorre los puntos de vista del lugar (desde cada uno su
  imagen se recompone; entre una y otra, la ola) y vuelve a sus ojos. Los tramos no se escriben: se calculan de la
  caminata (`?tramos` los muestra en la consola). Cada lugar se dispara una vez; con `repite: [0]` también en las
  pasadas siguientes, sólo con esas vistas. No hay máximo de imágenes, pero se proyectan a la vez como mucho 6.
  Fotos tomadas desde la vereda: `camara` a la altura de los ojos (alt ≈ 1,6). Si miran al frente o hacia arriba,
  el vuelo abre el encuadre para que entren enteras (MapLibre no inclina la cámara más de 84°).
  Al llegar, cada imagen queda centrada entre el indicador de arriba y el pie del registro: la cámara mira por el eje
  de la foto y lo que se corre es el centro óptico de la pantalla (`padding` de MapLibre), sin mover el punto de vista.
  Si el cartel o la parte alta de la foto pasan por encima del volumen, corregir la altura en `calibracion.js` → `alturas`.
  **Fondo**: cada imagen tiene además un plano dentro del cono de su proyector, detrás del lugar (`ciudad.js`), que se
  enciende sólo cuando la cámara está en el punto de vista. Completa lo que cae en el cielo o donde la maqueta no tiene
  volúmenes, para que la foto se vea entera al recomponerse. Las huellas aparecen de a poco al acercarse (150 → 70 m).
- **Calibrar las proyecciones** (`/deriva-3d/calibrar.html`, con `npm run local`): se marcan pares
  "este punto de la imagen = esta esquina de la ciudad" (imagen a la izquierda, satélite con los edificios a la derecha)
  y se calcula la cámara que los explica: posición, rumbo, inclinación, giro, apertura y, opcionalmente, centro óptico
  (`camara.js`). Sobre la imagen se dibujan los contornos de la ciudad vistos desde esa cámara; donde calzan, la
  proyección calza. Después se puede retocar a mano y corregir alturas de edificios (⇧ clic en el mapa).
  **Guardar** escribe `site/deriva-3d/calibracion.js`, que tiene prioridad sobre los valores de `recorrido.js`.
  **Probar en la página** abre el recorrido con lo que todavía no se guardó (`?prueba&lugar=…`, 22 s antes del travelling de ese lugar).
  Puntos ideales: esquinas de edificios al nivel del piso, 8–12 por imagen, cerca y lejos, en varias fachadas.
- **Portada** (`site/index.html` + `site/portada/`): la panorámica del dron (`../panoramica_little_havana.tif`, tomada sobre
  Calle 8 y SW 37 Av. a 118 m, mirando al norte) proyectada sobre la ciudad 3D con la misma lógica anamórfica. La cámara
  está en `portada/portada.js`; los edificios (`portada/edificios.json`) se regeneran con `node scripts/edificios-portada.mjs`
  (baja de OSM sólo los que caen dentro del cono de la foto). El cielo cae sobre un telón curvo a 2,75 km.
- **Transiciones entre imágenes de un mismo lugar:** no son fundidos sino una "ola" que sale del lugar y se expande por
  la ciudad, cambiando una imagen por la otra grano a grano (`ola()` en `ciudad.js`, `intensidades()` en `mapa.js`).
- **Dioramas isométricos:** las vistas con `isometrica: true` (recorrido.js) usan una cámara a ~1,2 km con teleobjetivo,
  porque las imágenes de IA casi no tienen perspectiva; al ir a ese punto de vista la cámara hace un dolly zoom. En
  `calibrar.html` esas vistas abren solas con distancia máx. 1500 m y apertura mín. 0,5°.
- Para quitar el bloque de tierra de los dioramas: `.venv/bin/python scripts/recortar-tierra.py` (los polígonos de cada
  imagen están en el script; la versión con tierra queda en git).
- Para recortar el fondo liso de un diorama: `.venv/bin/python scripts/recortar-diorama.py entrada.jpg site/deriva-3d/registros/salida.webp`
- Abrir con `?editar` (p. ej. `/deriva-3d/?editar`) para marcar puntos haciendo clic en el mapa mientras suena el audio
- QR de prueba en `qrs/prueba-3d/` (wifi local y URL en línea)

## Vista en computadora (marco de celular)

La obra está pensada para el teléfono. En una computadora (mouse o trackpad y ventana apaisada), `assets/marco.js`
redirige cada página a `/marco/`, que la muestra en un iframe con forma de celular que ocupa el alto de la ventana,
con una nota y un QR de la página en el sitio publicado (también al probar en local) para abrirla en el teléfono. La barra de direcciones conserva la URL real.
Como adentro del iframe el viewport es de celular, los encuadres de la cámara y de las proyecciones son los mismos
que verá el público. Para ver una página sin el marco: `?sin-marco` (con `?editar` nunca se enmarca).
Toda página nueva tiene que cargar `assets/marco.js` en el `<head>`.

## Publicar

Sitio en línea: **https://little-havana-sonoro.pages.dev/** (Cloudflare Pages, proyecto `little-havana-sonoro`).

```bash
npm run deploy     # sube la carpeta site/ (pide iniciar sesión en Cloudflare la primera vez)
```

`functions/audio/[[path]].js` es una Pages Function que permite pedir el audio por partes (Range → 206).
Safari en iPhone lo necesita para reproducir y adelantar. Cloudflare sirve los archivos estáticos
siempre completos, así que no hay que borrarla.

Los QR definitivos ya están en `qrs/` y apuntan a esa URL.

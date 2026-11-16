# Little Havana — carga de puntos

Web app aparte del sitio de los QR (`../paisajes-sonoros/`) para que la artista cargue:

- **Edificios y fotos:** cada edificio fotografiado, con su posición en el mapa y los links de Google Drive
  de sus fotos. De cada foto, opcionalmente, **desde dónde se tomó** (es la `camara` de una proyección
  anamórfica; el edificio es la `mira`).
- **Momentos del audio:** mientras escucha un audio, marca el instante en que se oye algo reconocible, dónde
  estaba, qué se oye, el edificio asociado y, si hubo pausa, hasta cuándo. Es el formato de
  `RECORRIDO.puntos` en `paisajes-sonoros/site/deriva-3d/recorrido.js`.

Lo más importante que se le pide: **para cada edificio con fotos, el momento del audio en que se lo oye o se
pasa frente a él.** La lista de edificios marca con «sin momento» los que todavía no lo tienen.

En el mapa se dibuja el camino que resulta de los momentos ubicados y un punto (el caminante) que lo recorre
con el audio, interpolando igual que la deriva 3D (línea recta, velocidad constante, quieto en las pausas).
Así se ve enseguida si un momento quedó mal ubicado.

En línea: **https://little-havana-carga.pages.dev/** (Cloudflare Pages, proyecto `little-havana-carga`).
Link para la artista: `https://little-havana-carga.pages.dev/?clave=LA_CLAVE` (la clave queda guardada en su
navegador y se borra de la barra de direcciones).

## Estructura

```
site/                  ← lo que se publica (sin build)
  index.html, app.css
  app.js               ← toda la lógica: mapa (MapLibre + satélite Esri), reproductor, listas, guardado
  config.js            ← audios disponibles, tipos de foto y lugares iniciales (editar aquí)
  picos/*.json         ← forma de onda de cada audio (generada)
functions/api/datos.js ← GET/PUT de los datos en el KV "CARGA", con clave y número de versión
scripts/
  picos.mjs            ← ../paisajes-sonoros/site/audio/*.m4a → site/picos/*.json (necesita ffmpeg)
  traer.mjs            ← baja los datos, las fotos de Drive y arma un borrador para recorrido.js
datos/                 ← lo que escribe traer.mjs (se versiona en git)
```

Los audios no se copian: se reproducen desde `https://little-havana-sonoro.pages.dev/audio/`, que ya responde
peticiones Range (206). Si se agrega un audio al sitio, sumarlo en `config.js` → `audios` y correr `npm run picos`.

## Uso

```bash
npm install
npm run local        # http://localhost:8788/?clave=prueba (KV simulado en .wrangler/, clave en .dev.vars)
npm run picos        # tras cambiar o agregar audios en paisajes-sonoros
CARGA_CLAVE=… npm run traer               # datos/carga.json + datos/sugerencia-recorrido.js
CARGA_CLAVE=… npm run traer -- --fotos    # además baja las fotos a ../fachadas/drive/<edificio>/
npm run traer -- --url http://localhost:8788 --clave prueba   # contra el servidor local
```

`datos/sugerencia-recorrido.js` tiene, comentados y con el formato de `recorrido.js`, los `puntos` de cada audio
y un esqueleto de `proyecciones` por edificio con fotos (tramo alrededor del primer momento en la deriva,
`camara` = desde dónde se tomó la foto a 1,6 m, `mira` = el edificio). **No modifica `recorrido.js`**: se copia
a mano lo que sirva y las cámaras se calibran después en `calibrar.html`.

Las fotos se bajan sólo si están compartidas como «Cualquier persona con el enlace». Las carpetas de Drive no
se pueden bajar sin la API de Google: el script las avisa y la app le pide a la artista links de archivos.

## Datos

Un solo documento JSON en el KV, con número de versión:

```js
{ version, guardado, datos: {
  lugares: [{ id, nombre, direccion, nota, lat, lng,
              fotos: [{ id, url, tipo, nota, desde: { lat, lng } | null }] }],
  marcas:  [{ id, audio, t, hasta | null, lat | null, lng | null, lugar: id | null, oye, aprox }] } }
```

`t` y `hasta` en segundos con décimas; `audio` es el nombre del archivo sin extensión (`deriva_calle_8`).

- La app guarda sola unos segundos después de cada cambio. El PUT lleva la versión sobre la que se trabajó;
  si otra pestaña guardó antes responde 409 y la app pregunta qué conservar (lo otro se descarga en un archivo).
- Cada cambio queda también en `localStorage`: sin conexión se sigue trabajando y se sube cuando vuelve.
- El primer guardado de cada hora conserva el estado anterior en `copia:AAAA-MM-DDTHH` (90 días).
  Para recuperar una: `npx wrangler kv key list --binding CARGA --remote` y
  `npx wrangler kv key get "copia:…" --binding CARGA --remote`.
- El plan gratuito de KV admite 1000 escrituras por día; agrupando los cambios alcanza de sobra.
- «Descargar copia» (arriba a la derecha) baja todo en un JSON.

## Publicar (primera vez)

```bash
npx wrangler kv namespace create CARGA              # copiar el id en wrangler.toml
npx wrangler pages project create little-havana-carga --production-branch=main
npx wrangler pages secret put CLAVE --project-name=little-havana-carga
npm run deploy
```

Después, sólo `npm run deploy`. Si es la primera vez que se abre la app, arranca con los cuatro lugares que ya
usa `recorrido.js` (`config.js` → `semilla`), sin fotos.

---
name: sesiones-concurrentes
description: Varias sesiones de Claude trabajan a la vez en el repo; commitear sólo lo propio y deployar desde una copia limpia del commit
metadata:
  node_type: memory
  type: feedback
  originSessionId: febd54cd-fd88-4ce5-9d2f-aa3b21e41770
  modified: 2026-11-17T17:38:07.910Z
---

Suele haber otra sesión de Claude trabajando al mismo tiempo en el repo (por ejemplo, editando `mapa.js`, `mapa.css`, `index.html` o `ciudad.js` de la deriva 3D). La usuaria pidió hacer commit y deploy "sin molestar el trabajo de otra de ustedes".

**Why:** si se commitean todos los cambios en disco, se mete el trabajo a medias de otra sesión. Y `npm run deploy` publica la carpeta de trabajo tal cual está, así que también publicaría ese trabajo sin terminar.

**How to apply:**
- Antes de commitear, mirar `git diff` y separar los hunks propios de los ajenos. Si comparten archivo, armar la versión "HEAD + sólo lo mío" en el scratchpad y cargarla con `git update-index --cacheinfo 100644,$(git hash-object -w archivo),ruta` (así no se tocan los archivos en disco).
- Deploy desde una copia limpia: `git archive HEAD paisajes-sonoros | tar -x -C <scratch>`, copiar `site/audio/` (está fuera de git) y correr `wrangler pages deploy site --project-name=little-havana-sonoro --branch=main` desde esa copia.
- Antes del deploy, verificar que la copia sea igual al commit, y después, que el sitio en vivo coincida (con `curl -L`, porque `/index.html` redirige).

Relacionado: [[panoramica-deriva]].
- **calibracion.js (27/11):** una página de calibrar.html o encajar.html abierta desde antes pisaba al guardar lo que se cambió después (además, el borrador de localStorage era una copia completa). Desde entonces las páginas mandan su `base` y `servidor-local.mjs` sólo aplica lo que cambió respecto de ella. Si una calibración "vuelve sola", revisar si el servidor de la usuaria (puerto 8080) se reinició después de ese cambio.

27/11 17:16: la esquina de Cubaocho se volvió a pisar (cámara a 4,13 m) aunque el servidor ya tenía la fusión: el guardado vino de una pestaña de calibrar/encajar con el código viejo, que no manda `base`. Desde entonces servidor-local.mjs rechaza con 409 los guardados sin `base` ("recargá la página"). Si la esquina vuelve a 4,13 m, buscar quién guardó, no recalibrar.

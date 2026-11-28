---
name: tower-cierre
description: El Tower Theater cierra la deriva con la foto del dron como última vista; la foto de la artista va primera; en las fotos nunca la foto 2D plana y techos/vereda coincidentes
metadata:
  type: project
---

Pedido de la usuaria (17/11/2026): el Tower Theater es "el edificio mejor retratado". No aparece en el audio, pero tiene que mostrarse antes de terminar el recorrido, y **la última foto anamórfica en apreciarse tiene que ser la del dron** (`registros/tower-theatre-dron-00.webp`).

Hecho y publicado (commit 44e53d1): en `recorrido.js`, las vistas del Tower quedaron en este orden: diorama de día, cenital, diorama de noche y dron. El dron lleva `huella: true` porque la huella por defecto es la primera vista.

**Foto de la artista (17/11, commit 116d8d6):** `_DSC1208.jpg` llegó por Descargas: Drive la tenía privada y el conector no puede bajar una imagen de 3 MB. Quedó como `registros/tower-theater-foto-00.webp` y es la primera vista del Tower, calibrada con 6 pares imagen ↔ modelo del teatro. El orden es: foto, diorama de día, cenital, diorama de noche, dron.

Pedidos de la artista sobre las fotos (no los dioramas): nunca tiene que verse la foto 2D plana; la reconstrucción es sólo la ilusión anamórfica. Por eso el fondo plano de `ciudad.js` quedó sólo para las vistas `isometrica`. Además, la vereda y el techo de cada foto tienen que coincidir con el volumen: se ajusta con la cámara y con `calibracion.js` → alturas, midiendo el borde de la fachada en la foto.

**Why:** el dron abre la deriva (panorámica) y la foto aérea del Tower la cierra, así el final rima con el principio.

**How to apply:** si se agregan vistas al Tower, el dron siempre queda última. Ver [[panoramica-deriva]] y [[sesiones-concurrentes]].

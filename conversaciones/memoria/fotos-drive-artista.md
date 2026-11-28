---
name: fotos-drive-artista
description: "En los nombres de las fotos de Drive de la artista, los números son correlativos del iPhone, no direcciones; las fotos no traen GPS"
metadata:
  node_type: memory
  type: project
  originSessionId: d8965c24-e5a3-48b4-840f-538c93e04cc5
  modified: 2026-11-19T14:33:20.991Z
---

La carpeta de Drive de Viviana (1I1Zkn5SkqdmLb5SB--GnA8tbVLMPobVU) tiene fotos con nombres como «El exquisito Cafeteria _1505». Iris dijo que los nombres traen la dirección, pero el 1505 es el correlativo de la cámara (IMG_1505): el EXIF lo confirma por la hora, y tampoco hay GPS.

Al 19/11/2026 se cargaron en la versión 272 del KV (commit 25ad7d4). Los lugares se ubicaron por el nombre del negocio, por los números de calle que se ven en las fotos y por los frentes de `edificios.json`.

**Why:** si se ubica por esos números, los lugares quedan en otra cuadra.

**How to apply:** ante fotos nuevas de esa carpeta, mirar el EXIF y la imagen. Comparar contra la carga por el id de Drive y por el md5 de `fachadas/drive/`. Las sin nombre quedan en `fachadas/drive/sin-nombre-carpeta-19-11/`. Ver [[sesiones-concurrentes]].

---
name: paredes-video
description: Prueba (19/11/2026) de frames del video de la caminata como collage en las fachadas de la deriva 3D; cómo revertirla
metadata:
  node_type: memory
  type: project
  originSessionId: 2238a79b-22c9-4ad4-ba46-455a94961fc7
  modified: 2026-11-20T00:29:51.268Z
---

Prueba de collage: frames de ~/Downloads/recorrido_calle_8.MOV (16/11, mismo recorrido y sentido que el audio del 11/11) pegados en las fachadas de la Calle 8, debajo de las fotos de los puntos. Lo genera scripts/paredes-video.py → site/deriva-3d/video/paredes.webp + paredes-video.js; ciudad.js (videoPared, atributo aV) y mapa.js (opción `paredes`, `?sinvideo`).

**Why:** la artista pidió poder revertir fácil si la idea no funciona. El estado anterior completo (incluidos los cambios sin commitear) está en `refs/respaldos/antes-texturas-video`.

**How to apply:** para revertir, comparar con `git diff refs/respaldos/antes-texturas-video -- <archivo>` y deshacer sólo esas partes; no hacer checkout entero si otra sesión tocó los mismos archivos ([[sesiones-concurrentes]]). La artista confirmó que, tanto en el audio como en el video, camina por la vereda norte hasta la esquina de la 17 Av. y cruza la Calle 8 (no la 17) hacia el PNC Bank, en la esquina sureste. Modo video (19/11): `--pelicula` arma video/deriva.mp4 (12 fps, tiempo del audio, frame según la posición del caminante); tecla V o botón «video»; panel en la pared de la propia vereda, 9 m adelante. Usa la textura 16 de 16: no queda lugar para más. Franja continua (21/11): `--tira` arma video/tira.webp, un barrido slit-scan (rendija 78% del ancho) estirado del piso al techo; es lo que se ve por defecto, y `?collage` vuelve a los frames sueltos apilados.

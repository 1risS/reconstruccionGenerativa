---
name: capturas-deriva
description: "cómo verificar transiciones de la deriva 3D con capturas automáticas (Playwright + Chrome, audio pausado y currentTime)"
metadata:
  node_type: memory
  type: reference
  originSessionId: e398f956-14a9-4cfc-94da-27f1fd6eb8d1
  modified: 2026-11-27T13:26:33.896Z
---

Para ver una transición de la deriva cuadro a cuadro sin el teléfono: Playwright de
`/Users/iriss/.npm/_npx/c61c9351a0dbcfa7/node_modules/playwright/index.mjs` con
`executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'`, args `--use-angle=metal --enable-gpu`,
viewport 413×790. Abrir `/deriva-3d/?sinvideo&t=<seg>`, clic en `#comenzar`, **esperar ~22 s** (si no, la partida desde la
panorámica se mezcla con lo que se quiere ver), `window.__audio.pause()` y después fijar `__audio.currentTime` y sacar
captura. `window.__camPos`, `window.__mapa` (getBearing/getPitch/transform.fov) y `window.__ciudad.ranuras()` sirven para
medir saltos de cámara y qué imágenes están en el shader. Hoja de contactos: `ffmpeg -pattern_type glob -i '*.png' -vf tile=…`.
Levantar un servidor propio con `PORT=… npm run local` (el 8765 suele ser de otra sesión y a veces no responde).
Ver [[sesiones-concurrentes]].

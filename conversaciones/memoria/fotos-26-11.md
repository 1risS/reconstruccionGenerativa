---
name: fotos-26-11
description: "Fotos sumadas a la deriva 3D el 26/11/2026 (arbolito al inicio, El Cristo en capas, Domino Park dentro del Tower, 1652) y por qué se resolvieron así"
metadata:
  node_type: memory
  type: project
  originSessionId: e3a5050d-f5ed-46c9-9a0f-9fff6866e4d3
  modified: 2026-11-26T17:00:09.775Z
---

Pedido del 26/11/2026 (sin commit ni deploy todavía):

- **Arbolito (inicio):** la galería encontraba pobre el principio del recorrido. La partida ahora baja al punto de vista de la foto (`arranque: true`, `ARRANQUE` en mapa.js); la foto se recompone a pantalla llena y la cámara avanza por la vereda hasta el caminante. Lleva `sinHuella`: como mira a lo largo de la vereda, después quedaba estirada sobre toda la fachada. Su mira está a 150 m: si no, al avanzar la cámara pasaba por encima y se daba vuelta.
- **El Cristo:** tres fotos, de la más chica a la más grande, todas como huella superpuesta con la más chica encima (pedido explícito). Las cámaras de las dos nuevas se ajustaron a dónde deja cada detalle la foto del edificio con su calibración a mano (apertura 88°, de encajar.html), no a la escena real: así calzan las capas. Top Cigars se hizo igual (foto nueva de cerca encima de la de noche).
- **Domino Park:** el recorrido no pasa por ahí. Va dentro del cierre del Tower, antes del dron (que sigue siendo la última foto; ver [[tower-cierre]]), con `lugar: 'Domino Park'` por vista. Costo: el epílogo después del audio pasó de ~30 a ~55 s.
- **Cuban Diner:** ya estaba en el mapa (la misma foto, travelling a las 9:16 en la vuelta).
- **1652 SW 8 St:** en la app de carga, 1652 es la dirección de Tumba'o.

**Why:** son decisiones de puesta en escena que no se deducen del código. **How to apply:** si la artista pide más fotos de un lugar ya cargado, revisar si alguna vista tiene calibración a mano en calibracion.js antes de calcular cámaras nuevas. Ver [[sesiones-concurrentes]].

- **Cubaocho (misma tarde):** tres vistas: frontal → detalle de la entrada → esquina desde la 15 Av. El detalle se ajustó con la foto frontal calibrada, igual que El Cristo. La esquina se estimó por el punto de fuga y quedó bien en encajar.html, pero falta calibrarla. `contempla`/`traslado` por lugar (nuevos) achican las pausas: Guantanamera termina antes de que el caminante pase Cuba 8, y Cubaocho llena el hueco hasta Ball & Chain sin demorarlo. `conCaminante` deja la huella de Cuba 8 visible desde los ojos del caminante. Los originales de Drive ya estaban en `fachadas/drive/cubaocho/` con otro nombre: comparar por tamaño antes de bajar.

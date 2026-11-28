---
name: panoramica-deriva
description: "La panorámica del dron enmarca la deriva 3D al principio y al final (decisiones de la usuaria, nov. 2026)"
metadata:
  node_type: memory
  type: project
  originSessionId: febd54cd-fd88-4ce5-9d2f-aa3b21e41770
  modified: 2026-11-17T18:17:26.681Z
---

Pedidos de la usuaria entre el 16 y el 17/11/2026, ya implementados, commiteados y publicados:

1. **Inicio de la deriva 3D:** la vista aérea detrás de "Comenzar" se reemplazó por la panorámica del dron, proyectada anamórficamente desde su punto de vista. En un celular vertical se ve una franja de la foto con un paneo lento; al girar el celular, la foto entra casi entera (aprovecha su relación de aspecto). Respuesta de la usuaria: "quedó divina".
2. **Final del recorrido:** al terminar el audio, la cámara vuelve a la vista de la panorámica antes de volver a empezar. Hace un vuelo de vuelta al dron, la panorámica queda con su paneo y "volver a empezar" baja de nuevo a la vereda.

3. **Transición foto fija → 3D (17/11):** a la usuaria le pareció fea la mezcla de la foto con el mapa mientras el volumen aparecía y la cámara ya se movía. Pidió una "transición limpia". Se resolvió así: la foto fija se ubica con una homografía exacta (`homografia()` en `portada/panoramica.js`), la cámara queda quieta durante el fundido y el paneo arranca después, desde velocidad cero. Regla: nunca mover la cámara mientras la foto fija y el 3D se están fundiendo.

4. **Partida (17/11):** al comenzar, la usuaria quiere ver la imagen descomponerse como textura del mapa 3D cuando la cámara se aparta del punto de vista. Por eso la partida es un travelling propio (`iniciarPartida`/`camaraPartida` en `mapa.js`): la imagen se mantiene entera mientras la cámara se corre mirando la zona de la foto, y se apaga recién cuando gira hacia el caminante. El telón (el cielo) se apaga antes con `setTelon`, porque de lejos se ve como un panel suelto en el aire.

5. **Fantasma → Maqueta (18/11):** al cargar, la ciudad está en estilo Fantasma (sólo la luz de la foto). Pasa a Maqueta recién cuando la cámara de la partida ya bajó y se ven de cerca los techos de Little Havana: 66–80 % del travelling (`MAQUETA_PARTIDA` en `mapa.js`). Un primer intento al 42–66 % le pareció temprano: aunque Little Havana ya esté en cuadro a lo lejos, tiene que seguir en Fantasma. Al final hace lo inverso durante la vuelta al dron (`FANTASMA_VUELTA`). Se sacó el selector de estilos. La UI está oculta hasta que el caminante llega a la vereda y otra vez al final, donde sólo quedan «fin del recorrido» y el botón. La tecla H la oculta o la vuelve a mostrar.

6. **Fantasma en los travellings (18/11):** cuando la cámara llega a un punto de vista anamórfico y mientras se miran las fotos, la ciudad es Fantasma. Vuelve a Maqueta cuando la cámara regresa al caminante. Al final, el paso a Fantasma tiene que ocurrir apenas la cámara empieza a subir: a la usuaria le pareció tarde ver Little Havana en maqueta desde arriba.

**Dato no obvio:** la usuaria no sabía desde dónde se tomó la foto. Sale del XMP de DJI: Calle 8 y SW 37 Av., a 118 m de altura, mirando al norte. Queda 3,5 km al oeste del recorrido, así que la foto no muestra la zona de la deriva y hace falta una segunda ciudad (`portada/edificios.json`). Esa ciudad se libera al comenzar y se vuelve a armar al final, para cuidar la memoria del iPhone.

**Why:** la panorámica funciona como un marco de la obra: abre y cierra la deriva.

**How to apply:** si se toca el inicio o el final de la deriva, mantener ese marco. Falta probarlo en un iPhone real con Safari (memoria con dos ciudades cargadas a la vez).

Ver también [[sesiones-concurrentes]] y [[usuaria]].

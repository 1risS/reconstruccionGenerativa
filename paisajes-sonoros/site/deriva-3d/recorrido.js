// ─────────────────────────────────────────────────────────────
// Recorrido de la deriva por Calle 8, sincronizado con el audio.
// Para ajustar el recorrido y los registros, editar SOLO este archivo.
//
// PUNTOS (por dónde camina)
//  t      → momento del audio en que se llega a ese punto ("m:ss" o segundos, admite decimales "2:05.5")
//  hasta  → (opcional) si se queda quieto en ese punto: momento en que retoma la marcha.
//           Esos tramos se muestran como "pausa · escucha · registro".
//  lat/lng→ coordenadas (se pueden copiar de Google Maps: clic derecho → primer renglón)
//  nota   → (opcional) texto que aparece en pantalla mientras se está en ese punto
//  Entre dos puntos la marcha es en línea recta y a velocidad constante:
//  para seguir una curva o cruzar la calle, agregar puntos intermedios.
//
// MIRADAS (hacia dónde mira y qué registro aparece en la pared)
//  desde/hasta → tramo del audio en que la mirada se dirige a esa pared
//  lat/lng     → punto de la fachada donde se "proyecta" el registro
//  rumbo       → hacia dónde mira la fachada: 0 = norte, 90 = este, 180 = sur, 270 = oeste
//  ancho/alto/base → tamaño del cuadro y altura desde el piso, en metros
//  imagenes    → se alternan durante la mirada. Vacío = cuadro "material pendiente".
//  tipo        → texto del pie (fotografía, dron, celular, IA…)
//
// PROYECCIONES (imágenes que se proyectan sobre la ciudad 3D como un video-mapping anamórfico)
//  Cada imagen se proyecta desde el punto de vista donde fue tomada (la "camara"): desde ahí la
//  imagen se recompone entera sobre los volúmenes; desde la vereda se ve fragmentada en las paredes.
//  Las fotos están siempre pegadas como textura (tenue, la "huella") en las paredes. TRAVELLING POR CERCANÍA:
//  cuando el caminante pasa a menos de `radio` metros del punto donde se tomó la foto, gira la cabeza
//  hacia el lugar, la cámara lo deja, recorre los puntos de vista (ahí cada imagen se recompone) y vuelve
//  a sus ojos. No hay tiempos que poner a mano: salen de la caminata (puntos de arriba). Ida y vuelta
//  duran 5–8 s cada una; cada vista, 6 s quieta + 6 s de viaje a la siguiente. Si dos lugares se pisan,
//  el segundo espera. Para ver los tramos calculados: abrir la página con ?tramos (tabla en la consola).
//  radio       → (opcional) metros alrededor del punto que disparan el travelling (por defecto 15)
//  punto       → (opcional) { lat, lng } que dispara el travelling; por defecto, la cámara de la vista huella
//  repite      → (opcional) se dispara también en las pasadas siguientes, sólo con esas vistas: [0, 2]
//                (posiciones en la lista de vistas del lugar, desde 0). Sin repite, una sola vez.
//  vistas      → una o más imágenes del lugar, en orden; la cámara viaja de una a otra y se ven DE A UNA
//                (cada imagen sólo se recompone desde su propio punto de vista; entre una y otra, una "ola" sale
//                del lugar y se expande por la ciudad reemplazando una imagen por la otra).
//    imagen    → archivo en registros/ (PNG o WebP con fondo transparente = sólo se proyecta la figura)
//    camara    → posición del dron/fotógrafo: lat, lng y alt (metros sobre el piso)
//    mira      → punto al que apunta el centro de la imagen (lat, lng, alt)
//    apertura  → ángulo horizontal de la imagen, en grados (más chico = la imagen cubre menos ciudad)
//    tipo      → qué es esta imagen (fotografía, fotografía aérea, diorama generado por IA…). El pie
//                muestra el de la vista que se está viendo; si una vista no lo tiene, usa el tipo del lugar.
//    huella    → (opcional) true en la vista que queda proyectada (tenue) fuera del tramo; si ninguna lo
//                tiene, la huella es la primera. Hay una sola huella por lugar, para que no se superpongan.
//    isometrica→ (opcional) true en los dioramas de IA, que casi no tienen perspectiva. La cámara se aleja a ~1,2 km
//                por el mismo eje con un teleobjetivo (camara/mira/apertura se dan como si fuera una cámara cercana;
//                lo calibrado en calibrar.html ya queda lejos). Al ir a ese punto de vista, la cámara hace un dolly
//                zoom: se aleja mientras cierra el campo de visión y la ciudad se aplana hasta volverse maqueta.
//  No hay máximo de imágenes: se proyectan a la vez sólo las que se están viendo (hasta 6 simultáneas).
//
// Abrí la página con ?editar al final de la URL para marcar puntos sobre el mapa
// mientras escuchás (clic en el mapa = punto en el momento actual del audio).
//
// PUNTOS: salen de los momentos que marcó la artista en la herramienta de carga (carga-puntos/, versión 270
//   del 17/11/2026; `npm run traer` allí). Ella marcó los momentos sobre los EDIFICIOS que se oyen; acá cada
//   uno se pasó a la vereda por donde caminó, sobre la línea a 8,5 m del eje de la Calle 8 (las fachadas de
//   edificios.json quedan a 10–12 m del eje), con la misma longitud que el edificio. Ida por la vereda norte
//   (desde Pajaritos, 1421 SW 8 St, hacia el oeste) y vuelta por la sur. Entre puntos va a velocidad
//   constante, así que el caminante avanza al ritmo de la grabación (≈ 0,5–1 m/s). Criterios propios:
//   · 4:34–4:46 pausa en el semáforo de la 16 Av. (ella marcó el semáforo a las 4:46.8).
//   · Los Montaditos (6:09) se OYE desde lejos: está a 80 m de Mr. Cigars (5:53), imposible de caminar en 16 s.
//     Se deja como nota sin mover el recorrido.
//   · Cruce a la vereda sur enfrente de Tumba'o (7:21), a mitad de cuadra: es lo que mantiene el mismo
//     ritmo; cruzar en la 17 Av. pediría 2,5 m/s.
//   · La Colada Gourmet y la moto no tienen ubicación: son notas en el lugar interpolado.
//   · 0:00 → 0:46.7 da 1,9 m/s (paso rápido): habría que confirmar con ella dónde empieza el audio.
// ─────────────────────────────────────────────────────────────

window.RECORRIDO = {
  audio: '../audio/deriva_calle_8.m4a',

  puntos: [
    // ── ida, vereda norte (hacia el oeste) ──
    { t: '0:00',                      lat: 25.7658353, lng: -80.2182399, nota: 'Pajaritos · inicio' },
    { t: '0:46.7',                    lat: 25.765808,  lng: -80.2191451, nota: 'Guantanamera' },
    { t: '1:57.7',                    lat: 25.7657893, lng: -80.219765,  nota: 'Ball & Chain' },
    { t: '3:58.2',                    lat: 25.7657697, lng: -80.220411,  nota: 'El Cristo Restaurant' },
    { t: '4:29.5',                    lat: 25.7657638, lng: -80.220608,  nota: 'Top Cigars · Skinny Louie' },
    { t: '4:34.5', hasta: '4:46.8',   lat: 25.7657627, lng: -80.220643,  nota: 'Semáforo · Calle 8 y 16 Av.' },
    { t: '5:38.4',                    lat: 25.7657477, lng: -80.2211411, nota: 'Pasa un bus' },
    { t: '5:53.1',                    lat: 25.7657443, lng: -80.2212543, nota: 'Mr. Cigars' },
    { t: '6:09.3',                    lat: 25.7657404, lng: -80.2213823, nota: 'Se oye Los Montaditos Bar' },
    { t: '6:59.6',                    lat: 25.7657284, lng: -80.2217797, nota: 'Cruce a la vereda sur' },
    // ── vuelta, vereda sur (hacia el este) ──
    { t: '7:21.0',                    lat: 25.7655757, lng: -80.2217797, nota: "Tumba'o" },
    { t: '7:58.0',                    lat: 25.765584,  lng: -80.2215059, nota: "Sala'o" },
    { t: '9:27.2',                    lat: 25.7656026, lng: -80.2208879, nota: 'Ciao Havana' },
    { t: '9:51.2',                    lat: 25.7656092, lng: -80.2206715, nota: "Alfaro's" },
    { t: '10:02.7',                   lat: 25.7656115, lng: -80.2205937, nota: 'El Pub · Calle 8 y 16 Av.' },
    { t: '10:33.2',                   lat: 25.7656185, lng: -80.2203621 },
    { t: '11:25.3',                   lat: 25.7656261, lng: -80.2201121, nota: 'La Colada Gourmet' },
    { t: '12:08.1',                   lat: 25.7656323, lng: -80.2199068, nota: 'Pasa una moto' },
    { t: '12:23.9',                   lat: 25.7656346, lng: -80.219831,  nota: 'El Exquisito' }
  ],

  // Los tres cuadros "material pendiente" que había estaban atados al recorrido provisorio (pausas inventadas
  // en 14, 16 y 17 Av.); se sacaron. El formato está arriba, en MIRADAS.
  miradas: [],

  proyecciones: [
    {
      // drone/tower_theatre_00.jpeg — captura aérea desde la esquina de Calle 8 y 15 Av, mirando al suroeste.
      // Cámara calculada a partir de esquinas del teatro y del cruce peatonal (ver calibracion.js, se puede
      // retocar en calibrar.html). El volumen del teatro en edificios.json se midió sobre esta misma foto.
      // Después del dron, la cámara sigue subiendo: diorama de día, la foto cenital sobre el techo y diorama de noche.
      // Las cámaras de los dioramas están calibradas en calibracion.js con las esquinas del teatro (techo y base):
      // dan casi ortográficas (apertura ≈ 3,4°), con ~22 px de error por las proporciones inventadas por la IA.
      // El teatro está en la vereda sur. La artista no marcó cuándo se oye. Va al final, en la vuelta: se dispara
      // por la vereda sur con el teatro ya a la vista, calle abajo (~11:07, a ~70 m), para que sus 4 vistas
      // terminen antes del audio (al terminar, la cámara sube a la vista general y corta lo que esté en curso);
      // después viene Cuban Cigars, que cierra. A la ida (cruce de 15 Av., ~1:00) no se dispara: ahí se
      // superponía con Guantanamera y Ball & Chain, que ella sí marcó, y los corría 15 s.
      lugar: 'Tower Theater', punto: { lat: 25.7656245, lng: -80.2201663 }, radio: 4,
      vistas: [
        { imagen: 'registros/tower-theatre-dron-00.webp', tipo: 'fotografía aérea', apertura: 73.7, rumbo: -137.2, cabeceo: 22.2, giro: -0.1,
          camara: { lat: 25.7657892, lng: -80.2194265, alt: 19.5 }, mira: { lat: 25.7655532, lng: -80.2196669, alt: 5 } },
        { imagen: 'registros/tower-theater-diorama-00.webp', tipo: 'diorama generado por IA', isometrica: true, apertura: 42,
          camara: { lat: 25.765945, lng: -80.219124, alt: 60 }, mira: { lat: 25.76546, lng: -80.21966, alt: 4 } },
        // cenital/tower_hotel_00.jpf — dron a 54,9 m justo encima del teatro, cámara a −90° (datos del XMP de DJI).
        // Rumbo −97,8° = el borde de arriba de la foto mira al oeste (Calle 8 queda a la derecha). Cabeceo 89 y no 90
        // (a 90 el rumbo queda indefinido); la mira está 1 m al oeste del nadir, en la dirección del eje óptico.
        { imagen: 'registros/tower-theatre-cenital-00.webp', tipo: 'fotografía aérea cenital', apertura: 73.7,
          rumbo: -97.8, cabeceo: 89, giro: 0,
          camara: { lat: 25.7654547, lng: -80.2197256, alt: 54.9 }, mira: { lat: 25.7654535, lng: -80.2197355, alt: 0 } },
        { imagen: 'registros/tower-theater-diorama-02.webp', tipo: 'diorama generado por IA', isometrica: true, apertura: 40,
          camara: { lat: 25.76546, lng: -80.218962, alt: 72 }, mira: { lat: 25.76546, lng: -80.21966, alt: 4 } }
      ]
    },
    {
      // fachadas/ball_and_chain_00.jpeg — foto de la artista desde la vereda sur, a la altura de los ojos
      // (teleobjetivo, sin EXIF). Fachada en edificios.json: lat ≈ 25.765815, a ~22 m de la cámara.
      // Escala por las personas en la puerta (≈ 8 m de ancho en la pared); las cabezas quedan apenas
      // debajo del centro → la cámara mira casi horizontal, un poco hacia arriba.
      // La artista marcó que se oye a las 1:57.7, a la ida, desde la vereda norte (justo enfrente de la puerta):
      // `punto` es la posición del caminante en ese momento y el radio chico hace que se dispare ahí (~1:53;
      // si Tower Theater todavía está en el aire, espera a que vuelva).
      // Primero los dos dioramas de IA (fachadas/25.765975736679938, -80.21976477493762_00/_01.jpg, vistas
      // frontales desde lo alto de la vereda sur), uno por vez; al final la cámara baja a la altura de los
      // ojos y se recompone la foto de la artista, que queda como huella. ⚠ Cámaras de los dioramas estimadas.
      lugar: 'Ball & Chain', punto: { lat: 25.7657893, lng: -80.219765 }, radio: 4,
      vistas: [
        { imagen: 'registros/ball-and-chain-fachada-00.webp', tipo: 'diorama generado por IA', isometrica: true, apertura: 46,
          camara: { lat: 25.76512, lng: -80.219765, alt: 22 }, mira: { lat: 25.765976, lng: -80.219765, alt: 5 } },
        { imagen: 'registros/ball-and-chain-fachada-01.webp', tipo: 'diorama generado por IA', isometrica: true, apertura: 44,
          camara: { lat: 25.765076, lng: -80.219765, alt: 38 }, mira: { lat: 25.765976, lng: -80.219765, alt: 5 } },
        { imagen: 'registros/ball-and-chain-foto-00.webp', tipo: 'fotografía', apertura: 21, huella: true,
          camara: { lat: 25.76562, lng: -80.219765, alt: 1.6 }, mira: { lat: 25.765815, lng: -80.219765, alt: 2 } }
      ]
    },
    {
      // fachadas/25.766093230951114, -80.22060821726569.jpeg — Top Cigars y Skinny Louie (1551 SW 8 St),
      // foto de la artista desde la vereda sur. La longitud del nombre coincide con el centro de la foto.
      // Fachada en edificios.json: lat ≈ 25.765782 (polígono de Kung Fu Chicken + Top Cigars + Skinny Louie).
      // Por las personas: ≈ 15,6 m de ancho en la pared y las cabezas bien debajo del centro → cámara
      // a 1,6 m inclinada ~8° hacia arriba (el centro de la foto cae a ~4,3 m en la pared).
      // La artista marcó que se oye a las 4:29.5, a la ida (vereda norte, frente a la puerta): se dispara ahí.
      lugar: 'Top Cigars · Skinny Louie', tipo: 'fotografía', punto: { lat: 25.7657638, lng: -80.220608 }, radio: 4,
      vistas: [
        { imagen: 'registros/top-cigars-foto-00.webp', apertura: 43,
          camara: { lat: 25.765605, lng: -80.220608, alt: 1.6 }, mira: { lat: 25.765782, lng: -80.220608, alt: 4.3 } }
      ]
    },
    {
      // fachadas/25.7655590444568, -80.22000060276768.jpeg — Cuban Cigars Corp (1520 SW 8 St), vereda sur.
      // Foto de la artista desde la misma vereda, de cerca y frontal (fachada mirando al norte).
      // Fachada en edificios.json: lat ≈ 25.765604 (la coordenada del nombre cae 5 m adentro del local).
      // Escala por la puerta "1520" (≈ 7 m de ancho en la pared) → cámara a ~6 m, apertura ~62°;
      // verticales paralelas → mira casi horizontal (el centro de la foto cae a ~2 m de altura).
      // La artista no marcó cuándo se oye. Se descubre a la VUELTA, por la misma vereda sur: el caminante pasa
      // a ~3 m del punto de la foto hacia las 11:28 (radio 10 para que no se dispare a la ida, desde la
      // vereda norte, que queda a ~14 m). Como en ese momento la cámara está en el Tower Theater, espera a
      // que vuelva y cierra el recorrido justo antes del final del audio.
      lugar: 'Cuban Cigars Corp', tipo: 'fotografía', radio: 10,
      vistas: [
        { imagen: 'registros/cuban-cigars-foto-00.webp', apertura: 62,
          camara: { lat: 25.765658, lng: -80.220001, alt: 1.6 }, mira: { lat: 25.765604, lng: -80.220001, alt: 2 } }
      ]
    },
    // ── Fotos que la artista subió a Google Drive (carga-puntos/; originales en ../fachadas/drive/) ──
    // Las tres se disparan en el momento en que ella marcó que se oyen (`punto` = posición del caminante en
    // ese momento, radio 4). Sin GPS en el EXIF: las cámaras salen de mirar la foto y de la focal equivalente
    // en 35 mm (apertura horizontal). Las fachadas son las de edificios.json en la vereda norte.
    // ⚠ Cámaras estimadas, sin calibrar: pasarlas por calibrar.html.
    {
      // fachadas/drive/guantanamera/00-IMG_1711.jpeg — iPhone, 24 mm eq. (≈ 72° en 4:3). Tomada de frente y de
      // cerca, desde la vereda norte, mirando la entrada (galería con el arco, el candelabro y la estatua).
      // Fachada a lat ≈ 25.765829; cámara ~4 m al sur, a la altura de los ojos, horizontal.
      // Marcada a las 0:46.7.
      lugar: 'Guantanamera', tipo: 'fotografía', punto: { lat: 25.765808, lng: -80.2191451 }, radio: 4,
      vistas: [
        { imagen: 'registros/guantanamera-foto-00.webp', apertura: 72,
          camara: { lat: 25.765793, lng: -80.2191451, alt: 1.5 }, mira: { lat: 25.765829, lng: -80.2191451, alt: 1.6 } }
      ]
    },
    {
      // fachadas/drive/el-cristo-restaurant/00-_DSC0245.ARW — Sony, 29 mm (≈ 64° en 3:2). Frontal desde el
      // borde de la vereda sur, con los carriles en primer plano; horizontales paralelas → cámara horizontal.
      // Fachada a lat ≈ 25.765796; cámara a ~17 m (el toldo ocupa ~3/4 del ancho de la foto).
      // Marcada a las 3:58.2.
      lugar: 'El Cristo Restaurant', tipo: 'fotografía', punto: { lat: 25.7657697, lng: -80.220411 }, radio: 4,
      vistas: [
        { imagen: 'registros/el-cristo-foto-00.webp', apertura: 64,
          camara: { lat: 25.765645, lng: -80.220411, alt: 1.6 }, mira: { lat: 25.765796, lng: -80.220411, alt: 2 } }
      ]
    },
    {
      // fachadas/drive/mr-cigars/00-IMG_1375.jpeg — iPhone, 72 mm eq. (≈ 27° en 4:3), de noche. Frontal desde la
      // vereda sur: entran Mr. Cigars, el 1603 y el Social Club (~11 m de pared) → cámara a ~24 m. El centro de
      // la foto cae en la franja de los carteles, ~2,8 m.
      // Marcada a las 5:53.1.
      lugar: 'Mr. Cigars', tipo: 'fotografía', punto: { lat: 25.7657443, lng: -80.2212543 }, radio: 4,
      vistas: [
        { imagen: 'registros/mr-cigars-foto-00.webp', apertura: 27,
          camara: { lat: 25.765555, lng: -80.2212543, alt: 1.6 }, mira: { lat: 25.765774, lng: -80.2212543, alt: 2.8 } }
      ]
    }
  ]
  // ── DIORAMA EN PAUSA ── 336 SW 15 Av. queda unos 400 m al norte del recorrido. Para sumarlo, ponerlo
  // dentro de proyecciones: [ … ] con un `punto` sobre el recorrido (o un `radio` que alcance) para dispararlo.
  // proyecciones_pendientes: [
  //   {
  //     lugar: '336 SW 15 Av.', tipo: 'diorama generado por IA',
  //     vistas: [
  //       { imagen: 'registros/336-sw15-diorama-00.webp', isometrica: true, apertura: 40,
  //         camara: { lat: 25.769374, lng: -80.219364, alt: 48 }, mira: { lat: 25.76975, lng: -80.21978, alt: 2 } },
  //       { imagen: 'registros/336-sw15-diorama-01.webp', isometrica: true, apertura: 38,
  //         camara: { lat: 25.76975, lng: -80.219321, alt: 57 }, mira: { lat: 25.76975, lng: -80.21978, alt: 2 } }
  //     ]
  //   }
  // ]
}

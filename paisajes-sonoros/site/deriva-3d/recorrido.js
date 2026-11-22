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
//    llega     → (opcional) 'fundido': no se vuela desde la vista anterior. Ésta se apaga, la cámara corta a oscuras
//                y la nueva se enciende ya recompuesta (2,4 s en vez de 6). Para cuando el vuelo sólo muestra mapa vacío.
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
//   · Cruce a la vereda sur EN LA ESQUINA DE LA 17 AV. (confirmado por la artista): camina por la norte hasta la
//     esquina y cruza la Calle 8 hacia el PNC Bank, sin cruzar la 17. De Mr. Cigars (5:53) a Ciao Havana (9:27) va a
//     velocidad constante (1,32 m/s, paso normal): llega a la esquina a las 7:19.9 y termina de cruzar a las 7:32.7.
//     Tumba'o (7:21) y Sala'o (7:58) se OYEN antes de pasar por delante: son notas en el lugar interpolado.
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
    { t: '6:09.3',                    lat: 25.7657379, lng: -80.2214678, nota: 'Se oye Los Montaditos Bar' },
    { t: '7:19.9',                    lat: 25.7657097, lng: -80.2224,    nota: 'Esquina de la 17 Av. · cruza la Calle 8' },
    { t: '7:21.0',                    lat: 25.7656965, lng: -80.2224,    nota: "Se oye Tumba'o" },
    // ── vuelta, vereda sur (hacia el este) ──
    { t: '7:32.7',                    lat: 25.7655569, lng: -80.2224,    nota: 'PNC Bank · esquina de la 17 Av.' },
    { t: '7:58.0',                    lat: 25.765567,  lng: -80.2220658, nota: "Se oye Sala'o" },
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
      // Orden: la foto de la artista desde la esquina, diorama de día, la foto cenital sobre el techo, diorama de noche y,
      // al final, la foto del dron (pedido de la artista: que sea la última imagen anamórfica en apreciarse).
      // Las cámaras de los dioramas están calibradas en calibracion.js con las esquinas del teatro (techo y base):
      // dan casi ortográficas (apertura ≈ 3,4°), con ~22 px de error por las proporciones inventadas por la IA.
      // El teatro está en la vereda sur, en la esquina de la 15 Av. La artista no marcó cuándo se oye. Cierra el
      // recorrido, en la vuelta: el caminante pasa primero frente a Cuban Cigars (más al oeste) y después sigue hacia
      // la esquina con el teatro adelante. `punto` está pasando Cuban Cigars (~11:51): si Cuban todavía está en el
      // aire, espera a que vuelva. Sus 5 vistas terminan después del audio: la cámara sigue hasta recomponer la última
      // y recién entonces sube a la vista general (ver EPÍLOGO en mapa.js). A la ida (cruce de 15 Av., ~1:00) no se
      // dispara: ahí se superponía con Guantanamera y Ball & Chain, que ella sí marcó, y los corría 15 s.
      lugar: 'Tower Theater', punto: { lat: 25.7656298, lng: -80.21999 }, radio: 4,
      vistas: [
        // fachadas/drive/tower-theater/00-_DSC1208.jpg — foto nocturna de la artista desde la 15 Av., apenas al norte de
        // Calle 8, mirando al suroeste: la pared este del teatro (la plaza, el árbol de Navidad) y la marquesina. Sin EXIF:
        // la cámara sale de 6 pares imagen ↔ modelo del teatro (esquina NE a 0, 5 y 10 m, esquina SE a 10 m, punta de la
        // torre a 18 m y su pedestal a 11 m), con el mismo ajuste que calibrar.html: errores de 4 a 17 px.
        // Va primero (a la altura de la calle, como la foto de Ball & Chain) y el dron cierra.
        { imagen: 'registros/tower-theater-foto-00.webp', tipo: 'fotografía', apertura: 58.43, rumbo: -143.19, cabeceo: -8.1, giro: 1.03,
          camara: { lat: 25.7658532, lng: -80.2194087, alt: 1.94 }, mira: { lat: 25.7656392, lng: -80.2195864, alt: 6.17 } },
        { imagen: 'registros/tower-theater-diorama-00.webp', tipo: 'diorama generado por IA', isometrica: true, apertura: 42,
          camara: { lat: 25.765945, lng: -80.219124, alt: 60 }, mira: { lat: 25.76546, lng: -80.21966, alt: 4 } },
        // cenital/tower_hotel_00.jpf — dron a 54,9 m justo encima del teatro, cámara a −90° (datos del XMP de DJI).
        // Rumbo −97,8° = el borde de arriba de la foto mira al oeste (Calle 8 queda a la derecha). Cabeceo 89 y no 90
        // (a 90 el rumbo queda indefinido); la mira está 1 m al oeste del nadir, en la dirección del eje óptico.
        // Del diorama a la cenital y de la cenital al diorama de noche no se vuela (llega: 'fundido'): el vuelo sólo
        // mostraba mapa vacío y un giro brusco al pasar por el nadir.
        { imagen: 'registros/tower-theatre-cenital-00.webp', tipo: 'fotografía aérea cenital', apertura: 73.7, llega: 'fundido',
          rumbo: -97.8, cabeceo: 89, giro: 0,
          camara: { lat: 25.7654547, lng: -80.2197256, alt: 54.9 }, mira: { lat: 25.7654535, lng: -80.2197355, alt: 0 } },
        { imagen: 'registros/tower-theater-diorama-02.webp', tipo: 'diorama generado por IA', isometrica: true, apertura: 40, llega: 'fundido',
          camara: { lat: 25.76546, lng: -80.218962, alt: 72 }, mira: { lat: 25.76546, lng: -80.21966, alt: 4 } },
        // la foto del dron va última: es la última imagen anamórfica que se recompone antes de volver a la panorámica
        { imagen: 'registros/tower-theatre-dron-00.webp', tipo: 'fotografía aérea', apertura: 73.7, huella: true, rumbo: -137.2, cabeceo: 22.2, giro: -0.1,
          camara: { lat: 25.7657892, lng: -80.2194265, alt: 19.5 }, mira: { lat: 25.7655532, lng: -80.2196669, alt: 5 } }
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
      // Después de la foto, los dos dioramas de IA (fachadas/25.765975736679938, -80.21976477493762_00/_01.jpg, vistas
      // frontales desde lo alto de la vereda sur), uno por vez. La foto queda como huella.
      // Los dioramas muestran tres locales: Ball & Chain, la heladería Azúcar y la tabaquería de la esquina de la 15 Av.
      // (la IA le puso "SW 14 Ave"). En edificios.json son un solo volumen de 60 m (de la 15 Av. hacia el oeste,
      // frente en lat ≈ 25.76582). Cámaras perpendiculares a la fachada (rumbo 358°), a 80 m: camara/mira/apertura salen
      // de las medidas de abajo (ancho sobre la pared = 2 · 80 m · tan(apertura / 2)). Mientras se los mira, los volúmenes
      // de enfrente (el frente del Tower Theater) se ocultan: ver CORTE en ciudad.js.
      lugar: 'Ball & Chain', punto: { lat: 25.7657893, lng: -80.219765 }, radio: 4,
      // Orden: primero la foto (es la que el caminante viene viendo pegada en la fachada: la cámara cruza la calle y
      // se recompone a la altura de los ojos), después sube a los dos dioramas. Si empezara por un diorama, la foto
      // se apagaba al acercarse y desde la vereda no se veía nada (el diorama cae en techos, visto desde 1 km).
      vistas: [
        { imagen: 'registros/ball-and-chain-foto-00.webp', tipo: 'fotografía', apertura: 21, huella: true,
          camara: { lat: 25.76562, lng: -80.219765, alt: 1.6 }, mira: { lat: 25.765815, lng: -80.219765, alt: 2 } },
        // Los dioramas se encajan para que el FRENTE DE BALL & CHAIN coincida con el de la foto (pedido de la artista):
        // base de la fachada en el piso, borde del toldo a 2,34 m y cartel «BALL & CHAIN» a 3,76–4,43 m, como en la foto,
        // con el centro del cartel donde está el de la foto (lng −80.21976). La IA dibujó la fachada más alta de lo real en
        // proporción a su ancho, así que el ancho sale de esas alturas: los tres locales ocupan ~17 m (noche) y ~24 m (día)
        // de la cuadra, no los 28 m hasta la esquina, y el cartel del dibujo queda más angosto que el de la foto.
        // de noche: base en y ≈ 650, toldo 497, cartel 388–420 (x 403–630) → 62 px/m en vertical; inclinación 13°
        // (por la vereda del dibujo) → 63,6 px/m, la imagen entera mide 25,1 m sobre la pared
        { imagen: 'registros/ball-and-chain-fachada-00.webp', tipo: 'diorama generado por IA', isometrica: true, apertura: 17.8,
          camara: { lat: 25.765116, lng: -80.2196889, alt: 20.31 }, mira: { lat: 25.7658166, lng: -80.2197161, alt: 2.31 } },
        // de día: base en y ≈ 620, toldo 518, cartel 428–456 (x 400–604) → 43,5 px/m en vertical; inclinación 16,5°
        // → 45,4 px/m, la imagen entera mide 35,2 m sobre la pared
        { imagen: 'registros/ball-and-chain-fachada-01.webp', tipo: 'diorama generado por IA', isometrica: true, apertura: 24.8,
          camara: { lat: 25.7651279, lng: -80.2196678, alt: 25.7 }, mira: { lat: 25.7658173, lng: -80.2196945, alt: 3.01 } }
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
        // El borde derecho de Skinny Louie (u ≈ 0,81; a la derecha empieza el edificio blanco de dos pisos) cae en el
        // final del volumen (lng −80.220553): con ≈ 14,6 m de pared en la foto, el centro queda 1 m al este del pin.
        // Lo de la derecha (el mural de cajones de madera) es la pared OESTE del edificio vecino, que se ve por el
        // pasaje de 2,7 m: cae en la pared oeste de ese volumen con ~20 px de diferencia. El borde de arriba de la
        // fachada (y ≈ 492 de 1200 px) queda a 5,3 m en la pared: esa es la altura del volumen en calibracion.js →
        // alturas (con más, el cielo de la foto caía sobre la pared).
        { imagen: 'registros/top-cigars-foto-00.webp', apertura: 43,
          camara: { lat: 25.765605, lng: -80.220598, alt: 1.6 }, mira: { lat: 25.765782, lng: -80.220598, alt: 4.3 } }
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
      // vereda norte, que queda a ~14 m). Va antes que el Tower Theater, que está más adelante, en la esquina.
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
      // Guantanamera y Cubaocho comparten el volumen de 91 m que llega a la esquina de la 15 Av., pero son locales
      // distintos: cada uno es un lugar aparte, con su nombre en el pie y su propio travelling (antes iban juntos bajo
      // «Guantanamera · Cubaocho» y la foto de Cubaocho salía con el nombre de Guantanamera).
      lugar: 'Guantanamera', tipo: 'fotografía', punto: { lat: 25.765808, lng: -80.2191451 }, radio: 4,
      vistas: [
        // La foto está tomada desde la galería: la pared del fondo (puerta con cortinas, piso en v ≈ 0,71, cielorraso en
        // v ≈ 0,17) es la que se pega en la fachada del volumen (lat 25.765818). Con la cámara horizontal a 1,5 m, el piso
        // del fondo cae en el suelo si la cámara está a 6,5 m de esa pared (el cielorraso queda a ~3,9 m y la galería,
        // de columna a columna, a ~8 m: coherente con el local). Antes estaba a 2,8 m y el piso flotaba a 0,9 m.
        { imagen: 'registros/guantanamera-foto-00.webp', apertura: 72,
          camara: { lat: 25.765759, lng: -80.2191451, alt: 1.5 }, mira: { lat: 25.765818, lng: -80.2191451, alt: 1.5 } },
        // fachadas/drive/guantanamera/Guantanamera.jpg — la misma galería de noche (17/11), con el gran angular (14 mm eq.,
        // 102°). Mismo criterio: la pared del fondo (puertas con las banderas, piso en v ≈ 0,70) en la fachada del volumen;
        // con la cámara horizontal a 1,5 m eso la pone a 4 m de la pared (las puertas dobles dan 1,3 m de ancho).
        { imagen: 'registros/guantanamera-foto-01.webp', apertura: 102, rumbo: -1.67, cabeceo: 0, giro: 0,
          camara: { lat: 25.7657884, lng: -80.219143, alt: 1.5 }, mira: { lat: 25.765825, lng: -80.2191442, alt: 1.5 } }
      ]
    },
    {
      // Cubaocho (Museum & Performing Arts Center), en el mismo volumen que Guantanamera, hacia la esquina de la 15 Av.
      // Se dispara cuando el caminante (vereda norte, a la ida) pasa frente a la fachada de la foto (lng −80.2192855,
      // ~1:02). Si Guantanamera todavía está en el aire, espera a que vuelva; Ball & Chain (1:57.7) espera a Cubaocho.
      lugar: 'Cubaocho', tipo: 'fotografía', punto: { lat: 25.7658038, lng: -80.2192855 }, radio: 4,
      vistas: [
        // fachadas/drive/cubaocho/Cuba 8 1759.jpg — Cubaocho desde la vereda de enfrente (24 mm eq., 71,6°), de noche.
        // La esquina del edificio con la 15 Av. (u ≈ 0,02) va en la esquina del volumen (lng −80.219395); la escala sale
        // de los autos estacionados (Fiat 500 y Model Y) → cámara a ~15,5 m de la fachada, sobre el cordón sur. Con la
        // cámara a 1,6 m, la base de la fachada (v ≈ 0,69) pide mirar 5,9° hacia arriba. Rumbo perpendicular al volumen.
        // Los pisos de arriba están retranqueados y caen en el frente del volumen de 27 m (OSM): no hay borde que encajar.
        { imagen: 'registros/cubaocho-foto-00.webp', apertura: 71.6, rumbo: -1.67, cabeceo: -5.85, giro: 0,
          camara: { lat: 25.765681, lng: -80.219281, alt: 1.6 }, mira: { lat: 25.7658204, lng: -80.2192855, alt: 3.18 } }
      ]
    },
    {
      // fachadas/drive/el-cristo-restaurant/00-_DSC0245.ARW — Sony, 29 mm (≈ 64° en 3:2). Frontal desde la calle,
      // con los carriles en primer plano; horizontales paralelas y verticales rectas → cámara horizontal.
      // Encajada sobre los volúmenes de edificios.json: el frente del local (de la reja de la izquierda al final del
      // patio, x 95…1310 px) es el frente del volumen, de lng −80.220451 a −80.220312 (13,9 m), a lat ≈ 25.765791.
      // Eso da la cámara a 14,7 m del frente y, con la base de las rejas en y ≈ 675 px, a 1,6 m de altura (ojos).
      // El costado blanco de la izquierda cae sobre la pared este del vecino (lng −80.220462). Las alturas de los dos
      // volúmenes se corrigieron en calibracion.js → alturas (el local, 4,2 m: el borde del cartel; el vecino, 6,8 m: medido en esta foto y en la de Top Cigars).
      // Marcada a las 3:58.2.
      lugar: 'El Cristo Restaurant', tipo: 'fotografía', punto: { lat: 25.7657697, lng: -80.220411 }, radio: 4,
      vistas: [
        { imagen: 'registros/el-cristo-foto-00.webp', apertura: 64,
          camara: { lat: 25.765659, lng: -80.220371, alt: 1.6 }, mira: { lat: 25.765791, lng: -80.220371, alt: 1.6 } }
      ]
    },
    {
      // fachadas/drive/mr-cigars/00-IMG_1375.jpeg — iPhone, 72 mm eq. (≈ 27° en 4:3), de noche. Frontal desde la
      // vereda sur: entran Mr. Cigars, el 1603 y el Social Club (~11 m de pared) → cámara a ~24 m. El centro de
      // la foto cae en la franja de los carteles, ~2,8 m.
      // Marcada a las 5:53.1.
      lugar: 'Mr. Cigars', tipo: 'fotografía', punto: { lat: 25.7657443, lng: -80.2212543 }, radio: 4,
      vistas: [
        // La foto cubre ≈ 10,5 m de pared (puerta del 1603 ≈ 0,95 m = 0,09 del ancho). Centrada en el pin, el Social Club
        // (borde derecho) caía en un hueco de OSM al este del volumen (lng > −80.221218): se corre 1,6 m al oeste para
        // que los cuatro locales queden sobre el edificio. La base de las vidrieras (y ≈ 1033 de 1200 px) tiene que caer
        // en el pie del volumen (a 24,4 m): eso da la cámara mirando 3,7° hacia arriba (mira a 3,18 m). Antes, con 2,8 m,
        // la vereda de la foto quedaba 0,4 m bajo el piso. El edificio se bajó a 8 m en calibracion.js → alturas (la foto
        // llega a ~7,2 m de altura en la pared; con los 15 m de OSM sobraba un bloque liso arriba de la foto).
        { imagen: 'registros/mr-cigars-foto-00.webp', apertura: 27,
          camara: { lat: 25.765555, lng: -80.2212704, alt: 1.6 }, mira: { lat: 25.765774, lng: -80.2212704, alt: 3.18 } }
      ]
    },
    // ── Fotos de la segunda carpeta de Drive (19/11/2026; carga-puntos versión 272) ──
    // Los números de los nombres de archivo son correlativos de la cámara, no direcciones; sin GPS. Los lugares se
    // ubicaron por el negocio y por los números de calle que se ven en las fotos. Las aperturas salen de la focal
    // equivalente del EXIF (4:3: 24 mm → 71,6°, 40 mm → 46,8°, 14–15 mm → 102–98°). Las cámaras se encajaron dibujando
    // las aristas de los volúmenes sobre cada foto: base de la fachada en el pie del volumen y, cuando se ve, el borde
    // del edificio en el borde del volumen y el techo en su altura (calibracion.js → alturas).
    // ⚠ Sin pasar por calibrar.html.
    {
      // El Exquisito (1510) y La Colada Gourmet (1518) están en la vereda sur, entre el Tower Theater y Cuban Cigars
      // (1520). A la vuelta no hay lugar: Cuban Cigars y el Tower cierran el recorrido. Se descubren a la IDA, desde la
      // vereda de enfrente, cuando el caminante pasa frente a ellos (~2:17; si Ball & Chain todavía está en el aire,
      // espera a que vuelva). Las dos fotos son de cerca y frontales; no llegan al techo.
      lugar: 'El Exquisito · La Colada Gourmet', tipo: 'fotografía', punto: { lat: 25.7657861, lng: -80.21987 }, radio: 4,
      vistas: [
        // fachadas/drive/el-exquisito-restaurant/El exquisito Cafeteria _1505.jpeg — 24 mm eq. (71,6°). La puerta del 1510
        // (≈ 1 m) da la cámara a 3,65 m de la vidriera, horizontal a 1,46 m (la base cae en v ≈ 0,87). El reflejo del
        // cartel de Ball & Chain en el vidrio de la puerta la ubica ~5 m al oeste de ese cartel (lng −80.21976).
        { imagen: 'registros/el-exquisito-foto-00.webp', apertura: 71.6, rumbo: 178.5, cabeceo: 0, giro: 0,
          camara: { lat: 25.765642, lng: -80.21981, alt: 1.46 }, mira: { lat: 25.765609, lng: -80.219809, alt: 1.46 } },
        // fachadas/drive/la-colada-gourmet/La calada Gourmet _1396.jpeg — gran angular (15 mm eq., 98°), de noche. La puerta
        // (0,9 × 2,3 m) da la cámara a 3,4 m, horizontal a 1,5 m. El pilar del buzón 1518 / 1520 (u ≈ 0,82) es el límite
        // con Cuban Cigars, cuya foto está centrada en lng −80.220001.
        { imagen: 'registros/la-colada-foto-00.webp', apertura: 98.1, rumbo: 178.5, cabeceo: 0, giro: 0,
          camara: { lat: 25.765637, lng: -80.219941, alt: 1.5 }, mira: { lat: 25.7656063, lng: -80.2199401, alt: 1.5 } }
      ]
    },
    {
      // fachadas/drive/el-cuban-diner/Cuban Dinner y Ciao Restaurant _1578.jpeg — Ciao Havana (los listones) y El Cuban
      // Diner (el frontón) desde la vereda norte, al atardecer (24 mm eq., 71,6°). El centro de Ciao (u ≈ 0,30) va donde
      // ella lo marcó (lng −80.22095); la escala sale de los autos estacionados → cámara a ~19 m del frente, a 1,6 m,
      // mirando 3,3° hacia arriba (base en v ≈ 0,64). El parapeto de Ciao queda a 5,5 m: es la altura del volumen en
      // calibracion.js → alturas (OSM tenía 15 m); el frontón del Diner sobresale y cae en el cielo.
      // Se descubre a la vuelta, en la vereda sur, al pasar frente al Diner (~9:11).
      lugar: 'Ciao Havana · El Cuban Diner', tipo: 'fotografía', punto: { lat: 25.7655992, lng: -80.221 }, radio: 4,
      vistas: [
        { imagen: 'registros/el-cuban-diner-foto-00.webp', apertura: 71.6, rumbo: 180, cabeceo: -3.3, giro: 0,
          camara: { lat: 25.7657528, lng: -80.2210047, alt: 1.6 }, mira: { lat: 25.7655813, lng: -80.2210047, alt: 2.69 } }
      ]
    },
    {
      // fachadas/drive/el-pub-restaurant/Restaurant Pub 1537.jpeg — la ventanita de El Pub (1548), en la esquina de la
      // 16 Av. (24 mm eq., 71,6°). Escala por la mujer y la altura del mostrador (1,1 m) → cámara a 3,6 m, horizontal a
      // 1,24 m (base de los azulejos en v ≈ 0,81, con el zócalo horizontal: la fachada de Calle 8 está de frente).
      // La foto dobla la esquina: el final de los azulejos (u ≈ 0,784) es la arista entre la fachada y la ochava del
      // volumen, y lo que sigue a la derecha (barril, menú, puerta) cae sobre la ochava. Para eso el proyector está
      // 1,5 m al este de esa arista (2,1 m al oeste de donde estaba), con la lente sin desplazar (centro 0) y sin estirar:
      // sólo desde ahí la foto se pliega sola sobre las dos paredes. Marcada a las 10:02.7.
      lugar: 'El Pub Restaurant', tipo: 'fotografía', punto: { lat: 25.7656115, lng: -80.2205937 }, radio: 4,
      vistas: [
        { imagen: 'registros/el-pub-foto-00.webp', apertura: 71.6, rumbo: 178.5, cabeceo: 0, giro: 0,
          camara: { lat: 25.7656284, lng: -80.220378, alt: 1.24 }, mira: { lat: 25.765596, lng: -80.220377, alt: 1.24 } }
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

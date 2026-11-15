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
//  desde/hasta → tramo del audio en que la cámara deja al caminante y sube a esos puntos de vista
//  vistas      → una o más imágenes del lugar, en orden; la cámara viaja de una a otra
//    imagen    → archivo en registros/ (PNG o WebP con fondo transparente = sólo se proyecta la figura)
//    camara    → posición del dron/fotógrafo: lat, lng y alt (metros sobre el piso)
//    mira      → punto al que apunta el centro de la imagen (lat, lng, alt)
//    apertura  → ángulo horizontal de la imagen, en grados (más chico = la imagen cubre menos ciudad)
//  Fuera de su tramo, la primera vista de cada lugar queda proyectada (tenue) como huella.
//  vuelve      → (opcional) otros tramos en que la cámara regresa al mismo lugar: [{ desde, hasta }, …]
//                 (p. ej. cuando el recorrido vuelve a pasar frente a la huella). Usa las mismas vistas.
//
// Abrí la página con ?editar al final de la URL para marcar puntos sobre el mapa
// mientras escuchás (clic en el mapa = punto en el momento actual del audio).
//
// ⚠ PROVISORIO: esquinas reales (OpenStreetMap, ±8 m por vereda) y tiempos inventados.
//   Vereda norte de ida (13 → 17), vereda sur de vuelta (17 → 15).
// ─────────────────────────────────────────────────────────────

window.RECORRIDO = {
  audio: '../audio/deriva_calle_8.m4a',

  puntos: [
    { t: '0:00',                  lat: 25.765875, lng: -80.21640, nota: 'Calle 8 y 13 Av.' },
    { t: '2:00',  hasta: '2:30',  lat: 25.765825, lng: -80.21810, nota: 'Calle 8 y 14 Av.' },
    { t: '4:10',  hasta: '4:50',  lat: 25.765795, lng: -80.21953, nota: 'Calle 8 y 15 Av.' },
    { t: '6:30',  hasta: '7:00',  lat: 25.765755, lng: -80.22080, nota: 'Calle 8 y 16 Av.' },
    { t: '8:30',                  lat: 25.765705, lng: -80.22251, nota: 'Calle 8 y 17 Av.' },
    { t: '8:50',  hasta: '9:20',  lat: 25.765555, lng: -80.22251, nota: 'Cruce a la vereda sur' },
    { t: '10:40',                 lat: 25.765605, lng: -80.22080, nota: 'Calle 8 y 16 Av.' },
    { t: '11:50', hasta: '12:34', lat: 25.765645, lng: -80.21953, nota: 'Calle 8 y 15 Av.' }
  ],

  miradas: [
    {
      desde: '2:02', hasta: '2:28', lugar: 'Vereda sur, 14 Av.', tipo: 'fotografía · material pendiente',
      lat: 25.765655, lng: -80.21800, rumbo: 0, ancho: 5, alto: 3.4, base: 1.4, imagenes: []
    },
    {
      desde: '6:32', hasta: '6:58', lugar: 'Vereda sur, 16 Av.', tipo: 'captura de dron · material pendiente',
      lat: 25.765585, lng: -80.22095, rumbo: 0, ancho: 5, alto: 3.4, base: 1.4, imagenes: []
    },
    {
      desde: '8:52', hasta: '9:18', lugar: 'Esquina 17 Av.', tipo: 'celular · material pendiente',
      lat: 25.765725, lng: -80.22235, rumbo: 180, ancho: 4, alto: 5, base: 1.2, imagenes: []
    }
  ],

  proyecciones: [
    {
      // drone/tower_theatre_00.jpeg — captura aérea desde la esquina de Calle 8 y 15 Av, mirando al suroeste.
      // Cámara calculada a partir de esquinas del teatro y del cruce peatonal (ver calibracion.js, se puede
      // retocar en calibrar.html). El volumen del teatro en edificios.json se midió sobre esta misma foto.
      // Ida: pausa en la vereda norte, 15 Av. Vuelta: pausa final frente al teatro, en la vereda sur.
      desde: '4:12', hasta: '4:48', lugar: 'Tower Theater', tipo: 'captura de dron',
      vuelve: [{ desde: '11:52', hasta: '12:32' }],
      vistas: [
        { imagen: 'registros/tower-theatre-dron-00.webp', apertura: 73.7, rumbo: -137.2, cabeceo: 22.2, giro: -0.1,
          camara: { lat: 25.7657892, lng: -80.2194265, alt: 19.5 }, mira: { lat: 25.7655532, lng: -80.2196669, alt: 5 } }
      ]
    },
    {
      // fachadas/ball_and_chain_00.jpeg — foto de la artista desde la vereda sur, a la altura de los ojos
      // (teleobjetivo, sin EXIF). Fachada en edificios.json: lat ≈ 25.765815, a ~22 m de la cámara.
      // Escala por las personas en la puerta (≈ 8 m de ancho en la pared); las cabezas quedan apenas
      // debajo del centro → la cámara mira casi horizontal, un poco hacia arriba.
      // Ida: el caminante pasa pegado a la fachada (vereda norte) y la cámara cruza a la vereda de enfrente.
      // (A la vuelta no regresa: ese tramo lo ocupa Cuban Cigars Corp, en la vereda sur.)
      desde: '5:08', hasta: '5:38', lugar: 'Ball & Chain', tipo: 'fotografía',
      vistas: [
        { imagen: 'registros/ball-and-chain-foto-00.webp', apertura: 21,
          camara: { lat: 25.76562, lng: -80.219765, alt: 1.6 }, mira: { lat: 25.765815, lng: -80.219765, alt: 2 } }
      ]
    },
    {
      // fachadas/25.766093230951114, -80.22060821726569.jpeg — Top Cigars y Skinny Louie (1551 SW 8 St),
      // foto de la artista desde la vereda sur. La longitud del nombre coincide con el centro de la foto.
      // Fachada en edificios.json: lat ≈ 25.765782 (polígono de Kung Fu Chicken + Top Cigars + Skinny Louie).
      // Por las personas: ≈ 15,6 m de ancho en la pared y las cabezas bien debajo del centro → cámara
      // a 1,6 m inclinada ~8° hacia arriba (el centro de la foto cae a ~4,3 m en la pared).
      desde: '6:02', hasta: '6:28', lugar: 'Top Cigars · Skinny Louie', tipo: 'fotografía',
      vuelve: [{ desde: '10:40', hasta: '11:04' }],
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
      // Sólo a la vuelta: el caminante va por esta vereda y pasa por el lugar de la artista hacia las 11:24.
      desde: '11:10', hasta: '11:34', lugar: 'Cuban Cigars Corp', tipo: 'fotografía',
      vistas: [
        { imagen: 'registros/cuban-cigars-foto-00.webp', apertura: 62,
          camara: { lat: 25.765658, lng: -80.220001, alt: 1.6 }, mira: { lat: 25.765604, lng: -80.220001, alt: 2 } }
      ]
    }
  ]
  // ── DIORAMAS EN PAUSA ── todavía no calzan bien sobre la ciudad; para reactivarlos, descomentar y
  // volver a ponerlos dentro de proyecciones: [ … ] (máximo 6 vistas en total).
  // proyecciones_dioramas: [
  //   {
  //     desde: '4:12', hasta: '4:48', lugar: 'Tower Theater', tipo: 'diorama generado por IA',
  //     vistas: [
  //       { imagen: 'registros/tower-theater-diorama-00.webp', apertura: 42,
  //         camara: { lat: 25.765945, lng: -80.219124, alt: 60 }, mira: { lat: 25.76546, lng: -80.21966, alt: 4 } },
  //       { imagen: 'registros/tower-theater-diorama-02.webp', apertura: 40,
  //         camara: { lat: 25.76546, lng: -80.218962, alt: 72 }, mira: { lat: 25.76546, lng: -80.21966, alt: 4 } }
  //     ]
  //   },
  //   {
  //     // ⚠ Ball & Chain ya está activo con la foto: para sumar estos dioramas, poner sus dos vistas
  //     //   ANTES de la foto en la proyección activa (no agregar una segunda entrada "Ball & Chain").
  //     // fachadas/25.765975736679938, -80.21976477493762_00/_01.jpg — vista frontal desde la vereda sur
  //     // a la vuelta, desde la vereda sur, la huella se ve en la pared: la cámara vuelve a subir para revelarla
  //     desde: '5:15', hasta: '5:51', lugar: 'Ball & Chain', tipo: 'diorama generado por IA',
  //     vuelve: [{ desde: '10:52', hasta: '11:22' }],
  //     vistas: [
  //       { imagen: 'registros/ball-and-chain-fachada-00.webp', apertura: 46,
  //         camara: { lat: 25.76512, lng: -80.219765, alt: 22 }, mira: { lat: 25.765976, lng: -80.219765, alt: 5 } },
  //       { imagen: 'registros/ball-and-chain-fachada-01.webp', apertura: 44,
  //         camara: { lat: 25.765076, lng: -80.219765, alt: 38 }, mira: { lat: 25.765976, lng: -80.219765, alt: 5 } }
  //     ]
  //   },
  //   {
  //     desde: '11:52', hasta: '12:32', lugar: '336 SW 15 Av.', tipo: 'diorama generado por IA',
  //     vistas: [
  //       { imagen: 'registros/336-sw15-diorama-00.webp', apertura: 40,
  //         camara: { lat: 25.769374, lng: -80.219364, alt: 48 }, mira: { lat: 25.76975, lng: -80.21978, alt: 2 } },
  //       { imagen: 'registros/336-sw15-diorama-01.webp', apertura: 38,
  //         camara: { lat: 25.76975, lng: -80.219321, alt: 57 }, mira: { lat: 25.76975, lng: -80.21978, alt: 2 } }
  //     ]
  //   }
  // ]
}

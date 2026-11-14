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
      desde: '4:12', hasta: '4:48', lugar: 'Tower Theater', tipo: 'diorama generado por IA',
      vistas: [
        { imagen: 'registros/tower-theater-diorama-00.webp', apertura: 42,
          camara: { lat: 25.765945, lng: -80.219124, alt: 60 }, mira: { lat: 25.76546, lng: -80.21966, alt: 4 } },
        { imagen: 'registros/tower-theater-diorama-02.webp', apertura: 40,
          camara: { lat: 25.76546, lng: -80.218962, alt: 72 }, mira: { lat: 25.76546, lng: -80.21966, alt: 4 } }
      ]
    },
    {
      // fachadas/25.765975736679938, -80.21976477493762_00/_01.jpg — vista frontal desde la vereda sur
      desde: '5:15', hasta: '5:51', lugar: 'Ball & Chain', tipo: 'diorama generado por IA',
      vistas: [
        { imagen: 'registros/ball-and-chain-fachada-00.webp', apertura: 46,
          camara: { lat: 25.76512, lng: -80.219765, alt: 22 }, mira: { lat: 25.765976, lng: -80.219765, alt: 5 } },
        { imagen: 'registros/ball-and-chain-fachada-01.webp', apertura: 44,
          camara: { lat: 25.765076, lng: -80.219765, alt: 38 }, mira: { lat: 25.765976, lng: -80.219765, alt: 5 } }
      ]
    },
    {
      desde: '11:52', hasta: '12:32', lugar: '336 SW 15 Av.', tipo: 'diorama generado por IA',
      vistas: [
        { imagen: 'registros/336-sw15-diorama-00.webp', apertura: 40,
          camara: { lat: 25.769374, lng: -80.219364, alt: 48 }, mira: { lat: 25.76975, lng: -80.21978, alt: 2 } },
        { imagen: 'registros/336-sw15-diorama-01.webp', apertura: 38,
          camara: { lat: 25.76975, lng: -80.219321, alt: 57 }, mira: { lat: 25.76975, lng: -80.21978, alt: 2 } }
      ]
    }
  ]
}

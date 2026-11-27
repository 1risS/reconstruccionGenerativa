// ─────────────────────────────────────────────────────────────
// Configuración de los cuatro puntos sonoros.
// Los colores salen de la paleta del flyer (ver assets/estilo.css) y tienen contraste ≥ 4:1 sobre el papel.
// Para cambiar textos, colores o audios, editar SOLO este archivo.
//
//  slug     → nombre de la carpeta / URL (no cambiar una vez impresos los QR)
//  pistas   → se reproducen en orden; al terminar, vuelve a empezar si loop=true
//  texto    → BORRADOR: reemplazar por los textos curatoriales definitivos (si está vacío no se muestra)
//  frases   → (opcional) frases cortas en inglés que se alternan con una animación mientras se escucha.
//             Conviene que no pasen de unos 70 caracteres. El tiempo en pantalla depende del largo.
//  fotos    → (opcional) fotos que pasan en loop como fondo de la página (assets/fotos.js). src es relativo a la página.
//             En vez de src puede llevar video (+ poster): se ve mudo y en loop. viaje: segundos entre detalles.
//             detalles: [x, y, zoom] con x, y entre 0 y 1 (0,0 = arriba a la izquierda). La cámara los recorre
//             en orden sin detenerse. zoom 1 = la foto llenando la pantalla (en un teléfono, un tercio del ancho).
// ─────────────────────────────────────────────────────────────

window.MUESTRA = {
  titulo: 'Little Havana',
  subtitulo: 'Between the Map and the Territory',
  artista: 'Viviana Zargón',
  sede: 'Miami Photographic Observatory · Aluna Art Foundation'
}

window.SITIOS = {
  'tower-hotel': {
    numero: '01',
    // La página incluye también a Aluna Art Foundation, al lado del hotel (aparece en todas las fotos).
    // El slug sigue siendo tower-hotel porque el QR ya está impreso.
    nombre: 'Tower Hotel & Aluna',
    lugar: 'Hotel · Aluna Art Foundation, next door',
    texto: '',
    frases: [
      '1450 SW 7th Street. Built in 1920.',
      'Before Little Havana had a name, this was a YMCA.',
      'During World War II, its rooms became hospital wards.',
      'Then the Tower Apartments. Then the Tower Hotel.',
      'Jazz musicians rested here: Billie Holiday, Count Basie, Chet Baker.',
      'One block away, the Ball & Chain kept the night going.',
      'In the 1930s, a Jewish, working-class street.',
      'From the 1960s on, the heart of Cuban exile in Miami.',
      'In 1980, the Mariel boatlift brought a new wave of arrivals.',
      'In 2018, Miami Motel Stories turned its rooms into a stage.',
      'Next door: Aluna Art Foundation.',
      'Its exhibitions have also filled the hotel’s first floor.',
      'Its Miami Photographic Observatory reads the city through photographs.',
      'A century of people passing through.'
    ],
    color: '#9a5a4a',
    loop: true,
    // Toma III recortada a 3:54 (el original completo está en ../audios/descartados/)
    pistas: [{ titulo: 'I', src: '../audio/tower_02.m4a' }],
    // Diorama del hotel. Con una sola foto la cámara recorre los detalles en ciclo, sin detenerse.
    fotos: [
      { src: 'fotos/diorama.jpg', detalles: [[0.6, 0.3, 1.25], [0.82, 0.36, 1.45], [0.67, 0.52, 1.4], [0.47, 0.66, 1.35], [0.27, 0.55, 1.3], [0.5, 0.8, 1.2]] }
    ]
  },

  'ball-and-chain': {
    numero: '02',
    nombre: 'Ball & Chain',
    lugar: 'Music and entertainment',
    texto: '',
    frases: [
      'Calle Ocho, since 1935.',
      'It opened as the Ball & Chain Saloon.',
      'In the Jim Crow years, Black and Latin artists played this stage.',
      'Billie Holiday. Count Basie. Nat King Cole. Chet Baker.',
      'In the fifties, its owners had ties to the Teamsters and the mob.',
      'Count Basie sued for unpaid fees, and won.',
      'By 1958, the music had stopped.',
      'In 2014 it reopened, still open to the sky.',
      'Salsa and Latin jazz on the Pineapple Stage.',
      'In 2018, Cardi B filmed “I Like It” here.'
    ],
    color: '#8a4f37',
    loop: true,
    // Tramo de la toma II desde 3:30 (con fundido de entrada) y la toma I entera, que cierra con fundido.
    pistas: [{ titulo: 'I', src: '../audio/ball_and_chain.m4a' }],
    // Video del lugar, mudo y en loop (el final se funde con el principio). La cámara recorre los detalles sin parar.
    fotos: [
      {
        video: 'video/ball-and-chain.mp4',
        poster: 'video/ball-and-chain.jpg',
        viaje: 9,
        detalles: [[0.5, 0.42, 1.1], [0.34, 0.55, 1.3], [0.58, 0.34, 1.22], [0.66, 0.6, 1.35], [0.44, 0.48, 1.15]]
      }
    ]
  },

  'casa-de-tabaco': {
    numero: '03',
    nombre: 'Casa Habano',
    lugar: 'Cigar shop',
    texto: '',
    frases: [
      '1743 SW 8th Street. Cigars rolled by hand.',
      'In the early sixties, Cuba nationalized its tobacco industry.',
      'Master rollers and factory families fled to Miami.',
      'They rebuilt their workshops along this street.',
      'Every cigar is still rolled entirely by hand.',
      'The chaveta, the roller’s curved blade, trims the leaf.',
      'A craft passed down from generation to generation.',
      'At first, cigars for an exile community that missed home.',
      'Now locals and tourists watch the rolling as it happens.',
      'To roll a cigar here is to keep “the Cuba of yesterday.”',
      'Memory, and pride in where you come from.'
    ],
    color: '#8a6a1c',
    loop: true,
    // Recortado a 2:23 con fundidos (el original completo está en ../audios/descartados/)
    pistas: [{ titulo: 'I', src: '../audio/casa_tabaco.m4a' }],
    fotos: [
      { src: 'fotos/fachada.jpg', detalles: [[0.2, 0.42, 1.15], [0.37, 0.32, 1.35], [0.63, 0.45, 1.45], [0.76, 0.3, 1.2]] },
      { src: 'fotos/street-view.jpg', detalles: [[0.2, 0.45, 1.1], [0.49, 0.52, 1.25], [0.85, 0.4, 1.1]] },
      { src: 'fotos/diorama-04.jpg', detalles: [[0.18, 0.5, 1.2], [0.37, 0.5, 1.35], [0.6, 0.38, 1.3], [0.76, 0.45, 1.3], [0.76, 0.72, 1.4]] },
      { src: 'fotos/diorama-06.jpg', detalles: [[0.23, 0.3, 1.3], [0.32, 0.35, 1.2], [0.58, 0.4, 1.3], [0.55, 0.6, 1.35], [0.82, 0.6, 1.25]] }
    ]
  },

  'domino-park': {
    numero: '04',
    nombre: "Domino Park",
    lugar: 'Máximo Gómez Park',
    texto: '',
    frases: [
      "Máximo Gómez Park. Everyone calls it Domino Park.",
      'Named after the general of Cuba’s wars of independence.',
      'Calle Ocho and 15th Avenue.',
      'Tables in the shade. Dominoes and chess.',
      'The old Cuban men come here to play.',
      'To sit at the club tables, you must be 55 or older.',
      'The click of the tiles is the sound of the place.',
      'Busiest on Sundays.',
      'A joke, an argument, a new hand.',
      'Little Havana’s living room.'
    ],
    color: '#455830',
    loop: true,
    pistas: [{ titulo: 'I', src: '../audio/domino_park.m4a' }],
    fotos: [
      { src: 'fotos/parque-dron.jpg', detalles: [[0.52, 0.55, 1.35], [0.38, 0.62, 1.4], [0.7, 0.35, 1.3], [0.53, 0.42, 1.25], [0.74, 0.85, 1.35]] },
      { src: 'fotos/mesas.jpg', detalles: [[0.28, 0.3, 1.35], [0.6, 0.4, 1.4], [0.6, 0.55, 1.3], [0.87, 0.78, 1.35], [0.47, 0.85, 1.3]] },
      { src: 'fotos/domino.jpg', detalles: [[0.5, 0.33, 1.4], [0.6, 0.62, 1.35], [0.53, 0.88, 1.4], [0.86, 0.6, 1.3], [0.2, 0.5, 1.3], [0.32, 0.13, 1.25]] },
      { src: 'fotos/jugadores.jpg', detalles: [[0.3, 0.45, 1.05], [0.55, 0.5, 1.15], [0.78, 0.45, 1.1], [0.5, 0.4, 1]] }
    ]
  },

  // El QR impreso de /deriva-calle-8/ redirige a /deriva-3d/ (site/_redirects y deriva-calle-8/index.html).
  // La entrada se mantiene por el color, el número y la regeneración de los QR.
  'deriva-calle-8': {
    numero: '05',
    nombre: 'Calle Ocho Walk',
    lugar: 'A walk along Calle Ocho',
    enlace: 'deriva-3d/',
    texto: '',
    color: '#685236',
    loop: true,
    pistas: [{ titulo: 'I', src: '../audio/deriva_calle_8.m4a' }]
  },

  // Sin registro sonoro propio (el cine está cerrado): el audio será un montaje de fragmentos de las películas
  // que se pasaban en los años 60. Mientras pistas esté vacío, la página muestra sólo las frases y un aviso.
  'tower-theatre': {
    numero: '06',
    nombre: 'Tower Theatre',
    lugar: 'Movie theater',
    texto: '',
    frases: [
      'Calle Ocho and 15th Avenue. Since 1926.',
      'A movie palace with a thousand seats.',
      'In 1931 it was remodeled, and gained its tower.',
      'Its spire greeted the Cubans arriving after 1959.',
      'In 1960, it was among the first in Miami to subtitle films in Spanish.',
      'Hollywood on the screen. Spanish underneath.',
      'Reading in Spanish, listening in English.',
      'A new language, learned in the dark.',
      'For many exiles, a first door into American life.',
      'Today the screen is dark.'
    ],
    color: '#3f5868',
    loop: true,
    // 30 fragmentos al azar de Charade y McLintock! (1963, dominio público), nivelados y en orden aleatorio.
    // Los cortes están en ../audios/tower-peliculas/
    pistas: [{ titulo: 'I', src: '../audio/tower_theatre.m4a' }],
    // torre-bn.jpg es chica (348 px): va con poco zoom
    fotos: [
      { src: 'fotos/fachada.jpg', detalles: [[0.6, 0.28, 1.3], [0.48, 0.6, 1.35], [0.45, 0.78, 1.3], [0.78, 0.68, 1.3]] },
      { src: 'fotos/marquesina.jpg', detalles: [[0.42, 0.27, 1.4], [0.62, 0.27, 1.4], [0.5, 0.47, 1.25], [0.5, 0.75, 1.35], [0.77, 0.7, 1.4]] },
      { src: 'fotos/torre-bn.jpg', detalles: [[0.55, 0.3, 1], [0.35, 0.65, 1.08]] },
      { src: 'fotos/diorama.jpg', detalles: [[0.65, 0.25, 1.3], [0.4, 0.3, 1.2], [0.25, 0.6, 1.3], [0.68, 0.55, 1.4], [0.75, 0.72, 1.3]] }
    ]
  }
}

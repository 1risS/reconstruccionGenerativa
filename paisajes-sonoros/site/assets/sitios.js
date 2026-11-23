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
// ─────────────────────────────────────────────────────────────

window.MUESTRA = {
  titulo: 'Little Havana',
  subtitulo: 'Studies in Simulation and Generative Reconstruction',
  artista: 'Viviana Zargón',
  sede: 'Miami Photographic Observatory · Aluna Art Foundation'
}

window.SITIOS = {
  'tower-hotel': {
    numero: '01',
    nombre: 'Tower Hotel',
    lugar: 'Hotel',
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
      'A century of people passing through.'
    ],
    color: '#9a5a4a',
    loop: true,
    // Toma III recortada a 3:54 (el original completo está en ../audios/descartados/)
    pistas: [{ titulo: 'I', src: '../audio/tower_02.m4a' }]
  },

  'ball-and-chain': {
    numero: '02',
    nombre: 'Ball & Chain',
    lugar: 'Música y entretenimiento',
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
    pistas: [
      { titulo: 'I', src: '../audio/ball_and_chain_00.m4a' },
      { titulo: 'II', src: '../audio/ball_and_chain_01.m4a' },
      { titulo: 'III', src: '../audio/ball_and_chain_02.m4a' }
    ]
  },

  'casa-de-tabaco': {
    numero: '03',
    nombre: 'Casa de Tabaco',
    lugar: 'Tabaquería',
    texto:
      'Un local de torcido y venta de tabaco. ' +
      '[Texto provisorio: reemplazar por el texto curatorial.]',
    color: '#8a6a1c',
    loop: true,
    pistas: [{ titulo: 'I', src: '../audio/casa_tabaco.m4a' }]
  },

  'domino-park': {
    numero: '04',
    nombre: 'Domino Park',
    lugar: 'Parque Máximo Gómez',
    texto: '',
    frases: [
      'Máximo Gómez Park. Everyone calls it Domino Park.',
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
    pistas: [{ titulo: 'I', src: '../audio/domino_park.m4a' }]
  },

  'deriva-calle-8': {
    numero: '05',
    nombre: 'Deriva Calle 8',
    lugar: 'Recorrido por la Calle Ocho',
    texto:
      'Una deriva a lo largo de la Calle Ocho. ' +
      '[Texto provisorio: reemplazar por el texto curatorial.]',
    color: '#685236',
    loop: true,
    pistas: [{ titulo: 'I', src: '../audio/deriva_calle_8.m4a' }]
  },

  // Sin registro sonoro propio (el cine está cerrado): el audio será un montaje de fragmentos de las películas
  // que se pasaban en los años 60. Mientras pistas esté vacío, la página muestra sólo las frases y un aviso.
  'tower-theatre': {
    numero: '06',
    nombre: 'Tower Theatre',
    lugar: 'Cine',
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
    pistas: []
  }
}

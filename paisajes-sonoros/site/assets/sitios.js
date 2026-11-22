// ─────────────────────────────────────────────────────────────
// Configuración de los cuatro puntos sonoros.
// Los colores salen de la paleta del flyer (ver assets/estilo.css) y tienen contraste ≥ 4:1 sobre el papel.
// Para cambiar textos, colores o audios, editar SOLO este archivo.
//
//  slug     → nombre de la carpeta / URL (no cambiar una vez impresos los QR)
//  pistas   → se reproducen en orden; al terminar, vuelve a empezar si loop=true
//  texto    → BORRADOR: reemplazar por los textos curatoriales definitivos
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
    texto:
      '' +
      '[Texto provisorio: podemos incluir datos de color o alguna reflexión poética sobre el lugar]',
    color: '#9a5a4a',
    loop: true,
    // Toma III recortada a 3:54 (el original completo está en ../audios/descartados/)
    pistas: [{ titulo: 'I', src: '../audio/tower_02.m4a' }]
  },

  'ball-and-chain': {
    numero: '02',
    nombre: 'Ball & Chain',
    lugar: 'Música y entretenimiento',
    texto:
      'Sala de música y entretenimiento de la Calle Ocho. ' +
      '[Texto provisorio: reemplazar por el texto curatorial.]',
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
    texto:
      'El parque donde se juega dominó en la Calle Ocho. ' +
      '[Texto provisorio: reemplazar por el texto curatorial.]',
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
  }
}

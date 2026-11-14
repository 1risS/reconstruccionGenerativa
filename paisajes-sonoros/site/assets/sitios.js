// ─────────────────────────────────────────────────────────────
// Configuración de los cuatro puntos sonoros.
// Para cambiar textos, colores o audios, editar SOLO este archivo.
//
//  slug     → nombre de la carpeta / URL (no cambiar una vez impresos los QR)
//  pistas   → se reproducen en orden; al terminar, vuelve a empezar si loop=true
//  texto    → BORRADOR: reemplazar por los textos curatoriales definitivos
// ─────────────────────────────────────────────────────────────

window.MUESTRA = {
  titulo: 'Little Havana',
  subtitulo: 'estudios en simulación y reconstrucción generativa',
  artista: 'Viviana Zargón',
  sede: 'Aluma Art Center · Miami'
}

window.SITIOS = {
  'tower-hotel': {
    numero: '01',
    nombre: 'Tower Hotel',
    lugar: 'Hotel',
    texto:
      '' +
      '[Texto provisorio: podemos incluir datos de color o alguna reflexión poética sobre el lugar]',
    color: '#c9a26b',
    loop: true,
    pistas: [
      { titulo: 'I', src: '../audio/tower_00.m4a' },
      { titulo: 'II', src: '../audio/tower_01.m4a' },
      { titulo: 'III', src: '../audio/tower_02.m4a' }
    ]
  },

  'ball-and-chain': {
    numero: '02',
    nombre: 'Ball & Chain',
    lugar: 'Música y entretenimiento',
    texto:
      'Sala de música y entretenimiento de la Calle Ocho. ' +
      '[Texto provisorio: reemplazar por el texto curatorial.]',
    color: '#d0574a',
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
    color: '#a0784a',
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
    color: '#7fa68a',
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
    color: '#8c9fc4',
    loop: true,
    pistas: [{ titulo: 'I', src: '../audio/deriva_calle_8.m4a' }]
  }
}

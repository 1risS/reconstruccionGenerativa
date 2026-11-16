// ─────────────────────────────────────────────────────────────
// Configuración de la herramienta de carga. Script clásico (define window.CARGA).
//
//  audios    → los que la artista puede escuchar y marcar. "id" es el nombre del archivo sin extensión
//              (el mismo que usa site/picos/<id>.json). Se reproducen desde el sitio publicado, así que
//              no hace falta copiarlos acá: el sitio ya responde las peticiones Range que pide Safari.
//  tiposFoto → opciones del desplegable "tipo" de cada registro (el pie que muestra la deriva 3D).
//  semilla   → lugares con los que arranca la carga la primera vez (los que ya usa recorrido.js).
// ─────────────────────────────────────────────────────────────

window.CARGA = {
  sitio: 'https://little-havana-sonoro.pages.dev/',

  audios: [
    { id: 'deriva_calle_8', nombre: 'Deriva Calle 8' },
    { id: 'tower_00', nombre: 'Tower Hotel · I' },
    { id: 'tower_01', nombre: 'Tower Hotel · II' },
    { id: 'tower_02', nombre: 'Tower Hotel · III' },
    { id: 'ball_and_chain_00', nombre: 'Ball & Chain · I' },
    { id: 'ball_and_chain_01', nombre: 'Ball & Chain · II' },
    { id: 'ball_and_chain_02', nombre: 'Ball & Chain · III' },
    { id: 'casa_tabaco', nombre: 'Casa de Tabaco' },
    { id: 'domino_park', nombre: 'Domino Park' }
  ],

  centro: { lat: 25.76575, lng: -80.2195 },
  zoom: 17.2,

  tiposFoto: [
    'fotografía',
    'fotografía con celular',
    'fotografía aérea (dron)',
    'fotografía aérea cenital',
    'diorama generado por IA',
    'video',
    'otro'
  ],

  semilla: [
    { nombre: 'Tower Theater', direccion: '1508 SW 8 St', lat: 25.76546, lng: -80.21966 },
    { nombre: 'Ball & Chain', direccion: '1513 SW 8 St', lat: 25.765815, lng: -80.219765 },
    { nombre: 'Cuban Cigars Corp', direccion: '1520 SW 8 St', lat: 25.765604, lng: -80.220001 },
    { nombre: 'Top Cigars · Skinny Louie', direccion: '1551 SW 8 St', lat: 25.765782, lng: -80.220608 }
  ]
}

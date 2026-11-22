// ─────────────────────────────────────────────────────────────
// Configuración de la herramienta de carga. Script clásico (define window.CARGA).
//
//  audios    → los que la artista puede escuchar y marcar (con uno solo no se muestra el selector). "id" es el nombre del archivo sin extensión
//              (el mismo que usa site/picos/<id>.json). Se reproducen desde el sitio publicado, así que
//              no hace falta copiarlos acá: el sitio ya responde las peticiones Range que pide Safari.
//  tiposFoto → opciones del desplegable "tipo" de cada registro (el pie que muestra la deriva 3D).
//  semilla   → lugares con los que arranca la carga la primera vez (los que ya usa recorrido.js).
// ─────────────────────────────────────────────────────────────

window.CARGA = {
  sitio: 'https://little-havana-sonoro.pages.dev/',

  // Sólo la deriva: los audios de interiores (Tower Hotel, Ball & Chain, etc.) se escuchan en sus
  // páginas de QR y no se ubican en el mapa.
  audios: [
    { id: 'deriva_calle_8', nombre: 'Deriva Calle 8' }
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

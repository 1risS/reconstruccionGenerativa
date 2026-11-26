# ─────────────────────────────────────────────────────────────
# Esquema de recorridos para imprimir (60 × 80 cm), a la manera de los mapas de Jorge Macchi:
# sólo líneas, puntos y nombres.
#
#   python3 generar.py blanco|color  → recorridos-<versión>.html (SVG en milímetros)
#   ./exportar.sh                    → los dos PDF vectoriales a tamaño real y sus vistas previas PNG
#
# Las direcciones son reales (rumbo calculado con las coordenadas de OSM). Los largos están comprimidos
# con raíz cuadrada, porque el Casa Habano queda a ~460 m y Aluna a ~15 m: a escala no se leería nada.
# Las distancias rotuladas son las reales, en línea recta.
# Marca: la misma de assets/estilo.css (tinta, tierra, Barlow Condensed).
# ─────────────────────────────────────────────────────────────
import math
import sys

ANCHO, ALTO = 600, 800          # mm
K = 17.5                        # mm por √metro
CENTRO = (420, 345)             # posición del Tower Hotel en el pliego (mm)

# Dos versiones del fondo: `python3 generar.py blanco` (parejo) o `python3 generar.py color`
# (papel cálido teñido de tierra, más claro alrededor del dibujo y más hondo hacia los bordes).
VERSION = sys.argv[1] if len(sys.argv) > 1 else 'blanco'
TINTA, TEXTO, GRIS, TIERRA = '#111111', '#2b2a29', '#727375', '#685236'
if VERSION == 'color':
    PAPEL, LINEA = '#e6dfd4', '#c2b6a4'
    PAPEL_LUZ, PAPEL_SOMBRA = '#efeae2', '#d9cfc0'
else:
    PAPEL, LINEA = '#ffffff', '#c0c0c0'
    PAPEL_LUZ = PAPEL_SOMBRA = PAPEL

# lat, lng de Nominatim (OSM). Aluna y el observatorio comparten el número 1444 de la SW 7th St.
LUGARES = {
    'tower-hotel':   dict(nombre='Tower Hotel',   dir='1450 SW 7th St',  lat=25.7663255, lng=-80.2188739, color='#9a5a4a'),
    'aluna':         dict(nombre='Aluna Art Foundation', dir='1444 SW 7th St', lat=25.7663887, lng=-80.2187355, color=TIERRA),
    'theatre':       dict(nombre='Tower Theatre', dir='1508 SW 8th St',  lat=25.7653574, lng=-80.2196716, color='#3f5868'),
    'ball-chain':    dict(nombre='Ball & Chain',  dir='1513 SW 8th St',  lat=25.7658335, lng=-80.2197766, color='#8a4f37'),
    'casa-habano':   dict(nombre='Casa Habano',   dir='1743 SW 8th St',  lat=25.7656747, lng=-80.2234143, color='#8a6a1c'),
    'domino':        dict(nombre="Domino Park", dir='801 SW 15th Ave', lat=25.7654909, lng=-80.2193738, color='#455830'),
}


def metros(a, b):
    """Vector este/norte en metros de a hacia b."""
    lat0 = math.radians((a['lat'] + b['lat']) / 2)
    return ((b['lng'] - a['lng']) * 111320 * math.cos(lat0), (b['lat'] - a['lat']) * 110574)


def proyectar(origen_mm, este, norte):
    """Rumbo real, largo comprimido. Devuelve (x, y) en mm del pliego y la distancia en metros."""
    d = math.hypot(este, norte)
    r = K * math.sqrt(d)
    return (origen_mm[0] + este / d * r, origen_mm[1] - norte / d * r), d


hotel = LUGARES['tower-hotel']
pos = {'tower-hotel': CENTRO}
dist = {}
for clave in ('aluna', 'theatre', 'ball-chain', 'casa-habano', 'domino'):
    pos[clave], dist[clave] = proyectar(CENTRO, *metros(hotel, LUGARES[clave]))

# El observatorio está dentro de Aluna: tramo esquemático hacia el norte, sin distancia.
ax, ay = pos['aluna']
pos['mpho'] = (ax, ay - 62)

# (desde, hasta, rótulo de distancia)
TRAMOS = [
    ('aluna', 'mpho', None),
    ('aluna', 'tower-hotel', dist['aluna']),
    ('tower-hotel', 'theatre', dist['theatre']),
    ('tower-hotel', 'ball-chain', dist['ball-chain']),
    ('tower-hotel', 'casa-habano', dist['casa-habano']),
    ('tower-hotel', 'domino', dist['domino']),
]


def f(n):
    return f'{n:.2f}'


def texto_sobre_linea(p, q, contenido, lado, desde_q, clase, sep):
    """Texto paralelo al segmento p→q, siempre legible de izquierda a derecha.
    desde_q: distancia (mm) desde q donde termina/empieza el texto. lado: +1 arriba, −1 abajo de la línea."""
    dx, dy = q[0] - p[0], q[1] - p[1]
    L = math.hypot(dx, dy)
    ux, uy = dx / L, dy / L
    ang = math.degrees(math.atan2(dy, dx))
    # punto de anclaje sobre la línea, a desde_q de q
    bx, by = q[0] - ux * desde_q, q[1] - uy * desde_q
    invertido = ux < 0
    if invertido:
        ang += 180
    # normal "hacia arriba" en el sistema del texto
    nx, ny = (uy, -ux) if not invertido else (-uy, ux)
    bx, by = bx + nx * sep * lado, by + ny * sep * lado
    ancla = 'end' if not invertido else 'start'
    base = 'auto' if lado > 0 else 'hanging'
    return (f'<text class="{clase}" x="{f(bx)}" y="{f(by)}" text-anchor="{ancla}" dominant-baseline="{base}" '
            f'transform="rotate({f(ang)} {f(bx)} {f(by)})">{contenido}</text>')


svg = []
A = svg.append

# tramos
for a, b, d in TRAMOS:
    p, q = pos[a], pos[b]
    A(f'<line x1="{f(p[0])}" y1="{f(p[1])}" x2="{f(q[0])}" y2="{f(q[1])}" stroke="{TINTA}" stroke-width="0.7" stroke-linecap="round"/>')

# rótulos de los rayos que salen del hotel: nombre arriba de la línea, distancia y dirección abajo
for clave in ('theatre', 'ball-chain', 'casa-habano', 'domino'):
    L = LUGARES[clave]
    p, q = CENTRO, pos[clave]
    A(texto_sobre_linea(p, q, L['nombre'], +1, 9, 'nombre', 2.6))
    A(texto_sobre_linea(p, q, f'{L["dir"]}  ·  {round(dist[clave] / 5) * 5} m', -1, 9, 'dato', 2.6))

# Aluna → hotel: corto y casi horizontal; los rótulos van fuera de la línea
hx, hy = CENTRO
A(f'<text class="dato" x="{f((ax + hx) / 2)}" y="{f((ay + hy) / 2 + 9)}" text-anchor="middle">{round(dist["aluna"])} m</text>')
A(f'<text class="nombre" x="{f(ax + 8)}" y="{f(ay + 4)}">Aluna</text>')
A(f'<text class="nombre-sub" x="{f(ax + 8)}" y="{f(ay + 14)}">Art Foundation</text>')
A(f'<text class="dato" x="{f(ax + 8)}" y="{f(ay + 23)}">1444 SW 7th St</text>')
mx, my = pos['mpho']
A(f'<text class="nombre" x="{f(mx)}" y="{f(my - 23)}" text-anchor="middle">Miami</text>')
A(f'<text class="nombre" x="{f(mx)}" y="{f(my - 11)}" text-anchor="middle">Photographic Observatory</text>')
A(texto_sobre_linea(pos['aluna'], pos['mpho'], 'within Aluna', +1, 31, 'dato', 2.6))

# Tower Hotel: nombre arriba a la izquierda del punto, lejos de los rayos (que van al sur y al oeste)
A(f'<text class="nombre-hub" x="{f(hx - 6)}" y="{f(hy - 9)}" text-anchor="end">Tower Hotel</text>')
A(f'<text class="dato" x="{f(hx - 6)}" y="{f(hy - 2.5)}" text-anchor="end">1450 SW 7th St</text>')

# puntos (encima de las líneas)
for clave, (x, y) in pos.items():
    if clave in ('tower-hotel', 'aluna'):
        A(f'<circle cx="{f(x)}" cy="{f(y)}" r="4.6" fill="{PAPEL_LUZ}" stroke="{TINTA}" stroke-width="0.7"/>')
        A(f'<circle cx="{f(x)}" cy="{f(y)}" r="2.1" fill="{TINTA}"/>')
    elif clave == 'mpho':
        A(f'<circle cx="{f(x)}" cy="{f(y)}" r="3" fill="{TIERRA}"/>')
    else:
        A(f'<circle cx="{f(x)}" cy="{f(y)}" r="3" fill="{LUGARES[clave]["color"]}"/>')

# norte
nx, ny = 70, 120
A(f'<line x1="{nx}" y1="{ny}" x2="{nx}" y2="{ny - 26}" stroke="{TINTA}" stroke-width="0.7"/>')
A(f'<path d="M{nx - 2.6} {ny - 21} L{nx} {ny - 27.5} L{nx + 2.6} {ny - 21} Z" fill="{TINTA}"/>')
A(f'<text class="norte" x="{nx}" y="{ny - 31}" text-anchor="middle">N</text>')

dibujo = '\n    '.join(svg)


def mezcla(a, b, t):
    a = [int(a[i:i + 2], 16) for i in (1, 3, 5)]
    b = [int(b[i:i + 2], 16) for i in (1, 3, 5)]
    return '#' + ''.join(f'{round(x + (y - x) * t):02x}' for x, y in zip(a, b))


# degradé en curva suave (smoothstep), con muchas paradas para que no haya quiebres ni escalones
PARADAS = '\n      '.join(
    f'<stop offset="{i / 24:.4f}" stop-color="{mezcla(PAPEL_LUZ, PAPEL_SOMBRA, (lambda u: u * u * (3 - 2 * u))(i / 24))}"/>'
    for i in range(25))

html = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Little Havana · Routes</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,300;0,400;0,500;0,600;1,300&family=Barlow+Semi+Condensed:wght@400;500;600&display=block">
<style>
  @page {{ size: {ANCHO}mm {ALTO}mm; margin: 0; }}
  html, body {{ margin: 0; padding: 0; background: {PAPEL}; }}
  svg {{ display: block; width: {ANCHO}mm; height: {ALTO}mm; }}
  text {{ fill: {TINTA}; }}
  .nombre     {{ font-family: 'Barlow Condensed'; font-weight: 400; font-size: 12px; }}
  .nombre-sub {{ font-family: 'Barlow Condensed'; font-weight: 300; font-size: 12px; }}
  .nombre-hub {{ font-family: 'Barlow Condensed'; font-weight: 500; font-size: 14px; }}
  .dato       {{ font-family: 'Barlow Semi Condensed'; font-weight: 500; font-size: 5.2px; fill: {GRIS};
                 font-variant-numeric: tabular-nums; text-transform: lowercase; }}
  .escala     {{ font-family: 'Barlow Semi Condensed'; font-weight: 500; font-size: 4.2px; fill: {GRIS}; }}
  .norte      {{ font-family: 'Barlow Condensed'; font-weight: 500; font-size: 7px; }}
  .titulo     {{ font-family: 'Barlow Condensed'; font-weight: 300; font-size: 22px; }}
  .encabezado {{ font-family: 'Barlow Condensed'; font-weight: 600; font-size: 7px; fill: {GRIS}; letter-spacing: 0.04em; }}
  .artista    {{ font-family: 'Barlow Condensed'; font-weight: 500; font-size: 64px; fill: {TIERRA}; letter-spacing: -0.01em; }}
  .sede       {{ font-family: 'Barlow Semi Condensed'; font-weight: 500; font-size: 8.5px; }}
  .credito    {{ font-family: 'Barlow Semi Condensed'; font-weight: 400; font-size: 6.5px; fill: {TEXTO}; }}
  .nota       {{ font-family: 'Barlow Semi Condensed'; font-weight: 400; font-size: 5.6px; fill: {GRIS}; }}
</style>
</head>
<body>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {ANCHO} {ALTO}" width="{ANCHO}mm" height="{ALTO}mm">
  <defs>
    <radialGradient id="papel" gradientUnits="userSpaceOnUse" cx="{CENTRO[0] - 40}" cy="{CENTRO[1] + 60}" r="620">
      {PARADAS}
    </radialGradient>
  </defs>
  <rect width="{ANCHO}" height="{ALTO}" fill="url(#papel)"/>
  <text class="encabezado" x="50" y="58">ROUTES  ·  LITTLE HAVANA, MIAMI</text>
  <g>
    {dibujo}
  </g>

  <text class="nota" x="50" y="596">Directions are true. Lengths are compressed so near and far fit on the same sheet;</text>
  <text class="nota" x="50" y="603.5">distances are measured in a straight line.</text>

  <text class="titulo" x="50" y="672">Little Havana:</text>
  <text class="titulo" x="50" y="697">Between the Map</text>
  <text class="titulo" x="50" y="722">and the Territory</text>
  <text class="artista" x="550" y="668" text-anchor="end">viviana</text>
  <text class="artista" x="550" y="722" text-anchor="end">zargón</text>
  <line x1="50" y1="742" x2="550" y2="742" stroke="{LINEA}" stroke-width="0.35"/>
  <text class="sede" x="50" y="757">miami photographic observatory  ·  aluna art foundation</text>
  <text class="sede" x="550" y="757" text-anchor="end">1444 sw 7th street miami fl 33135</text>
  <text class="credito" x="50" y="770">Interactive and Sound Design: Iris Saladino</text>
</svg>
</body>
</html>
'''

with open(f'recorridos-{VERSION}.html', 'w') as fh:
    fh.write(html)
print(f'recorridos-{VERSION}.html', {k: round(v) for k, v in dist.items()})

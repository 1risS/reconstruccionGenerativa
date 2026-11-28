# ─────────────────────────────────────────────────────────────
# Esquema de los lugares de los dioramas para imprimir (60 × 80 cm), con el mismo estilo que generar.py
# (a la manera de los mapas de Jorge Macchi): una estrella de líneas que sale de Aluna, un rayo por lugar,
# con el nombre escrito a lo largo del rayo.
#
#   python3 generar-dioramas.py blanco|color  → dioramas-<versión>.html (SVG en milímetros)
#   ./exportar.sh                             → los PDF vectoriales a tamaño real y sus vistas previas PNG
#
# Lugares: el catálogo de dioramas de la artista (ver LUGARES).
# Rumbo real; largo comprimido con raíz cuadrada (de ~100 m a ~3,4 km). Donde varios lugares caen casi en la
# misma dirección, los rayos se abren lo justo para que los nombres no se pisen. Distancias reales, en línea recta.
# ─────────────────────────────────────────────────────────────
import math
import sys

ANCHO, ALTO = 600, 800                      # mm
CAJA = (50, 95, 550, 600)                   # zona del dibujo: x0, y0, x1, y1 (mm)
R0 = 82                                     # largo del rayo más corto (mm): da lugar a los nombres cerca del centro
CUERPO = 9.5                                # tamaño de los nombres (mm)
ALTO_RENGLON = 18.5                          # alto de un rótulo (nombre + dirección): separación mínima entre vecinos
ANCHO_LETRA = 0.40                          # ancho medio de un carácter de Barlow Condensed, en em

VERSION = sys.argv[1] if len(sys.argv) > 1 else 'blanco'
TINTA, TEXTO, GRIS, TIERRA = '#111111', '#2b2a29', '#727375', '#685236'
if VERSION == 'color':
    PAPEL, LINEA = '#e6dfd4', '#c2b6a4'
    PAPEL_LUZ, PAPEL_SOMBRA = '#efeae2', '#d9cfc0'
else:
    PAPEL, LINEA = '#ffffff', '#c0c0c0'
    PAPEL_LUZ = PAPEL_SOMBRA = PAPEL

CENTRO = dict(nombre='Aluna Art Foundation', dir='1444 SW 7th St', lat=25.7664995, lng=-80.2187469)

# Lugares del catálogo de dioramas de la artista (52 dioramas → 26 lugares además de Aluna, que es el centro
# y tiene los dioramas 20, 32 y 34). Nombres para el público en inglés; los nombres propios quedan como son.
# Coordenadas: el pin de su lista de Google Maps «Recorrido pequeña Havana» cuando el lugar está ahí, y si no,
# la dirección geocodificada en OSM (Nominatim). Entre corchetes, los números de diorama.
LUGARES = [
    ('Gas Station and Flowers',          '1121 SW 32nd Ave',     25.7614862, -80.2467395),   # [1]
    ('Yambo',                            '1643 SW 1st St',       25.7725634, -80.2222960),   # [2, 5, 17]
    ('Los Catrachos',                    '18 SW 11th Ave',       25.7729662, -80.2131306),   # [4, 29, 41]
    ('Presidente Supermarket',           '2294 W Flagler St',    25.7722785, -80.2327346),   # [6, 40]
    ('Bowl Bar',                         '698 NW 17th Ave',      25.7798400, -80.2226160),   # [7, 24, 39]
    ('La Esquina de la Fama',            '1388 SW 8th St',       25.7655464, -80.2182299),   # [9, 21]
    ('Justo Tires',                      '151 NW 22nd Ave',      25.7751935, -80.2308829),   # [10, 23, 25]
    ('Corner Auto Shop',                 '2199 NW 1st Ter',      25.7747900, -80.2308850),   # [11]
    ('Farm Stores',                      '3270 NW 7th St',       25.7789007, -80.2489933),   # [12]
    ('Former Pharmacy',                  'SW 12th Ave & 1st St', 25.7724000, -80.2148000),   # [13]
    ('La Casa de las Baleadas',          '101 SW 17th Ave',      25.7720078, -80.2229121),   # [14, 43]
    ('Caraballo',                        '1270 SW 8th St',       25.7654560, -80.2160752),   # [15]
    ('House with Palm Trees',            '1232 NW 32nd Pl',      25.7843846, -80.2494373),   # [16, 45]
    ('El Palacio de los Jugos',          '1512 SW 27th Ave',     25.7583427, -80.2388658),   # [18, 27]
    ('Azúcar Mural · Party Cake Bakery', '1368 SW 8th St',       25.7656880, -80.2181046),   # [19, 30]
    ('Mi Ranchito',                      '1935 W Flagler St',    25.7730325, -80.2276618),   # [22]
    ('La Leonesa Fritanga',              'SW 12th Ave & 1st St', 25.7724000, -80.2148000),   # [26, 51]
    ('House with Greenery',              '336 SW 15th Ave',      25.7697485, -80.2197866),   # [28, 42, 50]
    ('Lincoln-Martí',                    '798 SW 27th Ave',      25.7650712, -80.2390291),   # [31, 37]
    ('Market',                           '100 NW 8th Ave',       25.7748622, -80.2079242),   # [38, 47]
    ('Tower Theatre',                    '1508 SW 8th St',       25.7654353, -80.2196728),   # [33, 36]
    ('Seventh-day Adventist Church',     '862 SW 4th St',        25.7695642, -80.2089972),   # [35, 49]
    ('Domino Park',                      '1444 SW 8th St',       25.7655757, -80.2193397),   # [44]
    ('Ball & Chain',                     '1513 SW 8th St',       25.7658335, -80.2197766),   # [46]
    ('House with Inflatables',           '258 NW 34th Ave',      25.7748838, -80.2510720),   # [48]
    ('Los Paisanos',                     '824 W Flagler St',     25.7734263, -80.2081801),   # [52]
]


def metros(a_lat, a_lng, b_lat, b_lng):
    lat0 = math.radians((a_lat + b_lat) / 2)
    return ((b_lng - a_lng) * 111320 * math.cos(lat0), (b_lat - a_lat) * 110574)


def rotulo_dist(d):
    return f'{round(d / 10) * 10} m' if d < 1000 else f'{d / 1000:.1f} km'.replace('.0 km', ' km')


puntos = []
for nombre, direccion, lat, lng in LUGARES:
    e, n = metros(CENTRO['lat'], CENTRO['lng'], lat, lng)
    d = math.hypot(e, n)
    dato = f'{direccion}  ·  {rotulo_dist(d)}'
    puntos.append(dict(nombre=nombre, dato=dato, d=d, rumbo=math.atan2(-n, e),   # ángulo en el SVG (y hacia abajo)
                       largo_txt=max(len(nombre) * ANCHO_LETRA * CUERPO, len(dato) * 0.47 * 5.2) + 9))
dmin = min(p['d'] for p in puntos)


def separar(puntos, radio):
    """Abre los ángulos donde dos nombres se pisarían. Dos rótulos radiales chocan sólo si sus tramos
    [r, r + largo] se superponen; entonces necesitan una diferencia angular de ALTO_RENGLON / r."""
    for p in puntos:
        p['ang'] = p['rumbo']
    for _ in range(4000):
        movio = False
        for i, p in enumerate(puntos):
            for q in puntos[i + 1:]:
                rp, rq = radio(p), radio(q)
                if rp > rq + q['largo_txt'] or rq > rp + p['largo_txt']:
                    continue
                dif = math.atan2(math.sin(p['ang'] - q['ang']), math.cos(p['ang'] - q['ang']))
                necesita = ALTO_RENGLON / min(rp, rq)
                if abs(dif) < necesita:
                    empuje = (necesita - abs(dif)) / 2 + 1e-4
                    signo = 1 if dif >= 0 else -1
                    if dif == 0:
                        signo = 1 if p['rumbo'] >= q['rumbo'] else -1
                    p['ang'] += signo * empuje
                    q['ang'] -= signo * empuje
                    movio = True
        if not movio:
            return True
    return False


def extremos(cx, cy, K):
    """Caja que ocupa el dibujo con el centro en (cx, cy) y escala K (mm por √m)."""
    radio = lambda p: R0 + K * (math.sqrt(p['d']) - math.sqrt(dmin))
    separar(puntos, radio)
    xs, ys = [cx], [cy]
    for p in puntos:
        r = radio(p)
        for rr in (r, r + p['largo_txt']):
            xs.append(cx + rr * math.cos(p['ang']))
            ys.append(cy + rr * math.sin(p['ang']))
    return min(xs), min(ys), max(xs), max(ys), radio


# Busca la posición del centro y la escala más grande que entran en la caja.
mejor = None
for cx in range(260, 441, 15):
    for cy in range(260, 441, 15):
        lo, hi = 0.5, 8
        for _ in range(12):
            K = (lo + hi) / 2
            x0, y0, x1, y1, _r = extremos(cx, cy, K)
            if x0 >= CAJA[0] and y0 >= CAJA[1] and x1 <= CAJA[2] and y1 <= CAJA[3]:
                lo = K
            else:
                hi = K
        if mejor is None or lo > mejor[2]:
            mejor = (cx, cy, lo)
CX, CY, K = mejor
# centra el dibujo en la caja (la búsqueda deja libre el sobrante vertical u horizontal)
x0, y0, x1, y1, radio = extremos(CX, CY, K)
CX += ((CAJA[0] + CAJA[2]) - (x0 + x1)) / 2
CY += ((CAJA[1] + CAJA[3]) - (y0 + y1)) / 2
assert separar(puntos, radio), 'los rótulos no terminan de separarse'
for p in puntos:
    p['r'] = radio(p)
    p['x'], p['y'] = CX + p['r'] * math.cos(p['ang']), CY + p['r'] * math.sin(p['ang'])


def f(n):
    return f'{n:.2f}'


svg = []
A = svg.append

for p in puntos:
    A(f'<line x1="{f(CX)}" y1="{f(CY)}" x2="{f(p["x"])}" y2="{f(p["y"])}" stroke="{TINTA}" stroke-width="0.55" stroke-linecap="round"/>')

# rótulos radiales a continuación del punto, como en el primer esquema: el nombre arriba del eje del rayo y
# la dirección con la distancia abajo, en gris. Siempre legibles de izquierda a derecha.
for p in puntos:
    c, s_ = math.cos(p['ang']), math.sin(p['ang'])
    bx, by = p['x'] + c * 6, p['y'] + s_ * 6
    grados = math.degrees(p['ang'])
    ancla = 'start'
    if c < 0:   # hacia la izquierda: se da vuelta y se ancla por el final
        grados += 180
        ancla = 'end'
    A(f'<g transform="translate({f(bx)} {f(by)}) rotate({f(grados)})">'
      f'<text class="nombre" x="0" y="-1.4" text-anchor="{ancla}">{p["nombre"]}</text>'
      f'<text class="dato" x="0" y="1.9" text-anchor="{ancla}" dominant-baseline="hanging">{p["dato"]}</text></g>')

for p in puntos:
    A(f'<circle cx="{f(p["x"])}" cy="{f(p["y"])}" r="2.4" fill="{TIERRA}"/>')

# centro: Aluna, con el nombre en el hueco angular más grande entre los rayos
angs = sorted(p['ang'] % (2 * math.pi) for p in puntos)
huecos = [((angs[(i + 1) % len(angs)] - a) % (2 * math.pi), a) for i, a in enumerate(angs)]
# el rótulo es horizontal: se prefieren los huecos hacia el este o el oeste
ancho_hueco, desde = max(huecos, key=lambda h: h[0] * abs(math.cos(h[1] + h[0] / 2)) ** 2)
medio = desde + ancho_hueco / 2
hx, hy = CX + 9 * math.copysign(1, math.cos(medio)), CY + 30 * math.sin(medio)
ancla = 'start' if math.cos(medio) >= 0 else 'end'
dy1, dy2 = -8, 2
A(f'<text class="nombre-hub halo" x="{f(hx)}" y="{f(hy + dy1)}" text-anchor="{ancla}" dominant-baseline="central">Aluna</text>')
A(f'<text class="nombre-sub halo" x="{f(hx)}" y="{f(hy + dy2)}" text-anchor="{ancla}" dominant-baseline="central">Art Foundation</text>')
A(f'<text class="dato halo" x="{f(hx)}" y="{f(hy + dy2 + 8.5)}" text-anchor="{ancla}" dominant-baseline="central">{CENTRO["dir"]}</text>')
A(f'<circle cx="{f(CX)}" cy="{f(CY)}" r="4.6" fill="{PAPEL_LUZ}" stroke="{TINTA}" stroke-width="0.7"/>')
A(f'<circle cx="{f(CX)}" cy="{f(CY)}" r="2.1" fill="{TINTA}"/>')

# norte
nx, ny = 70, 150
A(f'<line x1="{nx}" y1="{ny}" x2="{nx}" y2="{ny - 26}" stroke="{TINTA}" stroke-width="0.7"/>')
A(f'<path d="M{nx - 2.6} {ny - 21} L{nx} {ny - 27.5} L{nx + 2.6} {ny - 21} Z" fill="{TINTA}"/>')
A(f'<text class="norte" x="{nx}" y="{ny - 31}" text-anchor="middle">N</text>')

dibujo = '\n    '.join(svg)


def mezcla(a, b, t):
    a = [int(a[i:i + 2], 16) for i in (1, 3, 5)]
    b = [int(b[i:i + 2], 16) for i in (1, 3, 5)]
    return '#' + ''.join(f'{round(x + (y - x) * t):02x}' for x, y in zip(a, b))


PARADAS = '\n      '.join(
    f'<stop offset="{i / 24:.4f}" stop-color="{mezcla(PAPEL_LUZ, PAPEL_SOMBRA, (lambda u: u * u * (3 - 2 * u))(i / 24))}"/>'
    for i in range(25))

html = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Little Havana · Dioramas</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,300;0,400;0,500;0,600;1,300&family=Barlow+Semi+Condensed:wght@400;500;600&display=block">
<style>
  @page {{ size: {ANCHO}mm {ALTO}mm; margin: 0; }}
  html, body {{ margin: 0; padding: 0; background: {PAPEL}; }}
  svg {{ display: block; width: {ANCHO}mm; height: {ALTO}mm; }}
  text {{ fill: {TINTA}; }}
  .nombre     {{ font-family: 'Barlow Condensed'; font-weight: 400; font-size: {CUERPO}px; }}
  .nombre-sub {{ font-family: 'Barlow Condensed'; font-weight: 300; font-size: 12px; }}
  .nombre-hub {{ font-family: 'Barlow Condensed'; font-weight: 500; font-size: 14px; }}
  .dato       {{ font-family: 'Barlow Semi Condensed'; font-weight: 500; font-size: 5.2px; fill: {GRIS};
                 font-variant-numeric: tabular-nums; text-transform: lowercase; }}
  /* el rótulo de Aluna queda encima de los rayos: un halo del color del papel los interrumpe bajo las letras */
  .halo       {{ paint-order: stroke; stroke: {PAPEL_LUZ}; stroke-width: 2.4px; stroke-linejoin: round; }}
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
    <radialGradient id="papel" gradientUnits="userSpaceOnUse" cx="{CX}" cy="{CY + 40}" r="620">
      {PARADAS}
    </radialGradient>
  </defs>
  <rect width="{ANCHO}" height="{ALTO}" fill="url(#papel)"/>
  <text class="encabezado" x="50" y="58">DIORAMAS  ·  LITTLE HAVANA, MIAMI</text>
  <g>
    {dibujo}
  </g>

  <text class="nota" x="50" y="626">The places where the dioramas were made, seen from Aluna. Directions are true, opened slightly</text>
  <text class="nota" x="50" y="633.5">where places crowd together; lengths are compressed so near and far fit on the same sheet.</text>
  <text class="nota" x="50" y="641">Distances are measured in a straight line.</text>

  <text class="titulo" x="50" y="672">Little Havana:</text>
  <text class="titulo" x="50" y="697">Between the Map</text>
  <text class="titulo" x="50" y="722">and the Territory</text>
  <text class="artista" x="550" y="668" text-anchor="end">viviana</text>
  <text class="artista" x="550" y="722" text-anchor="end">zargón</text>
  <line x1="50" y1="742" x2="550" y2="742" stroke="{LINEA}" stroke-width="0.35"/>
  <text class="sede" x="50" y="757">miami photographic observatory  ·  aluna art foundation</text>
  <text class="sede" x="550" y="757" text-anchor="end">1444 sw 7th street miami fl 33135</text>
  <text class="credito" x="50" y="770">Dioramas: Viviana Zargón  ·  Interactive and Sound Design: Iris Saladino</text>
</svg>
</body>
</html>
'''

with open(f'dioramas-{VERSION}.html', 'w') as fh:
    fh.write(html)
print(f'dioramas-{VERSION}.html  centro=({CX}, {CY})  K={K:.2f}')

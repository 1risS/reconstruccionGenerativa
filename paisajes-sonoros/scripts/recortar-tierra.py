"""Quita el bloque de tierra (los estratos debajo de la vereda) de los dioramas de IA: vuelve transparente todo lo
que queda debajo del borde de la superficie. Sin esto, al proyectar el diorama la tierra cae sobre la calle de enfrente.

Los polígonos están medidos a mano sobre cada imagen (píxeles de la imagen tal como está en registros/): el borde
de arriba de cada polígono es la arista donde la vereda o la calle se encuentra con la tierra.
Es idempotente: se puede volver a correr. La versión con tierra queda en git.

Uso: .venv/bin/python scripts/recortar-tierra.py            (todos)
     .venv/bin/python scripts/recortar-tierra.py <nombre>   (uno, p. ej. tower-theater-diorama-00)
"""
import sys
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw

REGISTROS = Path(__file__).resolve().parent.parent / 'site/deriva-3d/registros'

# nombre → polígono (x, y) que se vuelve transparente
TIERRA = {
    # vista desde el noreste: arista izquierda (vereda de 15 Av.) y derecha (Calle 8), esquina al frente
    'tower-theater-diorama-00': [(0, 533), (45, 531), (805, 872), (1555, 610), (1600, 610), (1600, 1067), (0, 1067)],
    # de noche, desde el sureste: cara izquierda y frente del bloque
    'tower-theater-diorama-02': [(150, 437), (157, 437), (362, 900), (1478, 710), (1600, 710), (1600, 1067), (150, 1067), (0, 1067), (0, 437)],
    # frontales: todo lo que está debajo del cordón de la calle
    'ball-and-chain-fachada-00': [(0, 786), (1600, 786), (1600, 1013), (0, 1013)],
    'ball-and-chain-fachada-01': [(0, 736), (1600, 736), (1600, 978), (0, 978)],
}

SOBRE = 4  # el polígono se dibuja a 4× y se reduce: borde suave, sin escalones


def recortar(nombre, poligono):
    ruta = REGISTROS / f'{nombre}.webp'
    im = Image.open(ruta).convert('RGBA')
    w, h = im.size
    mascara = Image.new('L', (w * SOBRE, h * SOBRE), 255)
    ImageDraw.Draw(mascara).polygon([(x * SOBRE, y * SOBRE) for x, y in poligono], fill=0)
    mascara = mascara.resize((w, h), Image.LANCZOS)
    im.putalpha(ImageChops.darker(im.getchannel('A'), mascara))   # conserva el fondo ya recortado
    im.save(ruta, 'WEBP', quality=86, method=6)
    print(f'{ruta.name}: {w}×{h}, {ruta.stat().st_size // 1024} KB')


nombres = sys.argv[1:] or list(TIERRA)
for n in nombres:
    recortar(n, TIERRA[n])

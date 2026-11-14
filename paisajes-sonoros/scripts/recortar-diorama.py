"""Quita el fondo liso de un diorama (relleno desde los bordes) y guarda WebP con transparencia.
Uso: .venv/bin/python scripts/recortar-diorama.py entrada.jpg salida.webp [umbral=22] [ancho=1600]"""
import sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ent, sal = sys.argv[1], sys.argv[2]
umbral = float(sys.argv[3]) if len(sys.argv) > 3 else 22
ancho = int(sys.argv[4]) if len(sys.argv) > 4 else 1600

im = Image.open(ent).convert('RGB')
if im.width > ancho:
    im = im.resize((ancho, round(im.height * ancho / im.width)), Image.LANCZOS)
a = np.asarray(im).astype(np.float32)
borde = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
fondo = np.median(borde, axis=0)
dist = np.abs(a - fondo).max(axis=2)
cand = dist < umbral
etiq, n = ndimage.label(cand)
toca = set(np.unique(np.concatenate([etiq[0], etiq[-1], etiq[:, 0], etiq[:, -1]]))) - {0}
fondo_mask = np.isin(etiq, list(toca))
# cerrar agujeritos del objeto y suavizar el borde
obj = ndimage.binary_fill_holes(~fondo_mask)
obj = ndimage.binary_opening(obj, iterations=1)
# descartar fragmentos sueltos (p. ej. reflejos sobre un fondo oscuro): menos del 10 % de la pieza mayor
partes, n = ndimage.label(obj)
if n > 1:
    areas = ndimage.sum(obj, partes, range(1, n + 1))
    obj = np.isin(partes, 1 + np.flatnonzero(areas >= 0.1 * areas.max()))
alfa = Image.fromarray((obj * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))
im.putalpha(alfa)
im.save(sal, 'WEBP', quality=86, method=6)
print(sal, im.size, 'fondo', fondo.round(), 'objeto %.0f%%' % (obj.mean() * 100))

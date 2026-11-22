"""Texturas de video en las paredes de la deriva 3D (collage, no anamórficas).

Del video de la caminata (recorrido_calle_8.MOV, 17 min, celular vertical) saca frames, ubica cada uno sobre la
Calle 8 con la tabla de ANCLAJES (segundo del video → vereda y longitud, leídos de carteles y números de puerta) y,
para cada tramo de pared de ANCHO metros, elige el frame más nítido tomado frente a ese tramo. Los junta en un atlas
(site/deriva-3d/video/paredes.webp) y escribe site/deriva-3d/paredes-video.js, que ciudad.js usa para pegarlos en
las fachadas que dan a la Calle 8, por debajo de las fotos de los puntos.

Con --pelicula arma además el MODO VIDEO (site/deriva-3d/video/deriva.mp4): una película a 12 fps con la duración del
audio de la deriva. Para cada cuadro busca dónde está el caminante en ese momento (puntos de recorrido.js) y toma el
frame del video filmado en ese mismo lugar y vereda. Si el caminante se detiene, la imagen se congela; si avanza, corre
en stop motion; los interiores (donde el video se queda y el caminante sólo pasa) se ven en avance rápido.

Con --tira arma en cambio una FRANJA CONTINUA (site/deriva-3d/video/tira.webp): un barrido (slit-scan) de cada
vereda. La cámara mira hacia adelante con la fachada a la derecha; para cada columna de la tira (a lo largo de la
vereda, de oeste a este) toma la rendija vertical RENDIJA del frame filmado en esa posición. ciudad.js la estira del
piso al techo de cada pared. Con ?collage en la URL se ven otra vez los frames sueltos del atlas.

Uso (desde paisajes-sonoros/):
  .venv/bin/python scripts/paredes-video.py [ruta del video] [--cache carpeta] [--hoja vista.jpg] [--pelicula] [--tira]

Necesita ffmpeg (y node, para leer recorrido.js). Los frames extraídos se guardan en --cache (por defecto, una carpeta
temporal) y se reutilizan.
"""
import argparse, collections, json, math, os, subprocess, sys, tempfile
import numpy as np
from PIL import Image, ImageDraw

AQUI = os.path.dirname(os.path.abspath(__file__))
SITIO = os.path.join(AQUI, '..', 'site', 'deriva-3d')

FPS = 2                    # frames por segundo que se extraen para elegir
ANCHO, ALTO = 3.3, 4.4     # metros de pared que cubre cada cuadro (3:4)
PX = (180, 240)            # píxeles de cada cuadro en el atlas
COLUMNAS = 16
LAT = 25.7657              # para pasar de grados de longitud a metros
KX = 111319.49 * math.cos(math.radians(LAT))
# eje de la Calle 8 (sale de los puntos de recorrido.js: el caminante va a 8,5 m del eje)
EJE = [[-80.2182399, 25.7657589], [-80.2217797, 25.76565205]]
# tramos de cada vereda que se cubren (longitud oeste → este)
VEREDAS = {'norte': (-80.22250, -80.21795), 'sur': (-80.22250, -80.21900)}

# ANCLAJES: (tiempo del video, vereda, longitud). Entre dos anclajes de la misma vereda la posición se interpola;
# entre una vereda y la otra (el cruce de la 17 Av.) los frames no se usan.
ANCLAJES = [
    # ida por la vereda norte, hacia el oeste
    ('0:00', 'norte', -80.21812),   # 1419, al lado de Pajaritos (1421)
    ('1:36', 'norte', -80.21912),   # Guantanamera
    ('2:00', 'norte', -80.21925),   # Cubaocho (se queda conversando)
    ('2:56', 'norte', -80.21935),
    ('3:04', 'norte', -80.21942),   # esquina de la 15 Av.
    ('3:20', 'norte', -80.21958),   # Little Havana Cigar Factory (1501)
    ('3:28', 'norte', -80.21970),   # Ball & Chain
    ('3:44', 'norte', -80.21990),   # sombrerería
    ('4:24', 'norte', -80.22040),   # El Cristo
    ('4:40', 'norte', -80.22052),
    ('5:28', 'norte', -80.22062),   # semáforo de la 16 Av.
    ('5:44', 'norte', -80.22078),   # Subway · Domino's
    ('6:24', 'norte', -80.22110),   # 1603
    ('6:40', 'norte', -80.22118),   # 1605
    ('6:48', 'norte', -80.22125),   # Mr. Cigars
    ('6:56', 'norte', -80.22138),   # Sake Bar · Hibachi
    ('7:04', 'norte', -80.22150),   # pasaje (Capo)
    ('7:20', 'norte', -80.22180),
    ('7:36', 'norte', -80.22225),   # 100 Montaditos (entra; hasta 9:20)
    ('9:20', 'norte', -80.22232),
    ('9:36', 'norte', -80.22240),   # esquina de la 17 Av.
    # en la esquina de la 17 Av. cruza la Calle 8 hacia el PNC Bank (esquina sureste; confirmado por la artista)
    # y vuelve por la vereda sur, hacia el este
    ('10:16', 'sur', -80.22238),    # PNC Bank
    ('10:32', 'sur', -80.22225),
    ('10:56', 'sur', -80.22210),    # RC Gallery
    ('11:12', 'sur', -80.22190),    # Art Core
    ('11:28', 'sur', -80.22170),    # House of Daiquiri
    ('11:36', 'sur', -80.22155),    # Sala'o (entra; hasta 12:00)
    ('12:00', 'sur', -80.22150),
    ('12:32', 'sur', -80.22112),    # Cuban Diner
    ('12:56', 'sur', -80.22092),    # Ciao Havana (entra; hasta 13:52)
    ('13:52', 'sur', -80.22086),
    ('14:00', 'sur', -80.22075),    # 1612
    ('14:16', 'sur', -80.22063),    # 1604
    ('14:32', 'sur', -80.22050),    # cruza la 16 Av.
    ('14:40', 'sur', -80.22036),    # El Pub
    ('15:28', 'sur', -80.21990),    # café enfrente de Ball & Chain
    ('15:52', 'sur', -80.21985),    # 1510 · El Exquisito
    ('16:16', 'sur', -80.21970),    # Tower Theater
    ('16:32', 'sur', -80.21945),    # esquina de la 15 Av.
    ('16:48', 'sur', -80.21925),    # Domino Park
    ('17:10', 'sur', -80.21930),
]
# tramos que no sirven como textura (primeros planos de una remera, de una persona en la mesa)
DESCARTAR = [('2:10', '2:46'), ('13:10', '13:48')]


def seg(t):
    m, s = t.split(':')
    return int(m) * 60 + float(s)


def posicion(t):
    """(vereda, longitud) del frame del segundo t, o None si no está sobre una vereda (cruce, después del final)."""
    for (ta, va, la), (tb, vb, lb) in zip(ANCLAJES, ANCLAJES[1:]):
        ta, tb = seg(ta), seg(tb)
        if ta <= t <= tb:
            if va != vb:
                return None
            return va, la + (lb - la) * (t - ta) / (tb - ta)
    return None


def extraer(video, cache):
    os.makedirs(cache, exist_ok=True)
    if any(f.endswith('.jpg') for f in os.listdir(cache)):
        return
    # recorte 3:4 del cuadro vertical (9:16), dejando un poco más de piso que de cielo
    filtro = f'fps={FPS},crop=iw:iw*4/3:0:ih*0.10,scale={PX[0] * 2}:{PX[1] * 2}'
    subprocess.run(['ffmpeg', '-v', 'error', '-i', video, '-vf', filtro, '-q:v', '3',
                    os.path.join(cache, '%05d.jpg')], check=True)


def nitidez(im):
    g = np.asarray(im.convert('L').resize((180, 240)), dtype=np.float32)
    lap = g[1:-1, 1:-1] * 4 - g[:-2, 1:-1] - g[2:, 1:-1] - g[1:-1, :-2] - g[1:-1, 2:]
    return float(lap.var())


# ── modo video ──
FPS_PELICULA = 12
PX_PELICULA = (270, 360)
SEP = 8.5 / 110574          # el caminante va a 8,5 m del eje (en grados de latitud)
PELICULA = os.path.join(SITIO, 'video', 'deriva.mp4')


def lat_eje(lng):
    (l0, a0), (l1, a1) = EJE
    return a0 + (lng - l0) * (a1 - a0) / (l1 - l0)


def puntos_recorrido():
    """Fotogramas clave del caminante [(t, lng, lat)], como los arma mapa.js (con las pausas `hasta`)."""
    codigo = ("global.window={};require('vm').runInThisContext(require('fs').readFileSync(process.argv[1],'utf8'));"
              "console.log(JSON.stringify(window.RECORRIDO.puntos))")
    pts = json.loads(subprocess.run(['node', '-e', codigo, os.path.join(SITIO, 'recorrido.js')],
                                    check=True, capture_output=True, text=True).stdout)
    K = []
    for p in pts:
        K.append((seg(p['t']) if isinstance(p['t'], str) else p['t'], p['lng'], p['lat']))
        if p.get('hasta') is not None:
            h = p['hasta']
            K.append((seg(h) if isinstance(h, str) else h, p['lng'], p['lat']))
    return K


def caminante(K, t):
    if t <= K[0][0]:
        return K[0][1:]
    for (ta, la, aa), (tb, lb, ab) in zip(K, K[1:]):
        if t <= tb:
            f = (t - ta) / (tb - ta) if tb > ta else 0
            return la + (lb - la) * f, aa + (ab - aa) * f
    return K[-1][1:]


def tiempo_en(vereda, lng):
    """Segundo del video en que se filmó la longitud lng de esa vereda."""
    A = [(seg(t), l) for t, v, l in ANCLAJES if v == vereda]
    for (ta, la), (tb, lb) in zip(A, A[1:]):
        if min(la, lb) <= lng <= max(la, lb):
            return ta if la == lb else ta + (tb - ta) * (lng - la) / (lb - la)
    return min(A, key=lambda a: abs(a[1] - lng))[0]


def tiempo_video(lng, lat):
    f = (lat_eje(lng) + SEP - lat) / (2 * SEP)   # 0 en la línea de la vereda norte, 1 en la de la sur
    if f <= 0.05:
        return tiempo_en('norte', lng)
    if f >= 0.95:
        return tiempo_en('sur', lng)
    # cruzando la Calle 8: el cruce del video, de su último anclaje en la norte al primero en la sur
    tn = max(seg(t) for t, v, _ in ANCLAJES if v == 'norte')
    ts = min(seg(t) for t, v, _ in ANCLAJES if v == 'sur')
    return tn + (ts - tn) * f


def pelicula(video):
    audio = os.path.join(SITIO, '..', 'audio', 'deriva_calle_8.m4a')
    K = puntos_recorrido()
    if os.path.exists(audio):
        dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', audio],
                                   check=True, capture_output=True, text=True).stdout)
    else:
        dur = K[-1][0] + 10
    n = math.ceil(dur * FPS_PELICULA)
    fuente = np.array([round(tiempo_video(*caminante(K, k / FPS_PELICULA)) * 30) for k in range(n)])
    fuente = np.maximum.accumulate(fuente)   # el caminante nunca vuelve atrás en el video
    print(f'película: {n} cuadros ({dur:.1f} s), video de {fuente[0] / 30:.1f} s a {fuente[-1] / 30:.1f} s', file=sys.stderr)

    w, h = PX_PELICULA
    filtro = f'fps=30,crop=iw:iw*4/3:0:ih*0.10,scale={w}:{h}'
    dec = subprocess.Popen(['ffmpeg', '-v', 'error', '-hwaccel', 'videotoolbox', '-i', video, '-vf', filtro,
                            '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
    enc = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{w}x{h}',
                            '-r', str(FPS_PELICULA), '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '33',
                            '-g', str(FPS_PELICULA * 2), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an',
                            PELICULA], stdin=subprocess.PIPE)
    tam = w * h * 3
    i, actual = -1, None
    for s in fuente:
        while i < s:
            b = dec.stdout.read(tam)
            if len(b) < tam:
                break   # se terminó el video: queda el último cuadro
            actual, i = b, i + 1
        enc.stdin.write(actual)
    enc.stdin.close()
    enc.wait()
    dec.kill()
    print(f'{PELICULA}: {os.path.getsize(PELICULA) / 1e6:.1f} MB', file=sys.stderr)



# ── franja continua (barrido) ──
TIRA = os.path.join(SITIO, 'video', 'tira.webp')
TIRA_ANCHO, TIRA_FILAS, TIRA_ALTO = 4096, 8, 448   # la tira se corta en filas de TIRA_ANCHO px (máx. 4096 en celulares)
RENDIJA = 0.78                                      # columna del frame (fracción del ancho) que cae sobre la fachada
RECORTE = (0.0, 0.85)                               # filas del frame que entran (sin la vereda pegada a los pies)
PX_DEC = (540, 960)


def medidas_tira():
    largos = {v: (l1 - l0) * KX for v, (l0, l1) in VEREDAS.items()}
    pxm = math.floor(TIRA_ANCHO * TIRA_FILAS / sum(largos.values()) * 10) / 10
    return pxm, {v: int(largos[v] * pxm) for v in largos}


def tira(video):
    pxm, cols = medidas_tira()
    tareas = collections.defaultdict(list)   # frame (a 30 fps) → columnas que salen de él
    for v in ('norte', 'sur'):
        for c in range(cols[v]):
            t = tiempo_en(v, VEREDAS[v][0] + (c + 0.5) / pxm / KX)
            tareas[round(t * 30)].append((v, c))
    franja = {v: np.zeros((TIRA_ALTO, cols[v], 3), np.uint8) for v in cols}
    W, H = PX_DEC
    y0, y1 = int(H * RECORTE[0]), int(H * RECORTE[1])
    ultimo = max(tareas)
    proc = subprocess.Popen(['ffmpeg', '-v', 'error', '-hwaccel', 'videotoolbox', '-i', video, '-vf',
                             f'fps=30,scale={W}:{H}', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
                            stdout=subprocess.PIPE)
    k = 0
    while k <= ultimo:
        buf = proc.stdout.read(W * H * 3)
        if len(buf) < W * H * 3:
            break
        if k in tareas:
            fr = np.frombuffer(buf, np.uint8).reshape(H, W, 3)
            for v in cols:
                cs = sorted(c for vv, c in tareas[k] if vv == v)
                if not cs:
                    continue
                g = len(cs)
                w = min(g, 60)
                x = int(W * RENDIJA) - w // 2
                tajada = Image.fromarray(np.ascontiguousarray(fr[y0:y1, x:x + w])).resize((g, TIRA_ALTO), Image.LANCZOS)
                a = np.asarray(tajada)
                # en el frame la derecha es lo más cercano: más al este en la norte, más al oeste en la sur
                if v == 'sur':
                    a = a[:, ::-1]
                franja[v][:, cs] = a
        k += 1
        if k % 3000 == 0:
            print(f'  {k}/{ultimo} frames', file=sys.stderr)
    proc.stdout.close(); proc.wait()
    todo = np.concatenate([franja['norte'], franja['sur']], axis=1)
    lienzo = np.zeros((TIRA_ALTO * TIRA_FILAS, TIRA_ANCHO, 3), np.uint8)
    for f in range(TIRA_FILAS):
        trozo = todo[:, f * TIRA_ANCHO:(f + 1) * TIRA_ANCHO]
        lienzo[f * TIRA_ALTO:(f + 1) * TIRA_ALTO, :trozo.shape[1]] = trozo
    Image.fromarray(lienzo).save(TIRA, quality=74, method=6)
    print(f'tira {TIRA_ANCHO}×{TIRA_ALTO * TIRA_FILAS}: {pxm} px/m, norte {cols["norte"]} y sur {cols["sur"]} columnas',
          file=sys.stderr)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('video', nargs='?', default=os.path.expanduser('~/Downloads/recorrido_calle_8.MOV'))
    ap.add_argument('--cache', default=os.path.join(tempfile.gettempdir(), 'paredes-video-cuadros'))
    ap.add_argument('--hoja', help='guarda además una vista del atlas con los tiempos, para revisarlo')
    ap.add_argument('--pelicula', action='store_true', help='arma también la película del modo video')
    ap.add_argument('--tira', action='store_true', help='arma también la franja continua (barrido)')
    a = ap.parse_args()
    if a.tira:
        os.makedirs(os.path.dirname(TIRA), exist_ok=True)
        tira(a.video)
    if a.pelicula:
        os.makedirs(os.path.dirname(PELICULA), exist_ok=True)
        pelicula(a.video)

    extraer(a.video, a.cache)
    archivos = sorted(f for f in os.listdir(a.cache) if f.endswith('.jpg'))
    descartes = [(seg(x), seg(y)) for x, y in DESCARTAR]
    frames = []   # (t, vereda, x en metros desde el inicio de su vereda, nitidez, archivo)
    for k, f in enumerate(archivos):
        t = (k + 0.5) / FPS
        p = posicion(t)
        if not p or any(x <= t <= y for x, y in descartes):
            continue
        v, lng = p
        frames.append((t, v, (lng - VEREDAS[v][0]) * KX, None, f))
    print(f'{len(archivos)} frames extraídos, {len(frames)} ubicados en una vereda', file=sys.stderr)

    nit = {}
    def puntaje(f):
        if f not in nit:
            nit[f] = nitidez(Image.open(os.path.join(a.cache, f)))
        return nit[f]

    cuadros = {}
    usados = set()
    for v, (l0, l1) in VEREDAS.items():
        n = math.ceil((l1 - l0) * KX / ANCHO)
        lista = []
        for i in range(n):
            c = (i + 0.5) * ANCHO
            elegido = None
            for radio in (ANCHO * 0.75, 6.0, 10.0):
                cand = [fr for fr in frames if fr[1] == v and abs(fr[2] - c) <= radio and fr[4] not in usados]
                if cand:
                    elegido = max(cand, key=lambda fr: puntaje(fr[4]))
                    break
            if elegido:
                usados.add(elegido[4])
            lista.append(elegido)
        cuadros[v] = lista

    total = sum(len(l) for l in cuadros.values())
    filas = math.ceil(total / COLUMNAS)
    atlas = Image.new('RGBA', (COLUMNAS * PX[0], filas * PX[1]), (0, 0, 0, 0))
    hoja = Image.new('RGB', atlas.size, (40, 40, 40)) if a.hoja else None
    k = 0
    for v in ('norte', 'sur'):
        for fr in cuadros[v]:
            x, y = (k % COLUMNAS) * PX[0], (k // COLUMNAS) * PX[1]
            if fr:
                im = Image.open(os.path.join(a.cache, fr[4])).convert('RGB').resize(PX, Image.LANCZOS)
                atlas.paste(im, (x, y))
                if hoja:
                    hoja.paste(im, (x, y))
                    t = int(fr[0])
                    ImageDraw.Draw(hoja).text((x + 4, y + 4), f'{v[0]}{k} {t // 60}:{t % 60:02d}', fill='yellow')
            k += 1

    os.makedirs(os.path.join(SITIO, 'video'), exist_ok=True)
    atlas.save(os.path.join(SITIO, 'video', 'paredes.webp'), quality=72, method=6)
    if hoja:
        hoja.save(a.hoja, quality=80)

    datos = {
        'atlas': 'video/paredes.webp',
        'columnas': COLUMNAS, 'filas': filas, 'ancho': ANCHO, 'alto': ALTO,
        'eje': EJE,
        'norte': {'desde': VEREDAS['norte'][0], 'cuadros': len(cuadros['norte'])},
        'sur': {'desde': VEREDAS['sur'][0], 'cuadros': len(cuadros['sur'])},
        'opacidad': 0.9,
        # modo video: la película va con el tiempo del audio (ver --pelicula)
        **({'pelicula': 'video/deriva.mp4'} if os.path.exists(PELICULA) else {}),
        # franja continua: columnas de 1/pxm m de oeste a este desde `desde`, primero la norte y después la sur,
        # cortadas en filas de `ancho` px
        **({'tira': dict(zip(('pxm', 'columnas'), medidas_tira())) | {
            'imagen': 'video/tira.webp', 'ancho': TIRA_ANCHO, 'alto': TIRA_ALTO, 'filas': TIRA_FILAS}}
           if os.path.exists(TIRA) else {}),
        'tiempos': {v: [round(fr[0], 1) if fr else None for fr in cuadros[v]] for v in cuadros},
    }
    with open(os.path.join(SITIO, 'paredes-video.js'), 'w') as f:
        f.write('// Se genera con scripts/paredes-video.py: no editar a mano.\n')
        f.write('// Frames del video de la caminata pegados en las fachadas de la Calle 8 (ver ciudad.js → PAREDES).\n')
        f.write('// atlas: cuadros de `ancho` × `alto` m, primero los de la vereda norte y después los de la sur, de oeste a\n')
        f.write('// este desde `desde` (longitud). tiempos: segundo del video de cada cuadro (null = sin frame).\n')
        f.write('window.PAREDES_VIDEO = ' + json.dumps(datos, ensure_ascii=False) + ';\n')
    vacios = sum(1 for l in cuadros.values() for fr in l if not fr)
    print(f'atlas {atlas.size[0]}×{atlas.size[1]}: {total} cuadros ({vacios} vacíos)', file=sys.stderr)


if __name__ == '__main__':
    main()

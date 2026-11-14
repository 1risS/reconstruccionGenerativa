#!/usr/bin/env python3
"""Genera versiones procesadas de los WAV maestros (../audios) SIN modificarlos.

Salida: ../audios/versiones/<nombre>/<nombre>__<version>.wav  (float 32-bit, 44.1 kHz, estéreo)

Versiones
  Separación por IA (Demucs htdemucs_ft):
    voces         voces aisladas
    voces_limpias voces + filtro 90 Hz–9 kHz + reducción de ruido
    percusivo     golpes / transitorios (fichas de dominó, pasos, palmas, batería)
    ambiente      todo lo no vocal ni percusivo (tráfico, música armónica, aire, bajo)
    sin_voces     original menos voces (percusivo + ambiente)
  Bandas de frecuencia (filtros de fase lineal, suman el original):
    banda_1_graves        20–200 Hz    (motores, retumbe, bajo)
    banda_2_medios_bajos  200–1000 Hz  (cuerpo de voces e instrumentos)
    banda_3_medios_altos  1–4 kHz      (inteligibilidad de voz, pájaros)
    banda_4_agudos        4–20 kHz     (aire, sibilancias, chirridos, platillos)
  Limpieza:
    limpio        original con reducción de ruido de fondo constante (zumbido, viento, hiss)

Requisitos: pip install "torch<2.9" "torchaudio<2.9" demucs soundfile numpy scipy noisereduce
Uso: python scripts/versiones-audios.py [archivo.WAV ...]
"""
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
import torch
import noisereduce as nr
from scipy.signal import butter, sosfiltfilt
from demucs.pretrained import get_model
from demucs.apply import apply_model

RAIZ = Path(__file__).resolve().parent.parent
SRC = RAIZ.parent / "audios"
DST = SRC / "versiones"
BANDAS = [
    ("banda_1_graves", None, 200),
    ("banda_2_medios_bajos", 200, 1000),
    ("banda_3_medios_altos", 1000, 4000),
    ("banda_4_agudos", 4000, None),
]


def filtro(x, sr, lo=None, hi=None, orden=4):
    """Filtro Butterworth de fase cero (ida y vuelta). x: (canales, muestras)."""
    if lo and hi:
        sos = butter(orden, [lo, hi], btype="band", fs=sr, output="sos")
    elif lo:
        sos = butter(orden, lo, btype="high", fs=sr, output="sos")
    else:
        sos = butter(orden, hi, btype="low", fs=sr, output="sos")
    return sosfiltfilt(sos, x, axis=-1)


def bandas_complementarias(x, sr):
    """Divide en bandas que suman exactamente el original (resta en cascada)."""
    resto = x.copy()
    out = []
    for nombre, _, hi in BANDAS[:-1]:
        b = filtro(resto, sr, hi=hi)
        out.append((nombre, b))
        resto = resto - b
    out.append((BANDAS[-1][0], resto))
    return out


def reducir_ruido(x, sr, cuanto=0.85):
    return nr.reduce_noise(y=x, sr=sr, stationary=True, prop_decrease=cuanto, n_fft=2048)


def guardar(carpeta, base, version, x, sr, informe):
    # Float 32-bit como los originales: admite picos > 0 dBFS (varios WAV los tienen),
    # así que no se reescala nada y todas las versiones conservan el nivel del original.
    pico = float(np.max(np.abs(x)))
    rms_db = 20 * np.log10(np.sqrt(np.mean(x**2)) + 1e-12)
    informe.append(f"  {version:<22} RMS {rms_db:6.1f} dBFS   pico {20*np.log10(pico+1e-12):6.1f} dBFS")
    sf.write(carpeta / f"{base}__{version}.wav", x.T.astype(np.float32), sr, subtype="FLOAT")


def main():
    archivos = [Path(a) for a in sys.argv[1:]] or sorted(SRC.glob("*.[wW][aA][vV]"))
    dispositivo = "cpu"  # htdemucs falla en MPS (conv1d > 65536 canales)
    modelo = get_model("htdemucs_ft")
    modelo.eval()
    fuentes = modelo.sources  # ['drums', 'bass', 'other', 'vocals']
    resumen = []

    for f in archivos:
        base = f.stem.lower()
        carpeta = DST / base
        carpeta.mkdir(parents=True, exist_ok=True)
        x, sr = sf.read(f, dtype="float32", always_2d=True)
        x = x.T  # (canales, muestras)
        assert sr == modelo.samplerate, f"{f.name}: se esperaba {modelo.samplerate} Hz"
        print(f"→ {f.name} ({x.shape[1]/sr:.0f} s) en {dispositivo}", flush=True)
        informe = [f"{f.name}"]

        # --- Separación ---
        t = torch.from_numpy(x)
        ref = t.mean(0)
        media, desv = ref.mean(), ref.std() + 1e-8
        with torch.no_grad():
            st = apply_model(modelo, ((t - media) / desv)[None], device=dispositivo,
                             shifts=1, split=True, overlap=0.25, progress=False)[0]
        st = (st * desv + media).cpu().numpy().astype(np.float64)
        s = {n: st[i] for i, n in enumerate(fuentes)}
        voces = s["vocals"]
        percusivo = s["drums"]
        ambiente = s["other"] + s["bass"]
        sin_voces = x - voces

        guardar(carpeta, base, "voces", voces, sr, informe)
        vl = filtro(voces, sr, lo=90, hi=9000)
        vl = reducir_ruido(vl, sr, 0.9)
        guardar(carpeta, base, "voces_limpias", vl, sr, informe)
        guardar(carpeta, base, "percusivo", percusivo, sr, informe)
        guardar(carpeta, base, "ambiente", ambiente, sr, informe)
        guardar(carpeta, base, "sin_voces", sin_voces, sr, informe)

        # --- Bandas ---
        for nombre, b in bandas_complementarias(x.astype(np.float64), sr):
            guardar(carpeta, base, nombre, b, sr, informe)

        # --- Limpieza general ---
        guardar(carpeta, base, "limpio", reducir_ruido(x.astype(np.float64), sr, 0.8), sr, informe)

        # Presencia de voz: energía de la pista de voces respecto del total
        e = lambda a: float(np.mean(a**2))
        pv = 100 * e(voces) / (e(x) + 1e-12)
        informe.append(f"  → energía en voces: {pv:.1f}% del total")
        resumen.extend(informe)
        print("\n".join(informe), flush=True)

    actualizar_informe(resumen)


def actualizar_informe(lineas_nuevas):
    """Reemplaza en informe.txt sólo los bloques de los archivos procesados y conserva el resto."""
    def bloques(lineas):
        out, actual = {}, None
        for l in lineas:
            if l and not l.startswith(" "):
                actual = l
                out[actual] = [l]
            elif actual:
                out[actual].append(l)
        return out

    ruta = DST / "informe.txt"
    previo = bloques(ruta.read_text().splitlines()) if ruta.exists() else {}
    previo.update(bloques(lineas_nuevas))
    texto = "\n".join(l for k in sorted(previo, key=str.lower) for l in previo[k])
    ruta.write_text(texto + "\n")


if __name__ == "__main__":
    main()

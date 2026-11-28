#!/usr/bin/env python3
"""Clasifica un audio por tramos con un modelo de AudioSet: base para escribir los descriptores de `sonidos`
en site/deriva-3d/recorrido.js (lo que se oye: pájaros, salsa, colectivos, bocinas…).

Imprime, cada 5 s, el tiempo, el nivel (dB RMS) y las 6 etiquetas más probables. No escribe los textos: se
redactan a mano cruzando esto con los lugares que marcó la artista (carga-puntos/). Transcribir las voces con
Whisper no sirvió: con el ruido de la calle inventa frases.

Necesita `transformers` además de torch (el .venv del proyecto ya tiene torch):
    .venv/bin/pip install transformers
    .venv/bin/python scripts/descriptores-audio.py ../audios/deriva_calle_8.WAV > clases.txt
La primera vez baja el modelo MIT/ast-finetuned-audioset-10-10-0.4593 de HuggingFace (~350 MB).
"""
import subprocess
import sys

import numpy as np
import torch
from transformers import ASTFeatureExtractor, ASTForAudioClassification

MODELO = 'MIT/ast-finetuned-audioset-10-10-0.4593'
SR, TRAMO = 16000, 5   # el modelo trabaja a 16 kHz; tramos de 5 s

crudo = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', sys.argv[1], '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                       capture_output=True, check=True).stdout
audio = np.frombuffer(crudo, np.float32).copy()
extractor = ASTFeatureExtractor.from_pretrained(MODELO)
modelo = ASTForAudioClassification.from_pretrained(MODELO).eval()

for i in range(0, len(audio) - SR, TRAMO * SR):
    tramo = audio[i:i + TRAMO * SR]
    with torch.no_grad():
        p = torch.sigmoid(modelo(**extractor(tramo, sampling_rate=SR, return_tensors='pt')).logits)[0]
    mejores = torch.topk(p, 6)
    t = i / SR
    db = 20 * np.log10(np.sqrt(np.mean(tramo ** 2)) + 1e-9)
    etiquetas = ' | '.join(f'{modelo.config.id2label[int(j)]} {float(v):.2f}' for v, j in zip(mejores.values, mejores.indices))
    print(f'{int(t // 60)}:{t % 60:04.1f} {db:5.1f}dB  {etiquetas}', flush=True)

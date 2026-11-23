#!/usr/bin/env python3
"""Exporta las sesiones de Claude Code de este proyecto a conversaciones/*.md y rearma el índice (README.md).

Sólo los mensajes de texto (sin salidas de herramientas, pensamiento ni imágenes) y con los emails reemplazados
por [email]. Reescribe todas las sesiones, así que correrlo de nuevo actualiza las que siguieron.

    python3 conversaciones/exportar.py
"""
import json
import re
import sys
from datetime import datetime
from pathlib import Path

AQUI = Path(__file__).resolve().parent
SESIONES = Path.home() / '.claude/projects' / re.sub(r'[^A-Za-z0-9]', '-', str(AQUI.parent))
EMAIL = re.compile(r'[\w.+-]+@[\w-]+\.[\w.-]+')
RUIDO = ('<system-reminder>', '<ide_', '<command-', '<local-command', '<task-notification')
PEGADO = re.compile(r'</?pasted_content[^>]*>')


def hora_local(ts):
    return datetime.fromisoformat(ts.replace('Z', '+00:00'))  # UTC, como la primera exportación


def texto_usuario(contenido):
    if isinstance(contenido, str):
        partes = [contenido]
    else:
        partes = []
        for b in contenido:
            if b.get('type') == 'image':
                partes.append('*[imagen adjunta]*')
            elif b.get('type') == 'text':
                partes.append(b['text'])
            else:
                return None  # tool_result: no es un mensaje de la usuaria
    partes = [PEGADO.sub('', p).strip() for p in partes if p.strip() and not p.lstrip().startswith(RUIDO)]
    return '\n\n'.join(partes) or None


def mensajes(archivo):
    for linea in archivo.open():
        d = json.loads(linea)
        if d.get('type') not in ('user', 'assistant') or d.get('isSidechain') or d.get('isMeta'):
            continue
        if d.get('isCompactSummary') or d.get('isVisibleInTranscriptOnly'):
            continue
        m = d.get('message') or {}
        if d['type'] == 'user':
            t = texto_usuario(m.get('content', ''))
            quien = 'Iris'
        else:
            bloques = m.get('content') or []
            t = '\n\n'.join(b['text'].strip() for b in bloques if b.get('type') == 'text' and b['text'].strip()) or None
            quien = 'Claude'
        if t and t != 'No response requested.':
            yield quien, hora_local(d['timestamp']), EMAIL.sub('[email]', t)


filas = []
for archivo in sorted(SESIONES.glob('*.jsonl')):
    ms = list(mensajes(archivo))
    if not any(q == 'Iris' for q, _, _ in ms):
        continue
    corto = archivo.stem[:8]
    primero = next(t for q, _, t in ms if q == 'Iris')
    titulo = re.sub(r'\s+', ' ', primero)[:90]
    fecha = ms[0][1].strftime('%Y-%m-%d')
    nombre = f'{fecha}_{corto}.md'
    cuerpo = [f'# {titulo}\n\nSesión de Claude Code · {fecha} · `{corto}`\n\n---\n']
    for quien, cuando, t in ms:
        cuerpo.append(f'**{quien}** · {cuando:%H:%M}\n\n{t}\n\n---\n')
    (AQUI / nombre).write_text('\n'.join(cuerpo).removesuffix('---\n'))
    filas.append((fecha, corto, nombre, titulo.replace('|', '\\|'), len(ms)))

filas.sort()
indice = ['# Conversaciones con Claude Code\n',
          'Exportadas de las sesiones de este proyecto: sólo los mensajes (sin las salidas de las herramientas ni las '
          'imágenes) y con los emails reemplazados por [email]. Para actualizarlas: `python3 conversaciones/exportar.py`.\n',
          '| Fecha | Sesión | Empieza con | Mensajes |', '|---|---|---|---|']
indice += [f'| {f} | [{c}]({n}) | {t} | {k} |' for f, c, n, t, k in filas]
(AQUI / 'README.md').write_text('\n'.join(indice) + '\n')
print(f'{len(filas)} sesiones exportadas', file=sys.stderr)

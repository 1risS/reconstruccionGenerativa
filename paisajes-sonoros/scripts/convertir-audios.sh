#!/usr/bin/env bash
# Convierte los WAV maestros (../audios) a AAC .m4a livianos para web.
# Uso: ./scripts/convertir-audios.sh [bitrate]   (por defecto 160k)
set -euo pipefail
cd "$(dirname "$0")/.."
SRC="../audios"
DST="site/audio"
BR="${1:-160k}"
mkdir -p "$DST"
shopt -s nullglob nocaseglob
for f in "$SRC"/*.wav; do
  name="$(basename "${f%.*}" | tr '[:upper:]' '[:lower:]')"
  out="$DST/$name.m4a"
  if [[ -f "$out" && "$out" -nt "$f" ]]; then echo "= $name (al día)"; continue; fi
  echo "→ $name"
  ffmpeg -hide_banner -loglevel error -y -i "$f" -c:a aac -b:a "$BR" -ar 44100 -movflags +faststart "$out"
done
ls -lh "$DST"

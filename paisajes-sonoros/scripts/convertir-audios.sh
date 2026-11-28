#!/usr/bin/env bash
# Convierte los WAV maestros (../audios) a AAC .m4a livianos para web, con un fundido de entrada y otro de salida
# (los cortes de los WAV sonaban duros). Los fundidos van en el archivo y no en el reproductor porque Safari en iOS
# no deja cambiar el volumen de un <audio> desde JavaScript.
# Uso: ./scripts/convertir-audios.sh [bitrate]   (por defecto 160k)
set -euo pipefail
cd "$(dirname "$0")/.."
SRC="../audios"
DST="site/audio"
BR="${1:-160k}"
ENTRA=3    # segundos del fundido de entrada
SALE=5     # segundos del fundido de salida
mkdir -p "$DST"
# si cambian los fundidos o el bitrate, se vuelven a convertir todos
SELLO="$DST/.conversion"
CONF="br=$BR entra=$ENTRA sale=$SALE"
TODOS=0
[[ -f "$SELLO" && "$(cat "$SELLO")" == "$CONF" ]] || TODOS=1
shopt -s nullglob nocaseglob
for f in "$SRC"/*.wav; do
  name="$(basename "${f%.*}" | tr '[:upper:]' '[:lower:]')"
  out="$DST/$name.m4a"
  if [[ $TODOS == 0 && -f "$out" && "$out" -nt "$f" ]]; then echo "= $name (al día)"; continue; fi
  echo "→ $name"
  dur="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")"
  desde="$(awk -v d="$dur" -v s="$SALE" 'BEGIN { x = d - s; if (x < 0) x = 0; print x }')"
  ffmpeg -hide_banner -loglevel error -y -i "$f" \
    -af "afade=t=in:st=0:d=$ENTRA:curve=qsin,afade=t=out:st=$desde:d=$SALE:curve=qsin" \
    -c:a aac -b:a "$BR" -ar 44100 -movflags +faststart "$out"
done
echo "$CONF" > "$SELLO"
ls -lh "$DST"

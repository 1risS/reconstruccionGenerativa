#!/bin/sh
# Genera las dos versiones (fondo blanco y fondo color) y las exporta con Chrome:
# PDF vectorial a tamaño real (60 × 80 cm) y una vista previa PNG de cada una.
set -e
cd "$(dirname "$0")"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for v in blanco color; do
  python3 generar.py $v
  "$CHROME" --headless=new --disable-gpu --no-pdf-header-footer --virtual-time-budget=8000 \
    --print-to-pdf="$PWD/recorridos-60x80-$v.pdf" "file://$PWD/recorridos-$v.html" 2>/dev/null
  # vista previa: 600 mm = 2268 px CSS; escala 0,5 → 1134 × 1512
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=8000 \
    --window-size=2268,3024 --force-device-scale-factor=0.5 \
    --screenshot="$PWD/vista-previa-$v.png" "file://$PWD/recorridos-$v.html" 2>/dev/null
done
echo "listo: recorridos-60x80-blanco.pdf, recorridos-60x80-color.pdf y sus vistas previas"

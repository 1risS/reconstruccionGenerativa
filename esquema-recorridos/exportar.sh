#!/bin/sh
# Genera los dos esquemas (recorridos y dioramas), cada uno con fondo blanco y con fondo color, y los exporta
# con Chrome: PDF vectorial a tamaño real (60 × 80 cm) y una vista previa PNG de cada uno.
set -e
cd "$(dirname "$0")"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for esquema in recorridos dioramas; do
  script=generar.py
  [ "$esquema" = dioramas ] && script=generar-dioramas.py
  for v in blanco color; do
    python3 $script $v
    "$CHROME" --headless=new --disable-gpu --no-pdf-header-footer --virtual-time-budget=8000 \
      --print-to-pdf="$PWD/$esquema-60x80-$v.pdf" "file://$PWD/$esquema-$v.html" 2>/dev/null
    # vista previa: 600 mm = 2268 px CSS; escala 0,5 → 1134 × 1512
    "$CHROME" --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=8000 \
      --window-size=2268,3024 --force-device-scale-factor=0.5 \
      --screenshot="$PWD/vista-previa-$esquema-$v.png" "file://$PWD/$esquema-$v.html" 2>/dev/null
  done
done
echo "listo"

#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"

if /bin/bash "$DIR/detener_sistema.sh"; then
  echo ""
  echo "Sistema detenido correctamente."
else
  echo ""
  echo "Hubo un error al detener el sistema."
fi

echo ""
read -r -n 1 -s -p "Presiona una tecla para cerrar..."
echo ""

#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  fix_phones.sh
#  Uso:  bash fix_phones.sh          → prefijo +598 (por defecto)
#        bash fix_phones.sh +54      → prefijo personalizado
# ─────────────────────────────────────────────────────────────
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PREFIX="${1:-+598}"

# Verificar que node esté disponible
if ! command -v node &>/dev/null; then
  echo "❌  Node.js no encontrado. Instalalo y volvé a intentar."
  exit 1
fi

# Verificar que el módulo pg esté instalado
if [ ! -d "$SCRIPT_DIR/node_modules/pg" ]; then
  echo "📦  Instalando dependencia 'pg'..."
  cd "$SCRIPT_DIR" && npm install pg --no-save
fi

node "$SCRIPT_DIR/fix_phones.mjs" "$PREFIX"

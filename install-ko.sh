#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

CMD="${1:-install}"
shift || true

find_runtime() {
  if [ -x "/Applications/Antigravity.app/Contents/MacOS/Antigravity" ]; then
    echo "/Applications/Antigravity.app/Contents/MacOS/Antigravity"
    return
  fi
  if [ -x "$HOME/Applications/Antigravity.app/Contents/MacOS/Antigravity" ]; then
    echo "$HOME/Applications/Antigravity.app/Contents/MacOS/Antigravity"
    return
  fi
  if [ -x "/opt/Antigravity/antigravity" ]; then
    echo "/opt/Antigravity/antigravity"
    return
  fi
  if command -v node >/dev/null 2>&1; then
    command -v node
    return
  fi
  echo ""
}

RUNTIME="$(find_runtime)"
if [ -z "$RUNTIME" ]; then
  echo "[오류] Antigravity 실행 파일 또는 Node.js를 찾을 수 없습니다."
  exit 1
fi

export ELECTRON_RUN_AS_NODE=1
"$RUNTIME" ./tools/patch.js "$CMD" "$@"

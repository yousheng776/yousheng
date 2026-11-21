#!/bin/bash
set -e
SRC="$(cd "$(dirname "$0")" && pwd)"
DEST="${DSH_HOME:-$HOME/.dsh}/skills/yousheng"
if [ "$SRC" = "$DEST" ]; then
  echo "已经在 $DEST，不用再装。"
  exit 0
fi
mkdir -p "$DEST"
cp -R "$SRC/." "$DEST/"
echo "已安装到 $DEST"
echo "如果 DSH 里还没出现 yousheng，重启一次 DSH。"

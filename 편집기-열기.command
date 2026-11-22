#!/bin/zsh
cd -- "$(dirname -- "$0")"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null 2>&1; then
  print "Node.js 22 이상이 필요합니다. https://nodejs.org 에서 설치해 주세요."
  read -k 1 "?종료하려면 아무 키나 누르세요."
  exit 1
fi
(sleep 2; open "http://127.0.0.1:4173/editor/") &
node scripts/dev.mjs

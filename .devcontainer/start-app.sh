#!/usr/bin/env bash
set -euo pipefail

# postStartCommand must return. A detached dev process provides the live preview.
if curl -fsS http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
  echo "Game Cloud already running at http://localhost:3000"
  exit 0
fi

nohup npm run dev >/tmp/game-cloud-dev.log 2>&1 </dev/null &
for attempt in $(seq 1 40); do
  if curl -fsS http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    echo "Game Cloud ready at http://localhost:3000"
    exit 0
  fi
  sleep 0.25
done

echo "Game Cloud did not start. See /tmp/game-cloud-dev.log" >&2
exit 1

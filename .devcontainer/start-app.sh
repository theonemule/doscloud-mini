#!/usr/bin/env bash
set -euo pipefail
# Devcontainer forwarded localhost is a secure browser context, even over HTTP.
if curl -fsS http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
  echo "DOSCloud Mini already running at http://localhost:3000"
  exit 0
fi
nohup npm run dev >/tmp/doscloud-mini-dev.log 2>&1 </dev/null &
for attempt in $(seq 1 50); do
  if curl -fsS http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    echo "DOSCloud Mini ready at http://localhost:3000"
    exit 0
  fi
  sleep 0.25
done
echo "DOSCloud Mini did not start. Check /tmp/doscloud-mini-dev.log" >&2
exit 1

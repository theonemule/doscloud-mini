#!/usr/bin/env bash
set -euo pipefail

# Explicit manual publishing of the original persistent C: drive to a Git remote.
# Do not use for guest room overlays, and verify redistribution permissions.
cd "$(dirname "$0")/.."
if ! git remote get-url origin >/dev/null 2>&1; then
  printf '%s\n' "No origin remote. Create/publish a GitHub repository first." >&2
  exit 1
fi

if [[ ${1:-} != "--confirm-distribution-rights" ]]; then
  cat >&2 <<'EOF'
Review every file you intend to publish. The target repository may be PUBLIC.
Only commit DOS games and assets that you have permission to redistribute.
Run: bash scripts/save-drive.sh --confirm-distribution-rights
EOF
  exit 2
fi

git add --all -- drive
if git diff --cached --quiet -- drive; then
  echo "No changed C: files to commit."
  exit 0
fi
echo "Staged DOS drive changes:"
git diff --cached --name-status -- drive
git commit -m "Update persistent DOS C drive"
git push origin HEAD:main
echo "Persistent C: changes published. Guest IPX clones were not included."

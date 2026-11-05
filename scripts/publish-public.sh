#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
target="theonemule/doscloud-mini"

if ! command -v gh >/dev/null 2>&1; then
  echo "Install the GitHub CLI (gh) first." >&2
  exit 1
fi
if ! gh auth status >/dev/null 2>&1; then
  echo "GitHub CLI authentication required. Run: gh auth login" >&2
  exit 2
fi
if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  echo "Commit source changes before publishing." >&2
  exit 3
fi

if gh repo view "$target" >/dev/null 2>&1; then
  visibility=$(gh repo view "$target" --json visibility --jq '.visibility')
  if [[ "$visibility" != "PUBLIC" ]]; then
    echo "Existing repository is $visibility, not PUBLIC. Stop to avoid using the wrong visibility." >&2
    exit 4
  fi
  echo "Existing public repository $target found. Checking origin..."
  if git remote get-url origin >/dev/null 2>&1; then
    remote=$(git remote get-url origin)
    if [[ "$remote" != "https://github.com/$target.git" && "$remote" != "git@github.com:$target.git" ]]; then
      echo "Origin points to an unexpected repository: $remote" >&2
      exit 5
    fi
  else
    git remote add origin "https://github.com/$target.git"
  fi
  git push -u origin main
else
  gh repo create "$target" --public --source=. --remote=origin --push
fi
echo "Repository: https://github.com/$target"

#!/usr/bin/env bash
# Copies the Claude project's shared folder into project/ so agents in any tool see the same
# board, progress logs, design handoffs, QA checklists and research. Run from the repo root.
# Links to the shared folder are rewritten to repo-root links (/project/...).
set -euo pipefail

src=${1:-/mnt/project-files}
dest=project

for dir in pm design qa research social; do
  [ -d "$src/$dir" ] || continue
  mkdir -p "$dest/$dir"
  find "$src/$dir" -name '*.md' | while read -r file; do
    rel=${file#"$src/"}
    mkdir -p "$dest/$(dirname "$rel")"
    sed -e "s|$src/security/|/docs/security/|g" -e "s|$src/|/project/|g" "$file" > "$dest/$rel"
  done
done

pnpm -s exec prettier --write "$dest" >/dev/null
echo "Synced $src into $dest/"

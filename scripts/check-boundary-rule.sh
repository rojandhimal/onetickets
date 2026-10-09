#!/usr/bin/env bash
# Proves the no-cross-module-internals rule still bites: a deep import into another
# api module must fail, and the same import through its index.ts must pass.
set -euo pipefail

probe_dir=apps/api/src/modules/__boundary_probe__
trap 'rm -rf "$probe_dir"' EXIT
mkdir -p "$probe_dir"

echo "import { HealthModule } from '../health/index.js';
export const ok = HealthModule;" > "$probe_dir/allowed.ts"
pnpm -s exec depcruise "$probe_dir" --config .dependency-cruiser.cjs >/dev/null

echo "import { HealthService } from '../health/health.service.js';
export const bad = HealthService;" > "$probe_dir/forbidden.ts"
if pnpm -s exec depcruise "$probe_dir" --config .dependency-cruiser.cjs >/dev/null; then
  echo "no-cross-module-internals did not catch a deep import into another module" >&2
  exit 1
fi
echo "Boundary rule OK: deep imports fail, index imports pass."

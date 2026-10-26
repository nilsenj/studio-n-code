#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"

if [[ "$(uname -s)" != Linux || "$(uname -m)" != x86_64 ]]; then
  echo "The Linux release builder currently requires x86_64 Linux." >&2
  exit 1
fi

if [[ ! -d upstream/.git ]]; then
  upstream_url="$(node -e 'console.log(JSON.parse(require("node:fs").readFileSync("upstream.lock.json", "utf8")).repository)')"
  upstream_tag="$(node -e 'console.log(JSON.parse(require("node:fs").readFileSync("upstream.lock.json", "utf8")).tag)')"
  git clone --depth 1 --branch "$upstream_tag" "$upstream_url" upstream
fi

node scripts/generate-manifest.mjs
node scripts/prepare.mjs

pushd upstream >/dev/null
npm ci
npm run build-fast
npm run electron
npm run download-builtin-extensions
npm run gulp vscode-linux-x64
popd >/dev/null

test -x VSCode-linux-x64/studio-n-code
echo "Linux application built in $project_root/VSCode-linux-x64"

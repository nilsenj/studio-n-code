#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"

bash ./scripts/build-linux.sh

version="$(node -p 'JSON.parse(require("node:fs").readFileSync("package.json", "utf8")).version')"
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[A-Za-z0-9.-]+)?$ ]] || { echo "Invalid release version: $version" >&2; exit 1; }
application="$project_root/VSCode-linux-x64"
[[ -x "$application/studio-n-code" ]] || { echo "Missing Linux executable in $application" >&2; exit 1; }

cp "$project_root/LICENSE" "$application/LICENSE.studio-n-code.txt"
cp "$project_root/NOTICE.md" "$application/NOTICE.studio-n-code.md"
cp "$project_root/assets/icon-256.png" "$application/studio-n-code.png"
mkdir -p "$project_root/dist"
archive="studio-n-code-$version-linux-x64.tar.gz"
tar -czf "$project_root/dist/$archive" -C "$application" .
cp "$project_root/scripts/install-linux.sh" "$project_root/dist/install-linux.sh"
chmod +x "$project_root/dist/install-linux.sh"
(cd "$project_root/dist" && sha256sum "$archive" install-linux.sh > SHA256SUMS-linux.txt)
echo "Linux release assets created in $project_root/dist"

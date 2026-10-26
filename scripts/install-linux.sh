#!/usr/bin/env bash
set -euo pipefail

repo="nilsenj/studio-n-code"
api="https://api.github.com/repos/$repo/releases?per_page=1"
download_base="https://github.com/$repo/releases/download"

die() { echo "studio-n-code installer: $*" >&2; exit 1; }

[[ "$(uname -s)" == Linux ]] || die "this installer supports Linux only."
[[ "$(uname -m)" == x86_64 ]] || die "the current Linux package supports x86_64 only."
command -v tar >/dev/null || die "install tar and try again."
command -v sha256sum >/dev/null || die "install coreutils (sha256sum) and try again."
command -v curl >/dev/null || command -v wget >/dev/null || die "install curl or wget and try again."
[[ -n "${HOME:-}" ]] || die "HOME is not set."

if command -v curl >/dev/null; then
  fetch() { curl --fail --location --silent --show-error "$1" --output "$2"; }
else
  fetch() { wget --quiet "$1" --output-document="$2"; }
fi

release_json="$(mktemp)"
fetch "$api" "$release_json" || die "could not find a published release at https://github.com/$repo/releases."
tag="$(sed -n 's/^[[:space:]]*"tag_name":[[:space:]]*"\([^"]*\)"[,]\{0,1\}$/\1/p' "$release_json" | head -n 1)"
rm -f "$release_json"
[[ "$tag" =~ ^v[0-9][A-Za-z0-9.+-]*$ ]] || die "could not read a valid release version."
version="${tag#v}"
archive_name="studio-n-code-$version-linux-x64.tar.gz"
checksum_name="SHA256SUMS-linux.txt"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

fetch "$download_base/$tag/$archive_name" "$tmp/$archive_name" || die "could not download the Linux package for $tag."
fetch "$download_base/$tag/$checksum_name" "$tmp/$checksum_name" || die "could not download the Linux package checksum."
expected="$(awk -v file="$archive_name" '$2 == file { print $1; exit }' "$tmp/$checksum_name")"
[[ "$expected" =~ ^[[:xdigit:]]{64}$ ]] || die "the release checksum file does not contain $archive_name."
actual="$(sha256sum "$tmp/$archive_name" | awk '{ print $1 }')"
[[ "$actual" == "$expected" ]] || die "the downloaded package failed SHA-256 verification."

mkdir "$tmp/extracted"
tar -xzf "$tmp/$archive_name" -C "$tmp/extracted"
[[ -x "$tmp/extracted/studio-n-code" ]] || die "the Linux package is missing its executable."

install_root="$HOME/.local/opt/studio-n-code"
install_dir="$install_root/$version"
bin_dir="$HOME/.local/bin"
mkdir -p "$install_root" "$bin_dir"
rm -rf "$install_dir"
mkdir -p "$install_dir"
cp -a "$tmp/extracted/." "$install_dir/"
ln -sfn "$install_dir" "$install_root/current"
ln -sfn "$install_root/current/studio-n-code" "$bin_dir/studio-n-code"

applications_dir="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
icons_dir="${XDG_DATA_HOME:-$HOME/.local/share}/icons/hicolor/256x256/apps"
mkdir -p "$applications_dir" "$icons_dir"
icon="$install_dir/studio-n-code.png"
if [[ ! -f "$icon" ]]; then
  icon="$(find "$install_dir" -type f \( -name 'code.png' -o -name 'studio-n-code.png' \) -print -quit)"
fi
[[ -n "$icon" ]] && cp "$icon" "$icons_dir/studio-n-code.png"

desktop_exec="$bin_dir/studio-n-code"
desktop_exec="$(printf '%s' "$desktop_exec" | sed 's/\\/\\\\/g; s/"/\\"/g')"
{
  echo '[Desktop Entry]'
  echo 'Type=Application'
  echo 'Name=studio-n-code'
  printf 'Exec="%s" %%F\n' "$desktop_exec"
  echo 'Icon=studio-n-code'
  echo 'Terminal=false'
  echo 'Categories=Development;IDE;TextEditor;'
  echo 'StartupWMClass=studio-n-code'
} > "$applications_dir/studio-n-code.desktop"

echo "Installed studio-n-code $version in $install_dir"
echo "Launch it from your applications menu or run: $bin_dir/studio-n-code"
case ":${PATH:-}:" in
  *":$bin_dir:"*) ;;
  *) echo "Add $bin_dir to PATH to run studio-n-code from a terminal." ;;
esac

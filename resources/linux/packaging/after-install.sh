#!/bin/bash
# Why: register the bundled `girra` CLI on PATH at package-install time.
# The in-app "Install CLI" action (CliInstaller) can never run on a headless
# server, so without this symlink `girra serve` is unreachable from the shell on
# the exact hosts that need it most. deb/rpm both run this after unpacking.
#
# The shim resolves the real app by walking up from its own location, so a
# symlink works. We discover the install dir instead of hardcoding /opt/Girra
# because electron-builder's directory name can vary by productName sanitization.
#
# Why two links: `girra` is the primary name, and `orca-ide` stays so hook
# scripts and SSH hosts written against the old name keep resolving.
set -e

install_dirs="/opt/Girra /opt/girra /opt/Orca /opt/orca-ide /opt/orca"

# Owned means the link already resolves into one of our install dirs; anything
# else is a command some other package or the user owns, and stays untouched.
is_owned_link() {
  local link="$1" target dir
  [ -L "$link" ] || return 1
  target="$(readlink -f -- "$link" 2>/dev/null || true)"
  for dir in $install_dirs; do
    case "$target" in "$dir"/*) return 0 ;; esac
  done
  return 1
}

link_shim() {
  local link="$1" shim="$2"
  [ -x "$shim" ] || return 0
  if { [ ! -e "$link" ] && [ ! -L "$link" ]; } || is_owned_link "$link"; then
    ln -sfn -- "$shim" "$link"
  fi
}

for dir in $install_dirs; do
  sandbox="$dir/chrome-sandbox"
  if [ -f "$sandbox" ]; then
    # Why: packaged Linux installs must leave Chromium's sandbox helper usable
    # on hosts where unprivileged user namespaces are unavailable.
    chmod 4755 "$sandbox" || true
  fi

  if [ -x "$dir/resources/bin/girra" ]; then
    link_shim /usr/bin/girra "$dir/resources/bin/girra"
    link_shim /usr/bin/orca-ide "$dir/resources/bin/orca-ide"
    break
  fi
done

exit 0

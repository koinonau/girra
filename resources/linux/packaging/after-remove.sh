#!/bin/bash
# Why: remove the PATH symlinks that after-install.sh created, but only if they
# still point into a Girra install dir — never delete an unrelated
# /usr/bin/girra or /usr/bin/orca-ide a user or other package may own.
set -e

# RPM passes an instance count; dpkg passes the package lifecycle action.
case "${1-}" in
  0 | remove | purge) ;;
  *) exit 0 ;;
esac

for link in /usr/bin/girra /usr/bin/orca-ide; do
  [ -L "$link" ] || continue
  target="$(readlink "$link" || true)"
  case "$target" in
    /opt/Girra/* | /opt/girra/* | /opt/Orca/* | /opt/orca-ide/* | /opt/orca/*)
      rm -f "$link"
      ;;
  esac
done

exit 0

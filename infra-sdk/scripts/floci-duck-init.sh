#!/bin/sh
set -eu

DUCKDB_VERSION="${DUCKDB_VERSION:-v1.5.2}"
ARCH="$(uname -m)"
case "$ARCH" in
  aarch64|arm64) PLATFORM=linux_arm64 ;;
  x86_64|amd64)  PLATFORM=linux_amd64 ;;
  *) echo "unsupported arch: $ARCH" >&2; exit 1 ;;
esac

EXT_PATH="/ext/${DUCKDB_VERSION}/${PLATFORM}/httpfs.duckdb_extension"

if [ -f "$EXT_PATH" ]; then
  echo "httpfs already cached at $EXT_PATH"
  exit 0
fi

mkdir -p "$(dirname "$EXT_PATH")"
apk add --no-cache wget >/dev/null
wget -qO /tmp/httpfs.gz "https://extensions.duckdb.org/${DUCKDB_VERSION}/${PLATFORM}/httpfs.duckdb_extension.gz"
gunzip -c /tmp/httpfs.gz > "$EXT_PATH"
echo "httpfs extension cached at $EXT_PATH"

#!/bin/sh
set -e

mkdir -p /tmp/sockets

chown node:node /tmp/sockets || true
chmod 0770 /tmp/sockets || true

exec su-exec node "$@"
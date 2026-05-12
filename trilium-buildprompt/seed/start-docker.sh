#!/bin/sh
# Wrapper around Trilium's own start-docker.sh. Runs the BuildPrompt seeder
# (idempotent — safe to call every boot), then hands off to Trilium as before.

[ ! -z "${USER_UID}" ] && usermod -u ${USER_UID} node || echo "No USER_UID specified, leaving 1000"
[ ! -z "${USER_GID}" ] && groupmod -og ${USER_GID} node || echo "No USER_GID specified, leaving 1000"

chown -R node:node /home/node

# Seed BuildPrompt note into the DB if applicable. Runs synchronously so it
# completes before Trilium opens the DB and builds its in-memory cache.
su -c "node /opt/buildprompt/seed.js" node || echo "[buildprompt-seed] seeder exited non-zero (ignored)"

exec su -c "node ./main.cjs" node

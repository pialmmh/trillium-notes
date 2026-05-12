# Wrapper image around triliumnext/notes that pre-seeds the "Build Prompt"
# code note on first compatible boot.
#
# Build:   docker build -t pialmmh/trilium-buildprompt:latest .
# Run:     see docker-compose.yml

ARG BASE_TAG=latest
FROM triliumnext/notes:${BASE_TAG}

USER root

# Drop our payload under /opt/buildprompt so it's outside the Trilium app tree.
RUN mkdir -p /opt/buildprompt
COPY seed/seed.js          /opt/buildprompt/seed.js
COPY seed/buildprompt.js   /opt/buildprompt/buildprompt.js

# Replace Trilium's own start-docker.sh with our wrapper. It runs the seeder
# first, then execs Trilium exactly as the base image would.
COPY seed/start-docker.sh  /usr/src/app/start-docker.sh
RUN chmod +x /usr/src/app/start-docker.sh /opt/buildprompt/seed.js

# Keep the base image's ENTRYPOINT + CMD as-is — docker-entrypoint.sh still
# delegates to sh ./start-docker.sh, which is now our wrapper.

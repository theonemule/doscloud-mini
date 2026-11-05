# Same Node 22 + Dockerfile pattern used in all five talk demos.
FROM mcr.microsoft.com/devcontainers/javascript-node:1-22-bookworm

USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends jq openssl \
    && rm -rf /var/lib/apt/lists/*

# Compose runtime can resolve server packages even if the bind mount is fresh.
COPY package.json package-lock.json /opt/doscloud-mini/
RUN cd /opt/doscloud-mini \
    && npm ci --omit=dev --no-audit --no-fund
ENV NODE_PATH=/opt/doscloud-mini/node_modules PORT=3000
USER node

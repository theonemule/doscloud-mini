# Tailored developer image — used locally, in Codespaces and on remote Docker.
FROM mcr.microsoft.com/devcontainers/javascript-node:1-22-bookworm

USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends jq \
    && rm -rf /var/lib/apt/lists/*

ENV PORT=3000
USER node

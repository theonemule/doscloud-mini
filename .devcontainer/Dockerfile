# Custom Dockerfile for the DOSCloud Mini Node.js application.
FROM mcr.microsoft.com/devcontainers/javascript-node:1-22-bookworm

# Preinstall runtime dependencies so the image also works with compose.yaml.
USER root
COPY package.json package-lock.json /opt/doscloud-mini/
RUN cd /opt/doscloud-mini && npm ci --omit=dev --no-audit --no-fund
ENV NODE_PATH=/opt/doscloud-mini/node_modules PORT=3000 HOST=0.0.0.0
USER node

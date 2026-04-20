# syntax=docker/dockerfile:1.7
FROM mcr.microsoft.com/devcontainers/base:bookworm

ARG DEBIAN_FRONTEND=noninteractive
ARG NODE_MAJOR=20

ENV CLAUDE_CONFIG_DIR=/home/vscode/.claude \
    CODEX_HOME=/home/vscode/.codex \
    GIT_CONFIG_GLOBAL=/usr/local/etc/devcontainer.gitconfig

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

RUN rm -f /etc/apt/sources.list.d/yarn.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates curl git gnupg jq less openssh-client procps ripgrep \
    && curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && mkdir -p /usr/local/share/npm-global \
    && npm config set prefix /usr/local/share/npm-global \
    && npm install -g @openai/codex @anthropic-ai/claude-code \
    && printf '[credential]\n    helper =\n' > /usr/local/etc/devcontainer.gitconfig \
    && touch /home/vscode/.gitconfig \
    && chown vscode:vscode /home/vscode/.gitconfig \
    && rm -rf /var/lib/apt/lists/*

# cloudflared — tunnel the companion's local port to a public *.trycloudflare.com URL
# so the PWA running on a phone can reach it. Pinned to the official Cloudflare
# release binary; no sudo/apt required by the user at runtime.
ARG CLOUDFLARED_VERSION=2024.9.1
RUN set -e; \
    arch="$(dpkg --print-architecture)"; \
    case "$arch" in \
      amd64) asset="cloudflared-linux-amd64" ;; \
      arm64) asset="cloudflared-linux-arm64" ;; \
      *) echo "unsupported arch: $arch" >&2; exit 1 ;; \
    esac; \
    curl -fsSL -o /usr/local/bin/cloudflared \
      "https://github.com/cloudflare/cloudflared/releases/download/${CLOUDFLARED_VERSION}/${asset}"; \
    chmod +x /usr/local/bin/cloudflared
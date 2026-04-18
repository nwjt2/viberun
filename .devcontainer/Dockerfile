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
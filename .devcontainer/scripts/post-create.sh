#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID}" -ne 0 ]; then
    exec sudo bash "$0" "$@"
fi

workspace="/workspaces/viberun"
target_user="vscode"
target_home="/home/${target_user}"

install -d -m 0700 -o "${target_user}" -g "${target_user}" \
    "${target_home}/.claude" \
    "${target_home}/.codex"

# Install dependencies into the mounted node_modules volume
if [ -f "${workspace}/package.json" ]; then
    cd "${workspace}"
    npm install
fi
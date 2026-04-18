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

# Set repo-local git identity so commits always use the GitHub noreply email.
# Runs as root, so scope the config to the target user.
sudo -u "${target_user}" git -C "${workspace}" config user.email "277266510+nwjt2@users.noreply.github.com"
sudo -u "${target_user}" git -C "${workspace}" config user.name "nwjt2"

# Install dependencies into the mounted node_modules volume
if [ -f "${workspace}/package-lock.json" ]; then
    cd "${workspace}"
    sudo -u "${target_user}" npm ci
elif [ -f "${workspace}/package.json" ]; then
    cd "${workspace}"
    sudo -u "${target_user}" npm install
fi
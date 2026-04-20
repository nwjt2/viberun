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
    "${target_home}/.codex" \
    "${target_home}/.ssh"

# Initialize a repo-scoped SSH deploy key on first run. The public key is
# printed so the user can paste it into GitHub's Deploy keys page.
key_path="${target_home}/.ssh/id_ed25519"
if [ ! -f "${key_path}" ]; then
    sudo -u "${target_user}" ssh-keygen -t ed25519 -N "" -C "viberun-devcontainer" -f "${key_path}" -q
    echo ""
    echo "=== SSH deploy key generated ==="
    echo "Add this public key at https://github.com/nwjt2/viberun/settings/keys"
    echo "(pick 'Add deploy key', tick 'Allow write access'):"
    echo ""
    cat "${key_path}.pub"
    echo ""
    echo "================================"
    echo ""
fi
# Pre-seed known_hosts with GitHub's SSH keys so connections don't prompt.
known_hosts="${target_home}/.ssh/known_hosts"
if ! sudo -u "${target_user}" grep -q "^github.com " "${known_hosts}" 2>/dev/null; then
    ssh-keyscan -t ed25519,ecdsa,rsa github.com 2>/dev/null >> "${known_hosts}"
    chown "${target_user}:${target_user}" "${known_hosts}"
    chmod 0644 "${known_hosts}"
fi

# Set repo-local git identity so commits always use the GitHub noreply email.
# Runs as root, so scope the config to the target user.
sudo -u "${target_user}" git -C "${workspace}" config user.email "277266510+nwjt2@users.noreply.github.com"
sudo -u "${target_user}" git -C "${workspace}" config user.name "nwjt2"

# Install dependencies into the mounted node_modules volume
# Ensure node_modules is owned by the target user (it may be created as root
# by Docker volume mount before this script runs).
install -d -m 0755 -o "${target_user}" -g "${target_user}" "${workspace}/node_modules"

if [ -f "${workspace}/package-lock.json" ]; then
    cd "${workspace}"
    sudo -u "${target_user}" npm ci
elif [ -f "${workspace}/package.json" ]; then
    cd "${workspace}"
    sudo -u "${target_user}" npm install
fi

# Ensure user-scoped ~/.local/bin exists and is on PATH so locally-installed
# binaries (e.g. an ad-hoc cloudflared download, pipx tools) work without
# sudo.
install -d -m 0755 -o "${target_user}" -g "${target_user}" "${target_home}/.local/bin"
bashrc="${target_home}/.bashrc"
if ! sudo -u "${target_user}" grep -qs '# viberun: local-bin on PATH' "${bashrc}"; then
    {
        printf '\n# viberun: local-bin on PATH\n'
        printf 'case ":$PATH:" in\n'
        printf '    *":$HOME/.local/bin:"*) ;;\n'
        printf '    *) export PATH="$HOME/.local/bin:$PATH" ;;\n'
        printf 'esac\n'
    } | sudo -u "${target_user}" tee -a "${bashrc}" >/dev/null
fi
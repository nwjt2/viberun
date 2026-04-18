# WSL Devcontainer Pattern

Reusable pattern for setting up a VS Code devcontainer for local AI-assisted development on Windows while minimizing host-file exposure.

## Goals

- run the repo from WSL, not from a Windows bind mount
- bind-mount only the project workspace
- avoid mounting the full host home directory
- keep Claude/Codex auth in Docker volumes, not on the host filesystem
- keep language/runtime artifacts off the workspace when possible
- make the container usable by both human tools and AI agents without extra activation steps

## High-Level Rules

1. Clone the repo into the WSL filesystem, e.g. `~/MyProject`.
2. Open the WSL clone in VS Code.
3. Reopen that WSL folder in a devcontainer.
4. Explicitly set `workspaceMount` so only the repo is bind-mounted.
5. Use named volumes for mutable tool state:
   - agent auth directories
   - `node_modules`
   - optional secondary repos or caches that should persist across rebuilds
6. Install the main toolchain in the image, not ad hoc in the workspace.
7. Put the real Python virtualenv at `/opt/venv` and add it to `PATH`.
8. Use `postCreateCommand` only for workspace-dependent init.
9. Do not rely on inherited host Git config or host credential helpers.
10. If secrets are needed, add an explicit narrow read-only mount. Do not mount the whole home directory.

## Recommended File Set

```text
.devcontainer/
|-- devcontainer.json
|-- Dockerfile
`-- scripts/
    `-- post-create.sh
```

Optional:

```text
.dockerignore
.claude/settings.json
```

## `devcontainer.json` Shape

Use an explicit workspace bind mount plus named volumes for mutable state.

```json
{
  "name": "MyProject",
  "build": {
    "dockerfile": "Dockerfile",
    "context": ".."
  },
  "workspaceMount": "source=${localWorkspaceFolder},target=/workspaces/MyProject,type=bind",
  "workspaceFolder": "/workspaces/MyProject",
  "mounts": [
    "type=volume,source=myproject-claude-home,target=/home/vscode/.claude",
    "type=volume,source=myproject-codex-home,target=/home/vscode/.codex",
    "type=volume,source=myproject-node-modules,target=/workspaces/MyProject/webapp/node_modules"
  ],
  "remoteUser": "vscode",
  "init": true,
  "postCreateCommand": "bash .devcontainer/scripts/post-create.sh",
  "customizations": {
    "vscode": {
      "settings": {
        "python.defaultInterpreterPath": "/opt/venv/bin/python",
        "terminal.integrated.defaultProfile.linux": "bash"
      },
      "extensions": [
        "anthropic.claude-code",
        "openai.chatgpt",
        "ms-python.python"
      ]
    }
  }
}
```

## Dockerfile Pattern

Core principles:

- install OS packages first
- neutralize broken extra APT sources if the base image has any
- install CLI tooling globally
- create `/opt/venv`
- set `VIRTUAL_ENV` and `PATH`
- isolate Git with `GIT_CONFIG_GLOBAL`

```dockerfile
# syntax=docker/dockerfile:1.7
FROM mcr.microsoft.com/devcontainers/python:1-3.11-bookworm

ARG DEBIAN_FRONTEND=noninteractive
ARG NODE_MAJOR=22

ENV VIRTUAL_ENV=/opt/venv \
    PATH=/opt/venv/bin:/usr/local/share/npm-global/bin:${PATH} \
    CLAUDE_CONFIG_DIR=/home/vscode/.claude \
    CODEX_HOME=/home/vscode/.codex \
    GIT_CONFIG_GLOBAL=/usr/local/etc/devcontainer.gitconfig

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

RUN rm -f /etc/apt/sources.list.d/yarn.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates curl git gnupg jq less openssh-client procps ripgrep \
    && curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - \
    && apt-get install -y --no-install-recommends nodejs bubblewrap \
    && mkdir -p /usr/local/share/npm-global \
    && npm config set prefix /usr/local/share/npm-global \
    && npm install -g @openai/codex @anthropic-ai/claude-code \
    && python -m venv "${VIRTUAL_ENV}" \
    && "${VIRTUAL_ENV}/bin/pip" install --upgrade pip setuptools wheel \
    && printf '[credential]\n    helper =\n' > /usr/local/etc/devcontainer.gitconfig \
    && touch /home/vscode/.gitconfig \
    && chown vscode:vscode /home/vscode/.gitconfig \
    && rm -rf /var/lib/apt/lists/*
```

If Python dependencies are stable and available at build time, install them in the image as well.

## `post-create.sh` Pattern

Use `post-create.sh` only for things that depend on the workspace contents or mounted volumes:

- fix ownership on named volumes
- create a compatibility symlink like `venv -> /opt/venv`
- run `npm ci` into the `node_modules` volume
- initialize tool config files if missing

```bash
#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID}" -ne 0 ]; then
    exec sudo bash "$0" "$@"
fi

workspace="/workspaces/MyProject"
target_user="vscode"
target_home="/home/${target_user}"

install -d -m 0700 -o "${target_user}" -g "${target_user}" \
    "${target_home}/.claude" \
    "${target_home}/.codex"

if [ ! -e "${workspace}/venv" ]; then
    ln -s /opt/venv "${workspace}/venv"
    chown -h "${target_user}:${target_user}" "${workspace}/venv"
fi
```

## Claude/Codex Notes

- Claude auth should live in a named volume mounted at `~/.claude`.
- Codex auth should live in a named volume mounted at `~/.codex`.
- If Codex needs deterministic config, initialize `~/.codex/config.toml` in `post-create.sh`.
- If the repo uses Claude project settings, keep shared settings minimal and path-portable.
- Do not deny working directories that repo-specific skills/prompts need.

## Git Isolation

Devcontainers may copy host Git configuration into the container. If the goal is isolation:

- create a container-owned Git config in the image
- set `GIT_CONFIG_GLOBAL` to that file
- do not rely on host credential helpers

Minimal config:

```ini
[credential]
    helper =
```

## Secrets

Preferred patterns:

- named volume containing credentials created inside the container
- explicit read-only mount of a narrow host secrets directory

Avoid:

- mounting `%USERPROFILE%`
- mounting `~`
- mounting `~/.ssh` wholesale unless that is an intentional tradeoff

If a repo needs a deploy key or cloud credential, mount only that specific secret source.

## Secondary Repos / Large Mutable State

If the project needs an additional git repo, cache, or generated dataset:

- do not clone it into the container overlay under `/workspaces` and assume it will persist
- use a named volume or a dedicated persisted mount
- pass its path via env var instead of hard-coding Windows paths

Bad:

```text
/c/tmp/other-repo
```

Good:

```text
/workspace-data/other-repo
```

with a named volume and something like:

```json
"mounts": [
  "type=volume,source=myproject-dataset-repo,target=/workspace-data/other-repo"
]
```

## Verification Checklist

From inside the container:

```bash
pwd
python --version
claude --version
codex --version
git status --short
```

From Docker inspect, verify mounts include only:

- one bind mount for the repo workspace
- named volumes for auth/state that you explicitly configured
- normal VS Code runtime plumbing such as `/vscode` or a Wayland socket

They should not include:

- your whole Windows home directory
- your whole WSL home directory

## Known Pitfalls

- Windows-to-WSL copies can look massively dirty due to line-ending differences.
  Fix by aligning Git settings such as `core.autocrlf`.
- A heredoc inside a chained Docker `RUN` can break parsing if written incorrectly.
  `printf` is often simpler for tiny config files.
- Some base images carry stale APT repos. Remove or fix them before `apt-get update`.
- If the repo expects `source venv/bin/activate`, keep a compatibility symlink even if the real venv is elsewhere.
- VS Code integrated terminals can occasionally be awkward for auth/device flows. If needed, authenticate via `docker exec -it <container> bash`.

## Manual Workflow Summary

```bash
# In Ubuntu
cd ~/MyProject
code .
```

Then in VS Code:

1. confirm the window is attached to WSL
2. run `Dev Containers: Reopen in Container`
3. sign into Claude and Codex inside the container
4. confirm Docker mounts match the intended design

That is the baseline pattern. Adapt the mounted volumes, build packages, and post-create steps to the new repo rather than copying this mechanically.

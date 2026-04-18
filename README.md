# VibeRun

A minimal web app scaffold for 'vibe code while running'.

## Development Setup

Since this is a public repository, development uses a devcontainer in WSL for strict separation from your personal computer files.

### Prerequisites
- Windows with WSL2 installed
- VS Code with Dev Containers extension
- Docker Desktop

### Setup Steps
1. In WSL (Ubuntu), clone the repo into your WSL filesystem:
   `ash
   cd ~
   git clone https://github.com/nwjt2/viberun.git
   cd viberun
   `

2. Open the WSL folder in VS Code:
   `ash
   code .
   `

3. In VS Code, run Dev Containers: Reopen in Container from the command palette.

4. The devcontainer will build and set up the environment with Node.js and AI tools.

5. Start the app:
   `ash
   npm start
   `

6. Open http://localhost:3000 in your browser.

### Workflow
- Edit files in VS Code (running in the devcontainer).
- Changes are isolated to the container; no files touch your host.
- AI tools (Claude, Codex) auth is stored in container volumes.
- 
ode_modules is in a named volume for persistence.

### Stopping
- Close the VS Code window or run Dev Containers: Reclose Container.

### Notes
- The devcontainer uses named volumes for mutable state, keeping the repo clean.
- No host filesystem is mounted except the workspace itself.
- This setup follows the WSL Devcontainer Pattern for secure, isolated development.

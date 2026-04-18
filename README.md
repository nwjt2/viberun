# VibeRun

A minimal web app scaffold for "vibe code while running".

## Local Docker setup

Build the image locally:

```powershell
docker build -t viberun .
```

Run the container:

```powershell
docker run --rm -p 3000:3000 viberun
```
```

Open `http://localhost:3000` in your browser.

## Notes

- This repository is intentionally small and focused on the app and Docker container.
- No Docker Hub publishing is required for local development.

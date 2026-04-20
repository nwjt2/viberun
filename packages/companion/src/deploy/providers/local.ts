import type { DeployProvider, DeployResult } from '../provider.js';

// The zero-config preview: the companion's HTTP server serves each project's
// dist/ at /preview/<projectId>/. In dev mode the PWA reaches it via Vite's
// proxy (/api/companion/preview/...). On a phone, the user advertises the
// companion through a tunnel (cloudflared / tailscale / ngrok) and sets
// VIBERUN_PUBLIC_BASE_URL so the PWA shows that URL on the SliceReview
// "Open preview" button.

export function makeLocalDeployProvider(options: { publicBaseUrl?: string }): DeployProvider {
  return {
    name: 'local',
    async deployPreview({ projectId }) {
      const base = (options.publicBaseUrl?.replace(/\/$/, '') ?? '/api/companion');
      const url = `${base}/preview/${encodeURIComponent(projectId)}/`;
      const result: DeployResult = { url, provider: 'local' };
      return result;
    },
  };
}

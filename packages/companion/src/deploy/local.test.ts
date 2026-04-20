import { describe, it, expect } from 'vitest';
import { makeLocalDeployProvider } from './providers/local.js';

describe('local deploy provider', () => {
  it('returns relative URL when no public base', async () => {
    const provider = makeLocalDeployProvider({});
    const result = await provider.deployPreview({
      workspaceDir: '/tmp/x',
      projectId: 'abc-123',
      appName: 'X',
    });
    expect(result.url).toBe('/api/companion/preview/abc-123/');
    expect(result.provider).toBe('local');
  });

  it('uses publicBaseUrl as absolute prefix, stripped of trailing slash', async () => {
    const provider = makeLocalDeployProvider({ publicBaseUrl: 'https://tunnel.example/' });
    const result = await provider.deployPreview({
      workspaceDir: '/tmp/x',
      projectId: 'abc-123',
      appName: 'X',
    });
    expect(result.url).toBe('https://tunnel.example/preview/abc-123/');
  });

  it('URL-encodes unusual project ids', async () => {
    const provider = makeLocalDeployProvider({});
    const result = await provider.deployPreview({
      workspaceDir: '/tmp/x',
      projectId: 'proj with space',
      appName: 'X',
    });
    expect(result.url).toContain('proj%20with%20space');
  });
});

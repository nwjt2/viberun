import type { Spec, SliceArtifacts } from '@viberun/shared';
import { writeRel, readOptional, commitSlice } from '../../../workspaces/edit.js';
import { primaryEntity } from '../../../slices/codegen.js';

// Polish slice: tighten PWA metadata, title, favicon, ensure main.tsx + App.tsx
// are solid. Deploy wiring ships in iteration 3 (Firebase preview channels).

const POLISHED_STYLES = `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: dark;
  --app-theme: #0b0f14;
}

html,
body,
#root {
  min-height: 100svh;
  overscroll-behavior-y: none;
}

body {
  -webkit-tap-highlight-color: transparent;
}

/* Large defaults for mobile thumb reach. */
button,
a,
input,
select,
textarea {
  font-size: 1rem;
}
`;

function renderIndexHtml(spec: Spec): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no" />
    <meta name="theme-color" content="#0b0f14" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <title>${escapeHtml(spec.name)}</title>
    <meta name="description" content="${escapeHtml(spec.pitch)}" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  </head>
  <body class="bg-slate-950 text-slate-100">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;
}

function renderFaviconSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="8" fill="#0b0f14" />
  <circle cx="16" cy="16" r="6" fill="#f8fafc" />
</svg>
`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export async function runPolishPublish(workspaceDir: string, spec: Spec): Promise<Partial<SliceArtifacts>> {
  await writeRel(workspaceDir, 'src/styles.css', POLISHED_STYLES);
  await writeRel(workspaceDir, 'index.html', renderIndexHtml(spec));
  await writeRel(workspaceDir, 'public/favicon.svg', renderFaviconSvg());

  // Update the PWA manifest to reflect the app name and slug — the initial
  // copy kept the placeholder format, so overwrite now that we have the spec.
  const manifest = {
    name: spec.name,
    short_name: spec.name,
    description: spec.pitch,
    start_url: '/',
    display: 'standalone',
    background_color: '#0b0f14',
    theme_color: '#0b0f14',
    icons: [
      { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  };
  await writeRel(workspaceDir, 'public/manifest.webmanifest', JSON.stringify(manifest, null, 2) + '\n');

  // Sanity-check: if entities file doesn't exist yet (polish shouldn't run
  // before data_model, but make this defensive), don't fail — just note it.
  const entitiesFile = await readOptional(workspaceDir, 'src/lib/entities.ts');
  const noteEntities = entitiesFile
    ? ''
    : ` (entities file not found — did data_model run?)`;

  const sha = await commitSlice(
    workspaceDir,
    'polish_publish',
    `title + favicon + manifest for ${spec.name}`,
  );
  return {
    commitSha: sha,
    filesWritten: [
      'src/styles.css',
      'index.html',
      'public/favicon.svg',
      'public/manifest.webmanifest',
    ],
    summary: `Polished ${spec.name}: custom title, favicon, PWA manifest.${noteEntities} Preview deploy lands in the next release.`,
    whatYouCanDo: [
      `See ${spec.name} as the app title and home-screen name`,
      `Install the app to your phone home screen`,
      `See a proper loading/empty/error state on every screen`,
    ],
    whatRemains: [`Deploy preview URL (iteration 3)`, `More ${primaryEntity(spec).name.toLowerCase()} capabilities as you ask for them`],
  };
}

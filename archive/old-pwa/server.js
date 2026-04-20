import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const port = Number(process.env.PORT) || 3000;

const app = express();
app.use(express.static(path.join(__dirname, 'public'), {
  etag: true,
  maxAge: '0',
}));

app.get('/healthz', (_req, res) => res.json({ ok: true }));

app.listen(port, () => {
  console.log(`[viberun] serving http://localhost:${port}`);
  console.log('[viberun] bring-your-own-key: the browser talks to your chosen AI provider directly.');
});

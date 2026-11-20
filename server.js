import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, 'dist');
const fallbackDir = path.join(__dirname, 'public');

export function createApp() {
  const app = express();
  const staticDir = fs.existsSync(path.join(distDir, 'index.html')) ? distDir : fallbackDir;

  app.use(express.static(staticDir, { extensions: ['html'] }));

  app.get('/vol0.1', (_req, res) => {
    res.sendFile(path.join(staticDir, 'index.html'));
  });

  app.get('*', (_req, res) => {
    res.sendFile(path.join(staticDir, 'index.html'));
  });

  return app;
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isDirectRun) {
  const port = Number(process.env.PORT) || 3000;
  const host = '0.0.0.0';
  const app = createApp();
  app.listen(port, host, () => {
    console.log(`Server listening on http://${host}:${port}`);
  });
}

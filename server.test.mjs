import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './server.js';

test('Express server serves index.html on root and /vol0.1', async () => {
  const app = createApp();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  try {
    const { port } = server.address();
    const resRoot = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(resRoot.status, 200);
    assert.match(resRoot.headers.get('content-type') || '', /text\/html/);
    const html = await resRoot.text();
    assert.match(html, /ぼかしメーカー/);
    assert.match(html, /id="mainCanvas"/);

    const resVol = await fetch(`http://127.0.0.1:${port}/vol0.1`);
    assert.equal(resVol.status, 200);
    assert.match(resVol.headers.get('content-type') || '', /text\/html/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildExportFilename, MAX_FILE_SIZE_BYTES, validateImageFile } from './fileLoader';

test('validateImageFile accepts supported MIME types and extension fallback when type is empty', () => {
  assert.equal(validateImageFile({ name: 'shot.png', type: 'image/png', size: 1024 }), null);
  assert.equal(validateImageFile({ name: 'photo.jpg', type: 'image/jpeg', size: 2048 }), null);
  assert.equal(validateImageFile({ name: 'clip.webp', type: '', size: 4096 }), null);
});

test('validateImageFile rejects unsupported types, SVG, and oversized files', () => {
  assert.ok(validateImageFile({ name: 'vector.svg', type: 'image/svg+xml', size: 100 }));
  assert.ok(validateImageFile({ name: 'notes.txt', type: 'text/plain', size: 100 }));
  assert.ok(validateImageFile({ name: 'unknown.bin', type: '', size: 100 }));
  assert.ok(
    validateImageFile({ name: 'huge.png', type: 'image/png', size: MAX_FILE_SIZE_BYTES + 1 })
  );
});

test('buildExportFilename formats deterministic timestamp and extension', () => {
  const fixedDate = new Date(2026, 4, 9, 8, 5, 3);
  assert.equal(buildExportFilename('image/png', fixedDate), 'bokasi_2026-05-09_08-05-03.png');
  assert.equal(buildExportFilename('image/jpeg', fixedDate), 'bokasi_2026-05-09_08-05-03.jpg');
  assert.equal(buildExportFilename('image/webp', fixedDate), 'bokasi_2026-05-09_08-05-03.webp');
});

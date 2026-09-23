/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import assert from 'node:assert/strict';
import { formatSafeDate, toClientErrorMessage } from '../src/lib/utils.ts';
import { isValidImageBuffer } from '../src/lib/storage.ts';

// Naive SQLite UTC "YYYY-MM-DD HH:MM:SS" harus dianggap UTC, lalu ditampilkan di APP_TIMEZONE.
assert.equal(formatSafeDate('2026-09-23 10:00:00', 'UTC'), '23/9/2026, 10.00.00');
assert.equal(formatSafeDate('2026-09-23T10:00:00.000Z', 'UTC'), '23/9/2026, 10.00.00');
assert.equal(formatSafeDate('2026-09-23T17:00:00+07:00', 'UTC'), '23/9/2026, 10.00.00');
assert.equal(formatSafeDate('2026-09-23', 'UTC'), '23/9/2026, 00.00.00');
assert.equal(formatSafeDate(null), '-');

// Error mentah tidak boleh bocor di produksi kecuali EXPOSE_ERROR_DETAILS aktif.
const prevEnv = process.env.NODE_ENV;
const prevExpose = process.env.EXPOSE_ERROR_DETAILS;
process.env.NODE_ENV = 'production';
delete process.env.EXPOSE_ERROR_DETAILS;
assert.equal(toClientErrorMessage(new Error('rahasia internal'), 'Gagal'), 'Gagal');
process.env.EXPOSE_ERROR_DETAILS = 'true';
assert.equal(toClientErrorMessage(new Error('rahasia internal'), 'Gagal'), 'Gagal (rahasia internal)');
process.env.NODE_ENV = prevEnv;
if (prevExpose === undefined) delete process.env.EXPOSE_ERROR_DETAILS;
else process.env.EXPOSE_ERROR_DETAILS = prevExpose;

// Deteksi gambar harus menolak konten non-gambar (mis. HTML) dan mengenali PNG.
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
assert.equal(isValidImageBuffer(png).valid, true);
assert.equal(isValidImageBuffer(png).ext, 'png');
assert.equal(isValidImageBuffer(Buffer.from('<html><script>alert(1)</script>')).valid, false);
assert.equal(isValidImageBuffer(Buffer.from('/uploads/x.png')).valid, false);

console.log('check-utils: OK');

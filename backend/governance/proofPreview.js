'use strict';

const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const WIDTH = 640;
const HEIGHT = 480;
const MAX_PREVIEW_BYTES = 3 * 1024 * 1024;
const INPUT_CODERS = Object.freeze({ 'image/jpeg': 'jpeg:-', 'image/png': 'png:-', 'image/webp': 'webp:-' });

function problem(code, status, message) {
  return Object.assign(new Error(message), { code, status });
}

function sha256(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }

function proofIdentifier(caseId, assetId) {
  if (!/^[a-f0-9]{8}-/i.test(String(caseId)) || !Number.isSafeInteger(Number(assetId)) || Number(assetId) < 1) {
    throw problem('PROOF_IDENTIFIER_INVALID', 400, 'A saved case and image are required for a proof identifier.');
  }
  return `P-${String(caseId).slice(0, 8).toUpperCase()}-${Number(assetId)}`;
}

function pngDimensions(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 45 ||
      !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
      bytes.toString('ascii', 12, 16) !== 'IHDR' ||
      bytes.toString('ascii', bytes.length - 8, bytes.length - 4) !== 'IEND') return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function verifiedPreview(row) {
  const bytes = row?.preview_data;
  const dimensions = pngDimensions(bytes);
  if (!dimensions || dimensions.width !== WIDTH || dimensions.height !== HEIGHT ||
      bytes.length > MAX_PREVIEW_BYTES || bytes.length !== Number(row.preview_size) ||
      row.mime_type !== 'image/png' || row.watermark_version !== 'proof-v1' ||
      row.proof_id !== proofIdentifier(row.case_id, row.asset_id) ||
      row.preview_sha256 !== sha256(bytes)) {
    throw problem('PREVIEW_CHECKSUM_MISMATCH', 409, 'Stored proof preview did not pass its format and checksum checks.');
  }
  return bytes;
}

function renderProofPreview(original, mimeType, proofId) {
  if (!Buffer.isBuffer(original) || !INPUT_CODERS[mimeType] || !/^P-[A-F0-9]{8}-[1-9]\d*$/.test(proofId)) {
    return Promise.reject(problem('PREVIEW_SOURCE_INVALID', 400, 'A supported saved image and proof identifier are required.'));
  }
  const args = [
    '-limit', 'memory', '64MiB', '-limit', 'map', '128MiB', '-limit', 'disk', '0',
    '-limit', 'area', '40MP', INPUT_CODERS[mimeType],
    '-auto-orient', '-resize', `${WIDTH}x${HEIGHT}>`,
    '-background', '#172033', '-gravity', 'center', '-extent', `${WIDTH}x${HEIGHT}`,
    '-alpha', 'remove', '-alpha', 'off', '-colorspace', 'sRGB', '-strip',
    '-font', process.env.PROOF_PREVIEW_FONT || 'Helvetica-Bold',
    '-gravity', 'center', '-pointsize', '68',
    '-fill', 'rgba(255,255,255,0.72)', '-stroke', 'rgba(0,0,0,0.75)', '-strokewidth', '2',
    '-annotate', '+0+0', 'PROOF',
    '-stroke', 'none', '-fill', 'rgba(0,0,0,0.80)',
    '-draw', `rectangle 0,${HEIGHT - 54} ${WIDTH},${HEIGHT}`,
    '-fill', 'white', '-gravity', 'south', '-pointsize', '21',
    '-annotate', '+0+15', proofId,
    '-define', 'png:compression-level=9', 'png:-',
  ];
  return new Promise((resolve, reject) => {
    const child = spawn(process.env.PROOF_PREVIEW_BINARY || 'magick', args, {
      stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
    });
    const chunks = [];
    let outputBytes = 0;
    let errors = '';
    let done = false;
    const finish = (error, value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (error) reject(error); else resolve(value);
    };
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish(problem('PREVIEW_RENDER_TIMEOUT', 503, 'The local preview renderer timed out.'));
    }, 12000);
    child.on('error', () => finish(problem('PREVIEW_RENDERER_UNAVAILABLE', 503, 'The local preview renderer is unavailable.')));
    child.stdout.on('data', chunk => {
      outputBytes += chunk.length;
      if (outputBytes > MAX_PREVIEW_BYTES) {
        child.kill('SIGKILL');
        finish(problem('PREVIEW_TOO_LARGE', 413, 'The rendered proof preview is too large.'));
      } else chunks.push(chunk);
    });
    child.stderr.on('data', chunk => { errors = (errors + chunk.toString('utf8')).slice(-4096); });
    child.on('close', code => {
      if (done) return;
      const bytes = Buffer.concat(chunks);
      const dimensions = pngDimensions(bytes);
      if (code !== 0 || !dimensions || dimensions.width !== WIDTH || dimensions.height !== HEIGHT) {
        finish(problem('PREVIEW_RENDER_FAILED', 422,
          /no decode delegate|unable to read image|improper image header/i.test(errors)
            ? 'The uploaded image could not be decoded safely.' : 'The local preview could not be rendered.'));
      } else finish(null, { bytes, mimeType: 'image/png', width: WIDTH, height: HEIGHT,
        sha256: sha256(bytes), proofId, watermarkVersion: 'proof-v1' });
    });
    child.stdin.on('error', () => {});
    child.stdin.end(original);
  });
}

module.exports = { WIDTH, HEIGHT, MAX_PREVIEW_BYTES, sha256, proofIdentifier, pngDimensions, verifiedPreview, renderProofPreview };

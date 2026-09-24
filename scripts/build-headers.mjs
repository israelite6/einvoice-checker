// Writes dist/_headers (Cloudflare Pages) with a strict Content-Security-Policy.
// The only inline scripts allowed are the official visualization scripts and our frame helper,
// each pinned by its SHA-256 hash, so no other inline code can run.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const hash = (text) => `'sha256-${crypto.createHash('sha256').update(text, 'utf8').digest('base64')}'`;

const inline = [
  fs.readFileSync(path.join(ROOT, 'src/engine/frame-helper.txt'), 'utf8'),
  fs.readFileSync(path.join(ROOT, 'public/rules/viz/FileSaver-v2.0.5.js'), 'utf8'),
  fs.readFileSync(path.join(ROOT, 'public/rules/viz/xrechnung-viewer.js'), 'utf8'),
];

const csp = [
  "default-src 'self'",
  `script-src 'self' 'wasm-unsafe-eval' ${inline.map(hash).join(' ')}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "frame-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

const headers = `/*
  Content-Security-Policy: ${csp}
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()
  Cross-Origin-Opener-Policy: same-origin

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/rules/*
  Cache-Control: public, max-age=86400

/vendor/*
  Cache-Control: public, max-age=86400

/sw.js
  Cache-Control: no-cache
`;

fs.writeFileSync(path.join(ROOT, 'dist/_headers'), headers);
console.log('dist/_headers written');

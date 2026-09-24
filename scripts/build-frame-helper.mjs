// Minifies src/engine/frame-helper.src.js into frame-helper.txt (the exact text that is inlined and CSP-hashed).
import fs from 'node:fs';
const src = fs.readFileSync(new URL('../src/engine/frame-helper.src.js', import.meta.url), 'utf8');
export const minify = (s) => s.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n').replace(/\s*\n\s*/g, '').replace(/\s{2,}/g, ' ');
if (process.argv[1] && process.argv[1].endsWith('build-frame-helper.mjs')) {
  fs.writeFileSync(new URL('../src/engine/frame-helper.txt', import.meta.url), minify(src));
  console.log('frame-helper.txt written');
}

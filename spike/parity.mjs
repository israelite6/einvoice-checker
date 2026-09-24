// Compare our engine with the official KoSIT validator reports, file by file.
import fs from 'node:fs';
import path from 'node:path';
import { validate } from './engine.mjs';

function refResult(reportPath) {
  const s = fs.readFileSync(reportPath, 'utf8');
  const accept = /<rep:assessment>\s*<rep:accept>/.test(s);
  const xsdValid = /id="val-xsd" valid="true"/.test(s);
  const msgs = [...s.matchAll(/<rep:message [^>]*>/g)].map((m) => ({
    level: (m[0].match(/level="([a-z]+)"/) || [])[1],
    code: (m[0].match(/code="([^"]+)"/) || [])[1] || 'XSD',
  }));
  return { accept, xsdValid, msgs };
}
const key = (msgs, level) => [...new Set(msgs.filter((m) => m.level === level && m.code !== 'XSD').map((m) => m.code))].sort().join(',');

const sets = [
  { files: fs.readFileSync('testfiles.txt', 'utf8').trim().split('\n'), ref: 'ref' },
  { files: fs.readdirSync('mutants').map((f) => path.join('mutants', f)), ref: 'ref-mut' },
];
let total = 0, same = 0; const diffs = []; const times = [];
for (const { files, ref } of sets) {
  for (const f of files) {
    const r = refResult(path.join(ref, path.basename(f, '.xml') + '-report.xml'));
    const t0 = performance.now();
    const o = await validate(fs.readFileSync(f, 'utf8'));
    times.push(performance.now() - t0);
    // KoSIT reports list each rule's raw severity; overrides only affect acceptance.
    const ours = { accept: o.accept, xsdValid: o.xsdValid, msgs: o.messages.map((m) => ({ code: m.code, level: m.rawLevel })) };
    const eq = r.accept === ours.accept && r.xsdValid === ours.xsdValid &&
      ['error', 'warning', 'information'].every((l) => key(r.msgs, l) === key(ours.msgs, l));
    total++; if (eq) same++; else diffs.push({ file: path.basename(f), ref: { accept: r.accept, xsd: r.xsdValid, e: key(r.msgs, 'error'), w: key(r.msgs, 'warning'), i: key(r.msgs, 'information') }, ours: { accept: ours.accept, xsd: ours.xsdValid, e: key(ours.msgs, 'error'), w: key(ours.msgs, 'warning'), i: key(ours.msgs, 'information') } });
  }
}
times.sort((a, b) => a - b);
const pct = (p) => Math.round(times[Math.floor(p * (times.length - 1))]);
console.log(JSON.stringify({ total, identical: same, mismatches: diffs.length, ms: { p50: pct(0.5), p90: pct(0.9), max: pct(1) } }));
fs.writeFileSync('parity-diffs.json', JSON.stringify(diffs, null, 1));

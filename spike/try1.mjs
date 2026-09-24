import fs from 'node:fs';
import { validate } from './engine.mjs';
const f = process.argv[2];
const r = await validate(fs.readFileSync(f, 'utf8'));
console.log(JSON.stringify({ scenario: r.scenario, accept: r.accept, xsd: r.xsdValid, codes: r.messages.map(m => m.code + ':' + m.level), timings: Object.fromEntries(Object.entries(r.timings).map(([k, v]) => [k, Math.round(v)])) }, null, 1));

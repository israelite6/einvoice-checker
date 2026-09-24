// Export scenarios and XSDs as JSON for the browser harness (reuses engine.mjs parsing).
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG_DIR } from './engine.mjs';
const { SCENARIOS, XSD_FILES } = await import('./engine.mjs');
fs.writeFileSync('browser/rules/config.json', JSON.stringify({ scenarios: SCENARIOS, xsd: XSD_FILES }));
console.log('scenarios', SCENARIOS.length, 'xsd files', XSD_FILES.length, 'config KB', Math.round(fs.statSync('browser/rules/config.json').size / 1024));

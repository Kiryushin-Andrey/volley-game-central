#!/usr/bin/env node
/**
 * Injects build timestamp into src/buildInfo.generated.ts.
 * Run before `tsc` (prebuild) and before dev (predev) so the backend can expose it via /build-info.
 */
const fs = require('fs');
const path = require('path');

const timestamp = new Date().toISOString();
const outPath = path.join(__dirname, '..', 'src', 'buildInfo.generated.ts');
const content = `// Auto-generated at build time. Do not edit.
export const BUILD_TIMESTAMP = ${JSON.stringify(timestamp)};
`;

fs.writeFileSync(outPath, content, 'utf8');
console.log(`Wrote build timestamp ${timestamp} to ${outPath}`);

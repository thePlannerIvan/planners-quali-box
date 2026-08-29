#!/usr/bin/env node
import { readJson, validateEvidenceAndClaims } from './validation-core.mjs';

const [evidencePath, claimsPath] = process.argv.slice(2);
if (!evidencePath || !claimsPath) {
  console.error('Usage: node validate_evidence.mjs evidence-index.json claim-ledger.json');
  process.exit(2);
}
const result = validateEvidenceAndClaims(readJson(evidencePath), readJson(claimsPath));
for (const warning of result.warnings) console.warn(`WARN ${warning}`);
if (result.failures.length) {
  for (const failure of result.failures) console.error(`FAIL ${failure}`);
  process.exit(1);
}
console.log(`PASS qualitative evidence chain (${result.entries.length} evidence units, ${result.claims.length} claims)`);
console.log('Structural traceability passed. Human semantic and method review are still required.');

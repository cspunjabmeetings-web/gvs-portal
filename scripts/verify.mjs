// spec: 13 (khudkar jaanch), owner ka CHANGE REQUEST "npm run verify + CI" (16 Nov 2026)
// Saari jaanchein ek sath; aakhir mein ek hi jawab: PASS ya FAIL.
// Usage: npm run verify
import { spawnSync } from 'node:child_process';

const STEPS = [
  { name: 'Tests (golden + scope)', script: 'test' },
  { name: 'Scope check (spec manifest)', script: 'check:scope' },
  { name: 'Typecheck', script: 'typecheck' },
  { name: 'Build', script: 'build' },
  { name: 'Bundle report (spec 9.1)', script: 'report:bundle' },
];

const results = [];

for (const step of STEPS) {
  console.log(`\n=== ${step.name}: npm run ${step.script} ===`);
  const started = Date.now();
  // Script ke naam fixed hain (upar ki list), user input nahin
  const r = spawnSync(`npm run ${step.script}`, { stdio: 'inherit', shell: true });
  const ok = r.status === 0;
  results.push({ jaanch: step.name, nateeja: ok ? 'PASS' : 'FAIL', waqt: `${((Date.now() - started) / 1000).toFixed(1)}s` });
  if (!ok) break; // pehli ghalti par ruk jao, taake saaf pata chale kya toota
}

const skipped = STEPS.slice(results.length).map((s) => ({ jaanch: s.name, nateeja: 'CHALI NAHIN', waqt: '-' }));
console.log('\n================ VERIFY KA NATEEJA ================');
console.table([...results, ...skipped]);

const failed = results.find((r) => r.nateeja === 'FAIL');
if (failed) {
  console.error(`\n❌ FAIL: "${failed.jaanch}" fail hui. Upar us ka error dekhein.`);
  process.exit(1);
}
console.log('\n✅ PASS: saari jaanchein kamyab.');

/**
 * Differential test: run every snippet through our engine AND the real R binary,
 * then diff the console output line by line.
 *
 * This is the project's main correctness claim. "The trainer behaves like R" is only
 * worth saying because this script says so.
 */

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { RSession, renderOutput } from '../src/core/session.js';

const casesFile = new URL('./cases-eval.txt', import.meta.url).pathname;
const oracleFile = new URL('./run-eval-oracle.R', import.meta.url).pathname;

const cases = readFileSync(casesFile, 'utf8').split('\n').filter((l) => l.trim());

// R must run in a UTF-8 locale, or Cyrillic test strings come back as escaped bytes.
const raw = execFileSync('Rscript', ['--vanilla', oracleFile, casesFile], {
  encoding: 'utf8',
  maxBuffer: 1 << 24,
  env: { ...process.env, LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' },
});
const expected = raw.split('<<<CASE>>>\n').slice(1).map((block) => block.replace(/\n$/, '').split('\n'));

const only = process.argv[2] ? Number(process.argv[2]) : null;
let pass = 0;
const fails = [];

cases.forEach((src, i) => {
  if (only !== null && i !== only) return;
  const session = new RSession({ persist: false, trace: false });
  // `options(width = N); ...` prints at a narrower console, as the trainer does when
  // its console panel is narrow. We take the width as a parameter, not as R code.
  const narrow = src.match(/^options\(width = (\d+)\);\s*/);
  let ours;
  try {
    const r = session.run(narrow ? src.slice(narrow[0].length) : src);
    ours = narrow ? renderOutput(r.output, { width: Number(narrow[1]) }) : r.lines;
  } catch (e) {
    ours = [`<<CRASH>> ${e.message}`];
  }
  const theirs = expected[i] || [];
  // Warnings are compared separately (see diff-warnings), not here.
  const norm = (arr) => arr.filter((l) => !/^Warning/.test(l)).join('\n').replace(/[ \t]+$/gm, '').trim();
  if (norm(ours) === norm(theirs)) pass++;
  else fails.push({ i, src, ours, theirs });
});

const total = only !== null ? 1 : cases.length;
console.log(`eval: ${pass}/${total} match real R`);
for (const f of fails) {
  console.log(`\n  [${f.i}] ${f.src}`);
  console.log(`  ours : ${JSON.stringify(f.ours)}`);
  console.log(`  R    : ${JSON.stringify(f.theirs)}`);
}
process.exit(fails.length ? 1 : 0);

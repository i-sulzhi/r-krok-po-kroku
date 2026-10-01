/**
 * Paired differential test.
 *
 * dplyr and stringr are not installed in the system R, so they cannot be compared
 * against themselves. Instead each case pairs OUR tidyverse code with an equivalent
 * written in base R; the base-R side runs in the real R binary and the tidyverse side
 * runs in our engine, and the printed output must match.
 *
 * That is a stronger claim than "our dplyr does something reasonable": it says our
 * dplyr agrees with what R itself computes for the same question.
 *
 * Usage: node diff-paired.mjs cases-dplyr.txt [index]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { RSession } from '../src/core/session.js';

const file = process.argv[2] || 'cases-dplyr.txt';
const only = process.argv[3] ? Number(process.argv[3]) : null;
const casesPath = new URL(`./${file}`, import.meta.url).pathname;

const lines = readFileSync(casesPath, 'utf8').split('\n');
let setup = '';
const cases = [];
for (const raw of lines) {
  const line = raw.trim();
  if (!line || line.startsWith('#')) continue;
  if (line.startsWith('SETUP:')) { setup = line.slice(6).trim(); continue; }
  const at = line.indexOf('|||');
  if (at === -1) continue;
  cases.push({ ours: line.slice(0, at).trim(), theirs: line.slice(at + 3).trim() });
}

// --- run the base-R side in the real R ---
const tmp = new URL('./.paired-oracle.R', import.meta.url).pathname;
const script = [
  'options(stringsAsFactors = FALSE)',
  'cases <- list(',
  cases.map((c) => `  function() { ${setup}; ${c.theirs} }`).join(',\n'),
  ')',
  'for (f in cases) {',
  '  out <- tryCatch(capture.output(print(f())), error = function(e) paste0("ERROR: ", conditionMessage(e)))',
  '  cat("<<<CASE>>>\\n"); cat(out, sep = "\\n"); cat("\\n")',
  '}',
].join('\n');
writeFileSync(tmp, script, 'utf8');

const raw = execFileSync('Rscript', ['--vanilla', tmp], {
  encoding: 'utf8',
  maxBuffer: 1 << 24,
  env: { ...process.env, LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' },
});
const expected = raw.split('<<<CASE>>>\n').slice(1).map((b) => b.replace(/\n$/, '').split('\n'));

// --- run the tidyverse side in our engine ---
let pass = 0;
const fails = [];
cases.forEach((c, i) => {
  if (only !== null && i !== only) return;
  const session = new RSession({ persist: true, trace: false });
  let ours;
  try {
    session.run(setup);
    ours = session.run(c.ours).lines;
  } catch (e) {
    ours = [`<<CRASH>> ${e.message}`];
  }
  const norm = (arr) => arr.filter((l) => !/^Warning/.test(l)).join('\n').replace(/[ \t]+$/gm, '').trim();
  if (norm(ours) === norm(expected[i] || [])) pass++;
  else fails.push({ i, ...c, oursOut: ours, theirsOut: expected[i] || [] });
});

const total = only !== null ? 1 : cases.length;
console.log(`${file}: ${pass}/${total} agree with base R`);
for (const f of fails) {
  console.log(`\n  [${f.i}] ${f.ours}`);
  console.log(`       base R: ${f.theirs}`);
  console.log(`  ours  : ${JSON.stringify(f.oursOut)}`);
  console.log(`  R     : ${JSON.stringify(f.theirsOut)}`);
}
process.exit(fails.length ? 1 : 0);

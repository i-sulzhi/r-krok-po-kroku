/** Differential test: our parser vs. R's own parser, on precedence-sensitive snippets. */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parseToSexpr } from './sexpr.mjs';

const casesFile = new URL('./cases-syntax.txt', import.meta.url).pathname;
const cases = readFileSync(casesFile, 'utf8').split('\n').filter((l) => l.trim());

const oracleFile = new URL('./oracle.R', import.meta.url).pathname;
const rOut = execFileSync('Rscript', ['--vanilla', oracleFile, casesFile], { encoding: 'utf8' })
  .split('\n').filter((l) => l.length);

let pass = 0;
const fails = [];
cases.forEach((src, i) => {
  let ours;
  try { ours = parseToSexpr(src).trim(); }
  catch (e) { ours = `<<ERROR>> ${e.message}`; }
  const theirs = (rOut[i] || '').trim();
  const norm = (s) => s.replace(/\s+/g, ' ').trim();
  if (norm(ours) === norm(theirs)) pass++;
  else fails.push({ src, ours, theirs });
});

console.log(`syntax: ${pass}/${cases.length} match R's parse tree`);
for (const f of fails) {
  console.log(`\n  code : ${f.src}`);
  console.log(`  ours : ${f.ours}`);
  console.log(`  R    : ${f.theirs}`);
}
process.exit(fails.length ? 1 : 0);

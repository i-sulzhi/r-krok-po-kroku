/** Run every test suite; exit non-zero if any fails. */
import { execFileSync } from 'node:child_process';

const suites = [
  ['diff-syntax.mjs'],                      // parse trees vs. R's parser
  ['diff-eval.mjs'],                        // console output vs. real R
  ['diff-paired.mjs', 'cases-dplyr.txt'],   // our dplyr vs. base-R equivalents
  ['diff-paired.mjs', 'cases-stringr.txt'], // our stringr vs. base-R equivalents
  ['behaviour.mjs'],                        // trace, evaluation log, diagnosis, Polish, robustness
  ['lessons.mjs'],                          // every piece of every lesson runs; solutions pass
  ['pictures.mjs'],                         // every sub-expression of every lesson draws
  ['glossary.mjs'],                         // "Ściąga": concepts found, labelled, never the solution
  ['people.mjs'],                           // names keep progress apart; the report and its check code
  ['bundle.mjs'],                           // the built single file boots and walks every lesson
  ['i18n-coverage.mjs'],                    // every key used and present; plurals inflected
];
let failed = 0;
for (const [s, ...args] of suites) {
  try {
    const out = execFileSync('node', [new URL(`./${s}`, import.meta.url).pathname, ...args], { encoding: 'utf8' });
    process.stdout.write(out);
  } catch (e) {
    failed++;
    process.stdout.write(e.stdout || '');
    process.stdout.write(e.stderr || '');
  }
}
console.log(failed ? `\n${failed} suite(s) FAILED` : '\nall suites passed');
process.exit(failed ? 1 : 0);

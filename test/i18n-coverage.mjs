/**
 * Dictionary checks: the interface speaks Polish, correctly and completely.
 *
 * There is one language since decision D9, so "coverage" now means three things:
 *
 *   1. every key the code asks for exists -- a typo in t('fx.mena') would put the
 *      raw key in front of a student;
 *   2. every key the dictionary defines is used -- dead strings are where stale
 *      wording hides after a redesign;
 *   3. numerals carry plural forms -- "2 wiersze" but "5 wierszy".
 *
 * Keys built at runtime (`t(\`badge.${type}\`)`) cannot be found by a text scan, so
 * their prefixes are declared below; everything else must match literally.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { dictionary } from '../src/i18n/index.js';

const dict = dictionary();
const keys = Object.keys(dict);
let problems = 0;
const problem = (msg) => { problems++; console.log(msg); };

// --- 1 & 2: keys referenced by the code ------------------------------------

const srcRoot = new URL('../src/', import.meta.url).pathname;
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (name.endsWith('.js') && !path.includes('/i18n/')) files.push(path);
  }
}(srcRoot));
const source = files.map((f) => readFileSync(f, 'utf8')).join('\n');

// Any quoted dotted identifier that looks like a key: 'err.notFound', "fx.mean".
const referenced = new Set([...source.matchAll(/['"]((?:[a-z]+)(?:\.[A-Za-z0-9_]+)+)['"]/g)].map((m) => m[1]));

// Prefixes completed at runtime, with where that happens.
const DYNAMIC = [
  'badge.',     // viz/value.js typeLabel(): badge.${type}
  'type.',      // coercion names, table-ops headers
  'module.',    // app.js menu: module.${n}
  'ls.step.',   // lesson.js dots: ls.step.${kind}
  'ls.to.',     // lesson.js nav: ls.to.${kind}
  'diag.',      // diagnose.js hint(prefix): diag.x.title / .text / .fix
  'fx.nrow', 'fx.ncol', // focus.js: fx.${fname}
  'gl.',        // glossary.js: gl.${concept}.term, gl.part.${label}
  'rs.',        // rstudio.js: rs.${step}.title, rs.err.${id} (bundle.mjs checks the page for raw keys)
  'rep.col',    // people.js: the group table's column heads, rep.${k}
];
const dynamic = (k) => DYNAMIC.some((p) => k.startsWith(p));

for (const k of referenced) {
  // Only keys from the dictionary's own namespaces are checked; other dotted strings
  // (CSS classes, file names) happen to match the pattern.
  const ns = k.split('.')[0];
  if (!keys.some((d) => d.split('.')[0] === ns)) continue;
  if (!(k in dict) && !keys.some((d) => d.startsWith(`${k}.`))) problem(`code asks for a missing key: ${k}`);
}

for (const k of keys) {
  if (referenced.has(k) || dynamic(k)) continue;
  problem(`unused key (delete it, or declare its dynamic prefix): ${k}`);
}

// --- placeholders are well-formed --------------------------------------------

for (const [k, v] of Object.entries(dict)) {
  if (typeof v !== 'string') continue;
  // An opening brace that never closes would print "{name" to the student. A lone
  // closing brace is just text ("nawias klamrowy zamykający }").
  if (/\{[^}]*$/.test(v)) problem(`unclosed placeholder in "${k}": ${v}`);
  for (const m of v.matchAll(/\{([^}]*)\}/g)) {
    const parts = m[1].split('|');
    if (parts.length !== 1 && parts.length !== 4) problem(`"${k}": plural needs exactly three forms: {${m[1]}}`);
  }
}

// --- 3: numerals carry a plural form -----------------------------------------

/**
 * Polish inflects the noun after a number -- "2 kolumny" but "5 kolumn". A count
 * placeholder followed by a fixed noun is therefore wrong for most values, and the
 * fault only shows on the one screen where the number happens to be 2.
 */
const COUNTS = new Set([
  'kept', 'total', 'dropped', 'rows', 'rowsBefore', 'n', 'na', 'steps', 'times',
  'count', 'len', 'length', 'shortLen', 'longLen', 'size', 'depth', 'limit',
  'k', 'short', 'long', 'matched',
]);
// Words that may follow a bare number: they do not inflect for it.
const HARMLESS = new Set(['z', 'i', 'wobec', 'nie', 'bez', 'na', 'do', 'po', 'za', 'w', 'przez']);
for (const [key, value] of Object.entries(dict)) {
  if (typeof value !== 'string') continue;
  for (const m of value.matchAll(/\{([^}|]+)\}\s+(\p{L}+)/gu)) {
    const [, name, word] = m;
    if (!COUNTS.has(name.trim())) continue;
    if (HARMLESS.has(word.toLowerCase())) continue;
    problem(`"${key}" puts a fixed noun after {${name}}: "${m[0]}" -- use {name|one|few|many}`);
  }
}

// --- plain style: no em dashes ------------------------------------------------

// The teacher's own style: short sentences joined by "więc", "a", "bo". Captions and
// messages once carried 43 em dashes; this keeps them from coming back.
for (const [key, value] of Object.entries(dict)) {
  if (typeof value === 'string' && value.includes('—')) problem(`"${key}" has an em dash: ${value}`);
}

console.log(problems ? `\ni18n: ${problems} problem(s)` : `i18n: ${keys.length} keys, all used, all referenced keys exist, plurals inflected`);
process.exit(problems ? 1 : 0);

/**
 * Build: inline every module and stylesheet into one self-contained HTML file.
 *
 * The delivery requirement is a student downloading a single file and opening it --
 * no server, no install, no internet (decision D6). ES modules cannot be loaded from
 * `file://`, so the modules are bundled into one classic script.
 *
 * Each module keeps its OWN scope: it becomes a function that reads its imports from
 * a registry and writes its exports back to it. An earlier version concatenated all
 * modules into one scope and renamed clashing private names with a regex -- which
 * also renamed them inside string literals: a private `dollar()` in the stage module
 * turned the caption key 'fx.dollar' into 'fx.dollar$src_ui_viz_focus', visible to
 * students in the built file only. Separate scopes remove the renaming, and the bug
 * class with it.
 *
 * The one rule the source must obey: no circular imports (checked below), because
 * exports are copied once, not live-bound.
 *
 * Usage: node build.mjs [--out dist/r-trainer.html]
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const outArg = process.argv.indexOf('--out');
const outPath = resolve(root, outArg !== -1 ? process.argv[outArg + 1] : 'dist/r-trainer.html');
// --fragment: page content only (title, style, root, script), for hosts that supply
// their own <html>/<head>/<body> skeleton -- e.g. a published claude.ai page.
const fragment = process.argv.includes('--fragment');

const ENTRY = 'src/ui/app.js';
const CSS = 'src/ui/styles.css';

/** Resolve a relative import to a repo-relative module path. */
function resolveImport(fromFile, spec) {
  return relative(root, resolve(dirname(resolve(root, fromFile)), spec)).replace(/\\/g, '/');
}

const IMPORT_RE = /^\s*import\s+([\s\S]*?)\s+from\s+['"](\.[^'"]+)['"];?\s*$/gm;
const BARE_IMPORT_RE = /^\s*import\s+['"](\.[^'"]+)['"];?\s*$/gm;

const seen = new Set();
const order = [];

/** Depth-first walk so a module is emitted after everything it imports. */
function collect(file, stack = []) {
  if (seen.has(file)) return;
  if (stack.includes(file)) {
    throw new Error(`Circular import: ${[...stack, file].join(' -> ')}\nThe single-file build cannot express this.`);
  }
  const src = readFileSync(resolve(root, file), 'utf8');
  const deps = new Set();
  for (const re of [IMPORT_RE, BARE_IMPORT_RE]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src)) !== null) deps.add(resolveImport(file, m[m.length - 1]));
  }
  for (const d of deps) collect(d, [...stack, file]);
  seen.add(file);
  order.push({ file, src });
}

collect(ENTRY);

/** `import X, { a, b as c } from './m.js'` -> destructuring from the registry. */
function importBindings(clause, from) {
  const mod = `__modules[${JSON.stringify(from)}]`;
  const text = clause.trim();
  let m = text.match(/^\*\s+as\s+([\w$]+)$/);
  if (m) return `const ${m[1]} = ${mod};`;
  let def = null;
  let named = null;
  if ((m = text.match(/^([\w$]+)\s*,\s*\{([\s\S]*)\}$/))) { [, def, named] = m; }
  else if ((m = text.match(/^\{([\s\S]*)\}$/))) { [, named] = m; }
  else if ((m = text.match(/^([\w$]+)$/))) { [, def] = m; }
  else throw new Error(`Unsupported import clause: ${text}`);
  const out = [];
  if (def) out.push(`const ${def} = ${mod}.default;`);
  if (named) {
    const binds = named.split(',').map((s) => s.trim()).filter(Boolean).map((s) => {
      const [name, alias] = s.split(/\s+as\s+/).map((x) => x.trim());
      return alias ? `${name}: ${alias}` : name;
    });
    out.push(`const { ${binds.join(', ')} } = ${mod};`);
  }
  return out.join(' ');
}

const EXPORT_DECL_RE = /^\s*export\s+(?:const|let|var|function|class|async\s+function)\s+([A-Za-z_$][\w$]*)/gm;
const EXPORT_LIST_RE = /^\s*export\s*\{([^}]*)\}\s*;?\s*$/gm;

/** Exported name -> local name, for the registry entry written at the module's end. */
function exportPairs(src) {
  const pairs = new Map();
  let m;
  EXPORT_DECL_RE.lastIndex = 0;
  while ((m = EXPORT_DECL_RE.exec(src)) !== null) pairs.set(m[1], m[1]);
  EXPORT_LIST_RE.lastIndex = 0;
  while ((m = EXPORT_LIST_RE.exec(src)) !== null) {
    for (const part of m[1].split(',')) {
      const [local, alias] = part.trim().split(/\s+as\s+/).map((x) => x.trim());
      if (local) pairs.set(alias || local, local);
    }
  }
  if (/^\s*export\s+default\s+/m.test(src)) pairs.set('default', '__default__');
  return pairs;
}

/** One module as a scoped function body: imports in, exports out. */
function wrap({ file, src }) {
  let body = src.replace(IMPORT_RE, (_, clause, spec) => importBindings(clause, resolveImport(file, spec)));
  body = body
    .replace(BARE_IMPORT_RE, '')
    .replace(/^\s*export\s+default\s+/gm, 'var __default__ = ')
    .replace(/^(\s*)export\s+(?=(?:const|let|var|function|class|async)\b)/gm, '$1')
    .replace(EXPORT_LIST_RE, '');
  const exportsObj = [...exportPairs(src)].map(([name, local]) => `${JSON.stringify(name)}: ${local}`).join(', ');
  return `/* ===== ${file} ===== */\n(function () {\n${body}\n__modules[${JSON.stringify(file)}] = { ${exportsObj} };\n})();`;
}

const bundle = order.map(wrap).join('\n\n');

const css = readFileSync(resolve(root, CSS), 'utf8');

const head = fragment ? '' : `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
`;
const html = `${head}<title>R krok po kroku</title>
<style>
${css}
</style>
${fragment ? '' : '</head>\n<body>\n'}<div id="root" lang="pl"></div>
<script>
"use strict";
(function () {
const __modules = {};

${bundle}

const { App } = __modules[${JSON.stringify(ENTRY)}];
document.addEventListener('DOMContentLoaded', function () {
  window.app = new App(document.getElementById('root'));
});
})();
</script>
${fragment ? '' : '</body>\n</html>\n'}`;

// The product is Polish (decision D9). Cyrillic in the bundle means Russian text
// leaked back in -- it happened three times before the redesign (hard-coded panel
// labels, a CSS `content:` string, a default argument name). Regexes that need
// Cyrillic letters write them as \u escapes.
const cyrillic = html.match(/[Ѐ-ӿ]/);
if (cyrillic) {
  const at = html.indexOf(cyrillic[0]);
  throw new Error(`Cyrillic text in the bundle at line ${html.slice(0, at).split('\n').length}: `
    + `${JSON.stringify(html.slice(at - 40, at + 40))}\nThe interface is Polish-only; write regex ranges as \\u escapes.`);
}

/**
 * Refuse to ship control bytes.
 *
 * A raw C0 byte in a source file survives Node's module loader unnoticed, but the
 * HTML parser does not pass it through: inside a <script> element a U+0000 is
 * replaced by U+FFFD, so the built file would quietly behave differently from the
 * modules it was built from. Control characters belong in source as escapes.
 */
const stray = html.match(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/);
if (stray) {
  const at = html.indexOf(stray[0]);
  const line = html.slice(0, at).split('\n').length;
  throw new Error(`Control byte U+${stray[0].codePointAt(0).toString(16).padStart(4, '0').toUpperCase()} `
    + `in the bundle at line ${line}: ${JSON.stringify(html.slice(at - 40, at + 40))}\n`
    + 'Write it as an escape sequence (\\u0000) in the source instead of a raw byte.');
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, html, 'utf8');

const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log(`built ${relative(root, outPath)} -- ${order.length} modules, ${kb} KB, no external requests`);

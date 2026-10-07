/**
 * Printing values the way the R console does.
 *
 * This has to be right, not merely close: if the trainer's output differs from
 * RStudio's, the student learns the trainer instead of learning R. The fiddly part
 * is numbers -- R picks ONE number of decimal places for the whole vector, the
 * smallest that still shows every element to 7 significant digits. That is why
 * `c(1, 2.5)` prints as `1.0 2.5` and not `1 2.5`.
 *
 * Verified against the real R binary by test/diff-print.mjs.
 */

import {
  NA, isNA, isAtomic, isList, isNull, isFunction, rLength, getNames, getAttr,
  isFactor, isDataFrame, rClass, hasClass,
} from './rvalue.js';
import { t } from '../i18n/index.js';

export const CONSOLE_WIDTH = 80;
const DIGITS = 7;                                    // options(digits = 7)

/** Smallest number of decimals that shows `x` to `digits` significant figures. */
function decimalsNeeded(x, digits = DIGITS) {
  if (!Number.isFinite(x) || x === 0) return 0;
  const rounded = Number(x.toPrecision(digits));
  for (let d = 0; d <= 15; d++) {
    if (Math.abs(Number(rounded.toFixed(d)) - rounded) < Number.EPSILON * Math.abs(rounded) * 8) return d;
  }
  return 15;
}

/**
 * Fewest significant digits that still represents every element to `digits` s.f.
 * in scientific form -- R trims the mantissa as far as it can.
 */
function sciDigitsNeeded(finite, digits = DIGITS) {
  for (let nsig = 1; nsig <= digits; nsig++) {
    const ok = finite.every((v) => {
      const target = Number(v.toPrecision(digits));
      return Number(target.toExponential(nsig - 1)) === target;
    });
    if (ok) return nsig;
  }
  return digits;
}

/**
 * Would R switch this vector to scientific notation?
 *
 * R does not use a magnitude threshold: it renders the vector both ways and keeps
 * whichever is narrower. That is why 100000 prints as 1e+05 (5 chars beats 6) while
 * 0.001 stays fixed (both are 5). Modelling the real rule avoids a pile of
 * special cases that would each be subtly wrong.
 */
function useScientific(values) {
  const finite = values.filter((v) => !isNA(v) && Number.isFinite(v) && v !== 0);
  if (!finite.length) return false;

  const nsmall = Math.max(0, ...finite.map((x) => decimalsNeeded(x)));
  const fixedWidth = Math.max(...finite.map((x) => x.toFixed(nsmall).length));

  const nsig = sciDigitsNeeded(finite);
  const sciWidth = Math.max(...finite.map((x) => {
    const [mant, exp] = x.toExponential(nsig - 1).split('e');
    const e = exp.replace(/^[+-]/, '').padStart(2, '0');
    return mant.length + 2 + e.length;
  }));
  return fixedWidth > sciWidth;
}

function formatScientific(x, nsig = DIGITS) {
  if (isNA(x)) return 'NA';
  if (Number.isNaN(x)) return 'NaN';
  if (!Number.isFinite(x)) return x > 0 ? 'Inf' : '-Inf';
  const s = x.toExponential(Math.max(0, nsig - 1));
  const [mant, exp] = s.split('e');
  const m = mant.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  const sign = exp[0] === '-' ? '-' : '+';
  const digitsPart = exp.replace(/^[+-]/, '').padStart(2, '0');
  return `${m}e${sign}${digitsPart}`;
}

/** Format one atomic vector's cells as strings, already aligned in width. */
export function formatCells(v, { quote = true } = {}) {
  const vals = v.values;
  if (v.type === 'character') {
    return vals.map((x) => (isNA(x) ? 'NA' : quote ? `"${escapeString(x)}"` : String(x)));
  }
  if (v.type === 'logical') {
    return vals.map((x) => (isNA(x) ? 'NA' : x ? 'TRUE' : 'FALSE'));
  }
  if (v.type === 'integer') {
    return vals.map((x) => (isNA(x) ? 'NA' : String(x)));
  }
  // double
  if (useScientific(vals)) {
    const finite = vals.filter((v) => !isNA(v) && Number.isFinite(v) && v !== 0);
    const nsig = sciDigitsNeeded(finite);
    return vals.map((x) => formatScientific(x, nsig));
  }
  const nsmall = Math.max(0, ...vals.filter((x) => !isNA(x) && Number.isFinite(x)).map((x) => decimalsNeeded(x)));
  return vals.map((x) => {
    if (isNA(x)) return 'NA';
    if (Number.isNaN(x)) return 'NaN';
    if (!Number.isFinite(x)) return x > 0 ? 'Inf' : '-Inf';
    return x.toFixed(nsmall);
  });
}

const escapeString = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\t/g, '\\t');

const padLeft = (s, w) => ' '.repeat(Math.max(0, w - s.length)) + s;
const padRight = (s, w) => s + ' '.repeat(Math.max(0, w - s.length));
/** R right-aligns numbers but left-aligns strings, so columns of text line up on the quote. */
const padCell = (s, w, leftAlign) => (leftAlign ? padRight(s, w) : padLeft(s, w));

/**
 * The full console rendering of a value.
 * @returns {string[]} lines
 */
export function formatValue(v, { width = CONSOLE_WIDTH } = {}) {
  if (isNull(v)) return ['NULL'];
  if (isFunction(v)) return formatFunction(v);
  if (isFactor(v)) return formatFactor(v, width);
  if (isDataFrame(v)) return formatDataFrame(v, width);
  if (isList(v)) return formatList(v, width);
  if (isAtomic(v)) {
    if (rLength(v) === 0) return [`${emptyTag(v.type)}(0)`];
    const names = getNames(v);
    const body = names ? formatNamedVector(v, names, width) : formatPlainVector(v, width);
    // A one-way table prints the name of what was counted above the counts -- blank
    // when the argument was an expression rather than a variable. See table() in
    // builtins/structures.js.
    if (hasClass(v, 'table')) return [String(getAttr(v, 'dnn')?.values[0] ?? ''), ...body];
    return body;
  }
  return [String(v.kind)];
}

const emptyTag = (t) => ({ logical: 'logical', integer: 'integer', double: 'numeric', character: 'character' }[t]);

/** `[1] 1 2 3`, wrapping to the console width with a running index label. */
function formatPlainVector(v, width, { quote = true } = {}) {
  const cells = formatCells(v, { quote });
  const leftAlign = v.type === 'character';
  const cellWidth = Math.max(...cells.map((c) => c.length));
  const n = cells.length;
  const indexLabelWidth = `[${n}]`.length;
  const perLine = Math.max(1, Math.floor((width - indexLabelWidth) / (cellWidth + 1)));
  const lines = [];
  for (let i = 0; i < n; i += perLine) {
    const chunk = cells.slice(i, i + perLine).map((c) => padCell(c, cellWidth, leftAlign));
    // Trailing padding on the last cell of a line is invisible, and R omits it.
    lines.push(`${padLeft(`[${i + 1}]`, indexLabelWidth)} ${chunk.join(' ')}`.replace(/\s+$/, ''));
  }
  return lines;
}

/**
 * A named vector prints as paired rows: names above, values below -- every column
 * as wide as the widest name or value, as R does. With one long name
 * (`bardzo dobrze` in a table of survey answers) that makes all columns wide.
 */
function formatNamedVector(v, names, width) {
  const cells = formatCells(v);
  const labels = names.values.map((x) => (isNA(x) ? '<NA>' : String(x)));
  const common = Math.max(...cells.map((c) => c.length), ...labels.map((l) => l.length));
  const colWidths = cells.map(() => common);
  const lines = [];
  let i = 0;
  while (i < cells.length) {
    let used = 0;
    const idx = [];
    while (i < cells.length && (used + colWidths[i] + 1) <= width) {
      used += colWidths[i] + 1;
      idx.push(i);
      i++;
    }
    if (!idx.length) { idx.push(i); i++; }
    lines.push(idx.map((k) => padLeft(labels[k] || '', colWidths[k])).join(' ') + ' ');
    lines.push(idx.map((k) => padLeft(cells[k], colWidths[k])).join(' ') + ' ');
  }
  return lines;
}

/** A factor shows its labels without quotes, then the level set in order. */
function formatFactor(v, width) {
  const levels = getAttr(v, 'levels');
  const labels = levels ? levels.values : [];
  const shown = v.values.map((code) => (isNA(code) ? '<NA>' : String(labels[code - 1] ?? '<NA>')));
  const lines = shown.length
    // Unquoted from the start: the line width must not count quotes R never prints.
    ? formatPlainVector({ kind: 'atomic', type: 'character', values: shown, attributes: null }, width, { quote: false })
    : ['factor(0)'];
  return [...lines, levelsLine(labels.map(String), width)];
}

/**
 * R's `print.factor` keeps the level line on one line: when it would not fit, it
 * shows the first levels, "...", the last one, and the count in front --
 * `5 Levels: bardzo zle ... bardzo dobrze` in a narrow console.
 */
function levelsLine(lev, width) {
  const n = lev.length;
  const room = width - ('Levels: '.length + 3 + 1 + 3);
  let total = 0;
  const cum = lev.map((l) => (total += l.length + 1));
  let maxl = n;
  if (n > 1 && cum[n - 1] > room) maxl = Math.max(1, cum.findIndex((c) => c > room));
  if (n <= maxl) return `Levels: ${lev.join(' ')}`;
  const shown = [...lev.slice(0, Math.max(1, maxl - 1)), '...', ...(maxl > 1 ? [lev[n - 1]] : [])];
  return `${n} Levels: ${shown.join(' ')}`;
}

function formatList(v, width, prefix = '') {
  const names = getNames(v);
  const out = [];
  if (rLength(v) === 0) return ['list()'];
  v.values.forEach((el, i) => {
    const nm = names && names.values[i] && !isNA(names.values[i]) ? `$${names.values[i]}` : `[[${i + 1}]]`;
    out.push(prefix + nm);
    const inner = formatValue(el, { width });
    out.push(...inner.map((l) => prefix + l));
    out.push('');
  });
  return out;
}

function formatFunction(v) {
  if (v.kind === 'builtin') return [`function (...)  .Primitive("${v.name}")`];
  return (v.src || 'function(...) ...').split('\n');
}

/** A data.frame: columns padded to a common width, row numbers on the left. */
function formatDataFrame(v, width) {
  const names = getNames(v);
  const colNames = names ? names.values.map(String) : v.values.map((_, i) => `V${i + 1}`);
  const nrow = v.values.length ? rLength(v.values[0]) : 0;
  if (nrow === 0 || v.values.length === 0) {
    return [`data frame with 0 columns and ${nrow} rows`];
  }
  const cols = v.values.map((col) => {
    if (isFactor(col)) {
      const levels = getAttr(col, 'levels');
      const labels = levels ? levels.values : [];
      return col.values.map((c) => (isNA(c) ? '<NA>' : String(labels[c - 1] ?? '<NA>')));
    }
    // In a table R marks a missing text as <NA>, so it cannot be read as the word "NA".
    if (col.type === 'character') return col.values.map((x) => (isNA(x) ? '<NA>' : String(x)));
    return formatCells(col, { quote: false });
  });
  // R prints the row.names attribute, not a fresh 1..n counter. That is how you can
  // see, after df[df$x > 2, ], WHICH original rows survived -- a detail dplyr hides,
  // because its verbs renumber from 1.
  const rn = getAttr(v, 'row.names');
  const rowLabels = rn && rLength(rn) === nrow
    ? rn.values.map((x) => (isNA(x) ? 'NA' : String(x)))
    : Array.from({ length: nrow }, (_, i) => String(i + 1));
  const rowW = Math.max(...rowLabels.map((s) => s.length));
  const colW = cols.map((c, i) => Math.max(colNames[i].length, ...c.map((s) => s.length)));

  const header = ' '.repeat(rowW) + colNames.map((nm, i) => ' ' + padLeft(nm, colW[i])).join('');
  const lines = [header];
  for (let r = 0; r < nrow; r++) {
    // Row labels are left-aligned in R: "9 " above "10", which only shows from ten rows up.
    lines.push(rowLabels[r].padEnd(rowW) + cols.map((c, i) => ' ' + padLeft(c[r] ?? '', colW[i])).join(''));
  }
  return lines;
}

/**
 * Format a single raw value the way R would print it -- for panels that carry plain
 * JS values rather than whole vectors. Without this, a group mean shows up as
 * 39.666666666666664 while the console next to it says 39.66667.
 */
export function formatScalar(x, type = 'double') {
  if (x === null || x === undefined || isNA(x)) return 'NA';
  if (type === 'logical' || typeof x === 'boolean') return x ? 'TRUE' : 'FALSE';
  if (typeof x !== 'number') return String(x);
  if (Number.isNaN(x)) return 'NaN';
  if (!Number.isFinite(x)) return x > 0 ? 'Inf' : '-Inf';
  if (type === 'integer' || Number.isInteger(x)) return String(x);
  return String(Number(x.toPrecision(DIGITS)));
}

/** A compact one-line summary for chips and tooltips in the UI. */
export function inlineSummary(v) {
  if (isNull(v)) return 'NULL';
  if (isFunction(v)) return t('val.function');
  const n = rLength(v);
  const cls = rClass(v)[0];
  if (isAtomic(v)) {
    const cells = formatCells(v).slice(0, 4);
    const tail = n > 4 ? ' …' : '';
    return `${cls}[${n}]: ${cells.join(' ')}${tail}`;
  }
  return `${cls}[${n}]`;
}

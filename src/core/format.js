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

import { deparse as deparseAes } from './deparse.js';
import {
  NA, isNA, isAtomic, isList, isNull, isFunction, rLength, getNames, getAttr,
  isFactor, isDataFrame, rClass, hasClass, mkCharacter, mkDouble,
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
function useScientific(values, digits = DIGITS) {
  const finite = values.filter((v) => !isNA(v) && Number.isFinite(v) && v !== 0);
  if (!finite.length) return false;

  const nsmall = Math.max(0, ...finite.map((x) => decimalsNeeded(x, digits)));
  const fixedWidth = Math.max(...finite.map((x) => x.toFixed(nsmall).length));

  const nsig = sciDigitsNeeded(finite, digits);
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
  // Every mantissa gets the vector's common number of digits, as in R:
  // c(-5e-05, 1.04e-06) prints as -5.00e-05 1.04e-06.
  const s = x.toExponential(Math.max(0, nsig - 1));
  const [m, exp] = s.split('e');
  const sign = exp[0] === '-' ? '-' : '+';
  const digitsPart = exp.replace(/^[+-]/, '').padStart(2, '0');
  return `${m}e${sign}${digitsPart}`;
}

/** Format one atomic vector's cells as strings, already aligned in width. */
export function formatCells(v, { quote = true, digits = DIGITS } = {}) {
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
  if (useScientific(vals, digits)) {
    const finite = vals.filter((v) => !isNA(v) && Number.isFinite(v) && v !== 0);
    const nsig = sciDigitsNeeded(finite, digits);
    return vals.map((x) => formatScientific(x, nsig));
  }
  const nsmall = Math.max(0, ...vals.filter((x) => !isNA(x) && Number.isFinite(x)).map((x) => decimalsNeeded(x, digits)));
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
  // A plot prints nothing in the console: R draws it in the Plots pane instead.
  if (v.gg) return [];
  if (v.part) return [`<${v.part.fname || v.part.kind}>`];
  if (v.formula) return [deparseAes(v.formula.node)];
  if (v.callText) return [v.callText];
  if (v.lm && hasClass(v, 'lm')) return formatModel(v, width);
  if (v.slm) return formatModelSummary(v, width);
  if (isAtomic(v) && getAttr(v, 'dim')?.values.length === 2) return formatMatrix(v, width);
  if (v.aes) return ['Aesthetic mapping:', ...Object.entries(v.aes.mapping).map(([k, e]) => `* \`${k}\` -> \`${deparseAes(e)}\``)];
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
function formatNamedVector(v, names, width, { gap = 1, cells = formatCells(v) } = {}) {
  const labels = names.values.map((x) => (isNA(x) ? '<NA>' : String(x)));
  const common = Math.max(...cells.map((c) => c.length), ...labels.map((l) => l.length));
  const colWidths = cells.map(() => common);
  const lines = [];
  let i = 0;
  while (i < cells.length) {
    let used = 0;
    const idx = [];
    while (i < cells.length && (used + colWidths[i] + gap) <= width) {
      used += colWidths[i] + gap;
      idx.push(i);
      i++;
    }
    if (!idx.length) { idx.push(i); i++; }
    const sep = ' '.repeat(gap);
    lines.push(idx.map((k) => padLeft(labels[k] || '', colWidths[k])).join(sep) + sep);
    lines.push(idx.map((k) => padLeft(cells[k], colWidths[k])).join(sep) + sep);
  }
  return lines;
}

/**
 * print.lm: the call, then the coefficients formatted together to 4 significant
 * digits (R's digits - 3) and printed as a named row with two spaces between columns.
 */
function formatModel(v, width) {
  const names = getNames(v).values;
  const coef = v.values[names.indexOf('coefficients')];
  const lines = ['', 'Call:', v.lm.callText, ''];
  if (!coef.values.length) return [...lines, 'No coefficients', ''];
  const cells = formatCells(coef, { digits: 4 });
  return [...lines, 'Coefficients:', ...formatNamedVector(coef, getNames(coef), width, { gap: 2, cells }), ''];
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
  if (v.values.length === 0) {
    return [`data frame with 0 columns and ${nrow} rows`];
  }
  // Columns but no rows (a filter nobody passed): R names the columns, then says so.
  if (nrow === 0) {
    return [...formatPlainVector(mkCharacter(colNames), width, { quote: false }), '<0 rows> (or 0-length row.names)'];
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
  if (v.formula) return deparseAes(v.formula.node);
  const n = rLength(v);
  const cls = rClass(v)[0];
  if (isAtomic(v)) {
    const cells = formatCells(v).slice(0, 4);
    const tail = n > 4 ? ' …' : '';
    return `${cls}[${n}]: ${cells.join(' ')}${tail}`;
  }
  return `${cls}[${n}]`;
}

// ---------------------------------------------------------------------------
// summary() of a model and numeric matrices (D96)
// ---------------------------------------------------------------------------

const EPS = 2.220446049250313e-16;              // .Machine$double.eps
const dblCells = (values, digits) => formatCells({ kind: 'atomic', type: 'double', values, attributes: null }, { digits });
const signif = (x, d) => Number(Number(x).toPrecision(d));

/** C's "%.{d}g", which formatC(x, digits = d) uses: trailing zeros dropped. */
export function formatG(x, d) {
  if (isNA(x)) return 'NA';
  if (!Number.isFinite(x)) return Number.isNaN(x) ? 'NaN' : x > 0 ? 'Inf' : '-Inf';
  if (x === 0) return '0';
  const s = signif(x, d);
  const X = Math.floor(Math.log10(Math.abs(s)) + 1e-12);
  if (X < -4 || X >= d) {
    const [mant, exp] = s.toExponential(d - 1).split('e');
    const m = mant.includes('.') ? mant.replace(/0+$/, '').replace(/\.$/, '') : mant;
    const e = Number(exp);
    return `${m}e${e < 0 ? '-' : '+'}${String(Math.abs(e)).padStart(2, '0')}`;
  }
  const f = s.toFixed(Math.max(0, d - 1 - X));
  return f.includes('.') ? f.replace(/0+$/, '').replace(/\.$/, '') : f;
}

/**
 * format.pval() of R 4.6: p-values from 1e-4 up are formatted together, smaller ones
 * together, and those below the machine epsilon as "<2e-16".
 */
export function formatPval(pvs, digits) {
  const out = new Array(pvs.length);
  const idx = pvs.map((_, i) => i);
  const is0 = idx.filter((i) => pvs[i] < EPS);
  const rest = idx.filter((i) => !(pvs[i] < EPS));
  const expo = (p) => Math.floor(Math.log10(p > 0 ? p : 1e-50));
  const fix = rest.filter((i) => expo(pvs[i]) >= -3 || (expo(pvs[i]) === -4 && digits > 1));
  const sci = rest.filter((i) => !fix.includes(i));
  for (const group of [fix, sci]) {
    if (!group.length) continue;
    const cells = dblCells(group.map((i) => pvs[i]), digits);
    group.forEach((i, k) => { out[i] = cells[k]; });
  }
  if (is0.length) {
    let d = Math.max(1, digits - 2);
    let sep;
    if (rest.length) {
      const nc = Math.max(...rest.map((i) => out[i].length));
      if (d > 1 && d + 6 > nc) d = Math.max(1, nc - 7);
      sep = d === 1 && nc <= 6 ? '' : ' ';
    } else sep = d === 1 ? '' : ' ';
    const e = dblCells([EPS], d)[0];
    for (const i of is0) out[i] = `<${sep}${e}`;
  }
  return out;
}

/** A character matrix as print(quote = FALSE, right = TRUE) lays it out. */
function charMatrix(rowNames, colNames, cols, { left = false } = {}) {
  const rw = Math.max(0, ...rowNames.map((s) => s.length));
  const widths = cols.map((c, j) => Math.max(colNames[j].length, ...c.map((s) => s.length)));
  const pad = left ? padRight : padLeft;
  const lines = [' '.repeat(rw) + colNames.map((h, j) => ` ${pad(h, widths[j])}`).join('')];
  rowNames.forEach((rn, i) => lines.push(padRight(rn, rw) + cols.map((c, j) => ` ${pad(c[i], widths[j])}`).join('')));
  return lines;
}

/** printCoefmat() with summary.lm's digits = 4. */
function coefTable(rowsAll, rowNames, digits = 4) {
  const tstDigits = Math.max(1, Math.min(5, digits - 1));
  const okRows = rowsAll.filter((r) => r);
  const cs = okRows.flatMap((r) => [r.est, r.se]).filter((v) => Number.isFinite(v));
  const nz = cs.map(Math.abs).filter((v) => v !== 0);
  const digmin = nz.length ? [Math.min(...nz), Math.max(...nz)].map((v) => 1 + Math.floor(Math.log10(v))) : [1, 1];
  const dec = Math.max(1, digits - digmin[0], digits - digmin[1]);
  const round = (v, d) => Math.round(v * 10 ** d) / 10 ** d;
  const csCells = dblCells(okRows.flatMap((r) => [round(r.est, dec), round(r.se, dec)]), digits);
  const tCells = dblCells(okRows.map((r) => round(r.t, tstDigits)), digits);
  const pCells = formatPval(okRows.map((r) => r.p), tstDigits);
  // A value that is not 0 but printed as 0 gets one digit less, on its own (printCoefmat).
  const fixZero = (v, cell) => ((v === 0) !== (Number(cell) === 0) ? dblCells([v], Math.max(1, digits - 1))[0] : cell);
  const est = []; const se = []; const tv = []; const pv = []; const stars = [];
  const anyStars = okRows.some((r) => r.p < 0.1);
  let k = 0;
  for (const r of rowsAll) {
    if (!r) { est.push('NA'); se.push('NA'); tv.push('NA'); pv.push('NA'); stars.push(''); continue; }
    est.push(fixZero(r.est, csCells[2 * k]));
    se.push(fixZero(r.se, csCells[2 * k + 1]));
    tv.push(tCells[k]);
    pv.push(pCells[k]);
    stars.push(r.p <= 0.001 ? '***' : r.p <= 0.01 ? '**' : r.p <= 0.05 ? '*' : r.p <= 0.1 ? '.' : ' ');
    k++;
  }
  const names = ['Estimate', 'Std. Error', 't value', 'Pr(>|t|)'];
  const cols = [est, se, tv, pv];
  if (anyStars) { names.push(''); cols.push(stars.map((s) => padRight(s, 3))); }
  return { lines: charMatrix(rowNames, names, cols), stars: anyStars };
}

/** print.summary.lm(), line for line. */
function formatModelSummary(v, width) {
  const s = v.slm;
  const lines = ['', 'Call:', s.callText, '', 'Residuals:'];
  const named = (vals, names) => {
    const vec = mkDouble(vals, { names: mkCharacter(names) });
    return formatNamedVector(vec, getNames(vec), width, { cells: dblCells(vals, 4) });
  };
  if (s.rdf > 5) {
    // zapsmall(q, 5) of R 4.6: digits - log10(max), which round() takes to the nearest whole number.
    const mx = Math.max(...s.quantiles.map(Math.abs));
    const zd = Math.round(mx > 0 ? Math.max(0, 5 - Math.log10(mx)) : 5);
    lines.push(...named(s.quantiles.map((q) => Math.round(q * 10 ** zd) / 10 ** zd), ['Min', '1Q', 'Median', '3Q', 'Max']));
  } else if (s.rdf > 0) {
    lines.push(...named(s.residuals, s.usedNames));
  } else {
    lines.push(`ALL ${s.p} residuals are 0: no residual degrees of freedom!`);
  }
  const nsing = s.aliased.filter(Boolean).length;
  lines.push('', nsing ? `Coefficients: (${nsing} not defined because of singularities)` : 'Coefficients:');
  let k = 0;
  const rowsAll = s.colNames.map((name, j) => (s.aliased[j] ? null : s.rows[k++]));
  const table = coefTable(rowsAll, s.colNames);
  lines.push(...table.lines);
  if (table.stars) lines.push('---', "Signif. codes:  0 '***' 0.001 '**' 0.01 '*' 0.05 '.' 0.1 ' ' 1");
  lines.push('', `Residual standard error: ${dblCells([signif(s.sigma, 4)], 7)[0]} on ${s.rdf} degrees of freedom`);
  if (s.dropped) lines.push(`  (${s.dropped} observation${s.dropped === 1 ? '' : 's'} deleted due to missingness)`);
  if (s.fstat) {
    // formatC(x, digits = 4) pads to digits + 1 characters: "    1", " 11.4".
    const fc = (x) => formatG(x, 4).padStart(5);
    lines.push(`Multiple R-squared:  ${fc(s.r2)},\tAdjusted R-squared:  ${fc(s.adj)} `);
    lines.push(`F-statistic: ${fc(s.fstat.value)} on ${s.fstat.numdf} and ${s.fstat.dendf} DF,  p-value: ${formatPval([s.fp], 4)[0]}`);
  }
  lines.push('');
  return lines;
}

/** A numeric matrix as print() shows it: each column formatted on its own (7 digits). */
function formatMatrix(v, width) {
  const dim = getAttr(v, 'dim').values;
  const [nr, nc] = dim;
  const dn = getAttr(v, 'dimnames');
  const rowNames = dn?.values?.[0]?.values?.map(String) || Array.from({ length: nr }, (_, i) => `[${i + 1},]`);
  const colNames = dn?.values?.[1]?.values?.map(String) || Array.from({ length: nc }, (_, j) => `[,${j + 1}]`);
  // A character table, such as summary() of a data.frame, prints as print.table() does:
  // no quotes, left-justified, NA as an empty cell.
  const table = v.type === 'character' && hasClass(v, 'table');
  const cols = Array.from({ length: nc }, (_, j) => {
    const col = { kind: 'atomic', type: v.type, values: v.values.slice(j * nr, (j + 1) * nr), attributes: null };
    return table ? col.values.map((x) => (isNA(x) ? '' : String(x))) : formatCells(col, { quote: true });
  });
  // Columns that do not fit the console go on below, as R does.
  const rw = Math.max(0, ...rowNames.map((s) => s.length));
  const widths = cols.map((c, j) => Math.max(colNames[j].length, ...c.map((s) => s.length)));
  const out = [];
  let j = 0;
  while (j < nc) {
    let used = rw;
    const chunk = [];
    while (j < nc && (chunk.length === 0 || used + 1 + widths[j] <= width)) { used += 1 + widths[j]; chunk.push(j); j++; }
    out.push(...charMatrix(rowNames, chunk.map((c) => colNames[c]), chunk.map((c) => cols[c]), { left: table }));
  }
  return out;
}

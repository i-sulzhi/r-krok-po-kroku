/**
 * "W arkuszu": the same step as the spreadsheet the learner already knows would do it.
 *
 * Most learners have kept survey data in Excel before they meet R, and the places
 * where the two disagree are exactly where R surprises them. A scene can ask for one
 * of three contrasts (scene `show.excel`); each panel is built from the values the
 * R step actually used, so the sheet and the R picture always show the same data:
 *
 *   mixed  c(23, "brak danych", ...)  a sheet column keeps a type per cell (numbers
 *          right-aligned, text left); R turns the whole vector into text
 *   fill   x * 20                     a formula typed once and dragged down, one per
 *          row; R does the whole column in one expression
 *   blank  mean(x) with NA             AVERAGE skips empty cells without a word; R
 *          answers NA until told what to do with the gaps
 *
 * The panel sits beside the R picture, labelled, so the learner compares rather than
 * reads.
 */

import { el } from '../dom.js';
import { isNA, isAtomic } from '../../core/rvalue.js';
import { t } from '../../i18n/index.js';

/** Excel function names as a Polish Excel shows them. */
const XL_FN = { mean: 'ŚREDNIA', sum: 'SUMA', max: 'MAX', min: 'MIN', median: 'MEDIANA' };

/** A number the way a Polish spreadsheet shows it: decimal comma, no trailing zeros. */
const xlNumber = (x) => String(Math.round(x * 1000) / 1000).replace('.', ',');

/**
 * A small sheet: letters on top, row numbers on the left, row 1 the names.
 * @param {Array<{letter, name, cells: Array<{text, kind, formula?}>}>} cols
 * @param {Object} [footer]  {label, cells} -- one extra row, e.g. a formula result
 */
function sheet(cols, footer = null) {
  const n = Math.max(...cols.map((c) => c.cells.length));
  const cell = (c) => el('td', { class: `xl-cell xl-${c.kind}` },
    c.formula ? el('div.xl-formula', c.formula) : null,
    el('div.xl-value', c.text));
  return el('div.xl',
    el('table.xl-table',
      el('thead',
        el('tr.xl-letters', el('th.xl-corner', ''), cols.map((c) => el('th', c.letter))),
        el('tr', el('th.xl-rownum', '1'), cols.map((c) => el('th.xl-name', c.name)))),
      el('tbody',
        Array.from({ length: n }, (_, r) => el('tr',
          el('th.xl-rownum', String(r + 2)),
          cols.map((c) => (c.cells[r] ? cell(c.cells[r]) : el('td.xl-cell'))))),
        footer ? el('tr.xl-footer',
          el('th.xl-rownum', String(n + 2)),
          footer.cells.map((c) => (c ? cell(c) : el('td.xl-cell')))) : null)));
}

const valueCell = (x, type) => {
  if (isNA(x)) return { text: '', kind: 'empty' };
  if (type === 'character') return { text: String(x), kind: 'text' };
  if (type === 'logical') return { text: x ? 'PRAWDA' : 'FAŁSZ', kind: 'logical' };
  return { text: xlNumber(x), kind: 'num' };
};

/** c(...) of single values: each part keeps its own type in a sheet column. */
function mixed(parts, spec) {
  const cells = parts.flatMap((p) => (p && isAtomic(p) ? p.values.map((x) => valueCell(x, p.type)) : []));
  return {
    pic: sheet([{ letter: spec.col || 'C', name: spec.name || '', cells }]),
    note: t('xl.mixed'),
  };
}

/** x <op> k: a formula per row, dragged down. */
function fill(left, right, result, op, spec) {
  if (!left || !result || !isAtomic(left) || !isAtomic(result)) return null;
  const col = spec.col || 'D';
  const next = String.fromCharCode(col.charCodeAt(0) + 1);
  const k = right && isAtomic(right) && right.values.length === 1 ? right.values[0] : null;
  const shown = k == null ? '?' : xlNumber(k);
  const xlOp = { '*': '*', '/': '/', '+': '+', '-': '-', '^': '^' }[op] || op;
  return {
    pic: sheet([
      { letter: col, name: spec.name || '', cells: left.values.map((x) => valueCell(x, left.type)) },
      { letter: next, name: '', cells: result.values.map((x, r) => ({ ...valueCell(x, result.type), formula: `=${col}${r + 2}${xlOp}${shown}` })) },
    ]),
    note: t('xl.fill', { n: result.values.length }),
  };
}

/** mean(x) etc. with gaps: the sheet function skips empty cells silently. */
function blank(input, fname, spec) {
  if (!input || !isAtomic(input)) return null;
  const col = spec.col || 'D';
  const present = input.values.filter((x) => !isNA(x));
  const gaps = input.values.length - present.length;
  const xl = XL_FN[fname] || fname.toUpperCase();
  const agg = {
    mean: () => present.reduce((a, b) => a + b, 0) / present.length,
    sum: () => present.reduce((a, b) => a + b, 0),
    max: () => Math.max(...present),
    min: () => Math.min(...present),
  }[fname];
  const range = `${col}2:${col}${input.values.length + 1}`;
  return {
    pic: sheet(
      [{ letter: col, name: spec.name || '', cells: input.values.map((x) => valueCell(x, input.type)) }],
      { cells: [{ text: agg && present.length ? xlNumber(agg()) : '', kind: 'num', formula: `=${xl}(${range})` }] },
    ),
    note: t('xl.blank', { n: gaps }),
  };
}

/**
 * The spreadsheet panel for one R step, or null when this step has no spreadsheet
 * counterpart of the requested kind.
 * @param {Object} spec    scene show.excel: {kind, col?, name?}
 * @param {Object} parts   {parts, left, right, result, op, input, fname} from the stage
 */
export function sheetPanel(spec, parts) {
  if (!spec) return null;
  // Each contrast belongs to one shape of step; on any other step there is no
  // honest spreadsheet counterpart, and a made-up one would teach nonsense.
  if (spec.kind === 'mixed') return parts.fname === 'c' && parts.parts ? mixed(parts.parts, spec) : null;
  if (spec.kind === 'fill') return parts.op && parts.left ? fill(parts.left, parts.right, parts.result, parts.op, spec) : null;
  if (spec.kind === 'blank') return XL_FN[parts.fname] ? blank(parts.input, parts.fname, spec) : null;
  return null;
}

/** The R picture and the sheet side by side: "W arkuszu" | "W R". */
export function sideBySide(sheetPart, rPic) {
  return el('div.pic-vs',
    el('div.pic-vs-side.pic-vs-sheet',
      el('div.pic-vs-label', t('xl.inSheet')),
      sheetPart.pic,
      el('div.pic-vs-note', sheetPart.note)),
    el('div.pic-vs-side.pic-vs-r',
      el('div.pic-vs-label', t('xl.inR')),
      rPic));
}

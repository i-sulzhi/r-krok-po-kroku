/**
 * Drawing an R value.
 *
 * The central visual claim of the trainer: a vector is a numbered row of cells, and
 * its type is a property of the row, not of each cell. Type is carried by colour, so
 * when `c(1, "a")` coerces, the student *sees* every cell change colour at once
 * rather than reading that it happened.
 *
 * A factor is drawn as what it actually is -- a row of integer codes plus a separate
 * table of levels, with the lookup drawn between them. Almost every factor question
 * a student asks dissolves once they have seen that picture.
 *
 * Three sizes: full (`renderValue`), mini (`renderMini`, a strip of coloured dots
 * with the first values, for chips and memory) and thumbnail (`renderThumb`, a
 * table as a grid of coloured squares, for pipelines).
 */

import { el } from '../dom.js';
import {
  isNA, isAtomic, isList, isNull, isFunction, rLength, getNames, getAttr,
  isFactor, isDataFrame,
} from '../../core/rvalue.js';
import { formatCells } from '../../core/format.js';
import { t } from '../../i18n/index.js';

/** How many cells to draw before collapsing the middle. */
const MAX_CELLS = 40;
/** How many table rows to draw before collapsing. */
const MAX_ROWS = 25;

/** The type a value is drawn in: factors get their own colour. */
export const drawType = (v) => (v && isFactor(v) ? 'factor' : v?.type || 'null');

export const typeLabel = (v) => {
  if (!v) return '';
  if (isNull(v)) return 'NULL';
  if (isDataFrame(v)) return t('badge.table');
  if (isFactor(v)) return t('badge.factor');
  if (isList(v)) return t('badge.list');
  return t(`badge.${v.type}`);
};

/**
 * Render any R value.
 * @param {Object} v
 * @param {Object} opts
 *   highlight  -- indices (0-based) to emphasise
 *   dim        -- indices to fade (not selected)
 *   changed    -- indices drawn as freshly written
 *   crossed    -- indices struck out (dropped from a computation)
 *   label      -- caption above the value, e.g. a variable name
 *   compact    -- smaller cells
 */
export function renderValue(v, opts = {}) {
  if (v == null) return el('span.rv-missing', '—');
  if (isNull(v)) return el('div.rv-null', 'NULL');
  if (isFunction(v)) return el('div.rv-function', v.kind === 'builtin' ? `${v.name}()` : 'function(...)');
  if (isFactor(v)) return renderFactor(v, opts);
  if (isDataFrame(v)) return renderDataFrame(v, opts);
  if (isList(v)) return renderList(v, opts);
  if (isAtomic(v)) return renderVector(v, opts);
  return el('div.rv-unknown', String(v.kind));
}

/** An atomic vector: cells, index strip, and a type badge. */
export function renderVector(v, opts = {}) {
  const {
    highlight = null, dim = null, changed = null, crossed = null, label = null,
    compact = false, showType = true, showIndex = true, reusedFrom = null, cellClass = null,
    foot = null,
  } = opts;

  const n = rLength(v);
  const cells = formatCells(v);
  const names = getNames(v);
  const hi = highlight ? new Set(highlight) : null;
  const dimmed = dim ? new Set(dim) : null;
  const fresh = changed ? new Set(changed) : null;
  const struck = crossed ? new Set(crossed) : null;

  if (n === 0) {
    return el('div.rv-vector.rv-empty', { dataset: { type: v.type } },
      label && el('div.rv-label', label),
      el('div.rv-cells', el('div.rv-cell.rv-cell-empty', t('val.empty'))),
      showType && typeBadge(v, 0));
  }

  const cellNodes = [];
  for (const i of visibleIndices(n)) {
    if (i === '…') { cellNodes.push(el('div.rv-gap', '…')); continue; }
    const classes = ['rv-cell'];
    if (isNA(v.values[i])) classes.push('rv-na');
    if (hi && hi.has(i)) classes.push('rv-hi');
    if (dimmed && dimmed.has(i)) classes.push('rv-dim');
    if (fresh && fresh.has(i)) classes.push('rv-fresh');
    if (struck && struck.has(i)) classes.push('rv-crossed');
    if (reusedFrom && reusedFrom[i] !== undefined && reusedFrom[i] !== i) classes.push('rv-reused');
    if (cellClass) { const extra = cellClass(i); if (extra) classes.push(extra); }

    cellNodes.push(el('div', { class: classes.join(' '), dataset: { index: i } },
      names && !isNA(names.values[i]) && names.values[i] !== ''
        ? el('div.rv-name', String(names.values[i]))
        : null,
      el('div.rv-value', cells[i]),
      showIndex ? el('div.rv-index', `[${i + 1}]`) : null,
      foot ? el('div.rv-foot', foot(i)) : null));
  }

  return el('div.rv-vector', { dataset: { type: v.type }, class: compact ? 'rv-compact' : '' },
    label && el('div.rv-label', label),
    el('div.rv-cells', cellNodes),
    showType && typeBadge(v, n));
}

/** Collapse the middle of a long vector so the ends stay readable. */
export function visibleIndices(n, max = MAX_CELLS) {
  if (n <= max) return Array.from({ length: n }, (_, i) => i);
  const head = Array.from({ length: max - 8 }, (_, i) => i);
  const tail = Array.from({ length: 6 }, (_, i) => n - 6 + i);
  return [...head, '…', ...tail];
}

export function typeBadge(v, n = rLength(v)) {
  return el('div.rv-type', { dataset: { type: drawType(v) }, title: `typeof = "${v.type}", length = ${n}` },
    el('span.rv-type-name', typeLabel(v)),
    el('span.rv-type-len', String(n)));
}

/** Labels of a factor, one per element ("NA" for missing codes). */
export function factorLabels(v) {
  const levels = getAttr(v, 'levels');
  const labels = levels ? levels.values.map(String) : [];
  return v.values.map((code) => (isNA(code) ? null : labels[code - 1] ?? null));
}

/**
 * A factor, drawn in both of its layers at once: the labels you see, the codes
 * actually stored, and the level table the codes point into.
 * `emphasis: 'codes' | 'labels' | 'levels'` lights up one layer.
 */
export function renderFactor(v, opts = {}) {
  const levels = getAttr(v, 'levels');
  const labels = levels ? levels.values.map(String) : [];
  // counts: how many elements use each level -- in the codebook, a level with 0 is
  // an answer nobody chose, kept because the levels were declared.
  // lit: a code lit up on arrival -- a scene pointing at "this answer, this level".
  const { highlight = null, label = null, emphasis = null, counts = false, lit = null } = opts;
  const hi = highlight ? new Set(highlight) : null;
  const shown = factorLabels(v);
  const idx = visibleIndices(v.values.length);

  // Each label stands on its own code, as one column that wraps as a unit. Two
  // separate rows drift apart as soon as the labels are words: "bardzo dobrze"
  // wraps, the digit under it does not, and the picture's one claim -- this code
  // is under that label -- is lost.
  // Point at an answer and its level lights up in the codebook, and the other way
  // round: the lookup R does for every label it prints, done by hand. A click pins
  // it (a touch screen has no hover).
  let root = null;
  let pinned = lit ?? null;
  const light = (code) => {
    for (const n of root?.querySelectorAll('.rv-pair, .rv-level') || []) {
      n.classList.toggle('rv-lit', code != null && n.dataset.code === String(code));
    }
  };
  const pointable = (code) => (code == null || isNA(code) ? {} : {
    onMouseenter: () => light(code),
    onMouseleave: () => light(pinned),
    onClick: () => { pinned = pinned === code ? null : code; light(pinned); },
  });

  const pair = (i) => el('div.rv-pair', { dataset: { index: i, code: isNA(v.values[i]) ? '' : v.values[i] }, ...pointable(v.values[i]) },
    el('div', {
      class: ['rv-cell', 'rv-cell-label', shown[i] == null ? 'rv-na' : '', hi && hi.has(i) ? 'rv-hi' : ''].filter(Boolean).join(' '),
      dataset: { index: i },
    }, el('div.rv-value', shown[i] ?? 'NA'), el('div.rv-index', `[${i + 1}]`)),
    el('div.rv-pair-link'),
    el('div', {
      class: ['rv-cell', 'rv-cell-code', isNA(v.values[i]) ? 'rv-na' : '', hi && hi.has(i) ? 'rv-hi' : ''].filter(Boolean).join(' '),
      dataset: { index: i, code: isNA(v.values[i]) ? '' : v.values[i] },
    }, el('div.rv-value', isNA(v.values[i]) ? 'NA' : String(v.values[i]))));

  root = el('div.rv-factor', { dataset: { emphasis: emphasis || '' } },
    label && el('div.rv-label', label),
    el('div.rv-key',
      el('span.rv-key-item.rv-key-labels', t('val.factorShown')),
      el('span.rv-key-item.rv-key-codes', t('val.factorStored')),
      // Pointing is the one thing here nobody would guess; say it once, quietly.
      counts ? el('span.rv-key-hint', t('val.factorPoint')) : null),
    el('div.rv-pairs', idx.map((i) => (i === '…' ? el('div.rv-gap', '…') : pair(i)))),
    el('div.rv-layer.rv-layer-levels',
      el('div.rv-layer-title', t('val.factorLevels', { n: labels.length })),
      el('div.rv-levels', labels.map((lab, k) => {
        const n = counts ? v.values.filter((c) => c === k + 1).length : null;
        return el('div', { class: ['rv-level', n === 0 ? 'rv-level-empty' : ''].filter(Boolean).join(' '), dataset: { code: k + 1 }, ...pointable(k + 1) },
          el('span.rv-level-code', `${k + 1}`),
          el('span.rv-level-arrow', '→'),
          el('span.rv-level-label', lab),
          counts ? el('span.rv-level-n', `×${n}`) : null);
      }))));
  if (pinned != null) light(pinned);
  return root;
}

function renderList(v, opts = {}) {
  const names = getNames(v);
  const { label = null, highlight = null } = opts;
  const hi = highlight ? new Set(highlight) : null;

  return el('div.rv-list',
    label && el('div.rv-label', label),
    el('div.rv-list-items', v.values.map((item, i) => el('div', {
      class: ['rv-list-item', hi && hi.has(i) ? 'rv-hi' : ''].filter(Boolean).join(' '),
    },
    el('div.rv-list-key', names && names.values[i] ? `$${names.values[i]}` : `[[${i + 1}]]`),
    el('div.rv-list-value', renderValue(item, { compact: true, showType: false }))))),
    typeBadge(v));
}

/** Cells of one column as display strings (factor labels for factors). */
export function columnCells(col) {
  if (isFactor(col)) return factorLabels(col).map((s) => (s == null ? 'NA' : s));
  return formatCells(col, { quote: false });
}

/** Row index -> group number, when the table carries group_by() columns. */
export function groupIndex(v) {
  const by = getAttr(v, 'groups');
  if (!by || !isDataFrame(v)) return null;
  const names = (getNames(v)?.values || []).map(String);
  const cols = by.values.map((nm) => v.values[names.indexOf(String(nm))]).filter(Boolean);
  if (!cols.length) return null;
  const n = rLength(v.values[0]);
  const keys = Array.from({ length: n }, (_, i) => cols.map((c) => String(columnCells(c)[i])).join(' · '));
  const order = [...new Set(keys)].sort((a, b) => a.localeCompare(b, 'pl'));
  return { keys, order, of: (i) => order.indexOf(keys[i]) };
}

/**
 * A data.frame: a real table, each column keeping its own type colour.
 *   highlightRows / dimRows / highlightCols / dimCols -- sets of indices
 *   newCols -- columns drawn as freshly added
 */
export function renderDataFrame(v, opts = {}) {
  const names = getNames(v);
  const colNames = names ? names.values.map(String) : v.values.map((_, i) => `V${i + 1}`);
  const nrow = v.values.length ? rLength(v.values[0]) : 0;
  const {
    label = null, highlightRows = null, dimRows = null, highlightCols = null, dimCols = null,
    newCols = null, rowLabel = null, maxRows = MAX_ROWS, showBadge = true,
    cellClass = null, headClass = null, sheet = false,
  } = opts;
  const set = (x) => (x ? new Set(x) : null);
  const hiRows = set(highlightRows);
  const loRows = set(dimRows);
  const hiCols = set(highlightCols);
  const loCols = set(dimCols);
  const fresh = set(newCols);
  const groups = groupIndex(v);
  // Base R keeps the original row names after subsetting (3, 5, 8), dplyr renumbers
  // from 1 -- the picture shows whichever the value actually carries, like the console.
  const rowNames = getAttr(v, 'row.names');
  const rowName = (r) => (rowNames && rowNames.values[r] != null ? String(rowNames.values[r]) : String(r + 1));

  const cols = v.values.map(columnCells);
  const colCls = (i) => [
    hiCols && hiCols.has(i) ? 'rv-hi' : '',
    loCols && loCols.has(i) ? 'rv-dim' : '',
    fresh && fresh.has(i) ? 'rv-new' : '',
  ].filter(Boolean).join(' ');

  // sheet: drawn as a spreadsheet the learner already knows -- column letters on
  // top, the names in row 1, the data from row 2. The first lesson starts here.
  const header = el('tr',
    el('th.rv-rownum', sheet ? '1' : ''),
    colNames.map((nm, i) => el('th', { class: [colCls(i), headClass ? headClass(i) : ''].filter(Boolean).join(' '), dataset: { type: drawType(v.values[i]) } },
      el('div.rv-col-name', nm),
      sheet ? null : el('div.rv-col-type', typeLabel(v.values[i])))));
  const letters = sheet
    ? el('tr.rv-sheet-letters', el('th.rv-rownum', ''), colNames.map((_, i) => el('th', { class: colCls(i) }, sheetColumn(i))))
    : null;

  const rows = [];
  const shownRows = Math.min(nrow, maxRows);
  for (let r = 0; r < shownRows; r++) {
    const g = groups ? groups.of(r) : null;
    rows.push(el('tr', {
      class: [hiRows && hiRows.has(r) ? 'rv-hi' : '', loRows && loRows.has(r) ? 'rv-dim' : '', g != null ? `tv-g${g % 6}` : ''].filter(Boolean).join(' '),
      dataset: { row: r },
    },
    el('td.rv-rownum', rowLabel ? rowLabel(r) : sheet ? String(r + 2) : rowName(r)),
    cols.map((c, i) => el('td', {
      class: [colCls(i), c[r] === 'NA' ? 'rv-na' : '', cellClass ? cellClass(r, i) : ''].filter(Boolean).join(' '),
      dataset: { type: drawType(v.values[i]) },
    }, c[r] ?? ''))));
  }
  if (nrow > shownRows) rows.push(el('tr', el('td.rv-rownum', '…'), cols.map(() => el('td', '…'))));

  return el('div', { class: sheet ? 'rv-dataframe rv-sheet' : 'rv-dataframe' },
    label && el('div.rv-label', label),
    el('div.rv-table-scroll', el('table.rv-table', el('thead', letters, header), el('tbody', rows))),
    showBadge && el('div.rv-type', { dataset: { type: 'table' } },
      el('span.rv-type-name', t('badge.table')),
      el('span.rv-type-len', t('val.dims', { rows: nrow, cols: v.values.length })),
      groups && el('span.rv-type-groups', t('val.grouped', { by: getAttr(v, 'groups').values.join(', '), n: groups.order.length }))));
}

// --- small sizes -----------------------------------------------------------

/**
 * A value as a small inline strip: up to `max` coloured cells with values, then
 * the length. For chips next to code, the memory panel, and pipeline cards.
 */
export function renderMini(v, { max = 6 } = {}) {
  if (v == null) return el('span.mini', '—');
  if (isNull(v)) return el('span.mini.mini-null', 'NULL');
  if (isFunction(v)) return el('span.mini', 'function');
  if (isDataFrame(v)) {
    const nrow = v.values.length ? rLength(v.values[0]) : 0;
    return el('span.mini.mini-table', renderThumb(v, { small: true }), el('span.mini-len', t('val.dims', { rows: nrow, cols: v.values.length })));
  }
  if (isList(v)) return el('span.mini', el('span.mini-len', `${t('badge.list')} · ${rLength(v)}`));
  const n = rLength(v);
  const texts = isFactor(v) ? factorLabels(v).map((s) => s ?? 'NA') : formatCells(v);
  const shown = texts.slice(0, max);
  return el('span.mini', { dataset: { type: drawType(v) } },
    shown.map((s, i) => el('span', { class: ['mini-cell', isNA(v.values[i]) ? 'rv-na' : ''].filter(Boolean).join(' ') }, s)),
    n > max ? el('span.mini-more', '…') : null,
    n !== 1 ? el('span.mini-len', `${n}`) : null);
}

/**
 * A table as a grid of squares -- one square per cell, coloured by column type,
 * NA hatched, rows tinted by group. Readable at a glance: shape, types, gaps.
 */
export function renderThumb(v, { small = false, maxRows = 14, maxCols = 8, highlightRows = null, dimRows = null } = {}) {
  const nrow = v.values.length ? rLength(v.values[0]) : 0;
  const ncol = v.values.length;
  const groups = groupIndex(v);
  const hi = highlightRows ? new Set(highlightRows) : null;
  const lo = dimRows ? new Set(dimRows) : null;
  const rows = [];
  for (let r = 0; r < Math.min(nrow, maxRows); r++) {
    const g = groups ? groups.of(r) : null;
    rows.push(el('div', {
      class: ['th-row', g != null ? `tv-g${g % 6}` : '', hi && hi.has(r) ? 'th-hi' : '', lo && lo.has(r) ? 'th-dim' : ''].filter(Boolean).join(' '),
    }, v.values.slice(0, maxCols).map((col) => el('span', {
      class: ['th-cell', isNA(col.values[r]) ? 'th-na' : ''].filter(Boolean).join(' '),
      dataset: { type: drawType(col) },
    }))));
  }
  return el('div', {
    class: ['th-grid', small ? 'th-small' : ''].filter(Boolean).join(' '),
    title: t('val.dims', { rows: nrow, cols: ncol }),
  }, rows, nrow > maxRows ? el('div.th-more', '⋮') : null, ncol > maxCols ? el('div.th-more-cols', '⋯') : null);
}

/** Spreadsheet column letters: 0 -> A, 25 -> Z, 26 -> AA. */
export function sheetColumn(i) {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

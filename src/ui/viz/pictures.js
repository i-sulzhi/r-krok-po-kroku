/**
 * One picture per kind of operation.
 *
 * Each function here draws what ONE evaluated expression did, from its entry in the
 * evaluation log (its value, its arguments' values) and the trace events emitted
 * inside it. The visual vocabulary is small on purpose -- a student should meet the
 * same shapes again and again:
 *
 *   row of cells            a vector (colour = type)
 *   cells joined by lines   "this cell went there"
 *   funnel                  many values become one (mean, sum, length ...)
 *   two layers              a factor: labels on top, codes underneath
 *   table                   a data.frame; dimmed rows/columns are the ones that go
 *
 * Nothing here computes R semantics. If a picture needs a number, the number came
 * from the engine.
 */

import { el } from '../dom.js';
import {
  isNA, isAtomic, isFactor, isDataFrame, rLength, getNames, hasClass, setNames, stripAttrs, mkCharacter,
} from '../../core/rvalue.js';
import { formatCells, formatScalar } from '../../core/format.js';
import {
  renderValue, renderVector, renderFactor, renderDataFrame, renderMini, factorLabels, visibleIndices, typeLabel, drawType,
  sheetColumn,
  columnCells,
} from './value.js';
import { drawLinks } from './links.js';
import { typeLadder } from './coercion.js';
import { t } from '../../i18n/index.js';

/** Cells shown in an elementwise picture before the rest collapses into "…". */
const OP_CELLS = 12;

// ---------------------------------------------------------------------------
// small building blocks
// ---------------------------------------------------------------------------

/** One vector cell, standalone. */
export function cellBox(text, { type = null, na = false, cls = '', index = null, data = {} } = {}) {
  return el('div', {
    class: ['rv-cell', na ? 'rv-na' : '', cls].filter(Boolean).join(' '),
    dataset: { ...(type ? { type } : {}), ...data },
  }, el('div.rv-value', text), index != null ? el('div.rv-index', `[${index + 1}]`) : null);
}

const cellText = (x, type) => {
  if (x === undefined) return '';
  if (isNA(x)) return 'NA';
  if (typeof x === 'boolean') return x ? 'TRUE' : 'FALSE';
  if (typeof x === 'string') return type === 'factor' ? x : `"${x}"`;
  return formatScalar(x, type || 'double');
};

/** A labelled row: small caption on the left, content on the right. */
export function lane(label, content, cls = '') {
  return el('div', { class: ['pic-lane', cls].filter(Boolean).join(' ') },
    el('div.pic-lane-label', label),
    el('div.pic-lane-body', content));
}

/** A downward arrow with an optional label ("as.numeric()", "c()"). */
export function arrow(label = '', cls = '') {
  return el('div', { class: ['pic-arrow', cls].filter(Boolean).join(' ') },
    el('span.pic-arrow-line'),
    label ? el('code.pic-arrow-label', label) : null);
}

/** Big single result cell -- what a funnel pours into. */
function bigCell(value) {
  if (!value || !isAtomic(value)) return renderValue(value);
  const text = isFactor(value) ? (factorLabels(value)[0] ?? 'NA') : formatCells(value)[0];
  return el('div.pic-big', { dataset: { type: drawType(value) } },
    el('div', { class: ['rv-cell', 'pic-big-cell', isNA(value.values[0]) ? 'rv-na' : ''].filter(Boolean).join(' ') },
      el('div.rv-value', text ?? '')));
}

// ---------------------------------------------------------------------------
// elementwise: x * 2, x > 40, a & b
// ---------------------------------------------------------------------------

/**
 * Two operand rows at their real lengths, a result row, and a line from each
 * operand cell to the result cell it fed. A recycled operand's lines fan out --
 * which is the whole explanation of recycling, delivered as a shape.
 *
 * @param {Array} steps    ELEMENTWISE events of this node, in order
 * @param {Object} opts    {recycle, upTo, leftLabel, rightLabel, resultType}
 */
export function renderElementwise(steps, opts = {}) {
  const { recycle = null, upTo = steps.length, leftLabel = '', rightLabel = '', resultType = null } = opts;
  const op = steps[0]?.data.op || '';
  const shownSteps = steps.slice(0, OP_CELLS);
  const more = steps.length - shownSteps.length;
  const shown = Math.max(0, Math.min(upTo, shownSteps.length));
  const active = shown > 0 ? shownSteps[shown - 1].data : null;

  const lenA = recycle && recycle.data.shorter === 'left' ? recycle.data.shortLen : steps.length;
  const lenB = recycle && recycle.data.shorter === 'right' ? recycle.data.shortLen : steps.length;
  const aCells = new Array(Math.min(lenA, OP_CELLS));
  const bCells = new Array(Math.min(lenB, OP_CELLS));
  for (const s of steps) {
    if (s.data.fromA < aCells.length) aCells[s.data.fromA] = s.data.a;
    if (s.data.fromB < bCells.length) bCells[s.data.fromB] = s.data.b;
  }
  const typeOf = (x) => (typeof x === 'boolean' ? 'logical' : typeof x === 'string' ? 'character' : 'double');

  // How many result cells each operand cell fed so far: "×4" under a recycled cell
  // says in one glyph what the fan of lines says in a shape.
  const uses = { a: new Map(), b: new Map() };
  shownSteps.slice(0, shown).forEach((s) => {
    uses.a.set(s.data.fromA, (uses.a.get(s.data.fromA) || 0) + 1);
    uses.b.set(s.data.fromB, (uses.b.get(s.data.fromB) || 0) + 1);
  });

  const operand = (cells, len, activeIdx, row) => el('div.op-row', cells.map((x, i) => {
    const times = uses[row].get(i) || 0;
    return el('div', {
      class: ['rv-cell', 'op-cell', isNA(x) ? 'rv-na' : '', i === activeIdx ? 'op-active' : ''].filter(Boolean).join(' '),
      dataset: { row, idx: i, type: isNA(x) ? '' : typeOf(x) },
    }, el('div.rv-value', cellText(x, typeOf(x))), el('div.rv-index', `[${i + 1}]`),
    times > 1 ? el('div.op-times', `×${times}`) : null);
  }),
  len > cells.length ? el('div.rv-gap', '…') : null);

  const result = el('div.op-row', shownSteps.map((s, i) => {
    const done = i < shown;
    const d = s.data;
    return el('div', {
      class: ['rv-cell', 'op-cell', done ? 'op-done' : 'op-pending', i === shown - 1 ? 'op-active' : '',
        done && isNA(d.result) ? 'rv-na' : ''].filter(Boolean).join(' '),
      dataset: { row: 'r', idx: i, type: done ? (resultType || typeOf(d.result)) : '' },
    }, el('div.rv-value', done ? cellText(d.result, resultType || typeOf(d.result)) : '·'), el('div.rv-index', `[${i + 1}]`));
  }), more > 0 ? el('div.rv-gap', `… +${more}`) : null);

  const grid = el('div.op-grid',
    el('div.op-row-label', el('code', leftLabel)), operand(aCells, lenA, active?.fromA, 'a'),
    el('div.op-row-label', el('span.op-symbol', op), el('code', rightLabel)), operand(bCells, lenB, active?.fromB, 'b'),
    el('div.op-row-label.op-result-label', t('op.result')), result);

  drawLinks(grid, () => {
    const pairs = [];
    for (let i = 0; i < shown; i++) {
      const d = shownSteps[i].data;
      const to = grid.querySelector(`[data-row="r"][data-idx="${i}"]`);
      const current = i === shown - 1;
      // Once every pair is done, all lines stay visible: the fan is the lesson.
      const finished = shown === shownSteps.length;
      for (const [row, idx, reused] of [['a', d.fromA, d.reusedA], ['b', d.fromB, d.reusedB]]) {
        const from = grid.querySelector(`[data-row="${row}"][data-idx="${idx}"]`);
        pairs.push({ from, to, cls: [reused ? 'lk-reused' : '', current ? 'lk-now' : finished ? 'lk-end' : 'lk-past'].filter(Boolean).join(' ') });
      }
    }
    return pairs;
  });
  return el('div.op-panel', grid);
}

// ---------------------------------------------------------------------------
// c(): parts become one row
// ---------------------------------------------------------------------------

export function renderCombine(parts, result, coerceEv) {
  const partNodes = parts.map((p, k) => el('div.cb-part', { style: { '--i': k } },
    p.name ? el('div.cb-part-name', p.name) : null,
    renderVector(p.value, { showType: false, showIndex: false, compact: true })));
  const wrap = el('div.pic-combine',
    el('div.pic-parts', partNodes),
    arrow('c()'),
    coerceEv ? typeLadder(coerceEv.data.from, coerceEv.data.to) : null,
    el('div.pic-result', renderValue(result)));
  return wrap;
}

// ---------------------------------------------------------------------------
// many -> one: mean, sum, length, max, min, median, n()
// ---------------------------------------------------------------------------

/**
 * The funnel. `removed` marks NA cells that na.rm = TRUE threw away before the
 * computation (struck through); without it, NA cells are marked as poisoning.
 */
export function renderFunnel(input, result, { fname, naRemoved = false, pick = null, logicalCount = false } = {}) {
  const naIdx = input && isAtomic(input) ? input.values.map((x, i) => (isNA(x) ? i : -1)).filter((i) => i >= 0) : [];
  let inputPic;
  if (!input) inputPic = el('div');
  else if (isDataFrame(input)) inputPic = renderDataFrame(input, { maxRows: 8 });
  else if (isFactor(input)) inputPic = renderFactor(input);
  else {
    inputPic = renderVector(input, {
      crossed: naRemoved ? naIdx : null,
      highlight: pick,
      cellClass: (i) => (!naRemoved && naIdx.includes(i) ? 'rv-poison' : (logicalCount && input.values[i] === true ? 'rv-counted' : null)),
    });
  }
  return el('div.pic-funnel',
    el('div.pic-funnel-in', inputPic),
    el('div.pic-funnel-shape', el('code', `${fname}()`)),
    el('div.pic-funnel-out', bigCell(result)));
}

// ---------------------------------------------------------------------------
// cell by cell: is.na(x), as.numeric(x), round(x), !x, -x
// ---------------------------------------------------------------------------

/**
 * Input and output aligned column by column, one small arrow per cell: the same
 * function applied to each cell separately.
 */
export function renderMap(input, output, { label = '', lost = [] } = {}) {
  if (!input || !output || !isAtomic(input) || !isAtomic(output) || rLength(input) !== rLength(output)) {
    return el('div.pic-map', renderValue(input), arrow(label), renderValue(output));
  }
  const inTexts = isFactor(input) ? factorLabels(input).map((s) => s ?? 'NA') : formatCells(input);
  const outTexts = isFactor(output) ? factorLabels(output).map((s) => s ?? 'NA') : formatCells(output);
  const lostSet = new Set(lost);
  const cols = visibleIndices(rLength(input), 16).map((i) => (i === '…'
    ? el('div.pic-map-col.pic-map-gap', '…')
    : el('div.pic-map-col', { style: { '--i': i } },
      cellBox(inTexts[i], { type: drawType(input), na: isNA(input.values[i]), index: i }),
      el('div.pic-map-arrow', '↓'),
      cellBox(outTexts[i], { type: drawType(output), na: isNA(output.values[i]), cls: lostSet.has(i) ? 'co-lost' : '' }))));
  return el('div.pic-map',
    label ? el('code.pic-map-fn', label) : null,
    el('div.pic-map-cols', cols),
    el('div.pic-map-badges',
      el('span.pic-badge', { dataset: { type: drawType(input) } }, typeLabel(input)),
      el('span.pic-badge-arrow', '→'),
      el('span.pic-badge', { dataset: { type: drawType(output) } }, typeLabel(output))));
}

// ---------------------------------------------------------------------------
// choosing: x[3], x[-1], x[x > 40]
// ---------------------------------------------------------------------------

/**
 * The source row with the chosen cells lifted into the result row. A logical
 * index is drawn as a TRUE/FALSE row right above the cells it decides.
 */
export function renderPick(source, index, result, { positions = [], kind = 'positive' } = {}) {
  const chosen = new Set(positions.filter((p) => typeof p === 'number' && p >= 0 && p < rLength(source)));
  const n = rLength(source);
  const idx = visibleIndices(n, 24);
  const texts = isFactor(source) ? factorLabels(source).map((s) => s ?? 'NA') : formatCells(source);
  const maskVals = kind === 'logical' && index && isAtomic(index) ? index.values : null;

  const maskRow = maskVals ? el('div.op-row.pick-mask', idx.map((i) => {
    if (i === '…') return el('div.rv-gap', '…');
    const m = maskVals[i % maskVals.length];
    return el('div', {
      class: ['pick-flag', isNA(m) ? 'pick-flag-na' : m ? 'pick-flag-t' : 'pick-flag-f'].join(' '),
    }, isNA(m) ? 'NA' : m ? 'TRUE' : 'FALSE');
  })) : null;

  const srcRow = el('div.op-row', idx.map((i) => (i === '…' ? el('div.rv-gap', '…') : el('div', {
    class: ['rv-cell', isNA(source.values[i]) ? 'rv-na' : '', chosen.has(i) ? 'pick-on' : 'pick-off'].filter(Boolean).join(' '),
    dataset: { type: drawType(source), src: i },
  }, el('div.rv-value', texts[i]), el('div.rv-index', `[${i + 1}]`)))));

  const outTexts = result && isAtomic(result) ? (isFactor(result) ? factorLabels(result).map((s) => s ?? 'NA') : formatCells(result)) : [];
  const resRow = el('div.op-row.pick-result', outTexts.slice(0, 24).map((s, k) => el('div', {
    class: ['rv-cell', isNA(result.values[k]) ? 'rv-na' : ''].filter(Boolean).join(' '),
    dataset: { type: drawType(result), res: k },
    style: { '--i': k },
  }, el('div.rv-value', s), el('div.rv-index', `[${k + 1}]`))),
  outTexts.length === 0 ? el('div.rv-cell.rv-cell-empty', t('val.empty')) : null);

  const grid = el('div.pick-grid', maskRow, srcRow, el('div.pick-gap'), resRow);
  drawLinks(grid, () => positions.slice(0, 24).map((p, k) => ({
    from: grid.querySelector(`[data-src="${p}"]`),
    to: grid.querySelector(`[data-res="${k}"]`),
    cls: 'lk-pick',
  })));
  return el('div.pic-pick', grid);
}

/** df[rows, cols]: the table with the surviving rows lit, then the result. */
export function renderPickRows(source, result, { keptRows = null, rowMask = null, cols = null } = {}) {
  const nrow = source.values.length ? rLength(source.values[0]) : 0;
  const kept = keptRows ? new Set(keptRows) : null;
  const names = (getNames(source)?.values || []).map(String);
  const keepCols = cols ? new Set(cols) : null;
  return el('div.pic-rows',
    renderDataFrame(source, {
      highlightRows: kept ? [...kept] : null,
      dimRows: kept ? Array.from({ length: nrow }, (_, i) => i).filter((i) => !kept.has(i)) : null,
      dimCols: keepCols ? names.map((_, i) => i).filter((i) => !keepCols.has(names[i])) : null,
      rowLabel: rowMask ? (r) => `${r + 1} ${flagText(rowMask[r % rowMask.length])}` : null,
      maxRows: 12,
    }),
    arrow('[ , ]'),
    renderValue(result));
}

const flagText = (m) => (isNA(m) ? 'NA' : m ? '✓' : '✗');

/**
 * A condition on one column, read along the rows: the table with that column lit and
 * the answer beside it as one more column, one TRUE or FALSE per row. The same rows
 * then carry ✓ and ✗ when the mask is used in `[rows, ]`, so the two pictures meet.
 */
export function renderRowMask(df, colName, mask, maskLabel) {
  const names = (getNames(df)?.values || []).map(String);
  const at = names.indexOf(colName);
  const wide = setNames({ ...df, values: [...df.values, stripAttrs(mask)] }, mkCharacter([...names, maskLabel]));
  const last = names.length;
  return el('div.pic-rows',
    renderDataFrame(wide, {
      highlightCols: at >= 0 ? [at] : null,
      dimCols: names.map((_, i) => i).filter((i) => i !== at),
      newCols: [last],
      rowLabel: (r) => `${r + 1} ${flagText(mask.values[r])}`,
      maxRows: 12,
      showBadge: false,
    }));
}

/** df$col: the table with one column lit, then that column as a plain vector. */
export function renderDollar(source, result, name, { sheet = false } = {}) {
  const names = (getNames(source)?.values || []).map(String);
  const at = names.indexOf(name);
  // As a spreadsheet: the column leaves the sheet and lies down, each cell keeping
  // its sheet address underneath, so "D2 is [1]" is seen rather than told.
  const lying = sheet && at >= 0 && isAtomic(result)
    ? el('div.pic-lay-down', renderVector(result, { foot: (i) => `${sheetColumn(at)}${i + 2}` }))
    : renderValue(result);
  return el('div.pic-dollar',
    isDataFrame(source)
      ? renderDataFrame(source, {
        highlightCols: at >= 0 ? [at] : null,
        dimCols: names.map((_, i) => i).filter((i) => i !== at),
        maxRows: 10,
        showBadge: false,
        sheet,
      })
      : renderValue(source),
    arrow(`$${name}`),
    lying);
}

// ---------------------------------------------------------------------------
// factors
// ---------------------------------------------------------------------------

/** factor(x): text in, two layers out. */
export function renderFactorMake(input, result, { lit = null } = {}) {
  return el('div.pic-factor',
    renderValue(input),
    arrow('factor()'),
    isFactor(result) ? renderFactor(result, { counts: true, lit }) : renderValue(result));
}

/** as.numeric(f): the codes layer is what comes out. */
export function renderFactorOut(input, result, { fname, layer, trap = false }) {
  return el('div.pic-factor',
    renderFactor(input, { emphasis: layer }),
    arrow(`${fname}()`, trap ? 'pic-arrow-trap' : ''),
    renderValue(result));
}

// ---------------------------------------------------------------------------
// table(): counting bars
// ---------------------------------------------------------------------------

/**
 * @param {Object} opts
 *   absent    values R's table has no row for, drawn hollow and marked as missing
 *   max       bar scale, so two tables side by side (goal and answer) compare
 *   rowClass  (name, count) => extra class, for outlining a differing row
 *   compact   no input strip, narrow tracks: the task's goal-vs-answer view
 *   order     where absent rows belong (the goal's row order); present rows keep
 *             their own order, since a wrong order is itself what may be wrong
 */
export function renderCounts(input, result, { absent = [], max = null, rowClass = null, compact = false, order = null } = {}) {
  const names = (getNames(result)?.values || []).map(String);
  const counts = result.values.map((x) => (isNA(x) ? 0 : x));
  const scale = max || Math.max(1, ...counts);
  let rows = names.map((nm, i) => ({ nm, n: counts[i] }));
  if (absent.length && order) {
    for (const nm of absent) {
      const g = order.indexOf(nm);
      const at = rows.findIndex((r) => r.n !== null && order.indexOf(r.nm) > g);
      rows.splice(at === -1 ? rows.length : at, 0, { nm, n: null });
    }
  } else if (absent.length) {
    rows = rows.concat(absent.map((nm) => ({ nm, n: null })));
    // Numbers go back into number order, so the missing 1 stands above the 2.
    if (rows.every((r) => Number.isFinite(Number(r.nm)))) rows.sort((a, b) => Number(a.nm) - Number(b.nm));
  }
  return el('div', { class: compact ? 'pic-counts pic-counts-compact' : 'pic-counts' },
    input && !compact ? el('div.pic-counts-in', renderMini(input, { max: 12 })) : null,
    el('div.pic-bars', rows.map((r, i) => el('div', {
      class: ['pic-bar-row', r.n === null ? 'pic-bar-absent' : r.n === 0 ? 'pic-bar-zero' : '', rowClass?.(r.nm, r.n) || ''].filter(Boolean).join(' '),
      style: { '--i': i },
    },
    el('div.pic-bar-label', r.nm),
    el('div.pic-bar-track', r.n === null ? null : el('div.pic-bar', { style: { width: `${(r.n / scale) * 100}%` } })),
    el('div.pic-bar-num', r.n === null ? t('val.absentRow') : String(r.n))))));
}

// ---------------------------------------------------------------------------
// data.frame(): columns become a table
// ---------------------------------------------------------------------------

export function renderAssemble(parts, result) {
  return el('div.pic-assemble',
    el('div.pic-columns', parts.map((p, k) => el('div.pic-column', { style: { '--i': k } },
      el('div.pic-column-name', p.name || `V${k + 1}`),
      renderMini(p.value, { max: 4 })))),
    arrow('data.frame()'),
    renderValue(result));
}

// ---------------------------------------------------------------------------
// the generic machine: arguments in, value out
// ---------------------------------------------------------------------------

export function renderMachine(fname, args, result) {
  return el('div.pic-machine',
    el('div.pic-args', args.map((a, k) => el('div.pic-arg', { style: { '--i': k } },
      a.name ? el('span.pic-arg-name', `${a.name} =`) : null,
      renderMini(a.value, { max: 5 })))),
    el('div.pic-machine-box', el('code', `${fname}()`)),
    el('div.pic-result', renderValue(result)));
}

// ---------------------------------------------------------------------------
// x <- value
// ---------------------------------------------------------------------------

export function renderAssign(name, value, previous = null) {
  return el('div.pic-assign',
    previous ? el('div.pic-assign-old', el('div.pic-assign-tag', name), renderMini(previous, { max: 8 }), el('span.pic-assign-gone', t('fx.gone'))) : null,
    el('div.pic-assign-new',
      el('div.pic-assign-tag.pic-assign-tag-on', name),
      el('div.pic-assign-arrow', '←'),
      renderValue(value)));
}

/** A value that is just itself: a literal, a name, a result. */
export function renderPlain(value, label = null) {
  return el('div.pic-plain', renderValue(value, { label }));
}

/** For `%in%`: every left value looked up in the right-hand list. */
export function renderMembership(left, right, result) {
  const set = right && isAtomic(right) ? formatCells(right) : [];
  return el('div.pic-in',
    lane(t('fx.in.list'), el('div.pic-in-set', set.map((s) => el('span.pic-in-item', s)))),
    renderMap(left, result, { label: '%in%' }));
}

/** Everything R needs to show an error at the place it happened. */
export function renderErrorPic(message) {
  return el('div.pic-error', el('div.pic-error-mark', '!'), el('div.pic-error-text', message));
}

/**
 * Two values side by side -- the task's goal next to the student's result, with
 * every cell of the result that differs from the goal outlined. The student sees
 * WHERE it is wrong (Warszawa's NA, one extra column) before reading any message.
 */
export function renderCompare(goal, mine, { goalLabel, mineLabel, ok = null } = {}) {
  let mineOpts = { compact: true };
  if (goal && mine && ok !== true) mineOpts = { ...mineOpts, ...diffMarks(goal, mine) };
  // A count table is drawn as bars on the stage; the goal must look the same, or
  // the student compares a row of cells with the bars they just saw.
  const counts = isTable(goal);
  const goalPic = counts ? countsBeside(goal) : renderValue(goal, { compact: true });
  let minePic;
  if (mine === undefined) minePic = el('div.pic-compare-empty', '…');
  else if (counts && isTable(mine)) minePic = countsBeside(mine, goal, ok !== true);
  else minePic = renderValue(mine, mineOpts);
  // Tables side by side were cut at the right, and the one differing cell with them:
  // a table goal and answer stand one above the other, at full width (D24).
  const wide = Boolean((goal && isDataFrame(goal)) || (mine && isDataFrame(mine)));
  return el('div', { class: ['pic-compare', wide ? 'pic-compare-wide' : '', ok === true ? 'pic-compare-ok' : ok === false ? 'pic-compare-bad' : ''].filter(Boolean).join(' ') },
    el('div.pic-compare-side', el('div.pic-compare-label', goalLabel), goalPic),
    el('div.pic-compare-side', el('div.pic-compare-label', mineLabel), minePic));
}

const isTable = (v) => Boolean(v && isAtomic(v) && hasClass(v, 'table') && getNames(v));

/**
 * One side of a goal-vs-answer pair of count tables, on the goal's bar scale.
 * Against a goal: rows that differ are outlined, and goal rows the answer lacks
 * are drawn hollow -- but only when the two share some row names, otherwise every
 * goal row would be "missing" and the picture would shout instead of point.
 */
function countsBeside(table, goal = null, mark = false) {
  const scaleOf = (v) => Math.max(1, ...v.values.map((x) => (isNA(x) ? 0 : x)));
  if (!goal) return renderCounts(null, table, { compact: true });
  const gNames = getNames(goal).values.map(String);
  const gCounts = goal.values;
  const names = getNames(table).values.map(String);
  const shared = names.some((nm) => gNames.includes(nm));
  return renderCounts(null, table, {
    compact: true,
    max: Math.max(scaleOf(goal), scaleOf(table)),
    absent: mark && shared ? gNames.filter((nm) => !names.includes(nm)) : [],
    order: gNames,
    // Matched by name, not position: a missing row must not make every row after
    // it look wrong. A row is wrong when its count differs, or when it stands out
    // of the goal's order among the rows both tables have.
    rowClass: mark ? (nm, n) => {
      if (n === null) return null;
      const g = gNames.indexOf(nm);
      if (g === -1 || gCounts[g] !== n) return 'rv-diff';
      const sharedGoal = gNames.filter((x) => names.includes(x));
      const sharedMine = names.filter((x) => gNames.includes(x));
      return sharedGoal.indexOf(nm) === sharedMine.indexOf(nm) ? null : 'rv-diff';
    } : null,
  });
}

/** Rendering options that outline the cells of `mine` differing from `goal`. */
function diffMarks(goal, mine) {
  if (isDataFrame(goal) && isDataFrame(mine)) {
    const gNames = (getNames(goal)?.values || []).map(String);
    const mNames = (getNames(mine)?.values || []).map(String);
    const gCols = goal.values.map(columnCells);
    const mCols = mine.values.map(columnCells);
    return {
      headClass: (c) => (gNames.includes(mNames[c]) ? null : 'rv-diff'),
      cellClass: (r, c) => {
        const g = gNames.indexOf(mNames[c]);
        if (g === -1) return 'rv-diff';
        return gCols[g][r] === mCols[c][r] ? null : 'rv-diff';
      },
    };
  }
  if (isAtomic(goal) && isAtomic(mine) && !isDataFrame(goal) && !isDataFrame(mine) && rLength(goal) === rLength(mine)) {
    const g = isFactor(goal) ? factorLabels(goal) : formatCells(goal);
    const m = isFactor(mine) ? factorLabels(mine) : formatCells(mine);
    // Names count when the goal has them: in a count table they say WHAT was counted.
    const gn = getNames(goal)?.values;
    const mn = getNames(mine)?.values;
    const sameName = (i) => !gn || String(gn[i]) === String(mn?.[i] ?? '');
    return { cellClass: (i) => (g[i] === m[i] && sameName(i) ? null : 'rv-diff') };
  }
  return {};
}

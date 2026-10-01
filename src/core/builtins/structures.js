/**
 * Structures: list, factor, data.frame, table, and the apply family.
 *
 * Factors deserve the extra care they get here. To a humanities student a factor
 * *looks* like a vector of words, but it is really a vector of small integers plus
 * a lookup table of levels. Every confusing thing about factors follows from that
 * one fact -- `as.numeric(f)` returning 1,2,1 instead of the numbers you typed;
 * levels surviving after you filter their last row; sorting by level order rather
 * than alphabetically. The visual panel shows both layers at once.
 */

import {
  NA, isNA, mkAtomic, mkDouble, mkInteger, mkCharacter, mkLogical, mkList,
  R_NULL, isNull, isAtomic, isList, isFunction, rLength, getNames, getAttr,
  setAttr, isFactor, isDataFrame,
} from '../rvalue.js';
import { coerceVector, RError, commonType, convertCell } from '../coerce.js';
import { factorToCharacter } from '../arith.js';
import { singleBracket } from '../subset.js';
import { arg, namedArg, asFlag, asNum, asStr } from './base.js';
import { EV } from '../../trace/events.js';
import { t } from '../../i18n/index.js';

/**
 * Build a factor: levels in a fixed order, values stored as 1-based codes into them.
 *
 * Follows R's `factor()` where students meet it:
 * - no `levels`: the distinct values, SORTED in their own type -- numbers as numbers
 *   (2, 5, 10), text alphabetically, an existing factor in its own level order;
 * - `levels` given: that order, including levels nobody chose (an empty answer on a
 *   survey scale stays in the table with a zero);
 * - `labels`: one per level, matched in order -- the codebook of a coded variable.
 *   One label is numbered (`grupa1`, `grupa2`); any other count is R's error, and
 *   the usual cause is a scale point nobody chose, missing from the default levels.
 */
export function makeFactor(x, { levels = null, labels = null, trace = null, node = null } = {}) {
  const chr = isFactor(x) ? factorToCharacter(x) : coerceVector(x, 'character', { trace: null });
  const levelsGiven = Boolean(levels && !isNull(levels));
  let levelSet;
  if (levelsGiven) {
    levelSet = coerceVector(levels, 'character', { trace: null }).values.map(String);
  } else {
    levelSet = defaultLevels(x, chr);
  }
  let codes = chr.values.map((v) => {
    if (isNA(v)) return NA;
    const at = levelSet.indexOf(String(v));
    return at === -1 ? NA : at + 1;                  // a value outside the levels becomes NA
  });

  let labelSet = levelSet;
  if (labels && !isNull(labels)) {
    const given = coerceVector(labels, 'character', { trace: null }).values.map(String);
    if (given.length === levelSet.length) {
      // Duplicate labels merge their levels, as in R: c("zle", "zle", ...) collapses two.
      labelSet = [...new Set(given)];
      codes = codes.map((c) => (isNA(c) ? NA : labelSet.indexOf(given[c - 1]) + 1));
    } else if (given.length === 1) {
      labelSet = levelSet.map((_, k) => `${given[0]}${k + 1}`);
    } else {
      throw new RError('err.factorLabels', node, { nlab: given.length, nlev: levelSet.length, levelsGiven });
    }
  }

  const dropped = chr.values.filter((v) => !isNA(v) && !levelSet.includes(String(v)));
  if (dropped.length && trace) {
    trace.emit(EV.WARNING, { kind: 'factor-unmatched', values: [...new Set(dropped.map(String))], node });
  }
  trace?.emit(EV.COERCE, {
    from: isFactor(x) ? 'factor' : x.type, to: 'factor', reason: 'factor()', node,
    before: chr.values.slice(), after: codes.slice(), levels: labelSet.slice(),
    levelValues: levelSet.slice(), levelsGiven, labelled: labelSet !== levelSet,
  });

  return mkAtomic('integer', codes, {
    levels: mkCharacter(labelSet),
    class: mkCharacter(['factor']),
  });
}

/** R's default level order: sort(unique(x)) in x's own type, then as text. */
function defaultLevels(x, chr) {
  const seen = new Map();                            // level text -> a value to sort by
  chr.values.forEach((v, i) => {
    if (isNA(v) || seen.has(String(v))) return;
    seen.set(String(v), isFactor(x) || x.type === 'character' ? v : Number(x.values[i]));
  });
  const entries = [...seen];
  if (isFactor(x)) {
    const order = getAttr(x, 'levels').values.map(String);
    return order.filter((lv) => seen.has(lv));       // unused levels drop; the order stays
  }
  if (x.type === 'character') return entries.map(([k]) => k).sort((a, b) => a.localeCompare(b, 'en'));
  return entries.sort((a, b) => a[1] - b[1]).map(([k]) => k);
}

/** Build a data.frame: a list of equal-length columns wearing a class attribute. */
export function makeDataFrame(cols, names, { trace = null, node = null, stringsAsFactors = false } = {}) {
  if (!cols.length) return mkList([], { names: mkCharacter([]), class: mkCharacter(['data.frame']), 'row.names': mkInteger([]) });
  const lengths = cols.map(rLength);
  const n = Math.max(...lengths);
  const recycledCols = cols.map((col, i) => {
    if (lengths[i] === n) return col;
    if (n % lengths[i] !== 0) {
      throw new RError('err.dfColumnLength', node, { name: names[i], length: lengths[i], rows: n });
    }
    trace?.emit(EV.RECYCLE, {
      shorter: names[i], shortLen: lengths[i], longLen: n, times: n / lengths[i], fits: true, node, op: 'data.frame',
    });
    const vals = Array.from({ length: n }, (_, k) => col.values[k % lengths[i]]);
    return isList(col) ? mkList(vals) : mkAtomic(col.type, vals, col.attributes);
  });
  const finalCols = recycledCols.map((col) =>
    (stringsAsFactors && isAtomic(col) && col.type === 'character' ? makeFactor(col, { trace, node }) : col));

  return mkList(finalCols, {
    names: mkCharacter(names),
    class: mkCharacter(['data.frame']),
    'row.names': mkInteger(Array.from({ length: n }, (_, i) => i + 1)),
  });
}

const dfNrow = (df) => (df.values.length ? rLength(df.values[0]) : 0);

/** `df[rows, cols]` -- wired into the evaluator through interp.dataFrameOps. */
export function dataFrameIndex2d(obj, rowIdx, colIdx, { trace = null, node = null, drop = true } = {}) {
  if (!isDataFrame(obj)) {
    throw new RError('err.index2dNeedsDf', node);
  }
  const names = getNames(obj);
  const nrow = dfNrow(obj);

  // columns first
  let cols = obj.values;
  let colNames = names ? names.values.slice() : cols.map((_, i) => `V${i + 1}`);
  if (colIdx) {
    const asList = mkList(cols, { names: mkCharacter(colNames) });
    const picked = singleBracket(asList, colIdx, { trace, node });
    cols = picked.values;
    colNames = getNames(picked) ? getNames(picked).values.slice() : [];
  }

  // then rows, applied to every surviving column
  let outCols = cols;
  let keptRows = Array.from({ length: nrow }, (_, i) => i + 1);
  if (rowIdx) {
    outCols = cols.map((col) => singleBracket(col, rowIdx, { trace: null, node }));
    const probe = singleBracket(mkInteger(keptRows), rowIdx, { trace, node });
    keptRows = probe.values;
  }

  // R's drop rule: whenever ONE column is left, the table simplifies to a plain
  // vector -- including `df[1:2, ]` on a single-column table. This catches people
  // out, because the same expression returns a different shape depending on how
  // many columns the data happens to have. `drop = FALSE` keeps the table.
  if (outCols.length === 1 && drop) {
    trace?.emit(EV.INDEX, {
      bracket: '[', kind: 'df-drop', node,
      resultLength: rLength(outCols[0]), dropped: true, columnName: colNames[0],
    });
    return outCols[0];
  }

  return mkList(outCols, {
    names: mkCharacter(colNames),
    class: mkCharacter(['data.frame']),
    'row.names': mkInteger(keptRows.filter((r) => !isNA(r))),
  });
}

export function dataFrameSet2d(obj, rowIdx, colIdx, value, { trace = null, node = null } = {}) {
  throw new RError('err.dfSet2dLater', node);
}

export function registerStructures(reg) {
  reg('list', ({ args }) => {
    const values = args.map((a) => a.value ?? R_NULL);
    const names = args.map((a) => a.name || '');
    return mkList(values, names.some((n) => n) ? { names: mkCharacter(names) } : null);
  });

  reg('vector', ({ args }) => {
    const mode = asStr(namedArg(args, 'mode') ?? arg(args, 0), 'logical');
    const n = Math.trunc(asNum(namedArg(args, 'length') ?? arg(args, 1), 0));
    if (mode === 'list') return mkList(Array.from({ length: n }, () => R_NULL));
    const type = mode === 'numeric' ? 'double' : mode;
    const fill = { logical: false, integer: 0, double: 0, character: '' }[type];
    if (fill === undefined) throw new RError('err.unknownVectorMode', null, { mode });
    return mkAtomic(type, Array.from({ length: n }, () => fill));
  });
  reg('numeric', ({ args }) => mkDouble(Array.from({ length: Math.trunc(asNum(arg(args, 0), 0)) }, () => 0)));
  reg('character', ({ args }) => mkCharacter(Array.from({ length: Math.trunc(asNum(arg(args, 0), 0)) }, () => '')));
  reg('logical', ({ args }) => mkLogical(Array.from({ length: Math.trunc(asNum(arg(args, 0), 0)) }, () => false)));
  reg('integer', ({ args }) => mkInteger(Array.from({ length: Math.trunc(asNum(arg(args, 0), 0)) }, () => 0)));

  reg('unlist', ({ args }) => {
    const x = arg(args, 0) ?? R_NULL;
    if (!isList(x)) return x;
    const flat = [];
    const names = [];
    const outerNames = getNames(x);
    x.values.forEach((el, i) => {
      const label = outerNames ? String(outerNames.values[i] ?? '') : '';
      if (isNull(el)) return;
      const innerNames = getNames(el);
      el.values.forEach((v, k) => {
        flat.push({ v, type: isAtomic(el) ? el.type : 'character' });
        const inner = innerNames ? String(innerNames.values[k] ?? '') : '';
        names.push(label && inner ? `${label}.${inner}` : label ? (rLength(el) > 1 ? `${label}${k + 1}` : label) : inner);
      });
    });
    const target = commonType(flat.map((f) => f.type));
    const out = mkAtomic(target, flat.map((f) => convertCell(f.v, f.type, target)));
    return names.some((n) => n) ? setAttr(out, 'names', mkCharacter(names)) : out;
  });

  reg('factor', ({ args, interp, node }) => makeFactor(arg(args, 0) ?? mkCharacter([]), {
    levels: namedArg(args, 'levels'),
    labels: namedArg(args, 'labels'),
    trace: interp.trace,
    node,
  }));
  reg('as.factor', ({ args, interp, node }) => makeFactor(arg(args, 0) ?? mkCharacter([]), { trace: interp.trace, node }));
  reg('levels', ({ args }) => getAttr(arg(args, 0) ?? R_NULL, 'levels') || R_NULL);
  reg('nlevels', ({ args }) => {
    const lv = getAttr(arg(args, 0) ?? R_NULL, 'levels');
    return mkInteger([lv ? rLength(lv) : 0]);
  });
  reg('droplevels', ({ args, interp, node }) => {
    const f = arg(args, 0) ?? R_NULL;
    if (!isFactor(f)) return f;
    return makeFactor(f, { trace: interp.trace, node });
  });

  reg('table', ({ args, interp, node }) => {
    const x = arg(args, 0) ?? R_NULL;
    if (isNull(x)) return mkInteger([], { names: mkCharacter([]) });
    const labelsOf = isFactor(x)
      ? factorToCharacter(x).values
      : coerceVector(x, 'character', { trace: null }).values;
    const levels = isFactor(x)
      ? getAttr(x, 'levels').values.map(String)
      : [...new Set(labelsOf.filter((v) => !isNA(v)).map(String))].sort((a, b) => a.localeCompare(b, 'en'));
    const counts = levels.map((lv) => labelsOf.filter((v) => !isNA(v) && String(v) === lv).length);
    // table() ignores NA by default -- so the counts may not add up to length(x).
    const dropped = labelsOf.filter(isNA).length;
    if (dropped) interp.trace?.emit(EV.WARNING, { kind: 'table-drops-na', dropped, node });
    // R labels the table with `deparse(substitute(x))`, so `table(plec)` prints a
    // "plec" header and `table(df$plec)` prints a blank one. Students read that line
    // as the question the table answers, so it is worth reproducing exactly.
    const argNode = (node?.args || []).find((a) => !a.name)?.value;
    const dnn = argNode && argNode.type === 'Ident' ? argNode.name : '';
    return mkInteger(counts, {
      names: mkCharacter(levels),
      class: mkCharacter(['table']),
      dnn: mkCharacter([dnn]),
    });
  });

  reg('data.frame', ({ args, interp, node }) => {
    const cols = [];
    const names = [];
    args.forEach((a, i) => {
      if (a.name === 'stringsAsFactors') return;
      const v = a.value;
      if (isDataFrame(v)) {                          // splice in an existing table's columns
        const nm = getNames(v);
        v.values.forEach((col, k) => { cols.push(col); names.push(nm ? String(nm.values[k]) : `V${k + 1}`); });
        return;
      }
      cols.push(v);
      names.push(a.name || `V${i + 1}`);
    });
    return makeDataFrame(cols, names, {
      trace: interp.trace, node,
      stringsAsFactors: asFlag(namedArg(args, 'stringsAsFactors'), false),
    });
  });

  reg('nrow', ({ args }) => {
    const x = arg(args, 0) ?? R_NULL;
    return isDataFrame(x) ? mkInteger([dfNrow(x)]) : R_NULL;
  });
  reg('ncol', ({ args }) => {
    const x = arg(args, 0) ?? R_NULL;
    return isDataFrame(x) ? mkInteger([x.values.length]) : R_NULL;
  });
  reg('colnames', ({ args }) => getNames(arg(args, 0) ?? R_NULL) || R_NULL);
  reg('dim', ({ args }) => {
    const x = arg(args, 0) ?? R_NULL;
    if (isDataFrame(x)) return mkInteger([dfNrow(x), x.values.length]);
    return getAttr(x, 'dim') || R_NULL;
  });

  reg('str', ({ args, interp, node }) => {
    interp.printText(describeStructure(arg(args, 0) ?? R_NULL));
    return R_NULL;
  });

  reg('summary', ({ args, interp, node }) => summarise(arg(args, 0) ?? R_NULL, interp, node));

  // --- apply family -------------------------------------------------------
  reg('lapply', ({ args, interp, node }) => {
    const x = arg(args, 0) ?? R_NULL;
    const fn = arg(args, 1);
    const out = applyOver(x, fn, interp, node, 'lapply');
    return mkList(out, getNames(x) ? { names: getNames(x) } : null);
  });

  reg('sapply', ({ args, interp, node }) => {
    const x = arg(args, 0) ?? R_NULL;
    const fn = arg(args, 1);
    const out = applyOver(x, fn, interp, node, 'sapply');
    // sapply simplifies to a vector when every result is a single value; otherwise
    // it silently hands back a list, which is why sapply surprises people.
    const allScalar = out.every((r) => isAtomic(r) && rLength(r) === 1);
    if (!allScalar) return mkList(out, getNames(x) ? { names: getNames(x) } : null);
    const target = commonType(out.map((r) => r.type));
    const vec = mkAtomic(target, out.map((r) => convertCell(r.values[0], r.type, target)));
    return getNames(x) ? setAttr(vec, 'names', getNames(x)) : vec;
  });

  reg('Reduce', ({ args, interp, node }) => {
    const fn = arg(args, 0);
    const x = arg(args, 1) ?? R_NULL;
    const init = namedArg(args, 'accumulate') ? null : arg(args, 2);
    let acc = init ?? elementAt(x, 0);
    for (let i = init ? 0 : 1; i < rLength(x); i++) {
      acc = callFunction(interp, fn, [acc, elementAt(x, i)], node);
    }
    return acc ?? R_NULL;
  });
}

function elementAt(x, i) {
  if (isList(x)) return x.values[i];
  return mkAtomic(x.type, [x.values[i]], isFactor(x) ? x.attributes : null);
}

function applyOver(x, fn, interp, node, fname) {
  if (!fn || !isFunction(fn)) throw new RError('err.applyNeedsFn', node, { fname });
  const n = rLength(x);
  const out = [];
  for (let i = 0; i < n; i++) out.push(callFunction(interp, fn, [elementAt(x, i)], node, fname));
  return out;
}

/** Invoke an R function (closure or builtin) from inside a builtin. */
export function callFunction(interp, fn, values, node, fnName = null) {
  const args = values.map((v) => ({ name: null, value: v, node }));
  if (fn.kind === 'builtin') return fn.fn({ args, env: interp.global, node, interp });
  return interp.callClosure(fn, args, { node, fnName: fn.name || fnName || t('val.function'), env: interp.global });
}

function describeStructure(v, indent = '') {
  if (isNull(v)) return ' NULL';
  if (isFunction(v)) return 'function';
  if (isDataFrame(v)) {
    const names = getNames(v);
    const head = `'data.frame':\t${dfNrow(v)} obs. of  ${v.values.length} variables:`;
    const lines = v.values.map((col, i) => ` $ ${names ? names.values[i] : i + 1}: ${describeStructure(col)}`);
    return [head, ...lines].join('\n');
  }
  if (isFactor(v)) {
    const lv = getAttr(v, 'levels');
    return `Factor w/ ${rLength(lv)} levels ${lv.values.slice(0, 3).map((s) => `"${s}"`).join(',')}${rLength(lv) > 3 ? ',..' : ''}: ${v.values.slice(0, 10).map((c) => (isNA(c) ? 'NA' : c)).join(' ')}`;
  }
  if (isList(v)) {
    const names = getNames(v);
    return [`List of ${v.values.length}`, ...v.values.map((el, i) => ` $ ${names ? names.values[i] : ''}: ${describeStructure(el)}`)].join('\n');
  }
  const tag = { logical: 'logi', integer: 'int', double: 'num', character: 'chr' }[v.type];
  const cells = v.values.slice(0, 10).map((x) => (isNA(x) ? 'NA' : v.type === 'character' ? `"${x}"` : String(x)));
  return `${tag} [1:${rLength(v)}] ${cells.join(' ')}${rLength(v) > 10 ? ' ...' : ''}`;
}

function summarise(v, interp, node) {
  if (isFactor(v)) {
    const lv = getAttr(v, 'levels').values.map(String);
    const counts = lv.map((l, i) => v.values.filter((c) => c === i + 1).length);
    return mkInteger(counts, { names: mkCharacter(lv) });
  }
  if (isAtomic(v) && (v.type === 'double' || v.type === 'integer')) {
    const vals = v.values.filter((x) => !isNA(x)).slice().sort((a, b) => a - b);
    if (!vals.length) return mkDouble([]);
    const q = (p) => {
      const h = (vals.length - 1) * p;
      const lo = Math.floor(h);
      const hi = Math.ceil(h);
      return vals[lo] + (h - lo) * (vals[hi] - vals[lo]);
    };
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    return mkDouble([vals[0], q(0.25), q(0.5), mean, q(0.75), vals[vals.length - 1]], {
      names: mkCharacter(['Min.', '1st Qu.', 'Median', 'Mean', '3rd Qu.', 'Max.']),
    });
  }
  interp.printText(describeStructure(v));
  return R_NULL;
}

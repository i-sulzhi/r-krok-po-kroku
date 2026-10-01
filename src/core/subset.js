/**
 * Subsetting: `x[i]`, `x[[i]]`, `x$name`.
 *
 * `[` accepts four different kinds of index, and they mean genuinely different
 * things -- this is where a beginner's mental model usually breaks:
 *
 *   x[c(1, 3)]      positions to KEEP
 *   x[-c(1, 3)]     positions to DROP        (a negative number is not "from the end")
 *   x[c(TRUE, FALSE)] a mask, recycled to length(x)
 *   x[c("a", "b")]  lookup by name
 *
 * The INDEX event names which of the four was used and lists the resolved positions,
 * so the panel can show *why* those cells were chosen, not just which.
 */

import {
  NA, isNA, mkAtomic, mkList, mkCharacter, isAtomic, isList, isNull, isFactor,
  getAttr, setAttr, R_NULL, rLength, getNames, isDataFrame,
} from './rvalue.js';
import { coerceVector, RError, convertCell } from './coerce.js';
import { EV } from '../trace/events.js';
import { t } from '../i18n/index.js';

export const INDEX_KIND = Object.freeze({
  POSITIVE: 'positive', NEGATIVE: 'negative', LOGICAL: 'logical', NAME: 'name', EMPTY: 'empty',
});

/** Classify the index vector, which decides everything that follows. */
export function classifyIndex(idx) {
  if (idx == null || isNull(idx)) return INDEX_KIND.EMPTY;
  if (idx.type === 'logical') return INDEX_KIND.LOGICAL;
  if (idx.type === 'character') return INDEX_KIND.NAME;
  const nums = idx.values.filter((v) => !isNA(v));
  const hasNeg = nums.some((v) => v < 0);
  const hasPos = nums.some((v) => v > 0);
  if (hasNeg && hasPos) {
    throw new RError('err.mixedSigns');
  }
  return hasNeg ? INDEX_KIND.NEGATIVE : INDEX_KIND.POSITIVE;
}

/**
 * Turn an index vector into concrete 0-based positions.
 * @returns {{positions: Array<number|NA>, kind: string, detail: Object}}
 */
export function resolvePositions(x, idx, { trace = null, node = null } = {}) {
  const n = rLength(x);
  const kind = classifyIndex(idx);
  const names = getNames(x);
  const detail = {};

  switch (kind) {
    case INDEX_KIND.EMPTY:
      return { positions: Array.from({ length: n }, (_, i) => i), kind, detail };

    case INDEX_KIND.LOGICAL: {
      // The mask is recycled up to length(x) -- so x[c(TRUE, FALSE)] takes every other element.
      const mask = idx.values;
      const len = Math.max(n, mask.length);
      const positions = [];
      const recycled = mask.length < n;
      for (let i = 0; i < len; i++) {
        const m = mask[i % mask.length];
        if (isNA(m)) positions.push(NA);            // an NA in the mask yields an NA element
        else if (m) positions.push(i);
      }
      detail.recycled = recycled;
      detail.maskLength = mask.length;
      detail.targetLength = n;
      return { positions, kind, detail };
    }

    case INDEX_KIND.NAME: {
      const labels = names ? names.values : [];
      const positions = idx.values.map((nm) => {
        if (isNA(nm)) return NA;
        const at = labels.indexOf(nm);
        return at === -1 ? NA : at;                 // an unknown name gives NA, not an error
      });
      detail.requested = idx.values.slice();
      detail.missingNames = idx.values.filter((nm) => !isNA(nm) && !(names && names.values.includes(nm)));
      return { positions, kind, detail };
    }

    case INDEX_KIND.NEGATIVE: {
      const drop = new Set(idx.values.filter((v) => !isNA(v)).map((v) => -v - 1));
      const positions = [];
      for (let i = 0; i < n; i++) if (!drop.has(i)) positions.push(i);
      detail.dropped = [...drop].filter((i) => i >= 0 && i < n);
      return { positions, kind, detail };
    }

    default: { // POSITIVE
      const positions = [];
      const outOfRange = [];
      for (const v of idx.values) {
        if (isNA(v)) { positions.push(NA); continue; }
        if (v === 0) continue;                      // index 0 is silently skipped
        const i = Math.trunc(v) - 1;                // R counts from 1
        if (i >= n) { positions.push(NA); outOfRange.push(v); continue; }
        positions.push(i);
      }
      detail.outOfRange = outOfRange;
      detail.zeroSkipped = idx.values.some((v) => v === 0);
      return { positions, kind, detail };
    }
  }
}

/** `x[i]` -- keeps the container type: subsetting a list gives a shorter list. */
export function singleBracket(x, idx, { trace = null, node = null } = {}) {
  if (isNull(x)) return R_NULL;
  if (!isAtomic(x) && !isList(x)) throw new RError('err.notSubsettable', node);

  const { positions, kind, detail } = resolvePositions(x, idx, { trace, node });
  const names = getNames(x);

  const values = positions.map((p) => {
    if (isNA(p)) return isList(x) ? R_NULL : NA;
    return x.values[p];
  });

  let out = isList(x)
    ? mkList(values)
    : mkAtomic(x.type, values);

  if (names) {
    const newNames = positions.map((p) => (isNA(p) ? (kind === INDEX_KIND.NAME ? NA : '') : names.values[p]));
    out = setAttr(out, 'names', mkCharacter(newNames));
  }
  // A factor keeps its levels through subsetting -- including levels no longer present.
  if (isFactor(x)) {
    out = setAttr(out, 'levels', getAttr(x, 'levels'));
    out = setAttr(out, 'class', getAttr(x, 'class'));
  }

  trace?.emit(EV.INDEX, {
    bracket: '[', kind, node,
    sourceLength: rLength(x), resultLength: rLength(out),
    positions, detail, sourceType: x.kind === 'list' ? 'list' : x.type,
  });
  return out;
}

/**
 * `x[[i]]` -- extracts ONE element and unwraps it. On a list this is the difference
 * between the carriage and its contents: `x[1]` is a list of one, `x[[1]]` is the thing.
 */
export function doubleBracket(x, idx, { trace = null, node = null } = {}) {
  if (isNull(x)) throw new RError('err.extractNull', node);
  if (rLength(idx) !== 1) {
    throw new RError('err.doubleOneIndex', node);
  }
  const names = getNames(x);
  let pos;
  if (idx.type === 'character') {
    const nm = idx.values[0];
    pos = names ? names.values.indexOf(nm) : -1;
    if (pos === -1) {
      if (isList(x)) {
        trace?.emit(EV.INDEX, { bracket: '[[', kind: INDEX_KIND.NAME, node, missing: nm, resultLength: 0 });
        return R_NULL;                              // a missing name in a list gives NULL
      }
      throw new RError('err.noElementNamed', node, { name: nm });
    }
  } else {
    const v = idx.values[0];
    if (isNA(v)) throw new RError('err.indexNA', node);
    pos = Math.trunc(v) - 1;
    if (pos < 0) throw new RError('err.doubleNegative', node);
    if (pos >= rLength(x)) {
      throw new RError('err.indexOutOfRange', node, { index: v, length: rLength(x) });
    }
  }

  const raw = x.values[pos];
  const out = isList(x) ? raw : mkAtomic(x.type, [raw]);
  trace?.emit(EV.INDEX, {
    bracket: '[[', kind: idx.type === 'character' ? INDEX_KIND.NAME : INDEX_KIND.POSITIVE, node,
    positions: [pos], sourceLength: rLength(x), resultLength: rLength(out),
    unwrapped: isList(x), detail: {},
  });
  return out;
}

/** `x$name` -- like `[[` by name, but with R's partial matching on lists. */
export function dollar(x, name, { trace = null, node = null } = {}) {
  if (isNull(x)) return R_NULL;
  if (isAtomic(x)) {
    throw new RError('err.dollarOnVector', node);
  }
  const names = getNames(x);
  const labels = names ? names.values : [];
  let pos = labels.indexOf(name);
  let partial = false;
  if (pos === -1) {
    // R falls back to a unique prefix match, which is convenient and a known trap.
    const candidates = labels.map((l, i) => [l, i]).filter(([l]) => typeof l === 'string' && l.startsWith(name));
    if (candidates.length === 1) { pos = candidates[0][1]; partial = true; }
  }
  if (pos === -1) {
    trace?.emit(EV.INDEX, { bracket: '$', kind: INDEX_KIND.NAME, node, missing: name, available: labels.slice() });
    return R_NULL;                                  // asking for a missing column gives NULL, not an error
  }
  trace?.emit(EV.INDEX, {
    bracket: '$', kind: INDEX_KIND.NAME, node, name, positions: [pos], partial,
    sourceLength: rLength(x), available: labels.slice(),
  });
  return x.values[pos];
}

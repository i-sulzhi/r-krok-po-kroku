/**
 * Vectorised operators: arithmetic, comparison, logic.
 *
 * Two behaviours are the reason this file narrates so much:
 *
 * - **Recycling.** `1:6 + c(10, 20)` does not fail. R silently reuses the short
 *   vector: 10, 20, 10, 20, 10, 20. When the lengths are not multiples it warns,
 *   and that warning is the one students learn to ignore -- so the panel shows the
 *   reuse cell by cell instead.
 *
 * - **NA is not zero, and not always sticky.** `NA + 1` is NA, but `NA & FALSE` is
 *   FALSE, because R's logic is three-valued: if one operand settles the answer,
 *   the missing one no longer matters.
 */

import { NA, isNA, mkAtomic, mkLogical, isAtomic, isNull, rLength, getAttr, isFactor } from './rvalue.js';
import { unifyTypes, coerceVector, RError, doubleToString } from './coerce.js';
import { EV } from '../trace/events.js';
import { t } from '../i18n/index.js';

/** Above this length we summarise instead of emitting one event per cell. */
const ELEMENTWISE_DETAIL_LIMIT = 60;

export const ARITH_OPS = new Set(['+', '-', '*', '/', '^', '%%', '%/%']);
export const COMPARE_OPS = new Set(['==', '!=', '<', '>', '<=', '>=']);
export const LOGIC_OPS = new Set(['&', '|']);

/**
 * Work out the result length and the index maps that recycling implies.
 * @returns {{n:number, mapA:number[], mapB:number[], recycled:null|Object}}
 */
export function planRecycling(lenA, lenB, { trace = null, node = null, op = null } = {}) {
  if (lenA === 0 || lenB === 0) return { n: 0, mapA: [], mapB: [], recycled: null };
  const n = Math.max(lenA, lenB);
  const mapA = Array.from({ length: n }, (_, i) => i % lenA);
  const mapB = Array.from({ length: n }, (_, i) => i % lenB);

  let recycled = null;
  if (lenA !== lenB) {
    const shorter = lenA < lenB ? 'left' : 'right';
    const shortLen = Math.min(lenA, lenB);
    const fits = n % shortLen === 0;
    recycled = { shorter, shortLen, longLen: n, times: n / shortLen, fits, op };
    trace?.emit(EV.RECYCLE, { ...recycled, node, mapA, mapB });
    if (!fits) {
      trace?.emit(EV.WARNING, { kind: 'recycle-partial', shortLen, longLen: n, node, op });
    }
  }
  return { n, mapA, mapB, recycled };
}

/** The type R gives an arithmetic result, which is not always the operands' type. */
function arithResultType(op, type) {
  if (op === '/' || op === '^') return 'double';            // 5L / 2L is 2.5, not 2
  if (type === 'logical') return 'integer';                 // TRUE + TRUE is 2L
  return type;
}

function arithCell(op, a, b, type) {
  if (isNA(a) || isNA(b)) return NA;
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '*': return a * b;
    case '/': return a / b;
    case '^': return Math.pow(a, b);
    case '%%': {                                            // R's modulo follows the divisor's sign
      if (b === 0) return type === 'integer' ? NA : NaN;
      const r = a - Math.floor(a / b) * b;
      return r;
    }
    case '%/%': {
      if (b === 0) return type === 'integer' ? NA : (a === 0 ? NaN : (a > 0 ? Infinity : -Infinity));
      return Math.floor(a / b);
    }
    default: throw new RError('err.unknownOp', null, { op });
  }
}

function compareCell(op, a, b) {
  if (isNA(a) || isNA(b)) return NA;
  if (typeof a === 'number' && (Number.isNaN(a) || Number.isNaN(b))) return NA;
  switch (op) {
    case '==': return a === b;
    case '!=': return a !== b;
    case '<':  return a < b;
    case '>':  return a > b;
    case '<=': return a <= b;
    case '>=': return a >= b;
    default: throw new RError('err.unknownCompare', null, { op });
  }
}

/** Three-valued logic: a known operand can decide the answer despite an NA. */
function logicCell(op, a, b) {
  const A = isNA(a) ? NA : Boolean(a);
  const B = isNA(b) ? NA : Boolean(b);
  if (op === '&') {
    if (A === false || B === false) return false;           // FALSE wins over NA
    if (isNA(A) || isNA(B)) return NA;
    return A && B;
  }
  if (A === true || B === true) return true;                // TRUE wins over NA
  if (isNA(A) || isNA(B)) return NA;
  return A || B;
}

/**
 * Apply a binary operator across two vectors.
 * @param {string} op
 * @param {Object} left, right   R values
 * @param {Object} ctx  {trace, node}
 */
export function binaryOp(op, left, right, ctx = {}) {
  const { trace = null, node = null } = ctx;

  if (ARITH_OPS.has(op)) return arithmetic(op, left, right, ctx);
  if (COMPARE_OPS.has(op)) return comparison(op, left, right, ctx);
  if (LOGIC_OPS.has(op)) return logical(op, left, right, ctx);
  throw new RError('err.opUnsupported', node, { op });
}

function requireNumeric(v, op, node) {
  if (isNull(v)) return mkAtomic('integer', []);
  if (!isAtomic(v)) throw new RError('err.opBadKind', node, { kind: v.kind, op });
  if (v.type === 'character') {
    throw new RError('err.opOnText', node, { op });
  }
  if (isFactor(v)) {
    throw new RError(factorLabelsAreNumbers(v) ? 'err.opOnFactor' : 'err.opOnFactorScale', node, { op });
  }
  return v;
}

function arithmetic(op, left, right, { trace = null, node = null } = {}) {
  const a = requireNumeric(left, op, node);
  const b = requireNumeric(right, op, node);
  const { type, values: [ua, ub] } = unifyTypes([a, b], { trace, reason: `binary-${op}`, node });
  const outType = arithResultType(op, type);

  const { n, mapA, mapB } = planRecycling(rLength(ua), rLength(ub), { trace, node, op });
  const out = new Array(n);
  const detail = n <= ELEMENTWISE_DETAIL_LIMIT;
  let naSeen = false;

  for (let i = 0; i < n; i++) {
    const av = ua.values[mapA[i]];
    const bv = ub.values[mapB[i]];
    let r = arithCell(op, av, bv, outType);
    if (outType === 'integer' && !isNA(r) && !Number.isSafeInteger(r)) r = NA;
    out[i] = r;
    if (isNA(r) && !(isNA(av) || isNA(bv))) { /* produced NA, e.g. integer overflow */ }
    if (isNA(av) || isNA(bv)) naSeen = true;
    if (detail) {
      trace?.emit(EV.ELEMENTWISE, {
        op, i, node,
        a: av, b: bv, result: r,
        fromA: mapA[i], fromB: mapB[i],
        reusedA: mapA[i] !== i, reusedB: mapB[i] !== i,
      });
    }
  }
  if (naSeen) trace?.emit(EV.NA_PROPAGATE, { op, node, count: out.filter(isNA).length });

  return mkAtomic(outType, out, { names: getAttr(ua, 'names') || getAttr(ub, 'names') });
}

function comparison(op, left, right, { trace = null, node = null } = {}) {
  let a = left, b = right;
  // Comparing a factor uses its labels, not the integer codes behind them.
  if (isFactor(a)) a = factorToCharacter(a);
  if (isFactor(b)) b = factorToCharacter(b);
  if (!isAtomic(a) && !isNull(a)) throw new RError('err.cmpBadKind', node, { kind: a.kind });
  if (!isAtomic(b) && !isNull(b)) throw new RError('err.cmpBadKind', node, { kind: b.kind });

  const { values: [ua, ub] } = unifyTypes([a, b], { trace, reason: `compare-${op}`, node });
  const { n, mapA, mapB } = planRecycling(rLength(ua), rLength(ub), { trace, node, op });
  const out = new Array(n);
  const detail = n <= ELEMENTWISE_DETAIL_LIMIT;

  for (let i = 0; i < n; i++) {
    const av = ua.values[mapA[i]];
    const bv = ub.values[mapB[i]];
    out[i] = compareCell(op, av, bv);
    if (detail) {
      trace?.emit(EV.ELEMENTWISE, {
        op, i, node, a: av, b: bv, result: out[i],
        fromA: mapA[i], fromB: mapB[i],
        reusedA: mapA[i] !== i, reusedB: mapB[i] !== i,
      });
    }
  }
  return mkLogical(out, { names: getAttr(ua, 'names') || getAttr(ub, 'names') });
}

function logical(op, left, right, { trace = null, node = null } = {}) {
  const a = isNull(left) ? mkLogical([]) : coerceVector(left, 'logical', { trace, reason: `logic-${op}`, node });
  const b = isNull(right) ? mkLogical([]) : coerceVector(right, 'logical', { trace, reason: `logic-${op}`, node });
  const { n, mapA, mapB } = planRecycling(rLength(a), rLength(b), { trace, node, op });
  const out = new Array(n);
  const detail = n <= ELEMENTWISE_DETAIL_LIMIT;

  for (let i = 0; i < n; i++) {
    const av = a.values[mapA[i]];
    const bv = b.values[mapB[i]];
    out[i] = logicCell(op, av, bv);
    if (detail) {
      trace?.emit(EV.ELEMENTWISE, {
        op, i, node, a: av, b: bv, result: out[i],
        fromA: mapA[i], fromB: mapB[i],
        reusedA: mapA[i] !== i, reusedB: mapB[i] !== i,
        threeValued: isNA(av) || isNA(bv),
      });
    }
  }
  return mkLogical(out);
}

/** Unary `-`, `+`, `!`. */
export function unaryOp(op, v, { trace = null, node = null } = {}) {
  if (op === '!') {
    const b = coerceVector(isNull(v) ? mkLogical([]) : v, 'logical', { trace, reason: 'not', node });
    return mkLogical(b.values.map((x) => (isNA(x) ? NA : !x)));
  }
  const a = requireNumeric(v, op, node);
  if (op === '+') return a;
  const type = a.type === 'logical' ? 'integer' : a.type;
  return mkAtomic(type, a.values.map((x) => (isNA(x) ? NA : -x)), { names: getAttr(a, 'names') });
}

/** A factor's visible values are its level labels, looked up by integer code. */
/**
 * Do the labels read as numbers ("2", "3.5")? That decides the advice for a factor
 * used as numbers: numbers-as-labels come back through as.character(); a word scale
 * ("zle" ... "dobrze") has only its level numbers, which as.numeric() gives directly.
 */
export function factorLabelsAreNumbers(f) {
  const labels = getAttr(f, 'levels')?.values || [];
  return labels.length > 0 && labels.every((s) => String(s).trim() !== '' && Number.isFinite(Number(s)));
}

export function factorToCharacter(f) {
  const levels = getAttr(f, 'levels');
  const labels = levels ? levels.values : [];
  return mkAtomic('character', f.values.map((code) => (isNA(code) ? NA : (labels[code - 1] ?? NA))));
}

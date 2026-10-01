/**
 * Type coercion -- R's most quietly confusing behaviour, and therefore one of the
 * things this trainer exists to make visible.
 *
 * R has a one-way hierarchy: logical -> integer -> double -> character. When values
 * of different types meet, the *lower* one is silently promoted. `c(1, "a")` does not
 * fail and does not produce a mixed vector; it produces `c("1", "a")`, and the student
 * usually finds out much later, via a bug.
 *
 * Every promotion here emits a COERCE event carrying before/after payloads, so the
 * panel can animate the exact cells that changed and say why.
 */

import {
  NA, isNA, TYPES, typeRank, mkAtomic, isAtomic, isList, isNull, isFactor,
  getAttr, R_NULL, rLength,
} from './rvalue.js';
import { EV } from '../trace/events.js';
import { t } from '../i18n/index.js';

/** The winning type when several meet: the highest in the hierarchy. */
export function commonType(types) {
  let best = 'logical';
  for (const t of types) if (typeRank(t) > typeRank(best)) best = t;
  return best;
}

/**
 * How R renders a double as a character: up to 15 significant digits.
 * Deliberately *not* the same as printing (7 digits) -- conflating the two is a
 * classic source of "but R showed me 0.3333333" confusion.
 */
export function doubleToString(x) {
  if (isNA(x)) return NA;
  if (Number.isNaN(x)) return 'NaN';
  if (x === Infinity) return 'Inf';
  if (x === -Infinity) return '-Inf';
  if (Number.isInteger(x) && Math.abs(x) < 1e15) return String(x);
  const s = x.toPrecision(15).replace(/(\.\d*?)0+(e|$)/, '$1$2').replace(/\.(e|$)/, '$1');
  return String(Number(s));
}

/** Convert one raw cell. Returns NA when the conversion is impossible. */
export function convertCell(x, from, to) {
  if (isNA(x)) return NA;
  if (from === to) return x;
  switch (to) {
    case 'integer':
      if (from === 'logical') return x ? 1 : 0;
      if (from === 'double') return Number.isFinite(x) ? Math.trunc(x) : NA;
      if (from === 'character') { const n = parseRNumber(x); return n === null ? NA : Math.trunc(n); }
      break;
    case 'double':
      if (from === 'logical') return x ? 1 : 0;
      if (from === 'integer') return x;
      if (from === 'character') { const n = parseRNumber(x); return n === null ? NA : n; }
      break;
    case 'character':
      if (from === 'logical') return x ? 'TRUE' : 'FALSE';
      if (from === 'integer') return String(x);
      if (from === 'double') return doubleToString(x);
      break;
    case 'logical':
      if (from === 'character') return x === 'TRUE' || x === 'true' || x === 'T' ? true
        : x === 'FALSE' || x === 'false' || x === 'F' ? false : NA;
      if (from === 'integer' || from === 'double') return x !== 0;
      break;
  }
  return NA;
}

/** R's rules for reading a number out of a string; anything else becomes NA. */
export function parseRNumber(s) {
  const t = String(s).trim();
  if (!t) return null;
  if (/^[+-]?Inf$/.test(t)) return t[0] === '-' ? -Infinity : Infinity;
  if (t === 'NaN') return NaN;
  if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t) && !/^0[xX][0-9a-fA-F]+$/.test(t)) return null;
  const n = Number(t);
  return Number.isNaN(n) && t !== 'NaN' ? null : n;
}

/**
 * Coerce a whole atomic vector to `to`, narrating the change.
 * @param {Object} v      the vector
 * @param {string} to     target type
 * @param {Object} opts   {trace, reason, node} -- `reason` explains *why* (e.g. 'c-mixed')
 */
export function coerceVector(v, to, { trace = null, reason = null, node = null } = {}) {
  if (isNull(v)) return mkAtomic(to, []);
  if (!isAtomic(v)) throw new RError('err.coerceKind', null, { kind: v.kind, to });
  if (v.type === to) return v;

  const from = v.type;
  const before = v.values.slice();
  const values = before.map((x) => convertCell(x, from, to));
  // Cells that turned into NA out of nowhere: R warns, and students need to see it.
  const lost = [];
  for (let i = 0; i < values.length; i++) if (isNA(values[i]) && !isNA(before[i])) lost.push(i);

  const out = mkAtomic(to, values, v.attributes ? { names: getAttr(v, 'names') } : null);

  trace?.emit(EV.COERCE, {
    from, to, reason, node,
    before, after: values,
    lostPositions: lost,
    downward: typeRank(to) < typeRank(from),
  });
  if (lost.length && trace) {
    trace.emit(EV.WARNING, { kind: 'coercion-NA', from, to, positions: lost, node });
  }
  return out;
}

/**
 * Bring several vectors to one common type -- what `c()`, arithmetic and comparison
 * all do before they can work elementwise.
 * @returns {{type: string, values: Array<Object>, promoted: Array<number>}}
 */
export function unifyTypes(vectors, { trace = null, reason = null, node = null } = {}) {
  const types = vectors.filter((v) => isAtomic(v)).map((v) => v.type);
  const target = commonType(types.length ? types : ['logical']);
  const promoted = [];
  const out = vectors.map((v, i) => {
    if (isAtomic(v) && v.type !== target) {
      promoted.push(i);
      return coerceVector(v, target, { trace, reason, node });
    }
    return v;
  });
  return { type: target, values: out, promoted };
}

/**
 * The truth value R demands from `if` and `while`: a single, non-NA logical.
 * The error messages here are the ones beginners hit constantly, so they are
 * phrased as guidance rather than as R's terse original.
 */
export function asCondition(v, { node = null } = {}) {
  if (isNull(v) || rLength(v) === 0) {
    throw new RError('err.condEmpty', node);
  }
  if (!isAtomic(v)) throw new RError('err.condNotLogical', node);
  if (rLength(v) > 1) {
    throw new RError('err.condLength', node, { n: rLength(v) });
  }
  const cell = convertCell(v.values[0], v.type, 'logical');
  if (isNA(cell)) throw new RError('err.condNA', node);
  return cell;
}

/**
 * Errors raised by R semantics (as opposed to syntax errors from the parser).
 *
 * Carries a message KEY plus its parameters rather than a finished sentence, so the
 * text is rendered in whatever language is active when it is finally displayed --
 * including after the student switches language mid-session.
 */
export class RError extends Error {
  constructor(key, node = null, params = {}) {
    // No argument to super(): passing one would define an OWN `message` property,
    // which shadows the getter below and would freeze the text in one language.
    super();
    this.name = 'RError';
    this.key = key;
    this.params = params;
    this.node = node;
  }

  get message() { return t(this.key, this.params); }
}

/**
 * Numeric summaries.
 *
 * The recurring lesson here is `na.rm`. `mean(c(1, 2, NA))` is NA, not 1.5 --
 * R refuses to guess. For humanities students working with survey data, where
 * missing answers are everywhere, this is the single most consequential default
 * in the language, so every summary emits an NA_PROPAGATE event when it bites.
 */

import {
  NA, isNA, mkDouble, mkInteger, mkLogical, mkCharacter, mkAtomic, mkList, R_NULL,
  isNull, isAtomic, isList, rLength, getNames, isFactor, setAttr,
} from '../rvalue.js';
import { coerceVector, RError } from '../coerce.js';
import { factorLabelsAreNumbers } from '../arith.js';
import { arg, namedArg, asFlag, asNum } from './base.js';
import { EV } from '../../trace/events.js';
import { t } from '../../i18n/index.js';

/** Pull out the numbers, honouring na.rm and reporting when NA decided the answer. */
function numbers(args, { interp, node, fname }) {
  const naRM = asFlag(namedArg(args, 'na.rm'), false);
  const vals = [];
  // Kept so the NA panel can show WHICH cells were missing, not just that some were.
  const seen = [];
  const naPositions = [];
  let sawNA = false;
  let isInt = true;
  for (const a of args) {
    if (a.name === 'na.rm') continue;
    const v = a.value;
    if (!v || isNull(v)) continue;
    if (isFactor(v)) {
      throw new RError(factorLabelsAreNumbers(v) ? 'err.statOnFactor' : 'err.statOnFactorScale', node, { fname });
    }
    if (!isAtomic(v)) throw new RError('err.statNeedsNumbers', node, { fname });
    if (v.type === 'character') {
      throw new RError('err.statOnText', node, { fname });
    }
    if (v.type === 'double') isInt = false;
    for (const x of v.values) {
      if (isNA(x)) { naPositions.push(seen.length); sawNA = true; }
      seen.push(x);
      if (isNA(x) && naRM) continue;   // na.rm drops it entirely
      vals.push(x);                    // otherwise NA travels on and poisons the result
    }
  }
  if (sawNA) {
    interp.trace?.emit(EV.NA_PROPAGATE, {
      fname, node, removed: naRM,
      reason: naRM ? 'na.rm=TRUE' : 'na.rm=FALSE',
      rescueHint: naRM ? null : 'na.rm = TRUE',
      values: seen, naPositions, type: isInt ? 'integer' : 'double',
      kept: seen.length - naPositions.length,
    });
  }
  return { vals, naRM, sawNA, isInt };
}

const naResult = (isInt) => (isInt ? mkInteger([NA]) : mkDouble([NA]));

export function registerStats(reg) {
  reg('sum', (ctx) => {
    const { vals, naRM, sawNA, isInt } = numbers(ctx.args, { ...ctx, fname: 'sum' });
    if (sawNA && !naRM) return naResult(isInt);
    const total = vals.reduce((a, b) => a + b, 0);
    return isInt && Number.isSafeInteger(total) ? mkInteger([total]) : mkDouble([total]);
  });

  reg('mean', (ctx) => {
    const { vals, naRM, sawNA } = numbers(ctx.args, { ...ctx, fname: 'mean' });
    if (sawNA && !naRM) return mkDouble([NA]);
    if (!vals.length) return mkDouble([NaN]);
    return mkDouble([vals.reduce((a, b) => a + b, 0) / vals.length]);
  });

  reg('median', (ctx) => {
    const { vals, naRM, sawNA } = numbers(ctx.args, { ...ctx, fname: 'median' });
    if (sawNA && !naRM) return mkDouble([NA]);
    if (!vals.length) return mkDouble([NA]);
    const s = vals.slice().sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return mkDouble([s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2]);
  });

  reg('min', (ctx) => extreme(ctx, Math.min, 'min'));
  reg('max', (ctx) => extreme(ctx, Math.max, 'max'));
  reg('range', (ctx) => {
    const { vals, naRM, sawNA, isInt } = numbers(ctx.args, { ...ctx, fname: 'range' });
    if (sawNA && !naRM) return mkAtomic(isInt ? 'integer' : 'double', [NA, NA]);
    return mkAtomic(isInt ? 'integer' : 'double', [Math.min(...vals), Math.max(...vals)]);
  });

  reg('var', (ctx) => variance(ctx, false));
  reg('sd', (ctx) => variance(ctx, true));

  reg('round', ({ args }) => {
    const x = arg(args, 0) ?? R_NULL;
    const digits = Math.trunc(asNum(namedArg(args, 'digits') ?? arg(args, 1), 0));
    if (isNull(x)) return R_NULL;
    const v = coerceVector(x, 'double');
    const f = Math.pow(10, digits);
    // round() is a "Math" group generic: it reshapes the values and leaves the
    // labelling alone, so a named vector comes back still named.
    const names = getNames(x);
    return mkDouble(v.values.map((n) => {
      if (isNA(n) || !Number.isFinite(n)) return n;
      // R rounds halves to even ("banker's rounding"): round(0.5) is 0, not 1.
      const scaled = n * f;
      const r = Math.round(scaled);
      const isHalf = Math.abs(scaled - Math.trunc(scaled)) === 0.5;
      const val = isHalf && r % 2 !== 0 ? r - Math.sign(scaled) : r;
      return val / f;
    }), names ? { names } : null);
  });

  reg('abs', unaryMath(Math.abs));
  reg('sqrt', unaryMath(Math.sqrt));
  reg('exp', unaryMath(Math.exp));
  reg('log', ({ args }) => {
    const x = coerceVector(arg(args, 0) ?? R_NULL, 'double');
    const base = namedArg(args, 'base') ?? arg(args, 1);
    const b = base ? asNum(base, Math.E) : Math.E;
    return mkDouble(x.values.map((n) => (isNA(n) ? NA : Math.log(n) / Math.log(b))));
  });
  reg('floor', unaryMath(Math.floor));
  reg('ceiling', unaryMath(Math.ceil));
  reg('trunc', unaryMath(Math.trunc));

  reg('any', boolAggregate('any'));
  reg('all', boolAggregate('all'));

  reg('which', ({ args }) => {
    const x = arg(args, 0) ?? R_NULL;
    if (isNull(x)) return mkInteger([]);
    const names = getNames(x);
    const hits = [];
    const labels = [];
    x.values.forEach((v, i) => { if (v === true) { hits.push(i + 1); if (names) labels.push(names.values[i]); } });
    const out = mkInteger(hits);
    return names ? setAttr(out, 'names', mkCharacter(labels)) : out;
  });
  reg('which.max', ({ args }) => whichExtreme(args, 1));
  reg('which.min', ({ args }) => whichExtreme(args, -1));

  reg('sort', ({ args }) => {
    const x = arg(args, 0) ?? R_NULL;
    if (isNull(x)) return R_NULL;
    const dec = asFlag(namedArg(args, 'decreasing'), false);
    // sort() drops NA silently, so length(sort(x)) may differ from length(x).
    const vals = x.values.filter((v) => !isNA(v));
    vals.sort(comparator(x.type));
    if (dec) vals.reverse();
    return mkAtomic(x.type, vals);
  });

  reg('order', ({ args }) => {
    const x = arg(args, 0) ?? R_NULL;
    if (isNull(x)) return mkInteger([]);
    const dec = asFlag(namedArg(args, 'decreasing'), false);
    const cmp = comparator(x.type);
    const idx = x.values.map((v, i) => i);
    idx.sort((a, b) => {
      const va = x.values[a];
      const vb = x.values[b];
      if (isNA(va)) return 1;                        // NA sorts to the end
      if (isNA(vb)) return -1;
      const r = cmp(va, vb);
      return dec ? -r : r;
    });
    return mkInteger(idx.map((i) => i + 1));
  });

  reg('unique', ({ args }) => {
    const x = arg(args, 0) ?? R_NULL;
    if (isNull(x)) return R_NULL;
    const seen = new Set();
    const out = [];
    for (const v of x.values) {
      const key = isNA(v) ? ' NA' : `${typeof v}:${v}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(v);
    }
    return isList(x) ? mkList(out) : mkAtomic(x.type, out);
  });

  reg('ifelse', ({ args }) => {
    const test = coerceVector(arg(args, 0) ?? R_NULL, 'logical');
    const yes = arg(args, 1) ?? R_NULL;
    const no = arg(args, 2) ?? R_NULL;
    const n = rLength(test);
    const out = [];
    for (let i = 0; i < n; i++) {
      const t = test.values[i];
      if (isNA(t)) { out.push(NA); continue; }
      const src = t ? yes : no;
      out.push(src.values[i % Math.max(1, rLength(src))]);
    }
    const type = yes.type === 'character' || no.type === 'character' ? 'character'
      : yes.type === 'double' || no.type === 'double' ? 'double'
        : yes.type || no.type || 'logical';
    return mkAtomic(type, out);
  });

  reg('cumsum', ({ args }) => {
    const x = coerceVector(arg(args, 0) ?? R_NULL, 'double');
    let acc = 0;
    let poisoned = false;
    return mkDouble(x.values.map((v) => {
      if (poisoned || isNA(v)) { poisoned = true; return NA; }  // NA poisons the running total
      acc += v;
      return acc;
    }));
  });
}

const unaryMath = (fn) => ({ args }) => {
  const x = arg(args, 0) ?? R_NULL;
  if (isNull(x)) return mkDouble([]);
  const v = coerceVector(x, 'double');
  return mkDouble(v.values.map((n) => (isNA(n) ? NA : fn(n))));
};

function extreme(ctx, fn, fname) {
  const first = ctx.args.filter((a) => a.name !== 'na.rm')[0]?.value;
  if (first && isAtomic(first) && first.type === 'character') {
    const vals = first.values.filter((v) => !isNA(v));
    const sorted = vals.slice().sort(comparator('character'));
    return mkCharacter([fn === Math.min ? sorted[0] : sorted[sorted.length - 1]]);
  }
  const { vals, naRM, sawNA, isInt } = numbers(ctx.args, { ...ctx, fname });
  if (sawNA && !naRM) return naResult(isInt);
  if (!vals.length) return mkDouble([fn === Math.min ? Infinity : -Infinity]);
  const r = fn(...vals);
  return isInt ? mkInteger([r]) : mkDouble([r]);
}

function variance(ctx, sqrtIt) {
  const { vals, naRM, sawNA } = numbers(ctx.args, { ...ctx, fname: sqrtIt ? 'sd' : 'var' });
  if (sawNA && !naRM) return mkDouble([NA]);
  if (vals.length < 2) return mkDouble([NA]);
  const m = vals.reduce((a, b) => a + b, 0) / vals.length;
  // Sample variance: divide by n-1, matching R's default.
  const v = vals.reduce((a, b) => a + (b - m) ** 2, 0) / (vals.length - 1);
  return mkDouble([sqrtIt ? Math.sqrt(v) : v]);
}

const boolAggregate = (kind) => ({ args }) => {
  const naRM = asFlag(namedArg(args, 'na.rm'), false);
  let sawNA = false;
  const cells = [];
  for (const a of args) {
    if (a.name === 'na.rm') continue;
    const v = a.value;
    if (!v || isNull(v)) continue;
    for (const x of coerceVector(v, 'logical').values) {
      if (isNA(x)) { sawNA = true; if (naRM) continue; }
      cells.push(x);
    }
  }
  if (kind === 'any') {
    if (cells.some((x) => x === true)) return mkLogical([true]);
    return mkLogical([sawNA && !naRM ? NA : false]);
  }
  if (cells.some((x) => x === false)) return mkLogical([false]);
  return mkLogical([sawNA && !naRM ? NA : true]);
};

function whichExtreme(args, dir) {
  const x = coerceVector(arg(args, 0) ?? R_NULL, 'double');
  let best = null;
  let bestI = -1;
  x.values.forEach((v, i) => {
    if (isNA(v)) return;
    if (best === null || (dir > 0 ? v > best : v < best)) { best = v; bestI = i; }
  });
  return bestI === -1 ? mkInteger([]) : mkInteger([bestI + 1]);
}

const comparator = (type) => (type === 'character'
  ? (a, b) => String(a).localeCompare(String(b), 'en')
  : (a, b) => a - b);

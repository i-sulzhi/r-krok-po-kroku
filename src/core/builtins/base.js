/**
 * Base builtins: construction, type inspection, conversion, and text output.
 *
 * Each builtin receives `{args, env, node, interp}` where `args` are already
 * evaluated (see the eager-evaluation note in eval.js) and carry their `name` when
 * the caller supplied one.
 */

import {
  NA, isNA, mkAtomic, mkDouble, mkInteger, mkCharacter, mkLogical, mkList, mkBuiltin,
  R_NULL, isNull, isAtomic, isList, isFunction, rLength, getNames, getAttr, setAttr,
  rClass, isFactor, stripAttrs, TYPE_CLASS,
} from '../rvalue.js';
import { coerceVector, unifyTypes, commonType, RError, convertCell, doubleToString } from '../coerce.js';
import { factorToCharacter } from '../arith.js';
import { formatValue, formatCells, inlineSummary } from '../format.js';
import { EV } from '../../trace/events.js';
import { t } from '../../i18n/index.js';

/** Positional argument helper: first unnamed arg, or the one named `name`. */
export function arg(args, i, name = null) {
  if (name) {
    const hit = args.find((a) => a.name === name);
    if (hit) return hit.value;
  }
  const positional = args.filter((a) => !a.name);
  return positional[i]?.value;
}

export function namedArg(args, name, fallback = null) {
  const hit = args.find((a) => a.name === name);
  return hit ? hit.value : fallback;
}

export const asFlag = (v, dflt = false) => {
  if (v == null || isNull(v) || rLength(v) === 0) return dflt;
  const c = convertCell(v.values[0], v.type, 'logical');
  return isNA(c) ? dflt : c;
};

export const asNum = (v, dflt = null) => {
  if (v == null || isNull(v) || rLength(v) === 0) return dflt;
  const c = convertCell(v.values[0], v.type, 'double');
  return isNA(c) ? dflt : c;
};

export const asStr = (v, dflt = '') => {
  if (v == null || isNull(v) || rLength(v) === 0) return dflt;
  const c = convertCell(v.values[0], v.type, 'character');
  return isNA(c) ? dflt : String(c);
};

/**
 * `c()` -- combine. The single most-used function in R, and the first place a
 * beginner meets silent type promotion: c(1, "a") is character, not a mixed bag.
 */
function rC({ args, node, interp }) {
  const parts = args.filter((a) => !isNull(a.value) || isList(a.value));
  const values = parts.map((a) => a.value);
  if (values.length === 0) return R_NULL;

  // If anything is a list (or a function, which cannot live in an atomic vector),
  // the result is a list and nothing is coerced.
  const anyList = values.some((v) => isList(v) || isFunction(v));
  if (anyList) {
    const out = [];
    const names = [];
    parts.forEach((a) => {
      const v = a.value;
      if (isList(v)) {
        const nm = getNames(v);
        v.values.forEach((el, i) => { out.push(el); names.push(nm ? String(nm.values[i] ?? '') : ''); });
      } else if (isAtomic(v)) {
        const nm = getNames(v);
        v.values.forEach((el, i) => {
          out.push(mkAtomic(v.type, [el]));
          names.push(a.name || (nm ? String(nm.values[i] ?? '') : ''));
        });
      } else {
        out.push(v); names.push(a.name || '');
      }
    });
    const hasNames = names.some((n) => n);
    return mkList(out, hasNames ? { names: mkCharacter(names) } : null);
  }

  // Factors combine by their labels, not their hidden integer codes.
  const normalised = values.map((v) => (isFactor(v) ? factorToCharacter(v) : v));
  const types = normalised.filter(isAtomic).map((v) => v.type);
  const target = commonType(types.length ? types : ['logical']);

  const before = normalised.map((v) => ({ type: isAtomic(v) ? v.type : 'null', values: isNull(v) ? [] : v.values.slice() }));
  const promotedFrom = [...new Set(types.filter((t) => t !== target))];

  const cells = [];
  const names = [];
  parts.forEach((a, k) => {
    const v = normalised[k];
    if (isNull(v)) return;
    const nm = getNames(v);
    const len = rLength(v);
    v.values.forEach((x, i) => {
      cells.push(convertCell(x, v.type, target));
      const inner = nm ? String(nm.values[i] ?? '') : '';
      // c(a = 1) names the element "a"; c(a = c(x = 1)) makes "a.x"
      names.push(a.name ? (inner ? `${a.name}.${inner}` : (len > 1 ? `${a.name}${i + 1}` : a.name)) : inner);
    });
  });

  if (promotedFrom.length) {
    interp.trace?.emit(EV.COERCE, {
      from: promotedFrom.join('/'), to: target, reason: 'c-mixed', node,
      before: before.flatMap((b) => b.values), after: cells.slice(),
      parts: before, lostPositions: [], downward: false,
    });
  }

  const hasNames = names.some((n) => n);
  return mkAtomic(target, cells, hasNames ? { names: mkCharacter(names) } : null);
}

/** `seq()` in its common forms, plus the safe `seq_len` / `seq_along`. */
function rSeq({ args, node }) {
  const from = namedArg(args, 'from') ?? arg(args, 0);
  const to = namedArg(args, 'to') ?? arg(args, 1);
  const by = namedArg(args, 'by') ?? arg(args, 2);
  const lengthOut = namedArg(args, 'length.out') || namedArg(args, 'length_out');

  if (from && !to && !by && !lengthOut) {
    const n = asNum(from, 1);
    return mkInteger(Array.from({ length: Math.max(0, Math.trunc(n)) }, (_, i) => i + 1));
  }
  const a = asNum(from, 1);
  if (lengthOut) {
    const n = Math.trunc(asNum(lengthOut, 0));
    if (to != null) {
      const b = asNum(to, 1);
      if (n === 1) return mkDouble([a]);
      const step = (b - a) / (n - 1);
      return mkDouble(Array.from({ length: n }, (_, i) => a + i * step));
    }
    const step = by ? asNum(by, 1) : 1;
    return mkDouble(Array.from({ length: n }, (_, i) => a + i * step));
  }
  const b = asNum(to, 1);
  const step = by ? asNum(by, b >= a ? 1 : -1) : (b >= a ? 1 : -1);
  if (step === 0) throw new RError('err.seqZeroStep', node);
  const n = Math.floor((b - a) / step + 1e-10) + 1;
  if (n <= 0) throw new RError('err.seqEmpty', node);
  const values = Array.from({ length: n }, (_, i) => a + i * step);
  const isInt = Number.isInteger(a) && Number.isInteger(step);
  return mkAtomic(isInt ? 'integer' : 'double', values);
}

function rRep({ args, node }) {
  const x = arg(args, 0) ?? R_NULL;
  const times = namedArg(args, 'times') ?? arg(args, 1);
  const each = namedArg(args, 'each');
  const lengthOut = namedArg(args, 'length.out');
  if (isNull(x)) return R_NULL;

  let cells = x.values.slice();
  if (each) {
    const e = Math.trunc(asNum(each, 1));
    cells = cells.flatMap((v) => Array(Math.max(0, e)).fill(v));
  }
  if (times) {
    if (rLength(times) > 1) {                        // rep(x, times = c(2, 3)): per-element counts
      const counts = times.values.map((v) => Math.trunc(asNumRaw(v)));
      if (counts.length !== cells.length) throw new RError('err.repTimesLength', node);
      cells = cells.flatMap((v, i) => Array(Math.max(0, counts[i])).fill(v));
    } else {
      const t = Math.trunc(asNum(times, 1));
      const once = cells.slice();
      cells = [];
      for (let i = 0; i < t; i++) cells.push(...once);
    }
  }
  if (lengthOut) {
    const n = Math.trunc(asNum(lengthOut, cells.length));
    const src = cells.slice();
    cells = Array.from({ length: n }, (_, i) => src[i % src.length]);
  }
  return isList(x) ? mkList(cells) : mkAtomic(x.type, cells);
}

const asNumRaw = (v) => (isNA(v) ? 0 : Number(v));

/** Conversions -- each one narrates its own coercion. */
const conversion = (to, name) => ({ args, node, interp }) => {
  let x = arg(args, 0) ?? R_NULL;
  if (isNull(x)) return mkAtomic(to, []);
  // as.numeric(factor) famously returns the integer codes, not the labels.
  if (isFactor(x) && to !== 'character') {
    interp.trace?.emit(EV.WARNING, { kind: 'factor-as-numeric', node });
    x = mkAtomic('integer', x.values.slice());
  } else if (isFactor(x)) {
    x = factorToCharacter(x);
  }
  if (isList(x)) {
    const flat = x.values.map((el) => (isAtomic(el) && rLength(el) === 1 ? el.values[0] : NA));
    const types = x.values.filter(isAtomic).map((v) => v.type);
    x = mkAtomic(commonType(types.length ? types : ['logical']), flat);
  }
  // `as.*` returns a bare vector: R drops names, levels and class on the way out,
  // which is why as.integer(table(x)) prints as plain counts rather than a table.
  return stripAttrs(coerceVector(x, to, { trace: interp.trace, reason: name, node }));
};

/** `print()` and `cat()` differ in a way beginners notice immediately. */
function rPrint({ args, interp, node }) {
  const x = arg(args, 0) ?? R_NULL;
  interp.printValue(x, node);
  return x;
}

function rCat({ args, interp }) {
  const sep = asStr(namedArg(args, 'sep'), ' ');
  const pieces = [];
  for (const a of args) {
    if (a.name === 'sep' || a.name === 'fill') continue;
    const v = a.value;
    if (isNull(v)) continue;
    if (isFactor(v)) { pieces.push(...factorToCharacter(v).values.map(String)); continue; }
    if (isList(v)) throw new RError('err.catList');
    // cat() prints raw text: no quotes, no [1] index.
    pieces.push(...v.values.map((x) => (isNA(x) ? 'NA'
      : v.type === 'double' ? doubleToString(x)
      : v.type === 'logical' ? (x ? 'TRUE' : 'FALSE') : String(x))));
  }
  interp.printText(pieces.join(sep));
  return R_NULL;
}

function rPaste(sepDefault) {
  return ({ args, interp, node }) => {
    const sep = asStr(namedArg(args, 'sep'), sepDefault);
    const collapse = namedArg(args, 'collapse');
    const vectors = args.filter((a) => a.name !== 'sep' && a.name !== 'collapse')
      .map((a) => (isFactor(a.value) ? factorToCharacter(a.value) : a.value))
      .filter((v) => !isNull(v))
      .map((v) => coerceVector(v, 'character', { trace: null }));
    if (!vectors.length) return mkCharacter(collapse ? [''] : []);
    const n = Math.max(...vectors.map(rLength));
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push(vectors.map((v) => {
        const cell = v.values[i % rLength(v)];
        return isNA(cell) ? 'NA' : String(cell);     // paste turns NA into the text "NA"
      }).join(sep));
    }
    if (collapse && !isNull(collapse)) return mkCharacter([out.join(asStr(collapse, ''))]);
    return mkCharacter(out);
  };
}

/** Type predicates and reporters. */
const typeOf = (v) => {
  if (isNull(v)) return 'NULL';
  if (isFunction(v)) return v.kind === 'builtin' ? 'builtin' : 'closure';
  if (isList(v)) return 'list';
  return v.type;
};

export function registerBase(reg) {
  reg('c', rC);
  reg('seq', rSeq);
  reg('seq_len', ({ args }) => mkInteger(Array.from({ length: Math.max(0, Math.trunc(asNum(arg(args, 0), 0))) }, (_, i) => i + 1)));
  reg('seq_along', ({ args }) => mkInteger(Array.from({ length: rLength(arg(args, 0) ?? R_NULL) }, (_, i) => i + 1)));
  reg('rep', rRep);
  reg('length', ({ args }) => mkInteger([rLength(arg(args, 0) ?? R_NULL)]));
  reg('rev', ({ args }) => {
    const x = arg(args, 0) ?? R_NULL;
    if (isNull(x)) return R_NULL;
    const names = getNames(x);
    const out = isList(x) ? mkList(x.values.slice().reverse()) : mkAtomic(x.type, x.values.slice().reverse());
    return names ? setAttr(out, 'names', mkCharacter(names.values.slice().reverse())) : out;
  });

  reg('as.numeric', conversion('double', 'as.numeric'));
  reg('as.double', conversion('double', 'as.double'));
  reg('as.integer', conversion('integer', 'as.integer'));
  reg('as.character', conversion('character', 'as.character'));
  reg('as.logical', conversion('logical', 'as.logical'));

  reg('is.na', ({ args }) => {
    const x = arg(args, 0) ?? R_NULL;
    if (isNull(x)) return mkLogical([]);
    if (isList(x)) return mkLogical(x.values.map((el) => isAtomic(el) && rLength(el) === 1 && isNA(el.values[0])));
    return mkLogical(x.values.map(isNA));
  });
  reg('is.null',      ({ args }) => mkLogical([isNull(arg(args, 0) ?? R_NULL)]));
  reg('is.numeric',   ({ args }) => { const x = arg(args, 0); return mkLogical([!!x && isAtomic(x) && (x.type === 'double' || x.type === 'integer') && !isFactor(x)]); });
  reg('is.character', ({ args }) => { const x = arg(args, 0); return mkLogical([!!x && isAtomic(x) && x.type === 'character']); });
  reg('is.logical',   ({ args }) => { const x = arg(args, 0); return mkLogical([!!x && isAtomic(x) && x.type === 'logical']); });
  reg('is.function',  ({ args }) => mkLogical([isFunction(arg(args, 0) ?? R_NULL)]));
  reg('is.vector',    ({ args }) => { const x = arg(args, 0); return mkLogical([!!x && (isAtomic(x) || isList(x)) && !x.attributes?.dim]); });
  reg('is.list',      ({ args }) => mkLogical([isList(arg(args, 0) ?? R_NULL)]));
  reg('is.factor',    ({ args }) => mkLogical([isFactor(arg(args, 0) ?? R_NULL)]));

  reg('class',  ({ args }) => mkCharacter(rClass(arg(args, 0) ?? R_NULL)));
  reg('typeof', ({ args }) => mkCharacter([typeOf(arg(args, 0) ?? R_NULL)]));
  reg('mode',   ({ args }) => { const t = typeOf(arg(args, 0) ?? R_NULL); return mkCharacter([t === 'integer' || t === 'double' ? 'numeric' : t]); });

  reg('names', ({ args }) => getNames(arg(args, 0) ?? R_NULL) || R_NULL);
  reg('unname', ({ args }) => setAttr(arg(args, 0) ?? R_NULL, 'names', null));
  reg('attributes', ({ args }) => {
    const x = arg(args, 0) ?? R_NULL;
    if (!x.attributes) return R_NULL;
    const keys = Object.keys(x.attributes);
    return mkList(keys.map((k) => x.attributes[k]), { names: mkCharacter(keys) });
  });

  reg('print', rPrint);
  reg('cat', rCat);
  reg('paste', rPaste(' '));
  reg('paste0', rPaste(''));

  reg('head', ({ args }) => sliceEnds(arg(args, 0), namedArg(args, 'n') ?? arg(args, 1), true));
  reg('tail', ({ args }) => sliceEnds(arg(args, 0), namedArg(args, 'n') ?? arg(args, 1), false));

  reg('invisible', ({ args }) => arg(args, 0) ?? R_NULL);
  reg('return', ({ args, interp }) => { throw new (interp.constructor.ReturnSignal || Error)(arg(args, 0) ?? R_NULL); });
}

function sliceEnds(x, nArg, fromStart) {
  if (!x || isNull(x)) return R_NULL;
  const total = rLength(x);
  let n = nArg ? Math.trunc(asNum(nArg, 6)) : 6;
  if (n < 0) n = Math.max(0, total + n);
  n = Math.min(n, total);
  const idx = fromStart
    ? Array.from({ length: n }, (_, i) => i)
    : Array.from({ length: n }, (_, i) => total - n + i);
  const names = getNames(x);
  const out = isList(x) ? mkList(idx.map((i) => x.values[i])) : mkAtomic(x.type, idx.map((i) => x.values[i]));
  return names ? setAttr(out, 'names', mkCharacter(idx.map((i) => names.values[i]))) : out;
}

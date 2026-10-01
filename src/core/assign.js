/**
 * Assignment, including the compound forms: `x[i] <- v`, `x$name <- v`, `names(x) <- v`.
 *
 * R implements those through replacement functions: `names(x) <- v` really means
 * `x <- \`names<-\`(x, v)`. We follow the same shape, because it explains an otherwise
 * baffling rule -- you can only assign into something that is *stored in a variable*.
 *
 * Two lessons live in this file:
 *
 * - **Copy-on-modify.** Changing one cell rebuilds the vector. Every rebuild emits a
 *   COPY event, so "R copied your data here" becomes visible.
 *
 * - **Assignment can change the type of the whole vector.** `x <- 1:3; x[1] <- "a"`
 *   leaves every element a string, because a vector cannot hold mixed types.
 */

import {
  NA, mkAtomic, mkList, mkCharacter, R_NULL, isNull, isAtomic, isList,
  rLength, getNames, getAttr, setAttr, valueId, isFactor,
} from './rvalue.js';
import { RError, coerceVector, commonType, convertCell } from './coerce.js';
import { resolvePositions, classifyIndex, INDEX_KIND } from './subset.js';
import { EV } from '../trace/events.js';
import { typeRank } from './rvalue.js';
import { t } from '../i18n/index.js';

/** Entry point for every `Assign` node. */
export function assignInto(interp, node, env) {
  const { target, value: valueNode, scope } = node;
  const value = interp.eval(valueNode, env);
  return assignToTarget(interp, target, value, env, { scope, node });
}

function assignToTarget(interp, target, value, env, { scope, node }) {
  switch (target.type) {
    case 'Ident':
      return scope === 'global'
        ? env.defineSuper(target.name, value, { trace: interp.trace, node })
        : env.define(target.name, value, { trace: interp.trace, node });

    case 'Str':
      return env.define(target.value, value, { trace: interp.trace, node });

    case 'Index': {
      const base = evalTargetBase(interp, target.object, env, node);
      const updated = target.bracket === '[['
        ? setDoubleBracket(interp, base.value, target, value, env, node)
        : setSingleBracket(interp, base.value, target, value, env, node);
      return assignToTarget(interp, target.object, updated, env, { scope, node });
    }

    case 'Extract': {
      const base = evalTargetBase(interp, target.object, env, node);
      const updated = setDollar(interp, base.value, target.name, value, node);
      return assignToTarget(interp, target.object, updated, env, { scope, node });
    }

    case 'Call': {
      // `names(x) <- v`, `class(x) <- v`, ... -- the replacement-function form.
      if (target.callee.type !== 'Ident') {
        throw new RError('err.assignTargetShape', node);
      }
      const fname = target.callee.name;
      const replacer = REPLACEMENTS[fname];
      if (!replacer) {
        throw new RError('err.noReplacementFn', node, { fname });
      }
      const inner = target.args[0]?.value;
      if (!inner) throw new RError('err.replacementNeedsObject', node, { fname });
      const base = evalTargetBase(interp, inner, env, node);
      const updated = replacer(interp, base.value, value, node);
      return assignToTarget(interp, inner, updated, env, { scope, node });
    }

    default:
      throw new RError('err.assignTargetName', node);
  }
}

/** Read the current value of an assignment target, tolerating "not created yet". */
function evalTargetBase(interp, node, env, at) {
  if (node.type === 'Ident') {
    const found = env.tryLookup(node.name);
    if (!found) {
      throw new RError('err.modifyMissing', at, { name: node.name });
    }
    return { value: found.value };
  }
  return { value: interp.eval(node, env) };
}

/** `x[i] <- value` */
function setSingleBracket(interp, base, target, value, env, node) {
  const trace = interp.trace;
  if (isNull(base)) base = isList(value) ? mkList([]) : mkAtomic(atomicTypeOf(value), []);

  const args = target.args;
  if (args.length === 2) {
    const df = interp.dataFrameOps?.dataFrameSet2d;
    if (df) {
      const rowIdx = args[0].empty ? null : interp.eval(args[0].value, env);
      const colIdx = args[1].empty ? null : interp.eval(args[1].value, env);
      return df(base, rowIdx, colIdx, value, { trace, node, interp });
    }
    throw new RError('err.assign2dOnlyDf', node);
  }

  const idx = (args.length === 0 || args[0].empty) ? null : interp.eval(args[0].value, env);
  const { positions, kind } = idx
    ? resolvePositions(base, idx, { trace, node })
    : { positions: Array.from({ length: rLength(base) }, (_, i) => i), kind: INDEX_KIND.EMPTY };

  // Positive indices beyond the end grow the vector, filling the gap with NA.
  let target_ = base;
  let grewTo = null;
  if (idx && kind === INDEX_KIND.POSITIVE) {
    const maxIdx = Math.max(0, ...idx.values.filter((v) => v !== NA && v > 0).map((v) => Math.trunc(v)));
    if (maxIdx > rLength(base)) {
      target_ = growVector(base, maxIdx);
      grewTo = maxIdx;
      trace?.emit(EV.COPY, { reason: 'grow', node, from: rLength(base), to: maxIdx, valueId: valueId(base) });
    }
  }
  // Names used as indices can also create new elements.
  if (idx && kind === INDEX_KIND.NAME) {
    const names = getNames(target_);
    const known = names ? names.values : [];
    const fresh = idx.values.filter((nm) => nm !== NA && !known.includes(nm));
    if (fresh.length) {
      target_ = appendNamed(target_, fresh);
      grewTo = rLength(target_);
    }
  }

  const finalPositions = idx && (kind === INDEX_KIND.POSITIVE || kind === INDEX_KIND.NAME)
    ? resolvePositions(target_, idx, { trace: null, node }).positions
    : positions;

  if (isList(target_)) {
    const values = target_.values.slice();
    const src = isList(value) ? value.values : [value];
    finalPositions.forEach((p, k) => { if (p !== NA) values[p] = src[k % src.length]; });
    const out = mkList(values, target_.attributes);
    trace?.emit(EV.COPY, { reason: 'modify', node, positions: finalPositions, valueId: valueId(target_) });
    return out;
  }

  // A vector holds one type. Assigning a "higher" type promotes the whole thing.
  const valueVec = isAtomic(value) ? value : coerceAtomic(value, node);
  const target_type = target_.type;
  const winner = commonType([target_type, valueVec.type]);
  let workVec = target_;
  if (winner !== target_type) {
    workVec = coerceVector(target_, winner, { trace, reason: 'assign-promote', node });
  }
  const srcVec = valueVec.type === winner ? valueVec : coerceVector(valueVec, winner, { trace, reason: 'assign-value', node });

  const values = workVec.values.slice();
  const before = values.slice();
  const src = srcVec.values;
  if (src.length === 0) throw new RError('err.assignEmpty', node);
  const slots = finalPositions.filter((p) => p !== NA);
  if (slots.length % src.length !== 0 && src.length > 1) {
    interp.warn(t('warn.assignPartial', { src: src.length, slots: slots.length }), node);
  }
  slots.forEach((p, k) => { values[p] = src[k % src.length]; });

  const out = mkAtomic(winner, values, workVec.attributes);
  trace?.emit(EV.COPY, {
    reason: 'modify', node, positions: slots, before, after: values,
    grewTo, promotedTo: winner !== target_type ? winner : null,
    valueId: valueId(target_),
  });
  return out;
}

/** `x[[i]] <- value` */
function setDoubleBracket(interp, base, target, value, env, node) {
  const trace = interp.trace;
  const idxNode = target.args[0]?.value;
  if (!idxNode) throw new RError('err.doubleNeedsIndex', node);
  const idx = interp.eval(idxNode, env);

  if (isNull(base)) base = mkList([]);

  if (isList(base)) {
    const names = getNames(base);
    let pos;
    if (idx.type === 'character') {
      const nm = idx.values[0];
      const labels = names ? names.values.slice() : new Array(rLength(base)).fill('');
      pos = labels.indexOf(nm);
      if (pos === -1) {
        const values = base.values.concat([value]);
        labels.push(nm);
        trace?.emit(EV.COPY, { reason: 'add-element', node, name: nm, to: values.length });
        return mkList(values, { ...(base.attributes || {}), names: mkCharacter(labels) });
      }
    } else {
      pos = Math.trunc(idx.values[0]) - 1;
    }
    const values = base.values.slice();
    while (values.length < pos) values.push(R_NULL);
    // Assigning NULL into a list *removes* the element -- a classic surprise.
    if (isNull(value)) {
      values.splice(pos, 1);
      const names2 = names ? mkCharacter(names.values.filter((_, i) => i !== pos)) : null;
      trace?.emit(EV.COPY, { reason: 'remove-element', node, position: pos });
      return mkList(values, names2 ? { ...(base.attributes || {}), names: names2 } : base.attributes);
    }
    values[pos] = value;
    trace?.emit(EV.COPY, { reason: 'modify', node, positions: [pos] });
    return mkList(values, base.attributes);
  }

  return setSingleBracket(interp, base, { ...target, bracket: '[', args: target.args }, value, env, node);
}

/** `x$name <- value` */
function setDollar(interp, base, name, value, node) {
  const trace = interp.trace;
  if (isNull(base)) base = mkList([], { names: mkCharacter([]) });
  if (isAtomic(base)) {
    throw new RError('err.dollarOnVectorShort', node);
  }
  const names = getNames(base);
  const labels = names ? names.values.slice() : new Array(rLength(base)).fill('');
  const pos = labels.indexOf(name);

  if (isNull(value)) {                              // `df$col <- NULL` deletes the column
    if (pos === -1) return base;
    const values = base.values.filter((_, i) => i !== pos);
    labels.splice(pos, 1);
    trace?.emit(EV.COPY, { reason: 'remove-element', node, name, position: pos });
    return rebuildList(base, values, labels);
  }

  const values = base.values.slice();
  if (pos === -1) { values.push(value); labels.push(name); trace?.emit(EV.COPY, { reason: 'add-element', node, name }); }
  else { values[pos] = value; trace?.emit(EV.COPY, { reason: 'modify', node, name, positions: [pos] }); }
  return rebuildList(base, values, labels);
}

function rebuildList(base, values, labels) {
  const attrs = { ...(base.attributes || {}), names: mkCharacter(labels) };
  // A data.frame keeps its row.names and class through column edits.
  return mkList(values, attrs);
}

// --- replacement functions: names(x) <- v and friends -----------------------

const REPLACEMENTS = {
  names: (interp, obj, value, node) => {
    if (isNull(value)) return setAttr(obj, 'names', null);
    const chr = coerceVector(value, 'character', { trace: interp.trace, reason: 'names<-', node });
    const n = rLength(obj);
    const vals = chr.values.slice(0, n);
    while (vals.length < n) vals.push(NA);          // too few names: the rest become NA
    interp.trace?.emit(EV.ASSIGN, { name: 'names', node, attribute: true, value: mkCharacter(vals) });
    return setAttr(obj, 'names', mkCharacter(vals));
  },
  class: (interp, obj, value, node) =>
    setAttr(obj, 'class', isNull(value) ? null : coerceVector(value, 'character', { trace: interp.trace, node })),
  levels: (interp, obj, value, node) =>
    setAttr(obj, 'levels', isNull(value) ? null : coerceVector(value, 'character', { trace: interp.trace, node })),
  dim: (interp, obj, value, node) =>
    setAttr(obj, 'dim', isNull(value) ? null : coerceVector(value, 'integer', { trace: interp.trace, node })),
  length: (interp, obj, value, node) => {
    const n = Math.trunc(coerceVector(value, 'double').values[0]);
    const cur = rLength(obj);
    if (n === cur) return obj;
    if (n < cur) {
      interp.trace?.emit(EV.COPY, { reason: 'truncate', node, from: cur, to: n });
      return isList(obj) ? mkList(obj.values.slice(0, n), obj.attributes)
                         : mkAtomic(obj.type, obj.values.slice(0, n), obj.attributes);
    }
    interp.trace?.emit(EV.COPY, { reason: 'grow', node, from: cur, to: n });
    return growVector(obj, n);
  },
};

// --- helpers ---------------------------------------------------------------

function growVector(v, n) {
  if (isList(v)) {
    const values = v.values.slice();
    while (values.length < n) values.push(R_NULL);
    return mkList(values, v.attributes);
  }
  const values = v.values.slice();
  while (values.length < n) values.push(NA);
  const names = getNames(v);
  const attrs = names
    ? { ...(v.attributes || {}), names: mkCharacter(padNames(names.values, n)) }
    : v.attributes;
  return mkAtomic(v.type, values, attrs);
}

function appendNamed(v, freshNames) {
  const names = getNames(v);
  const labels = names ? names.values.slice() : new Array(rLength(v)).fill('');
  const values = v.values.slice();
  for (const nm of freshNames) { values.push(isList(v) ? R_NULL : NA); labels.push(nm); }
  const attrs = { ...(v.attributes || {}), names: mkCharacter(labels) };
  return isList(v) ? mkList(values, attrs) : mkAtomic(v.type, values, attrs);
}

const padNames = (labels, n) => {
  const out = labels.slice();
  while (out.length < n) out.push('');
  return out;
};

const atomicTypeOf = (v) => (isAtomic(v) ? v.type : 'logical');

function coerceAtomic(value, node) {
  if (isNull(value)) throw new RError('err.assignNull', node);
  throw new RError('err.assignSimpleOnly', node);
}

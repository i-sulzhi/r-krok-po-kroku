/**
 * The evaluator.
 *
 * A plain tree-walking interpreter -- speed is irrelevant here, clarity of narration
 * is everything. Each node type evaluates itself and reports what it did.
 *
 * Two deliberate simplifications versus real R, both recorded so nobody "fixes" them
 * by accident later:
 *
 * - **Arguments are evaluated eagerly.** Real R uses promises (lazy evaluation).
 *   Laziness is invisible in the code a beginner writes, and modelling it would add a
 *   layer of indirection to every call diagram for no teaching gain.
 *
 * - **Copy-on-modify is modelled, not optimised.** R avoids copying when a value has
 *   one reference; we always copy on modification and emit a COPY event, because the
 *   copy is the thing we want the student to see.
 */

import {
  NA, mkAtomic, mkDouble, mkInteger, mkCharacter, mkLogical, mkList, mkClosure,
  R_NULL, isNull, isAtomic, isList, isFunction, rLength, getNames, setAttr, getAttr,
  valueId, isFactor,
} from './rvalue.js';
import { RError, asCondition, coerceVector } from './coerce.js';
import { binaryOp, unaryOp } from './arith.js';
import { singleBracket, doubleBracket, dollar } from './subset.js';
import { assignInto } from './assign.js';
import { Env } from './env.js';
import { EV } from '../trace/events.js';
import { t } from '../i18n/index.js';

/** Control-flow signals, thrown rather than returned so they unwind nested blocks. */
export class BreakSignal { }
export class NextSignal { }
export class ReturnSignal { constructor(value) { this.value = value; } }

/** Guard against a runaway loop taking the browser tab down with it. */
const DEFAULT_STEP_BUDGET = 200000;

/**
 * Maximum nested calls. A function that calls itself without a stopping condition
 * would otherwise exhaust the JavaScript stack, which surfaces as a RangeError the
 * student cannot interpret -- and, in the browser, can take the page with it.
 * R has the same guard (`options(expressions=)`); this one is stricter because each
 * R-level call costs several JS frames.
 */
const DEFAULT_CALL_DEPTH = 400;

export class Interpreter {
  constructor({ trace = null, evalLog = null, globalEnv = null, stepBudget = DEFAULT_STEP_BUDGET, maxDepth = DEFAULT_CALL_DEPTH } = {}) {
    this.trace = trace;
    this.evalLog = evalLog;    // what each sub-expression evaluated to (trace/evallog.js)
    this.global = globalEnv || new Env(null, { name: t('env.global') });
    this.stepBudget = stepBudget;
    this.maxDepth = maxDepth;
    this.callDepth = 0;
    this.steps = 0;
    this.output = [];          // console lines, in order
    this.warnings = [];
  }

  /** Run a parsed program; returns the value of the last expression. */
  run(program, env = this.global) {
    let last = R_NULL;
    for (const expr of program.body) {
      last = this.eval(expr, env);
      // At top level R prints the value of any expression that is not an assignment.
      if (expr.type !== 'Assign' && !isInvisible(expr)) this.printValue(last, expr);
    }
    return last;
  }

  /** Evaluate without auto-printing -- used when checking a student's answer. */
  runQuiet(program, env = this.global) {
    let last = R_NULL;
    for (const expr of program.body) last = this.eval(expr, env);
    return last;
  }

  tick(node) {
    if (++this.steps > this.stepBudget) {
      throw new RError('err.stepBudget', node);
    }
  }

  /**
   * Evaluate one node. When an evaluation log is attached, the value is reported
   * to it -- that is the whole cost of making every sub-expression clickable.
   */
  eval(node, env) {
    const log = this.evalLog;
    if (!log) return this.evalNode(node, env);
    const entry = log.enter(node);
    let value;
    try {
      value = this.evalNode(node, env);
    } catch (e) {
      log.fail(entry, e, { isError: e instanceof RError });
      throw e;
    }
    log.exit(entry, value);
    return value;
  }

  evalNode(node, env) {
    this.tick(node);
    switch (node.type) {
      case 'Num':
        return node.rtype === 'integer' ? mkInteger([node.value]) : mkDouble([node.value]);
      case 'Str':   return mkCharacter([node.value]);
      case 'Bool':  return mkLogical([node.value]);
      case 'Null':  return R_NULL;
      case 'NAConst': return naConst(node.flavour);
      case 'Missing': return R_NULL;
      case 'Paren': return this.eval(node.expr, env);
      case 'Ident': {
        const { value } = env.lookup(node.name, { trace: this.trace, node });
        return value;
      }
      case 'Binary':   return this.evalBinary(node, env);
      case 'Unary':    return unaryOp(node.op, this.eval(node.operand, env), { trace: this.trace, node });
      case 'Assign':   return assignInto(this, node, env);
      case 'Block': {
        let last = R_NULL;
        for (const e of node.body) last = this.eval(e, env);
        return last;
      }
      case 'If': {
        const cond = asCondition(this.eval(node.cond, env), { node: node.cond });
        if (cond) return this.eval(node.then, env);
        return node.alt ? this.eval(node.alt, env) : R_NULL;
      }
      case 'For':      return this.evalFor(node, env);
      case 'While':    return this.evalWhile(node, env);
      case 'Repeat':   return this.evalRepeat(node, env);
      case 'Break':    throw new BreakSignal();
      case 'Next':     throw new NextSignal();
      case 'Function': return mkClosure(node.params, node.body, env, { src: node.src });
      case 'Call':     return this.evalCall(node, env);
      case 'Index':    return this.evalIndex(node, env);
      case 'Extract':  return this.evalExtract(node, env);
      case 'Formula':  throw new RError('err.formulaUnsupported', node);
      case 'Dots':     throw new RError('err.dotsOutside', node);
      default:
        throw new RError('err.internalNode', node, { type: node.type });
    }
  }

  evalBinary(node, env) {
    const { op } = node;
    // `&&` and `||` short-circuit: the right side may never run, which matters when
    // it would have failed. Students meet this as "why didn't my error happen?".
    if (op === '&&' || op === '||') {
      const left = asCondition(this.eval(node.left, env), { node: node.left });
      if (op === '&&' && !left) { this.trace?.emit(EV.ELEMENTWISE, { op, shortCircuit: true, a: false, result: false, node }); return mkLogical([false]); }
      if (op === '||' && left)  { this.trace?.emit(EV.ELEMENTWISE, { op, shortCircuit: true, a: true, result: true, node }); return mkLogical([true]); }
      const right = asCondition(this.eval(node.right, env), { node: node.right });
      return mkLogical([right]);
    }
    if (op === ':') return this.evalColon(node, env);

    const left = this.eval(node.left, env);
    const right = this.eval(node.right, env);
    if (op === '%in%') return this.evalIn(left, right, node);
    return binaryOp(op, left, right, { trace: this.trace, node });
  }

  /** `a:b` -- an integer sequence, counting down when b < a. */
  evalColon(node, env) {
    const from = this.eval(node.left, env);
    const to = this.eval(node.right, env);
    const a = numScalar(from, node.left, 'tok.colonLeft');
    const b = numScalar(to, node.right, 'tok.colonRight');
    const n = Math.floor(Math.abs(b - a)) + 1;
    const step = b >= a ? 1 : -1;
    const values = Array.from({ length: n }, (_, i) => a + i * step);
    const isInt = Number.isInteger(a) && Number.isInteger(b);
    return mkAtomic(isInt ? 'integer' : 'double', values);
  }

  evalIn(left, right, node) {
    const table = isNull(right) ? [] : right.values;
    const hay = new Set(isAtomic(right) ? table.map(String) : []);
    const values = (isNull(left) ? [] : left.values).map((v) => hay.has(String(v)));
    this.trace?.emit(EV.ELEMENTWISE, { op: '%in%', node, count: values.length, matched: values.filter(Boolean).length });
    return mkLogical(values);
  }

  evalFor(node, env) {
    const seq = this.eval(node.seq, env);
    const n = rLength(seq);
    this.trace?.emit(EV.CALL_ENTER, { kind: 'for', node, iterations: n, varName: node.varName });
    for (let i = 0; i < n; i++) {
      const item = isList(seq) ? seq.values[i] : mkAtomic(seq.type, [seq.values[i]]);
      env.define(node.varName, item, { trace: this.trace, node: node });
      try {
        this.eval(node.body, env);
      } catch (e) {
        if (e instanceof BreakSignal) break;
        if (e instanceof NextSignal) continue;
        throw e;
      }
    }
    this.trace?.emit(EV.CALL_EXIT, { kind: 'for', node });
    return R_NULL;
  }

  evalWhile(node, env) {
    this.trace?.emit(EV.CALL_ENTER, { kind: 'while', node });
    for (;;) {
      this.tick(node);
      if (!asCondition(this.eval(node.cond, env), { node: node.cond })) break;
      try {
        this.eval(node.body, env);
      } catch (e) {
        if (e instanceof BreakSignal) break;
        if (e instanceof NextSignal) continue;
        throw e;
      }
    }
    this.trace?.emit(EV.CALL_EXIT, { kind: 'while', node });
    return R_NULL;
  }

  evalRepeat(node, env) {
    this.trace?.emit(EV.CALL_ENTER, { kind: 'repeat', node });
    for (;;) {
      this.tick(node);
      try {
        this.eval(node.body, env);
      } catch (e) {
        if (e instanceof BreakSignal) break;
        if (e instanceof NextSignal) continue;
        throw e;
      }
    }
    this.trace?.emit(EV.CALL_EXIT, { kind: 'repeat', node });
    return R_NULL;
  }

  evalIndex(node, env) {
    const obj = this.eval(node.object, env);
    const args = node.args;

    // Two indices means a matrix or data.frame: x[rows, cols]
    if (args.length === 2 || (args.length === 3 && args.some((a) => a.name === 'drop'))) {
      const positional = args.filter((a) => a.name !== 'drop');
      const dropArg = args.find((a) => a.name === 'drop');
      const rowIdx = positional[0]?.empty ? null : this.eval(positional[0].value, env);
      const colIdx = positional[1]?.empty ? null : this.eval(positional[1].value, env);
      const drop = dropArg ? asCondition(this.eval(dropArg.value, env), { node }) : true;
      return this.index2d(obj, rowIdx, colIdx, node, drop);
    }
    if (args.length === 0 || args[0].empty) return obj;

    const idx = this.eval(args[0].value, env);
    return node.bracket === '[['
      ? doubleBracket(obj, idx, { trace: this.trace, node })
      : singleBracket(obj, idx, { trace: this.trace, node });
  }

  /** `df[rows, cols]` -- implemented for data.frame; matrices come with the matrix lesson. */
  index2d(obj, rowIdx, colIdx, node, drop = true) {
    const { dataFrameIndex2d } = this.dataFrameOps || {};
    if (dataFrameIndex2d) return dataFrameIndex2d(obj, rowIdx, colIdx, { trace: this.trace, node, interp: this, drop });
    throw new RError('err.index2dOnlyDf', node);
  }

  evalExtract(node, env) {
    const obj = this.eval(node.object, env);
    if (node.op === '@') throw new RError('err.atUnsupported', node);
    return dollar(obj, node.name, { trace: this.trace, node });
  }

  // --- function calls -----------------------------------------------------

  evalCall(node, env) {
    let fn;
    if (node.callee.type === 'Ident') {
      fn = env.lookup(node.callee.name, { trace: this.trace, node: node.callee, mustBeFunction: true }).value;
    } else {
      fn = this.eval(node.callee, env);
    }
    if (!isFunction(fn)) throw new RError('err.notFunction', node);

    const fnName = node.callee.type === 'Ident' ? node.callee.name : (fn.name || t('val.function'));

    if (fn.kind === 'builtin' && fn.special) {
      // A special builtin receives unevaluated arguments (quote, missing, ...).
      return fn.fn({ args: node.args, env, node, interp: this });
    }

    const evaluated = node.args.map((a) => ({
      name: a.name,
      value: a.empty ? R_NULL : this.eval(a.value, env),
      node: a.value,
      empty: !!a.empty,
    }));

    if (fn.kind === 'builtin') {
      this.trace?.enter(EV.CALL_ENTER, {
        fnName, builtin: true, node,
        args: evaluated.map((a) => ({ name: a.name, value: a.value })),
      });
      const out = fn.fn({ args: evaluated, env, node, interp: this });
      this.trace?.exit(EV.CALL_EXIT, { fnName, builtin: true, node, value: out });
      return out;
    }

    return this.callClosure(fn, evaluated, { node, fnName, env });
  }

  /** Bind arguments into a fresh frame and run the body. */
  callClosure(fn, args, { node = null, fnName = null, env = null } = {}) {
    fnName = fnName || t('val.function');
    if (++this.callDepth > this.maxDepth) {
      this.callDepth = 0;
      throw new RError('err.tooDeep', node, { fnName, depth: this.maxDepth });
    }
    const frame = new Env(fn.env, { name: `${fnName}()`, call: node });
    const matched = matchArgs(fn.params, args, { node, fnName });

    this.trace?.enter(EV.CALL_ENTER, {
      fnName, builtin: false, node, frameId: frame.id,
      args: matched.bound.map((b) => ({ name: b.name, value: b.value, source: b.source })),
    });
    this.trace?.emit(EV.FRAME_PUSH, { frameId: frame.id, frameName: frame.name, parentId: fn.env.id, node });

    for (const b of matched.bound) {
      if (b.value !== undefined) frame.vars.set(b.name, b.value);
    }
    // Defaults are evaluated inside the new frame, so a default may refer to another argument.
    for (const p of fn.params) {
      if (!frame.has(p.name) && p.default) {
        frame.vars.set(p.name, this.eval(p.default, frame));
      }
    }
    if (matched.dots.length) {
      frame.vars.set('...', mkList(matched.dots.map((d) => d.value),
        { names: mkCharacter(matched.dots.map((d) => d.name || '')) }));
    }

    let result = R_NULL;
    try {
      result = this.eval(fn.body, frame);
    } catch (e) {
      if (e instanceof ReturnSignal) result = e.value;
      else { this.callDepth--; throw e; }
    }
    this.callDepth--;

    this.trace?.emit(EV.FRAME_POP, { frameId: frame.id, node });
    this.trace?.exit(EV.CALL_EXIT, { fnName, builtin: false, node, value: result, frameId: frame.id });
    return result;
  }

  // --- output -------------------------------------------------------------

  printValue(value, node = null) {
    this.output.push({ kind: 'value', value, node });
    this.trace?.emit(EV.PRINT, { value, node });
  }

  printText(text) {
    this.output.push({ kind: 'text', text });
    this.trace?.emit(EV.PRINT, { text });
  }

  warn(message, node = null) {
    this.warnings.push(message);
    this.output.push({ kind: 'warning', text: message });
    this.trace?.emit(EV.WARNING, { message, node });
  }
}

/**
 * R's three-pass argument matching: exact names, then unique partial names, then
 * position for whatever is left. Named arguments are why `mean(x, na.rm = TRUE)`
 * works regardless of order.
 */
export function matchArgs(params, args, { node = null, fnName = null } = {}) {
  // The default used to be a hard-coded Russian word, which could reach a Polish error message.
  fnName = fnName || t('val.function');
  const bound = [];
  const used = new Array(args.length).fill(false);
  const paramNames = params.map((p) => p.name).filter((n) => n !== '...');
  const dotsIndex = params.findIndex((p) => p.name === '...');
  const taken = new Set();

  // pass 1: exact name
  args.forEach((a, i) => {
    if (a.name && paramNames.includes(a.name)) {
      bound.push({ name: a.name, value: a.value, source: 'name' });
      used[i] = true;
      taken.add(a.name);
    }
  });

  // pass 2: unique partial name -- but only for parameters before `...`
  args.forEach((a, i) => {
    if (used[i] || !a.name) return;
    const pool = (dotsIndex === -1 ? paramNames : paramNames.slice(0, dotsIndex))
      .filter((p) => !taken.has(p) && p.startsWith(a.name));
    if (pool.length === 1) {
      bound.push({ name: pool[0], value: a.value, source: 'partial' });
      used[i] = true;
      taken.add(pool[0]);
    } else if (pool.length > 1) {
      throw new RError('err.partialAmbiguous', node, { name: a.name, candidates: pool.join(', ') });
    }
  });

  // pass 3: position
  const dots = [];
  let p = 0;
  args.forEach((a, i) => {
    if (used[i]) return;
    if (a.name) {                                   // a named argument nothing matched
      if (dotsIndex !== -1) { dots.push(a); used[i] = true; return; }
      throw new RError('err.noSuchArg', node, { fnName, name: a.name });
    }
    while (p < params.length && (taken.has(params[p].name) || params[p].name === '...')) {
      if (params[p].name === '...') break;
      p++;
    }
    if (p >= params.length || params[p].name === '...') {
      if (dotsIndex !== -1) { dots.push(a); used[i] = true; return; }
      throw new RError('err.tooManyArgs', node, { fnName });
    }
    bound.push({ name: params[p].name, value: a.value, source: 'position' });
    taken.add(params[p].name);
    used[i] = true;
    p++;
  });

  return { bound, dots };
}

function naConst(flavour) {
  switch (flavour) {
    case 'NA_integer_':   return mkInteger([NA]);
    case 'NA_real_':      return mkDouble([NA]);
    case 'NA_character_': return mkCharacter([NA]);
    default:              return mkLogical([NA]);
  }
}

function numScalar(v, node, whatKey) {
  if (!isAtomic(v) || rLength(v) === 0) throw new RError('err.needNumber', node, { what: t(whatKey) });
  const n = coerceVector(v, 'double').values[0];
  if (n === NA || Number.isNaN(n)) throw new RError('err.isNA', node, { what: t(whatKey) });
  return n;
}

/** Calls whose result R does not auto-print at top level. */
const INVISIBLE_CALLS = new Set([
  'library', 'require', 'invisible', 'suppressWarnings', 'set.seed', 'assign', 'rm',
  'print', 'cat', 'message', 'warning', 'str', 'writeLines',
]);

/** Node types that evaluate to an invisible value: loops yield NULL and print nothing. */
const INVISIBLE_NODES = new Set(['For', 'While', 'Repeat', 'Assign']);

function isInvisible(expr) {
  if (INVISIBLE_NODES.has(expr.type)) return true;
  // `if (cond) x <- 1` is invisible too: the value came from an assignment.
  if (expr.type === 'If') {
    return isInvisible(expr.then) && (!expr.alt || isInvisible(expr.alt));
  }
  if (expr.type === 'Block') {
    return expr.body.length === 0 || isInvisible(expr.body[expr.body.length - 1]);
  }
  return expr.type === 'Call' && expr.callee.type === 'Ident' && INVISIBLE_CALLS.has(expr.callee.name);
}

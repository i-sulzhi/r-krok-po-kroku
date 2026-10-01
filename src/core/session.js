/**
 * The engine's public surface: give it R source, get back console output plus a
 * complete trace of how that output came to be.
 *
 * The UI talks only to this. Nothing above this layer needs to know that there is a
 * parser, an environment chain, or an event bus underneath.
 */

import { parse } from './parser.js';
import { RSyntaxError } from './lexer.js';
import { Interpreter } from './eval.js';
import { RError } from './coerce.js';
import { Env } from './env.js';
import { Trace } from '../trace/events.js';
import { EvalLog } from '../trace/evallog.js';
import { makeBaseEnv, dataFrameOps } from './builtins/index.js';
import { formatValue } from './format.js';
import { isDataFrame, isAtomic, isFactor, getNames, getAttr } from './rvalue.js';
import { t } from '../i18n/index.js';

export class RSession {
  /**
   * @param {Object} opts
   *   trace   -- record events (off makes runs fast, for answer checking)
   *   persist -- keep variables between run() calls, like a real console
   */
  constructor({ trace = true, persist = true } = {}) {
    this.baseEnv = makeBaseEnv();
    this.globalEnv = new Env(this.baseEnv, { name: t('env.global') });
    this.persist = persist;
    this.traceEnabled = trace;
  }

  /** Wipe the user's variables; the base functions stay. */
  reset() {
    this.globalEnv = new Env(this.baseEnv, { name: t('env.global') });
  }

  /**
   * Run R source.
   * @returns {{ok, lines, output, trace, error, value, env}}
   *   lines  -- console text exactly as R would print it
   *   trace  -- the Trace object, for the timeline
   *   error  -- {message, span, kind} or null
   */
  run(src, { trace = this.traceEnabled } = {}) {
    const tr = new Trace({ enabled: trace });
    // Values of sub-expressions are only worth recording when someone will look.
    const log = trace ? new EvalLog({ trace: tr }) : null;
    const env = this.persist ? this.globalEnv : new Env(this.baseEnv, { name: t('env.global') });
    const interp = new Interpreter({ trace: tr, evalLog: log, globalEnv: env });
    interp.dataFrameOps = dataFrameOps;

    let program;
    try {
      program = parse(src);
    } catch (e) {
      if (e instanceof RSyntaxError) {
        return { ...this.failure(tr, e.message, e.pos, 'syntax', interp, e.key, e.params), evalLog: log, program: null };
      }
      throw e;
    }

    try {
      const value = interp.run(program, env);
      return {
        ok: true,
        lines: renderOutput(interp.output),
        output: interp.output,
        trace: tr,
        evalLog: log,
        program,
        error: null,
        value,
        env,
        interp,
      };
    } catch (e) {
      if (e instanceof RError) {
        const params = e.key === 'err.objNotFound' ? { ...e.params, ...whereIsName(env, e.params?.name) } : e.params;
        return { ...this.failure(tr, e.message, e.node?.span || e.node, 'runtime', interp, e.key, params), evalLog: log, program };
      }
      if (e && e.constructor && /Signal$/.test(e.constructor.name)) {
        return { ...this.failure(tr, t('err.signalOutside'), null, 'runtime', interp), evalLog: log, program };
      }
      // A failure inside the trainer itself must not break the student's screen: it
      // becomes an error that says whose fault it is. The original goes to the console
      // and travels on the result, so tests still see it.
      if (typeof console !== 'undefined') console.error('[r-trainer] internal error', e);
      return { ...this.failure(tr, t('err.internal'), null, 'runtime', interp, 'err.internal'), evalLog: log, program, internal: e };
    }
  }

  /**
   * `key` and `params` travel with the error so diagnosis can match on the key
   * rather than on the rendered sentence -- text matching would silently stop
   * working the moment the language changes.
   */
  failure(tr, message, span, kind, interp, key = null, params = {}) {
    return {
      ok: false,
      lines: [...renderOutput(interp ? interp.output : []), `${t('ui.errorPrefix')}: ${message}`],
      output: interp ? interp.output : [],
      trace: tr,
      error: { message, span: span || null, kind, key, params },
      value: null,
      env: this.globalEnv,
      interp,
    };
  }

  /** Evaluate an expression with no tracing and no printing -- used to check answers. */
  evaluate(src) {
    const env = new Env(this.globalEnv, { name: t('env.check') });
    const interp = new Interpreter({ trace: null, globalEnv: env });
    interp.dataFrameOps = dataFrameOps;
    return interp.runQuiet(parse(src), env);
  }
}

/**
 * Turn the interpreter's output records into console lines. `width` is R's
 * options("width"): 80 unless the console on screen is narrower.
 */
export function renderOutput(output, { width } = {}) {
  const lines = [];
  for (const item of output) {
    if (item.kind === 'value') lines.push(...formatValue(item.value, width ? { width } : {}));
    else if (item.kind === 'warning') lines.push(`${t('ui.warningPrefix')}: ${item.text}`);
    else lines.push(item.text);
  }
  return lines;
}

/**
 * A name R could not find, looked up where a beginner most likely meant it: a column
 * of a table in memory (`plec` for `ankieta$plec`), or a value in one (`K` for "K").
 * Only the student's own variables are searched, never the base environment.
 */
function whereIsName(env, name) {
  if (!name) return {};
  const tables = [];
  for (let e = env; e && e.role !== 'base'; e = e.parent) {
    for (const [key, v] of e.vars) if (isDataFrame(v)) tables.push([key, v]);
  }
  for (const [table, df] of tables) {
    if ((getNames(df)?.values || []).map(String).includes(name)) return { table, column: name };
  }
  for (const [table, df] of tables) {
    const names = (getNames(df)?.values || []).map(String);
    for (let k = 0; k < df.values.length; k++) {
      const col = df.values[k];
      const values = isFactor(col) ? (getAttr(col, 'levels')?.values || []) : isAtomic(col) && col.type === 'character' ? col.values : [];
      if (values.some((x) => String(x) === name)) return { table, valueOf: names[k] };
    }
  }
  return {};
}


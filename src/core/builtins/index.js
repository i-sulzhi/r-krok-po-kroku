/**
 * Assembles the base environment: every function a student can call.
 *
 * The registry is deliberately explicit. When a student calls something that is not
 * here, they get a message saying the trainer does not support it yet -- which is
 * honest -- rather than a confusing failure deep inside the interpreter.
 */

import { mkBuiltin, mkCharacter, mkDouble, mkLogical, R_NULL } from '../rvalue.js';
import { Env } from '../env.js';
import { RError } from '../coerce.js';
import { registerBase, arg, namedArg, asStr } from './base.js';
import { registerStats } from './stats.js';
import { registerStructures, dataFrameIndex2d, dataFrameSet2d } from './structures.js';
import { registerStrings } from './strings.js';
import { registerDplyr } from './dplyr.js';
import { registerStringr } from './stringr.js';
import { ReturnSignal } from '../eval.js';
import { t } from '../../i18n/index.js';

/**
 * Functions students are likely to reach for that we knowingly do not implement.
 * Values are i18n keys for the explanation shown instead of "object not found".
 */
const KNOWN_UNSUPPORTED = {
  'library': 'unsup.packages',
  'require': 'unsup.packages',
  'install.packages': 'unsup.install',
  'read.csv': 'unsup.readFile',
  'read.csv2': 'unsup.readFile',
  'plot': 'unsup.plot',
  'ggplot': 'unsup.ggplot',
  'ggplot2': 'unsup.ggplot',
  'setwd': 'unsup.fs',
  'getwd': 'unsup.fs',
};

export function makeBaseEnv() {
  const env = new Env(null, { name: t('env.base'), role: 'base' });
  const reg = (name, fn, opts = {}) => env.vars.set(name, mkBuiltin(name, fn, opts));

  registerBase(reg);
  registerStats(reg);
  registerStructures(reg);
  registerStrings(reg);
  registerDplyr(reg);
  registerStringr(reg);

  // T and F are ordinary variables holding TRUE and FALSE in R, and many tutorials
  // write `na.rm = T`: without them the trainer would call valid R an error.
  env.vars.set('T', mkLogical([true]));
  env.vars.set('F', mkLogical([false]));

  // `return()` unwinds the current closure, so it must throw rather than return.
  reg('return', ({ args }) => { throw new ReturnSignal(arg(args, 0) ?? R_NULL); });

  reg('stop', ({ args, node }) => {
    const msg = args.map((a) => asStr(a.value, '')).join('');
    // stop("...") carries the student's own text, so it is passed through verbatim.
    if (msg) { const e = new RError('err.userStop', node, { msg }); e.verbatim = msg; throw e; }
    throw new RError('err.userStopBare', node);
  });
  reg('warning', ({ args, interp, node }) => {
    interp.warn(args.map((a) => asStr(a.value, '')).join(''), node);
    return R_NULL;
  });
  reg('message', ({ args, interp }) => {
    interp.printText(args.map((a) => asStr(a.value, '')).join(''));
    return R_NULL;
  });

  reg('exists', ({ args, env: callerEnv }) => mkLogical([!!callerEnv.tryLookup(asStr(arg(args, 0), ''))]));

  // Known-missing functions answer with guidance instead of "object not found".
  // `special: true` means the arguments arrive unevaluated. Without it,
  // `library(dplyr)` would fail with "object dplyr not found" -- technically true,
  // and completely unhelpful.
  for (const [name, whyKey] of Object.entries(KNOWN_UNSUPPORTED)) {
    if (env.has(name)) continue;
    reg(name, ({ node }) => { throw new RError('err.unsupportedFn', node, { name, why: t(whyKey) }); },
      { special: true });
  }

  // Constants that live in the base environment rather than the grammar.
  env.vars.set('pi', mkDouble([Math.PI]));
  env.vars.set('LETTERS', mkCharacter('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')));
  env.vars.set('letters', mkCharacter('abcdefghijklmnopqrstuvwxyz'.split('')));

  return env;
}

/** Operations the evaluator delegates for data.frame-aware indexing. */
export const dataFrameOps = { dataFrameIndex2d, dataFrameSet2d };

export { KNOWN_UNSUPPORTED };

/**
 * Text functions.
 *
 * Humanities students mostly analyse text, not numbers, so these matter more here
 * than in a statistics-first course. Note `substr()` counts from 1 and includes both
 * ends, unlike almost every other language a student may have met.
 */

import {
  NA, isNA, mkCharacter, mkInteger, mkLogical, mkList, R_NULL,
  isNull, isAtomic, rLength, isFactor, getNames, setAttr,
} from '../rvalue.js';
import { coerceVector, RError } from '../coerce.js';
import { factorToCharacter } from '../arith.js';
import { arg, namedArg, asFlag, asNum, asStr } from './base.js';
import { t } from '../../i18n/index.js';

/** Every text builtin starts by getting a plain character vector. */
const chars = (v) => {
  if (!v || isNull(v)) return mkCharacter([]);
  if (isFactor(v)) return factorToCharacter(v);
  return coerceVector(v, 'character', { trace: null });
};

/**
 * Translate an R regular expression to a JS one.
 * R's POSIX classes ([:alpha:] and friends) have no JS equivalent, so they are
 * rewritten; `fixed = TRUE` escapes the pattern entirely.
 */
function toJsRegex(pattern, { fixed = false, ignoreCase = false, global = true } = {}) {
  let src = String(pattern);
  if (fixed) src = src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  else {
    src = src
      .replace(/\[:alpha:\]/g, 'a-zA-Z')
      .replace(/\[:digit:\]/g, '0-9')
      .replace(/\[:alnum:\]/g, 'a-zA-Z0-9')
      .replace(/\[:space:\]/g, '\\s')
      .replace(/\[:punct:\]/g, '!-\\/:-@\\[-`{-~')
      .replace(/\[:upper:\]/g, 'A-Z')
      .replace(/\[:lower:\]/g, 'a-z');
  }
  let flags = 'u';
  if (global) flags += 'g';
  if (ignoreCase) flags += 'i';
  try {
    return new RegExp(src, flags);
  } catch (e) {
    throw new RError('err.badRegex', null, { pattern, detail: e.message });
  }
}

export function registerStrings(reg) {
  reg('nchar', ({ args }) => {
    const x = chars(arg(args, 0));
    return mkInteger(x.values.map((s) => (isNA(s) ? NA : [...String(s)].length)));
  });

  reg('toupper', ({ args }) => mapText(arg(args, 0), (s) => s.toUpperCase()));
  reg('tolower', ({ args }) => mapText(arg(args, 0), (s) => s.toLowerCase()));
  reg('trimws', ({ args }) => mapText(arg(args, 0), (s) => s.trim()));

  reg('substr', ({ args }) => {
    const x = chars(arg(args, 0));
    const start = Math.trunc(asNum(namedArg(args, 'start') ?? arg(args, 1), 1));
    const stop = Math.trunc(asNum(namedArg(args, 'stop') ?? arg(args, 2), 1e9));
    // R counts characters from 1 and includes `stop`.
    return mkCharacter(x.values.map((s) => (isNA(s) ? NA : [...String(s)].slice(start - 1, stop).join(''))));
  });
  reg('substring', ({ args }) => {
    const x = chars(arg(args, 0));
    const first = namedArg(args, 'first') ?? arg(args, 1);
    const last = namedArg(args, 'last') ?? arg(args, 2);
    const starts = first ? coerceVector(first, 'double').values : [1];
    const stops = last ? coerceVector(last, 'double').values : [1e6];
    const n = Math.max(rLength(x), starts.length, stops.length);
    const out = [];
    for (let i = 0; i < n; i++) {
      const s = x.values[i % rLength(x)];
      if (isNA(s)) { out.push(NA); continue; }
      const a = Math.trunc(starts[i % starts.length]);
      const b = Math.trunc(stops[i % stops.length]);
      out.push([...String(s)].slice(a - 1, b).join(''));
    }
    return mkCharacter(out);
  });

  reg('strsplit', ({ args }) => {
    const x = chars(arg(args, 0));
    const split = asStr(namedArg(args, 'split') ?? arg(args, 1), ' ');
    const fixed = asFlag(namedArg(args, 'fixed'), false);
    // strsplit always returns a LIST, one element per input string -- the usual trip-up.
    return mkList(x.values.map((s) => {
      if (isNA(s)) return mkCharacter([NA]);
      const parts = split === ''
        ? [...String(s)]
        : String(s).split(fixed ? split : toJsRegex(split, { fixed, global: false }));
      return mkCharacter(parts);
    }));
  });

  reg('grepl', ({ args }) => {
    const pattern = asStr(namedArg(args, 'pattern') ?? arg(args, 0), '');
    const x = chars(namedArg(args, 'x') ?? arg(args, 1));
    const re = toJsRegex(pattern, {
      fixed: asFlag(namedArg(args, 'fixed'), false),
      ignoreCase: asFlag(namedArg(args, 'ignore.case'), false),
      global: false,
    });
    // base R's grepl answers FALSE for NA -- unlike stringr's str_detect, which
    // answers NA. The difference is real and worth preserving, not smoothing over.
    return mkLogical(x.values.map((s) => (isNA(s) ? false : re.test(String(s)))));
  });

  reg('grep', ({ args }) => {
    const pattern = asStr(namedArg(args, 'pattern') ?? arg(args, 0), '');
    const x = chars(namedArg(args, 'x') ?? arg(args, 1));
    const value = asFlag(namedArg(args, 'value'), false);
    const re = toJsRegex(pattern, {
      fixed: asFlag(namedArg(args, 'fixed'), false),
      ignoreCase: asFlag(namedArg(args, 'ignore.case'), false),
      global: false,
    });
    const hits = [];
    x.values.forEach((s, i) => { if (!isNA(s) && re.test(String(s))) hits.push(i); });
    return value ? mkCharacter(hits.map((i) => x.values[i])) : mkInteger(hits.map((i) => i + 1));
  });

  reg('gsub', ({ args }) => replaceText(args, true));
  reg('sub', ({ args }) => replaceText(args, false));

  reg('startsWith', ({ args }) => {
    const x = chars(arg(args, 0));
    const p = asStr(arg(args, 1), '');
    return mkLogical(x.values.map((s) => (isNA(s) ? NA : String(s).startsWith(p))));
  });
  reg('endsWith', ({ args }) => {
    const x = chars(arg(args, 0));
    const p = asStr(arg(args, 1), '');
    return mkLogical(x.values.map((s) => (isNA(s) ? NA : String(s).endsWith(p))));
  });

  reg('sprintf', ({ args }) => {
    const fmt = asStr(arg(args, 0), '');
    const rest = args.filter((a) => !a.name).slice(1).map((a) => a.value);
    const n = rest.length ? Math.max(...rest.map(rLength)) : 1;
    const out = [];
    for (let i = 0; i < n; i++) {
      let k = 0;
      out.push(fmt.replace(/%(\.\d+)?([sdfg%])/g, (m, prec, kind) => {
        if (kind === '%') return '%';
        const v = rest[k++];
        if (!v) return m;
        const cell = v.values[i % rLength(v)];
        if (isNA(cell)) return 'NA';
        if (kind === 'd') return String(Math.trunc(Number(cell)));
        if (kind === 'f') return Number(cell).toFixed(prec ? Number(prec.slice(1)) : 6);
        if (kind === 'g') return String(Number(cell));
        return String(cell);
      }));
    }
    return mkCharacter(out);
  });
}

const mapText = (v, fn) => {
  const x = chars(v);
  const out = mkCharacter(x.values.map((s) => (isNA(s) ? NA : fn(String(s)))));
  const names = getNames(x);
  return names ? setAttr(out, 'names', names) : out;
};

function replaceText(args, global) {
  const pattern = asStr(namedArg(args, 'pattern') ?? arg(args, 0), '');
  const replacement = asStr(namedArg(args, 'replacement') ?? arg(args, 1), '');
  const x = chars(namedArg(args, 'x') ?? arg(args, 2));
  const re = toJsRegex(pattern, {
    fixed: asFlag(namedArg(args, 'fixed'), false),
    ignoreCase: asFlag(namedArg(args, 'ignore.case'), false),
    global,
  });
  // R writes back-references as \\1; JS wants $1.
  const repl = replacement.replace(/\\(\d)/g, '$$$1');
  return mkCharacter(x.values.map((s) => (isNA(s) ? NA : String(s).replace(re, repl))));
}

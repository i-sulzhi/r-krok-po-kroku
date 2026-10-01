/**
 * stringr (syllabus topic 10).
 *
 * The course reaches text analysis through stringr, and its whole appeal is
 * consistency: every function is `str_*`, every one takes the string first and the
 * pattern second, and every one is vectorised. Base R's equivalents reverse those
 * arguments (`grepl(pattern, x)` vs `str_detect(string, pattern)`), which is exactly
 * the confusion stringr exists to remove -- and exactly the confusion a student hits
 * when mixing the two.
 *
 * Regular expressions get their own event, because "why didn't my pattern match?"
 * is unanswerable from the output alone: the panel shows what matched where.
 */

import {
  NA, isNA, mkCharacter, mkInteger, mkLogical, mkList, R_NULL,
  isNull, rLength, isFactor, getNames, setAttr,
} from '../rvalue.js';
import { coerceVector, RError } from '../coerce.js';
import { factorToCharacter } from '../arith.js';
import { arg, namedArg, asFlag, asNum, asStr } from './base.js';
import { EV } from '../../trace/events.js';
import { t } from '../../i18n/index.js';

/** stringr takes the string first; everything here starts by normalising it. */
const strings = (v) => {
  if (!v || isNull(v)) return mkCharacter([]);
  if (isFactor(v)) return factorToCharacter(v);
  return coerceVector(v, 'character', { trace: null });
};

/**
 * Translate an R/stringr pattern to a JS RegExp.
 * `fixed()` and `regex(ignore_case = TRUE)` are represented as tagged patterns by
 * the wrappers below.
 */
function toRegex(pattern, { fixed = false, ignoreCase = false, global = true } = {}) {
  let src = String(pattern);
  if (fixed) src = src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  else {
    src = src
      // Cyrillic as escapes: the bundle is checked to contain no Cyrillic text at all.
      .replace(/\[:alpha:\]/g, 'a-zA-Z\u0430-\u044f\u0410-\u042fąćęłńóśźżĄĆĘŁŃÓŚŹŻ')
      .replace(/\[:digit:\]/g, '0-9')
      .replace(/\[:alnum:\]/g, 'a-zA-Z0-9')
      .replace(/\[:space:\]/g, '\\s')
      .replace(/\[:punct:\]/g, '!-\\/:-@\\[-`{-~')
      .replace(/\[:upper:\]/g, 'A-ZĄĆĘŁŃÓŚŹŻ')
      .replace(/\[:lower:\]/g, 'a-ząćęłńóśźż');
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

/** Record what a pattern matched, so the panel can show it rather than assert it. */
function emitMatches(interp, node, { fname, pattern, subjects, matches }) {
  interp.trace?.emit(EV.REGEX, {
    node, fname, pattern,
    subjects: subjects.slice(0, 30),
    matches: matches.slice(0, 30),
    total: subjects.length,
    matched: matches.filter((m) => m && m.length).length,
  });
}

/** Collect match ranges for one subject. */
function findMatches(text, re) {
  if (text === null || text === undefined) return [];
  const out = [];
  const rx = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
  let m;
  while ((m = rx.exec(String(text))) !== null) {
    out.push({ start: m.index, end: m.index + m[0].length, text: m[0], groups: m.slice(1) });
    if (m[0] === '') rx.lastIndex++;              // zero-width match would loop forever
    if (out.length > 50) break;
  }
  return out;
}

const patternOpts = (args) => ({
  fixed: asFlag(namedArg(args, 'fixed'), false),
  ignoreCase: asFlag(namedArg(args, 'ignore_case') ?? namedArg(args, 'ignore.case'), false),
});

export function registerStringr(reg) {
  reg('str_length', ({ args }) => {
    const x = strings(arg(args, 0));
    return mkInteger(x.values.map((s) => (isNA(s) ? NA : [...String(s)].length)));
  });

  reg('str_detect', ({ args, node, interp }) => {
    const x = strings(arg(args, 0) ?? namedArg(args, 'string'));
    const pattern = asStr(namedArg(args, 'pattern') ?? arg(args, 1), '');
    const re = toRegex(pattern, { ...patternOpts(args), global: false });
    const matches = x.values.map((s) => (isNA(s) ? [] : findMatches(s, re)));
    emitMatches(interp, node, { fname: 'str_detect', pattern, subjects: x.values, matches });
    return mkLogical(x.values.map((s, i) => (isNA(s) ? NA : matches[i].length > 0)));
  });

  reg('str_subset', ({ args, node, interp }) => {
    const x = strings(arg(args, 0));
    const pattern = asStr(namedArg(args, 'pattern') ?? arg(args, 1), '');
    const re = toRegex(pattern, { ...patternOpts(args), global: false });
    const matches = x.values.map((s) => (isNA(s) ? [] : findMatches(s, re)));
    emitMatches(interp, node, { fname: 'str_subset', pattern, subjects: x.values, matches });
    return mkCharacter(x.values.filter((s, i) => !isNA(s) && matches[i].length));
  });

  reg('str_which', ({ args }) => {
    const x = strings(arg(args, 0));
    const re = toRegex(asStr(namedArg(args, 'pattern') ?? arg(args, 1), ''), { ...patternOpts(args), global: false });
    const hits = [];
    x.values.forEach((s, i) => { if (!isNA(s) && re.test(String(s))) hits.push(i + 1); });
    return mkInteger(hits);
  });

  reg('str_count', ({ args, node, interp }) => {
    const x = strings(arg(args, 0));
    const pattern = asStr(namedArg(args, 'pattern') ?? arg(args, 1), '');
    const re = toRegex(pattern, patternOpts(args));
    const matches = x.values.map((s) => (isNA(s) ? [] : findMatches(s, re)));
    emitMatches(interp, node, { fname: 'str_count', pattern, subjects: x.values, matches });
    return mkInteger(x.values.map((s, i) => (isNA(s) ? NA : matches[i].length)));
  });

  reg('str_extract', ({ args, node, interp }) => {
    const x = strings(arg(args, 0));
    const pattern = asStr(namedArg(args, 'pattern') ?? arg(args, 1), '');
    const re = toRegex(pattern, { ...patternOpts(args), global: false });
    const matches = x.values.map((s) => (isNA(s) ? [] : findMatches(s, re)));
    emitMatches(interp, node, { fname: 'str_extract', pattern, subjects: x.values, matches });
    // No match gives NA, not an empty string -- a distinction that matters downstream.
    return mkCharacter(x.values.map((s, i) => (isNA(s) ? NA : (matches[i][0]?.text ?? NA))));
  });

  reg('str_extract_all', ({ args, node, interp }) => {
    const x = strings(arg(args, 0));
    const pattern = asStr(namedArg(args, 'pattern') ?? arg(args, 1), '');
    const re = toRegex(pattern, patternOpts(args));
    const matches = x.values.map((s) => (isNA(s) ? [] : findMatches(s, re)));
    emitMatches(interp, node, { fname: 'str_extract_all', pattern, subjects: x.values, matches });
    return mkList(matches.map((ms) => mkCharacter(ms.map((m) => m.text))));
  });

  reg('str_replace', ({ args, node, interp }) => replace(args, node, interp, false));
  reg('str_replace_all', ({ args, node, interp }) => replace(args, node, interp, true));

  reg('str_split', ({ args }) => {
    const x = strings(arg(args, 0));
    const pattern = asStr(namedArg(args, 'pattern') ?? arg(args, 1), ' ');
    const re = toRegex(pattern, { ...patternOpts(args), global: false });
    // Like strsplit(), this returns a LIST -- one character vector per input string.
    return mkList(x.values.map((s) => (isNA(s)
      ? mkCharacter([NA])
      : mkCharacter(pattern === '' ? [...String(s)] : String(s).split(re)))));
  });

  reg('str_sub', ({ args }) => {
    const x = strings(arg(args, 0));
    const start = Math.trunc(asNum(namedArg(args, 'start') ?? arg(args, 1), 1));
    const end = Math.trunc(asNum(namedArg(args, 'end') ?? arg(args, 2), -1));
    return mkCharacter(x.values.map((s) => {
      if (isNA(s)) return NA;
      const chars = [...String(s)];
      // stringr counts from 1 and allows negatives, counting back from the end.
      const from = start > 0 ? start - 1 : chars.length + start;
      const to = end > 0 ? end : chars.length + end + 1;
      return chars.slice(Math.max(0, from), Math.max(0, to)).join('');
    }));
  });

  reg('str_to_upper', mapper((s) => s.toUpperCase()));
  reg('str_to_lower', mapper((s) => s.toLowerCase()));
  reg('str_to_title', mapper((s) => s.replace(/\p{L}+/gu, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase())));
  reg('str_trim', mapper((s) => s.trim()));
  reg('str_squish', mapper((s) => s.trim().replace(/\s+/g, ' ')));

  reg('str_c', ({ args }) => {
    const sep = asStr(namedArg(args, 'sep'), '');
    const collapse = namedArg(args, 'collapse');
    const parts = args.filter((a) => a.name !== 'sep' && a.name !== 'collapse')
      .map((a) => strings(a.value)).filter((v) => rLength(v) > 0);
    if (!parts.length) return mkCharacter([]);
    const n = Math.max(...parts.map(rLength));
    const out = [];
    for (let i = 0; i < n; i++) {
      const cells = parts.map((p) => p.values[i % rLength(p)]);
      // str_c propagates NA, unlike paste() which turns it into the text "NA".
      out.push(cells.some(isNA) ? NA : cells.join(sep));
    }
    if (collapse && !isNull(collapse)) {
      return mkCharacter([out.filter((s) => !isNA(s)).join(asStr(collapse, ''))]);
    }
    return mkCharacter(out);
  });

  reg('str_starts', ({ args }) => {
    const x = strings(arg(args, 0));
    const p = asStr(namedArg(args, 'pattern') ?? arg(args, 1), '');
    const re = toRegex(`^(?:${p})`, { ...patternOpts(args), global: false });
    return mkLogical(x.values.map((s) => (isNA(s) ? NA : re.test(String(s)))));
  });
  reg('str_ends', ({ args }) => {
    const x = strings(arg(args, 0));
    const p = asStr(namedArg(args, 'pattern') ?? arg(args, 1), '');
    const re = toRegex(`(?:${p})$`, { ...patternOpts(args), global: false });
    return mkLogical(x.values.map((s) => (isNA(s) ? NA : re.test(String(s)))));
  });

  reg('str_pad', ({ args }) => {
    const x = strings(arg(args, 0));
    const width = Math.trunc(asNum(namedArg(args, 'width') ?? arg(args, 1), 0));
    const side = asStr(namedArg(args, 'side'), 'left');
    const pad = asStr(namedArg(args, 'pad'), ' ') || ' ';
    return mkCharacter(x.values.map((s) => {
      if (isNA(s)) return NA;
      const str = String(s);
      const need = Math.max(0, width - [...str].length);
      if (side === 'right') return str + pad.repeat(need);
      if (side === 'both') {
        const left = Math.floor(need / 2);
        return pad.repeat(left) + str + pad.repeat(need - left);
      }
      return pad.repeat(need) + str;
    }));
  });

  // `fixed("...")` marks a pattern as literal; we keep the text and let the caller's
  // `fixed = TRUE` path handle it, so the common case still works.
  reg('fixed', ({ args }) => strings(arg(args, 0)));
  reg('coll', ({ args }) => strings(arg(args, 0)));
}

const mapper = (fn) => ({ args }) => {
  const x = strings(arg(args, 0));
  const out = mkCharacter(x.values.map((s) => (isNA(s) ? NA : fn(String(s)))));
  const names = getNames(x);
  return names ? setAttr(out, 'names', names) : out;
};

function replace(args, node, interp, all) {
  const x = strings(arg(args, 0) ?? namedArg(args, 'string'));
  const pattern = asStr(namedArg(args, 'pattern') ?? arg(args, 1), '');
  const replacement = asStr(namedArg(args, 'replacement') ?? arg(args, 2), '');
  const re = toRegex(pattern, { ...patternOpts(args), global: all });
  const matches = x.values.map((s) => (isNA(s) ? [] : findMatches(s, re)));
  emitMatches(interp, node, { fname: all ? 'str_replace_all' : 'str_replace', pattern, subjects: x.values, matches });
  // stringr uses \\1 for back-references, JS uses $1.
  const repl = replacement.replace(/\\(\d)/g, '$$$1');
  return mkCharacter(x.values.map((s) => (isNA(s) ? NA : String(s).replace(re, repl))));
}

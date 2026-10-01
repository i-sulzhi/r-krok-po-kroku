/**
 * Error diagnosis.
 *
 * The student is alone. R's own messages assume you already know why they happen
 * ("object of type 'closure' is not subsettable"), which is useless to a beginner
 * and actively discouraging. So we recognise the common mistakes and answer with
 * what went wrong, why R reacted that way, and the corrected line.
 *
 * Rules match on the error's KEY, never on its rendered text: matching text would
 * quietly stop working the moment the interface switches language.
 *
 * House rules for the wording (in the dictionaries): never say "you should have
 * known", always show the fix, never just restate the error in other words.
 */

import { t, has } from '../i18n/index.js';

/**
 * @param {{message, span, kind, key, params}} error
 * @param {string} source  the code that failed
 * @returns {{title, text, fix?}|null}
 */
export function diagnose(error, source) {
  const code = source || '';
  const key = error?.key || '';
  const params = error?.params || {};

  for (const rule of RULES) {
    const hit = rule(key, params, code, error);
    if (hit) return hit;
  }
  return null;
}

/** Shorthand: build a hint from a dictionary prefix, skipping an absent fix line. */
const hint = (prefix, params = {}) => ({
  title: t(`${prefix}.title`, params),
  text: t(`${prefix}.text`, params),
  fix: has(`${prefix}.fix`) ? t(`${prefix}.fix`, params) : null,
});

const VERBS = 'filter|select|mutate|arrange|summarise|summarize|group_by|count|pull|rename|slice|distinct|ungroup';

const RULES = [
  // --- a pipe chain broken at a line's end. Whatever error the next line then causes
  // ("n() only inside summarise", a column not found, a verb without a table), the
  // cause is the missing |> above it, and that is what the student must hear. ---
  (key, params, code) => {
    const lines = code.split('\n');
    for (let i = 1; i < lines.length; i++) {
      if (!new RegExp(`^\\s+(${VERBS})\\s*\\(`).test(lines[i])) continue;
      let p = i - 1;
      while (p >= 0 && !lines[p].trim()) p--;
      if (p < 0) continue;
      const prev = lines[p].replace(/#.*$/, '').trimEnd();
      if (/(\|>|%>%|[(,+\-*/=&|])$/.test(prev)) continue;
      return hint('diag.missingPipe', { line: p + 1, next: i + 1, fix: `${prev} |>` });
    }
    return null;
  },

  // --- a name that does not exist: three different causes, three different fixes ---
  (key, params, code) => {
    if (key !== 'err.objNotFound' && key !== 'err.fnNotFound') return null;
    const name = params.name;
    if (!name) return null;

    // A column written alone outside a dplyr verb: `ankieta$wiek[plec == "K"]`.
    if (key === 'err.objNotFound' && params.table && params.column) {
      return hint('diag.columnOutside', { name, table: params.table });
    }
    // A text value written without quotes: `ankieta$plec == K`.
    if (key === 'err.objNotFound' && params.table && params.valueOf) {
      return hint('diag.valueNeedsQuotes', { name, column: params.valueOf });
    }

    // Assigned with `=` inside a call: f(x = 1) names an argument, it does not
    // create a variable. Extremely common when coming from Python.
    if (new RegExp(`\\w+\\s*\\([^)]*\\b${escapeRe(name)}\\s*=[^=]`).test(code)) {
      return hint('diag.assignInCall', { name });
    }

    // The same name in another case: R distinguishes Data from data.
    const names = [...code.matchAll(/[A-Za-z.][A-Za-z0-9._]*/g)].map((x) => x[0]);
    const twin = names.find((n) => n !== name && n.toLowerCase() === name.toLowerCase());
    if (twin) return hint('diag.caseMismatch', { name, twin });

    const close = names.find((n) => n !== name && distance(n, name) === 1);
    if (close) return hint('diag.typo', { name, close });

    return hint('diag.notFound', { name });
  },

  // --- a function's name used as a value: `oceny - mean` ---
  (key, params, code) => {
    if (key !== 'err.opBadKind' || !/builtin|closure/.test(params.kind || '')) return null;
    const fn = [...code.matchAll(/\b([A-Za-z.][\w.]*)\b(?!\s*[(\w.])/g)].map((m) => m[1]).find((n) => FUNCTION_WORDS.has(n));
    return hint('diag.fnWithoutCall', { fn: fn || 'mean' });
  },

  // --- `table$column = ...` as a new column's name inside a verb ---
  (key, params, code, error) => {
    if (key !== 'err.expected' || params.got !== '«=»') return null;
    const line = code.split('\n')[(error?.span?.line || 1) - 1] || '';
    const m = line.match(/\b([A-Za-z.][\w.]*)\$([A-Za-z.][\w.]*)\s*=(?!=)/);
    if (!m) return null;
    return hint('diag.dollarName', { table: m[1], fix: line.replace(m[0], `${m[2]} =`).trim() });
  },

  // --- `=` where `==` was meant, inside a condition ---
  (key, params, code) => {
    if (!/^err\.(objNotFound|cannotStart|expected|trailing)$/.test(key)) return null;
    if (!/\bif\s*\([^)=<>!]*[^=<>!]=[^=]/.test(code)) return null;
    return hint('diag.assignInIf');
  },

  // --- a condition that is a whole vector ---
  (key, params) => (key === 'err.condLength' ? hint('diag.ifVector', { n: params.n }) : null),

  // --- a condition that is NA ---
  (key) => (key === 'err.condNA' ? hint('diag.condNA') : null),

  // --- arithmetic on factors or text ---
  (key, params) => {
    if (key === 'err.opOnFactor' || key === 'err.statOnFactor') return hint('diag.factorMath');
    if (key === 'err.opOnFactorScale' || key === 'err.statOnFactorScale') return hint('diag.factorScale');
    if (key === 'err.opOnText' || key === 'err.statOnText') return hint('diag.textMath');
    return null;
  },

  // --- factor(x, labels = ...) with more labels than levels: usually a scale
  // point nobody chose, so it is missing from the default levels ---
  (key, params) => (key === 'err.factorLabels'
    ? hint(params.levelsGiven ? 'diag.factorLabelsCount' : 'diag.factorLabels', params) : null),

  // --- $ on an atomic vector ---
  (key) => (key === 'err.dollarOnVector' || key === 'err.dollarOnVectorShort' ? hint('diag.dollarVector') : null),

  // --- modifying something that does not exist yet ---
  (key, params) => (key === 'err.modifyMissing' ? hint('diag.createFirst', { name: params.name }) : null),

  // --- [[ ]] past the end ---
  (key, params) => (key === 'err.indexOutOfRange' ? hint('diag.outOfRange', { length: params.length }) : null),

  // --- something left unclosed ---
  (key) => (/^err\.(strUnclosed|strUnclosedQuote|backtickUnclosed|percentUnclosed)$/.test(key)
    ? hint('diag.unclosed') : null),

  // --- an expected closing bracket is a different mistake from a missing comma ---
  (key, params) => (key === 'err.expected' && /^tok\.(rparen|rbrace|rbracket)/.test(params.whatKey || '')
    ? hint('diag.unclosed') : null),

  // --- a comma after a whole expression: several values without c(). The first
  // thing most beginners write ("wiek <- 23, 34"), and "a missing comma" is the
  // opposite of the advice they need. The fix wraps their own line. ---
  (key, params, code, error) => {
    if (key !== 'err.trailing' || code[error?.span?.start] !== ',') return null;
    const line = code.split('\n')[(error.span.line || 1) - 1] || '';
    const m = line.match(/^\s*([A-Za-z.][\w.]*)\s*(?:<-|=)\s*(.+?)\s*$/);
    const fix = m ? `${m[1]} <- c(${m[2]})` : `c(${line.trim()})`;
    return hint('diag.manyValues', { fix });
  },

  // --- expected/trailing: usually a missing comma or operator ---
  (key) => (key === 'err.expected' || key === 'err.trailing' ? hint('diag.syntaxShape') : null),

  // --- the trainer's own failure, caught by the session ---
  (key) => (key === 'err.internal' ? hint('diag.internal') : null),

  // --- the trainer's own limits: say so plainly, it is not the student's fault ---
  (key) => (/^err\.(unsupportedFn|opUnsupported|formulaUnsupported|atUnsupported|index2dOnlyDf|assign2dOnlyDf|dfSet2dLater)$/.test(key)
    ? hint('diag.unsupported') : null),
];

/** Functions a beginner meets in the lessons: used without "(" they are the usual cause. */
const FUNCTION_WORDS = new Set(['mean', 'sum', 'length', 'max', 'min', 'median', 'sd', 'table', 'c', 'n', 'nrow', 'ncol', 'round', 'sort', 'unique']);

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Levenshtein distance, capped: we only care about "one typo away". */
function distance(a, b) {
  if (Math.abs(a.length - b.length) > 1) return 99;
  const m = a.length;
  const n = b.length;
  const prev = new Array(n + 1);
  const cur = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    for (let j = 0; j <= n; j++) prev[j] = cur[j];
  }
  return prev[n];
}

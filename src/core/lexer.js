/**
 * R tokeniser.
 *
 * Every token keeps its source span (`start`/`end`, plus line/col for error messages)
 * because the player highlights the exact expression being evaluated as the student
 * steps through the timeline. Positions are not a debugging afterthought here; they
 * are a product feature.
 *
 * Newlines are emitted as real tokens: in R a line break ends a statement, but only
 * when the statement is already complete. The parser decides that, using bracket
 * depth and whether it is currently expecting an operand.
 */

export const T = Object.freeze({
  NUM: 'num', STR: 'str', IDENT: 'ident', KEYWORD: 'keyword',
  OP: 'op', LPAREN: '(', RPAREN: ')', LBRACE: '{', RBRACE: '}',
  LBRACKET: '[', RBRACKET: ']', LBRACKET2: '[[', RBRACKET2: ']]',
  COMMA: ',', SEMI: ';', NEWLINE: 'newline', EOF: 'eof',
});

import { t } from '../i18n/index.js';

export const KEYWORDS = Object.freeze(new Set([
  'if', 'else', 'for', 'while', 'repeat', 'function', 'break', 'next',
  'TRUE', 'FALSE', 'NULL', 'NA', 'NA_integer_', 'NA_real_', 'NA_character_',
  'Inf', 'NaN', 'in',
]));

/** Multi-character operators, longest first so greedy matching is correct. */
const OPERATORS = [
  '%/%', '%%', '%in%', '%o%', '<<-', '->>', '...',
  '<-', '->', '<=', '>=', '==', '!=', '&&', '||', '::', '|>',
  '+', '-', '*', '/', '^', '<', '>', '!', '&', '|', '~', '?', '=', ':', '$', '@',
];

/** Like RError, this carries a key so the message can be localised on display. */
export class RSyntaxError extends Error {
  constructor(key, pos, params = {}) {
    super();                       // see the note in RError: super(msg) shadows the getter
    this.name = 'RSyntaxError';
    this.key = key;
    this.params = params;
    this.pos = pos; // {start, end, line, col}
  }

  get message() { return t(this.key, this.params); }
}

export function tokenize(src) {
  const tokens = [];
  let i = 0;
  let line = 1;
  let lineStart = 0;

  const pos = (start, end) => ({ start, end, line, col: start - lineStart + 1 });
  const push = (type, value, start, extra = {}) =>
    tokens.push({ type, value, ...pos(start, i), ...extra });

  while (i < src.length) {
    const c = src[i];
    const start = i;

    // --- whitespace (not newline) ---
    if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }

    // --- comments run to end of line ---
    if (c === '#') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }

    // --- newline: significant, the parser filters it ---
    if (c === '\n') {
      i++;
      push(T.NEWLINE, '\n', start);
      line++;
      lineStart = i;
      continue;
    }

    // --- strings ---
    if (c === '"' || c === "'") {
      const quote = c;
      i++;
      let out = '';
      while (i < src.length && src[i] !== quote) {
        if (src[i] === '\\') {
          i++;
          const esc = src[i];
          if (esc === undefined) throw new RSyntaxError('err.strUnclosed', pos(start, i));
          out += esc === 'n' ? '\n' : esc === 't' ? '\t' : esc === 'r' ? '\r'
               : esc === '\\' ? '\\' : esc === '"' ? '"' : esc === "'" ? "'"
               : esc === '0' ? '\0' : esc;
          i++;
        } else {
          if (src[i] === '\n') { line++; lineStart = i + 1; }
          out += src[i++];
        }
      }
      if (i >= src.length) throw new RSyntaxError('err.strUnclosedQuote', pos(start, i));
      i++; // closing quote
      push(T.STR, out, start, { quote });
      continue;
    }

    // --- backtick-quoted identifiers: `my var` ---
    if (c === '`') {
      i++;
      let out = '';
      while (i < src.length && src[i] !== '`') out += src[i++];
      if (i >= src.length) throw new RSyntaxError('err.backtickUnclosed', pos(start, i));
      i++;
      push(T.IDENT, out, start, { quoted: true });
      continue;
    }

    // --- numbers: 1  1L  1.5  .5  1e-3  0xFF ---
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
      let text = '';
      if (c === '0' && /[xX]/.test(src[i + 1] || '')) {
        text = src.slice(i, i + 2); i += 2;
        while (i < src.length && /[0-9a-fA-F]/.test(src[i])) text += src[i++];
      } else {
        while (i < src.length && /[0-9]/.test(src[i])) text += src[i++];
        if (src[i] === '.') { text += src[i++]; while (i < src.length && /[0-9]/.test(src[i])) text += src[i++]; }
        if (/[eE]/.test(src[i] || '')) {
          text += src[i++];
          if (/[+-]/.test(src[i] || '')) text += src[i++];
          while (i < src.length && /[0-9]/.test(src[i])) text += src[i++];
        }
      }
      // An `L` suffix is R's way of writing an integer literal: 1L is integer, 1 is double.
      let isInt = false;
      if (src[i] === 'L') { isInt = true; i++; }
      const num = Number(text);
      if (Number.isNaN(num)) throw new RSyntaxError('err.badNumber', pos(start, i), { text });
      push(T.NUM, num, start, { rtype: isInt ? 'integer' : 'double', text });
      continue;
    }

    // --- identifiers and keywords: letters, digits, dot, underscore ---
    if (/[A-Za-z.]/.test(c)) {
      let text = '';
      while (i < src.length && /[A-Za-z0-9._]/.test(src[i])) text += src[i++];
      push(KEYWORDS.has(text) ? T.KEYWORD : T.IDENT, text, start);
      continue;
    }

    // --- brackets and punctuation ---
    if (c === '[' && src[i + 1] === '[') { i += 2; push(T.LBRACKET2, '[[', start); continue; }
    if (c === ']' && src[i + 1] === ']') { i += 2; push(T.RBRACKET2, ']]', start); continue; }
    const SIMPLE = { '(': T.LPAREN, ')': T.RPAREN, '{': T.LBRACE, '}': T.RBRACE,
                     '[': T.LBRACKET, ']': T.RBRACKET, ',': T.COMMA, ';': T.SEMI };
    if (SIMPLE[c]) { i++; push(SIMPLE[c], c, start); continue; }

    // --- user-defined infix operators: %anything% ---
    if (c === '%') {
      const close = src.indexOf('%', i + 1);
      if (close === -1) throw new RSyntaxError('err.percentUnclosed', pos(start, i));
      const op = src.slice(i, close + 1);
      i = close + 1;
      push(T.OP, op, start);
      continue;
    }

    // --- fixed operators ---
    const op = OPERATORS.find((o) => src.startsWith(o, i));
    if (op) { i += op.length; push(T.OP, op, start); continue; }

    throw new RSyntaxError('err.badChar', pos(start, i + 1), { char: JSON.stringify(c) });
  }

  tokens.push({ type: T.EOF, value: null, start: i, end: i, line, col: i - lineStart + 1 });
  return tokens;
}

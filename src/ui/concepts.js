/**
 * Concepts: the pieces of R syntax a first-time programmer meets, found in real code.
 *
 * Every lesson leans on things it never stops to teach. Lesson 1 is about vectors,
 * yet its code already assigns with `<-`, calls functions and takes a column with
 * `$`. A student who has never programmed sees all of that at once. The glossary
 * panel (glossary.js) explains exactly the pieces present in the code on screen,
 * using that code as its example, so the explanation is never about something else.
 *
 * This module is pure: it parses source text and says which concepts occur where,
 * split into labelled parts (`oceny` = name, `<-` = save, `c(...)` = value). It also
 * works out in which lesson each concept first appears, so the panel can open what
 * is new and fold what the student has already met.
 */

import { parse } from '../core/parser.js';

/** In display order: from the first things a beginner meets to the later ones. */
export const CONCEPTS = [
  'name', 'assign', 'call', 'comment', 'dollar', 'colon', 'string', 'bool',
  'arith', 'compare', 'logic', 'na', 'namedArg', 'index', 'pipe',
];

const ARITH = new Set(['+', '-', '*', '/', '^', '%%', '%/%']);
const COMPARE = new Set(['==', '!=', '<', '>', '<=', '>=']);
const LOGIC = new Set(['&', '|', '&&', '||']);

/** Every AST node under `node`, parents before children. */
function* walk(node) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { for (const n of node) yield* walk(n); return; }
  if (node.type) yield node;
  for (const [key, v] of Object.entries(node)) {
    if (key === 'span') continue;
    if (v && typeof v === 'object') yield* walk(v);
  }
}

/** Comments are dropped by the lexer, so they are found here, outside strings. */
function comments(src) {
  const found = [];
  let quote = null;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'" || c === '`') {
      quote = c;
    } else if (c === '#') {
      let end = src.indexOf('\n', i);
      if (end < 0) end = src.length;
      found.push({ start: i, end });
      i = end;
    }
  }
  return found;
}

/**
 * The parts of one occurrence. A part is {start, end, label}; label null is plain
 * punctuation. Parts tile the occurrence from left to right.
 */
const part = (start, end, label = null) => ({ start, end, label });

function callParts(node, src) {
  const from = node.callee.span.start;
  const open = src.indexOf('(', node.callee.span.end);
  const close = node.span.end - 1;
  const parts = [part(from, node.callee.span.end, 'fn'), part(open, open + 1)];
  if (src.slice(open + 1, close).trim()) parts.push(part(open + 1, close, 'args'));
  parts.push(part(close, close + 1));
  return { start: from, end: node.span.end, parts };
}

/** `x |> f(y)` was rewritten to f(x, y) by the parser; find the operator again. */
function pipeParts(node, src) {
  const data = node.args[0].value.span;
  const at = src.slice(data.end, node.callee.span.start).search(/\|>|%>%/);
  if (at < 0) return null;
  const op = data.end + at;
  const len = src.startsWith('|>', op) ? 2 : 3;
  return {
    start: data.start,
    end: node.span.end,
    parts: [part(data.start, data.end, 'data'), part(op, op + len, 'pipe'), part(node.callee.span.start, node.span.end, 'next')],
  };
}

function binaryParts(node, label) {
  const { left, right } = node;
  return {
    start: node.span.start,
    end: node.span.end,
    parts: [part(left.span.start, left.span.end), part(left.span.end, right.span.start, label), part(right.span.start, right.span.end)],
  };
}

/**
 * Find every concept in the code.
 * @returns {Map<string, Array<{start, end, parts, node}>>} occurrences per concept,
 *          in source order; null when the code does not parse
 */
export function findConcepts(src) {
  let program;
  try {
    program = parse(src);
  } catch {
    return null;
  }
  const found = new Map();
  const add = (id, occ) => {
    if (!occ) return;
    if (!found.has(id)) found.set(id, []);
    found.get(id).push(occ);
  };
  const whole = (node, label) => ({ start: node.span.start, end: node.span.end, parts: [part(node.span.start, node.span.end, label)] });

  // A bare name on its own line asks R to show what is stored under it.
  for (const stmt of program.body) if (stmt.type === 'Ident') add('name', { ...whole(stmt, 'name'), node: stmt });

  for (const node of walk(program.body)) {
    switch (node.type) {
      case 'Assign': {
        const { target, value } = node;
        const [l, r] = target.span.start < value.span.start ? [target, value] : [value, target];
        add('assign', { start: node.span.start, end: node.span.end, node, parts: [
          part(l.span.start, l.span.end, l === target ? 'name' : 'value'),
          part(l.span.end, r.span.start, 'assign'),
          part(r.span.start, r.span.end, r === target ? 'name' : 'value'),
        ] });
        break;
      }
      case 'Call':
        if (node.callee.type !== 'Ident') break;
        if (node.viaPipe) {
          const p = pipeParts(node, src);
          if (p) add('pipe', { ...p, node });
        }
        add('call', { ...callParts(node, src), node });
        for (const a of node.args) {
          if (!a.name || !a.value?.span) continue;
          add('namedArg', { start: a.span.start, end: a.value.span.end, node: a.value, parts: [
            part(a.span.start, a.span.start + a.name.length, 'argName'),
            part(a.span.start + a.name.length, a.value.span.start),
            part(a.value.span.start, a.value.span.end, 'argValue'),
          ] });
        }
        break;
      case 'Extract':
        if (node.op !== '$') break;
        add('dollar', { start: node.span.start, end: node.span.end, node, parts: [
          part(node.object.span.start, node.object.span.end, 'table'),
          part(node.object.span.end, node.object.span.end + 1),
          part(node.object.span.end + 1, node.span.end, 'column'),
        ] });
        break;
      case 'Binary':
        if (node.op === ':') {
          const p = binaryParts(node, null);
          p.parts[0].label = 'from';
          p.parts[2].label = 'to';
          add('colon', { ...p, node });
        } else if (ARITH.has(node.op)) add('arith', { ...binaryParts(node, 'op'), node });
        else if (COMPARE.has(node.op)) add('compare', { ...binaryParts(node, 'compare'), node });
        else if (LOGIC.has(node.op)) add('logic', { ...binaryParts(node, 'logic'), node });
        break;
      case 'Unary':
        if (node.op === '!') {
          add('logic', { start: node.span.start, end: node.span.end, node, parts: [
            part(node.span.start, node.span.start + 1, 'logic'), part(node.operand.span.start, node.operand.span.end),
          ] });
        }
        break;
      case 'Str':
        add('string', { ...whole(node, 'text'), node });
        break;
      case 'Bool':
        add('bool', { ...whole(node, 'bool'), node });
        break;
      case 'NAConst':
        add('na', { ...whole(node, 'na'), node });
        break;
      case 'Index': {
        if (node.bracket !== '[') break;
        const open = node.object.span.end;
        const close = node.span.end - 1;
        add('index', { start: node.span.start, end: node.span.end, node, parts: [
          part(node.object.span.start, open, 'vector'),
          part(open, open + 1),
          part(open + 1, close, 'which'),
          part(close, close + 1),
        ] });
        break;
      }
      default:
    }
  }
  for (const c of comments(src)) add('comment', { ...c, parts: [part(c.start, c.end, 'comment')] });

  // A label belongs to the token, not to the spaces around it: ` <- ` underlines `<-`.
  for (const list of found.values()) {
    for (const occ of list) {
      for (const p of occ.parts) {
        while (p.end > p.start && /\s/.test(src[p.start])) p.start++;
        while (p.end > p.start && /\s/.test(src[p.end - 1])) p.end--;
      }
      occ.parts = occ.parts.filter((p) => p.end > p.start);
    }
  }
  // Source order; for occurrences starting together (a pipe chain), innermost first.
  for (const list of found.values()) list.sort((a, b) => a.start - b.start || (a.end - a.start) - (b.end - b.start));
  return found;
}

/**
 * All the code a lesson shows: scenes, sandbox, task starter and solution. With
 * `examples`, everything but the solution: an example taken from it would hand
 * over the answer.
 */
export function lessonCode(lesson, { examples = false } = {}) {
  return [
    ...lesson.scenes.map((s) => s.code),
    lesson.play.code, ...lesson.play.chips,
    lesson.task.starter,
    ...(examples ? [] : [lesson.task.solution]),
  ].filter((c) => typeof c === 'string');
}

/**
 * For each concept, the index of the first lesson whose code uses it. A concept no
 * lesson uses is absent: the student could only meet it by typing it themselves.
 */
export function firstLessons(lessons) {
  const first = new Map();
  lessons.forEach((lesson, i) => {
    for (const code of lessonCode(lesson)) {
      for (const id of findConcepts(code)?.keys() || []) if (!first.has(id)) first.set(id, i);
    }
  });
  return first;
}

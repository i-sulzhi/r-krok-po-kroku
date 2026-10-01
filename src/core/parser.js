/**
 * R parser: tokens -> AST.
 *
 * A Pratt parser, because R's precedence table is long (18 levels) and has both
 * right-associative operators (`^`, `<-`) and postfix ones (`(`, `[`, `[[`, `$`).
 * Precedence-climbing expresses that directly; a recursive-descent cascade would
 * need eighteen near-identical functions.
 *
 * Every node carries a source span so the player can highlight the exact
 * sub-expression it is evaluating.
 */

import { tokenize, T, RSyntaxError } from './lexer.js';
import { t } from '../i18n/index.js';

/**
 * Binding power, from R's `?Syntax`, weakest first. Higher binds tighter.
 * `assoc: 'right'` for the operators R evaluates right-to-left.
 */
const INFIX = {
  '?':    { bp: 1,  assoc: 'left' },
  '=':    { bp: 2,  assoc: 'right', assign: 'local' },
  '<-':   { bp: 3,  assoc: 'right', assign: 'local' },
  '<<-':  { bp: 3,  assoc: 'right', assign: 'global' },
  '->':   { bp: 4,  assoc: 'left',  assign: 'rightward' },
  '->>':  { bp: 4,  assoc: 'left',  assign: 'rightward-global' },
  '~':    { bp: 5,  assoc: 'left' },
  '||':   { bp: 6,  assoc: 'left' },
  '|':    { bp: 6,  assoc: 'left' },
  '&&':   { bp: 7,  assoc: 'left' },
  '&':    { bp: 7,  assoc: 'left' },
  '==':   { bp: 9,  assoc: 'left' },
  '!=':   { bp: 9,  assoc: 'left' },
  '<':    { bp: 9,  assoc: 'left' },
  '>':    { bp: 9,  assoc: 'left' },
  '<=':   { bp: 9,  assoc: 'left' },
  '>=':   { bp: 9,  assoc: 'left' },
  '+':    { bp: 10, assoc: 'left' },
  '-':    { bp: 10, assoc: 'left' },
  '*':    { bp: 11, assoc: 'left' },
  '/':    { bp: 11, assoc: 'left' },
  '|>':   { bp: 12, assoc: 'left', pipe: true },
  '%>%':  { bp: 12, assoc: 'left', pipe: true },   // magrittr's pipe, still everywhere in tidyverse code
  ':':    { bp: 13, assoc: 'left' },
  '^':    { bp: 15, assoc: 'right' },
  '::':   { bp: 18, assoc: 'left' },
};

const SPECIAL_INFIX_BP = 12; // %in%, %%, %/%, %o%, and any user %op%
const UNARY_BP = 14;         // unary - and +  (binds tighter than `:`, looser than `^`)
const NOT_BP = 8;            // `!`
const POSTFIX_BP = 16;       // call, [, [[
const DOLLAR_BP = 17;        // $ and @

const isSpecialInfix = (v) => typeof v === 'string' && v.length >= 2 && v.startsWith('%') && v.endsWith('%');

export function parse(src) {
  return new Parser(src).parseProgram();
}

class Parser {
  constructor(src) {
    this.src = src;
    this.tokens = tokenize(src);
    this.i = 0;
    // Inside ( ) and [ ] a newline is pure whitespace. Inside { } and at top level
    // it separates statements. Tracking depth is how we tell the two apart.
    this.groupDepth = 0;
  }

  // --- token helpers ------------------------------------------------------
  peek(k = 0) { return this.tokens[this.i + k]; }
  get cur() { return this.tokens[this.i]; }
  next() { return this.tokens[this.i++]; }

  at(type, value) {
    const t = this.cur;
    return t.type === type && (value === undefined || t.value === value);
  }

  /** @param {string} whatKey  i18n key naming what was expected, e.g. 'tok.rparen' */
  expect(type, whatKey) {
    if (!this.at(type)) {
      // `whatKey` travels alongside the translated name so diagnosis can tell a
      // missing bracket from a missing comma without matching translated text.
      this.fail('err.expected', { what: whatKey ? t(whatKey) : type, whatKey: whatKey || '', got: describe(this.cur) });
    }
    return this.next();
  }

  fail(key, params = {}, tok = this.cur) {
    throw new RSyntaxError(key, { start: tok.start, end: tok.end, line: tok.line, col: tok.col }, params);
  }

  /** Skip line breaks that are not statement separators in the current context. */
  skipNewlines() {
    while (this.at(T.NEWLINE)) this.next();
  }

  /** Skip newlines only where they carry no meaning -- i.e. inside ( ) or [ ]. */
  skipInsideGroup() {
    if (this.groupDepth > 0) this.skipNewlines();
  }

  span(startTok, endNodeOrTok) {
    const end = endNodeOrTok && (endNodeOrTok.end ?? endNodeOrTok.span?.end);
    return { start: startTok.start, end: end ?? this.tokens[this.i - 1].end, line: startTok.line, col: startTok.col };
  }

  // --- top level ----------------------------------------------------------
  parseProgram() {
    const body = [];
    this.skipNewlines();
    while (!this.at(T.EOF)) {
      body.push(this.parseExpr());
      if (!this.consumeSeparator()) break;
    }
    this.skipNewlines();
    if (!this.at(T.EOF)) this.fail('err.trailing', { got: describe(this.cur) });
    return { type: 'Program', body, span: { start: 0, end: this.src.length } };
  }

  /** After a statement we need `\n`, `;` or a closing brace. */
  consumeSeparator() {
    let found = false;
    while (this.at(T.NEWLINE) || this.at(T.SEMI)) { this.next(); found = true; }
    if (this.at(T.EOF) || this.at(T.RBRACE)) return true;
    if (!found) return false;
    return true;
  }

  // --- expressions --------------------------------------------------------
  parseExpr(minBp = 0) {
    let left = this.parsePrefix();

    for (;;) {
      this.skipInsideGroup();
      const t = this.cur;
      if (t.type !== T.OP && t.type !== T.LPAREN && t.type !== T.LBRACKET && t.type !== T.LBRACKET2) break;

      // --- postfix: call and subsetting ---
      if (t.type === T.LPAREN) {
        if (POSTFIX_BP < minBp) break;
        left = this.parseCall(left);
        continue;
      }
      if (t.type === T.LBRACKET || t.type === T.LBRACKET2) {
        if (POSTFIX_BP < minBp) break;
        left = this.parseIndex(left);
        continue;
      }

      // --- $ and @ take a *name*, not an expression ---
      if (t.value === '$' || t.value === '@') {
        if (DOLLAR_BP < minBp) break;
        this.next();
        this.skipInsideGroup();
        const nameTok = this.cur;
        let name;
        if (nameTok.type === T.IDENT || nameTok.type === T.KEYWORD) name = this.next().value;
        else if (nameTok.type === T.STR) name = this.next().value;
        else this.fail('err.afterDollar', { op: t.value });
        left = { type: 'Extract', op: t.value, object: left, name,
                 span: { start: left.span.start, end: this.tokens[this.i - 1].end } };
        continue;
      }

      // INFIX is consulted first so %>% is treated as a pipe, not as a user operator.
      const info = INFIX[t.value] || (isSpecialInfix(t.value)
        ? { bp: SPECIAL_INFIX_BP, assoc: 'left', special: true }
        : null);
      if (!info) break;
      if (info.bp < minBp) break;

      this.next();
      this.skipNewlines(); // a line break after an operator never ends the statement
      const nextMin = info.assoc === 'right' ? info.bp : info.bp + 1;
      const right = this.parseExpr(nextMin);
      left = this.makeInfix(t, info, left, right);
    }

    return left;
  }

  makeInfix(tok, info, left, right) {
    const span = { start: left.span.start, end: right.span.end };
    if (info.assign) {
      // `x -> value` is the same assignment with the sides swapped; normalising here
      // means the evaluator only ever sees one assignment shape.
      const rightward = info.assign.startsWith('rightward');
      const target = rightward ? right : left;
      const value = rightward ? left : right;
      const scope = info.assign.includes('global') ? 'global' : 'local';
      return { type: 'Assign', target, value, scope, op: tok.value, span };
    }
    if (info.pipe) {
      // `x |> f(y)` is sugar for `f(x, y)`: rewrite at parse time so the evaluator
      // and the visualiser both see an ordinary call.
      // magrittr also allows a bare function name: `x %>% mean`.
      if (right.type === 'Ident' && tok.value === '%>%') {
        return { type: 'Call', callee: right, args: [{ name: null, value: left, span: left.span }], span, viaPipe: true };
      }
      if (right.type !== 'Call') this.fail('err.pipeNeedsCall', {}, tok);
      return { ...right, args: [{ name: null, value: left, span: left.span }, ...right.args], span, viaPipe: true };
    }
    return { type: 'Binary', op: tok.value, left, right, span };
  }

  parsePrefix() {
    this.skipInsideGroup();
    const t = this.cur;

    switch (t.type) {
      case T.NUM:
        this.next();
        return { type: 'Num', value: t.value, rtype: t.rtype, text: t.text, span: sp(t) };
      case T.STR:
        this.next();
        return { type: 'Str', value: t.value, span: sp(t) };
      case T.IDENT:
        this.next();
        return { type: 'Ident', name: t.value, span: sp(t) };
      case T.OP: {
        if (t.value === '-' || t.value === '+') {
          this.next();
          this.skipNewlines();
          const operand = this.parseExpr(UNARY_BP);
          return { type: 'Unary', op: t.value, operand, span: { start: t.start, end: operand.span.end } };
        }
        if (t.value === '!') {
          this.next();
          this.skipNewlines();
          const operand = this.parseExpr(NOT_BP);
          return { type: 'Unary', op: '!', operand, span: { start: t.start, end: operand.span.end } };
        }
        if (t.value === '~') {
          this.next();
          this.skipNewlines();
          const operand = this.parseExpr(5);
          return { type: 'Formula', lhs: null, rhs: operand, span: { start: t.start, end: operand.span.end } };
        }
        if (t.value === '...') {
          this.next();
          return { type: 'Dots', span: sp(t) };
        }
        this.fail('err.opCannotStart', { op: t.value });
        break;
      }
      case T.LPAREN: {
        this.next();
        this.groupDepth++;
        this.skipNewlines();
        const inner = this.parseExpr();
        this.skipNewlines();
        this.groupDepth--;
        const close = this.expect(T.RPAREN, 'tok.rparen');
        return { type: 'Paren', expr: inner, span: { start: t.start, end: close.end } };
      }
      case T.LBRACE:
        return this.parseBlock();
      case T.KEYWORD:
        return this.parseKeyword();
      default:
        this.fail('err.cannotStart', { got: describe(t) });
    }
    return null;
  }

  parseBlock() {
    const open = this.expect(T.LBRACE);
    const outer = this.groupDepth;
    this.groupDepth = 0; // inside { } newlines separate statements again
    const body = [];
    this.skipNewlines();
    while (!this.at(T.RBRACE) && !this.at(T.EOF)) {
      body.push(this.parseExpr());
      if (!this.consumeSeparator()) break;
      this.skipNewlines();
    }
    this.groupDepth = outer;
    const close = this.expect(T.RBRACE, 'tok.rbrace');
    return { type: 'Block', body, span: { start: open.start, end: close.end } };
  }

  parseKeyword() {
    const t = this.cur;
    switch (t.value) {
      case 'TRUE': case 'FALSE':
        this.next();
        return { type: 'Bool', value: t.value === 'TRUE', span: sp(t) };
      case 'NULL':
        this.next();
        return { type: 'Null', span: sp(t) };
      case 'NA': case 'NA_integer_': case 'NA_real_': case 'NA_character_':
        this.next();
        return { type: 'NAConst', flavour: t.value, span: sp(t) };
      case 'Inf':
        this.next();
        return { type: 'Num', value: Infinity, rtype: 'double', text: 'Inf', span: sp(t) };
      case 'NaN':
        this.next();
        return { type: 'Num', value: NaN, rtype: 'double', text: 'NaN', span: sp(t) };
      case 'break':
        this.next();
        return { type: 'Break', span: sp(t) };
      case 'next':
        this.next();
        return { type: 'Next', span: sp(t) };
      case 'if':      return this.parseIf();
      case 'for':     return this.parseFor();
      case 'while':   return this.parseWhile();
      case 'repeat':  return this.parseRepeat();
      case 'function':return this.parseFunction();
      default:
        this.fail('err.keywordUnexpected', { kw: t.value });
    }
    return null;
  }

  /** Parse a parenthesised condition, where newlines are insignificant. */
  parseParenExpr(what) {
    this.expect(T.LPAREN, null);
    this.groupDepth++;
    this.skipNewlines();
    const e = this.parseExpr();
    this.skipNewlines();
    this.groupDepth--;
    this.expect(T.RPAREN, 'tok.rparen');
    return e;
  }

  parseIf() {
    const start = this.next(); // 'if'
    const cond = this.parseParenExpr('if');
    this.skipNewlines();
    const then = this.parseExpr();

    // `else` on its own line is only legal inside { } in real R. We accept it
    // anywhere: the stricter rule produces a baffling error for beginners and
    // teaches nothing about how R works.
    const save = this.i;
    this.skipNewlines();
    if (this.at(T.KEYWORD, 'else')) {
      this.next();
      this.skipNewlines();
      const alt = this.parseExpr();
      return { type: 'If', cond, then, alt, span: { start: start.start, end: alt.span.end } };
    }
    this.i = save;
    return { type: 'If', cond, then, alt: null, span: { start: start.start, end: then.span.end } };
  }

  parseFor() {
    const start = this.next();
    this.expect(T.LPAREN, 'tok.lparen');
    this.groupDepth++;
    this.skipNewlines();
    const varTok = this.expect(T.IDENT, 'tok.loopVar');
    if (!this.at(T.KEYWORD, 'in')) this.fail('err.forNeedsIn');
    this.next();
    this.skipNewlines();
    const seq = this.parseExpr();
    this.skipNewlines();
    this.groupDepth--;
    this.expect(T.RPAREN, 'tok.rparen');
    this.skipNewlines();
    const body = this.parseExpr();
    return { type: 'For', varName: varTok.value, varSpan: sp(varTok), seq, body,
             span: { start: start.start, end: body.span.end } };
  }

  parseWhile() {
    const start = this.next();
    const cond = this.parseParenExpr('while');
    this.skipNewlines();
    const body = this.parseExpr();
    return { type: 'While', cond, body, span: { start: start.start, end: body.span.end } };
  }

  parseRepeat() {
    const start = this.next();
    this.skipNewlines();
    const body = this.parseExpr();
    return { type: 'Repeat', body, span: { start: start.start, end: body.span.end } };
  }

  parseFunction() {
    const start = this.next();
    this.expect(T.LPAREN, 'tok.lparen');
    this.groupDepth++;
    const params = [];
    this.skipNewlines();
    while (!this.at(T.RPAREN)) {
      this.skipNewlines();
      let nameTok;
      if (this.at(T.OP, '...')) nameTok = this.next();
      else nameTok = this.expect(T.IDENT, 'tok.argName');
      let def = null;
      this.skipNewlines();
      if (this.at(T.OP, '=')) {
        this.next();
        this.skipNewlines();
        def = this.parseExpr(3); // above `=` so the next comma ends the default
      }
      params.push({ name: nameTok.value ?? '...', default: def, span: sp(nameTok) });
      this.skipNewlines();
      if (this.at(T.COMMA)) { this.next(); continue; }
      break;
    }
    this.skipNewlines();
    this.groupDepth--;
    this.expect(T.RPAREN, 'tok.rparenParams');
    this.skipNewlines();
    const body = this.parseExpr();
    return { type: 'Function', params, body,
             span: { start: start.start, end: body.span.end },
             src: this.src.slice(start.start, body.span.end) };
  }

  parseCall(callee) {
    this.expect(T.LPAREN);
    this.groupDepth++;
    const args = this.parseArgList(T.RPAREN);
    this.groupDepth--;
    const close = this.expect(T.RPAREN, 'tok.rparenCall');
    return { type: 'Call', callee, args, span: { start: callee.span.start, end: close.end } };
  }

  parseIndex(object) {
    const open = this.next(); // [ or [[
    const double = open.type === T.LBRACKET2;
    this.groupDepth++;
    const args = this.parseArgList(double ? T.RBRACKET2 : T.RBRACKET, { allowEmpty: true });
    this.groupDepth--;
    let close;
    if (double) {
      close = this.at(T.RBRACKET2) ? this.next() : null;
      if (!close) {
        // `x[[1]]` may tokenise its tail as `]` `]` when nested, e.g. `x[y[[1]]]`
        this.expect(T.RBRACKET, 'tok.rbracket2');
        close = this.expect(T.RBRACKET, 'tok.rbracket2');
      }
    } else {
      close = this.expect(T.RBRACKET, 'tok.rbracket');
    }
    return { type: 'Index', object, args, bracket: double ? '[[' : '[',
             span: { start: object.span.start, end: close.end } };
  }

  /** Shared by calls and subsetting: `name = value` pairs, and empty slots for `x[, 1]`. */
  parseArgList(closer, { allowEmpty = false } = {}) {
    const args = [];
    this.skipNewlines();
    if (this.at(closer)) return args;

    for (;;) {
      this.skipNewlines();
      // An empty slot: `x[, 1]` or a trailing `f(a, )`
      if (this.at(T.COMMA) || this.at(closer)) {
        if (allowEmpty || this.at(T.COMMA)) {
          args.push({ name: null, value: { type: 'Missing', span: sp(this.cur) }, span: sp(this.cur), empty: true });
        }
        if (this.at(closer)) break;
        this.next();
        continue;
      }

      let name = null;
      let nameSpan = null;
      // `name = value`, but only when `name` is a plain identifier or string
      if ((this.at(T.IDENT) || this.at(T.STR) || this.at(T.KEYWORD)) &&
          this.peek(1).type === T.OP && this.peek(1).value === '=') {
        const nameTok = this.next();
        nameSpan = sp(nameTok);
        name = String(nameTok.value);
        this.next(); // '='
        this.skipNewlines();
      }

      const startTok = this.cur;
      const value = this.parseExpr(3); // above `=`, so a comma terminates the argument
      args.push({ name, nameSpan, value, span: { start: nameSpan?.start ?? startTok.start, end: value.span.end } });

      this.skipNewlines();
      if (this.at(T.COMMA)) { this.next(); continue; }
      break;
    }
    this.skipNewlines();
    return args;
  }
}

const sp = (t) => ({ start: t.start, end: t.end, line: t.line, col: t.col });

function describe(tok) {
  if (tok.type === T.EOF) return t('tok.eof');
  if (tok.type === T.NEWLINE) return t('tok.newline');
  return `«${tok.value}»`;
}

export { RSyntaxError };

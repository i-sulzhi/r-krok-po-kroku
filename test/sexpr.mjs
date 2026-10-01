/** Render our AST as an s-expression, so it can be diffed against R's own parse tree. */
import { parse } from '../src/core/parser.js';

export function sexpr(n) {
  switch (n.type) {
    case 'Program':  return n.body.map(sexpr).join('\n');
    case 'Num':      return n.rtype === 'integer' ? `${n.value}L` : String(n.value);
    case 'Str':      return JSON.stringify(n.value);
    case 'Ident':    return n.name;
    case 'Bool':     return n.value ? 'TRUE' : 'FALSE';
    case 'Null':     return 'NULL';
    case 'NAConst':  return n.flavour;
    case 'Dots':     return '...';
    case 'Missing':  return '<empty>';
    case 'Break':    return '(break)';
    case 'Next':     return '(next)';
    case 'Paren':    return `(paren ${sexpr(n.expr)})`;
    case 'Unary':    return `(u${n.op} ${sexpr(n.operand)})`;
    case 'Binary':   return `(${n.op} ${sexpr(n.left)} ${sexpr(n.right)})`;
    case 'Assign':   return `(${n.scope === 'global' ? '<<-' : '<-'} ${sexpr(n.target)} ${sexpr(n.value)})`;
    case 'Formula':  return `(~ ${sexpr(n.rhs)})`;
    case 'Extract':  return `(${n.op} ${sexpr(n.object)} ${n.name})`;
    case 'Index':    return `(${n.bracket} ${sexpr(n.object)} ${n.args.map(a => arg(a)).join(' ')})`;
    case 'Call':     return `(call ${sexpr(n.callee)} ${n.args.map(a => arg(a)).join(' ')})`.replace(/ \)$/, ')');
    case 'Block':    return `(block ${n.body.map(sexpr).join(' ')})`;
    case 'If':       return `(if ${sexpr(n.cond)} ${sexpr(n.then)}${n.alt ? ' ' + sexpr(n.alt) : ''})`;
    case 'For':      return `(for ${n.varName} ${sexpr(n.seq)} ${sexpr(n.body)})`;
    case 'While':    return `(while ${sexpr(n.cond)} ${sexpr(n.body)})`;
    case 'Repeat':   return `(repeat ${sexpr(n.body)})`;
    case 'Function': return `(function (${n.params.map(p => p.default ? `${p.name}=${sexpr(p.default)}` : p.name).join(' ')}) ${sexpr(n.body)})`;
    default: throw new Error(`sexpr: unhandled node ${n.type}`);
  }
}
const arg = (a) => (a.name ? `${a.name}=${sexpr(a.value)}` : sexpr(a.value));
export const parseToSexpr = (src) => sexpr(parse(src));

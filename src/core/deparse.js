/**
 * An expression back to code, the way R's deparse() writes it: `mean(wiek)`,
 * `ocena > 3`, `x$a`. Used where R itself names something by its code, such as an
 * unnamed summarise() column. Covers the expressions the trainer's lessons use;
 * anything else falls back to "...", which is never a column name a lesson checks.
 */
export function deparse(node) {
  if (!node) return '';
  switch (node.type) {
    case 'Ident': return node.name;
    case 'Num': return node.text ?? String(node.value);
    case 'Str': return JSON.stringify(node.value);
    case 'Bool': return node.value ? 'TRUE' : 'FALSE';
    case 'NAConst': return 'NA';
    case 'Null': return 'NULL';
    case 'Paren': return `(${deparse(node.expr ?? node.body ?? node.inner)})`;
    case 'Unary': return `${node.op}${deparse(node.operand)}`;
    case 'Binary': {
      const tight = node.op === ':' || node.op === '^';
      return tight ? `${deparse(node.left)}${node.op}${deparse(node.right)}` : `${deparse(node.left)} ${node.op} ${deparse(node.right)}`;
    }
    case 'Extract': return `${deparse(node.object)}${node.op || '$'}${node.name}`;
    case 'Index': {
      const close = node.bracket === '[[' ? ']]' : ']';
      return `${deparse(node.object)}${node.bracket}${(node.args || []).map(arg).join(', ')}${close}`;
    }
    case 'Call': return `${deparse(node.callee)}(${(node.args || []).map(arg).join(', ')})`;
    default: return '...';
  }
}

const arg = (a) => (a.empty || !a.value ? '' : a.name ? `${a.name} = ${deparse(a.value)}` : deparse(a.value));

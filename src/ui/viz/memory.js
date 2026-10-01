/**
 * The memory panel: what R remembers after the code ran.
 *
 * Every name is a tag tied to a small picture of its value -- a strip of coloured
 * cells for a vector, a grid thumbnail for a table. The point is the tag metaphor:
 * `x <- 5` does not put 5 "into x"; it ties the label `x` to a value. Clicking a tag
 * shows the full value on the stage.
 */

import { el } from '../dom.js';
import { isFunction, isDataFrame, rLength } from '../../core/rvalue.js';
import { renderMini, renderThumb, typeLabel } from './value.js';
import { t } from '../../i18n/index.js';

/**
 * @param {Env} env        the global environment after the run
 * @param {Object} opts    {fresh: Set<string> names written by this run, onPick(name, value)}
 */
export function renderMemory(env, { fresh = null, onPick = null } = {}) {
  const frame = env.chainSnapshot()[0];
  const bindings = frame.bindings.filter((b) => !isFunction(b.value));
  if (!bindings.length) return el('div.mem-empty', t('mem.empty'));

  return el('div.mem-list', bindings.map((b) => el('button', {
    type: 'button',
    class: ['mem-item', fresh && fresh.has(b.name) ? 'mem-fresh' : ''].filter(Boolean).join(' '),
    title: t('mem.show', { name: b.name }),
    onClick: () => onPick?.(b.name, b.value),
  },
  el('span.mem-tag', b.name),
  el('span.mem-pic', isDataFrame(b.value) ? renderThumb(b.value, { small: true }) : renderMini(b.value, { max: 5 })),
  el('span.mem-kind', isDataFrame(b.value)
    ? t('val.dims', { rows: b.value.values.length ? rLength(b.value.values[0]) : 0, cols: b.value.values.length })
    : `${typeLabel(b.value)} · ${rLength(b.value)}`))));
}

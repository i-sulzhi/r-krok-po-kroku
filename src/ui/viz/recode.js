/**
 * The picture for if_else() and case_when() (D34): who took each row.
 *
 * One line per row of the table, one column per condition, in the order R reads
 * them. The condition that claimed the row is lit; the ones after it are blank,
 * because R never looked at them. That blank space is the whole lesson of
 * "the first TRUE wins", and a row of NA cells ending in NA is the other one.
 */

import { el } from '../dom.js';
import { isNA } from '../../core/rvalue.js';
import { formatScalar } from '../../core/format.js';
import { t } from '../../i18n/index.js';

const MAX_ROWS = 12;

const flag = (x) => (isNA(x) ? 'NA' : x ? 'TRUE' : 'FALSE');
const shown = (x, type) => (isNA(x) ? 'NA' : type === 'character' ? `"${x}"` : formatScalar(x, type));

/** How one condition cell reads for one row. `took` is the index that claimed the row. */
export function cellState(value, k, took) {
  if (typeof took === 'number' && k > took) return 'skip';
  if (isNA(value)) return 'na';
  return value ? 'hit' : 'miss';
}

/**
 * @param {Object} data    the RECODE event: {conditions, took, values, type, hasDefault}
 * @param {string[]} labels  the code of each condition, as written
 */
export function renderRecode(data, labels) {
  const { conditions, took, values, type, hasDefault } = data;
  const n = Math.min(values.length, MAX_ROWS);
  const at = (k, r) => conditions[k][conditions[k].length === 1 ? 0 : r];
  const head = el('tr',
    el('th.rc-num', ''),
    labels.map((code) => el('th.rc-cond', el('code', code))),
    hasDefault ? el('th.rc-cond', el('code', '.default')) : null,
    el('th.rc-out', t('rc.result')));
  const rows = Array.from({ length: n }, (_, r) => el('tr', { class: took[r] === 'none' ? 'rc-row-none' : '' },
    el('td.rc-num', String(r + 1)),
    conditions.map((_, k) => {
      const state = cellState(at(k, r), k, took[r]);
      return el('td', { class: `rc-cell rc-${state}` }, state === 'skip' ? '' : flag(at(k, r)));
    }),
    hasDefault ? el('td', { class: `rc-cell rc-${took[r] === 'rest' ? 'hit' : 'skip'}` }, took[r] === 'rest' ? t('rc.rest') : '') : null,
    el('td', { class: ['rc-value', isNA(values[r]) ? 'rc-value-na' : ''].filter(Boolean).join(' '), dataset: { type } }, shown(values[r], type))));
  return el('div.rc-wrap',
    el('table.rc', el('thead', head), el('tbody', rows)),
    values.length > n ? el('div.rc-more', t('rc.more', { n: values.length - n })) : null);
}

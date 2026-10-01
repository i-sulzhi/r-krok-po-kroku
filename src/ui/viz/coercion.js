/**
 * The coercion panel: before and after, cell by cell.
 *
 * Coercion is invisible in R -- no message, no warning, just different data. Drawing
 * the two rows one above the other, in the type colours, is the whole lesson: the
 * row changes colour *together*, because type belongs to the vector and not to the
 * cell. When the input was a mix (`c(1, 2, "a")`), the "before" row keeps each
 * cell in the colour of the part it came from, so the mix is visible too.
 */

import { el } from '../dom.js';
import { isNA } from '../../core/rvalue.js';
import { t } from '../../i18n/index.js';

const HIERARCHY = ['logical', 'integer', 'double', 'character'];

const label = (type) => t(`badge.${type}`);

const show = (x, type) => {
  if (isNA(x)) return 'NA';
  if (type === 'character') return `"${x}"`;
  if (type === 'logical') return x ? 'TRUE' : 'FALSE';
  return String(x);
};

/** The one-way ladder of types, with the step this coercion took lit up. */
export function typeLadder(from, to) {
  const froms = String(from || '').split('/');
  const top = HIERARCHY.indexOf(to);
  return el('div.co-ladder', HIERARCHY.map((type, i) => el('div', {
    class: ['co-rung',
      froms.includes(type) ? 'co-from' : '',
      type === to ? 'co-to' : '',
      i <= top && froms.some((f) => HIERARCHY.indexOf(f) < i) ? 'co-passed' : ''].filter(Boolean).join(' '),
    dataset: { type },
  }, label(type))));
}

/** @param {Object} ev  a COERCE event */
export function renderCoercion(ev) {
  const d = ev.data;
  const before = d.before || [];
  const after = d.after || [];
  const lost = new Set(d.lostPositions || []);

  // Which type each "before" cell had: per part for c(), otherwise the source type.
  const beforeTypes = d.parts
    ? d.parts.flatMap((p) => p.values.map(() => p.type))
    : before.map(() => String(d.from).split('/')[0]);

  const cell = (x, type, extra = '') => el('div', {
    class: ['co-cell', isNA(x) ? 'rv-na' : '', extra].filter(Boolean).join(' '),
    dataset: { type },
  }, show(x, type));

  return el('div.co-panel',
    typeLadder(d.from, d.to),
    el('div.co-flow',
      el('div.co-row.co-before', before.map((x, i) => cell(x, beforeTypes[i]))),
      el('div.co-arrow', '↓'),
      el('div.co-row.co-after', after.map((x, i) => cell(x, d.to, lost.has(i) ? 'co-lost' : '')))),
    lost.size ? el('div.co-warning', t('co.lost', { n: lost.size })) : null);
}

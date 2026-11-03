/**
 * "To samo w Pythonie" (D93): the sandbox's R lines beside the same work in Python.
 *
 * The students met linear models in Python before this course, with statsmodels and
 * scikit-learn. A panel under the sandbox lays each R line beside both, with the
 * result they share, so the student sees what is the same (the numbers, the formula
 * in statsmodels) and what is not (scikit-learn takes X and y apart, Python counts
 * rows from 0).
 *
 * Python does not run in the trainer. The lines are shown, not executed here; every
 * one of them was run in real Python and its result checked against the number on
 * screen (test/diff-python.mjs), as the R lines are checked against real R.
 */

import { el } from './dom.js';
import { highlightCode } from './codebox.js';
import { markup } from './markup.js';
import { t } from '../i18n/index.js';

/**
 * @param {Object} spec    {setup, rows: [{r, statsmodels, sklearn, out, outPy?}], notes: string[]}
 * @param {Object} opts    {onR(code)}: put an R line into the sandbox
 */
export function renderPythonCompare(spec, { onR = null } = {}) {
  const pyCode = (code) => el('pre.py-code', el('code', code));
  const rows = spec.rows.map((row) => el('div.py-row',
    el('div.py-cell.py-r',
      el('span.py-label', t('py.r')),
      onR
        ? el('button.py-r-code', { type: 'button', title: t('py.tryR'), onClick: () => onR(row.r) }, el('code', { html: highlightCode(row.r) }))
        : el('code', { html: highlightCode(row.r) })),
    el('div.py-cell', el('span.py-label', t('py.sm')), pyCode(row.statsmodels)),
    el('div.py-cell', el('span.py-label', t('py.sk')), pyCode(row.sklearn)),
    row.out != null
      ? el('div.py-cell.py-out', el('span.py-label', t('py.out')),
        row.outPy != null && row.outPy !== row.out
          ? el('span.py-out-pair', el('span', `R: ${row.out}`), el('span', `Python: ${row.outPy}`))
          : el('span', row.out))
      : el('div.py-cell.py-out')));
  return el('details.py-cmp',
    el('summary.py-summary', t('py.title')),
    el('p.py-lead', t('py.lead')),
    el('ul.py-notes', spec.notes.map((n) => el('li', { html: markup(n) }))),
    el('div.py-rows', rows),
    el('details.py-data', el('summary', t('py.data')), pyCode(spec.setup)));
}

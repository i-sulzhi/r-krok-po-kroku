/**
 * The pattern panel: which part of each string a regular expression actually hit.
 *
 * A student who writes `str_detect(x, "Krak")` and gets FALSE has no way to tell,
 * from the output, whether the pattern is wrong, the case is wrong, or the data is
 * not what they think. Highlighting the matched span inside the original text answers
 * all three at once -- and makes the classic surprises visible: `.` matching any
 * character, a pattern hitting the middle of a longer word, case sensitivity.
 */

import { el } from '../dom.js';
import { t } from '../../i18n/index.js';

/** @param {Object} ev  a REGEX event */
export function renderRegex(ev) {
  const d = ev.data;
  const subjects = d.subjects || [];
  const matches = d.matches || [];

  const rows = subjects.map((text, i) => {
    const ms = matches[i] || [];
    return el('div', { class: ['rx-row', ms.length ? 'rx-hit' : 'rx-miss'].join(' ') },
      el('div.rx-num', String(i + 1)),
      el('div.rx-text', text === null || text === undefined
        ? el('span.rx-na', 'NA')
        : highlightSpans(String(text), ms)),
      el('div.rx-count', ms.length
        ? t('rx.matchCount', { n: ms.length })
        : el('span.rx-none', t('rx.noMatch'))));
  });

  return el('div.rx-panel',
    el('div.rx-head',
      el('span.rx-fname', `${d.fname}()`),
      el('span.rx-pattern-label', t('rx.pattern')),
      el('code.rx-pattern', d.pattern)),
    el('div.rx-rows', rows),
    d.total > subjects.length
      ? el('div.rx-more', `… ${d.total - subjects.length}`)
      : null);
}

/** Split a string into matched and unmatched runs. */
function highlightSpans(text, matches) {
  if (!matches.length) return document.createTextNode(text);
  const parts = [];
  let pos = 0;
  for (const m of matches) {
    if (m.start > pos) parts.push(document.createTextNode(text.slice(pos, m.start)));
    parts.push(el('mark.rx-match', text.slice(m.start, m.end)));
    pos = m.end;
  }
  if (pos < text.length) parts.push(document.createTextNode(text.slice(pos)));
  return el('span', parts);
}

/**
 * The two screens around a person: "Kim jesteś?" and the report for the teacher.
 *
 * "Kim jesteś?" opens every time the trainer does. On a lab computer the browser
 * remembers the last student, and continuing as them silently is exactly the bug
 * D16 fixed; one click on your own name is cheap. A name is any text: first name,
 * nickname, initials. It stays in this browser (progress.js), which the screen says.
 *
 * Both screens are page elements, not browser dialogs: those are not available
 * everywhere the trainer runs.
 */

import { el, mount } from './dom.js';
import { MAX_NAME } from './progress.js';
import { verifyReports } from './report.js';
import { t } from '../i18n/index.js';

const pad = (n) => String(n).padStart(2, '0');
const shortDate = (ms) => { const d = new Date(ms); return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`; };

/**
 * @param {Object} a
 *   people     [{id, name, done, lastAt, last}] from progress.people()
 *   total      number of lessons
 *   onChoose(id), onAdd(name)
 *   onClose    present when someone is already working: the screen may be left
 */
export function renderWho(a) {
  const input = el('input.who-input', {
    type: 'text',
    maxlength: String(MAX_NAME),
    autocomplete: 'off',
    spellcheck: 'false',
    placeholder: t('who.placeholder'),
    'aria-label': t('who.title'),
  });
  const form = el('form.who-form', {
    onSubmit: (e) => {
      e.preventDefault();
      if (input.value.trim()) a.onAdd(input.value);
      else input.focus();
    },
  }, input, el('button.who-start', { type: 'submit' }, t('who.start')));

  // Typing a name narrows the list: on a lab computer used by a whole year group,
  // your own name is a few letters away instead of a scroll.
  const narrow = () => {
    const typed = input.value.trim().toLocaleLowerCase('pl');
    for (const b of buttons) b.hidden = !!typed && !b.dataset.name.includes(typed);
    // A new name matches nobody: then there is no "Wracasz?" to show.
    if (list) list.hidden = buttons.every((b) => b.hidden);
  };
  input.addEventListener('input', narrow);
  const buttons = a.people.map((p) => el('button', {
    type: 'button',
    class: `who-person${p.last ? ' who-person-last' : ''}`,
    dataset: { name: p.name.toLocaleLowerCase('pl') },
    onClick: () => a.onChoose(p.id),
  },
  el('span.who-name', p.name),
  el('span.who-meta', [
    t('who.done', { n: p.done, total: a.total }),
    p.lastAt ? t('who.last', { date: shortDate(p.lastAt) }) : null,
  ].filter(Boolean).join(' · '))));

  const list = a.people.length
    ? el('div.who-back',
      el('div.who-back-label', t('who.back')),
      el('div.who-list', buttons))
    : null;

  const card = el('div.who-card', { role: 'dialog', 'aria-modal': 'true', 'aria-label': t('who.title') },
    el('div.who-brand', el('span.brand-r', 'R'), el('span', t('ui.brand'))),
    el('h1.who-title', t('who.title')),
    el('p.who-say', t('who.say')),
    form,
    el('p.who-hint', t('who.hint')),
    list,
    a.onClose ? el('button.ghost-btn.who-close', { type: 'button', onClick: a.onClose }, t('rep.close')) : null,
    // The teacher, on their own computer, checks reports without becoming a student.
    a.onTeacher ? el('button.who-teacher', { type: 'button', onClick: a.onTeacher }, t('who.teacher')) : null);
  // Focus the field once the screen is on the page: typing a name is the main path.
  setTimeout(() => { try { input.focus(); } catch { /* not attached yet */ } }, 0);
  return el('div.who', card);
}

/**
 * The report, ready to copy. The teacher's check is not here: a student does not
 * need it, and the teacher has their own way in from "Kim jesteś?".
 * @param {Object} a  {text, onClose}
 */
export function renderReport(a) {
  // Tall enough for the whole report, code line included: what is sent is what is seen.
  const rows = a.text.split('\n').length;
  const box = el('textarea.rep-text.rep-out', { readonly: true, rows: String(rows), spellcheck: 'false', wrap: 'off' });
  box.value = a.text;
  const copied = el('span.rep-copied', { 'aria-live': 'polite' });
  const copy = el('button.who-start', {
    type: 'button',
    onClick: () => {
      // Refused clipboard (some browsers, some app views): the older copy command
      // still works on selected text almost everywhere; only then ask for Ctrl+C.
      const fallback = () => {
        let ok = false;
        try { box.focus(); box.select(); ok = document.execCommand('copy'); } catch { /* ignore */ }
        copied.textContent = t(ok ? 'rep.copied' : 'rep.copyFailed');
      };
      try {
        const p = navigator.clipboard?.writeText(a.text);
        if (!p) { fallback(); return; }
        p.then(() => { copied.textContent = t('rep.copied'); }, fallback);
      } catch { fallback(); }
    },
  }, t('rep.copy'));

  return el('div.who',
    el('div.who-card.rep-card', { role: 'dialog', 'aria-modal': 'true', 'aria-label': t('rep.title') },
      el('h1.who-title', t('rep.title')),
      el('p.who-say', t('rep.say')),
      box,
      el('div.rep-actions', copy, copied, el('button.ghost-btn', { type: 'button', onClick: a.onClose }, t('rep.close')))));
}

/**
 * The teacher's check on its own, reached from "Kim jesteś?" without a name.
 * @param {Object} a  {onClose}
 */
export function renderCheck(a) {
  return el('div.who',
    el('div.who-card.rep-card.rep-check', { role: 'dialog', 'aria-modal': 'true', 'aria-label': t('rep.checkTitle') },
      el('h1.who-title', t('rep.checkTitle')),
      ...checkParts(),
      el('div.rep-actions', el('button.ghost-btn', { type: 'button', onClick: a.onClose }, t('rep.close')))));
}

/** Paste box, button and verdict. The verdict follows the box: a report pasted over
 *  the last one is never shown with the last one's verdict. One report gets a
 *  verdict and a short summary; several get a table, one row per person. */
function checkParts() {
  const pasted = el('textarea.rep-text.rep-paste', { rows: '8', spellcheck: 'false', placeholder: t('rep.pastePlaceholder') });
  const verdict = el('div.rep-verdict-host', { 'aria-live': 'polite' });
  const judge = () => {
    const all = pasted.value.trim() ? verifyReports(pasted.value) : [];
    mount(verdict, all.length > 1 ? groupTable(all) : all.length ? oneVerdict(all[0]) : null);
  };
  pasted.addEventListener('input', judge);
  const check = el('button.ghost-btn', { type: 'button', onClick: judge }, t('rep.checkBtn'));
  return [el('p.who-hint', t('rep.checkSay')), pasted, el('div.rep-actions', check), verdict];
}

const list = (numbers) => numbers.join(', ');
const problem = (r) => t(r.reason === 'noCode' ? 'rep.noCode' : 'rep.bad');

function oneVerdict(r) {
  if (!r.ok) return el('div.rep-verdict.rep-bad', problem(r));
  return el('div.rep-verdict.rep-ok',
    el('div', t('rep.ok', { name: r.name || '?' })),
    el('ul.rep-sum',
      el('li', t('rep.sumDate', { date: r.date || '?' })),
      el('li', t('rep.total', { n: r.done ?? '?', total: r.total ?? '?' })),
      el('li', r.solutions.length ? t('rep.sumSolution', { list: list(r.solutions) }) : t('rep.sumNoSolution')),
      r.started.length ? el('li', t('rep.sumStarted', { list: list(r.started) })) : null));
}

function groupTable(all) {
  const good = all.filter((r) => r.ok).length;
  const head = ['colName', 'colDate', 'colDone', 'colSolution', 'colStarted', 'colCode'];
  return el('div.rep-group',
    el('div.rep-verdict', { class: good === all.length ? 'rep-ok' : 'rep-bad' }, t('rep.many', { n: all.length, ok: good })),
    el('div.rep-table-wrap',
      el('table.rep-table',
        el('thead', el('tr', head.map((k) => el('th', t(`rep.${k}`))))),
        el('tbody', all.map((r) => el('tr', { class: r.ok ? 'rep-row-ok' : 'rep-row-bad' },
          el('td.rep-name', r.name || '?'),
          r.ok
            ? [el('td', r.date || '?'), el('td.rep-num', `${r.done} / ${r.total}`),
              el('td.rep-num', list(r.solutions)), el('td.rep-num', list(r.started)), el('td.rep-code', '✓')]
            : el('td.rep-why', { colspan: '5' }, `✗ ${problem(r)}`)))))));
}

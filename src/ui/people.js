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

import { el } from './dom.js';
import { MAX_NAME } from './progress.js';
import { verifyReport } from './report.js';
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

  const list = a.people.length
    ? el('div.who-back',
      el('div.who-back-label', t('who.back')),
      el('div.who-list', a.people.map((p) => el('button', {
        type: 'button',
        class: `who-person${p.last ? ' who-person-last' : ''}`,
        onClick: () => a.onChoose(p.id),
      },
      el('span.who-name', p.name),
      el('span.who-meta', [
        t('who.done', { n: p.done, total: a.total }),
        p.lastAt ? t('who.last', { date: shortDate(p.lastAt) }) : null,
      ].filter(Boolean).join(' · '))))))
    : null;

  const card = el('div.who-card', { role: 'dialog', 'aria-modal': 'true', 'aria-label': t('who.title') },
    el('div.who-brand', el('span.brand-r', 'R'), el('span', t('ui.brand'))),
    el('h1.who-title', t('who.title')),
    el('p.who-say', t('who.say')),
    form,
    el('p.who-hint', t('who.hint')),
    list,
    a.onClose ? el('button.ghost-btn.who-close', { type: 'button', onClick: a.onClose }, t('rep.close')) : null);
  // Focus the field once the screen is on the page: typing a name is the main path.
  setTimeout(() => { try { input.focus(); } catch { /* not attached yet */ } }, 0);
  return el('div.who', card);
}

/**
 * The report, ready to copy, and the teacher's check underneath.
 * @param {Object} a  {text, onClose}
 */
export function renderReport(a) {
  const box = el('textarea.rep-text', { readonly: true, rows: '14', spellcheck: 'false' });
  box.value = a.text;
  const copied = el('span.rep-copied', { 'aria-live': 'polite' });
  const copy = el('button.who-start', {
    type: 'button',
    onClick: () => {
      const fallback = () => {
        try { box.focus(); box.select(); } catch { /* ignore */ }
        copied.textContent = t('rep.copyFailed');
      };
      try {
        const p = navigator.clipboard?.writeText(a.text);
        if (!p) { fallback(); return; }
        p.then(() => { copied.textContent = t('rep.copied'); }, fallback);
      } catch { fallback(); }
    },
  }, t('rep.copy'));

  const pasted = el('textarea.rep-text.rep-paste', { rows: '6', spellcheck: 'false', placeholder: t('rep.pastePlaceholder') });
  const verdict = el('div.rep-verdict', { 'aria-live': 'polite' });
  const check = el('button.ghost-btn', {
    type: 'button',
    onClick: () => {
      const r = verifyReport(pasted.value);
      verdict.className = `rep-verdict ${r.ok ? 'rep-ok' : 'rep-bad'}`;
      verdict.textContent = r.ok ? t('rep.ok', { name: r.name || '?' }) : t(r.reason === 'noCode' ? 'rep.noCode' : 'rep.bad');
    },
  }, t('rep.checkBtn'));

  return el('div.who',
    el('div.who-card.rep-card', { role: 'dialog', 'aria-modal': 'true', 'aria-label': t('rep.title') },
      el('h1.who-title', t('rep.title')),
      el('p.who-say', t('rep.say')),
      box,
      el('div.rep-actions', copy, copied, el('button.ghost-btn', { type: 'button', onClick: a.onClose }, t('rep.close'))),
      el('details.rep-teacher',
        el('summary', t('rep.check')),
        el('p.who-hint', t('rep.checkSay')),
        pasted,
        el('div.rep-actions', check),
        verdict)));
}

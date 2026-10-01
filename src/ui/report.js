/**
 * "Raport dla prowadzącego": a student's progress as text they hand in themselves.
 *
 * The trainer has no server (D17), so the teacher sees progress only when a student
 * sends it: copied from here and pasted into Moodle, Teams or an e-mail. Plain text
 * survives all of those. The report says, per lesson, whether it was finished and
 * when, how many checks it took, how many hints, and whether the full solution was
 * opened, which is information for the teacher, not a penalty.
 *
 * The last line is a check code computed from the rest. It catches a report edited
 * by hand ("ukończone: 13 z 13"), not a determined programmer: the code that makes
 * it ships in this file. Honest about that in the teacher's text too. Verification
 * ignores what pasting does to text (line breaks, repeated or non-breaking spaces),
 * so a report pasted through an LMS still checks.
 */

import { t } from '../i18n/index.js';

const SALT = 'rkpk-report-1';

/** Two FNV-1a rounds: 8 hex digits, enough to make hand edits show. */
function hash(text) {
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ 0x5bd1e995;
  const s = `${SALT}\n${text}`;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x01000193 ^ 0x2f) >>> 0;
  }
  const hex = ((a ^ (b >>> 7)) >>> 0).toString(16).padStart(8, '0').toUpperCase();
  return `${hex.slice(0, 4)}-${hex.slice(4)}`;
}

/** What pasting may change, undone: the check sees words, not layout. */
const normalise = (text) => String(text)
  .replace(/\r\n?/g, '\n')
  .replace(/[   \t]/g, ' ')
  .split('\n')
  .map((line) => line.replace(/ +/g, ' ').trim())
  .filter(Boolean)
  .join('\n');

const pad = (n) => String(n).padStart(2, '0');
const day = (ms) => { const d = new Date(ms); return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`; };
const stamp = (ms) => { const d = new Date(ms); return `${day(ms)} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };

/**
 * @param {Object} a  {name, lessons, progress: {lessonId: record}, now}
 * @returns {string}  the report, check code last
 */
export function buildReport({ name, lessons, progress, now = Date.now() }) {
  const done = lessons.filter((l) => progress[l.id]?.status === 'done').length;
  const lines = [
    t('rep.head'),
    t('rep.person', { name }),
    t('rep.date', { date: stamp(now) }),
    t('rep.total', { n: done, total: lessons.length }),
    '',
    ...lessons.map((l, i) => {
      const p = progress[l.id];
      const facts = p && (p.attempts || p.hintsUsed || p.solutionSeen)
        ? ` (${[
          t('rep.attempts', { n: p.attempts || 0 }),
          t('rep.hints', { n: p.hintsUsed || 0 }),
          p.solutionSeen ? t('rep.solution') : null,
        ].filter(Boolean).join(', ')})`
        : '';
      const state = p?.status === 'done'
        ? t('rep.done', { date: p.doneAt ? day(p.doneAt) : '?' })
        : p ? t('rep.started') : t('rep.notStarted');
      // An arrow, not a colon: lesson titles have colons of their own ("Braki danych: NA").
      return `${i + 1}. ${l.title} → ${state}${facts}`;
    }),
  ];
  const body = lines.join('\n');
  return `${body}\n\n${t('rep.code', { code: hash(normalise(body)) })}`;
}

/**
 * Check a pasted report.
 * @returns {{ok: boolean, reason?: 'noCode'|'mismatch', name?: string}}
 */
export function verifyReport(text) {
  const lines = normalise(text).split('\n');
  const prefix = t('rep.code', { code: '' }).trim();
  const at = lines.map((l) => l.startsWith(prefix)).lastIndexOf(true);
  if (at < 0) return { ok: false, reason: 'noCode' };
  const given = lines[at].slice(prefix.length).trim().toUpperCase();
  // From the report's own first line: a greeting above it in an e-mail is not part of it.
  const head = lines.slice(0, at).lastIndexOf(t('rep.head'));
  const body = lines.slice(Math.max(head, 0), at).join('\n');
  // The report's own first lines, so the teacher sees whose report it is.
  const personPrefix = t('rep.person', { name: '' }).trim();
  const name = lines.find((l) => l.startsWith(personPrefix))?.slice(personPrefix.length).trim();
  return hash(body) === given ? { ok: true, name } : { ok: false, reason: 'mismatch', name };
}

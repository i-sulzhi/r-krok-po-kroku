/**
 * "Raport dla prowadzącego": a student's progress as text they hand in themselves.
 *
 * The trainer has no server (D17), so the teacher sees progress only when a student
 * sends it: copied from here and pasted into Moodle, Teams or an e-mail. Plain text
 * survives all of those. The report says, per lesson, whether it was finished and
 * when, how many checks it took, how many hints, and whether the full solution was
 * opened, which is information for the teacher, not a penalty. A solved task "dla
 * chętnych" (D41) is one more fact on the line. Those facts stop at
 * the first success (progress.js), and a zero is not printed: the line stays short
 * enough to read without wrapping.
 *
 * The last line is a check code computed from the rest. It catches a report edited
 * by hand ("ukończone: 13 z 13"), not a determined programmer: the code that makes
 * it ships in this file. Honest about that in the teacher's text too. Verification
 * ignores what pasting does to text (line breaks, repeated or non-breaking spaces),
 * so a report pasted through an LMS still checks. The code is computed from the text
 * itself, so rewording a lesson line keeps older reports checkable; only the first
 * line, "Osoba:", "Kod kontrolny:" and the salt must stay as they are.
 *
 * A teacher with a group pastes many reports at once: each code line closes one
 * report, which starts at the last report heading above it.
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
      const facts = [
        p?.attempts ? t('rep.attempts', { n: p.attempts }) : null,
        p?.hintsUsed ? t('rep.hints', { n: p.hintsUsed }) : null,
        p?.solutionSeen ? t('rep.solution') : null,
        // The optional second task (D41): said only when solved, so it reads as a plus.
        l.extra && p?.extra?.status === 'done' ? t('rep.extra') : null,
      ].filter(Boolean);
      const state = p?.status === 'done'
        ? t('rep.done', { date: p.doneAt ? day(p.doneAt) : '?' })
        : p ? t('rep.started') : t('rep.notStarted');
      // An arrow, not a colon: lesson titles have colons of their own ("Braki danych: NA").
      return `${i + 1}. ${l.title} → ${state}${facts.length ? ` (${facts.join(', ')})` : ''}`;
    }),
  ];
  const body = lines.join('\n');
  return `${body}\n\n${t('rep.code', { code: hash(normalise(body)) })}`;
}

/** A text line from the dictionary as a pattern: `{n}` and the like match digits. */
const pattern = (key, params, { whole = true } = {}) => {
  const marks = Object.fromEntries(params.map((p, i) => [p, `\u0001${i}\u0001`]));
  const escaped = t(key, marks).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const body = escaped.replace(/\u0001\d\u0001/g, '(\\d+)');
  return new RegExp(whole ? `^${body}$` : body);
};
const prefix = (key, param) => t(key, { [param]: '' }).trim();

/** What a checked report says, read back from its lines. */
function readFacts(body) {
  // Both wordings: reports written while the units were called lessons still read.
  const totals = [pattern('rep.total', ['n', 'total']), pattern('rep.totalWas', ['n', 'total'])];
  const done = [prefix('rep.done', 'date'), prefix('rep.doneWas', 'date')];
  const started = [t('rep.started'), t('rep.startedWas')];
  const attempts = pattern('rep.attempts', ['n'], { whole: false });
  const hints = pattern('rep.hints', ['n'], { whole: false });
  const out = { solutions: [], started: [], lessons: [] };
  for (const line of body) {
    if (line.startsWith(prefix('rep.date', 'date'))) out.date = line.slice(prefix('rep.date', 'date').length).trim();
    const m = totals.map((total) => line.match(total)).find(Boolean);
    if (m) { out.done = Number(m[1]); out.total = Number(m[2]); }
    const lesson = line.match(/^(\d+)\. (.+) → (.+)$/);
    if (!lesson) continue;
    const n = Number(lesson[1]);
    const state = lesson[3];
    const isDone = done.some((w) => state.startsWith(w));
    const isStarted = !isDone && started.some((w) => state.startsWith(w));
    const solution = state.includes(t('rep.solution'));
    if (solution) out.solutions.push(n);
    if (isStarted) out.started.push(n);
    // Every line in full, so the report can also bring progress to another computer (D36).
    const day = isDone ? state.match(/(\d\d)\.(\d\d)\.(\d{4})/) : null;
    out.lessons.push({
      n,
      title: lesson[2],
      status: isDone ? 'done' : isStarted ? 'seen' : null,
      doneAt: day ? new Date(Number(day[3]), Number(day[2]) - 1, Number(day[1]), 12).getTime() : null,
      attempts: Number(state.match(attempts)?.[1] || 0),
      hintsUsed: Number(state.match(hints)?.[1] || 0),
      solutionSeen: solution,
      extraDone: state.includes(t('rep.extra')),
    });
  }
  return out;
}

/**
 * A checked report as progress records, for a student who moves to another computer.
 * Lines are matched to exercises by title, not by number: a report keeps its meaning
 * when exercises are added or reordered, and a title that no longer exists is left
 * out and counted, never guessed.
 *
 * @param {Object} report   one ok entry of verifyReports()
 * @param {Array} lessons   the current lessons, each {id, title}
 * @returns {{records: Object, done: number, unknown: number}}
 *   records by lesson id; `unknown` counts worked-on lines with no exercise to go to
 */
export function progressFromReport(report, lessons) {
  const byTitle = new Map(lessons.map((l) => [l.title, l.id]));
  const records = {};
  let unknown = 0;
  for (const line of report?.lessons || []) {
    if (!line.status) continue;
    const id = byTitle.get(line.title);
    if (!id) { unknown++; continue; }
    records[id] = { status: line.status, doneAt: line.doneAt, attempts: line.attempts, hintsUsed: line.hintsUsed, solutionSeen: line.solutionSeen, extraDone: line.extraDone };
  }
  return { records, done: Object.values(records).filter((r) => r.status === 'done').length, unknown };
}

/** The name on the report's "Osoba:" line, so the teacher sees whose it is. */
const nameIn = (body) => {
  const p = prefix('rep.person', 'name');
  return body.find((l) => l.startsWith(p))?.slice(p.length).trim();
};

/**
 * Check pasted text holding one report or several, one under another.
 * @returns {Array<{ok: boolean, reason?: 'noCode'|'mismatch', name?: string,
 *   date?: string, done?: number, total?: number, solutions?: number[], started?: number[]}>}
 *   one entry per report, in the order pasted; empty for empty text
 */
export function verifyReports(text) {
  const lines = normalise(text).split('\n').filter(Boolean);
  const codePrefix = prefix('rep.code', 'code');
  const head = t('rep.head');
  const out = [];
  let from = 0;
  lines.forEach((line, at) => {
    if (!line.startsWith(codePrefix)) return;
    const given = line.slice(codePrefix.length).trim().toUpperCase();
    // From the report's own first line: a greeting above it in an e-mail is not part of it.
    const above = lines.slice(from, at);
    const body = above.slice(Math.max(above.lastIndexOf(head), 0));
    from = at + 1;
    const name = nameIn(body);
    out.push(hash(body.join('\n')) === given
      ? { ok: true, name, ...readFacts(body) }
      : { ok: false, reason: 'mismatch', name });
  });
  // A report pasted without its last line: say so instead of skipping it.
  const rest = lines.slice(from);
  const start = rest.indexOf(head);
  if (start >= 0 || (!out.length && lines.length)) {
    out.push({ ok: false, reason: 'noCode', name: nameIn(rest.slice(Math.max(start, 0))) });
  }
  return out;
}

/**
 * Check one pasted report (the last one, if there are several).
 * @returns {{ok: boolean, reason?: 'noCode'|'mismatch', name?: string}}
 */
export function verifyReport(text) {
  const all = verifyReports(text);
  return all[all.length - 1] || { ok: false, reason: 'noCode' };
}

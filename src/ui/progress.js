/**
 * Progress, saved in the browser, per person.
 *
 * Everything is kept in localStorage: no account, no server, nothing sent anywhere.
 * The course runs in a computer lab, so one browser serves many students. Each
 * student picks their name (or a nickname) when the trainer opens, and their
 * progress, saved code and place live under that name only. The next student picks
 * theirs and starts clean; a returning student picks theirs and continues.
 *
 * The name never leaves the browser. If the teacher wants to see progress, the
 * student copies a report (report.js) and hands it in through the university's own
 * channels: the data goes where the student sends it, and nowhere else.
 *
 * localStorage is not always available (private browsing, some file:// setups), so
 * every access degrades to an in-memory store rather than throwing. Progress is a
 * convenience; it must never be the reason the trainer fails to open.
 */

const PEOPLE_KEY = 'r-trainer.people.v1';
const LEGACY = ['r-trainer.progress.v1', 'r-trainer.place.v2'];

const memory = new Map();   // fallback store, key -> string
let blocked = false;

function read(key) {
  if (!blocked) {
    try { return localStorage.getItem(key); } catch { blocked = true; }
  }
  return memory.has(key) ? memory.get(key) : null;
}

function write(key, value) {
  if (!blocked) {
    try { localStorage.setItem(key, value); return; } catch { blocked = true; }
  }
  memory.set(key, value);
}

function remove(key) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
  memory.delete(key);
}

const readJSON = (key, fallback) => {
  try { return JSON.parse(read(key) || 'null') ?? fallback; } catch { return fallback; }
};

// --- people --------------------------------------------------------------------

/** {current, people: {id: {name, createdAt, lastAt}}} */
const roster = () => {
  const r = readJSON(PEOPLE_KEY, null);
  return r && typeof r.people === 'object' ? r : { current: null, people: {} };
};
const saveRoster = (r) => write(PEOPLE_KEY, JSON.stringify(r));

/** Whoever is working now; null until someone picks a name. */
let current = null;

/** The same name, typed again, is the same person: "ania " and "Ania" included. */
const sameName = (a, b) => a.trim().toLocaleLowerCase('pl') === b.trim().toLocaleLowerCase('pl');

export const MAX_NAME = 40;

/** Everyone who has used this browser, most recent first. */
export function people() {
  const r = roster();
  return Object.entries(r.people)
    .map(([id, p]) => ({ id, ...p, done: countDone(id), last: id === r.current }))
    .sort((a, b) => (b.lastAt || 0) - (a.lastAt || 0));
}

/** The person last chosen in this browser: offered first, never chosen silently. */
export const lastPerson = () => roster().current;

export const currentPerson = () => {
  if (!current) return null;
  const p = roster().people[current];
  return p ? { id: current, ...p } : null;
};

/** Start working as someone already on the list. */
export function choosePerson(id) {
  const r = roster();
  if (!r.people[id]) return null;
  r.people[id].lastAt = Date.now();
  r.current = id;
  saveRoster(r);
  current = id;
  return currentPerson();
}

/** A name typed on the welcome screen: an existing person, or a new one. */
export function addPerson(name) {
  const clean = String(name || '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
  if (!clean) return null;
  const r = roster();
  const found = Object.entries(r.people).find(([, p]) => sameName(p.name, clean));
  if (found) return choosePerson(found[0]);
  const id = `p${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
  r.people[id] = { name: clean, createdAt: Date.now(), lastAt: Date.now() };
  saveRoster(r);
  return choosePerson(id);
}

/**
 * Progress brought from another computer (D36): the person named in a report starts
 * or continues here, and what the report says is merged into what this browser
 * already holds for them. Merging only ever adds: a finished exercise stays
 * finished, the first finishing date stays, counts take the larger number. Saved
 * code and the place in a lesson are not in a report, so they are left as they are.
 *
 * @param {string} name      the name on the report
 * @param {Object} records   by lesson id: {status, doneAt, attempts, hintsUsed, solutionSeen}
 * @returns the person, now current; null for an empty name
 */
export function restorePerson(name, records) {
  const person = addPerson(name);
  if (!person) return null;
  const rank = { seen: 1, done: 2 };
  const all = readAll();
  for (const [id, rec] of Object.entries(records || {})) {
    const cur = all[id] || {};
    const status = (rank[rec.status] || 0) > (rank[cur.status] || 0) ? rec.status : cur.status;
    all[id] = {
      ...cur,
      status,
      attempts: Math.max(cur.attempts || 0, rec.attempts || 0),
      hintsUsed: Math.max(cur.hintsUsed || 0, rec.hintsUsed || 0),
      solutionSeen: !!(cur.solutionSeen || rec.solutionSeen),
      doneAt: status === 'done' ? (cur.doneAt || rec.doneAt || Date.now()) : cur.doneAt,
      updatedAt: Date.now(),
    };
  }
  writeAll(all);
  return person;
}

/** "Usuń moje dane": this person's name, progress, code and place leave the browser. */
export function forgetPerson(id = current) {
  if (!id) return;
  const r = roster();
  delete r.people[id];
  if (r.current === id) r.current = null;
  saveRoster(r);
  remove(progressKey(id));
  remove(placeKey(id));
  remove(sandboxKey(id));
  if (current === id) current = null;
}

/** Data from before names existed belongs to nobody in particular: drop it once. */
export function dropLegacy() {
  for (const key of LEGACY) remove(key);
}

// --- progress of the current person -------------------------------------------------

// Before anyone has picked a name (tests, a script poking the app) progress still
// works, under an anonymous slot that no person sees.
const progressKey = (id = current) => `r-trainer.progress.v2:${id || 'anon'}`;
const placeKey = (id = current) => `r-trainer.place.v3:${id || 'anon'}`;
const sandboxKey = (id = current) => `r-trainer.sandbox.v1:${id || 'anon'}`;

const readAll = (id) => readJSON(progressKey(id), {});
const writeAll = (data) => write(progressKey(), JSON.stringify(data));

/** @returns {{status, hintsUsed, attempts, solutionSeen, lastCode, codeAt, doneAt, updatedAt}|null} */
export const getProgress = (lessonId) => readAll()[lessonId] || null;

/** Every lesson's record for the current person. */
export const allProgress = () => readAll();

export function setProgress(lessonId, patch) {
  const all = readAll();
  all[lessonId] = { ...(all[lessonId] || {}), ...patch, updatedAt: Date.now() };
  writeAll(all);
  return all[lessonId];
}

export const markSeen = (lessonId) => {
  const current = getProgress(lessonId);
  if (current?.status === 'done') return current;      // never downgrade a finished lesson
  return setProgress(lessonId, { status: 'seen' });
};

export const markDone = (lessonId, { code = null } = {}) => {
  const now = Date.now();
  // The first success is the date the teacher sees; later re-solves do not move it.
  return setProgress(lessonId, { status: 'done', lastCode: code, codeAt: now, doneAt: getProgress(lessonId)?.doneAt || now });
};

// What the report tells the teacher (attempts, hints, an opened solution) is how the
// task was solved, so it stops counting at the first success. Checking again, or
// opening the model solution to compare, is practice and is not reported.
const finished = (p) => p?.status === 'done';

export const noteAttempt = (lessonId, { code = null } = {}) => {
  const current = getProgress(lessonId);
  const attempts = finished(current) ? current.attempts : (current?.attempts || 0) + 1;
  return setProgress(lessonId, { attempts, lastCode: code, codeAt: Date.now() });
};

export const noteHint = (lessonId, index) => {
  const current = getProgress(lessonId);
  if (finished(current)) return current;
  return setProgress(lessonId, { hintsUsed: Math.max(current?.hintsUsed || 0, index + 1) });
};

/** The student opened the full solution: worth telling the teacher, not a penalty. */
export const noteSolution = (lessonId) => {
  const current = getProgress(lessonId);
  return finished(current) ? current : setProgress(lessonId, { solutionSeen: true });
};

function countDone(id) {
  return Object.values(readAll(id)).filter((p) => p?.status === 'done').length;
}

/** Lessons the current person has finished. */
export const doneCount = () => countDone(current);

/** Where the person was: choosing their name again lands on the same lesson and step. */
export const savedPlace = () => readJSON(placeKey(), null);
export const savePlace = (place) => write(placeKey(), JSON.stringify(place));

/** What the person last wrote in the sandbox; null before they wrote anything. */
export const savedSandbox = () => read(sandboxKey());
export const saveSandbox = (code) => write(sandboxKey(), code);

// --- per-browser preferences ------------------------------------------------------

/** Whether the glossary dock was folded: a per-screen preference, null when unset. */
const FOLD_KEY = 'rkpk.glossaryFolded';
export const savedFold = () => {
  const v = read(FOLD_KEY);
  return v == null ? null : v === '1';
};
export const saveFold = (folded) => write(FOLD_KEY, folded ? '1' : '0');

/** Test hook: forget who is working, as a fresh page load would. */
export const _resetSession = () => { current = null; };

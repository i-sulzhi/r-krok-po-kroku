/**
 * "Ściąga": the glossary panel under the lesson.
 *
 * A first-time programmer reading `oceny <- c(4, 5, 3)` meets three new things at
 * once: a name, an arrow that stores, a function call. The lesson is about the
 * vector; the rest is the grammar around it. This panel explains that grammar, and
 * only the grammar actually present in the code on screen, using that very code as
 * the example: `oceny` is labelled "nazwa", `<-` "zapisz", `c(...)` "wartość".
 *
 * Three rules keep it from becoming clutter:
 *   - what is new in this lesson is open; what the student met earlier is a chip
 *     that opens on demand;
 *   - everything met so far stays one click away under "Cały słowniczek", with an
 *     example from the lesson where it first appeared;
 *   - it lives in a dock under the lesson that takes only the height the lesson
 *     leaves free, so it fills empty space on a big monitor and shrinks to its bar
 *     on a small one; the bar (always visible) says what is inside and opens more
 *     room on demand. On a phone the panel starts folded.
 *
 * The example is live: hovering it lights the same code in the box, clicking it
 * selects it, and the stage draws it.
 */

import { el } from './dom.js';
import { renderMini } from './viz/value.js';
import { CONCEPTS, findConcepts, lessonCode } from './concepts.js';
import { markup } from './markup.js';
import { t, has } from '../i18n/index.js';

/** How each concept looks in code, for the card's title. Code, so not translated. */
const SYMBOL = {
  name: null, assign: '<-', call: 'f()', comment: '#', dollar: '$', colon: ':',
  string: '"tekst"', bool: 'TRUE', arith: '+ - * /', compare: '== > <', logic: '& | !',
  na: 'NA', namedArg: 'a = b', index: '[ ]', pipe: '|>',
};

/** Parts that are the operation itself get the accent; the rest are its material. */
const KEY_PART = new Set(['assign', 'fn', 'pipe', 'op', 'compare', 'logic']);

/** Concepts whose result is worth showing: the ones that compute something. */
const HAS_RESULT = new Set(['call', 'dollar', 'colon', 'arith', 'compare', 'logic', 'index', 'pipe']);

const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** The value an occurrence evaluated to, found in the run's log by its place in the code. */
function valueAt(log, occ) {
  if (!log || !occ.node?.span) return undefined;
  const { start, end } = occ.node.span;
  for (const node of log.nodes()) {
    if (node.span?.start === start && node.span?.end === end && node.type === occ.node.type) {
      const entry = log.entriesFor(node)[0];
      return entry && !entry.error ? { entry, value: entry.value } : undefined;
    }
  }
  return undefined;
}

/** The example: the occurrence's code with each part labelled underneath. */
function anatomy(src, occ) {
  const pieces = [];
  let at = occ.start;
  const long = occ.end - occ.start > 44;
  for (const p of occ.parts) {
    if (p.start > at) pieces.push(el('span.gl-gap', src.slice(at, p.start)));
    const text = src.slice(p.start, p.end);
    pieces.push(el('span', { class: `gl-seg${p.label ? '' : ' gl-seg-plain'}${KEY_PART.has(p.label) ? ' gl-seg-key' : ''}` },
      el('code.gl-code', long && p.label && !KEY_PART.has(p.label) ? clip(text, 22) : text),
      el('span.gl-lab', p.label ? t(`gl.part.${p.label}`) : ' ')));
    at = p.end;
  }
  return pieces;
}

/** "Czytaj: oceny dostaje..." filled from the labelled parts of the example. */
function readAloud(id, src, occ) {
  if (!has(`gl.${id}.read`)) return null;
  const params = {};
  for (const p of occ.parts) if (p.label && !(p.label in params)) params[p.label] = clip(src.slice(p.start, p.end), 28);
  return el('p.gl-read', { html: markup(t(`gl.${id}.read`, params)) });
}

/**
 * One card.
 * @param {string} id
 * @param {Object} ex   {src, occ, log, lesson?} -- the example and where it came from
 * @param {Object} o    {isNew, onPick, onHover}
 */
function card(id, ex, o) {
  const { src, occ } = ex;
  const found = HAS_RESULT.has(id) ? valueAt(ex.log, occ) : undefined;
  const live = !!o.onPick && !ex.lesson && !!occ.node; // a comment never runs, so has nothing to draw
  const body = [
    ...anatomy(src, occ),
    found ? el('span.gl-res', el('span.gl-arrow', '→'), renderMini(found.value, { max: 5 })) : null,
  ];
  const example = live
    ? el('button.gl-anat', {
      type: 'button',
      title: t('gl.pick'),
      onClick: () => o.onPick(occ.node.span),
      onMouseenter: () => o.onHover?.({ start: occ.start, end: occ.end }),
      onMouseleave: () => o.onHover?.(null),
    }, body)
    : el('div.gl-anat', body);
  return el('div', { class: `gl-card${o.isNew ? ' gl-new' : ''}`, dataset: { concept: id } },
    el('div.gl-head',
      el('span.gl-term', t(`gl.${id}.term`)),
      SYMBOL[id] ? el('code.gl-sym', SYMBOL[id]) : null,
      o.isNew ? el('span.gl-tag', t('gl.new')) : null),
    example,
    el('p.gl-what', { html: markup(t(`gl.${id}.what`)) }),
    readAloud(id, src, occ),
    has(`gl.${id}.xl`) ? el('p.gl-xl', el('span.gl-xl-label', t('gl.xl')), el('span', { html: markup(t(`gl.${id}.xl`)) })) : null,
    ex.lesson ? el('p.gl-from', t('gl.example', { n: ex.lesson })) : null);
}

/** An example of a concept from a lesson's scenes or sandbox (never its solution). */
function exampleFrom(lessons, index, id) {
  for (const code of lessonCode(lessons[index], { examples: true })) {
    const occ = findConcepts(code)?.get(id)?.[0];
    if (occ) return { src: code, occ, log: null, lesson: index + 1 };
  }
  return null;
}

/**
 * The panel for the code on screen.
 *
 * @param {Object} a
 *   src       the code in the box
 *   found     findConcepts(src), or null when it does not parse
 *   log       that run's evaluation log
 *   prefer    code text of the scene's picked expression: its occurrence is the example
 *   lessons, lessonIndex, first   the course, where we are, firstLessons(lessons)
 *   open      Set of concept ids the student opened by hand (kept by the caller)
 *   folded    true when only the bar is shown
 *   onToggle(id), onPick(span), onHover(span|null), onBar()
 * @returns {{bar, panel}|null}  the handle and the cards; the caller places them
 */
export function renderGlossary(a) {
  const here = CONCEPTS.filter((id) => a.found?.has(id));
  const isNew = (id) => a.first.get(id) === a.lessonIndex;
  const exampleHere = (id) => {
    const list = a.found.get(id);
    const occ = (a.prefer && list.find((o) => a.src.slice(o.start, o.end) === a.prefer))
      || (a.prefer && list.find((o) => a.prefer.includes(a.src.slice(o.start, o.end))))
      || list[0];
    return { src: a.src, occ, log: a.log };
  };

  const fresh = here.filter(isNew);
  const known = here.filter((id) => !isNew(id));
  const away = (id) => !here.includes(id) && a.first.has(id);
  // This lesson's own concepts missing from this code: the task starts from a blank
  // box, which is exactly when the student needs them. Then everything met earlier.
  const lessonOwn = CONCEPTS.filter((id) => away(id) && a.first.get(id) === a.lessonIndex
    && exampleFrom(a.lessons, a.lessonIndex, id));
  const rest = CONCEPTS.filter((id) => away(id) && a.first.get(id) < a.lessonIndex
    && exampleFrom(a.lessons, a.first.get(id), id));

  const chip = (id) => el('button', {
    type: 'button',
    class: `gl-chip${a.open.has(id) ? ' gl-chip-on' : ''}`,
    'aria-expanded': a.open.has(id) ? 'true' : 'false',
    onClick: () => a.onToggle(id),
  }, SYMBOL[id] ? el('code', SYMBOL[id]) : null, el('span', t(`gl.${id}.term`)));

  const opened = (ids, inCode) => ids.filter((id) => a.open.has(id)).map((id) => {
    const ex = inCode ? exampleHere(id) : exampleFrom(a.lessons, a.first.get(id), id);
    return ex ? card(id, ex, { isNew: false, onPick: a.onPick, onHover: a.onHover }) : null;
  });

  const panel = el('div.gl-body',
    fresh.map((id) => card(id, exampleHere(id), { isNew: true, onPick: a.onPick, onHover: a.onHover })),
    known.length ? el('div.gl-group',
      el('div.gl-group-label', t('gl.known')),
      el('div.gl-chips', known.map((id) => chip(id))),
      opened(known, true)) : null,
    lessonOwn.length ? el('div.gl-group',
      el('div.gl-group-label', t('gl.lesson')),
      el('div.gl-chips', lessonOwn.map((id) => chip(id))),
      opened(lessonOwn, false)) : null,
    rest.length ? el('details.gl-all',
      // A chip opened inside the folded "whole glossary" must stay visible after a redraw.
      { open: rest.some((id) => a.open.has(id)) || null },
      el('summary.gl-group-label', `${t('gl.all')} (${rest.length})`),
      el('div.gl-chips', rest.map((id) => chip(id))),
      opened(rest, false)) : null);

  // The bar is the panel's handle: always on screen (see LessonView), so it names
  // what is inside even when there is no room to show it.
  const bar = el('button.gl-bar', {
    type: 'button',
    'aria-expanded': a.folded ? 'false' : 'true',
    onClick: () => a.onBar?.(),
  },
  el('span.gl-caret'),
  el('span.pane-title.gl-title', t('gl.title')),
  el('span.gl-bar-syms', here.filter((id) => SYMBOL[id]).map((id) => el('code', SYMBOL[id]))),
  fresh.length ? el('span.gl-bar-new', t('gl.newCount', { n: fresh.length })) : null);

  if (!here.length && !lessonOwn.length && !rest.length) return null;
  return { bar, panel };
}

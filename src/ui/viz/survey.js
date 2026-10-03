/**
 * A scene without code: a survey question, and what a factor makes of its answers.
 *
 * A factor is the first thing in the course with no counterpart the students have
 * typed before, so it is shown before it is written (D27). On the left, where the
 * code usually is, stands the questionnaire: one question, its answers, and the
 * people who filled it in. On the stage stands what R holds. Pointing at a person
 * or at an answer lights the same thing on both sides, which is the lookup a factor
 * does: a code per person, and a small table that says what each code means.
 *
 * Nothing here is typed in by hand. The picture is computed from the lesson's own
 * data: the setup runs, `picture.factor` is evaluated, and the codes, labels and
 * levels drawn are the ones R made.
 *
 * Kinds (Scene.picture.kind in lessons/schema.js):
 *   codebook  the sheet holds bare codes; the questionnaire is the codebook
 *   pairs     the factor itself: for each person a label and a code, plus the levels
 *   order     the same answers counted as text (alphabetical) and as a factor
 */

import { el, mount } from '../dom.js';
import { RSession } from '../../core/session.js';
import { isNA, getAttr, getNames, isFactor } from '../../core/rvalue.js';
import { t } from '../../i18n/index.js';

export const PICTURE_KINDS = ['codebook', 'pairs', 'order'];

/**
 * Run the lesson's data and read the factor the picture is about.
 * @returns {{levels: string[], codes: (number|null)[], raw: string[], rawType: string,
 *   counts: number[], alpha: {label: string, n: number}[]}}
 */
export function surveyData(setup, picture) {
  const session = new RSession({ trace: false });
  session.run(setup || '');
  const f = session.evaluate(picture.factor);
  if (!isFactor(f)) throw new Error(`picture.factor is not a factor: ${picture.factor}`);
  const levels = getAttr(f, 'levels').values.map(String);
  const codes = f.values.map((c) => (isNA(c) ? null : c));
  // What the sheet holds: the raw answers when the lesson names them, else the labels.
  const rawValue = picture.answers ? session.evaluate(picture.answers) : null;
  const raw = rawValue
    ? rawValue.values.map((x) => (isNA(x) ? 'NA' : String(x)))
    : codes.map((c) => (c == null ? 'NA' : levels[c - 1]));
  const rawType = rawValue ? rawValue.type : 'character';
  const counts = levels.map((_, k) => codes.filter((c) => c === k + 1).length);
  // The same answers as plain text: R's own table(), so the order is R's order.
  let alpha = [];
  if (picture.kind === 'order') {
    const tab = session.evaluate(`table(${picture.answers})`);
    const names = (getNames(tab)?.values || []).map(String);
    alpha = names.map((label, i) => ({ label, n: tab.values[i] }));
  }
  return { levels, codes, raw, rawType, counts, alpha };
}

/**
 * @param {Object} picture  Scene.picture
 * @param {string} setup    the lesson's setup code
 * @returns {{left: HTMLElement, stage: HTMLElement, select(sel): void}}
 */
export function renderSurvey(picture, setup) {
  const d = surveyData(setup, picture);
  const kind = picture.kind;
  // What is pointed at: one person, or one answer (level). A person shows their answer.
  let sel = { person: 0 };
  const levelOf = (s) => (s.level != null ? s.level : d.codes[s.person]);

  const left = el('div.sv');
  const stage = el('div.st.sv-stage');
  // Narrow screens put the stage here, under the questionnaire (app.placeStage); it
  // is made once, so a redraw does not throw the stage out.
  const slot = el('div.lv-slot');
  const pick = (next) => { sel = next; draw(); };
  const onPerson = (i) => ({ onClick: () => pick({ person: i }) });
  const onLevel = (k) => ({ onClick: () => pick({ level: k }) });
  const cls = (...names) => names.filter(Boolean).join(' ');

  function draw() {
    const level = levelOf(sel);
    const personLit = (i) => (sel.person != null ? sel.person === i : d.codes[i] === level);
    const levelLit = (k) => level === k;

    // --- the questionnaire, where the code usually is ---
    const options = picture.open
      ? el('div.sv-open', el('span.sv-open-label', t('sv.open')),
        el('span.sv-open-box', sel.person != null ? d.raw[sel.person] : d.levels[level - 1]))
      : el('div.sv-opts', d.levels.map((label, k) => el('button', {
        type: 'button',
        class: cls('sv-opt', levelLit(k + 1) && 'sv-on'),
        ...onLevel(k + 1),
      },
      el('span.sv-radio'),
      kind !== 'order' ? el('span.sv-code', String(k + 1)) : null,
      el('span.sv-opt-label', label))));
    mount(left,
      el('div.sv-card',
        el('div.sv-kicker', t('sv.kicker')),
        el('div.sv-question', picture.question),
        options),
      el('div.sv-people',
        el('div.sv-people-label', t('sv.people')),
        el('div.sv-people-list', d.codes.map((_, i) => el('button', {
          type: 'button',
          class: cls('sv-person', personLit(i) && 'sv-on'),
          title: t('sv.person', { i: i + 1 }),
          'aria-label': t('sv.person', { i: i + 1 }),
          ...onPerson(i),
        }, String(i + 1))))),
      el('p.sv-hint', t('sv.hint')),
      slot);

    // --- what R holds ---
    const body = kind === 'codebook' ? codebook(personLit, levelLit)
      : kind === 'pairs' ? pairs(personLit, levelLit)
        : order(levelLit);
    mount(stage, el('div.st-pic', body), el('div.st-caption', caption(level)));
  }

  /** A column as the sheet has it: row numbers and raw answers. */
  const sheetColumn = (personLit) => el('div.sv-block',
    el('div.sv-block-title', t('sv.sheet')),
    el('table.sv-table.sv-sheet',
      el('thead', el('tr', el('th', ''), el('th', picture.column))),
      el('tbody', d.raw.map((value, i) => el('tr', { class: cls(personLit(i) && 'sv-on'), ...onPerson(i) },
        el('td.sv-rownum', String(i + 1)),
        el('td', { class: 'sv-raw', dataset: { type: d.rawType } }, value))))));

  /** The levels as a small table: code, label, how many people. */
  const levelTable = (levelLit, title, labelHead) => el('div.sv-block',
    el('div.sv-block-title', title),
    el('table.sv-table.sv-levels',
      el('thead', el('tr', el('th', t('sv.code')), el('th', labelHead), el('th', t('sv.count')))),
      el('tbody', d.levels.map((label, k) => el('tr', {
        class: cls(levelLit(k + 1) && 'sv-on', d.counts[k] === 0 && 'sv-empty'),
        ...onLevel(k + 1),
      },
      el('td.sv-codecell', String(k + 1)),
      el('td.sv-labelcell', label),
      el('td.sv-n', d.counts[k] === 0 ? t('sv.nobody') : String(d.counts[k])))))));

  const codebook = (personLit, levelLit) => el('div.sv-row',
    sheetColumn(personLit),
    el('div.sv-link', '→'),
    levelTable(levelLit, t('sv.codebook'), t('sv.meaning')));

  /** The factor as two columns side by side: what you see, what is stored. */
  const pairs = (personLit, levelLit) => el('div.sv-row',
    el('div.sv-block',
      el('div.sv-block-title', t('sv.factor')),
      el('table.sv-table.sv-pairs',
        el('thead', el('tr',
          el('th', ''),
          el('th', t('sv.shown'), el('span.sv-sub', t('sv.shownSub'))),
          el('th', t('sv.stored'), el('span.sv-sub', t('sv.storedSub'))))),
        el('tbody', d.codes.map((code, i) => el('tr', { class: cls(personLit(i) && 'sv-on'), ...onPerson(i) },
          el('td.sv-rownum', String(i + 1)),
          el('td.sv-labelcell', code == null ? 'NA' : d.levels[code - 1]),
          el('td.sv-codecell', code == null ? 'NA' : String(code))))))),
    el('div.sv-link', '→'),
    levelTable(levelLit, t('sv.levels'), t('sv.shown')));

  /** One count table as bars; a level nobody chose is drawn hollow. */
  const bars = (title, rows, levelLit) => {
    const max = Math.max(1, ...rows.map((r) => r.n));
    return el('div.sv-block.sv-bars-block',
      el('div.sv-block-title', title),
      el('div.sv-bars', rows.map((r) => {
        const k = d.levels.indexOf(r.label) + 1;
        return el('button', {
          type: 'button',
          class: cls('sv-bar-row', levelLit(k) && 'sv-on', r.n === 0 && 'sv-empty'),
          ...onLevel(k),
        },
        el('span.sv-bar-label', r.label),
        el('span.sv-bar-track', el('span.sv-bar', { style: { width: `${(r.n / max) * 100}%` } })),
        el('span.sv-n', r.n === 0 ? t('sv.nobody') : String(r.n)));
      })));
  };

  const order = (levelLit) => el('div.sv-col',
    bars(t('sv.alpha'), d.alpha, levelLit),
    bars(t('sv.scale'), d.levels.map((label, k) => ({ label, n: d.counts[k] })), levelLit));

  function caption(level) {
    if (level == null) return t('sv.cap.na');
    const label = d.levels[level - 1];
    const n = d.counts[level - 1];
    const who = sel.person != null ? { i: sel.person + 1 } : null;
    const p = { label, code: level, n, ...who };
    if (kind === 'order') {
      if (n === 0) return t('sv.cap.orderEmpty', p);
      const a = d.alpha.findIndex((r) => r.label === label) + 1;
      return t('sv.cap.order', { ...p, a, s: level });
    }
    if (who) return t(`sv.cap.${kind}Person`, p);
    return t(n === 0 ? `sv.cap.${kind}Empty` : `sv.cap.${kind}Level`, p);
  }

  draw();
  return { left, stage, select: pick };
}

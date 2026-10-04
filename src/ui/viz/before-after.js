/**
 * A scene without code for the dplyr verbs: a question, and the table before and after.
 *
 * Each verb lesson opens with what the verb does to the table, before its name is
 * typed (D29). On the left, where the code would be, stands a research question in
 * plain words and the steps "przed" and "po". On the stage stands ONE table that
 * moves between them: rows fade and close up (filter), columns leave (select), a
 * column grows (mutate), rows travel to new places (arrange), rows gather by colour
 * and fly into one row per group (group_by, summarise, count).
 *
 * Nothing is drawn by hand. The lesson's setup runs, `picture.code` runs with the
 * trace on, and the stages are read off the verbs' own events: the rows kept, the
 * order, the groups, the values computed are R's. A pipeline of several verbs gives
 * one stage per verb, so the same picture carries the closing lesson.
 *
 * Every row and every cell is placed absolutely and exists once for the whole
 * picture; a stage only says where each one is and whether it shows. That is what
 * makes a row visibly the same row before and after.
 */

import { el, mount } from '../dom.js';
import { RSession } from '../../core/session.js';
import { formatScalar } from '../../core/format.js';
import { EV } from '../../trace/events.js';
import { t } from '../../i18n/index.js';

const ROW_H = 30;        // px, every row; positions are multiples of it
const NUM_W = 3.5;       // ch, the row-number column
const STEP_MS = 1500;    // one stage of the opening animation
const GROUP_COLOURS = 6;

const VERB_EVENTS = [EV.DPLYR_FILTER, EV.DPLYR_SELECT, EV.DPLYR_MUTATE, EV.DPLYR_ARRANGE, EV.DPLYR_GROUP, EV.DPLYR_SUMMARISE];

const cellText = (v, type) => (v === null || v === undefined ? 'NA' : formatScalar(v, type));

/**
 * Run the code and turn its verbs into stages.
 * @returns {{cols: Map<string, {name, type}>, rows: Map<string, {num}>, stages: Array}}
 *   stage: {kind, verb, cols: string[], rows: string[], text: Map<key, Object>,
 *           groupOf: Map<key, number>|null, into: Map<oldKey, newKey>|null, fresh: string[], facts}
 */
export function verbStages(setup, picture) {
  const session = new RSession();
  if (setup) session.run(setup, { trace: false });
  const run = session.run(picture.code);
  if (!run.ok) throw new Error(`picture.code fails: ${run.error?.message}`);
  const events = run.trace.events.filter((e) => VERB_EVENTS.includes(e.type));
  // The table the first verb received (mutate's own preview is the table it made).
  const opening = events.find((e) => e.data.preview);
  const first = opening?.data.input || opening?.data.preview;
  if (!first) throw new Error('picture.code uses no dplyr verb on a table');

  const cols = new Map(first.names.map((name, j) => [name, { name, type: first.columns[j].type }]));
  const rows = new Map();
  const text = new Map();
  for (let i = 0; i < first.rows; i++) {
    const key = `r${i}`;
    rows.set(key, { num: i + 1 });
    text.set(key, Object.fromEntries(first.names.map((name, j) => [name, cellText(first.columns[j].values[i], first.columns[j].type)])));
  }

  const start = {
    kind: 'before', verb: null, cols: [...first.names], rows: [...rows.keys()], text, groupOf: null, into: null, fresh: [],
    facts: { rows: first.rows, cols: first.names.length },
  };
  const stages = [start];
  let cur = start;
  let lastMutateNode = null;

  /** One row per group, replacing the rows of the table (summarise, count). */
  const collapse = (data, valueCols, valuesOf, kind, verb) => {
    const k = stages.length;
    const into = new Map();
    const nextText = new Map();
    const groupOf = new Map();
    const keys = data.groups.map((g, gi) => {
      const key = `g${k}_${gi}`;
      rows.set(key, { num: gi + 1 });
      const cells = {};
      data.by.forEach((name, b) => { cells[name] = g.labels[b]; });
      valueCols.forEach((name) => { cells[name] = valuesOf(g, name); });
      nextText.set(key, cells);
      groupOf.set(key, gi);
      for (const i of g.rows) into.set(cur.rows[i], key);
      return key;
    });
    for (const name of valueCols) {
      if (!cols.has(name)) cols.set(name, { name, type: 'double' });
    }
    return {
      kind, verb, cols: [...data.by, ...valueCols], rows: keys, text: nextText, groupOf, into, fresh: valueCols,
      facts: { groups: data.groups.length, by: data.by.join(', ') },
    };
  };

  for (const ev of events) {
    const d = ev.data;
    let next = null;
    if (ev.type === EV.DPLYR_FILTER) {
      next = { ...cur, kind: 'filter', verb: 'filter', rows: d.rows.map((i) => cur.rows[i]), into: null, fresh: [],
        facts: { kept: d.kept, total: d.total } };
    } else if (ev.type === EV.DPLYR_SELECT && !d.renamed && !d.pulled) {
      next = { ...cur, kind: 'select', verb: 'select', cols: [...d.keptNames], into: null, fresh: [],
        facts: { kept: d.keptNames.length, total: d.allNames.length } };
    } else if (ev.type === EV.DPLYR_MUTATE) {
      const nextText = new Map(cur.text);
      cur.rows.forEach((key, i) => nextText.set(key, { ...nextText.get(key), [d.name]: cellText(d.values[i], d.type) }));
      cols.set(d.name, { name: d.name, type: d.type });
      // One mutate() call making several columns is one stage, not several.
      const merged = lastMutateNode === d.node;
      if (merged) stages.pop();
      const fresh = merged ? [...cur.fresh, d.name] : [d.name];
      next = { ...cur, kind: 'mutate', verb: 'mutate', cols: cur.cols.includes(d.name) ? [...cur.cols] : [...cur.cols, d.name],
        text: nextText, into: null, fresh, facts: { names: fresh.join(', ') } };
      lastMutateNode = d.node;
    } else if (ev.type === EV.DPLYR_ARRANGE) {
      next = { ...cur, kind: 'arrange', verb: 'arrange', rows: d.order.map((i) => cur.rows[i]), into: null, fresh: [],
        facts: { by: d.by.map((b) => b.name).join(', ') } };
    } else if (ev.type === EV.DPLYR_GROUP && d.counting) {
      next = collapse(d, ['n'], (g) => String(g.size), 'count', 'count');
      cols.set('n', { name: 'n', type: 'integer' });
    } else if (ev.type === EV.DPLYR_GROUP) {
      const groupOf = new Map();
      d.groups.forEach((g, gi) => g.rows.forEach((i) => groupOf.set(cur.rows[i], gi)));
      next = { ...cur, kind: 'group', verb: 'group_by', rows: d.groups.flatMap((g) => g.rows.map((i) => cur.rows[i])), groupOf,
        into: null, fresh: [], facts: { groups: d.count, by: d.by.join(', ') } };
    } else if (ev.type === EV.DPLYR_SUMMARISE) {
      next = collapse(d, d.columns, (g, name) => cellText(g.results.find((r) => r.name === name)?.value, 'double'), 'summarise', 'summarise');
    }
    if (!next) continue;
    if (ev.type !== EV.DPLYR_MUTATE) lastMutateNode = null;
    // Grouping colours stay on the rows until they are collapsed.
    if (!next.groupOf && cur.groupOf && next.kind !== 'summarise' && next.kind !== 'count') next.groupOf = cur.groupOf;
    stages.push(next);
    cur = next;
  }
  if (stages.length < 2) throw new Error('picture.code changes nothing a picture could show');
  return { cols, rows, stages };
}

/** The word on a stage's button: "przed", then "po" for one verb, or what each verb does. */
function stageLabel(stage, stages) {
  if (stage.kind === 'before') return t('ba.before');
  if (stages.length === 2) return t('ba.after');
  return t(`ba.step.${stage.kind}`);
}

/**
 * @param {Object} picture  {kind: 'verb', question, code}
 * @param {string} setup    the lesson's setup code
 * @returns {{left, stage, show(k), play(), destroy(), playing(), stages}}
 */
export function renderBeforeAfter(picture, setup) {
  const model = verbStages(setup, picture);
  const { stages } = model;
  const colNames = [...model.cols.keys()];
  // Width of a column in characters: its name, its type word and its widest value.
  const widthOf = new Map(colNames.map((name) => {
    const texts = stages.flatMap((s) => [...s.text.values()].map((cells) => cells[name] ?? ''));
    const typeWord = t(`badge.${model.cols.get(name).type}`);
    return [name, Math.max(name.length, typeWord.length * 0.8, ...texts.map((x) => x.length)) + 2.4];
  }));

  let at = 0;
  let timer = null;
  const left = el('div.sv.ba-side');
  const slot = el('div.lv-slot');
  const caption = el('div.st-caption');

  // --- the one table: every header, row and cell exists once ---
  const heads = new Map(colNames.map((name) => [name, el('div.ba-head', { dataset: { type: model.cols.get(name).type } },
    el('div.ba-head-name', name), el('div.ba-head-type', t(`badge.${model.cols.get(name).type}`)))]));
  const rowEls = new Map();
  const cellEls = new Map();
  for (const [key, info] of model.rows) {
    const cells = new Map(colNames.map((name) => [name, el('div.ba-cell', { dataset: { type: model.cols.get(name).type } })]));
    cellEls.set(key, cells);
    rowEls.set(key, el('div.ba-row', { dataset: { key } }, el('div.ba-num', String(info.num)), [...cells.values()]));
  }
  const table = el('div.ba-table', el('div.ba-row.ba-header', el('div.ba-num', ''), [...heads.values()]), [...rowEls.values()]);
  const stage = el('div.st.ba-stage', el('div.st-pic', table), caption);

  const stop = () => { if (timer) { clearTimeout(timer); timer = null; } };

  function show(k) {
    at = Math.max(0, Math.min(k, stages.length - 1));
    const s = stages[at];
    const prev = stages[at - 1];

    // columns: where each one stands in this stage, or gone
    const leftOf = new Map();
    let x = NUM_W;
    for (const name of s.cols) { leftOf.set(name, x); x += widthOf.get(name); }
    const place = (node, name) => {
      const on = leftOf.has(name);
      node.style.width = `${widthOf.get(name)}ch`;
      if (on) node.style.left = `${leftOf.get(name)}ch`;
      node.classList.toggle('ba-off', !on);
      node.classList.toggle('ba-fresh', on && s.fresh.includes(name));
    };
    for (const [name, node] of heads) place(node, name);

    // rows: a place in this stage, or folded into the row that replaced them, or gone
    const topOf = new Map(s.rows.map((key, i) => [key, (i + 1) * ROW_H]));
    for (const [key, node] of rowEls) {
      const on = topOf.has(key);
      const target = !on && s.into?.get(key);
      if (on) node.style.top = `${topOf.get(key)}px`;
      else if (target) node.style.top = `${topOf.get(target)}px`;
      else if (!node.style.top) node.style.top = `${ROW_H}px`;
      node.classList.toggle('ba-off', !on);
      const g = s.groupOf?.get(key);
      for (let c = 0; c < GROUP_COLOURS; c++) node.classList.toggle(`tv-g${c}`, g != null && g % GROUP_COLOURS === c);
      node.classList.toggle('ba-grouped', g != null);
      const cells = s.text.get(key) || prev?.text.get(key) || {};
      for (const [name, cell] of cellEls.get(key)) {
        if (cells[name] !== undefined && cell.textContent !== cells[name]) cell.textContent = cells[name];
        place(cell, name);
      }
    }
    table.style.width = `${x}ch`;
    table.style.height = `${(s.rows.length + 1) * ROW_H}px`;
    table.dataset.stage = s.kind;
    caption.textContent = t(`ba.cap.${s.kind}`, s.facts);
    drawSide();
  }

  /** The opening animation: from "przed" through every stage, once. */
  function play() {
    stop();
    show(0);
    const step = () => {
      if (at >= stages.length - 1) { timer = null; return; }
      show(at + 1);
      timer = setTimeout(step, STEP_MS);
    };
    timer = setTimeout(step, STEP_MS * 0.7);
  }

  function drawSide() {
    mount(left,
      el('div.sv-card',
        el('div.sv-kicker', t('ba.kicker')),
        el('div.sv-question', picture.question),
        el('div.ba-steps', stages.map((s, k) => el('button', {
          type: 'button',
          class: ['ba-step', k === at ? 'sv-on' : ''].filter(Boolean).join(' '),
          'aria-pressed': k === at ? 'true' : 'false',
          onClick: () => { stop(); show(k); },
        }, stageLabel(s, stages))),
        el('button.ba-replay', { type: 'button', title: t('ba.replay'), 'aria-label': t('ba.replay'), onClick: () => play() }, '▶'))),
      el('p.sv-hint', t(stages.length === 2 ? 'ba.hint' : 'ba.hintSteps')),
      slot);
  }

  show(0);
  return { left, stage, show: (k) => { stop(); show(k); }, play, destroy: stop, playing: () => timer != null, stages };
}

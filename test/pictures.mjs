/**
 * The picture sweep: every sub-expression of every lesson, drawn headlessly.
 *
 * The code is the interface (decision D10), so any piece of any lesson can end up on
 * the stage -- including pieces nobody thought to click while writing the lesson.
 * This walks all of them: every scene, the sandbox, every chip, the solution and
 * every anticipated wrong answer; for each, every entry of the evaluation log goes
 * through describeEntry() and renderStage(). It fails when a picture throws, or when a
 * caption would show the student a raw key or an unfilled {placeholder}.
 */

import { installDom } from './dom-shim.mjs';
installDom();

const { LESSONS } = await import('../src/lessons/index.js');
const { withKeep } = await import('../src/lessons/schema.js');
const { RSession } = await import('../src/core/session.js');
const { describeEntry, renderStage, stopStage } = await import('../src/ui/viz/focus.js');
const { renderMemory } = await import('../src/ui/viz/memory.js');
const { renderValue, renderMini, renderThumb } = await import('../src/ui/viz/value.js');
const { highlightCode } = await import('../src/ui/codebox.js');
const { isDataFrame } = await import('../src/core/rvalue.js');

let pictures = 0;
const failures = [];
const RAW_KEY = /\b(fx|ls|lv|ui|val|tv|rx|op|co|mem|badge|module|type|err|diag|warn|env|tok|sv|ba)\.[a-zA-Z][\w.]*/;

function sweep(label, setup, code, { pick = null, show = null } = {}) {
  const session = new RSession();
  if (setup) session.run(setup, { trace: false });
  const r = session.run(code);
  const base = { trace: r.trace, log: r.evalLog, source: code, onSelect() {}, still: true };
  const picked = pick && show ? r.evalLog?.findByText(code, pick) : null;
  for (const entry of r.evalLog?.entries || []) {
    const where = `${label} :: ${JSON.stringify(code.slice(entry.node.span.start, entry.node.span.end)).slice(0, 60)}`;
    // A scene's pointer is drawn on its picked expression, as LiveCode does.
    const ctx = entry === picked ? { ...base, show } : base;
    try {
      const d = describeEntry(entry, ctx);
      const stage = renderStage(entry, ctx);
      pictures++;
      const text = `${d.caption} ${stage.textContent}`;
      if (!d.pic) failures.push(`${where}: no picture`);
      const raw = text.match(RAW_KEY);
      if (raw) failures.push(`${where}: raw key "${raw[0]}" in "${text.slice(0, 120)}"`);
      const hole = text.match(/\{[a-zA-Z]+(\|[^}]*)?\}/);
      if (hole) failures.push(`${where}: unfilled placeholder "${hole[0]}"`);
      if (/undefined|NaN|\[object Object\]/.test(d.caption)) failures.push(`${where}: caption "${d.caption}"`);
    } catch (e) {
      failures.push(`${where}: threw ${e.stack?.split('\n').slice(0, 2).join(' | ')}`);
    }
  }
  try {
    renderMemory(r.env, {});
    for (const root of r.evalLog?.roots() || []) {
      if (root.error) continue;
      renderValue(root.value);
      renderMini(root.value);
      if (root.value && isDataFrame(root.value)) renderThumb(root.value);
    }
    highlightCode(code);
  } catch (e) {
    failures.push(`${label}: memory/values threw ${e.message}`);
  }
  stopStage();
}

for (const l of LESSONS) {
  l.scenes.forEach((s, i) => { if (s.code) sweep(`${l.id} scene ${i + 1}`, l.setup, s.code, { pick: s.pick, show: s.show }); });
  sweep(`${l.id} sandbox`, l.setup, withKeep(l.play, l.play.code));
  l.play.chips.forEach((c, i) => sweep(`${l.id} chip ${i + 1}`, l.setup, withKeep(l.play, c)));
  sweep(`${l.id} solution`, l.setup, l.task.solution);
  (l.task.nearMisses || []).forEach((nm) => sweep(`${l.id} near-miss "${nm.name}"`, l.setup, nm.code));
  // The task for those who want more (D41) is typed into the same box.
  if (l.extra) {
    sweep(`${l.id} extra solution`, l.setup, l.extra.solution);
    (l.extra.nearMisses || []).forEach((nm) => sweep(`${l.id} extra near-miss "${nm.name}"`, l.setup, nm.code));
  }
}

// Things students type that no lesson contains: the pictures must hold up there too.
const EXTRA = [
  'x <- 1:6\ny <- x + c(10, 20)', 'c(TRUE, 1L, 2.5)', 'x <- c(1, 2)\nx[5] <- 9\nx', 'rev(1:4)',
  'sort(c(3, 1, NA, 2))', 'round(c(1.234, 5.678), 1)', 'nchar(c("ala", "kot"))', '"a" %in% c("a", "b")',
  'f <- function(x) x * 2\nf(1:3)', 'l <- list(a = 1, b = "x")\nl$b\nl[["a"]]', 'ifelse(c(1, 5) > 3, "duzo", "malo")',
  'd <- data.frame(a = 1:3, b = c("x", "y", "x"))\nd[d$a > 1, "b"]', 'median(c(5, 1, 3))', 'max(c(2, 9, 4))',
  'paste("a", 1:3)', 'unique(c(1, 1, 2))', 'toupper("abc")', 'str_detect(c("Kraków", "Gdańsk"), "ń")',
  'typeof(1L)', 'class(factor("a"))', 'nlevels(factor(c("a", "b")))', 'table(c("a", "b", "a", NA))',
  'x <- c(a = 1, b = 2)\nx["b"]', 'seq(1, 10, by = 3)', 'NA > 1', 'TRUE && FALSE', '-c(1, 2)', '!c(TRUE, FALSE)',
  'mean(nie_ma)', 'sum(1:4) / length(1:4)', 'sqrt(16)',
];
EXTRA.forEach((code, i) => sweep(`extra ${i + 1}`, '', code));

// A scene pointer must actually reach its picture: the factors lesson's first scene
// promises a hollow row for the answer nobody chose.
{
  const l = LESSONS.find((x) => x.id === 'factors');
  const scene = l?.scenes.find((x) => x.show?.absent);
  if (scene) {
    const s = new RSession();
    s.run(l.setup, { trace: false });
    const r = s.run(scene.code);
    const entry = r.evalLog.findByText(scene.code, scene.pick);
    const d = describeEntry(entry, { trace: r.trace, log: r.evalLog, source: scene.code, still: true, show: scene.show });
    if (!d.caption.includes(scene.show.absent.join(', ')) || !/brak/.test(d.pic.textContent)) {
      failures.push(`factors scene with show.absent: caption "${d.caption}", picture "${d.pic.textContent.slice(0, 60)}"`);
    }
    stopStage();
  }
}

// Every "W arkuszu" panel a scene asks for must be drawn: a null panel would leave
// the sentence talking about a spreadsheet nobody sees.
for (const l of LESSONS) {
  l.scenes.forEach((scene, i) => {
    if (!scene.show?.excel) return;
    const s = new RSession();
    s.run(l.setup, { trace: false });
    const r = s.run(scene.code);
    const entry = r.evalLog.findByText(scene.code, scene.pick);
    const d = describeEntry(entry, { trace: r.trace, log: r.evalLog, source: scene.code, still: true, show: scene.show });
    if (!/pic-vs/.test(d.pic?.className || '')) failures.push(`${l.id} scene ${i + 1}: show.excel drew no spreadsheet panel`);
    // Animated pictures replace themselves frame by frame: every frame must keep it.
    for (let k = 1; d.frame && k <= (d.frames || 0); k++) {
      if (!/pic-vs/.test(d.frame(k)?.className || '')) { failures.push(`${l.id} scene ${i + 1}: frame ${k} lost the spreadsheet panel`); break; }
    }
    stopStage();
  });
}

// Scenes without code (D27): the survey and its factor. Every person and every answer
// is pointed at in turn; the two sides must light the same thing, and the caption
// must be a sentence.
const { renderSurvey, surveyData } = await import('../src/ui/viz/survey.js');
const byClass = (node, cls, out = []) => {
  if (String(node?.className || '').split(' ').includes(cls)) out.push(node);
  for (const c of node?.childNodes || []) byClass(c, cls, out);
  return out;
};
let surveys = 0;
const captionOf = (v) => byClass(v.stage, 'st-caption')[0]?.textContent || '';
for (const l of LESSONS) {
  l.scenes.forEach((scene, i) => {
    if (!scene.picture || scene.picture.kind === 'verb') return;
    const where = `${l.id} scene ${i + 1} (${scene.picture.kind})`;
    try {
      const d = surveyData(l.setup, scene.picture);
      const v = renderSurvey(scene.picture, l.setup);
      const points = [...d.codes.map((_, person) => ({ person })), ...d.levels.map((_, k) => ({ level: k + 1 }))];
      for (const sel of points) {
        v.select(sel);
        surveys++;
        const text = captionOf(v);
        const tag = `${where} ${JSON.stringify(sel)}`;
        if (!text) failures.push(`${tag}: no caption`);
        if (RAW_KEY.test(text) || /\{[a-z]+\}|undefined|NaN/.test(text)) failures.push(`${tag}: caption shows "${text}"`);
        // The person pointed at is lit on the left; their answer is lit on the stage.
        const level = sel.level ?? d.codes[sel.person];
        const litPeople = byClass(v.left, 'sv-person').filter((b) => String(b.className).includes('sv-on')).length;
        const wantPeople = sel.person != null ? 1 : d.counts[level - 1];
        if (litPeople !== wantPeople) failures.push(`${tag}: ${litPeople} people lit, expected ${wantPeople}`);
        if (level != null && !text.includes(d.levels[level - 1])) failures.push(`${tag}: caption does not name "${d.levels[level - 1]}": ${text}`);
        if (!byClass(v.stage, 'sv-on').length) failures.push(`${tag}: nothing lit on the stage`);
      }
    } catch (e) {
      failures.push(`${where}: threw ${e.message}`);
    }
  });
}

// What the three factor lessons promise in their first sentences, read off the pictures.
{
  const scene = (id, k) => { const l = LESSONS.find((x) => x.id === id); return [l.scenes[k].picture, l.setup]; };
  const claim = (name, ok, got) => { if (!ok) failures.push(`${name}: ${got}`); };
  let v = renderSurvey(...scene('factors', 0));
  v.select({ person: 2 });
  claim('factors: person 3 chose "źle", the sheet keeps code 2', /„źle”.*2/.test(captionOf(v)), captionOf(v));
  v.select({ level: 1 });
  claim('factors: nobody chose "bardzo źle"', /Nikt/.test(captionOf(v)), captionOf(v));
  v = renderSurvey(...scene('factors', 1));
  claim('factors: the factor is drawn as label and code per person', byClass(v.stage, 'sv-pairs').length === 1
    && byClass(v.stage, 'sv-levels').length === 1, 'pairs table or levels table missing');
  const d = surveyData(...scene('levels', 0).reverse());
  claim('levels: text counts alphabetically, the factor by the scale',
    d.alpha.map((r) => r.label).join() === 'czasem,często,nigdy,rzadko' && d.levels.join() === 'nigdy,rzadko,czasem,często,zawsze',
    `${d.alpha.map((r) => r.label)} / ${d.levels}`);
  claim('levels: "zawsze" is a level nobody chose', d.counts[4] === 0, d.counts);
  // The typo scene: a value outside the levels is named as lost, not just drawn as NA.
  {
    const l = LESSONS.find((x) => x.id === 'levels');
    const sc = l.scenes[4];
    const s2 = new RSession();
    s2.run(l.setup, { trace: false });
    const r = s2.run(sc.code);
    const entry = r.evalLog.entries.filter((e) => /^factor\(/.test(sc.code.slice(e.node.span.start, e.node.span.end))).pop();
    const dd = describeEntry(entry, { trace: r.trace, log: r.evalLog, source: sc.code, still: true });
    claim('levels: a value outside the levels is captioned as lost to NA', /Poza levels: 1 wartość/.test(dd.caption) && dd.tone === 'trap', `${dd.caption} / ${dd.tone}`);
  }
  // Why `levels` exists: without it the stage says where the levels came from.
  {
    const l = LESSONS.find((x) => x.id === 'factors');
    const at = (code) => {
      const s2 = new RSession();
      s2.run(l.setup, { trace: false });
      const r = s2.run(code);
      const entry = r.evalLog.entries.filter((e) => /^factor\(/.test(code.slice(e.node.span.start, e.node.span.end))).pop();
      return describeEntry(entry, { trace: r.trace, log: r.evalLog, source: code, still: true });
    };
    const guess = at('factor(odpowiedzi)');
    claim('factors: without levels the caption names the levels taken from the data',
      /Poziomy to: 2, 3, 4, 5/.test(guess.caption) && /„2” ma kod 1/.test(guess.caption) && guess.tone === 'trap', `${guess.caption} / ${guess.tone}`);
    const declared = at('factor(odpowiedzi, levels = 1:5)');
    claim('factors: with levels declared nothing is called a guess', !/Bez levels/.test(declared.caption) && declared.tone !== 'trap', declared.caption);
    const plain = at('factor(c(1, 2, 1))');
    claim('a factor whose values are already 1..k is not flagged', plain.tone !== 'trap', plain.caption);
  }
  v = renderSurvey(...scene('factor-numbers', 0));
  v.select({ person: 3 });
  claim('factor-numbers: under "5" lies code 4', /„5”.*4/.test(captionOf(v)), captionOf(v));
  // The factor's own table: every person has both a label and a code, side by side.
  const table = byClass(v.stage, 'sv-pairs')[0];
  const cells = (cls) => byClass(table, cls).map((c) => c.textContent);
  claim('factor-numbers: label and code stand side by side for each person',
    cells('sv-labelcell').join() === '2,0,1,5,0,2,1,0' && cells('sv-codecell').join() === '3,1,2,4,1,3,2,1',
    `${cells('sv-labelcell')} / ${cells('sv-codecell')}`);
}

// Tables before and after their verbs (D29). Every stage of every picture is shown; the
// last stage must be the table R actually returns, row for row and cell for cell.
const { renderBeforeAfter, verbStages, freshRight } = await import('../src/ui/viz/before-after.js');
const { formatScalar } = await import('../src/core/format.js');
const { getNames, isFactor, getAttr, isNA } = await import('../src/core/rvalue.js');
let verbPictures = 0;
for (const l of LESSONS) {
  l.scenes.forEach((scene, i) => {
    if (scene.picture?.kind !== 'verb') return;
    const where = `${l.id} scene ${i + 1} (verb)`;
    try {
      const v = renderBeforeAfter(scene.picture, l.setup);
      v.stages.forEach((st, k) => {
        v.show(k);
        verbPictures++;
        const text = captionOf(v);
        if (!text || RAW_KEY.test(text) || /\{[a-z]+\}|undefined|NaN/.test(text)) failures.push(`${where} stage ${k}: caption "${text}"`);
        const shown = byClass(v.stage, 'ba-row').filter((r) => !String(r.className).includes('ba-off') && !String(r.className).includes('ba-header'));
        if (shown.length !== st.rows.length) failures.push(`${where} stage ${k}: ${shown.length} rows shown, the stage has ${st.rows.length}`);
        const pressed = byClass(v.left, 'ba-step').filter((b) => String(b.className).includes('sv-on')).length;
        if (pressed !== 1) failures.push(`${where} stage ${k}: ${pressed} step buttons lit`);
      });
      // The last stage against R's own answer.
      const s = new RSession({ trace: false });
      s.run(l.setup);
      const out = s.run(scene.picture.code).value;
      const names = getNames(out).values.map(String);
      const last = v.stages[v.stages.length - 1];
      if (last.cols.join() !== names.join()) failures.push(`${where}: last stage has columns ${last.cols}, R gives ${names}`);
      const cellOf = (col, r) => {
        const x = col.values[r];
        if (isNA(x)) return 'NA';
        return isFactor(col) ? String(getAttr(col, 'levels').values[x - 1]) : formatScalar(x, col.type);
      };
      const want = out.values[0].values.map((_, r) => names.map((_, c) => cellOf(out.values[c], r)).join('|'));
      const got = last.rows.map((key) => last.cols.map((c) => last.text.get(key)[c]).join('|'));
      if (want.join(';') !== got.join(';')) failures.push(`${where}: the last stage is not R's result:\n    picture ${got.join(' ; ')}\n    R       ${want.join(' ; ')}`);
      v.destroy();
    } catch (e) {
      failures.push(`${where}: threw ${e.message}`);
    }
  });
}

// What the opening pictures of the verb lessons promise, read off their stages.
{
  const stagesOf = (id) => { const l = LESSONS.find((x) => x.id === id); return verbStages(l.setup, l.scenes[0].picture).stages; };
  const claim = (name, ok, got) => { if (!ok) failures.push(`${name}: ${got}`); };
  let st = stagesOf('filtering');
  claim('filtering: three rows stay, and they are the same rows as before', st[1].rows.join() === 'r2,r4,r7', st[1].rows);
  st = stagesOf('arranging');
  claim('arranging: every row is kept and only the order changes', [...st[1].rows].sort().join() === [...st[0].rows].sort().join()
    && st[1].rows.join() !== st[0].rows.join(), st[1].rows);
  st = stagesOf('selecting');
  claim('selecting: columns leave, in the order asked for', st[1].cols.join() === 'wiek,plec' && st[1].rows.length === st[0].rows.length, st[1].cols);
  st = stagesOf('mutating');
  claim('mutating: one column joins and is marked as new', st[1].cols.length === st[0].cols.length + 1 && st[1].fresh.join() === 'ocena_pct', st[1].fresh);
  // A narrow frame scrolls to the new column (D31): its right edge is the table's.
  const w = new Map(st[1].cols.map((name) => [name, 10]));
  claim('mutating: the frame is sent to the new column, and home again before it', freshRight(st[1], w) === 3.5 + 10 * st[1].cols.length
    && freshRight(st[0], w) === 0, [freshRight(st[0], w), freshRight(st[1], w)]);
  st = stagesOf('grouping');
  claim('grouping: rows gather into groups, then every row folds into its group', st.map((s) => s.kind).join() === 'before,group,summarise'
    && st[2].rows.length === 3 && st[2].into.size === 10, st.map((s) => s.kind));
  st = stagesOf('pipeline');
  claim('pipeline: one stage per verb, in the order written', st.map((s) => s.kind).join() === 'before,filter,group,summarise,arrange', st.map((s) => s.kind));
}

// if_else() and case_when() (D34): who took each row, and what went unnoticed.
{
  const { recodeTraps } = await import('../src/ui/viz/focus.js');
  const { cellState } = await import('../src/ui/viz/recode.js');
  const { EV } = await import('../src/trace/events.js');
  const { NA: NA_VALUE } = await import('../src/core/rvalue.js');
  const claim = (name, ok, got) => { if (!ok) failures.push(`${name}: ${JSON.stringify(got)}`); };
  const lesson = LESSONS.find((l) => l.id === 'recoding');
  const eventOf = (code) => {
    const s = new RSession();
    s.run(lesson.setup, { trace: false });
    return s.run(code).trace.events.filter((e) => e.type === EV.RECODE).pop()?.data;
  };
  const [, two, , three, swapped, rest] = lesson.scenes.map((sc) => (sc.code ? eventOf(sc.code) : null));
  claim('recoding: if_else takes TRUE, leaves FALSE to the other value, and NA to nobody',
    two.took.join() === 'rest,rest,0,rest,0,none,0,rest' && recodeTraps(two).none === 1, two.took);
  claim('recoding: each row goes to the first condition that is TRUE', three.took.join() === '0,1,1,0,2,none,2,1'
    && recodeTraps(three).shadowed === -1, three.took);
  claim('recoding: a wide condition placed first leaves the narrow one with nobody', swapped.took.join() === '0,0,0,0,2,none,2,0'
    && recodeTraps(swapped).shadowed === 1, [swapped.took, recodeTraps(swapped)]);
  claim('recoding: .default also takes the person who gave no age', rest.took[5] === 'rest' && rest.values[5] === '50+'
    && recodeTraps(rest).swept === 1 && recodeTraps(rest).none === 0, [rest.took, recodeTraps(rest)]);
  claim('recoding: conditions after the one that took the row are not shown as checked',
    [cellState(true, 0, 0), cellState(true, 1, 0), cellState(false, 0, 1), cellState(NA_VALUE, 0, 'none')].join() === 'hit,skip,miss,na',
    [cellState(true, 0, 0), cellState(true, 1, 0), cellState(false, 0, 1)]);
}

// Joins (D40): which row met which, and what the caption warns about.
{
  const { joinCaption } = await import('../src/ui/viz/focus.js');
  const { renderJoin } = await import('../src/ui/viz/table-ops.js');
  const { EV } = await import('../src/trace/events.js');
  const { t: tr } = await import('../src/i18n/index.js');
  const claim = (name, ok, got) => { if (!ok) failures.push(`${name}: ${JSON.stringify(got)}`); };
  const lesson = LESSONS.find((l) => l.id === 'joining');
  const eventOf = (code) => {
    const s = new RSession();
    s.run(lesson.setup, { trace: false });
    return s.run(code).trace.events.filter((e) => e.type === EV.JOIN).pop();
  };
  const [, joined, , , inner, doubled] = lesson.scenes.map((sc) => eventOf(sc.code));
  const anti = eventOf(lesson.play.code);
  const full = eventOf(lesson.play.chips[1]);
  const text = (ev) => joinCaption(ev.data);
  const rowsOf = (ev, cls) => byClass(renderJoin(ev), cls).length;

  let d = joined.data;
  claim('joining: every left row is in the result once, in its own order', d.from.map(([i]) => i).join() === '0,1,2,3,4,5', d.from);
  claim('joining: the person from Radom has no partner and stays', d.unmatchedX.join() === '5' && d.from[5][1] === null && d.rowsOut === 6, d.unmatchedX);
  claim('joining: Poznań is in the right table only and does not come along', d.unmatchedY.join() === '3' && d.yGroup[3] === null, d.unmatchedY);
  claim('joining: partners wear one colour', d.xGroup.slice(0, 5).join() === '0,1,0,2,1' && d.yGroup.slice(0, 3).join() === '0,1,2', [d.xGroup, d.yGroup]);
  claim('joining: the caption names the row without a partner, as a trap',
    text(joined).tone === 'trap' && text(joined).caption.startsWith(tr('fx.join.na', { n: 1 })) && text(joined).caption.includes(tr('fx.join.unusedY', { n: 1 })), text(joined));
  // In the picture: one flagged row on the left, one in the result, one struck out on the right.
  claim('joining: the picture flags the row that stays empty and strikes the one left behind',
    rowsOf(joined, 'tv-miss') === 2 && rowsOf(joined, 'tv-drop') === 1, [rowsOf(joined, 'tv-miss'), rowsOf(joined, 'tv-drop')]);

  d = inner.data;
  claim('joining: inner_join loses the person and the caption counts it', d.rowsOut === 5 && text(inner).tone === 'trap'
    && text(inner).caption.includes(tr('fx.join.lost', { n: 1, fname: 'inner_join', rows: 6, out: 5 })), text(inner));
  claim('joining: the lost row is struck out on the left', rowsOf(inner, 'tv-drop') === 2 && rowsOf(inner, 'tv-miss') === 0, rowsOf(inner, 'tv-drop'));

  d = doubled.data;
  claim('joining: a key listed twice gives each of its people twice', d.rowsOut === 8 && d.multiplied === 2 && d.many
    && d.from.filter(([i]) => i === 0).length === 2, d.from);
  claim('joining: the caption leads with the multiplied rows', text(doubled).tone === 'trap'
    && text(doubled).caption.startsWith(tr('fx.join.multiplied', { rows: 6, out: 8 })), text(doubled));

  claim('joining: anti_join keeps the rows without a partner and draws no result table', anti.data.rowsOut === 1
    && rowsOf(anti, 'tv-keep') === 1 && rowsOf(anti, 'tv-table-wrap') === 2 && text(anti).tone === null, text(anti));
  claim('joining: full_join brings the unmatched right row in', full.data.rowsOut === 7 && full.data.from[6][0] === null
    && text(full).caption.includes(tr('fx.join.extraY', { n: 1 })), text(full));
}

// The task's goal-vs-answer picture, for the solution and every anticipated wrong
// answer: the student sees this one on every keystroke of the task.
const { renderCompare } = await import('../src/ui/viz/pictures.js');
let compares = 0;
for (const [l, task] of LESSONS.flatMap((x) => [[x, x.task], ...(x.extra ? [[x, x.extra]] : [])])) {
  const goalRun = new RSession({ trace: false });
  goalRun.run(l.setup);
  const goal = goalRun.run(task.solution).value;
  for (const code of [task.solution, ...(task.nearMisses || []).map((nm) => nm.code)]) {
    const s = new RSession({ trace: false });
    s.run(l.setup);
    const run = s.run(code);
    try {
      const pic = renderCompare(goal, run.ok ? run.value : undefined, { goalLabel: 'Cel', mineLabel: 'Twój wynik' });
      compares++;
      if (/undefined|NaN|\[object Object\]/.test(pic.textContent)) failures.push(`${l.id} compare ${JSON.stringify(code).slice(0, 50)}: "${pic.textContent.slice(0, 80)}"`);
    } catch (e) {
      failures.push(`${l.id} compare ${JSON.stringify(code).slice(0, 50)}: threw ${e.message}`);
    }
  }
}

console.log(`pictures: ${pictures} sub-expressions drawn, ${surveys} survey pictures, ${verbPictures} table stages, ${compares} goal comparisons, ${failures.length} problem(s)`);
for (const f of failures.slice(0, 40)) console.log(`  FAIL  ${f}`);
process.exit(failures.length ? 1 : 0);

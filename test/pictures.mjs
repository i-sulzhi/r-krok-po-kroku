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
const RAW_KEY = /\b(fx|ls|lv|ui|val|tv|rx|op|co|mem|badge|module|type|err|diag|warn|env|tok|sv|ba|gp)\.[a-zA-Z][\w.]*/;

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
  // pivot_wider() (D57): five long rows fly into three wide ones; the missing pair is NA.
  {
    const lesson = LESSONS.find((l) => l.id === 'crosstab');
    const m = verbStages(lesson.setup, lesson.scenes[0].picture);
    const last = m.stages[m.stages.length - 1];
    const prev = m.stages[m.stages.length - 2];
    const warszawa = [...last.text.values()].find((cells) => cells.miasto === 'Warszawa');
    const into = new Set(prev.rows.map((k) => last.into.get(k)));
    claim('crosstab: count, then the cross table with its gap as NA', m.stages.map((s) => s.kind).join() === 'before,count,pivotGap'
      && last.cols.join() === 'miasto,K,M' && last.rows.length === 3 && warszawa?.M === 'NA' && into.size === 3 && !into.has(undefined),
      [m.stages.map((s) => s.kind), last.cols, warszawa]);
  }
  // Joins (D60): the left rows keep their places and get the region; Radom keeps NA.
  {
    const l = LESSONS.find((x) => x.id === 'joining');
    const st3 = verbStages(l.setup, l.scenes[0].picture).stages;
    const j = st3[1];
    const radom = j.text.get('r5');
    claim('joining: the picture adds the region to the same rows, NA for Radom', st3.map((x) => x.kind).join() === 'before,joinNA,group,summarise'
      && j.rows.join() === 'r0,r1,r2,r3,r4,r5' && j.fresh.join() === 'region' && radom?.region === 'NA', [st3.map((x) => x.kind), j.rows, radom]);
    const many = verbStages(l.setup, { code: 'ankieta |> left_join(uczelnie, by = "miasto")' }).stages[1];
    claim('joining: a repeated key makes copies, born where their row stood', many.kind === 'joinMany' && many.rows.length === 8
      && [...many.born.values()].join() === 'r0,r2', [many.kind, many.rows.length, [...many.born.values()]]);
    const inner = verbStages(l.setup, { code: 'ankieta |> inner_join(miasta, by = "miasto")' }).stages[1];
    claim('joining: an inner join drops the row with no partner', inner.kind === 'joinLost' && inner.rows.length === 5 && !inner.rows.includes('r5'), [inner.kind, inner.rows]);
  }
  // pivot_longer() (D58): six people split into 18 answers, three from each row.
  {
    const st2 = stagesOf('battery');
    const long = st2.find((x) => x.kind === 'pivotLonger');
    const born = long ? [...long.born.values()] : [];
    const perSource = new Map();
    born.forEach((src) => perSource.set(src, (perSource.get(src) || 0) + 1));
    claim('battery: rows split into answers, then fold into one mean per question',
      st2.map((x) => x.kind).join() === 'before,pivotLonger,group,summarise' && long.rows.length === 18
      && perSource.size === 6 && [...perSource.values()].every((k) => k === 3) && long.cols.join() === 'id,plec,pytanie,odpowiedz'
      && st2[3].rows.length === 3, [st2.map((x) => x.kind), long?.rows.length, perSource.size]);
  }
  // A column changed in place is a change, not a new column (D65).
  st = stagesOf('missing-data');
  claim('missing-data: na_if() changes ocena in place, then the mean', st.map((x) => x.kind).join() === 'before,mutateReplaced,summarise'
    && st[1].text.get('r1').ocena === 'NA', [st.map((x) => x.kind), st[1].text.get('r1')]);
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
  const eventsOf = (code) => {
    const s = new RSession();
    s.run(lesson.setup, { trace: false });
    return s.run(code).trace.events.filter((e) => e.type === EV.RECODE).map((e) => e.data);
  };
  const eventOf = (code) => eventsOf(code).pop();
  // By position: the question, plain `if` for one person (D52), then the four below.
  const [, , twoAll, , threeAll, swapAndFix, restAll] = lesson.scenes.map((sc) => (sc.code ? eventsOf(sc.code) : null));
  const [two, three, rest] = [twoAll, threeAll, restAll].map((list) => list.at(-1));
  // The trap scene holds the wrong order and its repair (D59): the first is the trap.
  const [swapped, fixed] = swapAndFix;
  claim('recoding: the repaired trap, a range closed on both sides, gives every group', fixed?.took.join() === '1,0,0,1,2,none,2,0'
    && recodeTraps(fixed).shadowed === -1, fixed?.took);
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

  // Plain if / else if for one value (D50): the same table with one row.
  const ifPicture = (code) => {
    const r = new RSession().run(code);
    const entry = r.evalLog.entries.filter((e) => e.node.type === 'If').find((e) => !r.evalLog.entries.some((o) => o.node.alt === e.node));
    const d = describeEntry(entry, { trace: r.trace, log: r.evalLog, source: code, onSelect() {}, still: true });
    const tags = (node, tag, out = []) => {
      if (String(node?.tagName || '').toLowerCase() === tag) out.push(node);
      for (const c of node?.childNodes || []) tags(c, tag, out);
      return out;
    };
    return { cells: tags(d.pic, 'td').map((c) => `${String(c.className).replace('rc-cell rc-', '').replace('rc-', '')}:${c.textContent}`).join(' '),
      heads: tags(d.pic, 'th').map((h) => h.textContent).join('|'), caption: d.caption };
  };
  const chain = 'wiek <- 45\nif (wiek < 30) "18-29" else\n  if (wiek < 50) "30-49" else "50+"';
  let ip = ifPicture(chain);
  claim('recoding: if/else if for one person lights the first TRUE and leaves else blank',
    ip.heads === '|wiek < 30|wiek < 50|else|wynik' && ip.cells === 'num:1 miss:FALSE hit:TRUE skip: value:"30-49"', ip);
  ip = ifPicture(chain.replace('45', '70'));
  claim('recoding: when no condition is TRUE, else gives the value',
    ip.cells === 'num:1 miss:FALSE miss:FALSE hit:reszta value:"50+"', ip);
  // `if` on a column (D51): the answers of the comparison are drawn above the error.
  {
    const code = 'wiek <- c(23, 45, 51)\nif (wiek < 30) "młody" else "starszy"';
    const r = new RSession().run(code);
    const entry = r.evalLog.entries.find((e) => e.node.type === 'If');
    const d = describeEntry(entry, { trace: r.trace, log: r.evalLog, source: code, onSelect() {}, still: true });
    claim('recoding: if on a column shows the comparison\'s answers and says why it stops',
      d.tone === 'error' && /3 odpowiedzi/.test(d.caption) && /TRUE/.test(d.pic.textContent) && /FALSE/.test(d.pic.textContent)
      && /Warunek zawiera 3/.test(d.pic.textContent), [d.caption, d.pic.textContent.slice(0, 120)]);
  }
  ip = ifPicture('wiek <- 20\nif (wiek < 30) "młody" else "starszy"');
  claim('recoding: a single if/else is one condition and else', ip.heads === '|wiek < 30|else|wynik' && ip.cells.startsWith('num:1 hit:TRUE skip:'), ip);
}

// The mean of a comparison (D61) is told as a share, not as a sum of comparisons.
{
  const code = 'oceny <- c(5, 4, 2, 3)\nmean(oceny >= 4)';
  const r = new RSession().run(code);
  const entry = r.evalLog.entries.find((e) => code.slice(e.node.span.start, e.node.span.end) === 'mean(oceny >= 4)');
  const cap = describeEntry(entry, { trace: r.trace, log: r.evalLog, source: code, onSelect() {}, still: true }).caption;
  if (!/udział TRUE: 2 z 4, czyli 0.5/.test(cap)) failures.push(`mean of a comparison is not told as a share: ${cap}`);
}

// Inside a grouped mutate() (D55): each evaluation of sum(n) names its group.
{
  const lesson = LESSONS.find((l) => l.id === 'percentages');
  const scene = lesson.scenes.find((sc) => sc.code?.includes('group_by(miasto)') && sc.tap === 'sum(n)');
  const s = new RSession();
  s.run(lesson.setup, { trace: false });
  const r = s.run(scene.code);
  const sums = r.evalLog.entries.filter((e) => scene.code.slice(e.node.span.start, e.node.span.end) === 'sum(n)');
  const caps = sums.map((e) => describeEntry(e, { trace: r.trace, log: r.evalLog, source: scene.code, onSelect() {}, still: true }).caption);
  if (caps.length !== 2 || !/Gdańsk.*4/.test(caps[0]) || !/Kraków.*6/.test(caps[1])) failures.push(`percentages: sum(n) in a grouped mutate() does not name its city: ${JSON.stringify(caps)}`);
}

// Missing data in numbers (D66): what drop_na(), complete(), na_if() and replace_na() did.
{
  const lesson = LESSONS.find((l) => l.id === 'missing-data');
  const capsOf = (code, texts) => {
    const s = new RSession(); s.run(lesson.setup, { trace: false });
    const r = s.run(code);
    return texts.map((txt) => {
      const e = r.evalLog.entries.find((x) => code.slice(x.node.span.start, x.node.span.end) === txt);
      return e ? describeEntry(e, { trace: r.trace, log: r.evalLog, source: code, onSelect() {}, still: true }).caption : '(none)';
    });
  };
  const drop = lesson.scenes.find((sc) => /drop_na\(\)/.test(sc.code || '')).code;
  const [all, one] = capsOf(drop, ['czyste |> drop_na()', 'czyste |> drop_na(ocena)']);
  if (!/usunął 4 wiersze .* Zostało: 6/.test(all) || !/drop_na\(ocena\) usunął 3 wiersze .* Zostało: 7/.test(one)) failures.push(`missing-data: drop_na() captions: ${JSON.stringify([all, one])}`);
  const comp = lesson.scenes.find((sc) => /complete\(/.test(sc.code || '')).code;
  const [c] = capsOf(comp, [comp]);
  if (!/dopisał 1 wiersz/.test(c)) failures.push(`missing-data: complete() caption: ${c}`);
  const [ni] = capsOf('ankieta$ocena |> na_if(99)', ['ankieta$ocena |> na_if(99)']);
  if (!/zamienił na NA 2 komórki z kodem 99/.test(ni)) failures.push(`missing-data: na_if() caption: ${ni}`);
  const [rn] = capsOf('replace_na(c(1, NA, NA), 0)', ['replace_na(c(1, NA, NA), 0)']);
  if (!/wpisał 0 w 2 komórki z NA/.test(rn)) failures.push(`missing-data: replace_na() caption: ${rn}`);
}

// Where a function comes from (D53): the stage names it beside the code.
{
  const pkgOn = (code, text) => {
    const r = new RSession().run(code);
    const entry = r.evalLog.entries.filter((e) => e.node.type === 'Call').find((e) => code.slice(e.node.span.start, e.node.span.end) === text);
    const stage = renderStage(entry, { trace: r.trace, log: r.evalLog, source: code, onSelect() {}, still: true });
    const tags = [];
    const walk = (n) => { if (String(n?.className || '').includes('st-pkg')) tags.push(n.textContent); for (const c of n?.childNodes || []) walk(c); };
    walk(stage);
    return tags.join();
  };
  const claim = (name, ok, got) => { if (!ok) failures.push(`${name}: ${JSON.stringify(got)}`); };
  let got = pkgOn('x <- c(1, 5)\nif_else(x > 2, "a", "b")', 'if_else(x > 2, "a", "b")');
  claim('stage: if_else() is labelled dplyr', got === 'dplyr', got);
  got = pkgOn('x <- c(1, 5)\nifelse(x > 2, "a", "b")', 'ifelse(x > 2, "a", "b")');
  claim('stage: ifelse() is labelled base R', got === 'bazowy R', got);
  got = pkgOn('d <- data.frame(x = 1:3)\nd |> mutate(y = x * 2)', 'd |> mutate(y = x * 2)');
  claim('stage: a call after |> is labelled too', got === 'dplyr', got);
  got = pkgOn('f <- function(x) x * 2\nf(3)', 'f(3)');
  claim('stage: a student\'s own function gets no package', got === '', got);
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
  // By position, after the opening picture (D60): the city table, the join, NA, means, inner, doubled.
  const [, , joined, , , inner, doubled] = lesson.scenes.map((sc) => (sc.code ? eventOf(sc.code) : null));
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

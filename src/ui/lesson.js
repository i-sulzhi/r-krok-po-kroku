/**
 * A lesson, as the student walks it: a few scenes, a sandbox, a task.
 *
 *   scene   one sentence + live code with the key expression already selected and
 *           the next thing to click pulsing. The picture on the stage does the
 *           explaining; the sentence only says where to look.
 *   play    the sandbox: code of your own, plus one-click variants to try.
 *   task    make R produce the goal shown next to the prompt; checked by result.
 *
 * Decisions worth keeping from the first version:
 * - **Hints are a chain, not an answer.** The solution unlocks only after them.
 * - **Wrong answers are diagnosed from the shape of the result** (lesson.task.diagnose),
 *   and the verdict is judged in a fresh session holding only the lesson data.
 */

import { el, mount } from './dom.js';
import { LiveCode } from './live.js';
import { RSession } from '../core/session.js';
import { renderCompare } from './viz/pictures.js';
import { highlightCode } from './codebox.js';
import { valuesEqual } from '../lessons/schema.js';
import { t } from '../i18n/index.js';
import { markup } from './markup.js';
import { renderGlossary } from './glossary.js';
import { findConcepts, firstLessons } from './concepts.js';
import { getProgress, markSeen, markDone, noteAttempt, noteHint, noteSolution, savedFold, saveFold } from './progress.js';

export { markup };

export class LessonView {
  /**
   * @param {HTMLElement} host
   * @param {Object} opts  {stage, memory, lessons, onPlace({lesson, step}), onOpen(id), onDone(lesson)}
   */
  constructor(host, opts) {
    this.host = host;
    this.opts = opts;
    this.lesson = null;
    this.step = 0;
    this.live = null;
    // Which lesson first uses each piece of syntax: the glossary opens what is new.
    this.first = firstLessons(opts.lessons);
    this.glossOpen = new Set();
    this.glossFolded = null;
    this.glossRaised = false;
  }

  open(lesson, { step = 0 } = {}) {
    this.lesson = lesson;
    this.hintsShown = getProgress(lesson.id)?.hintsUsed || 0;
    this.solutionShown = false;
    this.verdict = null;
    this.goal = computeGoal(lesson);
    this.glossOpen = new Set();
    markSeen(lesson.id);
    this.goTo(Math.max(0, Math.min(step, this.steps().length - 1)));
  }

  steps() {
    const l = this.lesson;
    return [
      ...l.scenes.map((s, i) => ({ kind: 'scene', scene: s, i })),
      { kind: 'play' },
      { kind: 'task' },
    ];
  }

  goTo(k) {
    this.step = k;
    this.verdict = null;
    this.live?.destroy();
    this.live = null;
    this.render();
    this.opts.onPlace?.({ lesson: this.lesson.id, step: k });
    this.host.scrollTop = 0;
  }

  /** A new person: drop what this view remembers about the last one. */
  forget() {
    this.glossOpen = new Set();
    this.glossFolded = null;
    this.glossRaised = false;
  }

  next() { if (this.step < this.steps().length - 1) this.goTo(this.step + 1); }
  prev() { if (this.step > 0) this.goTo(this.step - 1); }

  // --- rendering ---------------------------------------------------------------

  render() {
    const lesson = this.lesson;
    const steps = this.steps();
    const current = steps[this.step];
    const done = getProgress(lesson.id)?.status === 'done';
    const number = this.opts.lessons.indexOf(lesson) + 1;

    const dots = el('nav.ls-steps', { 'aria-label': t('ls.steps') }, steps.map((s, k) => el('button', {
      type: 'button',
      class: ['ls-dot', `ls-dot-${s.kind}`, k === this.step ? 'ls-dot-on' : '', k < this.step ? 'ls-dot-past' : '',
        s.kind === 'task' && done ? 'ls-dot-done' : ''].filter(Boolean).join(' '),
      title: s.kind === 'scene' ? oneLine(s.scene.say) : t(`ls.step.${s.kind}`),
      onClick: () => this.goTo(k),
    }, s.kind === 'scene' ? String(s.i + 1) : s.kind === 'play' ? t('ls.step.playShort') : t('ls.step.taskShort'))));

    const liveHost = el('div.ls-live');
    // The glossary dock exists before the body: the live code runs (and fills it)
    // while the body is being built.
    this.glossBar = el('div.ls-gloss-bar');
    this.glossHost = el('div.ls-gloss');
    this.dock = el('div.ls-dock', { hidden: true }, this.glossBar, this.glossHost);
    this.glossLast = null;
    // Raised was asked for on one step, for that step's lack of room.
    this.glossRaised = false;
    let body;
    if (current.kind === 'scene') body = this.renderScene(current.scene, liveHost);
    else if (current.kind === 'play') body = this.renderPlay(liveHost);
    else body = this.renderTask(liveHost);

    // Two regions, sized by the screen rather than guessed: the lesson takes the
    // height it needs (and scrolls when that is more than there is), the glossary
    // dock takes what is left. Its bar never leaves the screen, on any monitor.
    mount(this.host,
      el('div.ls-frame',
        el('div.ls-scroll',
          el('div.ls',
            el('div.ls-top',
              el('div.ls-kicker', t('ls.kicker', { n: number, total: this.opts.lessons.length })),
              el('h1.ls-title', lesson.title)),
            dots,
            body,
            this.renderNav(current))),
        this.dock));
    this.opts.onRender?.();
  }

  renderScene(scene, liveHost) {
    const node = el('div.ls-step',
      el('p.ls-say', { html: markup(scene.say) }),
      liveHost);
    this.live = new LiveCode(liveHost, {
      code: scene.code,
      setup: this.lesson.setup,
      pick: scene.pick,
      tap: scene.tap,
      show: scene.show,
      stage: this.opts.stage,
      memory: this.opts.memory,
      onRun: (result, src) => this.renderGlossary(result, src, scene.pick),
    });
    return node;
  }

  renderPlay(liveHost) {
    const play = this.lesson.play;
    const chips = el('div.ls-chips', play.chips.map((code) => el('button.ls-chip', {
      type: 'button',
      title: t('ls.chipTitle'),
      'aria-label': `${t('ls.chipTitle')}: ${code}`,
      onClick: () => { this.live.code = code; },
    }, el('code', { html: highlightCode(code) }))));
    const node = el('div.ls-step',
      el('p.ls-say', { html: markup(play.say || t('ls.playSay')) }),
      chips,
      liveHost);
    this.live = new LiveCode(liveHost, {
      code: play.code,
      setup: this.lesson.setup,
      stage: this.opts.stage,
      memory: this.opts.memory,
      minRows: 3,
      onRun: (result, src) => this.renderGlossary(result, src),
    });
    return node;
  }

  renderTask(liveHost) {
    const task = this.lesson.task;
    // A saved answer is offered, never filled in: on a lab computer it may be the
    // previous student's, solution included.
    const progress = getProgress(this.lesson.id);
    const saved = progress?.lastCode;
    const offer = saved && saved.trim() && saved !== task.starter
      ? el('div.ls-saved',
        el('span.ls-saved-text', saved && progress.codeAt
          ? t('ls.saved', { when: savedWhen(progress.codeAt) })
          : t('ls.savedNoTime')),
        el('button.ghost-btn.ls-saved-load', {
          type: 'button',
          onClick: () => { this.live.code = saved; offer.remove(); },
        }, t('ls.savedLoad')))
      : null;
    this.compareHost = el('div.ls-goal');
    this.verdictHost = el('div.ls-verdict-host');
    this.hintsHost = el('div.ls-hints-host');
    const hintBtn = el('button.ghost-btn', { type: 'button', onClick: () => this.showHint() },
      this.hintsShown >= task.hints.length ? t('ls.showSolution') : t('ls.hint', { k: this.hintsShown + 1, n: task.hints.length }));
    this.hintBtn = hintBtn;

    const node = el('div.ls-step.ls-task',
      el('p.ls-say', { html: markup(task.prompt) }),
      this.compareHost,
      offer,
      liveHost);

    // Buttons, verdict and hints sit right under the code, before the stage: the
    // student types, checks, and reads the answer without scrolling past pictures.
    this.live = new LiveCode(liveHost, {
      code: task.starter,
      setup: this.lesson.setup,
      stage: this.opts.stage,
      memory: this.opts.memory,
      minRows: 3,
      quietStart: true,
      after: el('div.ls-task-bar',
        el('div.ls-actions',
          el('button.ls-check', { type: 'button', onClick: () => this.check() }, t('ls.check')),
          hintBtn),
        this.verdictHost,
        this.hintsHost),
      onRun: (result, src) => { this.renderCompare(result); this.renderGlossary(result, src); },
    });
    this.renderCompare(this.live.result);
    this.renderHints();
    this.renderVerdict();
    return node;
  }

  renderCompare(result) {
    if (!this.compareHost) return;
    const mine = result && result.ok && result.value !== undefined && !isBlank(this.live?.code) ? result.value : undefined;
    const ok = mine !== undefined && this.goal ? valuesEqual(mine, this.goal, this.lesson.task.check.compare || {}) : null;
    mount(this.compareHost, renderCompare(this.goal, mine, {
      goalLabel: t('ls.goal'),
      mineLabel: t('ls.yours'),
      ok: ok ? true : null,
    }));
  }

  renderNav(current) {
    const last = this.step === this.steps().length - 1;
    const done = getProgress(this.lesson.id)?.status === 'done';
    const nextLesson = this.opts.lessons[this.opts.lessons.indexOf(this.lesson) + 1];
    let forward;
    if (!last) {
      const nextStep = this.steps()[this.step + 1];
      forward = el('button.ls-next', { type: 'button', onClick: () => this.next() },
        `${t(nextStep.kind === 'scene' ? 'ls.nextScene' : `ls.to.${nextStep.kind}`)} →`);
    } else if (done && nextLesson) {
      forward = el('button.ls-next', { type: 'button', onClick: () => this.opts.onOpen?.(nextLesson.id) }, `${t('ls.nextLesson')} →`);
    } else {
      forward = el('span');
    }
    return el('div.ls-nav',
      this.step > 0 ? el('button.ghost-btn', { type: 'button', onClick: () => this.prev() }, `← ${t('ls.back')}`) : el('span'),
      current.kind === 'scene' ? el('span.ls-nav-hint', t('ls.navHint')) : el('span'),
      forward);
  }

  // --- the glossary ------------------------------------------------------------------

  /**
   * Redraw "Ściąga" for the code that just ran. Code that does not parse (half
   * typed) keeps the last panel: flicker on every keystroke would be noise. A task
   * may start unfinished on purpose (`ankieta |>`); then the panel still offers the
   * lesson's concepts, just with nothing from the box.
   */
  renderGlossary(result, src, prefer = this.glossLast?.prefer) {
    if (!this.glossHost) return;
    let found = findConcepts(src ?? '');
    if (!found && this.glossLast) return;
    if (!found) found = new Map();
    this.glossLast = { result, src, found, prefer };
    this.drawGlossary();
  }

  drawGlossary() {
    const g = this.glossLast;
    if (!g) return;
    if (this.glossFolded == null) this.glossFolded = loadFolded();
    const drawn = renderGlossary({
      src: g.src,
      found: g.found,
      log: g.result?.evalLog,
      prefer: g.prefer,
      lessons: this.opts.lessons,
      lessonIndex: this.opts.lessons.indexOf(this.lesson),
      first: this.first,
      open: this.glossOpen,
      folded: this.glossFolded,
      onToggle: (id) => {
        if (this.glossOpen.has(id)) this.glossOpen.delete(id);
        else this.glossOpen.add(id);
        this.drawGlossary();
      },
      onPick: (span) => {
        const log = this.live?.result?.evalLog;
        const node = log?.nodes().find((n) => n.span?.start === span.start && n.span?.end === span.end);
        const entry = node && log.entriesFor(node)[0];
        if (entry) this.live.select(entry);
      },
      onHover: (span) => this.live?.box.mark('hov', span),
      onBar: () => this.cycleDock(),
    });
    this.dock.hidden = !drawn;
    mount(this.glossBar, drawn?.bar);
    mount(this.glossHost, drawn?.panel);
    this.dock.classList.toggle('ls-dock-folded', !!this.glossFolded);
    this.dock.classList.toggle('ls-dock-raised', !this.glossFolded && !!this.glossRaised);
    this.watchDock();
  }

  /** Height the dock leaves for cards. The dock's own height comes from the layout
   * (what the lesson leaves free), never from the cards, so hiding them is safe. */
  dockRoom() {
    return this.dock.clientHeight - this.glossBar.offsetHeight;
  }

  /**
   * Open but squeezed to its bar (a short screen, a long step): show the bar alone,
   * pointing up, rather than a sliver of card under it. Re-measured whenever the
   * dock changes size -- typing a longer answer, resizing the window.
   */
  watchDock() {
    const update = () => {
      const squeezed = !this.glossFolded && !this.glossRaised && wide() && this.dockRoom() < 60;
      this.dock.classList.toggle('ls-dock-squeezed', squeezed);
      this.glossBar.firstChild?.setAttribute('aria-expanded', !this.glossFolded && !squeezed ? 'true' : 'false');
    };
    if (this.dockWatch?.dock !== this.dock) {
      this.dockWatch?.observer?.disconnect();
      const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null;
      observer?.observe(this.dock);
      this.dockWatch = { dock: this.dock, observer };
    }
    update();
  }

  /**
   * The bar asks for "more" or "less", whatever the screen. Folded opens; open with
   * too little room raises the dock over half the column; raised drops back; open
   * with room enough folds. Only folded/open is remembered: room depends on the step.
   */
  cycleDock() {
    // "Too little room": squeezed to the bar, or only a card's head showing.
    const cramped = wide() && this.dockRoom() < 160;
    if (this.glossFolded) {
      this.glossFolded = false;
      saveFold(false);
    } else if (this.glossRaised) {
      this.glossRaised = false;
    } else if (cramped) {
      this.glossRaised = true;
    } else {
      this.glossFolded = true;
      saveFold(true);
    }
    this.drawGlossary();
  }

  // --- the task ------------------------------------------------------------------

  check() {
    const code = this.live?.code || '';
    const lesson = this.lesson;
    this.live?.run({ keep: true });

    // Judge in a clean room: leftovers from experimenting must not make a wrong answer right.
    const session = new RSession({ trace: false });
    session.run(lesson.setup);
    const run = session.run(code);
    noteAttempt(lesson.id, { code });

    if (!run.ok) {
      this.verdict = { ok: false, kind: 'error' };
    } else {
      const result = lesson.task.check({ value: run.value, code, session });
      if (result.ok) {
        markDone(lesson.id, { code });
        this.verdict = { ok: true };
        this.opts.onDone?.(lesson);
      } else {
        const key = lesson.task.diagnose?.({ value: run.value, code, result }) || 'general';
        this.verdict = { ok: false, kind: 'wrong', key };
      }
    }
    this.renderVerdict();
    if (this.verdict.ok) this.render();
    return this.verdict;
  }

  renderVerdict() {
    if (!this.verdictHost) return;
    const v = this.verdict;
    const task = this.lesson.task;
    if (!v) { mount(this.verdictHost); return; }
    if (v.ok) {
      mount(this.verdictHost, el('div.ls-verdict.ls-ok',
        el('div.ls-verdict-title', el('span.ls-verdict-icon', '✓'), task.success),
        task.note ? el('div.ls-verdict-note', { html: markup(task.note) }) : null));
      return;
    }
    if (v.kind === 'error') {
      mount(this.verdictHost, el('div.ls-verdict.ls-bad',
        el('div.ls-verdict-title', el('span.ls-verdict-icon', '!'), t('ls.codeFailed')),
        el('div.ls-verdict-note', t('ls.seeConsole'))));
      return;
    }
    const message = task.messages[v.key] || task.messages.general;
    mount(this.verdictHost, el('div.ls-verdict.ls-bad',
      el('div.ls-verdict-title', el('span.ls-verdict-icon', '✗'), t('ls.notYet')),
      el('div.ls-verdict-note', { html: markup(message) })));
  }

  showHint() {
    const task = this.lesson.task;
    if (this.hintsShown >= task.hints.length) { this.solutionShown = true; noteSolution(this.lesson.id); }
    else { noteHint(this.lesson.id, this.hintsShown); this.hintsShown++; }
    this.hintBtn.textContent = this.hintsShown >= task.hints.length
      ? t('ls.showSolution')
      : t('ls.hint', { k: this.hintsShown + 1, n: task.hints.length });
    this.renderHints();
  }

  renderHints() {
    if (!this.hintsHost) return;
    const task = this.lesson.task;
    const shown = task.hints.slice(0, this.hintsShown);
    if (!shown.length && !this.solutionShown) { mount(this.hintsHost); return; }
    mount(this.hintsHost, el('div.ls-hints',
      shown.map((h, i) => el('div.ls-hint', el('span.ls-hint-num', String(i + 1)), el('span', { html: markup(h) }))),
      this.solutionShown
        ? el('div.ls-solution',
          el('div.ls-solution-head', t('ls.solution')),
          el('pre.ls-code', { html: highlightCode(task.solution) }),
          el('button.ghost-btn', { type: 'button', onClick: () => { this.live.code = task.solution; } }, t('ls.loadSolution')))
        : null));
  }
}

/** The value the task asks for, computed from the reference solution. */
function computeGoal(lesson) {
  try {
    const session = new RSession({ trace: false });
    session.run(lesson.setup);
    const run = session.run(lesson.task.solution);
    return run.ok ? run.value : null;
  } catch {
    return null;
  }
}

/** Folded by default on a narrow screen; on a wide one, as it was last left. */
function loadFolded() {
  const saved = savedFold();
  if (saved != null) return saved;
  return typeof matchMedia === 'function' && matchMedia('(max-width: 980px)').matches;
}

/** Two columns: the dock splits the lesson column. One column: it simply follows. */
const wide = () => typeof matchMedia === 'function' && !matchMedia('(max-width: 980px)').matches;

/** "dziś, 10:42" or "12.09, 10:42": enough for a student to tell their code from someone else's. */
function savedWhen(ms) {
  if (!ms) return null;
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const today = new Date().toDateString() === d.toDateString();
  return today ? t('ls.savedToday', { time }) : t('ls.savedDay', { date: `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`, time });
}

const isBlank = (code) => !String(code || '').replace(/#[^\n]*/g, '').trim();
const oneLine = (s) => String(s).replace(/\*\*|`/g, '');

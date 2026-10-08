/**
 * A lesson, as the student walks it: a few scenes, a sandbox, a task.
 *
 *   scene   one sentence + live code with the key expression already selected and
 *           the next thing to click pulsing. The picture on the stage does the
 *           explaining; the sentence only says where to look.
 *   play    the sandbox: code of your own, plus one-click variants to try.
 *   task    make R produce the goal shown next to the prompt; checked by result.
 *   extra   a second task for those who want more (D41). Same screen, its own
 *           hints and record; the exercise is finished without it.
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
import { renderSurvey } from './viz/survey.js';
import { renderBeforeAfter } from './viz/before-after.js';
import { highlightCode } from './codebox.js';
import { valuesEqual, withKeep } from '../lessons/schema.js';
import { t } from '../i18n/index.js';
import { markup } from './markup.js';
import { GlossaryDock } from './dock.js';
import { findConcepts, firstLessons } from './concepts.js';
import { getProgress, getTaskProgress, markSeen, markDone, noteAttempt, noteHint, noteSolution, savedFold, saveFold } from './progress.js';

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
    this.gloss = new GlossaryDock({
      scroller: host,
      lessons: opts.lessons,
      first: this.first,
      lessonIndex: () => opts.lessons.indexOf(this.lesson),
      live: () => this.live,
    });
  }

  open(lesson, { step = 0 } = {}) {
    this.lesson = lesson;
    // Each task keeps its own hints, opened solution and goal.
    const slots = lesson.extra ? ['task', 'extra'] : ['task'];
    this.hints = Object.fromEntries(slots.map((sl) => [sl, getTaskProgress(lesson.id, sl)?.hintsUsed || 0]));
    this.solutionOpen = {};
    this.verdict = null;
    this.goals = Object.fromEntries(slots.map((sl) => [sl, computeGoal(lesson, lesson[sl])]));
    this.gloss.forget();
    markSeen(lesson.id);
    this.goTo(Math.max(0, Math.min(step, this.steps().length - 1)));
  }

  steps() {
    const l = this.lesson;
    return [
      ...l.scenes.map((s, i) => ({ kind: 'scene', scene: s, i })),
      { kind: 'play' },
      { kind: 'task' },
      ...(l.extra ? [{ kind: 'extra' }] : []),
    ];
  }

  /** Which of the lesson's tasks is on screen: the one that counts, or the extra one. */
  get slot() { return this.steps()[this.step]?.kind === 'extra' ? 'extra' : 'task'; }
  get task() { return this.lesson[this.slot]; }
  get goal() { return this.goals[this.slot]; }
  get hintsShown() { return this.hints[this.slot]; }
  set hintsShown(n) { this.hints[this.slot] = n; }
  get solutionShown() { return !!this.solutionOpen[this.slot]; }
  set solutionShown(v) { this.solutionOpen[this.slot] = v; }

  goTo(k) {
    this.step = k;
    this.verdict = null;
    this.keepCode = null;
    this.live?.destroy();
    this.live = null;
    this.picture?.destroy?.();
    this.picture = null;
    this.render();
    this.opts.onPlace?.({ lesson: this.lesson.id, step: k });
    this.host.scrollTop = 0;
  }

  /** A new person: drop what this view remembers about the last one. */
  forget() {
    this.gloss.forget({ fold: true });
  }

  next() { if (this.step < this.steps().length - 1) this.goTo(this.step + 1); }
  prev() { if (this.step > 0) this.goTo(this.step - 1); }

  // --- rendering ---------------------------------------------------------------

  render() {
    const lesson = this.lesson;
    const steps = this.steps();
    const current = steps[this.step];
    const done = getProgress(lesson.id)?.status === 'done';
    const extraDone = getTaskProgress(lesson.id, 'extra')?.status === 'done';
    const number = this.opts.lessons.indexOf(lesson) + 1;

    const dots = el('nav.ls-steps', { 'aria-label': t('ls.steps') }, steps.map((s, k) => el('button', {
      type: 'button',
      class: ['ls-dot', `ls-dot-${s.kind}`, k === this.step ? 'ls-dot-on' : '', k < this.step ? 'ls-dot-past' : '',
        (s.kind === 'task' && done) || (s.kind === 'extra' && extraDone) ? 'ls-dot-done' : ''].filter(Boolean).join(' '),
      title: s.kind === 'scene' ? oneLine(s.scene.say) : t(`ls.step.${s.kind}`),
      onClick: () => this.goTo(k),
    }, s.kind === 'scene' ? String(s.i + 1) : t(`ls.step.${s.kind}Short`))));

    const liveHost = el('div.ls-live');
    // The glossary dock exists before the body: the live code runs (and fills it)
    // while the body is being built.
    const dock = this.gloss.build();
    let body;
    if (current.kind === 'scene') body = this.renderScene(current.scene, liveHost);
    else if (current.kind === 'play') body = this.renderPlay(liveHost);
    else body = this.renderTask(liveHost);

    // One scrolling column (D23): the lesson, then the glossary. The glossary's bar is
    // held at the bottom of the column while the glossary is out of sight, so it never
    // leaves the screen; on a tall monitor the glossary simply fills the space below.
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
        dock));
    this.opts.onRender?.();
  }

  renderScene(scene, liveHost) {
    if (scene.picture) return this.renderPicture(scene);
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

  /**
   * A scene without code (D27): the questionnaire stands where the code would, and the
   * stage shows what R holds. Nothing has run yet, so memory is empty and "Ściąga"
   * has nothing to explain.
   */
  renderPicture(scene) {
    if (scene.picture.kind === 'verb') {
      // The table is in memory already (a file read from disk); the picture plays once.
      const view = renderBeforeAfter(scene.picture, this.lesson.setup);
      this.picture = view;
      this.opts.stage?.node(view.stage);
      const data = new RSession({ trace: false }).run(this.lesson.setup);
      this.opts.memory?.show(data.env, new Set());
      this.gloss.update(null, '');
      view.play();
      return el('div.ls-step', el('p.ls-say', { html: markup(scene.say) }), view.left);
    }
    const survey = renderSurvey(scene.picture, this.lesson.setup);
    this.picture = survey;
    this.opts.stage?.node(survey.stage);
    this.opts.memory?.empty();
    this.gloss.update(null, '');
    return el('div.ls-step', el('p.ls-say', { html: markup(scene.say) }), survey.left);
  }

  renderPlay(liveHost) {
    const play = this.lesson.play;
    const chips = el('div.ls-chips', play.chips.map((code) => el('button.ls-chip', {
      type: 'button',
      title: t('ls.chipTitle'),
      'aria-label': `${t('ls.chipTitle')}: ${code}`,
      onClick: () => { this.live.code = withKeep(play, code); },
    }, el('code', { html: highlightCode(code) }))));
    const node = el('div.ls-step',
      el('p.ls-say', { html: markup(play.say || t('ls.playSay')) }),
      chips,
      liveHost);
    this.live = new LiveCode(liveHost, {
      code: withKeep(play, play.code),
      setup: this.lesson.setup,
      stage: this.opts.stage,
      memory: this.opts.memory,
      minRows: 3,
      onRun: (result, src) => this.renderGlossary(result, src),
    });
    return node;
  }

  renderTask(liveHost) {
    const task = this.task;
    const extra = this.slot === 'extra';
    // A saved answer is offered, never filled in: on a lab computer it may be the
    // previous student's, solution included.
    const progress = getTaskProgress(this.lesson.id, this.slot);
    const saved = progress?.lastCode;
    // Drawn again after a success: the code just checked stays where it is.
    const kept = this.keepCode;
    const offer = kept == null && saved && saved.trim() && saved !== task.starter
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
      extra ? el('p.ls-extra-note', t('ls.extraNote')) : null,
      el('p.ls-say', { html: markup(task.prompt) }),
      this.compareHost,
      offer,
      liveHost);

    // Buttons, verdict and hints sit right under the code, before the stage: the
    // student types, checks, and reads the answer without scrolling past pictures.
    this.live = new LiveCode(liveHost, {
      code: kept ?? task.starter,
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
      onRun: (result, src) => {
        // A failed check speaks about the code it checked; once that code changes, it goes.
        if (this.verdict && !this.verdict.ok && src !== this.verdictCode) {
          this.verdict = null;
          this.renderVerdict();
        }
        this.renderCompare(result);
        this.renderGlossary(result, src);
      },
    });
    this.renderCompare(this.live.result);
    this.renderHints();
    this.renderVerdict();
    return node;
  }

  renderCompare(result) {
    if (!this.compareHost) return;
    const mine = result && result.ok && result.value !== undefined && !isBlank(this.live?.code) ? result.value : undefined;
    const ok = mine !== undefined && this.goal ? valuesEqual(mine, this.goal, this.task.check.compare || {}) : null;
    mount(this.compareHost, renderCompare(this.goal, mine, {
      goalLabel: t('ls.goal'),
      mineLabel: t('ls.yours'),
      ok: ok ? true : null,
    }));
  }

  renderNav(current) {
    // Both tasks end the exercise: from either, "next" leads to the next exercise, so
    // nobody has to pass through the extra task to move on.
    const last = current.kind === 'task' || current.kind === 'extra';
    const done = getProgress(this.lesson.id)?.status === 'done';
    const nextLesson = this.opts.lessons[this.opts.lessons.indexOf(this.lesson) + 1];
    // Offered only once the exercise is finished: before that it would be one more
    // thing to do for someone who is still working on the first task.
    const toExtra = current.kind === 'task' && this.lesson.extra && done
      ? el('button.ghost-btn.ls-to-extra', { type: 'button', onClick: () => this.next() }, `${t('ls.to.extra')} →`)
      : null;
    let forward;
    if (!last) {
      const nextStep = this.steps()[this.step + 1];
      forward = el('button.ls-next', { type: 'button', onClick: () => this.next() },
        `${t(nextStep.kind === 'scene' ? 'ls.nextScene' : `ls.to.${nextStep.kind}`)} →`);
    } else if (done && nextLesson) {
      forward = el('button.ls-next', { type: 'button', onClick: () => this.opts.onOpen?.(nextLesson.id) }, `${t('ls.nextLesson')} →`);
    } else if (done) {
      // The last lesson leads out of the trainer, to the real thing.
      forward = el('button.ls-next', { type: 'button', onClick: () => this.opts.onOpen?.('rstudio') }, `${t('ls.toRStudio')} →`);
    } else {
      forward = el('span');
    }
    return el('div.ls-nav',
      this.step > 0 ? el('button.ghost-btn', { type: 'button', onClick: () => this.prev() }, `← ${t('ls.back')}`) : el('span'),
      toExtra || (current.kind === 'scene' && !current.scene.picture ? el('span.ls-nav-hint', t('ls.navHint')) : el('span')),
      forward);
  }

  // --- the glossary ------------------------------------------------------------------

  /** Redraw "Ściąga" for the code that just ran (dock.js). */
  renderGlossary(result, src, prefer) {
    this.gloss.update(result, src, prefer);
  }

  // --- the task ------------------------------------------------------------------

  check() {
    const code = this.live?.code || '';
    const lesson = this.lesson;
    const { slot, task } = this;
    this.live?.run({ keep: true });

    // Judge in a clean room: leftovers from experimenting must not make a wrong answer right.
    const session = new RSession({ trace: false });
    session.run(lesson.setup);
    const run = session.run(code);
    noteAttempt(lesson.id, { code, slot });
    this.verdictCode = code;

    if (!run.ok) {
      this.verdict = { ok: false, kind: 'error' };
    } else {
      const result = task.check({ value: run.value, code, session });
      if (result.ok) {
        markDone(lesson.id, { code, slot });
        this.verdict = { ok: true };
        this.opts.onDone?.(lesson);
      } else {
        const key = task.diagnose?.({ value: run.value, code, result }) || 'general';
        this.verdict = { ok: false, kind: 'wrong', key };
      }
    }
    this.renderVerdict();
    // The explanation sits in the console under the code; on a laptop screen that is
    // below the fold, while the verdict says "pod kodem". Bring it into view.
    if (this.verdict.kind === 'error') {
      try { this.live?.console?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }); } catch { /* no layout */ }
    }
    // Drawn again so the star turns green and the next lesson is offered.
    if (this.verdict.ok) {
      this.keepCode = code;
      this.render();
    }
    return this.verdict;
  }

  renderVerdict() {
    if (!this.verdictHost) return;
    const v = this.verdict;
    const task = this.task;
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
    const task = this.task;
    if (this.hintsShown >= task.hints.length) { this.solutionShown = true; noteSolution(this.lesson.id, this.slot); }
    else { noteHint(this.lesson.id, this.hintsShown, this.slot); this.hintsShown++; }
    this.hintBtn.textContent = this.hintsShown >= task.hints.length
      ? t('ls.showSolution')
      : t('ls.hint', { k: this.hintsShown + 1, n: task.hints.length });
    this.renderHints();
  }

  renderHints() {
    if (!this.hintsHost) return;
    const task = this.task;
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

/** The value a task asks for, computed from its reference solution. */
function computeGoal(lesson, task) {
  try {
    const session = new RSession({ trace: false });
    session.run(lesson.setup);
    const run = session.run(task.solution);
    return run.ok ? run.value : null;
  } catch {
    return null;
  }
}

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

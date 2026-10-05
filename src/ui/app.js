/**
 * The application shell.
 *
 * Two halves, always in the same place: on the left the lesson and its code, on the
 * right the stage (what the selected piece of code did) and R's memory. A student
 * working alone should never have to look for either.
 *
 * Opening the file lands where the student left off -- same lesson, same step.
 */

import { el, mount } from './dom.js';
import { LessonView } from './lesson.js';
import { LiveCode } from './live.js';
import { renderStage, stopStage } from './viz/focus.js';
import { renderMemory } from './viz/memory.js';
import { renderPlain } from './viz/pictures.js';
import { LESSONS, lessonById, lessonsByLecture } from '../lessons/index.js';
import {
  getProgress, allProgress, savedPlace, savePlace, doneCount, people, currentPerson,
  choosePerson, addPerson, forgetPerson, dropLegacy, savedSandbox, saveSandbox,
} from './progress.js';
import { renderWho, renderReport, renderCheck } from './people.js';
import { renderRStudio } from './rstudio.js';
import { GlossaryDock } from './dock.js';
import { firstLessons } from './concepts.js';
import { markup } from './markup.js';
import { buildReport } from './report.js';
import { t } from '../i18n/index.js';

const SANDBOX_CODE = `oceny <- c(4, 5, 3, 5, 2)
oceny * 20
mean(oceny)
ankieta |> count(miasto)`;

// The sandbox starts with the course's survey in memory: every lesson's code that
// reads `ankieta` can be tried here, dplyr included. One table covering the columns
// the lessons use, with two missing answers.
const SANDBOX_SETUP = `ankieta <- data.frame(
  id = 1:10,
  plec = c("K", "M", "K", "K", "M", "M", "K", "M", "K", "M"),
  wiek = c(23, 34, 45, 29, 51, 38, 27, 42, 19, 60),
  miasto = c("Kraków", "Warszawa", "Kraków", "Gdańsk", "Warszawa",
             "Kraków", "Gdańsk", "Warszawa", "Kraków", "Gdańsk"),
  wyksztalcenie = c("wyższe", "średnie", "wyższe", "wyższe", "średnie",
                    "średnie", "wyższe", "średnie", "średnie", "wyższe"),
  ocena = c(4, 5, 3, 4, NA, 5, 4, NA, 3, 5)
)`;

export class App {
  constructor(host) {
    this.host = host;
    this.build();
    dropLegacy();
    // Every opening asks who is working (D17): on a lab computer the last person to
    // use this browser is usually someone else.
    this.showWho();
  }

  /** Continue where the chosen person left off. */
  openPlace() {
    const place = savedPlace();
    if (place?.lesson === 'sandbox') this.openSandbox();
    else if (place?.lesson === 'rstudio') this.openRStudio();
    else if (place?.lesson && lessonById(place.lesson)) this.openLesson(place.lesson, { step: place.step || 0 });
    else this.openLesson(LESSONS[0].id);
  }

  showWho() {
    this.toggleMenu(false);
    const someone = currentPerson();
    const start = (person) => {
      if (!person) return;
      this.closeOverlay();
      this.lessonView.forget();
      this.sandboxGloss?.forget({ fold: true });
      this.renderWhoButton();
      this.openPlace();
    };
    this.openOverlay(renderWho({
      people: people(),
      total: LESSONS.length,
      onChoose: (id) => start(choosePerson(id)),
      onAdd: (name) => start(addPerson(name)),
      onClose: someone ? () => this.closeOverlay() : null,
      onTeacher: () => this.showCheck(),
    }), { closable: !!someone });
  }

  /** The teacher's check, without a name: closing it goes back to "Kim jesteś?". */
  showCheck() {
    this.openOverlay(renderCheck({ onClose: () => this.showWho() }), { closable: false });
  }

  showReport() {
    this.toggleMenu(false);
    const person = currentPerson();
    if (!person) return;
    this.openOverlay(renderReport({
      text: buildReport({ name: person.name, lessons: LESSONS, progress: allProgress() }),
      onClose: () => this.closeOverlay(),
    }), { closable: true });
  }

  openOverlay(node, { closable }) {
    this.overlayClosable = closable;
    mount(this.overlay, node);
    this.overlay.hidden = false;
  }

  closeOverlay() {
    mount(this.overlay);
    this.overlay.hidden = true;
  }

  renderWhoButton() {
    const p = currentPerson();
    this.whoLabel.textContent = p ? p.name : t('who.anon');
  }

  build() {
    this.left = el('section.pane-left');
    this.right = el('section.pane-right');
    this.stageHost = el('div.stage-body');
    this.memHost = el('div.mem-body');
    this.menu = el('div.menu', { hidden: true });
    this.overlay = el('div.overlay', { hidden: true });
    this.lessonLabel = el('span.top-lesson-label');
    this.whoLabel = el('span.top-who-name', t('who.anon'));

    const menuBtn = el('button.top-menu', {
      type: 'button',
      'aria-haspopup': 'true',
      onClick: () => this.toggleMenu(),
    }, el('span.top-menu-icon', '☰'), this.lessonLabel);

    mount(this.host,
      el('div.app',
        el('header.top',
          el('div.brand', el('span.brand-r', 'R'), el('span.brand-name', t('ui.brand'))),
          menuBtn,
          el('div.top-right',
            el('button.top-sandbox', { type: 'button', onClick: () => this.openSandbox() }, t('ui.sandbox')),
            el('button.top-who', { type: 'button', title: t('who.change'), onClick: () => this.showWho() },
              el('span.top-who-icon', '●'), this.whoLabel))),
        el('main.main', this.left, this.right)),
      this.menu,
      this.overlay);
    this.stageBox = el('div.stage', el('div.pane-title', t('ui.paneStage')), this.stageHost);
    this.memBox = el('div.mem', el('div.pane-title', t('ui.paneMemory')), this.memHost);
    mount(this.right, this.stageBox, this.memBox);
    this.narrow = typeof matchMedia === 'function' ? matchMedia('(max-width: 980px)') : null;
    this.narrow?.addEventListener?.('change', () => this.placeStage());

    this.stage = {
      show: (entry, ctx) => mount(this.stageHost, renderStage(entry, ctx)),
      // A scene without code draws its own picture (viz/survey.js).
      node: (node) => { stopStage(); mount(this.stageHost, node); },
    };
    this.memory = {
      // Before any code has run: nothing is in R yet.
      empty: () => mount(this.memHost, el('div.mem-empty', t('mem.empty'))),
      show: (env, fresh) => mount(this.memHost, renderMemory(env, {
        fresh,
        onPick: (name, value) => {
          stopStage();
          mount(this.stageHost, el('div.st',
            el('div.st-head', el('div.st-code', el('code', name))),
            el('div.st-pic', renderPlain(value, name)),
            el('div.st-caption', t('mem.caption', { name }))));
        },
      })),
    };

    this.lessonView = new LessonView(this.left, {
      stage: this.stage,
      memory: this.memory,
      lessons: LESSONS,
      onPlace: (place) => savePlace(place),
      onOpen: (id) => (id === 'rstudio' ? this.openRStudio() : this.openLesson(id)),
      onDone: () => this.renderMenu(),
      onRender: () => this.placeStage(),
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.menu.hidden) this.toggleMenu(false);
      else if (e.key === 'Escape' && !this.overlay.hidden && this.overlayClosable) this.closeOverlay();
    });
  }

  openLesson(id, { step = 0 } = {}) {
    const lesson = lessonById(id);
    if (!lesson) return;
    this.toggleMenu(false);
    this.sandbox?.destroy();
    this.sandbox = null;
    this.lessonLabel.textContent = `${LESSONS.indexOf(lesson) + 1}. ${lesson.title}`;
    this.restoreRight();
    this.lessonView.open(lesson, { step });
  }

  /** "Dalej w RStudio": a page, not a lesson (rstudio.js). Its error list takes the stage's place. */
  openRStudio() {
    this.toggleMenu(false);
    this.sandbox?.destroy();
    this.sandbox = null;
    this.lessonView.live?.destroy();
    this.lessonView.lesson = null;
    this.lessonLabel.textContent = t('rs.title');
    const page = renderRStudio();
    mount(this.left, page.left);
    mount(this.right, page.right);
    this.left.scrollTop = 0;
    savePlace({ lesson: 'rstudio' });
  }

  /** Back from the RStudio page: the stage and memory return to the right column. */
  restoreRight() {
    if (this.stageBox.isConnected && this.memBox.parentElement === this.right) return;
    mount(this.right, this.stageBox, this.memBox);
    this.placeStage();
  }

  openSandbox() {
    this.toggleMenu(false);
    this.lessonView.live?.destroy();
    this.lessonView.lesson = null;
    this.lessonLabel.textContent = t('ui.sandbox');
    this.restoreRight();
    const liveHost = el('div.ls-live');
    // "Ściąga" here too: past every lesson, so all of it is known and one click away.
    this.sandboxGloss ||= new GlossaryDock({
      scroller: this.left,
      lessons: LESSONS,
      first: firstLessons(LESSONS),
      lessonIndex: () => LESSONS.length,
      live: () => this.sandbox,
    });
    const dock = this.sandboxGloss.build();
    mount(this.left, el('div.ls-frame',
      el('div.ls-scroll',
        el('div.ls',
          el('div.ls-top', el('div.ls-kicker', t('ui.sandboxKicker')), el('h1.ls-title', t('ui.sandbox'))),
          el('div.ls-step', el('p.ls-say', { html: markup(t('ui.sandboxSay')) }), liveHost))),
      dock));
    // The person's own sandbox code comes back; it is theirs, so it is filled in.
    const own = savedSandbox();
    this.sandbox = new LiveCode(liveHost, {
      code: own ?? SANDBOX_CODE,
      setup: SANDBOX_SETUP,
      stage: this.stage,
      memory: this.memory,
      minRows: 6,
      onRun: (result, src) => {
        this.sandboxGloss.update(result, src);
        if (src !== SANDBOX_CODE || own != null) saveSandbox(src);
      },
    });
    this.placeStage();
    savePlace({ lesson: 'sandbox' });
  }

  /** Wide screen: the stage beside the lesson. Narrow: right under the code. */
  placeStage() {
    const slot = this.left.querySelector('.lv-slot');
    if (this.narrow?.matches && slot) {
      if (this.stageBox.parentElement !== slot) slot.append(this.stageBox);
    } else if (this.stageBox.parentElement !== this.right) {
      this.right.prepend(this.stageBox);
    }
  }

  toggleMenu(open = this.menu.hidden) {
    if (open) { this.forgetAsk = false; this.renderMenu(); }
    this.menu.hidden = !open;
  }

  renderMenu() {
    const current = this.lessonView.lesson?.id;
    mount(this.menu,
      el('div.menu-backdrop', { onClick: () => this.toggleMenu(false) }),
      el('nav.menu-panel', { 'aria-label': t('ui.lessons') },
        el('div.menu-head', el('span', t('ui.lessons')), el('button.menu-close', { type: 'button', onClick: () => this.toggleMenu(false) }, '×')),
        lessonsByLecture().map(([lecture, modules]) => el('div.menu-lecture',
          el('div.menu-lecture-name', t(`lecture.${lecture}`)),
          modules.map(([module, lessons]) => el('div.menu-module',
            el('div.menu-module-name', t(`module.${module}`)),
            lessons.map((lesson) => {
              const status = getProgress(lesson.id)?.status;
              return el('button', {
                type: 'button',
                class: ['menu-item', lesson.id === current ? 'menu-on' : '', status === 'done' ? 'menu-done' : ''].filter(Boolean).join(' '),
                onClick: () => this.openLesson(lesson.id),
              },
              el('span.menu-num', status === 'done' ? '✓' : String(LESSONS.indexOf(lesson) + 1)),
              el('span.menu-title', lesson.title));
            }))))),
        el('div.menu-module',
          el('div.menu-module-name', t('menu.next')),
          el('button', {
            type: 'button',
            class: ['menu-item', 'menu-rstudio', current == null && savedPlace()?.lesson === 'rstudio' ? 'menu-on' : ''].filter(Boolean).join(' '),
            onClick: () => this.openRStudio(),
          }, el('span.menu-num', '→'), el('span.menu-title', t('rs.title')))),
        this.renderMe()));
  }

  /**
   * Who is working, and what they can do about it: hand in a report, switch to
   * someone else, or take their data off this computer. The confirmation lives in
   * the page: browser dialogs are not available everywhere the trainer runs.
   */
  renderMe() {
    const p = currentPerson();
    if (!p) return null;
    const head = [
      el('div.menu-reset-title', t('me.title', { name: p.name })),
      el('div.menu-reset-status', t('me.status', { n: doneCount(), total: LESSONS.length })),
    ];
    if (this.forgetAsk) {
      return el('div.menu-reset.menu-reset-ask',
        el('div.menu-reset-title', t('me.forgetConfirm')),
        el('div.menu-reset-actions',
          el('button.menu-reset-yes', { type: 'button', onClick: () => this.forgetMe() }, t('me.forgetYes')),
          el('button.ghost-btn.menu-reset-no', { type: 'button', onClick: () => { this.forgetAsk = false; this.renderMenu(); } }, t('me.no'))));
    }
    return el('div.menu-reset',
      head,
      el('div.menu-reset-actions',
        el('button.menu-report', { type: 'button', onClick: () => this.showReport() }, t('me.report')),
        el('button.ghost-btn.menu-switch', { type: 'button', onClick: () => this.showWho() }, t('me.switch'))),
      el('button.menu-forget', { type: 'button', onClick: () => { this.forgetAsk = true; this.renderMenu(); } }, t('me.forget')));
  }

  forgetMe() {
    forgetPerson();
    this.forgetAsk = false;
    this.renderWhoButton();
    this.showWho();
  }
}

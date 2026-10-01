/**
 * "Dalej w RStudio": the bridge out of the trainer.
 *
 * The course does its real work in RStudio (docs/curriculum.md), and the moment a
 * student first opens it with their own survey is where the trainer stops helping:
 * a file to read, packages to load, and errors in English. This page names exactly
 * those three differences and nothing else. It is a page, not a lesson: none of it
 * can run here (no files, no packages), and pretending otherwise would teach a fiction.
 *
 * Left column: the three steps. Right column, where the stage usually is: R's most
 * common messages in English, each with what it means and what to do.
 */

import { el } from './dom.js';
import { t } from '../i18n/index.js';

/** R's own wording, verbatim, so the student recognises it on screen. */
const ERRORS = [
  ['notFound', "object 'wiek' not found"],
  ['noFunction', 'could not find function "mutate"'],
  ['noPackage', "there is no package called 'dplyr'"],
  ['noFile', "cannot open file 'ankieta.csv': No such file or directory"],
  ['unexpected', "unexpected ',' in \"wiek <- 23,\""],
  ['textMath', 'non-numeric argument to binary operator'],
  ['meanNA', 'argument is not numeric or logical: returning NA'],
  ['plus', '+'],
];

const STEPS = ['script', 'file', 'packages'];

export function renderRStudio() {
  const left = el('div.ls.rs',
    el('div.ls-top', el('div.ls-kicker', t('rs.kicker')), el('h1.ls-title', t('rs.title'))),
    el('p.ls-say', t('rs.say')),
    STEPS.map((id, i) => el('section.rs-step',
      el('h2.rs-head', el('span.rs-num', String(i + 1)), t(`rs.${id}.title`)),
      el('p.rs-text', t(`rs.${id}.text`)),
      el('pre.rs-code', t(`rs.${id}.code`)),
      el('p.rs-note', t(`rs.${id}.note`)))));

  const right = el('div.rs-errors',
    el('div.pane-title', t('rs.errors.title')),
    el('p.rs-errors-say', t('rs.errors.say')),
    el('dl.rs-list', ERRORS.map(([id, message]) => [
      el('dt.rs-msg', el('code', message)),
      el('dd.rs-what', t(`rs.err.${id}`)),
    ])));
  return { left, right };
}

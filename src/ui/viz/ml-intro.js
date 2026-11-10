/**
 * What machine learning is, before any code (lecture 6, D115).
 *
 * A scene without code (D27), seven steps on the 30 ESS internet users the lecture
 * works with: examples, a rule learned from them (the model), a forecast for a new
 * person (an age slider), the split into learning and test people, the error on the
 * people the model never saw, and a flexibility slider that shows overfitting: the
 * error on the learning people falls with every bend, the error on new people turns
 * up. The last step lists the terms the exercises and lab 3 use.
 *
 * Every number comes from the engine, the same lm() and poly() the exercises run, on
 * the same split (set.seed(2), 20 learning and 10 test people): nothing is drawn that
 * the student will not find again in R.
 */

import { el, mount } from '../dom.js';
import { RSession } from '../../core/session.js';
import { getNames } from '../../core/rvalue.js';
import { simpleLine, renderModelPlot } from './model.js';
import { formatScalar } from '../../core/format.js';
import { markup } from '../markup.js';
import { t } from '../../i18n/index.js';

const SPLIT = 'set.seed(2)\nnr <- sample(nrow(ess), 20)\nuczace <- ess[nr, ]\ntestowe <- ess[-nr, ]';
const MAX_DEGREE = 8;

const round = (x) => Math.round(x);

/** A data frame's columns by name, as plain numbers. */
function columns(df) {
  const names = (getNames(df)?.values || []).map(String);
  const out = {};
  names.forEach((n, i) => { out[n] = df.values[i].values.map(Number); });
  return out;
}

/** Everything the steps draw, computed once by the engine. */
function mlData(setup) {
  const s = new RSession({ trace: false });
  s.run(setup);
  const value = (code) => s.run(code).value;
  const all = value('lm(minuty ~ wiek, data = ess)');
  s.run(SPLIT);
  const test = columns(value('testowe'));
  const learnMean = value('mean(uczace$minuty)').values[0];
  const fits = [];
  for (let k = 1; k <= MAX_DEGREE; k++) {
    const model = value(`lm(minuty ~ poly(wiek, ${k}), data = uczace)`);
    const line = simpleLine(model.lm);
    const learn = Math.sqrt(line.residuals.reduce((a, r) => a + r * r, 0) / line.residuals.length);
    const misses = test.wiek.map((x, i) => test.minuty[i] - line.at(x));
    const testErr = Math.sqrt(misses.reduce((a, r) => a + r * r, 0) / misses.length);
    fits.push({ k, line, learn, test: testErr });
  }
  const meanErr = Math.sqrt(test.minuty.reduce((a, y) => a + (y - learnMean) ** 2, 0) / test.minuty.length);
  return { allLine: simpleLine(all.lm), test, fits, meanErr };
}

/** The test people with the line's forecast and their real answer. */
const testPoints = (d, line) => d.test.wiek.map((x, i) => ({ x, y: line.at(x), actual: d.test.minuty[i], inside: true }));

/** The fitted straight line of degree 1 as a plain line (b0, b1), for the rule step. */
const plainLine = (line) => line;

export function renderMlIntro(picture, setup) {
  const d = mlData(setup);
  const step = picture.step;
  const left = el('div.ml');
  const stage = el('div.st.ml-stage');
  const slot = el('div.lv-slot');
  let age = 40;
  let degree = 1;
  let mounted = false;
  let sliderLabel = null;

  const plot = (line, opts) => el('div.pic-model', renderModelPlot(line, opts));

  function bars() {
    const fit = d.fits[degree - 1];
    const top = Math.max(...d.fits.map((f) => f.test), d.meanErr) * 1.05;
    const bar = (cls, label, v) => el('div.ml-bar-row',
      el('span.ml-bar-label', label),
      el('span.ml-bar-track', el('span', { class: `ml-bar ${cls}`, style: `width:${(100 * v) / top}%` })),
      el('span.ml-bar-value', t('ml.minutes', { v: round(v) })));
    return el('div.ml-bars',
      bar('ml-bar-learn', t('ml.barLearn'), fit.learn),
      bar('ml-bar-test', t('ml.barTest'), fit.test),
      bar('ml-bar-mean', t('ml.barMean'), d.meanErr));
  }

  function draw() {
    let pic;
    let caption;
    let controls = null;
    const f1 = d.fits[0];
    if (step === 'examples') {
      pic = plot(d.allLine, { focus: 'cor' });
      caption = t('ml.cap.examples', { n: d.allLine.xs.length });
    } else if (step === 'rule') {
      pic = plot(plainLine(d.allLine), { focus: 'line' });
      caption = t('ml.cap.rule', { b1: formatScalar(Number(Math.abs(d.allLine.b1).toPrecision(3)), 'double') });
    } else if (step === 'predict') {
      const line = d.allLine;
      const y = line.b0 + line.b1 * age;
      const inside = age >= line.xmin && age <= line.xmax;
      pic = plot(line, { focus: 'predict', predictions: [{ x: age, y, inside }] });
      caption = t(inside ? 'ml.cap.predict' : 'ml.cap.predictOut', { age, y: round(y), min: line.xmin, max: line.xmax });
      controls = el('label.ml-slider',
        el('span.ml-slider-label', t('ml.age', { age })),
        el('input', { type: 'range', min: 10, max: 95, step: 1, value: age, 'aria-label': t('ml.ageAria'),
          onInput: (e) => { age = Number(e.target.value); draw(); } }));
    } else if (step === 'split') {
      pic = plot(f1.line, { focus: 'predict', predictions: testPoints(d, f1.line), misses: false });
      caption = t('ml.cap.split', { learn: f1.line.xs.length, test: d.test.wiek.length });
    } else if (step === 'error') {
      pic = plot(f1.line, { focus: 'predict', predictions: testPoints(d, f1.line) });
      caption = t('ml.cap.error', { learn: round(f1.learn), test: round(f1.test) });
    } else if (step === 'flex') {
      const fit = d.fits[degree - 1];
      pic = el('div', plot(fit.line, { focus: 'predict', predictions: testPoints(d, fit.line) }), bars());
      // Overfitting: better on the learning people than the line, worse than the line on new ones.
      caption = t(degree === 1 ? 'ml.cap.flex1' : fit.test > f1.test + 1 && fit.learn < f1.learn ? 'ml.cap.flexOver' : 'ml.cap.flex',
        { k: degree, bends: degree - 1, learn: round(fit.learn), test: round(fit.test) });
      controls = el('label.ml-slider',
        el('span.ml-slider-label', t('ml.degree', { k: degree, bends: degree - 1 })),
        el('input', { type: 'range', min: 1, max: MAX_DEGREE, step: 1, value: degree, 'aria-label': t('ml.degreeAria'),
          onInput: (e) => { degree = Number(e.target.value); draw(); } }));
    } else {
      // The terms: a card per word, with the exercise or lab where it is practised.
      pic = el('div.ml-terms', (picture.terms || []).map((term) => el('div.ml-term',
        el('div.ml-term-name', { html: markup(term.name) }),
        el('div.ml-term-say', { html: markup(term.say) }))));
      caption = t('ml.cap.terms');
    }
    // A slider keeps its focus across redraws: after the first draw only its label changes.
    if (!mounted) {
      mounted = true;
      if (controls) {
        sliderLabel = controls.firstChild;
        mount(left, controls, el('p.ml-hint', t('ml.hint')), slot);
      } else {
        mount(left, slot);
      }
    } else if (controls && sliderLabel) {
      sliderLabel.textContent = controls.firstChild.textContent;
    }
    mount(stage, el('div.st-pic', pic), el('div.st-caption', caption));
  }

  draw();
  return { left, stage };
}

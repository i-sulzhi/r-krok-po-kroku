/**
 * Lesson: will the model guess new people? -- module 12, lecture 6 (D110).
 *
 * The first exercise of the caret lecture (plan: docs/lecture-6-design.md). One idea:
 * a model is checked on people it did not see. The 30 ESS internet users of exercise
 * 37 are split once with `set.seed(2)` and `sample()`: 20 people build the line
 * (`uczace`), 10 are hidden from it (`testowe`). `predict(m, testowe)` guesses the
 * hidden ten, and the picture draws each miss, as residuals were drawn in 36.
 *
 * The silent trap: `sample()` without `set.seed()` gives another split on every run,
 * so another answer. The engine draws exactly as R does (src/core/rng.js), so the
 * same seed gives the same people here and in RStudio.
 *
 * Numbers checked in R 4.6.2: rows 21 15 6 28 8 17 25 12 9 18 11 1 3 16 24 2 30 7 26 13
 * learn; the test forecasts are 262.62 ... 105.53; misses from 14 to 256 minutes.
 */

import { resultCheck, typedIn } from './schema.js';
import { isAtomic, rLength, isDataFrame } from '../core/rvalue.js';
import { isModel } from '../core/builtins/models.js';

const SETUP = `# 30 internautów z ESS 2023, Polska: wiek i minuty w sieci
# dziennie (pytanie zadano tylko korzystającym z internetu)
ess <- data.frame(
  wiek = c(15, 16, 17, 20, 22, 22, 23, 23, 24, 27,
           27, 27, 31, 38, 39, 40, 40, 41, 42, 45,
           48, 57, 58, 60, 64, 66, 67, 77, 79, 84),
  minuty = c(480, 300, 90, 360, 240, 120, 180, 360, 360,
             500, 120, 300, 180, 300, 120, 270, 210, 300,
             60, 90, 240, 330, 120, 90, 150, 120, 300,
             180, 120, 60)
)`;

const DRAW = 'set.seed(2)\nnr <- sample(nrow(ess), 20)';
const SPLIT = `${DRAW}\nuczace <- ess[nr, ]\ntestowe <- ess[-nr, ]`;
const MODEL = 'm <- lm(minuty ~ wiek, data = uczace)';
const PRED = 'predict(m, testowe)';
const SOLUTION = `${SPLIT}\n${MODEL}\n${PRED}`;

const base = resultCheck({ expected: SOLUTION, compare: { tolerance: 0.01 } });
/** The numbers must come from predict(), not be typed in. */
const fromModel = (code) => /\b(predict|fitted|coef)\s*\(/.test(String(code || ''));
function check(ctx) {
  if (!fromModel(ctx.code)) return { ok: false, reason: 'typed' };
  return base(ctx);
}
check.compare = base.compare;

/** The forecasts of a line built on all 30 people: the hidden ten leaked into it. */
const LEAK = [277.57, 272.32, 259.2, 230.33, 219.83, 211.96, 180.46, 177.84, 154.21, 122.72];

export const modelSplit = {
  id: 'model-split',
  module: 12,
  lecture: 6,
  requires: ['model-report'],
  title: 'Czy model zgadnie nowych ludzi?',
  setup: SETUP,

  scenes: [
    {
      say: 'Prosta ma przewidywać ludzi spoza ankiety. Dotąd sprawdzaliśmy ją na tych samych osobach.',
      code: 'lm(minuty ~ wiek, data = ess)',
      pick: 'lm(minuty ~ wiek, data = ess)',
    },
    {
      say: '`sample()` losuje 20 numerów wierszy z 30. Tych ludzi prosta dostanie do nauki.',
      code: DRAW,
      pick: 'sample(nrow(ess), 20)',
    },
    {
      say: '`set.seed(2)` ustala losowanie. Ta sama liczba daje tych samych ludzi, tu i w RStudio.',
      code: DRAW,
      pick: 'sample(nrow(ess), 20)',
      tap: 'set.seed(2)',
    },
    {
      say: '`ess[nr, ]` to 20 wylosowanych osób. Minus w `ess[-nr, ]` daje pozostałe 10, testowe.',
      code: SPLIT,
      pick: 'ess[-nr, ]',
      tap: 'ess[nr, ]',
    },
    {
      say: 'Prosta powstaje tylko z 20 osób w `uczace`. Testowych **nie widzi**.',
      code: `${SPLIT}\n${MODEL}`,
      pick: 'lm(minuty ~ wiek, data = uczace)',
    },
    {
      say: '`predict(m, testowe)` zgaduje minuty 10 nowych osób. Kreska to **pomyłka** prostej.',
      code: `${SPLIT}\n${MODEL}\n${PRED}`,
      pick: PRED,
    },
    {
      say: 'Bez `set.seed()` każde losowanie daje innych ludzi. Wyniku nie da się wtedy powtórzyć.',
      code: 'sample(nrow(ess), 20)\nsample(nrow(ess), 20)',
      pick: 'sample(nrow(ess), 20)',
    },
  ],

  play: {
    say: 'Twoja kolej. Zmień liczbę w `set.seed()` albo zobacz, kogo prosta zgaduje.',
    keep: `${SPLIT}\n${MODEL}`,
    code: PRED,
    chips: [
      'predict(m)',
      'nrow(uczace)',
      'testowe',
      'sample(nrow(ess), 20)',
      'set.seed(7); sample(nrow(ess), 20)',
    ],
  },

  task: {
    prompt: 'Zbuduj prostą tylko na 20 osobach z `uczace` i przewidź minuty w sieci 10 osób z `testowe`.',
    starter: `${SPLIT}\n`,
    check,
    solution: SOLUTION,
    hints: [
      'Prosta uczy się tylko na `uczace`: `lm(minuty ~ wiek, data = uczace)`.',
      'Nowe osoby podajesz drugim argumentem: `predict(m, testowe)`.',
    ],
    messages: {
      typed: 'Liczby mają wyjść z modelu, nie z rysunku. Użyj `predict(m, testowe)`.',
      model: 'To cały model. Prognozy dla nowych osób daje `predict(m, testowe)`.',
      learning: 'To prognozy dla 20 osób z `uczace`, które prosta już widziała. Nowe osoby to `testowe`: `predict(m, testowe)`.',
      leak: 'To właściwe 10 osób, ale prosta uczyła się na całym `ess`, także na nich. Zbuduj ją tylko na `uczace`.',
      all30: 'To prognozy dla wszystkich 30 osób. Zadanie chce tylko 10 z `testowe`.',
      table: 'To tabela. Prognozy daje `predict(m, testowe)`.',
      general: 'Jeszcze nie to: `m <- lm(minuty ~ wiek, data = uczace)`, potem `predict(m, testowe)`.',
    },
    success: 'Dobrze. 20-latek z testowych dostaje 263 minuty, a ma 360.',
    note: 'Pomyłki sięgają od 14 do 256 minut. Jak zebrać je w jedną liczbę, pokaże następne ćwiczenie.',

    nearMisses: [
      { name: 'the model printed', expect: 'model', code: `${SPLIT}\n${MODEL}\nm` },
      { name: 'the learning people forecast', expect: 'learning', code: `${SPLIT}\n${MODEL}\npredict(m)` },
      { name: 'the fitted values', expect: 'learning', code: `${SPLIT}\n${MODEL}\nfitted(m)` },
      { name: 'the model built on everyone', expect: 'leak', code: `${SPLIT}\nm <- lm(minuty ~ wiek, data = ess)\npredict(m, testowe)` },
      { name: 'all 30 people forecast', expect: 'all30', code: `${SPLIT}\n${MODEL}\npredict(m, ess)` },
      { name: 'numbers typed in', expect: 'typed', code: `${SPLIT}\nc(263, 257, 244, 215, 204, 196, 164, 161, 137, 106)` },
      { name: 'the test table itself', expect: 'table', code: `${SPLIT}\n${MODEL}\ntestowe` },
      { name: 'the split drawn with another seed', expect: 'general', code: `set.seed(7)\nnr <- sample(nrow(ess), 20)\nuczace <- ess[nr, ]\ntestowe <- ess[-nr, ]\n${MODEL}\n${PRED}` },
    ],

    diagnose({ value, code, result }) {
      if (isModel(value)) return 'model';
      if (result?.reason === 'typed' && typedIn(code)) return 'typed';
      if (isDataFrame(value)) return 'table';
      if (!value || !isAtomic(value)) return 'general';
      if (rLength(value) === 20) return 'learning';
      if (rLength(value) === 30) return 'all30';
      const xs = value.values.map(Number);
      if (xs.length === 10 && xs.every((x, i) => Math.abs(x - LEAK[i]) < 0.01)) return 'leak';
      return 'general';
    },
  },
};

export default modelSplit;

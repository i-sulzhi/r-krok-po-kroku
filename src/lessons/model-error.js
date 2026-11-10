/**
 * Lesson: how far off is the forecast? -- module 12, lecture 6 (D111).
 *
 * Exercise 42 ended with ten misses. This one turns them into one number in minutes:
 * RMSE, the root of the mean squared miss. It is the sum of squares of exercise 36
 * brought back to the data's units. Then the number is read against two others: the
 * same measure on the 20 learning people (94: on its own data the line looks better)
 * and a forecast without any model, the learning average for everyone (138: the line
 * helps by 7 minutes). R² (0.25) is said once to be a different thing.
 *
 * The silent trap: reporting the error on the learning data as the error of forecasts.
 *
 * Numbers checked in R 4.6.2 (plan, section 4): RMSE on the test people 130.56; on the
 * learning people 94.26; sigma 99.36; MAE 109.04; the learning mean 211.5 misses by
 * 137.94; R² of the learning line 0.249.
 */

import { typedIn } from './schema.js';
import { isAtomic, rLength, isDataFrame, isNA } from '../core/rvalue.js';
import { isModel, isModelSummary } from '../core/builtins/models.js';

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

const SPLIT = 'set.seed(2)\nnr <- sample(nrow(ess), 20)\nuczace <- ess[nr, ]\ntestowe <- ess[-nr, ]';
const BASE = `${SPLIT}\nm <- lm(minuty ~ wiek, data = uczace)\nprognoza <- predict(m, testowe)`;
const MISSES = 'bledy <- testowe$minuty - prognoza';
const RMSE = 'sqrt(mean(bledy^2))';
const MEAN_ONLY = 'srednia <- mean(uczace$minuty)\nsqrt(mean((testowe$minuty - srednia)^2))';
const SOLUTION = `${BASE}\n${MISSES}\n${RMSE}`;

const TARGET = 130.5606;

/** One number near 130.56, computed from the forecasts. */
function check({ value, code }) {
  if (typedIn(code)) return { ok: false, reason: 'typed' };
  if (!value || !isAtomic(value) || rLength(value) !== 1 || isNA(value.values[0])) return { ok: false, reason: 'wrong-value' };
  return Math.abs(Number(value.values[0]) - TARGET) < 0.05 ? { ok: true } : { ok: false, reason: 'wrong-value' };
}
check.compare = {};

/** Other measures a student may compute instead, each with its own message. */
const NEAR = [
  [94.2569, 'learning'],
  [99.3555, 'sigma'],
  [109.043, 'mae'],
  [17046.08, 'noRoot'],
  [6.8757, 'noSquare'],
  [107.7262, 'all30'],
  [137.9357, 'meanOnly'],
  [0.2492, 'r2'],
];

export const modelError = {
  id: 'model-error',
  module: 12,
  lecture: 6,
  requires: ['model-split'],
  title: 'O ile się myli?',
  setup: SETUP,

  scenes: [
    {
      say: 'Pomyłka to prawdziwe minuty minus prognoza. Dziesięć osób daje dziesięć pomyłek.',
      code: `${BASE}\n${MISSES}`,
      pick: 'testowe$minuty - prognoza',
    },
    {
      say: 'Plus i minus by się zniosły, jak w ćwiczeniu {ćw:model-residuals}. Dlatego pomyłki idą **do kwadratu**.',
      code: `${BASE}\n${MISSES}\nbledy^2`,
      pick: 'bledy^2',
    },
    {
      say: 'Średnia kwadratów i pierwiastek wracają do minut. Ta liczba to **RMSE**, typowa pomyłka.',
      code: `${BASE}\n${MISSES}\n${RMSE}`,
      pick: RMSE,
      tap: 'mean(bledy^2)',
    },
    {
      say: 'Dla nowej osoby prosta myli się zwykle o **131 minut**, czyli ponad dwie godziny.',
      code: `${BASE}\n${MISSES}\n${RMSE}`,
      pick: RMSE,
    },
    {
      say: 'Na 20 osobach z `uczace` ta sama miara daje **94**. Na swoich danych prosta wygląda lepiej.',
      code: `${BASE}\nsqrt(mean(residuals(m)^2))`,
      pick: 'sqrt(mean(residuals(m)^2))',
    },
    {
      say: 'Bez modelu, ze średnią 211.5 dla każdego, pomyłka to **138**. Prosta pomaga o 7 minut.',
      code: `${SPLIT}\n${MEAN_ONLY}`,
      pick: 'sqrt(mean((testowe$minuty - srednia)^2))',
      tap: 'mean(uczace$minuty)',
    },
    {
      say: 'R² prostej to 0.25. Mówi, ile różnic prosta śledzi, a nie o ile myli się prognoza.',
      code: `${BASE}\nsummary(m)$r.squared`,
      pick: 'summary(m)$r.squared',
    },
  ],

  play: {
    say: 'Twoja kolej. Porównaj RMSE z innymi miarami pomyłki, np. średnią bez znaku.',
    keep: `${BASE}\n${MISSES}`,
    code: RMSE,
    chips: [
      'mean(abs(bledy))',
      'max(abs(bledy))',
      'sqrt(mean(residuals(m)^2))',
      'summary(m)$sigma',
      'bledy',
    ],
  },

  task: {
    prompt: 'Policz RMSE prostej dla 10 osób z `testowe`, czyli pierwiastek ze średniej kwadratów pomyłek.',
    starter: `${BASE}\n`,
    check,
    solution: SOLUTION,
    hints: [
      'Najpierw pomyłki: `testowe$minuty - prognoza`. Potem ich kwadraty, `^2`.',
      'Z kwadratów średnia, `mean()`, a ze średniej pierwiastek, `sqrt()`.',
    ],
    messages: {
      typed: 'Liczba ma wyjść z kodu, nie z rysunku. Policz ją z `prognoza` i `testowe$minuty`.',
      model: 'To cały model. Potrzebna jest jedna liczba: pierwiastek ze średniej kwadratów pomyłek.',
      summary: 'To opis modelu na danych uczących. Pomyłkę na nowych osobach policz z `prognoza`.',
      vector: 'To wszystkie pomyłki osobno. Zrób z nich jedną liczbę: `sqrt(mean(...^2))`.',
      table: 'To tabela. Potrzebna jest jedna liczba w minutach.',
      learning: 'To pomyłka na 20 osobach z `uczace`, które prosta widziała. Zadanie pyta o `testowe`.',
      sigma: '`sigma` z `summary()` też liczy się na danych uczących. Zadanie pyta o nowe osoby z `testowe`.',
      mae: 'To średnia pomyłka bez znaku (MAE), dobra miara, ale inna. Tu potrzebne są kwadraty i pierwiastek.',
      noRoot: 'To średnia kwadratów, w minutach do kwadratu. Wyciągnij z niej pierwiastek: `sqrt()`.',
      noSquare: 'Bez kwadratów plus i minus się zniosły. Najpierw `^2`, potem średnia i pierwiastek.',
      all30: 'To pomyłka na wszystkich 30 osobach, także tych, na których prosta się uczyła. Policz tylko `testowe`.',
      meanOnly: 'To pomyłka prognozy bez modelu, ze średnią dla każdego. Zadanie pyta o prostą: użyj `prognoza`.',
      r2: 'To R², udział wyjaśnionych różnic. Zadanie pyta o pomyłkę w minutach.',
      general: 'Jeszcze nie to: `sqrt(mean((testowe$minuty - prognoza)^2))`.',
    },
    success: 'Dobrze. Prosta myli się zwykle o 131 minut.',
    note: 'Średnia pomyłka bez znaku (MAE) to tu 109 minut. RMSE mocniej karze duże pomyłki, jak kwadraty w ćwiczeniu {ćw:model-residuals}.',

    nearMisses: [
      { name: 'the misses one by one', expect: 'vector', code: `${BASE}\ntestowe$minuty - prognoza` },
      { name: 'the learning data', expect: 'learning', code: `${BASE}\nsqrt(mean(residuals(m)^2))` },
      { name: 'sigma from summary()', expect: 'sigma', code: `${BASE}\nsummary(m)$sigma` },
      { name: 'the mean absolute miss', expect: 'mae', code: `${BASE}\nmean(abs(testowe$minuty - prognoza))` },
      { name: 'no root', expect: 'noRoot', code: `${BASE}\nmean((testowe$minuty - prognoza)^2)` },
      { name: 'no square', expect: 'noSquare', code: `${BASE}\nsqrt(mean(testowe$minuty - prognoza))` },
      { name: 'all 30 people', expect: 'all30', code: `${BASE}\nsqrt(mean((ess$minuty - predict(m, ess))^2))` },
      { name: 'the average-only forecast', expect: 'meanOnly', code: `${BASE}\n${MEAN_ONLY}` },
      { name: 'R squared', expect: 'r2', code: `${BASE}\nsummary(m)$r.squared` },
      { name: 'a number typed in', expect: 'typed', code: `${BASE}\n130.56` },
      { name: 'the model printed', expect: 'model', code: `${BASE}\nm` },
    ],

    diagnose({ value, code, result }) {
      if (isModel(value)) return 'model';
      if (isModelSummary(value)) return 'summary';
      if (result?.reason === 'typed' && typedIn(code)) return 'typed';
      if (isDataFrame(value)) return 'table';
      if (!value || !isAtomic(value)) return 'general';
      if (rLength(value) > 1) return 'vector';
      const x = Number(value.values[0]);
      const hit = NEAR.find(([v]) => Math.abs(x - v) <= Math.max(0.01, Math.abs(v) * 0.0005));
      return hit ? hit[1] : 'general';
    },
  },
};

export default modelError;

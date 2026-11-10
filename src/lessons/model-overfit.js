/**
 * Lesson: a curve too good -- module 12, lecture 6 (D112).
 *
 * Overfitting, the plan's exercise 44. It opens with the question a student asks: the
 * curve passes closer to the points, so why not forecast with it? `poly(wiek, 5)` is
 * polynomial regression, still lm(): five columns, age and its powers, as sex was a
 * column in exercise 40 (D117). The answer is not "lines beat curves": on an arc, as
 * income in 34, a curve would win; the error on new people decides.
 * On the 20 learning people the curve wins on every number the student knows: R²
 * 0.35 against 0.25, error 88 against 94 minutes. On the 10 people it never saw it
 * loses: 145 minutes against the line's 131, and worse than the plain average (138).
 * The picture draws the curve over the points (src/ui/viz/model.js, `curve`), then its
 * misses on the new people.
 *
 * The silent trap: choosing the model with the higher R² on its own data.
 *
 * Numbers checked in R 4.6.2 (plan, section 4): R² 0.2492 and 0.3526; learning error
 * 94.26 and 87.53; test error 130.56 and 145.11.
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
const LINE = 'm1 <- lm(minuty ~ wiek, data = uczace)';
const CURVE = 'm5 <- lm(minuty ~ poly(wiek, 5), data = uczace)';
const BOTH = `${SPLIT}\n${LINE}\n${CURVE}`;
const TEST1 = 'sqrt(mean((testowe$minuty - predict(m1, testowe))^2))';
const TEST5 = 'sqrt(mean((testowe$minuty - predict(m5, testowe))^2))';
const SOLUTION = `${BOTH}\n${TEST1}`;

const TARGET = 130.5606;

function check({ value, code }) {
  if (typedIn(code)) return { ok: false, reason: 'typed' };
  if (!value || !isAtomic(value) || rLength(value) !== 1 || isNA(value.values[0])) return { ok: false, reason: 'wrong-value' };
  return Math.abs(Number(value.values[0]) - TARGET) < 0.05 ? { ok: true } : { ok: false, reason: 'wrong-value' };
}
check.compare = {};

const NEAR = [
  [145.1086, 'curveTest'],
  [87.5258, 'curveLearning'],
  [94.2569, 'lineLearning'],
  [0.3526, 'r2'],
  [0.2492, 'r2'],
  [107.7262, 'all30'],
  [110.1182, 'all30'],
  [137.9357, 'meanOnly'],
];

export const modelOverfit = {
  id: 'model-overfit',
  module: 12,
  lecture: 6,
  requires: ['model-error'],
  title: 'Za dobra krzywa',
  setup: SETUP,

  scenes: [
    {
      say: 'Krzywa przechodzi bliżej punktów niż prosta. Może lepiej przewidywać **krzywą**?',
      code: `${SPLIT}\n${CURVE}`,
      pick: 'lm(minuty ~ poly(wiek, 5), data = uczace)',
    },
    {
      say: 'To **regresja wielomianowa**. `poly()` dodaje kolumny wiek² aż do wiek⁵, jak płeć w ćw. {ćw:model-control}.',
      code: `${SPLIT}\n${CURVE}\ncoef(m5)`,
      pick: 'coef(m5)',
    },
    {
      say: 'Na 20 uczących krzywa wygrywa. R² **0.35** i pomyłka **88**, a u prostej 0.25 i 94.',
      code: `${BOTH}\nsummary(m5)$r.squared\nsqrt(mean(residuals(m5)^2))`,
      pick: 'summary(m5)$r.squared',
      tap: 'sqrt(mean(residuals(m5)^2))',
    },
    {
      say: 'Teraz 10 nowych osób. Krzywa gnie się do ludzi z `uczace`, a nowi stoją gdzie indziej.',
      code: `${BOTH}\npredict(m5, testowe)`,
      pick: 'predict(m5, testowe)',
    },
    {
      say: 'Na nowych osobach krzywa myli się o **145** minut. Prosta o 131, a sama średnia o 138.',
      code: `${BOTH}\n${TEST5}\n${TEST1}`,
      pick: TEST5,
      tap: TEST1,
    },
    {
      say: 'Więcej kolumn to więcej swobody. Krzywa dopasowała się do 20 osób, to **przeuczenie**.',
      code: `${BOTH}\nresiduals(m5)`,
      pick: 'residuals(m5)',
    },
    {
      say: 'Krzywa nie jest zła. Przy łuku dochodu z ćw. {ćw:model-cor} by wygrała. Decyduje pomyłka na nowych.',
      code: `${BOTH}\n${TEST1}`,
      pick: TEST1,
    },
  ],

  play: {
    say: 'Twoja kolej. Zmień stopień w `poly()` i porównaj obie pomyłki.',
    keep: BOTH,
    code: 'm3 <- lm(minuty ~ poly(wiek, 3), data = uczace)\nsqrt(mean((testowe$minuty - predict(m3, testowe))^2))',
    chips: [
      'sqrt(mean(residuals(m5)^2))',
      TEST5,
      'm2 <- lm(minuty ~ poly(wiek, 2), data = uczace); m2',
      'summary(m5)$r.squared',
      'coef(m5)',
    ],
  },

  task: {
    prompt: 'Który model lepiej przewiduje nowe osoby, prosta `m1` czy krzywa `m5`? Podaj RMSE lepszego na `testowe`.',
    starter: `${BOTH}\n`,
    check,
    solution: SOLUTION,
    hints: [
      'Policz RMSE obu na `testowe`, jak w ćwiczeniu {ćw:model-error}: `sqrt(mean((testowe$minuty - predict(m, testowe))^2))`.',
      'Lepszy jest model z mniejszą pomyłką na nowych osobach. Podaj jego liczbę.',
    ],
    messages: {
      typed: 'Liczba ma wyjść z kodu, nie z rysunku. Policz RMSE z `predict(..., testowe)`.',
      model: 'To cały model. Potrzebna jest jedna liczba: RMSE lepszego modelu na `testowe`.',
      summary: 'To opis modelu na danych uczących. Zadanie pyta o pomyłkę na `testowe`.',
      vector: 'To wiele liczb naraz. Zrób z pomyłek jedną: `sqrt(mean(...^2))`.',
      table: 'To tabela. Potrzebna jest jedna liczba w minutach.',
      curveTest: 'To pomyłka krzywej na nowych osobach, 145 minut. Prosta myli się mniej. Podaj jej wynik.',
      curveLearning: 'To pomyłka krzywej na `uczace`. Na swoich danych krzywa wygląda dobrze. Zadanie pyta o `testowe`.',
      lineLearning: 'To pomyłka prostej na `uczace`. Zadanie pyta o nowe osoby z `testowe`.',
      r2: 'To R² na danych uczących. Nie mówi, jak model radzi sobie z nowymi osobami. Policz RMSE na `testowe`.',
      all30: 'To pomyłka na wszystkich 30 osobach, także tych, na których model się uczył. Policz tylko `testowe`.',
      meanOnly: 'To pomyłka samej średniej. Zadanie pyta o lepszy z dwóch modeli.',
      general: 'Jeszcze nie to. Policz RMSE prostej i krzywej na `testowe` i podaj mniejsze.',
    },
    success: 'Dobrze. Prosta, 131 minut. Krzywa myli się o 145.',
    note: 'Krzywa miała lepsze R² i mniejszą pomyłkę na swoich danych. Na nowych osobach przegrała z prostą i ze średnią.',

    nearMisses: [
      { name: 'the curve on the test people', expect: 'curveTest', code: `${BOTH}\n${TEST5}` },
      { name: 'the curve on its own data', expect: 'curveLearning', code: `${BOTH}\nsqrt(mean(residuals(m5)^2))` },
      { name: 'the line on its own data', expect: 'lineLearning', code: `${BOTH}\nsqrt(mean(residuals(m1)^2))` },
      { name: 'the better R squared', expect: 'r2', code: `${BOTH}\nsummary(m5)$r.squared` },
      { name: 'the line on all 30', expect: 'all30', code: `${BOTH}\nsqrt(mean((ess$minuty - predict(m1, ess))^2))` },
      { name: 'both errors at once', expect: 'vector', code: `${BOTH}\nc(${TEST1}, ${TEST5})` },
      { name: 'a number typed in', expect: 'typed', code: `${BOTH}\n130.56` },
      { name: 'the curve printed', expect: 'model', code: `${BOTH}\nm5` },
      { name: 'the summary printed', expect: 'summary', code: `${BOTH}\nsummary(m5)` },
    ],

    diagnose({ value, code, result }) {
      if (isModel(value)) return 'model';
      if (isModelSummary(value)) return 'summary';
      if (result?.reason === 'typed' && typedIn(code)) return 'typed';
      if (isDataFrame(value)) return 'table';
      if (!value || !isAtomic(value)) return 'general';
      if (rLength(value) > 1) return 'vector';
      const x = Number(value.values[0]);
      const hit = NEAR.find(([v]) => Math.abs(x - v) <= Math.max(0.001, Math.abs(v) * 0.0005));
      return hit ? hit[1] : 'general';
    },
  },
};

export default modelOverfit;

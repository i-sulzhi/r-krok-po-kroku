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

import { isAtomic, isDataFrame } from '../core/rvalue.js';
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
const SOLUTION = `${BOTH}\n${TEST1}\n${TEST5}\nm1`;

const isCurve = (m) => m.lm.terms.some((tm) => tm.kind === 'poly');

/** The better model named, after both errors were computed: the line on uczace. */
function check({ value, code }) {
  if (!isModel(value) || isCurve(value)) return { ok: false, reason: 'wrong-value' };
  const info = value.lm;
  if (info.responseCode !== 'minuty' || info.terms.length !== 1 || info.terms[0].code !== 'wiek' || info.n !== 20) return { ok: false, reason: 'wrong-value' };
  if (!/predict\s*\(\s*m5\s*,/.test(String(code || ''))) return { ok: false, reason: 'wrong-value' };
  return { ok: true };
}
check.compare = {};

export const modelOverfit = {
  id: 'model-overfit',
  module: 12,
  lecture: 6,
  requires: ['model-error'],
  title: 'Za dobra krzywa',
  setup: SETUP,

  scenes: [
    {
      say: 'Krzywa leży bliżej punktów niż prosta. Może lepiej przewidywać **krzywą**? Stopień 5 to pokaz.',
      code: `${SPLIT}\n${CURVE}`,
      pick: 'lm(minuty ~ poly(wiek, 5), data = uczace)',
    },
    {
      say: '**Regresja wielomianowa**, wciąż `lm()`. `poly()` dodaje kolumny wiek² aż do wiek⁵.',
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
      say: 'Na nowych osobach krzywa myli się o **145** minut, prosta o 131. Inne losowanie, inne liczby.',
      code: `${BOTH}\n${TEST5}\n${TEST1}`,
      pick: TEST5,
      tap: TEST1,
    },
    {
      say: 'Więcej kolumn, więcej swobody. Krzywa zapamiętała 20 osób: **przeuczenie** (overfitting).',
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
    prompt: 'Który model lepiej przewiduje nowe osoby, prosta `m1` czy krzywa `m5`? Policz obie pomyłki na `testowe`, w ostatniej linii podaj lepszy.',
    starter: `${BOTH}\n`,
    check,
    solution: SOLUTION,
    hints: [
      'Kolumny z `poly()` wchodzą do modelu jak płeć w ćwiczeniu {ćw:model-control}. RMSE obu na `testowe` liczysz jak w ćwiczeniu {ćw:model-error}.',
      'Lepszy jest model z mniejszą pomyłką na nowych osobach. Ostatnia linia to jego nazwa: `m1` albo `m5`.',
    ],
    messages: {
      number: 'To liczba. Zadanie prosi o model: ostatnia linia ma być nazwą lepszego, `m1` albo `m5`.',
      curve: 'Krzywa myli się na nowych osobach o 145 minut, prosta o 131. Lepszy jest ten z mniejszą pomyłką.',
      summary: 'To opis modelu na danych uczących. Zadanie pyta, który model lepiej przewiduje nowe osoby.',
      table: 'To tabela. Ostatnia linia ma być nazwą lepszego modelu, `m1` albo `m5`.',
      general: 'Jeszcze nie to. Policz RMSE prostej i krzywej na `testowe` i podaj ten z mniejszą pomyłką.',
    },
    success: 'Dobrze, prosta. Myli się o 131 minut, krzywa o 145.',
    note: 'Krzywa miała lepsze R² i mniejszą pomyłkę na swoich danych. Na nowych osobach przegrała z prostą.',

    nearMisses: [
      { name: 'the curve chosen', expect: 'curve', code: `${BOTH}\n${TEST1}\n${TEST5}\nm5` },
      { name: 'the line\'s error as the answer', expect: 'number', code: `${BOTH}\n${TEST1}` },
      { name: 'the curve\'s error as the answer', expect: 'number', code: `${BOTH}\n${TEST5}` },
      { name: 'the better R squared', expect: 'number', code: `${BOTH}\nsummary(m5)$r.squared` },
      { name: 'the summary printed', expect: 'summary', code: `${BOTH}\nsummary(m1)` },
      { name: 'the test table', expect: 'table', code: `${BOTH}\ntestowe` },
      { name: 'the line without the errors computed', expect: 'general', code: `${BOTH}\nm1` },
    ],

    diagnose({ value, code }) {
      if (isModel(value)) return isCurve(value) ? 'curve' : 'general';
      if (isModelSummary(value)) return 'summary';
      if (isDataFrame(value)) return 'table';
      if (value && isAtomic(value)) return 'number';
      return 'general';
    },
  },
};

export default modelOverfit;

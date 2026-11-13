/**
 * Lesson: five times in turn -- module 12, lecture 6 (D113).
 *
 * Cross-validation, the plan's exercise 45. One split is one draw: with set.seed(7)
 * instead of 2 the same line misses by 116, not 131. So the 30 people get a part
 * number 1-5 (`sample(rep(1:5, 6))`), each part is the test set once, and the five
 * errors are averaged: line 104, the plain average 117, the curve of degree 5 128.
 *
 * Loops and functions are not taught (author's decision, plan 9.3): the scenes run
 * round 1 with `filter()`, then show all five rounds with sapply(), saying that its
 * syntax need not be learned; the task asks for round 3 by hand. caret, which does
 * the five rounds in one call, is named in the note and left to lab 2 in RStudio.
 *
 * Numbers checked in R 4.6.2 (plan, section 4): folds 1 5 1 3 3 2 5 2 4 3 ...; round
 * errors of the line 147.07 105.90 124.71 91.73 52.48, mean 104.38; average only
 * 116.78; curve 128.24; set.seed(7) split 115.95.
 */

import { typedIn } from './schema.js';
import { isAtomic, rLength, isDataFrame, isNA } from '../core/rvalue.js';
import { isModel, isModelSummary } from '../core/builtins/models.js';

const ESS = `# 30 internautów z ESS 2023, Polska: wiek i minuty w sieci
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

const FOLDS = 'set.seed(2)\ness$czesc <- sample(rep(1:5, 6))';

const SETUP = ESS;

// The five rounds on screen. sapply() and function() are not taught: the scene says
// so, and says what they do (the same round for parts 1 to 5).
const SAPPLY = `sapply(1:5, function(k) {
  uczace <- ess |> filter(czesc != k)
  testowe <- ess |> filter(czesc == k)
  m <- lm(minuty ~ wiek, data = uczace)
  sqrt(mean((testowe$minuty - predict(m, testowe))^2))
})`;
const ROUNDS = `${FOLDS}\nwyniki <- ${SAPPLY}`;
const CURVE_ROUNDS = `${FOLDS}
krzywa <- sapply(1:5, function(k) {
  uczace <- ess |> filter(czesc != k)
  testowe <- ess |> filter(czesc == k)
  m <- lm(minuty ~ poly(wiek, 5), data = uczace)
  sqrt(mean((testowe$minuty - predict(m, testowe))^2))
})`;

const SEED7 = 'set.seed(7)\nnr <- sample(nrow(ess), 20)\nuczace <- ess[nr, ]\ntestowe <- ess[-nr, ]\nm <- lm(minuty ~ wiek, data = uczace)';
const RMSE = 'sqrt(mean((testowe$minuty - predict(m, testowe))^2))';
const ROUND1 = `${FOLDS}\nuczace <- ess |> filter(czesc != 1)\ntestowe <- ess |> filter(czesc == 1)`;
const MODEL = 'm <- lm(minuty ~ wiek, data = uczace)';
const ROUND3 = `${FOLDS}\nuczace <- ess |> filter(czesc != 3)\ntestowe <- ess |> filter(czesc == 3)\n${MODEL}\n${RMSE}`;
const CARET = 'train(minuty ~ wiek, data = ess, method = "lm")';

const TARGET = 124.7139;

/** Round 3 computed from the data, not read off `wyniki` or typed in. */
function check({ value, code }) {
  if (typedIn(code)) return { ok: false, reason: 'typed' };
  if (!value || !isAtomic(value) || rLength(value) !== 1 || isNA(value.values[0])) return { ok: false, reason: 'wrong-value' };
  if (Math.abs(Number(value.values[0]) - TARGET) >= 0.05) return { ok: false, reason: 'wrong-value' };
  // The right number read off `wyniki` (wyniki[3]) skips the round the task is about.
  const lines = String(code || '').split('\n').map((l) => l.trim()).filter(Boolean);
  return /\bwyniki\b/.test(lines[lines.length - 1] || '') ? { ok: false, reason: 'fromResults' } : { ok: true };
}
check.compare = {};

const NEAR = [
  [147.0679, 'round1'],
  [127.827, 'swapped'],
  [102.2603, 'learning'],
  [108.6598, 'same'],
  [104.376, 'mean'],
  [137.4992, 'curve'],
];

export const modelCv = {
  id: 'model-cv',
  module: 12,
  lecture: 6,
  requires: ['model-overfit'],
  title: 'Pięć razy na zmianę',
  setup: SETUP,

  scenes: [
    {
      say: 'Z `set.seed(7)` ta sama prosta myli się o **116**, nie o 131. Który wynik jest prawdziwy?',
      code: `${SEED7}\n${RMSE}`,
      pick: RMSE,
    },
    {
      say: 'Lepiej podzielić ludzi na **5 części** po 6 osób. Każdy dostaje numer części od 1 do 5.',
      code: `${FOLDS}\ntable(ess$czesc)`,
      pick: 'sample(rep(1:5, 6))',
      tap: 'table(ess$czesc)',
    },
    {
      say: 'Runda 1. Część 1 jest testowa, części 2–5 uczą prostą. Dzieli je `filter()`.',
      code: ROUND1,
      pick: 'ess |> filter(czesc == 1)',
      tap: 'ess |> filter(czesc != 1)',
    },
    {
      say: 'Prosta z 24 osób myli się u 6 testowych o **147** minut. To wynik jednej rundy.',
      code: `${ROUND1}\n${MODEL}\npredict(m, testowe)`,
      pick: 'predict(m, testowe)',
    },
    {
      say: '`sapply()` powtarza tę rundę dla części 1–5. Jej składni nie trzeba umieć, wynik to 5 liczb.',
      code: ROUNDS,
      pick: SAPPLY,
    },
    {
      say: 'Średnia pięciu rund to **104** minuty. Każdego sprawdziła prosta, która go nie widziała.',
      code: `${ROUNDS}\nmean(wyniki)`,
      pick: 'mean(wyniki)',
    },
    {
      say: 'Krzywa średnio **128**, prosta 104. Na jednym podziale decydował los, po pięciu rundach nie.',
      code: `${CURVE_ROUNDS}\nmean(krzywa)`,
      pick: 'mean(krzywa)',
    },
  ],

  play: {
    say: 'Twoja kolej. Zmień numer części w `filter()` i porównaj wynik z `wyniki`.',
    keep: `${ROUNDS}\nuczace <- ess |> filter(czesc != 2)\ntestowe <- ess |> filter(czesc == 2)\n${MODEL}`,
    code: RMSE,
    chips: [
      'wyniki',
      'mean(wyniki)',
      'nrow(testowe)',
      'table(ess$czesc)',
      'ess |> filter(czesc == 5)',
    ],
  },

  task: {
    prompt: 'Policz rundę 3. Część 3 jest testowa, pozostałe uczą prostą. Podaj RMSE tej rundy.',
    starter: `${FOLDS}\n`,
    check,
    solution: ROUND3,
    hints: [
      'Jak w scenach, tylko z 3: `uczace <- ess |> filter(czesc != 3)` i `testowe` z `czesc == 3`.',
      'Potem `lm()` na `uczace` i RMSE z `predict(m, testowe)`, jak w ćwiczeniu {ćw:model-error}.',
    ],
    messages: {
      typed: 'Liczba ma wyjść z kodu, nie z rysunku. Policz rundę od `filter()` do RMSE.',
      fromResults: 'Ta liczba już leży w `wyniki`. Zadanie chce, żeby policzyć ją od początku: `filter()`, `lm()`, `predict()`.',
      model: 'To cały model. Potrzebna jest jedna liczba: RMSE na części 3.',
      summary: 'To opis modelu na danych uczących. Zadanie pyta o pomyłkę na części 3.',
      vector: 'To wiele liczb naraz. Zrób z pomyłek jedną: `sqrt(mean(...^2))`.',
      table: 'To tabela. Potrzebna jest jedna liczba w minutach.',
      round1: 'To runda 1 ze scen. Zadanie pyta o rundę 3: zmień 1 na 3 w obu `filter()`.',
      swapped: 'Strony są zamienione: prosta uczy się na części 3, a sprawdza na reszcie. Testowa ma być część 3.',
      learning: 'To pomyłka na osobach, na których prosta się uczyła. Policz ją na `testowe`, części 3.',
      same: 'Uczące i testowe to te same osoby z części 3. Uczą części inne niż 3: `czesc != 3`.',
      mean: 'To średnia pięciu rund. Zadanie pyta o jedną, rundę 3.',
      curve: 'To runda 3 krzywej. Zadanie pyta o prostą: `lm(minuty ~ wiek, ...)`.',
      general: 'Jeszcze nie to. Część 3 testowa, reszta uczy prostą, potem RMSE na `testowe`.',
    },
    success: 'Dobrze. Runda 3 daje 125 minut, jak trzecia liczba w wyniki.',
    note: 'Pięć rund tylko mierzy model. Model do prognoz buduje się na wszystkich osobach. Resztę zrobi caret w Laboratorium 2.',

    nearMisses: [
      { name: 'round 1 of the scenes', expect: 'round1', code: `${ROUND1}\n${MODEL}\n${RMSE}` },
      { name: 'the sides swapped', expect: 'swapped', code: `${FOLDS}\nuczace <- ess |> filter(czesc == 3)\ntestowe <- ess |> filter(czesc != 3)\n${MODEL}\n${RMSE}` },
      { name: 'the learning error', expect: 'learning', code: `${FOLDS}\nuczace <- ess |> filter(czesc != 3)\n${MODEL}\nsqrt(mean(residuals(m)^2))` },
      { name: 'the same people both ways', expect: 'same', code: `${FOLDS}\nuczace <- ess |> filter(czesc == 3)\ntestowe <- ess |> filter(czesc == 3)\n${MODEL}\n${RMSE}` },
      { name: 'the mean of the five rounds', expect: 'mean', code: `${ROUNDS}\nmean(wyniki)` },
      { name: 'read off the results', expect: 'fromResults', code: `${ROUNDS}\nwyniki[3]` },
      { name: 'the curve instead of the line', expect: 'curve', code: `${FOLDS}\nuczace <- ess |> filter(czesc != 3)\ntestowe <- ess |> filter(czesc == 3)\nm <- lm(minuty ~ poly(wiek, 5), data = uczace)\n${RMSE}` },
      { name: 'a number typed in', expect: 'typed', code: `${FOLDS}\n124.71` },
      { name: 'caret, which runs only in RStudio', expect: 'error', code: `${FOLDS}\n${CARET}` },
    ],

    diagnose({ value, code, result }) {
      if (result?.reason === 'fromResults') return 'fromResults';
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

export default modelCv;

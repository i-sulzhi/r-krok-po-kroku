/**
 * Lesson: reading the line for a new person -- module 11, lecture 5 (D94).
 *
 * One idea: `predict()` reads the line at values of the right side of `~` that nobody
 * in the data had. The new values come as a table with the same column name.
 *
 * The silent trap is a prediction outside the data: at 90 years the line gives -2.8
 * hours, which no person can spend. The picture greys the zone with no data and draws
 * that point hollow. That the line is off even inside the data for the oldest (0.03 h at
 * 67, where the person says 1 h) is a chip, not a scene: it is the plan's fact, not a
 * second idea.
 *
 * The task asks for 25, 45 and 65 years, values no scene shows. Numbers checked in R
 * 4.6.2: 5.18, 2.73, 0.27.
 */

import { resultCheck } from './schema.js';
import { isAtomic, rLength } from '../core/rvalue.js';
import { isModel } from '../core/builtins/models.js';

const SETUP = `# Dwadzieścia osób: wiek, płeć, godziny w internecie dziennie
ankieta <- data.frame(
  wiek = c(19, 20, 21, 21, 22, 22, 23, 23, 24, 25,
           26, 28, 31, 34, 38, 43, 49, 55, 61, 67),
  plec = rep(c("K", "M"), 10),
  godziny = c(10, 7, 5, 6, 4, 8, 5, 6, 4, 5,
              3, 4, 3, 4, 2, 3, 2, 1, 2, 1)
)`;

const MODEL = 'm <- lm(godziny ~ wiek, data = ankieta)';
const AT40 = 'predict(m, data.frame(wiek = 40))';
const OUTSIDE = 'predict(m, data.frame(wiek = c(20, 40, 90)))';
const SOLUTION = `${MODEL}\npredict(m, data.frame(wiek = c(25, 45, 65)))`;

const base = resultCheck({ expected: SOLUTION, compare: { tolerance: 0.004 } });
/** The numbers must be read off the model, not typed in. */
const fromModel = (code) => /\b(predict|coef|coefficients)\s*\(|\$coefficients/.test(String(code || ''));
function check(ctx) {
  if (!fromModel(ctx.code)) return { ok: false, reason: 'typed' };
  return base(ctx);
}
check.compare = base.compare;

export const modelPredict = {
  id: 'model-predict',
  module: 11,
  lecture: 5,
  requires: ['model-residuals'],
  title: 'Ile godzin u 40-latka?',
  setup: SETUP,

  scenes: [
    {
      say: 'Nikt w ankiecie nie ma 40 lat. Ile godzin w sieci przewiduje dla niego prosta?',
      code: MODEL,
      pick: 'lm(godziny ~ wiek, data = ankieta)',
    },
    {
      say: '`predict()` czyta prostą przy nowym wieku. Nowe dane to tabela z kolumną `wiek`.',
      code: `${MODEL}\n${AT40}`,
      pick: AT40,
      tap: 'data.frame(wiek = 40)',
    },
    {
      say: 'Przy 90 latach prosta daje **-2.8 h**. Poza danymi prosta tylko zgaduje.',
      code: `${MODEL}\n${OUTSIDE}`,
      pick: OUTSIDE,
    },
  ],

  play: {
    say: 'Twoja kolej. Sprawdź inne wieki, także najstarszą osobę z danych.',
    keep: MODEL,
    code: 'predict(m, data.frame(wiek = c(15, 67, 100)))',
    chips: [
      'predict(m, data.frame(wiek = 67))',
      'predict(m, data.frame(wiek = seq(20, 60, by = 10)))',
      'coef(m)[1] + coef(m)[2] * 40',
      'predict(m)',
    ],
  },

  task: {
    prompt: 'Przewidź godziny w sieci dla osób w wieku **25, 45 i 65 lat**. Użyj modelu `m`.',
    starter: `${MODEL}\n`,
    check,
    solution: SOLUTION,
    hints: [
      'Nowe osoby to tabela z kolumną `wiek`: `data.frame(wiek = ...)`.',
      'Trzy wieki naraz to `c(25, 45, 65)` w tej kolumnie, a całość idzie do `predict(m, ...)`.',
    ],
    messages: {
      typed: 'Liczby mają wyjść z modelu, nie z rysunku. Użyj `predict(m, ...)`.',
      all: 'To prosta przy każdej z 20 osób z danych. Nowe osoby podaj w tabeli: `data.frame(wiek = ...)`.',
      oneAge: 'To jeden wiek. Potrzebne są trzy naraz: `c(25, 45, 65)`.',
      model: 'To cały model. Prostą przy nowym wieku czyta `predict(m, ...)`.',
      general: 'Jeszcze nie to: `predict(m, data.frame(wiek = c(25, 45, 65)))`.',
    },
    success: 'Dobrze: 5.18, 2.73 i 0.27 godziny.',
    note: 'Przy 65 latach prosta daje 0.27 h, a nikt w danych nie ma mniej niż 1 h. Prosta to średnia, nie pewnik.',

    nearMisses: [
      { name: 'the fitted values of the data', expect: 'all', code: `${MODEL}\npredict(m)` },
      { name: 'one age only', expect: 'oneAge', code: `${MODEL}\npredict(m, data.frame(wiek = 25))` },
      { name: 'the model printed', expect: 'model', code: `${MODEL}\nm` },
      { name: 'numbers typed in', expect: 'typed', code: `${MODEL}\nc(5.18, 2.73, 0.27)` },
      { name: 'other ages', expect: 'general', code: `${MODEL}\npredict(m, data.frame(wiek = c(20, 40, 60)))` },
      { name: 'a bare number as new data', expect: 'error', code: `${MODEL}\npredict(m, 25)` },
      { name: 'another column name', expect: 'error', code: `${MODEL}\npredict(m, data.frame(age = c(25, 45, 65)))` },
    ],

    diagnose({ value, result }) {
      if (isModel(value)) return 'model';
      if (result?.reason === 'typed') return 'typed';
      if (!value || !isAtomic(value)) return 'general';
      if (rLength(value) === 20) return 'all';
      if (rLength(value) === 1) return 'oneAge';
      return 'general';
    },
  },
};

export default modelPredict;

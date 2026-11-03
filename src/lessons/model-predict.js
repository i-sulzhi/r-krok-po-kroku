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
 *
 * The second half (D99) does the same on real data: 30 people from ESS round 11 in
 * Poland (lab/ess_polska.sav, `netustm` and `agea`). ESS asks `netustm` only of people
 * who use the internet, so they are internet users, and the scenes say so. Drawn so
 * that their line, 330 -
 * 2.62 x age, is close to the line of all 4128 people who answered, 335 - 2.55 x age.
 * A prediction is a mean: one person is 241 minutes away from it.
 */

import { resultCheck, typedIn } from './schema.js';
import { isAtomic, rLength, isDataFrame } from '../core/rvalue.js';
import { isModel } from '../core/builtins/models.js';

const SETUP = `# Dwadzieścia osób: wiek, płeć, godziny w internecie dziennie
ankieta <- data.frame(
  wiek = c(19, 20, 21, 21, 22, 22, 23, 23, 24, 25,
           26, 28, 31, 34, 38, 43, 49, 55, 61, 67),
  plec = rep(c("K", "M"), 10),
  godziny = c(10, 7, 5, 6, 4, 8, 5, 6, 4, 5,
              3, 4, 3, 4, 2, 3, 2, 1, 2, 1)
)
# 30 internautów z ESS 2023, Polska: wiek i minuty w sieci
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

const MODEL = 'm <- lm(godziny ~ wiek, data = ankieta)';
const AT40 = 'predict(m, data.frame(wiek = 40))';
const OUTSIDE = 'predict(m, data.frame(wiek = c(20, 40, 90)))';
const SOLUTION = `${MODEL}\npredict(m, data.frame(wiek = c(25, 45, 65)))`;
const ESS_MODEL = 'm2 <- lm(minuty ~ wiek, data = ess)';
const ESS_PREDICT = 'predict(m2, data.frame(wiek = c(20, 40, 60)))';

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
    {
      say: 'Prawdziwe dane: 30 internautów z ESS. Z każdym rokiem o około **2.6 minuty** mniej w sieci.',
      code: `${ESS_MODEL}\ncoef(m2)`,
      pick: 'coef(m2)',
    },
    {
      say: 'Prognoza dla 20, 40 i 60 lat: **278, 225 i 173** minuty dziennie.',
      code: `${ESS_MODEL}\n${ESS_PREDICT}`,
      pick: ESS_PREDICT,
      tap: 'data.frame(wiek = c(20, 40, 60))',
    },
    {
      say: 'Prognoza to średnia. Kreski pokazują, o ile ludzie od niej odbiegają: nawet o **241 minut**.',
      code: `${ESS_MODEL}\nresiduals(m2)`,
      pick: 'residuals(m2)',
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
      'predict(lm(minuty ~ wiek, data = ess), data.frame(wiek = c(18, 90)))',
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
      order: 'Te same liczby, inna kolejność. Podaj wieki po kolei: 25, 45, 65.',
      table: 'Liczby są dobre, ale w tabeli. Pokaż samą kolumnę z wynikami: `tabela$kolumna`.',
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
      { name: 'the fitted values by name', expect: 'all', code: `${MODEL}\nfitted(m)` },
      { name: 'the ages the other way round', expect: 'order', code: `${MODEL}\npredict(m, data.frame(wiek = c(65, 45, 25)))` },
      { name: 'the numbers kept in a table', expect: 'table', code: `${MODEL}\nnowi <- data.frame(wiek = c(25, 45, 65))\nnowi$prognoza <- predict(m, nowi)\nnowi` },
      { name: 'other ages', expect: 'general', code: `${MODEL}\npredict(m, data.frame(wiek = c(20, 40, 60)))` },
      { name: 'a bare number as new data', expect: 'error', code: `${MODEL}\npredict(m, 25)` },
      { name: 'another column name', expect: 'error', code: `${MODEL}\npredict(m, data.frame(age = c(25, 45, 65)))` },
    ],

    diagnose({ value, code, result }) {
      if (isModel(value)) return 'model';
      if (result?.reason === 'typed' && typedIn(code)) return 'typed';
      if (isDataFrame(value)) return 'table';
      if (!value || !isAtomic(value)) return 'general';
      if (rLength(value) === 20) return 'all';
      if (rLength(value) === 1) return 'oneAge';
      // The three right numbers, in another order.
      const want = [0.2715, 2.7274, 5.1832];
      const got = value.values.map(Number).slice().sort((a, b) => a - b);
      if (got.length === 3 && got.every((x, i) => Math.abs(x - want[i]) < 0.005)) return 'order';
      return 'general';
    },
  },
};

export default modelPredict;

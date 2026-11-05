/**
 * Lesson: what to read in summary() -- module 11, lecture 5 (D96).
 *
 * summary() prints twenty lines. One idea: a report needs four of them, how much (the
 * slope), how sure (its p), how much is explained (R²) and on how many people (n). The
 * picture is R's own printout with those four lit and numbered.
 *
 * The silent trap is the NA thread of the whole course meeting the model: lm() drops
 * every row with a gap, print(m) says nothing about it, and summary() says it in one
 * line. The data are the twenty people of exercises 33-35 with three hours missing
 * (rows 5, 14, 18), so the model stands on 17.
 *
 * p is said in one sentence, as the plan proposed (question 9.5): how sure it is that
 * the slope is not zero, not how big it is. Numbers checked in R 4.6.2.
 */

import { isAtomic, rLength, isDataFrame } from '../core/rvalue.js';
import { isModel, isModelSummary } from '../core/builtins/models.js';
import { typedIn } from './schema.js';

const SETUP = `# Dwadzieścia osób, trzy nie podały godzin
ankieta <- data.frame(
  wiek = c(19, 20, 21, 21, 22, 22, 23, 23, 24, 25,
           26, 28, 31, 34, 38, 43, 49, 55, 61, 67),
  plec = rep(c("K", "M"), 10),
  godziny = c(10, 7, 5, 6, NA, 8, 5, 6, 4, 5,
              3, 4, 3, NA, 2, 3, 2, NA, 2, 1)
)`;

const MODEL = 'm <- lm(godziny ~ wiek, data = ankieta)';
const SOLUTION = `${MODEL}\nnobs(m)`;

/** One number, alone or in a one-cell table such as count() gives. */
function oneNumber(value) {
  if (value && isAtomic(value) && rLength(value) === 1) return Number(value.values[0]);
  if (isDataFrame(value) && value.values.length === 1 && rLength(value.values[0]) === 1) return Number(value.values[0].values[0]);
  return null;
}

/** The count must be computed, from the model or from the gaps, not typed. */
function check({ value, code }) {
  if (typedIn(code)) return { ok: false, reason: 'typed' };
  return oneNumber(value) === 17 ? { ok: true } : { ok: false, reason: 'wrong-value' };
}
check.compare = {};

export const modelSummary = {
  id: 'model-summary',
  module: 11,
  lecture: 5,
  requires: ['model-groups'],
  title: 'Co czytać w summary()',
  setup: SETUP,

  scenes: [
    {
      say: '`summary()` ma 20 linijek. Do raportu: nachylenie, p, R² i n. `$` wyjmuje część wyniku.',
      code: `${MODEL}\nsummary(m)`,
      pick: 'summary(m)',
    },
    {
      say: 'Te 17 osób to **próba**. Pytanie: czy związek jest też wśród wszystkich, z których je wybrano?',
      code: `${MODEL}\nsummary(m)$coefficients`,
      pick: 'summary(m)$coefficients',
    },
    {
      say: 'Odpowiada **p** = 0.000378. Mniej niż umowne 0.05: związek jest **istotny statystycznie**.',
      code: `${MODEL}\nsummary(m)$coefficients`,
      pick: 'summary(m)$coefficients',
    },
    {
      say: 'Gdyby wśród wszystkich związku nie było, taka próba zdarzałaby się rzadziej niż **raz na 20**.',
      code: `${MODEL}\nsummary(m)$coefficients`,
      pick: 'summary(m)$coefficients',
    },
    {
      say: 'Na pierwszych 8 wierszach p = 0.117, więcej niż 0.05: związku **nie widać**. Za mało danych.',
      code: 'm8 <- lm(godziny ~ wiek, data = ankieta[1:8, ])\nsummary(m8)$coefficients',
      pick: 'summary(m8)$coefficients',
    },
    {
      say: 'R² = **0.58**: wiek wyjaśnia nieco ponad połowę różnic w godzinach.',
      code: `${MODEL}\nsummary(m)$r.squared`,
      pick: 'summary(m)$r.squared',
    },
    {
      say: '**3 wiersze** z NA wypadły po cichu. Model liczy się na 17 osobach, nie na 20.',
      code: `${MODEL}\nnobs(m)`,
      pick: 'nobs(m)',
    },
  ],

  play: {
    say: 'Twoja kolej. Porównaj `print()` i `summary()`, a potem model na ośmiu osobach.',
    keep: MODEL,
    code: 'summary(m)',
    chips: [
      'm',
      'coef(summary(m))',
      'sum(!is.na(ankieta$godziny))',
      'summary(lm(godziny ~ wiek, data = ankieta[1:8, ]))',
    ],
  },

  task: {
    prompt: 'Na ilu osobach **naprawdę** policzono model `m`? Policz to, nie wpisuj liczby.',
    starter: `${MODEL}\n`,
    check,
    solution: SOLUTION,
    hints: [
      'W tabeli jest 20 wierszy, ale model pomija wiersze z NA.',
      'Liczbę osób w modelu podaje `nobs(m)`.',
    ],
    messages: {
      typed: 'Liczba ma wyjść z kodu, nie z wydruku. Użyj `nobs(m)`.',
      allRows: 'To wszystkie wiersze tabeli. Model pominął te z NA w godzinach.',
      df: 'To stopnie swobody: osoby minus 2 współczynniki. Osób jest o 2 więcej.',
      dropped: 'To osoby, które wypadły. Pytanie jest o te, które zostały.',
      model: 'To cały model. Liczbę osób w nim podaje `nobs(m)`.',
      summary: 'Odpowiedź jest w wydruku, w linijce o brakach. Policz ją kodem: `nobs(m)`.',
      general: 'Jeszcze nie to. Liczbę osób w modelu podaje `nobs(m)`.',
    },
    success: 'Dobrze: 17 osób. Trzy nie podały godzin.',
    note: '`print(m)` nie wspomina o brakach, `summary()` pisze o nich jedną linijkę. W raporcie n stoi obok wyniku.',

    nearMisses: [
      { name: 'all rows of the table', expect: 'allRows', code: `${MODEL}\nnrow(ankieta)` },
      { name: 'the length of the column', expect: 'allRows', code: `${MODEL}\nlength(ankieta$godziny)` },
      { name: 'the residual degrees of freedom', expect: 'df', code: `${MODEL}\nsummary(m)$df[2]` },
      { name: 'the rows that dropped out', expect: 'dropped', code: `${MODEL}\nsum(is.na(ankieta$godziny))` },
      { name: 'the model printed', expect: 'model', code: `${MODEL}\nm` },
      { name: 'the summary printed', expect: 'summary', code: `${MODEL}\nsummary(m)` },
      { name: 'a number typed in', expect: 'typed', code: `${MODEL}\n17` },
      { name: 'all rows counted by dplyr', expect: 'allRows', code: `${MODEL}\ncount(ankieta)` },
    ],

    diagnose({ value, result }) {
      if (isModel(value)) return 'model';
      if (isModelSummary(value)) return 'summary';
      if (result?.reason === 'typed') return 'typed';
      const x = oneNumber(value);
      if (x == null) return 'general';
      if (x === 20) return 'allRows';
      if (x === 15) return 'df';
      if (x === 3) return 'dropped';
      return 'general';
    },
  },
};

export default modelSummary;

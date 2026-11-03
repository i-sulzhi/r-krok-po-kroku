/**
 * Lesson: categories in a model -- module 11, lecture 5 (D95).
 *
 * One idea: a category on the right side of `~` becomes differences from the first
 * group. `lm(godziny ~ plec)` gives the women's mean as (Intercept) and the men's gap as
 * plecM; K is the base only because it comes first in the alphabet (lecture 1's levels).
 *
 * The silent trap: a category written in digits (education 1, 2, 3) is taken for a
 * number. The model forces one straight rising line, +0.5 per level, while the groups
 * say secondary is the happiest (5.0, 7.5, 6.0). The repair, `factor()`, comes in the
 * next scene: a trap is shown with its repair.
 *
 * The task asks for the education model with a difference for every level. It is judged
 * by what the model says, not by its spelling: any model whose groups get their own
 * means is right, whether made with factor(), as.character(), a labelled factor or a
 * releveled one. Numbers checked in R 4.6.2.
 */

import { isAtomic, rLength } from '../core/rvalue.js';
import { isModel, isModelSummary } from '../core/builtins/models.js';

const SETUP = `# Dwadzieścia osób: wiek, płeć, godziny w internecie dziennie
ankieta <- data.frame(
  wiek = c(19, 20, 21, 21, 22, 22, 23, 23, 24, 25,
           26, 28, 31, 34, 38, 43, 49, 55, 61, 67),
  plec = rep(c("K", "M"), 10),
  godziny = c(10, 7, 5, 6, 4, 8, 5, 6, 4, 5,
              3, 4, 3, 4, 2, 3, 2, 1, 2, 1)
)
# Wykształcenie: 1 podstawowe, 2 średnie, 3 wyższe
oceny <- data.frame(
  wyksztalcenie = rep(1:3, each = 4),
  zadowolenie = c(5, 4, 6, 5, 8, 7, 7, 8, 6, 7, 6, 5)
)`;

const PLEC = 'lm(godziny ~ plec, data = ankieta)';
const OCENY = `oceny <- data.frame(
  wyksztalcenie = rep(1:3, each = 4),
  zadowolenie = c(5, 4, 6, 5, 8, 7, 7, 8, 6, 7, 6, 5))`;
const DIGITS = 'lm(zadowolenie ~ wyksztalcenie, data = oceny)';
const FACTOR = 'lm(zadowolenie ~ factor(wyksztalcenie), data = oceny)';
const SOLUTION = FACTOR;

/** The group means the right model reproduces, row by row: 5.0, 7.5, 6.0 four times each. */
const GROUP_MEANS = [5, 5, 5, 5, 7.5, 7.5, 7.5, 7.5, 6, 6, 6, 6];
const fitsGroups = (m) => {
  const coef = m.values[0].values;
  const fitted = m.lm.fit.fitted;
  return coef.length === 3 && !coef.some((c) => typeof c !== 'number')
    && fitted.length === 12 && fitted.every((v, i) => Math.abs(v - GROUP_MEANS[i]) < 1e-6);
};

function check({ value }) {
  if (isModel(value) && fitsGroups(value)) return { ok: true };
  // The coefficients alone, with education's first level as the base.
  if (value && isAtomic(value) && rLength(value) === 3 && value.type === 'double') {
    const [a, b, c] = value.values;
    if (Math.abs(a - 5) < 1e-6 && Math.abs(b - 2.5) < 1e-6 && Math.abs(c - 1) < 1e-6) return { ok: true };
  }
  return { ok: false, reason: 'wrong-value' };
}
check.compare = {};

export const modelGroups = {
  id: 'model-groups',
  module: 11,
  lecture: 5,
  requires: ['model-predict'],
  title: 'Kategorie w modelu',
  setup: SETUP,

  scenes: [
    {
      say: 'Płeć to kategoria. Kropki to osoby, a poziome kreski to **średnie** godzin w grupach.',
      code: PLEC,
      pick: PLEC,
    },
    {
      say: 'Dla kategorii `lm()` daje **różnicę** średnich: mężczyźni mają o 0.5 h więcej.',
      code: PLEC,
      pick: PLEC,
      tap: 'plec',
    },
    {
      say: '`(Intercept)` to średnia kobiet, 4.0. Kobiety są bazą, bo K jest przed M w alfabecie.',
      code: `m <- ${PLEC}\ncoef(m)["(Intercept)"]`,
      pick: 'coef(m)["(Intercept)"]',
    },
    {
      say: 'Wykształcenie zapisane cyframi. `lm()` liczy je jak liczby: **jedna prosta** w górę.',
      code: `${OCENY}\n${DIGITS}`,
      pick: DIGITS,
    },
    {
      say: '`factor()` robi z cyfr kategorie. Średnie wykształcenie wypada najwyżej: +2.5.',
      code: `${OCENY}\n${FACTOR}`,
      pick: FACTOR,
      tap: 'factor(wyksztalcenie)',
    },
  ],

  play: {
    say: 'Twoja kolej. Zmień grupę bazową albo porównaj model ze średnimi grup.',
    keep: `m <- ${PLEC}`,
    code: 'coef(m)',
    chips: [
      'lm(godziny ~ relevel(factor(plec), "M"), data = ankieta)',
      'ankieta |> group_by(plec) |> summarise(srednia = mean(godziny))',
      'oceny |> group_by(wyksztalcenie) |> summarise(srednia = mean(zadowolenie))',
      'coef(lm(zadowolenie ~ wyksztalcenie, data = oceny))',
    ],
  },

  task: {
    prompt: 'Zrób model zadowolenia w tabeli `oceny`, który da różnicę dla **każdego poziomu** wykształcenia.',
    starter: '',
    check,
    solution: SOLUTION,
    hints: [
      'Cyfry 1, 2, 3 są tu kategoriami, nie liczbami. Zamień je na czynnik.',
      'Czynnik możesz zrobić w samej formule: `lm(zadowolenie ~ factor(...), data = oceny)`.',
    ],
    messages: {
      digits: 'Jedna liczba na trzy grupy: R policzył cyfry jak liczby. Zrób z nich kategorie: `factor()`.',
      means: 'To średnie grup, dobrze policzone. Zadanie chce modelu: `lm()` z `factor()`.',
      otherTable: 'To model z tabeli `ankieta`. Zadanie jest o tabeli `oceny`.',
      swapped: 'Strony `~` są zamienione. Wyjaśniamy zadowolenie: `zadowolenie ~ factor(wyksztalcenie)`.',
      summary: 'To opis modelu. Do sprawdzenia pokaż sam model z `lm()` albo jego `coef()`.',
      general: 'Jeszcze nie to: `lm(zadowolenie ~ factor(wyksztalcenie), data = oceny)`.',
    },
    success: 'Dobrze: każdy poziom ma własną średnią. Najwyżej: średnie.',
    note: 'Z cyframi model mówił „im wyżej, tym lepiej”. Kategorie pokazują, że wyższe wypada niżej niż średnie.',

    nearMisses: [
      { name: 'the digits as a number', expect: 'digits', code: DIGITS },
      { name: 'the group means', expect: 'means', code: 'oceny |> group_by(wyksztalcenie) |> summarise(srednia = mean(zadowolenie))' },
      { name: 'the other table', expect: 'otherTable', code: PLEC },
      { name: 'factor() without data', expect: 'error', code: 'lm(zadowolenie ~ factor(wyksztalcenie))' },
      { name: 'the digits coefficients', expect: 'digits', code: `coef(${DIGITS})` },
      { name: 'the sides of ~ swapped', expect: 'swapped', code: 'lm(wyksztalcenie ~ factor(zadowolenie), data = oceny)' },
      { name: 'the summary printed', expect: 'summary', code: `summary(${FACTOR})` },
    ],

    diagnose({ value }) {
      if (isModel(value)) {
        if (/wyksztalcenie/.test(value.lm.responseCode)) return 'swapped';
        if (value.lm.responseCode !== 'zadowolenie') return 'otherTable';
        if (value.lm.terms.length === 1 && value.lm.terms[0].kind === 'numeric') return 'digits';
        return 'general';
      }
      if (isModelSummary(value)) return 'summary';
      if (value && value.kind === 'list') return 'means';
      if (value && isAtomic(value) && rLength(value) === 2) return 'digits';
      return 'general';
    },
  },
};

export default modelGroups;

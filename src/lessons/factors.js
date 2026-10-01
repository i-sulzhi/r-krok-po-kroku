/**
 * Lesson: factors -- module 3.
 *
 * Grounded in the most common coded variable in a sociology survey: a rating scale.
 * The data is what a questionnaire export gives you -- digits 1..5 -- and a scale
 * that says what each digit means. A factor is exactly that pair: the digits stay
 * underneath as codes, the words sit on top as labels, and the levels are the
 * codebook between them.
 *
 * Nobody in the data chose 1. That one fact carries the lesson:
 *   - a table of the bare digits has no row for 1 and no words (scene 1; the picture
 *     draws the missing row hollow, so the sentence need not);
 *   - `factor(..., levels = 1:5, labels = skala)` keeps the empty answer (scene 2);
 *   - without `levels`, the levels are only the digits present, so every code
 *     shifts by one -- under "4" sits code 3 (scene 3, lit on arrival) -- and five labels no longer
 *     fit four levels, which is R's error the task's most likely wrong answer hits.
 *
 * The task combines the two tools: a count table in words, in scale order, with the
 * zero. The check compares the table's names, not just its counts: 0 2 1 3 2 under
 * the digits is not the answer.
 */

import { resultCheck } from './schema.js';
import { isAtomic, isFactor, getNames } from '../core/rvalue.js';

// Shown at the top of scene 1: the answers and their codebook, as a survey export gives them.
const SETUP = `# Ocena zajęć: 1 = bardzo źle, 5 = bardzo dobrze
odpowiedzi <- c(4, 5, 2, 4, 3, 5, 4, 2)
skala <- c("bardzo źle", "źle", "średnio",
           "dobrze", "bardzo dobrze")`;

const SCALE = ['bardzo źle', 'źle', 'średnio', 'dobrze', 'bardzo dobrze'];

// One argument per line: the two halves of the codebook, levels and labels, read as
// a pair -- and the call fits the code box at every width.
const LABELLED = 'factor(odpowiedzi,\n       levels = 1:5,\n       labels = skala)';

const SOLUTION = 'table(factor(odpowiedzi,\n             levels = 1:5,\n             labels = skala))';

export const factors = {
  id: 'factors',
  module: 3,
  requires: ['subsetting'],
  title: 'Etykiety kategorii: factor()',
  setup: SETUP,

  scenes: [
    {
      say: 'Odpowiedzi i ich skala. `table()` zna tylko cyfry: nie ma słów ani wiersza dla **1**.',
      // The data is created on screen, not only in the hidden setup.
      code: `${SETUP}\ntable(odpowiedzi)`,
      pick: 'table(odpowiedzi)',
      tap: 'odpowiedzi',
      show: { absent: ['1'] },
    },
    {
      say: 'Jak książka kodów: każdy **poziom** dostaje etykietę, a cyfra zostaje kodem. To **czynnik**.',
      code: LABELLED,
      pick: LABELLED,
      tap: 'skala',
    },
    {
      say: 'Bez `levels` kody się przesuwają: pod „4” leży już **3**. Liczby z kodów będą złe.',
      code: 'factor(odpowiedzi)',
      pick: 'factor(odpowiedzi)',
      show: { lit: 3 },
    },
  ],

  play: {
    code: LABELLED,
    chips: [
      'levels(factor(odpowiedzi))',
      'as.numeric(factor(odpowiedzi))',
      'as.numeric(factor(odpowiedzi, levels = 1:5))',
      'factor(c("dobrze", "źle", "bardzo dobrze"))',
      'factor(c("dobrze", "źle"), levels = skala)',
    ],
  },

  task: {
    prompt: 'Policz, ile osób wybrało każdą odpowiedź. Pokaż to **słowami** i w kolejności skali.',
    starter: '# tabela odpowiedzi słowami\n',
    check: resultCheck({ expected: SOLUTION, requireCalls: ['table', 'factor'], compare: { names: true } }),
    solution: SOLUTION,
    hints: [
      'Słowa pojawią się, gdy policzysz **czynnik** z etykietami, a nie same cyfry.',
      'Wokół czynnika `table()`, a w czynniku `levels = 1:5` i `labels = skala`.',
    ],
    messages: {
      'missing.table': 'Zadanie prosi o tabelę liczebności, więc użyj `table()`.',
      'missing.factor': 'Słowa da dopiero czynnik: `factor()` z `labels = skala`.',
      digits: 'Cyfry zamiast słów. Policz czynnik z `labels = skala`, a nie same `odpowiedzi`.',
      notTable: 'To czynnik, jeszcze nie tabela. Otocz go `table()`.',
      countedScale: 'To policzona sama skala, każde słowo raz. Policz **odpowiedzi**.',
      noEmpty: 'Brakuje „bardzo źle”: nikt tego nie wybrał. Pusty poziom pokaże się, gdy podasz w `levels` całą skalę.',
      wrongOrder: 'Słowa są, ale nie w kolejności skali. Kolejność ustala `levels`.',
      general: 'Jeszcze nie to: czynnik z `levels = 1:5` i `labels = skala`, a wokół `table()`.',
    },
    success: 'Dobrze, tabela mówi słowami.',
    note: 'Zero przy „bardzo źle” to też wynik. „Czynnik” w R nie ma nic wspólnego z analizą czynnikową.',

    nearMisses: [
      { name: 'counted the bare digits', expect: 'digits',
        code: 'table(odpowiedzi)' },
      { name: 'declared the levels but no labels', expect: 'digits',
        code: 'table(factor(odpowiedzi, levels = 1:5))' },
      { name: 'built the factor but never counted it', expect: 'notTable',
        code: 'factor(odpowiedzi, levels = 1:5, labels = skala)' },
      { name: 'counted the scale itself', expect: 'countedScale',
        code: 'table(skala)' },
      { name: 'dropped the empty label to silence the error', expect: 'noEmpty',
        code: 'table(factor(odpowiedzi, labels = skala[2:5]))' },
      { name: 'looked the words up; table() sorted them', expect: 'noEmpty',
        code: 'table(skala[odpowiedzi])' },
      { name: 'declared the words as levels in alphabetical order', expect: 'wrongOrder',
        code: 'table(factor(skala[odpowiedzi], levels = sort(skala)))' },
      { name: 'five labels for the four digits present', expect: 'error',
        code: 'table(factor(odpowiedzi, labels = skala))' },
    ],

    diagnose({ value, result }) {
      if (!value || !isAtomic(value)) return 'general';
      if (isFactor(value)) return 'notTable';
      const names = (getNames(value)?.values || []).map(String);
      if (names.length && names.every((s) => Number.isFinite(Number(s)))) return 'digits';
      if (names.length) {
        if (names.length === SCALE.length && value.values.every((n) => n === 1)) return 'countedScale';
        if (!names.includes(SCALE[0])) return 'noEmpty';
        if (names.join() !== SCALE.join()) return 'wrongOrder';
      }
      if (result?.reason === 'missing-call') return `missing.${result.detail.name}`;
      return 'general';
    },
  },
};

export default factors;

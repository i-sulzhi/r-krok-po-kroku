/**
 * Lesson: choosing elements -- module 2.
 *
 * What goes inside `[ ]` can mean four different things: a position, several
 * positions, "remove" (the minus), or a TRUE/FALSE mask. The pick picture draws the
 * chosen cells lifted into the result, and a mask as a row of TRUE/FALSE right above
 * the cells it decides -- the same mechanism `filter()` uses later, under one word.
 */

import { resultCheck } from './schema.js';
import { rLength, isAtomic } from '../core/rvalue.js';

const SETUP = `# Wiek dziesięciu respondentów
wiek <- c(23, 34, 45, 29, 51, 38, 27, 42, 19, 60)`;

const SOLUTION = 'wiek[wiek > mean(wiek)]';

export const subsetting = {
  id: 'subsetting',
  module: 2,
  requires: ['missing'],
  title: 'Wybieranie elementów',
  setup: SETUP,

  scenes: [
    {
      say: 'Liczba w nawiasie kwadratowym to **pozycja** komórki.',
      // The data is created on screen, not only in the hidden setup.
      code: `${SETUP}\nwiek[3]`,
      pick: 'wiek[3]',
    },
    {
      say: 'Kilka pozycji naraz: w nawiasie cały wektor numerów.',
      code: 'wiek[c(1, 5, 10)]',
      pick: 'wiek[c(1, 5, 10)]',
    },
    {
      say: 'Minus znaczy **„usuń”**, a nie „licz od końca”.',
      code: 'wiek[-1]',
      pick: 'wiek[-1]',
    },
    {
      say: 'Warunek daje **maskę**: TRUE albo FALSE dla każdej komórki…',
      code: 'wiek > 40',
      pick: 'wiek > 40',
    },
    {
      say: '…a nawias zostawia tylko komórki z **TRUE**.',
      code: 'wiek[wiek > 40]',
      pick: 'wiek[wiek > 40]',
      tap: 'wiek > 40',
    },
  ],

  play: {
    code: 'wiek[wiek > 40]',
    chips: [
      'wiek[-c(1, 2)]',
      'wiek[0]',
      'wiek[100]',
      'sum(wiek > 40)',
      'wiek[wiek < 30]',
    ],
  },

  task: {
    prompt: 'Zostaw tylko osoby **starsze niż przeciętna**. Wynik: wektor ich wieku.',
    starter: '# wiek osób starszych niż średnia\n',
    check: resultCheck({ expected: SOLUTION, requireCalls: ['mean'] }),
    solution: SOLUTION,
    hints: [
      'Przeciętna to `mean(wiek)`, a porównanie z nią tworzy maskę: `wiek > mean(wiek)`.',
      'Maskę wstawia się w nawias: `wiek[...]`.',
    ],
    messages: {
      'missing.mean': 'Porównaj z przeciętną: `mean(wiek)`.',
      gotMask: 'To sama maska TRUE/FALSE. Wstaw ją jeszcze w nawias: `wiek[...]`.',
      collapsed: 'Wyszła jedna liczba, a mają być wieki wszystkich starszych osób.',
      nothingRemoved: 'Nikt nie odpadł. Sprawdź warunek: porównanie z `mean(wiek)`.',
      general: 'Jeszcze nie to: `wiek[warunek]`, gdzie warunek porównuje z `mean(wiek)`.',
    },
    success: 'Dobrze. Pięć osób starszych niż przeciętna.',
    note: 'Ta sama maska wróci w `filter()`. Tam cały nawias zastąpi jedno słowo.',

    nearMisses: [
      { name: 'produced the mask, not the values', expect: 'gotMask', code: 'wiek > mean(wiek)' },
      { name: 'averaged the survivors', expect: 'collapsed', code: 'mean(wiek[wiek > mean(wiek)])' },
      { name: 'condition kept everyone', expect: 'nothingRemoved', code: 'wiek[wiek > mean(wiek) - 100]' },
      { name: 'compared with a fixed number', expect: 'missing.mean', code: 'wiek[wiek > 35]' },
    ],

    diagnose({ value, result }) {
      if (!value || !isAtomic(value)) return 'general';
      if (value.type === 'logical') return 'gotMask';
      if (rLength(value) === 1) return 'collapsed';
      if (rLength(value) === 10) return 'nothingRemoved';
      if (result?.reason === 'missing-call') return `missing.${result.detail.name}`;
      return 'general';
    },
  },
};

export default subsetting;

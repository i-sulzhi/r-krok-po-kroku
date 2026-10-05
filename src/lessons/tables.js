/**
 * Lesson: the data.frame -- module 4.
 *
 * A table is not a new kind of thing: it is a set of equal-length columns, each an
 * ordinary vector. `$` takes one out; a condition on one column is a mask with one
 * value per row; `[rows, ]` uses it. The task combines the two: a column filtered by
 * a condition built from another column -- filtering by hand, which the next lesson
 * replaces with one word.
 */

import { resultCheck } from './schema.js';
import { rLength, isAtomic, isDataFrame } from '../core/rvalue.js';

const SETUP = `# Wyniki małej ankiety
ankieta <- data.frame(
  id = 1:8,
  plec = c("K", "M", "K", "K", "M", "M", "K", "M"),
  wiek = c(23, 34, 45, 29, 51, 38, 27, 42),
  ocena = c(4, 5, 3, 5, 2, 4, 5, 3)
)`;

const SOLUTION = 'mean(ankieta$wiek[ankieta$plec == "K"])';

export const tables = {
  id: 'tables',
  module: 4,
  lecture: 1,
  requires: ['subsetting'],
  title: 'Tabela danych: data.frame',
  setup: SETUP,

  scenes: [
    {
      say: 'Znasz ją z ćwiczenia 1. **data.frame** to kolumny, każda to zwykły wektor ze swoim typem.',
      code: 'ankieta',
      pick: 'ankieta',
    },
    {
      say: '`$` wyjmuje **jedną kolumnę** jako wektor.',
      code: 'ankieta$wiek',
      pick: 'ankieta$wiek',
      tap: '$',
    },
    {
      say: 'Warunek na kolumnie to maska: **jedna wartość na wiersz**.',
      code: 'ankieta$plec == "K"',
      pick: 'ankieta$plec == "K"',
      show: { rows: true },
    },
    {
      say: 'W `[wiersze, ]` puste miejsce po przecinku znaczy: **wszystkie kolumny**.',
      code: 'ankieta[ankieta$wiek > 40, ]',
      pick: 'ankieta[ankieta$wiek > 40, ]',
      tap: ', ]',
    },
  ],

  play: {
    code: 'ankieta$ocena[ankieta$wiek > 40]',
    chips: [
      'nrow(ankieta)',
      'ncol(ankieta)',
      'ankieta[1:3, ]',
      'ankieta[, c("wiek", "ocena")]',
      'mean(ankieta$wiek)',
    ],
  },

  task: {
    prompt: 'Policz **średni wiek kobiet** ("K" w kolumnie `plec`).',
    starter: '# średni wiek kobiet\n',
    check: resultCheck({ expected: SOLUTION, requireCalls: ['mean'] }),
    solution: SOLUTION,
    hints: [
      'Kolumnę bierze `$`, a `ankieta$plec == "K"` daje maskę.',
      'Nałóż maskę na kolumnę wieku: `ankieta$wiek[...]`, a potem `mean()`.',
    ],
    messages: {
      'missing.mean': 'Zadanie prosi o średnią, więc użyj `mean()`.',
      gotTable: 'To tabela, a ma być jedna liczba. Weź kolumnę wieku i policz średnią.',
      notOneNumber: 'Ma być jedna liczba, czyli średni wiek.',
      allRespondents: 'To średnia wszystkich. Brakuje warunku `ankieta$plec == "K"`.',
      wrongGroup: 'To średnia mężczyzn. Kobiety to "K".',
      general: 'Jeszcze nie to: `mean()` z kolumny wiek, z warunkiem na kolumnie plec.',
    },
    success: 'Dobrze, 31 lat. W ankiecie są cztery kobiety.',
    note: 'Kolumna z warunkiem z innej kolumny to filtrowanie „ręczne”. Następne ćwiczenie zrobi to jednym słowem.',

    nearMisses: [
      { name: 'averaged everyone', expect: 'allRespondents', code: 'mean(ankieta$wiek)' },
      { name: 'averaged the men', expect: 'wrongGroup', code: 'mean(ankieta$wiek[ankieta$plec == "M"])' },
      { name: 'returned the filtered table', expect: 'gotTable', code: 'ankieta[ankieta$plec == "K", ]' },
    ],

    diagnose({ value, result }) {
      if (!value) return 'general';
      if (isDataFrame(value)) return 'gotTable';
      if (!isAtomic(value)) return 'general';
      if (rLength(value) !== 1) return 'notOneNumber';
      const n = value.values[0];
      if (Math.abs(n - 36.125) < 1e-6) return 'allRespondents';   // mean of everyone
      if (Math.abs(n - 41.25) < 1e-6) return 'wrongGroup';        // mean of the men
      if (result?.reason === 'missing-call') return `missing.${result.detail.name}`;
      return 'general';
    },
  },
};

export default tables;

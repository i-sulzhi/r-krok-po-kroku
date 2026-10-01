/**
 * Lesson: types and silent coercion -- module 1.
 *
 * A vector holds one type. Mix a number and a text in `c()` and R converts
 * everything, silently, up the one-way ladder logical -> integer -> double ->
 * character. The picture is the ladder plus the row changing colour at once; the
 * task is the everyday consequence: numbers that arrived as text cannot be averaged
 * until they are numbers again.
 */

import { resultCheck } from './schema.js';
import { rLength, isAtomic } from '../core/rvalue.js';

const SETUP = `# Wiek respondentów wczytany z arkusza jako tekst
wiek_tekst <- c("23", "34", "45", "29", "51")`;

const SOLUTION = 'mean(as.numeric(wiek_tekst))';

export const types = {
  id: 'types',
  module: 1,
  requires: ['vectors'],
  title: 'Typy i cicha konwersja',
  setup: SETUP,

  scenes: [
    {
      say: '**Kolor to typ.** Kliknij każdą linię: liczby, tekst, wartości logiczne.',
      code: 'c(1, 2, 3)\nc("a", "b")\nc(TRUE, FALSE)',
      pick: 'c(1, 2, 3)',
      tap: 'c("a", "b")',
    },
    {
      say: 'W arkuszu liczby i tekst stoją w jednej kolumnie. W R jeden tekst zmienia **wszystko**.',
      code: 'c(23, 34, "brak danych", 29)',
      pick: 'c(23, 34, "brak danych", 29)',
      tap: '"brak danych"',
      show: { excel: { kind: 'mixed', col: 'C', name: 'wiek' } },
    },
    {
      say: '`as.numeric()` zamienia tekst z powrotem na liczby.',
      code: 'as.numeric(wiek_tekst)',
      pick: 'as.numeric(wiek_tekst)',
      tap: 'wiek_tekst',
    },
    {
      say: 'Czego nie da się odczytać jako liczby, staje się **NA**.',
      code: 'as.numeric(c("12", "brak", "7"))',
      pick: 'as.numeric(c("12", "brak", "7"))',
    },
  ],

  play: {
    code: 'typeof(wiek_tekst)',
    chips: [
      'c(TRUE, 10)',
      'c(TRUE, "tak")',
      'typeof(c(1, "a"))',
      'sum(c(TRUE, TRUE, FALSE))',
      'class(wiek_tekst)',
    ],
  },

  task: {
    prompt: 'W pamięci jest **wiek_tekst**: wiek pięciu osób, ale zapisany jako tekst. Policz średni wiek.',
    starter: '# policz średni wiek\n',
    check: resultCheck({ expected: SOLUTION, requireCalls: ['mean'] }),
    solution: SOLUTION,
    hints: [
      'Najpierw sprawdź typ: `typeof(wiek_tekst)`. Z tekstu nie da się liczyć.',
      'Tekst na liczby zamienia `as.numeric()`. Całość: `mean(as.numeric(...))`.',
    ],
    messages: {
      'missing.mean': 'Zadanie prosi o średnią, więc użyj `mean()`.',
      stillText: 'Wynik nadal jest tekstem. Najpierw `as.numeric()`, potem `mean()`.',
      notOneNumber: 'Średnia to jedna liczba. Brakuje `mean()` wokół liczb.',
      usedSum: 'To suma (182), a nie średnia. `mean()` podzieli ją przez liczbę osób.',
      general: 'Jeszcze nie to: najpierw `as.numeric(wiek_tekst)`, potem `mean()` z tego.',
    },
    success: 'Dobrze, 36.4. Liczby znów są liczbami.',
    note: 'Gdy funkcja licząca odmawia współpracy, pierwsze pytanie brzmi: jakiego typu są moje dane?',

    nearMisses: [
      { name: 'summed instead of averaging', expect: 'usedSum',
        code: 'sum(as.numeric(wiek_tekst))' },
      { name: 'left the data as text', expect: 'error',
        code: 'mean(wiek_tekst)' },
      { name: 'converted but never averaged', expect: 'notOneNumber',
        code: 'as.numeric(wiek_tekst)' },
    ],

    diagnose({ value, result }) {
      if (!value || !isAtomic(value)) return 'general';
      if (value.type === 'character') return 'stillText';
      // 23+34+45+29+51 -- summed instead of averaged. Naming the symptom beats
      // reporting which call was missing.
      if (rLength(value) === 1 && value.values[0] === 182) return 'usedSum';
      if (rLength(value) !== 1) return 'notOneNumber';
      if (result?.reason === 'missing-call') return `missing.${result.detail.name}`;
      return 'general';
    },
  },
};

export default types;

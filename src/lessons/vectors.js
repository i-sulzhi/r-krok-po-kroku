/**
 * Lesson: from a spreadsheet to a vector -- module 1, syllabus topic 1.
 *
 * The first lesson, and the one that decides whether the rest lands. Many learners
 * have never programmed, but nearly all have kept survey data in Excel or Google
 * Sheets. So the lesson starts there, not with an abstract `5`:
 *
 *   1. the survey drawn as a sheet -- letters, names in row 1, one person per row;
 *   2. one column taken out: it lies down, each cell keeping its sheet address, so
 *      "D2 is [1]" (row 1 holds the names) is seen rather than told;
 *   3. the same row built by hand with c() and given a name;
 *   4. the number in brackets on a console line is a cell number, not a line number;
 *   5. length() counts the cells -- in the sheet, the rows of data.
 *
 * The vector is the column itself; R only prints it lying down. Saying "a vector is
 * a horizontal column" would make orientation look like a property, and the same
 * data stands upright again in a data.frame. "A single number is a vector of length
 * one" moved to the vectorised lesson, where recycling needs it.
 *
 * `$` appears here only to be clicked; lesson `tables` teaches writing it.
 */

import { resultCheck } from './schema.js';
import { rLength, isAtomic } from '../core/rvalue.js';

// The same survey as lesson `tables`: the thread runs through the course.
const SETUP = `# Wyniki małej ankiety, tak jak w arkuszu
ankieta <- data.frame(
  id = 1:8,
  plec = c("K", "M", "K", "K", "M", "M", "K", "M"),
  wiek = c(23, 34, 45, 29, 51, 38, 27, 42),
  ocena = c(4, 5, 3, 5, 2, 4, 5, 3)
)`;

const OCENY = 'oceny <- c(4, 5, 3, 5, 2, 4, 5, 3)';

const SOLUTION = `wiek <- c(23, 34, 45, 29, 51)
length(wiek)`;

export const vectors = {
  id: 'vectors',
  module: 1,
  title: 'Od arkusza do wektora',
  setup: SETUP,

  scenes: [
    {
      say: 'Tak wyglądają dane z ankiety. Jeden wiersz to jedna osoba, a kolumna to jedno pytanie.',
      code: 'ankieta',
      pick: 'ankieta',
      show: { sheet: true },
    },
    {
      say: 'Weźmy jedną kolumnę, czyli oceny. W R taka kolumna to **wektor**.',
      code: 'ankieta$ocena',
      pick: 'ankieta$ocena',
      show: { sheet: true },
    },
    {
      say: 'Taki wektor zbudujesz sam. `c()` skleja wartości, a `<-` nadaje mu nazwę.',
      code: OCENY,
      pick: 'c(4, 5, 3, 5, 2, 4, 5, 3)',
      tap: '<-',
    },
    {
      say: 'Liczba w nawiasie na początku linii konsoli to **numer komórki**, a nie numer linii.',
      code: '1:30',
      pick: '1:30',
    },
    {
      say: '`length()` mówi, **ile jest komórek**. W arkuszu to liczba wierszy z danymi.',
      code: `${OCENY}\nlength(oceny)`,
      pick: 'length(oceny)',
    },
  ],

  play: {
    code: `${OCENY}\nlength(oceny)`,
    chips: [
      'ankieta$wiek',
      'length(ankieta$wiek)',
      'length(5)',
      'c(1:3, 10)',
      '1:100',
    ],
  },

  task: {
    prompt: 'Zapisz wiek pięciu osób (23, 34, 45, 29, 51) w wektorze **wiek**. Ostatnia linia ma podać, ile ich jest.',
    // An empty editor is intimidating on the very first task; comments show the
    // shape of the answer without giving it away.
    starter: '# 1. zapisz wiek pięciu osób\n\n# 2. sprawdź, ile ich jest\n',
    check: resultCheck({ expected: SOLUTION, requireCalls: ['c', 'length'] }),
    solution: SOLUTION,
    hints: [
      'Wartości skleja `c()`, a nazwę nadaje strzałka. Zacznij od `wiek <- c(...)`.',
      'Liczbę komórek podaje `length(wiek)`. To ma być ostatnia linia.',
    ],
    messages: {
      'missing.c': 'Wektor skleja się funkcją `c()`, na przykład `wiek <- c(23, 34, ...)`.',
      'missing.length': 'Ostatnia linia ma policzyć osoby. Użyj `length(wiek)`.',
      notLength: 'Wynikiem ma być jedna liczba, czyli długość wektora. Zakończ kod linią `length(wiek)`.',
      wrongCount: 'Liczba się nie zgadza, bo osób było pięć. Sprawdź, czy wszystkie są w `c()`.',
      fromSheet: 'To wiek z całej ankiety, czyli 8 osób. Zadanie mówi o pięciu, więc zbuduj własny wektor przez `c()`.',
      general: 'Jeszcze nie to. Pięć wartości w `wiek`, a na końcu `length(wiek)`.',
    },
    success: 'Tak jest. Pięć osób, wektor o długości 5.',
    note: 'Ta liczba to twoje N. Będziesz ją sprawdzać po każdym filtrowaniu.',

    nearMisses: [
      { name: 'printed the vector instead of its length', expect: 'missing.length',
        code: 'wiek <- c(23, 34, 45, 29, 51)\nwiek' },
      { name: 'one respondent left out', expect: 'wrongCount',
        code: 'wiek <- c(23, 34, 45, 29)\nlength(wiek)' },
      { name: 'built the vector without c()', expect: 'missing.c',
        code: 'wiek <- 1:5\nlength(wiek)' },
      { name: 'counted the whole survey column instead', expect: 'fromSheet',
        code: 'length(ankieta$wiek)' },
    ],

    diagnose({ value, code, result }) {
      // The survey is right there in memory; counting its column is a natural slip.
      if (/ankieta/.test(code || '') && isAtomic(value) && value.values?.[0] === 8) return 'fromSheet';
      if (!value || !isAtomic(value)) {
        return result?.reason === 'missing-call' ? `missing.${result.detail.name}` : 'general';
      }
      // The shape of the result explains more than the missing call, so it comes first.
      if (rLength(value) !== 1) {
        return result?.reason === 'missing-call' ? `missing.${result.detail.name}` : 'notLength';
      }
      if (result?.reason === 'missing-call') return `missing.${result.detail.name}`;
      const n = value.values[0];
      if (n === 5) return 'general';
      return typeof n === 'number' ? 'wrongCount' : 'general';
    },
  },
};

export default vectors;

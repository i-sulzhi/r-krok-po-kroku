/**
 * Lesson: mutate() -- module 7, syllabus topic 2.
 *
 * `mutate()` widens the table with a column computed from the others -- all rows at
 * once, the same vectorisation and recycling as lesson 3, now inside a table. And one
 * irreversible trap: an existing column name overwrites that column. The condition
 * inside mutate() is clickable, so the student sees the elementwise picture of
 * `ocena * 20` again, with a column as the left operand.
 */

import { resultCheck } from './schema.js';
import { getNames, isNA, isDataFrame } from '../core/rvalue.js';

const SETUP = `# Ta sama ankieta, sześć osób
ankieta <- data.frame(
  id = 1:6,
  plec = c("K", "M", "K", "M", "K", "M"),
  wiek = c(23, 34, 45, 29, 51, 38),
  miasto = c("Kraków", "Warszawa", "Kraków", "Gdańsk", "Warszawa", "Kraków"),
  wyksztalcenie = c("wyższe", "średnie", "wyższe", "wyższe", "średnie", "średnie"),
  ocena = c(4, 5, 3, 5, 2, 4)
)`;

const ORIGINAL = ['id', 'plec', 'wiek', 'miasto', 'wyksztalcenie', 'ocena'];

const SOLUTION = `ankieta |>
  mutate(odchylenie = ocena - mean(ocena))`;

/** Does this column look centred -- numeric, complete, and summing to zero? */
function isCentred(col) {
  if (!col || (col.type !== 'double' && col.type !== 'integer')) return false;
  if (col.values.some(isNA)) return false;
  return Math.abs(col.values.reduce((a, b) => a + b, 0)) < 1e-8;
}

export const mutating = {
  id: 'mutating',
  module: 7,
  requires: ['selecting'],
  title: 'mutate(): nowa kolumna',
  setup: SETUP,

  scenes: [
    {
      say: '`mutate()` dokłada **nową kolumnę** policzoną z innych.',
      code: 'ankieta |>\n  mutate(ocena_pct = ocena * 20)',
      pick: 'ankieta |>\n  mutate(ocena_pct = ocena * 20)',
      tap: 'ocena * 20',
    },
    {
      say: 'Jedna wartość wypełnia **wszystkie wiersze**. To recykling z lekcji 3.',
      code: 'ankieta |>\n  mutate(stala = 1)',
      pick: 'ankieta |>\n  mutate(stala = 1)',
    },
    {
      say: 'Nazwa, która już istnieje = **nadpisanie** w wyniku. `ankieta` w pamięci zostaje.',
      code: 'ankieta |>\n  mutate(wiek = 0)',
      pick: 'ankieta |>\n  mutate(wiek = 0)',
    },
    {
      // In RStudio the first surprise: "I added a column and it is not there". Every
      // verb returns a new table; nothing is kept until it gets a name.
      say: 'Wynik nie zapisuje się sam. Strzałka `<-` nadaje mu **nazwę** w pamięci.',
      code: 'ankieta_pct <- ankieta |>\n  mutate(ocena_pct = ocena * 20)',
      pick: 'ankieta_pct <- ankieta |>\n  mutate(ocena_pct = ocena * 20)',
      tap: 'ankieta_pct',
    },
  ],

  play: {
    code: 'ankieta |>\n  mutate(starszy = wiek > 40)',
    chips: [
      'ankieta |> mutate(ocena_pct = ocena * 20, polowa = ocena_pct / 2)',
      'ankieta |> mutate(sredni_wiek = mean(wiek))',
      'ankieta |> mutate(wiek_za_10 = wiek + 10)',
    ],
  },

  task: {
    prompt: 'Dodaj kolumnę **odchylenie**: ocena minus średnia ocena. Kolumna `ocena` ma zostać.',
    starter: 'ankieta |>\n  ',
    check: resultCheck({ expected: SOLUTION, requireCalls: ['mutate'] }),
    solution: SOLUTION,
    hints: [
      'Rachunek znasz z lekcji 3: wartość minus średnia. W `mutate()` piszesz nazwę kolumny bez `$`.',
      'Nowa nazwa stoi po lewej stronie: `mutate(odchylenie = ...)`.',
    ],
    messages: {
      'missing.mutate': 'Zadanie jest o `mutate()`. `ankieta$nowa <- ...` zmienia tabelę w pamięci; `mutate()` zwraca nową.',
      notATable: 'Wynikiem ma być cała tabela z nową kolumną.',
      noNewColumn: 'Nie ma nowej kolumny. Po lewej od `=` wpisz nową nazwę.',
      overwrote: 'Odchylenia trafiły do kolumny `ocena`, więc oryginał zniknął. Nowa kolumna potrzebuje nowej nazwy.',
      notCentred: 'Nowa kolumna jest, ale to nie odchylenia: ich suma powinna wynosić zero.',
      wrongName: 'Rachunek dobry, ale kolumna ma się nazywać `odchylenie`.',
      general: 'Jeszcze nie to: `mutate(odchylenie = ocena - mean(ocena))`.',
    },
    success: 'Dobrze. Siedem kolumn, oryginał nietknięty.',
    note: 'To ten sam rachunek co na luźnym wektorze w lekcji 3, tylko wewnątrz tabeli.',

    nearMisses: [
      { name: 'overwrote the original column', expect: 'overwrote',
        code: 'ankieta |> mutate(ocena = ocena - mean(ocena))' },
      { name: 'subtracted a guess instead of the mean', expect: 'notCentred',
        code: 'ankieta |> mutate(odchylenie = ocena - 4)' },
      { name: 'stored the mean itself', expect: 'notCentred',
        code: 'ankieta |> mutate(odchylenie = mean(ocena))' },
      { name: 'named the new column differently', expect: 'wrongName',
        code: 'ankieta |> mutate(odch = ocena - mean(ocena))' },
      { name: 'used base R assignment', expect: 'missing.mutate',
        code: 'ankieta$odchylenie <- ankieta$ocena - mean(ankieta$ocena)' },
    ],

    diagnose({ value, result }) {
      if (!value) return 'general';
      if (!isDataFrame(value)) {
        return result?.reason === 'missing-call' ? `missing.${result.detail.name}` : 'notATable';
      }
      const names = (getNames(value)?.values || []).map(String);
      if (names.length === ORIGINAL.length) {
        // No column was added. Either nothing happened, or an existing one was
        // replaced -- and if `ocena` now sums to zero, it was replaced by the answer.
        return isCentred(value.values[names.indexOf('ocena')]) ? 'overwrote' : 'noNewColumn';
      }
      const added = names.filter((n) => !ORIGINAL.includes(n));
      if (!added.length) return 'noNewColumn';
      if (!isCentred(value.values[names.indexOf(added[0])])) return 'notCentred';
      if (added[0] !== 'odchylenie') return 'wrongName';
      if (result?.reason === 'missing-call') return `missing.${result.detail.name}`;
      return 'general';
    },
  },
};

export default mutating;

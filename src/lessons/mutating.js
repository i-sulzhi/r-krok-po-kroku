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

// For those who want more (D41): a comparison makes a column too, and the chain
// goes on after mutate().
const EXTRA = `ankieta |>
  mutate(powyzej = wiek > mean(wiek)) |>
  select(id, wiek, powyzej)`;

export const mutating = {
  id: 'mutating',
  module: 7,
  lecture: 2,
  requires: ['selecting'],
  title: 'mutate(): nowa kolumna',
  setup: SETUP,

  scenes: [
    // Before any code (D29): the question, and the table before and after.
    {
      say: 'Odpowiedź wymaga **nowej kolumny**, policzonej z tej, która już jest.',
      picture: { kind: 'verb', question: 'Jak wygląda ocena w procentach?', code: 'ankieta |> mutate(ocena_pct = ocena * 20)' },
    },
    {
      say: '`mutate()` dokłada **nową kolumnę** policzoną z innych.',
      code: 'ankieta |>\n  mutate(ocena_pct = ocena * 20)',
      pick: 'ankieta |>\n  mutate(ocena_pct = ocena * 20)',
      tap: 'ocena * 20',
    },
    {
      say: 'Jedna wartość wypełnia **wszystkie wiersze**. To recykling z ćwiczenia 3.',
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
      'Rachunek znasz z ćwiczenia 3: wartość minus średnia. W `mutate()` piszesz nazwę kolumny bez `$`.',
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
    note: 'To ten sam rachunek co na luźnym wektorze w ćwiczeniu 3, tylko wewnątrz tabeli.',

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

  extra: {
    prompt: 'Dodaj kolumnę **powyzej**: TRUE, gdy wiek jest wyższy od średniego. Zostaw tylko `id`, `wiek` i `powyzej`.',
    starter: 'ankieta |>\n  ',
    check: resultCheck({ expected: EXTRA, requireCalls: ['mutate'] }),
    solution: EXTRA,
    hints: [
      'Porównanie też daje kolumnę: `mutate(powyzej = wiek > ...)`. Średnią policzy `mean(wiek)`.',
      'Na końcu drugi krok potoku: `select()` z trzema nazwami.',
    ],
    messages: {
      'missing.mutate': 'Nową kolumnę dokłada `mutate()`.',
      notATable: 'Wynikiem ma być tabela z trzema kolumnami.',
      filtered: 'Zostało mniej niż sześć osób. `mutate()` nikogo nie usuwa, a `filter()` nie jest tu potrzebny.',
      noNewColumn: 'Nie ma kolumny `powyzej`. Nazwę piszesz po lewej stronie znaku `=`.',
      notLogical: 'Kolumna `powyzej` ma zawierać TRUE i FALSE. Daje je porównanie `wiek > mean(wiek)`.',
      notMean: 'TRUE i FALSE są, ale nie względem średniej. Średni wiek to `mean(wiek)`, a nie liczba wpisana ręcznie.',
      tooManyColumns: 'Kolumna jest dobra. Teraz zostaw tylko trzy: `select(id, wiek, powyzej)`.',
      wrongColumns: 'Mają zostać `id`, `wiek` i `powyzej`.',
      general: 'Jeszcze nie to: `mutate(powyzej = wiek > mean(wiek))`, potem `select()`.',
    },
    success: 'Dobrze. Trzy osoby są starsze od średniej.',
    note: 'Średni wiek to 36.67. `mean(wiek)` daje jedną liczbę, a porównanie przykłada ją do każdego wiersza.',

    nearMisses: [
      { name: 'stopped after mutate', expect: 'tooManyColumns',
        code: 'ankieta |> mutate(powyzej = wiek > mean(wiek))' },
      { name: 'typed a number instead of the mean', expect: 'notMean',
        code: 'ankieta |> mutate(powyzej = wiek > 40) |> select(id, wiek, powyzej)' },
      { name: 'subtracted instead of comparing', expect: 'notLogical',
        code: 'ankieta |> mutate(powyzej = wiek - mean(wiek)) |> select(id, wiek, powyzej)' },
      { name: 'filtered the older people out', expect: 'filtered',
        code: 'ankieta |> filter(wiek > mean(wiek)) |> select(id, wiek)' },
      { name: 'named the column differently', expect: 'noNewColumn',
        code: 'ankieta |> mutate(starszy = wiek > mean(wiek)) |> select(id, wiek, starszy)' },
      { name: 'pulled the new column out', expect: 'notATable',
        code: 'ankieta |> mutate(powyzej = wiek > mean(wiek)) |> pull(powyzej)' },
      { name: 'left the id out', expect: 'wrongColumns',
        code: 'ankieta |> mutate(powyzej = wiek > mean(wiek)) |> select(wiek, powyzej)' },
    ],

    diagnose({ value, result }) {
      if (!value) return 'general';
      if (!isDataFrame(value)) {
        return result?.reason === 'missing-call' ? `missing.${result.detail.name}` : 'notATable';
      }
      const names = (getNames(value)?.values || []).map(String);
      const col = (name) => value.values[names.indexOf(name)];
      if (!value.values.length || value.values[0].values.length !== 6) return 'filtered';
      const flag = col('powyzej');
      if (!flag) return 'noNewColumn';
      if (flag.type !== 'logical') return 'notLogical';
      const wiek = col('wiek');
      if (!wiek) return 'wrongColumns';
      const mean = wiek.values.reduce((a, b) => a + b, 0) / wiek.values.length;
      if (wiek.values.some((v, i) => (v > mean) !== flag.values[i])) return 'notMean';
      if (names.length > 3) return 'tooManyColumns';
      if (!names.includes('id')) return 'wrongColumns';
      if (result?.reason === 'missing-call') return `missing.${result.detail.name}`;
      return 'general';
    },
  },
};

export default mutating;

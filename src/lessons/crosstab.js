/**
 * Lesson: the cross table with pivot_wider() -- module 9, lecture 3 (D38).
 *
 * `count(miasto, plec)` answers "how many women and men in each city", but as a
 * long list: one row per pair. A report shows the same numbers as a cross table,
 * cities down and sexes across. `pivot_wider()` does only that: it changes the shape,
 * not one number.
 *
 * The shape is where the trap is. A pair nobody belongs to (no man answered in
 * Warszawa) has no row in the long table, so nothing reminds you of it. In the wide
 * table it must have a cell, and the cell is NA. For counts that NA means zero, and
 * `values_fill = 0` says so. For means it does not: the mean of nobody is not 0, and
 * filling it would invent an answer. Same function, same gap, two different truths.
 */

import { resultCheck } from './schema.js';
import { getNames, isNA, isDataFrame, mkList, mkCharacter } from '../core/rvalue.js';

const SETUP = `# Dziesięć osób z trzech miast. W Warszawie odpowiedziały tylko kobiety
ankieta <- data.frame(
  id = 1:10,
  miasto = c("Kraków", "Kraków", "Kraków", "Kraków", "Gdańsk",
             "Gdańsk", "Gdańsk", "Gdańsk", "Warszawa", "Warszawa"),
  plec = c("K", "K", "K", "M", "K", "M", "M", "M", "K", "K"),
  ocena = c(4, 5, 3, 4, 5, 2, 4, 3, 5, 4)
)`;

const LONG = `ankieta |>
  count(miasto, plec)`;

const WIDE = `ankieta |>
  count(miasto, plec) |>
  pivot_wider(names_from = plec, values_from = n)`;

const FILLED = `ankieta |>
  count(miasto, plec) |>
  pivot_wider(names_from = plec, values_from = n,
              values_fill = 0)`;

const MEANS = `ankieta |>
  group_by(miasto, plec) |>
  summarise(srednia = mean(ocena)) |>
  pivot_wider(names_from = plec,
              values_from = srednia)`;

const SOLUTION = `ankieta |>
  count(plec, miasto) |>
  pivot_wider(names_from = miasto, values_from = n,
              values_fill = 0)`;

const CITIES = ['Gdańsk', 'Kraków', 'Warszawa'];

const strict = resultCheck({ expected: SOLUTION, requireCalls: ['pivot_wider'] });

/**
 * A row total beside the cities is a report's habit, not a mistake (D72): a column
 * that holds each row's sum of the cities is set aside before comparing. The counts
 * may come from count() or from group_by() and summarise(n = n()) alike.
 */
function check(ctx) {
  const v = ctx.value;
  if (v && isDataFrame(v)) {
    const names = (getNames(v)?.values || []).map(String);
    if (CITIES.every((c) => names.includes(c))) {
      const sumAt = (r) => CITIES.reduce((a, c) => a + Number(v.values[names.indexOf(c)].values[r]), 0);
      const total = names.findIndex((nm, i) => !CITIES.includes(nm) && nm !== 'plec'
        && v.values[i].values.every((x, r) => Number(x) === sumAt(r)));
      if (total !== -1) {
        const keep = names.map((_, i) => i).filter((i) => i !== total);
        return strict({ ...ctx, value: mkList(keep.map((i) => v.values[i]), { ...v.attributes, names: mkCharacter(keep.map((i) => names[i])) }) });
      }
    }
  }
  return strict(ctx);
}
check.compare = strict.compare;

/** The values of a column of the student's table, by name; [] when it is not there. */
const colOf = (value, name) => {
  const names = (getNames(value)?.values || []).map(String);
  const at = names.indexOf(name);
  return at < 0 ? [] : value.values[at].values;
};

// For those who want more (D64): the same shape with means, where the gap must stay
// NA. Scene 5 showed it; here the student decides it.
const EXTRA = `ankieta |>
  group_by(plec, miasto) |>
  summarise(srednia = mean(ocena)) |>
  pivot_wider(names_from = miasto,
              values_from = srednia)`;


export const crosstab = {
  id: 'crosstab',
  module: 9,
  lecture: 3,
  requires: ['counting', 'percentages'],
  title: 'Tabela krzyżowa: pivot_wider()',
  setup: SETUP,

  scenes: [
    {
      say: 'Policzone pary to długa lista. W raporcie miasta stoją **obok siebie**: tabela krzyżowa.',
      picture: { kind: 'verb', question: 'Ile kobiet i ilu mężczyzn odpowiedziało w każdym mieście?', code: WIDE },
    },
    {
      say: '`count()` daje długą tabelę: wiersz to jedna para. Pary Warszawa i M **nie ma**.',
      code: LONG,
      pick: LONG,
    },
    {
      say: '`names_from` daje **nazwy** nowych kolumn, `values_from` liczby. Brak pary to NA.',
      code: WIDE,
      pick: WIDE,
    },
    {
      say: 'Przy liczeniu osób pusta para znaczy **zero**. Mówi to `values_fill = 0`.',
      code: FILLED,
      pick: FILLED,
    },
    {
      say: 'Średnie zamiast liczb, czego `table()` nie zrobi. NA zostaje: średniej z zera osób **nie ma**.',
      code: MEANS,
      pick: MEANS,
    },
  ],

  play: {
    say: 'Twoja kolej. Liczy się na długiej tabeli, a szeroka jest do czytania: `pivot_wider()` stoi na końcu.',
    code: 'ankieta |>\n  count(miasto, ocena) |>\n  pivot_wider(names_from = ocena, values_from = n)',
    chips: [
      'ankieta |> count(miasto, ocena) |> pivot_wider(names_from = ocena, values_from = n, values_fill = 0)',
      'ankieta |> count(ocena, plec) |> pivot_wider(names_from = plec, values_from = n, values_fill = 0)',
      'ankieta |> group_by(plec, miasto) |> summarise(srednia = mean(ocena)) |> pivot_wider(names_from = miasto, values_from = srednia)',
      'ankieta |> count(plec) |> pivot_wider(names_from = plec, values_from = n)',
    ],
  },

  task: {
    prompt: 'Odwróć tabelę: **płeć w wierszach**, miasta w kolumnach, w środku liczba osób. Puste pary to 0.',
    starter: 'ankieta |>\n  count(plec, miasto) |>\n  ',
    check,
    solution: SOLUTION,
    hints: [
      'Nazwy nowych kolumn to miasta: `names_from = miasto`. Do środka idą liczby: `values_from = n`.',
      'Para bez osób to tutaj zero: dopisz `values_fill = 0`.',
    ],
    messages: {
      'missing.count': 'Najpierw liczby: `count(plec, miasto)` daje `n` dla każdej pary.',
      'missing.pivot_wider': 'To jeszcze długa tabela. Rozłóż ją: `pivot_wider(names_from = miasto, values_from = n)`.',
      notATable: 'Wynikiem ma być tabela: jeden wiersz na płeć, jedna kolumna na miasto.',
      long: 'To jeszcze długa tabela. Rozłóż ją: `pivot_wider(names_from = miasto, values_from = n)`.',
      turned: 'Miasta są w wierszach, a mają być w kolumnach. Zamień: `names_from = miasto`.',
      rawData: 'Rozłożyły się oceny osób, a nie liczby: każda osoba to dalej wiersz. Najpierw policz: `count(plec, miasto)`.',
      hasNA: 'W tabeli jest NA: mężczyzn z Warszawy nie było. To zero osób, więc dopisz `values_fill = 0`.',
      wrongNumbers: 'Kształt dobry, ale liczby nie. W środku mają być liczby osób: `values_from = n`.',
      general: 'Jeszcze nie to. Po `count()` idzie `pivot_wider()` z `names_from`, `values_from` i `values_fill`.',
    },
    success: 'Dobrze. Dwa wiersze, trzy miasta, żadnej pustej komórki.',
    note: 'Suma wszystkich komórek to 10, tyle osób było w ankiecie. Warto to sprawdzać.',

    nearMisses: [
      { name: 'left the gap as NA', expect: 'hasNA',
        code: 'ankieta |> count(plec, miasto) |> pivot_wider(names_from = miasto, values_from = n)' },
      { name: 'put the cities in the rows', expect: 'turned',
        code: 'ankieta |> count(plec, miasto) |> pivot_wider(names_from = plec, values_from = n, values_fill = 0)' },
      { name: 'stopped at the long table', expect: 'missing.pivot_wider',
        code: 'ankieta |> count(plec, miasto)' },
      { name: 'summed the grades instead of counting people', expect: 'wrongNumbers',
        code: 'ankieta |> group_by(plec, miasto) |> summarise(n = sum(ocena)) |> pivot_wider(names_from = miasto, values_from = n, values_fill = 0)' },
      { name: 'spread the raw survey', expect: 'rawData',
        code: 'ankieta |> pivot_wider(names_from = miasto, values_from = ocena)' },
      { name: 'forgot one of the two settings', expect: 'error',
        code: 'ankieta |> count(plec, miasto) |> pivot_wider(names_from = miasto)' },
    ],

    diagnose({ value, result }) {
      if (!value) return 'general';
      const missing = result?.reason === 'missing-call' ? `missing.${result.detail.name}` : null;
      if (!isDataFrame(value)) return missing || 'notATable';
      const names = (getNames(value)?.values || []).map(String);
      if (names.includes('n') && names.includes('miasto')) return missing || 'long';
      if (names.includes('miasto')) return 'turned';
      // pivot_wider() straight on the survey: people stay rows, ratings fill the cities.
      if (names.includes('id') || names.includes('ocena')) return 'rawData';
      if (!CITIES.every((c) => names.includes(c))) return missing || 'general';
      const cells = CITIES.flatMap((c) => value.values[names.indexOf(c)].values);
      if (cells.some(isNA)) return 'hasNA';
      if (cells.reduce((a, b) => a + Number(b), 0) !== 10) return 'wrongNumbers';
      return missing || 'general';
    },
  },

  extra: {
    prompt: '**Średnia ocena**: płeć w wierszach, miasta w kolumnach. Pustą parę zostaw jako NA.',
    starter: 'ankieta |>\n  ',
    check: resultCheck({ expected: EXTRA, requireCalls: ['pivot_wider'], compare: { tolerance: 0.01, ignoreRowOrder: true } }),
    solution: EXTRA,
    hints: [
      'Najpierw średnie dla par: `group_by(plec, miasto)` i `summarise(srednia = mean(ocena))`.',
      'Potem `pivot_wider(names_from = miasto, values_from = srednia)`, bez `values_fill`.',
    ],
    messages: {
      'missing.pivot_wider': 'To jeszcze długa tabela. Rozłóż ją: `pivot_wider(names_from = miasto, values_from = srednia)`.',
      filledZero: 'Pusta para dostała 0. Średniej z zera osób nie ma, więc zostaw NA: bez `values_fill`.',
      counted: 'W środku są liczby osób, a mają być średnie oceny: `summarise(srednia = mean(ocena))`.',
      turned: 'Miasta są w wierszach, a mają być w kolumnach: `names_from = miasto`.',
      notCollapsed: 'Każda osoba to dalej wiersz: `mutate()` nie zwija grup. Jedną średnią na parę liczy `summarise()`.',
      extraColumn: 'Obok średniej została druga kolumna i rozbiła wiersze: `pivot_wider()` bierze ją za część wiersza. Zostaw samą średnią.',
      general: 'Jeszcze nie to: `group_by(plec, miasto)`, `summarise()` i `pivot_wider()`.',
    },
    success: 'Dobrze. Kobiety z Gdańska: 5, mężczyźni z Warszawy: NA.',
    note: 'NA znaczy „nikogo nie było”. Zero byłoby oceną, której nikt nie dał.',

    nearMisses: [
      { name: 'filled the gap with zero', expect: 'filledZero',
        code: 'ankieta |> group_by(plec, miasto) |> summarise(srednia = mean(ocena)) |> pivot_wider(names_from = miasto, values_from = srednia, values_fill = 0)' },
      { name: 'counted people instead', expect: 'counted',
        code: 'ankieta |> count(plec, miasto) |> pivot_wider(names_from = miasto, values_from = n)' },
      { name: 'put the cities in the rows', expect: 'turned',
        code: 'ankieta |> group_by(plec, miasto) |> summarise(srednia = mean(ocena)) |> pivot_wider(names_from = plec, values_from = srednia)' },
      { name: 'stopped at the long table', expect: 'missing.pivot_wider',
        code: 'ankieta |> group_by(plec, miasto) |> summarise(srednia = mean(ocena))' },
      { name: 'used mutate() for the mean', expect: 'notCollapsed',
        code: 'ankieta |> group_by(plec, miasto) |> mutate(srednia = mean(ocena)) |> pivot_wider(names_from = miasto, values_from = srednia)' },
      { name: 'kept n beside the mean', expect: 'extraColumn',
        code: 'ankieta |> group_by(plec, miasto) |> summarise(srednia = mean(ocena), n = n()) |> pivot_wider(names_from = miasto, values_from = srednia)' },
      { name: 'asked pivot_wider() for the mean', expect: 'error',
        code: 'ankieta |> pivot_wider(names_from = miasto, values_from = ocena, values_fn = mean)' },
    ],

    diagnose({ value, result }) {
      if (!value || !isDataFrame(value)) return 'general';
      if (result?.reason === 'missing-call') return `missing.${result.detail.name}`;
      const names = (getNames(value)?.values || []).map(String);
      if (names.includes('miasto')) return 'turned';
      if (names.includes('id') || names.includes('ocena')) return 'notCollapsed';
      if (names.some((nm) => nm !== 'plec' && !CITIES.includes(nm))) return 'extraColumn';
      if (!CITIES.every((c) => names.includes(c))) return 'general';
      const sex = colOf(value, 'plec');
      if (Number(colOf(value, 'Warszawa')[sex.indexOf('M')]) === 0) return 'filledZero';
      if (Number(colOf(value, 'Gdańsk')[sex.indexOf('K')]) === 1) return 'counted';
      return 'general';
    },
  },
};

export default crosstab;

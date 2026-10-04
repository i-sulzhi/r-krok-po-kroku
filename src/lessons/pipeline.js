/**
 * Lesson: from a question to a table -- module 7, the closing lesson.
 *
 * Each verb has had its own lesson; real analysis is never one verb. A research
 * question ("where were the classes rated highest?") becomes four steps, each taking
 * the table the step before it made: drop the missing answers, group by city,
 * summarise, sort. The lesson opens with the whole journey as one moving table
 * (D29), then types it one step at a time, so every intermediate table is seen.
 *
 * The data is built so the answer needs reading, not just computing: Warszawa comes
 * out on top with a mean of 5, from one respondent. The column `n` beside the mean
 * is why that is visible, which is the point lessons 15 and 16 made separately.
 *
 * The last scene joins the two halves of the course: a factor made inside
 * `mutate()`, so that `count()` answers in words and in the order of the scale.
 *
 * The task is another question on the same table, three verbs and a sort. Counting
 * everyone, and sorting the wrong way, are the anticipated wrong answers.
 */

import { resultCheck } from './schema.js';
import { isDataFrame, getNames } from '../core/rvalue.js';

const NAMES = 'poziomy <- c("podstawowe", "średnie", "wyższe")';

const SETUP = `# Dziesięć osób z trzech miast; dwie nie podały oceny
ankieta <- data.frame(
  id = 1:10,
  plec = c("K", "M", "K", "K", "M", "M", "K", "M", "K", "M"),
  miasto = c("Kraków", "Warszawa", "Kraków", "Gdańsk", "Warszawa",
             "Kraków", "Gdańsk", "Warszawa", "Kraków", "Gdańsk"),
  wiek = c(23, 34, 45, 29, 51, 38, 27, 42, 19, 60),
  wyksztalcenie = c(3, 2, 3, 1, 2, 3, 2, 3, 2, 1),
  ocena = c(4, 5, 3, 4, NA, 5, 4, NA, 3, 5)
)
${NAMES}`;

const STEP1 = 'ankieta |>\n  filter(!is.na(ocena))';
const STEP3 = `${STEP1} |>\n  group_by(miasto) |>\n  summarise(n = n(), srednia = mean(ocena))`;
const STEP4 = `${STEP3} |>\n  arrange(desc(srednia))`;

const SOLUTION = `ankieta |>
  filter(wiek > 25) |>
  group_by(plec) |>
  summarise(n = n(), sredni_wiek = mean(wiek)) |>
  arrange(desc(sredni_wiek))`;

export const pipeline = {
  id: 'pipeline',
  module: 7,
  requires: ['counting', 'factor-table'],
  title: 'Od pytania do tabeli',
  setup: SETUP,

  scenes: [
    {
      say: 'Jedno pytanie, cztery kroki. Każdy krok bierze tabelę z poprzedniego.',
      picture: { kind: 'verb', question: 'W którym mieście zajęcia oceniono najwyżej?', code: STEP4 },
    },
    {
      say: 'Krok 1. Średnia potrzebuje odpowiedzi, więc wiersze z **NA** wypadają.',
      code: STEP1,
    },
    {
      say: 'Kroki 2 i 3. Dla każdego miasta: ile odpowiedzi i jaka średnia.',
      code: STEP3,
    },
    {
      say: 'Krok 4. Najwyższa średnia na górze. Ale spójrz na **n**: Warszawa to jedna osoba.',
      code: STEP4,
      tap: 'desc(srednia)',
    },
    {
      say: 'Czynnik w potoku: `mutate()` zamienia kody na słowa, a `count()` liczy według skali.',
      code: `${NAMES}\nankieta |>\n  mutate(wyksztalcenie = factor(wyksztalcenie,\n    levels = 1:3, labels = poziomy)) |>\n  count(wyksztalcenie)`,
    },
  ],

  play: {
    code: 'ankieta |>\n  filter(wiek > 30) |>\n  count(miasto)',
    chips: [
      'ankieta |> count(plec, miasto)',
      'ankieta |> filter(plec == "K") |> summarise(n = n())',
      'ankieta |> arrange(desc(wiek)) |> select(id, wiek)',
      'ankieta |> filter(!is.na(ocena)) |> nrow()',
      'ankieta |> group_by(plec) |> summarise(srednia = mean(ocena, na.rm = TRUE))',
    ],
  },

  task: {
    prompt: 'Tylko osoby **powyżej 25 lat**. Dla każdej płci: liczba osób (**n**) i średni wiek (**sredni_wiek**). Najstarsza grupa na górze.',
    starter: 'ankieta |>\n  ',
    check: resultCheck({ expected: SOLUTION, requireCalls: ['filter', 'group_by', 'summarise', 'arrange'] }),
    solution: SOLUTION,
    hints: [
      'Cztery kroki po kolei: `filter()`, `group_by()`, `summarise()`, `arrange()`. Między nimi `|>`.',
      'W `summarise()` dwie kolumny: `n = n()` i `sredni_wiek = mean(wiek)`.',
      'Najstarsza grupa na górze: `arrange(desc(sredni_wiek))`.',
    ],
    messages: {
      'missing.filter': 'Zadanie mówi o osobach powyżej 25 lat. Zacznij od `filter(wiek > 25)`.',
      'missing.group_by': 'Wynik ma być osobno dla każdej płci, więc potrzebne jest `group_by(plec)`.',
      'missing.summarise': 'Liczbę osób i średni wiek policzy `summarise()`.',
      'missing.arrange': 'Brakuje ostatniego kroku. Kolejność wierszy ustawia `arrange()`.',
      notTable: 'Wynik ma być tabelą: jeden wiersz na płeć.',
      names: 'Kolumny mają się nazywać `n` i `sredni_wiek`. Nazwę piszesz po lewej stronie znaku `=`.',
      everyone: 'Policzone są wszystkie osoby. Najpierw zostaw tylko te powyżej 25 lat.',
      ascending: 'Kolejność jest odwrotna. Najstarsza grupa ma być na górze: `arrange(desc(sredni_wiek))`.',
      general: 'Jeszcze nie to: `filter()`, potem `group_by(plec)`, `summarise()` i `arrange()`.',
    },
    success: 'Dobrze. Mężczyźni średnio 45 lat, kobiety niecałe 34.',
    note: 'Tak wygląda większość analiz ankiety: wybierz, pogrupuj, policz, ułóż.',

    nearMisses: [
      { name: 'counted everyone', expect: 'everyone',
        code: 'ankieta |> group_by(plec) |> summarise(n = n(), sredni_wiek = mean(wiek)) |> arrange(desc(sredni_wiek))' },
      { name: 'forgot to sort', expect: 'missing.arrange',
        code: 'ankieta |> filter(wiek > 25) |> group_by(plec) |> summarise(n = n(), sredni_wiek = mean(wiek))' },
      { name: 'sorted ascending', expect: 'ascending',
        code: 'ankieta |> filter(wiek > 25) |> group_by(plec) |> summarise(n = n(), sredni_wiek = mean(wiek)) |> arrange(sredni_wiek)' },
      { name: 'named the columns differently', expect: 'names',
        code: 'ankieta |> filter(wiek > 25) |> group_by(plec) |> summarise(ile = n(), srednia = mean(wiek)) |> arrange(desc(srednia))' },
      { name: 'never grouped', expect: 'missing.group_by',
        code: 'ankieta |> filter(wiek > 25) |> summarise(n = n(), sredni_wiek = mean(wiek)) |> arrange(desc(sredni_wiek))' },
    ],

    diagnose({ value, result }) {
      if (!value || !isDataFrame(value)) return 'notTable';
      const names = (getNames(value)?.values || []).map(String);
      const col = (name) => value.values[names.indexOf(name)]?.values || [];
      if (!names.includes('n') || !names.includes('sredni_wiek')) {
        return result?.reason === 'missing-call' && result.detail.name !== 'arrange' ? `missing.${result.detail.name}` : 'names';
      }
      if (col('n').reduce((a, b) => a + b, 0) === 10 && col('n').length > 1) return 'everyone';
      if (result?.reason === 'missing-call') return `missing.${result.detail.name}`;
      const ages = col('sredni_wiek');
      if (ages.length > 1 && ages[0] < ages[ages.length - 1]) return 'ascending';
      return 'general';
    },
  },
};

export default pipeline;

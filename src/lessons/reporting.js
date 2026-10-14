/**
 * Lesson: from a question to a line in a report -- module 9, lecture 3 (D43).
 *
 * The last exercise adds no verb. It takes one question a report really asks, "are
 * the younger more satisfied?", and walks it through everything lecture 3 taught:
 * a group made from a number, a percent, and the missing answers on the way.
 *
 * Two people are in the way. One gave no age, so she forms a group called NA; one
 * gave no rating, so the percent of his group is NA. Both are removed in the open,
 * at the top of the chain, where a reader of the code sees who was left out.
 *
 * The habit the exercise leaves behind is its last step: `n` beside every percent.
 * The closing scene cuts the same ten people into three groups, and "100%" turns
 * out to be two people.
 */

import { resultCheck } from './schema.js';
import { getNames, isNA, isDataFrame } from '../core/rvalue.js';
import { buildPlot } from '../core/builtins/ggplot.js';

const SETUP = `# Ocena zajęć, dziesięć osób. Jedna nie podała wieku, jedna oceny
ankieta <- data.frame(
  id = 1:10,
  plec = c("K", "M", "K", "M", "K", "M", "K", "M", "K", "M"),
  wiek = c(22, 25, 28, 31, 35, 44, 52, 58, NA, 27),
  ocena = c(5, 4, 4, 3, NA, 3, 5, 5, 4, 2)
)`;

const GROUP = `  mutate(
    grupa = if_else(wiek < 30, "do 29", "30+")
  )`;
const CLEAN = '  filter(!is.na(wiek), !is.na(ocena))';
const PERCENT = 'mean(ocena >= 4) * 100';

const STEP1 = `ankieta |>\n${GROUP}`;
const STEP2 = `${STEP1} |>\n  group_by(grupa) |>\n  summarise(procent = ${PERCENT})`;
const STEP3 = `ankieta |>\n${CLEAN} |>\n${GROUP} |>\n  group_by(grupa) |>\n  summarise(procent = ${PERCENT})`;
const STEP4 = `ankieta |>\n${CLEAN} |>\n${GROUP} |>\n  group_by(grupa) |>\n  summarise(n = n(), procent = ${PERCENT})`;

const THREE = `ankieta |>
${CLEAN} |>
  mutate(grupa = case_when(
    wiek < 30 ~ "do 29",
    wiek < 50 ~ "30-49",
    .default = "50+"
  )) |>
  group_by(grupa) |>
  summarise(n = n(), procent = ${PERCENT})`;

const BY_SEX = `ankieta |>
  filter(!is.na(ocena)) |>
  group_by(plec) |>
  summarise(n = n(), procent = ${PERCENT})`;

const SOLUTION = `ankieta |>
${CLEAN} |>
  mutate(
    grupa = if_else(wiek >= 40, "40+", "do 39")
  ) |>
  group_by(grupa) |>
  summarise(n = n(), procent = ${PERCENT})`;

// What the task's table holds: people who gave both an age and a rating.
const ANSWERED = { '40+': 3, 'do 39': 5 };

// For those who want more (D49): the report drawn. The table is already in the box,
// so the task is only the two lines a plot adds, and the one thing that trips
// everyone at the start: layers are joined by `+`, not by `|>`. Exercise 24 teaches
// the plot properly; this is the bridge to it from the end of lecture 3.
// The task's table, its last line broken so that `|>` fits the box.
const REPORT = SOLUTION.replace('summarise(n = n(), procent', 'summarise(n = n(),\n            procent');
const EXTRA = `${REPORT} |>
  ggplot(aes(x = grupa, y = procent)) +
  geom_col()`;

export const reporting = {
  id: 'reporting',
  module: 9,
  lecture: 3,
  requires: ['recoding', 'percentages', 'grouping'],
  title: 'Od pytania do raportu',
  setup: SETUP,

  scenes: [
    {
      say: 'Jedno pytanie z raportu, **cztery kroki**. Każdy z nich już znasz.',
      picture: { kind: 'verb', question: 'Czy młodsi są bardziej zadowoleni z zajęć?', code: STEP4 },
    },
    {
      say: 'Krok 1. Pytanie jest o **młodszych i starszych**, więc z wieku robisz grupę.',
      code: STEP1,
      pick: STEP1,
      tap: 'wiek < 30',
    },
    {
      say: 'Krok 2. Zadowolony to ocena 4 lub 5. Procent wychodzi, ale z **dwoma NA**.',
      code: STEP2,
      tap: PERCENT,
    },
    {
      say: 'Krok 3. Braki usuwasz **na początku** i jawnie: osobę bez wieku i osobę bez oceny.',
      code: STEP3,
      tap: '!is.na(wiek)',
    },
    {
      say: 'Krok 4. Obok procentu stoi **n**. 75% i 50% to po cztery osoby.',
      code: STEP4,
      tap: 'n()',
    },
    {
      say: 'Te same dane w trzech grupach. **100%** w grupie 50+ to dwie osoby.',
      code: THREE,
    },
  ],

  play: {
    say: 'Twoja kolej. Ten sam raport dla innego pytania: zmień grupę, próg albo miarę.',
    code: BY_SEX,
    chips: [
      'ankieta |> filter(is.na(wiek) | is.na(ocena))',
      'ankieta |> filter(!is.na(ocena)) |> group_by(plec) |> summarise(n = n(), srednia = mean(ocena))',
      'ankieta |> filter(!is.na(ocena)) |> group_by(plec) |> summarise(n = n(), procent = round(mean(ocena == 5) * 100))',
      'ankieta |> filter(!is.na(ocena)) |> mutate(zadowolony = ocena >= 4) |> count(plec, zadowolony)',
      'ankieta |> filter(!is.na(ocena)) |> summarise(n = n(), procent = mean(ocena >= 4) * 100)',
    ],
  },

  task: {
    prompt: 'Dwie grupy wieku: `"do 39"` i `"40+"` (kolumna **grupa**). Dla każdej **n** i **procent** zadowolonych (ocena 4–5). Braki pomiń.',
    starter: 'ankieta |>\n  ',
    // A rounded percent is the same answer (67 for 66.66667); row order does not matter.
    check: resultCheck({
      expected: SOLUTION,
      requireCalls: ['group_by', 'summarise'],
      compare: { tolerance: 0.02, ignoreRowOrder: true },
    }),
    solution: SOLUTION,
    hints: [
      'Cztery kroki ze scen: `filter()`, `mutate()` z `if_else()`, `group_by(grupa)`, `summarise()`.',
      'Próg jest inny niż w scenach: `if_else(wiek >= 40, "40+", "do 39")`.',
      'W `summarise()` dwie kolumny: `n = n()` i `procent = mean(ocena >= 4) * 100`.',
    ],
    messages: {
      'missing.group_by': 'Wynik ma być osobno dla każdej grupy wieku, więc potrzebne jest `group_by(grupa)`.',
      'missing.summarise': 'Liczbę osób i procent policzy `summarise()`.',
      notATable: 'Wynikiem ma być tabela: jeden wiersz na grupę wieku.',
      notCollapsed: 'Grupa jest już przy każdej osobie. Teraz `group_by(grupa)` i `summarise()`.',
      noGroup: 'W wyniku nie ma kolumny `grupa`. Zrób ją z wieku: `mutate(grupa = if_else(...))`.',
      longShape: 'Liczby są, ale grupa zajmuje kilka wierszy. Raport ma jeden wiersz na grupę: `summarise()`.',
      naGroup: 'Jest wiersz z grupą NA. To osoba bez wieku. Usuń ją na początku: `filter(!is.na(wiek))`.',
      labels: 'Grupy mają się nazywać `"do 39"` i `"40+"`, dokładnie tak.',
      noN: 'Brakuje kolumny `n`. Procent bez liczby osób niewiele mówi: `n = n()`.',
      noPercent: 'Brakuje kolumny `procent`: `procent = mean(ocena >= 4) * 100`.',
      naPercent: 'Procent jest NA, bo ktoś nie podał oceny. Usuń go na początku: `filter(!is.na(ocena))`.',
      countedRows: '`n` liczy też osobę bez oceny: razem 9, a ocen jest 8. Usuń ją w `filter()`, nie przez `na.rm`.',
      wrongCut: 'Grupy mają inną wielkość. Próg to 40 lat: `if_else(wiek >= 40, "40+", "do 39")`.',
      fraction: 'To ułamki, nie procenty: brakuje `* 100`.',
      wrongPercent: 'Liczby osób są dobre, procent nie. Zadowolony to ocena 4 lub 5: `mean(ocena >= 4) * 100`.',
      general: 'Jeszcze nie to. Kolejność: `filter()`, `mutate()`, `group_by(grupa)`, `summarise()`.',
    },
    success: 'Dobrze. 60% z pięciu osób i 67% z trzech.',
    note: 'Różnica 7 punktów przy ośmiu osobach to jedna odpowiedź. Dlatego w raporcie obok procentu stoi n.',

    nearMisses: [
      { name: 'stopped after making the groups', expect: 'notCollapsed',
        code: 'ankieta |> mutate(grupa = if_else(wiek >= 40, "40+", "do 39"))' },
      { name: 'removed nobody', expect: 'naGroup',
        code: 'ankieta |> mutate(grupa = if_else(wiek >= 40, "40+", "do 39")) |> group_by(grupa) |> summarise(n = n(), procent = mean(ocena >= 4) * 100)' },
      { name: 'removed only the person without an age', expect: 'naPercent',
        code: 'ankieta |> filter(!is.na(wiek)) |> mutate(grupa = if_else(wiek >= 40, "40+", "do 39")) |> group_by(grupa) |> summarise(n = n(), procent = mean(ocena >= 4) * 100)' },
      // The quiet one: the percent is right, and n says six where five answered.
      { name: 'used na.rm instead of filtering', expect: 'countedRows',
        code: 'ankieta |> filter(!is.na(wiek)) |> mutate(grupa = if_else(wiek >= 40, "40+", "do 39")) |> group_by(grupa) |> summarise(n = n(), procent = mean(ocena >= 4, na.rm = TRUE) * 100)' },
      { name: 'gave the percent without n', expect: 'noN',
        code: 'ankieta |> filter(!is.na(wiek), !is.na(ocena)) |> mutate(grupa = if_else(wiek >= 40, "40+", "do 39")) |> group_by(grupa) |> summarise(procent = mean(ocena >= 4) * 100)' },
      { name: 'named the percent differently', expect: 'noPercent',
        code: 'ankieta |> filter(!is.na(wiek), !is.na(ocena)) |> mutate(grupa = if_else(wiek >= 40, "40+", "do 39")) |> group_by(grupa) |> summarise(n = n(), zadowoleni = mean(ocena >= 4) * 100)' },
      { name: 'left fractions', expect: 'fraction',
        code: 'ankieta |> filter(!is.na(wiek), !is.na(ocena)) |> mutate(grupa = if_else(wiek >= 40, "40+", "do 39")) |> group_by(grupa) |> summarise(n = n(), procent = mean(ocena >= 4))' },
      { name: 'counted only the fives as satisfied', expect: 'wrongPercent',
        code: 'ankieta |> filter(!is.na(wiek), !is.na(ocena)) |> mutate(grupa = if_else(wiek >= 40, "40+", "do 39")) |> group_by(grupa) |> summarise(n = n(), procent = mean(ocena > 4) * 100)' },
      { name: 'gave the mean rating as the percent', expect: 'wrongPercent',
        code: 'ankieta |> filter(!is.na(wiek), !is.na(ocena)) |> mutate(grupa = if_else(wiek >= 40, "40+", "do 39")) |> group_by(grupa) |> summarise(n = n(), procent = mean(ocena) * 20)' },
      { name: 'kept the threshold of the scenes', expect: 'wrongCut',
        code: 'ankieta |> filter(!is.na(wiek), !is.na(ocena)) |> mutate(grupa = if_else(wiek >= 30, "40+", "do 39")) |> group_by(grupa) |> summarise(n = n(), procent = mean(ocena >= 4) * 100)' },
      { name: 'named the groups differently', expect: 'labels',
        code: 'ankieta |> filter(!is.na(wiek), !is.na(ocena)) |> mutate(grupa = if_else(wiek >= 40, "starsi", "młodsi")) |> group_by(grupa) |> summarise(n = n(), procent = mean(ocena >= 4) * 100)' },
      { name: 'counted with count() and stopped', expect: 'longShape',
        code: 'ankieta |> filter(!is.na(wiek), !is.na(ocena)) |> mutate(grupa = if_else(wiek >= 40, "40+", "do 39"), zadowolony = ocena >= 4) |> count(grupa, zadowolony) |> group_by(grupa) |> mutate(procent = n / sum(n) * 100)' },
      { name: 'compared women and men', expect: 'noGroup',
        code: 'ankieta |> filter(!is.na(ocena)) |> group_by(plec) |> summarise(n = n(), procent = mean(ocena >= 4) * 100)' },
      { name: 'pulled the percent out', expect: 'notATable',
        code: 'ankieta |> filter(!is.na(wiek), !is.na(ocena)) |> mutate(grupa = if_else(wiek >= 40, "40+", "do 39")) |> group_by(grupa) |> summarise(n = n(), procent = mean(ocena >= 4) * 100) |> pull(procent)' },
    ],

    diagnose({ value, result }) {
      if (!value) return 'general';
      const missing = result?.reason === 'missing-call' ? `missing.${result.detail.name}` : null;
      if (!isDataFrame(value)) return missing || 'notATable';
      const names = (getNames(value)?.values || []).map(String);
      const column = (nm) => value.values[names.indexOf(nm)]?.values;
      if (names.includes('id')) return names.includes('grupa') ? 'notCollapsed' : (missing || 'noGroup');
      const grupa = column('grupa');
      if (!grupa) return missing || 'noGroup';
      if (grupa.some(isNA)) return 'naGroup';
      if (new Set(grupa).size !== grupa.length) return 'longShape';
      if (missing) return missing;
      if (grupa.length !== 2 || grupa.some((g) => !(g in ANSWERED))) return 'labels';
      const n = column('n');
      const procent = column('procent');
      if (!n) return 'noN';
      if (!procent) return 'noPercent';
      if (procent.some(isNA)) return 'naPercent';
      const total = n.reduce((a, b) => a + b, 0);
      if (total === 9) return 'countedRows';
      if (grupa.some((g, i) => n[i] !== ANSWERED[g])) return 'wrongCut';
      if (procent.every((p) => p <= 1)) return 'fraction';
      // Everything about the people is right, so what is left is the measure itself.
      return 'wrongPercent';
    },
  },

  extra: {
    prompt: 'Narysuj ten raport jako **słupki**: grupa wieku na osi x, **procent** na osi y. Tabela jest już w kodzie, dopisz wykres.',
    starter: `${REPORT} |>\n  `,
    check: resultCheck({ expected: EXTRA, requireCalls: ['ggplot', 'geom_col'] }),
    solution: EXTRA,
    hints: [
      'Wykres zaczyna `ggplot()`, tabelę dostaje z potoku. `aes()` mówi, która kolumna gdzie.',
      'Słupki rysuje warstwa `geom_col()`. Między `ggplot()` a warstwą stoi `+`, nie `|>`.',
      'Dwie ostatnie linie: `ggplot(aes(x = grupa, y = procent)) +` i `geom_col()`.',
    ],
    messages: {
      'missing.ggplot': 'Wykres zaczyna się od `ggplot(aes(x = grupa, y = procent))` na końcu potoku.',
      'missing.geom_col': 'Są osie, ale nic nie jest narysowane. Dołóż warstwę: `+ geom_col()`.',
      notAPlot: 'To wciąż tabela. Na końcu potoku dopisz `ggplot(aes(x = grupa, y = procent))`.',
      counted: '`geom_bar()` liczy wiersze, a każda grupa to jeden wiersz. Stąd wysokość 1. Procent narysuje `geom_col()`.',
      wrongY: 'Słupki pokazują liczbę osób, a mają pokazać procent: `y = procent`.',
      general: 'Jeszcze nie to: `ggplot(aes(x = grupa, y = procent))`, potem `+ geom_col()`.',
    },
    success: 'Dobrze. Dwa słupki, prawie równe: 60% i 67%.',
    note: 'Wykres nie mówi, że za słupkami stoi pięć i trzy osoby. Jak dopisać n, pokaże ćwiczenie 28.',

    nearMisses: [
      { name: 'stopped at the table', expect: 'notAPlot', code: REPORT },
      { name: 'axes and no layer', expect: 'missing.geom_col',
        code: `${REPORT} |>\n  ggplot(aes(x = grupa, y = procent))` },
      // The one everybody types first: a pipe goes on, so why not between layers.
      { name: 'piped into the layer', expect: 'error',
        code: `${REPORT} |>\n  ggplot(aes(x = grupa, y = procent)) |>\n  geom_col()` },
      { name: 'counted the rows of the report', expect: 'counted',
        code: `${REPORT} |>\n  ggplot(aes(x = grupa)) +\n  geom_bar()` },
      { name: 'gave geom_bar() a y', expect: 'error',
        code: `${REPORT} |>\n  ggplot(aes(x = grupa, y = procent)) +\n  geom_bar()` },
      { name: 'drew the number of people', expect: 'wrongY',
        code: `${REPORT} |>\n  ggplot(aes(x = grupa, y = n)) +\n  geom_col()` },
      { name: 'swapped the axes', expect: 'error',
        code: `${REPORT} |>\n  ggplot(aes(x = procent, y = grupa)) +\n  geom_col()` },
    ],

    diagnose({ value, result }) {
      if (!value) return 'general';
      const missing = result?.reason === 'missing-call' ? `missing.${result.detail.name}` : null;
      if (!value.gg) return isDataFrame(value) ? 'notAPlot' : (missing || 'general');
      const b = buildPlot(value);
      if (!b.layers.length) return missing || 'missing.geom_col';
      if (b.layers[0].fname === 'geom_bar') return 'counted';
      if (missing) return missing;
      // The bars stand where they should; their heights are the people, not the percent.
      const tops = b.layers[0].marks.map((m) => m.ymax).sort((a, c) => a - c);
      if (tops.join() === '3,5') return 'wrongY';
      return 'general';
    },
  },
};

export default reporting;

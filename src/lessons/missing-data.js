/**
 * Lesson: missing data in a survey -- module 9, lecture 3 (D65).
 *
 * Every exercise of lecture 3 meets NA on its way; this one gathers the thread before
 * the report. A survey has two kinds of missing answer, and R knows only one: NA. The
 * other is a code, 99 for "nie wiem", which R takes for a rating of 99 until it is
 * told otherwise. `na_if()` tells it.
 *
 * Then three decisions a researcher makes about missing answers, each in a scene:
 * remove them (and only where they matter: `drop_na()` with no column takes away a
 * person for a missing age), name them (`replace_na()`, a row "brak danych" in the
 * report), and show a pair nobody belonged to (`complete()`, a zero instead of a
 * missing row).
 *
 * A battery folded long has its own missing answer (D74): an empty rating becomes a
 * whole row, which `n()` counts. `values_drop_na = TRUE` drops it while folding. The
 * battery exercise itself has no gaps, so the reason to fold is not buried under this.
 */

import { resultCheck } from './schema.js';
import { getNames, isNA, isDataFrame } from '../core/rvalue.js';

const SETUP = `# Ocena zajęć, dziesięć osób. 99 znaczy „nie wiem”
ankieta <- data.frame(
  id = 1:10,
  plec = c("K", "M", "K", "M", "K", "M", "K", "K", "M", "K"),
  miasto = c("Kraków", "Kraków", "Gdańsk", "Gdańsk", "Kraków",
             "Gdańsk", "Warszawa", "Warszawa", "Kraków", "Gdańsk"),
  wiek = c(23, 35, NA, 41, 29, 52, 31, 24, 38, 45),
  ocena = c(4, 99, 5, 3, NA, 4, 99, 5, 2, 4)
)`;

const RAW_MEAN = `ankieta |>
  summarise(srednia = mean(ocena, na.rm = TRUE))`;

const CLEAN_MEAN = `ankieta |>
  mutate(ocena = na_if(ocena, 99)) |>
  summarise(srednia = mean(ocena, na.rm = TRUE))`;

const DROP = `czyste <- ankieta |>
  mutate(ocena = na_if(ocena, 99))
czyste |> drop_na() |> nrow()
czyste |> drop_na(ocena) |> nrow()`;

// The battery of the pivot_longer() exercise, three people with two empty ratings.
const BATTERY = `bateria <- data.frame(id = 1:3,
                      sejm = c(2, NA, 1),
                      media = c(3, 2, NA))
bateria |>
  pivot_longer(sejm:media, names_to = "instytucja",
               values_to = "zaufanie",
               values_drop_na = TRUE)`;
const BATTERY_PICK = BATTERY.slice(BATTERY.indexOf('bateria |>'));

const NAMED = `ankieta |>
  mutate(ocena = na_if(ocena, 99),
         zadowolony = if_else(ocena >= 4,
                              "tak", "nie"),
         zadowolony = replace_na(zadowolony,
                                 "brak danych")) |>
  count(zadowolony)`;

const COMPLETED = `ankieta |>
  count(miasto, plec) |>
  complete(miasto, plec, fill = list(n = 0))`;

const SOLUTION = `ankieta |>
  mutate(ocena = na_if(ocena, 99)) |>
  drop_na(ocena) |>
  group_by(miasto) |>
  summarise(n = n(), procent = mean(ocena >= 4) * 100)`;

// For those who want more: look at who will be lost before losing them.
const EXTRA = `ankieta |>
  filter(is.na(ocena) | ocena == 99)`;

// The people a check of the data must find: no rating (5) and "nie wiem" (2, 7).
const LOST = [2, 5, 7];

/** The values of a column of the student's table, by name; [] when it is not there. */
const colOf = (value, name) => {
  const names = (getNames(value)?.values || []).map(String);
  const at = names.indexOf(name);
  return at < 0 ? [] : value.values[at].values;
};

/** The task for those who want more is about people, so it is checked by who is there. */
function extraCheck({ value }) {
  if (!value || !isDataFrame(value)) return { ok: false, reason: 'wrong-value' };
  const ids = colOf(value, 'id').map(Number).sort((a, b) => a - b);
  return ids.join() === LOST.join() && colOf(value, 'ocena').length ? { ok: true } : { ok: false, reason: 'wrong-value' };
}

export const missingData = {
  id: 'missing-data',
  module: 9,
  lecture: 3,
  requires: ['percentages', 'recoding', 'battery'],
  title: 'Braki danych: kody i NA',
  setup: SETUP,

  scenes: [
    {
      say: 'W ankiecie są dwa rodzaje braków: **NA** i kod **99**, „nie wiem”. R zna tylko NA.',
      picture: { kind: 'verb', question: 'Jak badani oceniają zajęcia, na skali od 1 do 5?', code: CLEAN_MEAN },
    },
    {
      say: '`na.rm` usuwa NA, ale 99 zostaje oceną. Średnia na skali 1–5 wychodzi **25**.',
      code: RAW_MEAN,
      pick: RAW_MEAN,
      tap: 'na.rm = TRUE',
    },
    {
      say: '`na_if(ocena, 99)` zamienia kod na **NA**. Teraz średnia ma sens: 3.86.',
      code: CLEAN_MEAN,
      pick: CLEAN_MEAN,
      tap: 'na_if(ocena, 99)',
    },
    {
      say: '`drop_na()` zabiera osobę bez **wieku**: 6 zamiast 7. `drop_na(ocena)` to `filter(!is.na(ocena))`.',
      code: DROP,
    },
    {
      say: 'W długiej tabeli pusta ocena to **cały wiersz**. `values_drop_na = TRUE` usuwa je: 4 z 6.',
      code: BATTERY,
      pick: BATTERY_PICK,
      tap: 'values_drop_na = TRUE',
    },
    {
      say: 'Brak można też **pokazać**: `replace_na()` daje mu nazwę i własny wiersz w raporcie.',
      code: NAMED,
      pick: NAMED,
      tap: 'replace_na(',
    },
    {
      say: 'Mężczyzn z Warszawy nie było. `complete()` dopisuje ich z **0**, jak `values_fill` w ćw. {ćw:crosstab}.',
      code: COMPLETED,
      pick: COMPLETED,
    },
  ],

  play: {
    say: 'Twoja kolej. Zanim usuniesz braki, zobacz, kogo stracisz: `filter(is.na(...))`.',
    code: 'ankieta |>\n  filter(is.na(wiek))',
    chips: [
      'ankieta |> mutate(ocena = na_if(ocena, 99)) |> filter(is.na(ocena))',
      'ankieta |> mutate(ocena = na_if(ocena, 99)) |> summarise(srednia = mean(ocena))',
      'ankieta |> mutate(ocena = na_if(ocena, 99)) |> drop_na(wiek, ocena) |> nrow()',
      'ankieta |> mutate(ocena = na_if(ocena, 99)) |> summarise(bez_wieku = sum(is.na(wiek)), bez_oceny = sum(is.na(ocena)))',
      'ankieta |> count(miasto, plec) |> complete(miasto, plec)',
    ],
  },

  task: {
    prompt: 'Dla każdego miasta **n** i **procent** zadowolonych (ocena 4–5). Kod 99 to „nie wiem”: zamień go na NA. Usuń tylko osoby bez oceny.',
    starter: 'ankieta |>\n  ',
    check: resultCheck({ expected: SOLUTION, compare: { tolerance: 0.02, ignoreRowOrder: true } }),
    solution: SOLUTION,
    hints: [
      'Najpierw kod: `mutate(ocena = na_if(ocena, 99))`. Potem `drop_na(ocena)`, tylko ta kolumna.',
      'Na końcu `group_by(miasto)` i `summarise(n = n(), procent = mean(ocena >= 4) * 100)`.',
    ],
    messages: {
      notATable: 'Wynikiem ma być tabela: miasto, `n` i procent.',
      noN: 'Brakuje kolumny `n`. Procent bez liczby osób niewiele mówi: `n = n()`.',
      naPercent: 'Procent jest NA, bo zostały osoby bez oceny. Usuń je: `drop_na(ocena)`.',
      code99: 'Kod 99 liczy się jak ocena, i to wysoka. Najpierw `mutate(ocena = na_if(ocena, 99))`.',
      droppedTooMuch: '`drop_na()` bez kolumn usunął też osobę bez wieku, a ona oceniła zajęcia. Wskaż kolumnę: `drop_na(ocena)`.',
      nCountsEmpty: 'Procent dobry, ale `n` liczy też osoby bez oceny. Usuń je przed `summarise()`: `drop_na(ocena)`.',
      emptyAsAnswer: 'Osoby bez oceny liczą się jak niezadowolone: `n` i procent liczą puste. Usuń je: `drop_na(ocena)`.',
      noGroup: 'Jest jeden wiersz dla wszystkich, a wynik ma być dla każdego miasta: `group_by(miasto)`.',
      longShape: 'Liczby są, ale miasto zajmuje kilka wierszy. Jeden wiersz na miasto da `summarise()` po `group_by(miasto)`.',
      order: 'Kolejność: najpierw `na_if()`, potem `drop_na(ocena)`. Inaczej 99 staje się NA już po usunięciu braków.',
      fraction: 'To ułamki, nie procenty: brakuje `* 100`.',
      noPercent: 'Jest `n`, brakuje procentu. Policz go w `summarise()`: `procent = mean(ocena >= 4) * 100`.',
      general: 'Jeszcze nie to. Kolejność: `na_if()`, `drop_na(ocena)`, `group_by(miasto)`, `summarise()`.',
    },
    success: 'Dobrze. Gdańsk 75% z czterech, Warszawa 100% z jednej.',
    note: 'Trzy osoby wypadły: jedna bez oceny i dwie „nie wiem”. W raporcie to też informacja.',

    nearMisses: [
      { name: 'kept the code 99', expect: 'code99',
        code: 'ankieta |> drop_na(ocena) |> group_by(miasto) |> summarise(n = n(), procent = mean(ocena >= 4) * 100)' },
      { name: 'dropped every row with any NA', expect: 'droppedTooMuch',
        code: 'ankieta |> mutate(ocena = na_if(ocena, 99)) |> drop_na() |> group_by(miasto) |> summarise(n = n(), procent = mean(ocena >= 4) * 100)' },
      { name: 'used na.rm instead of removing', expect: 'nCountsEmpty',
        code: 'ankieta |> mutate(ocena = na_if(ocena, 99)) |> group_by(miasto) |> summarise(n = n(), procent = mean(ocena >= 4, na.rm = TRUE) * 100)' },
      { name: 'removed nothing', expect: 'naPercent',
        code: 'ankieta |> mutate(ocena = na_if(ocena, 99)) |> group_by(miasto) |> summarise(n = n(), procent = mean(ocena >= 4) * 100)' },
      { name: 'counted the empty as dissatisfied', expect: 'emptyAsAnswer',
        code: 'ankieta |> mutate(ocena = na_if(ocena, 99)) |> group_by(miasto) |> summarise(n = n(), procent = mean(ocena %in% 4:5) * 100)' },
      { name: 'forgot the cities', expect: 'noGroup',
        code: 'ankieta |> mutate(ocena = na_if(ocena, 99)) |> drop_na(ocena) |> summarise(n = n(), procent = mean(ocena >= 4) * 100)' },
      { name: 'counted pairs instead', expect: 'longShape',
        code: 'ankieta |> mutate(ocena = na_if(ocena, 99)) |> drop_na(ocena) |> count(miasto, zadowolony = ocena >= 4)' },
      { name: 'removed the gaps before the codes became NA', expect: 'order',
        code: 'ankieta |> drop_na(ocena) |> mutate(ocena = na_if(ocena, 99)) |> group_by(miasto) |> summarise(n = n(), procent = mean(ocena >= 4) * 100)' },
      { name: 'gave the percent without n', expect: 'noN',
        code: 'ankieta |> mutate(ocena = na_if(ocena, 99)) |> drop_na(ocena) |> group_by(miasto) |> summarise(procent = mean(ocena >= 4) * 100)' },
      { name: 'left fractions', expect: 'fraction',
        code: 'ankieta |> mutate(ocena = na_if(ocena, 99)) |> drop_na(ocena) |> group_by(miasto) |> summarise(n = n(), procent = mean(ocena >= 4))' },
    ],

    diagnose({ value, code }) {
      if (!value || !isDataFrame(value)) return 'notATable';
      const n = colOf(value, 'n').map(Number);
      const procent = colOf(value, 'procent');
      const city = colOf(value, 'miasto');
      if (!city.length && n.length === 1) return 'noGroup';
      if (city.length > 3) return 'longShape';
      if (!n.length) return 'noN';
      if (!procent.length) return 'noPercent';
      // drop_na() before na_if(): the codes become NA after the gaps were removed (D66).
      const src = String(code || '');
      if (procent.some(isNA)) return src.indexOf('drop_na') !== -1 && src.indexOf('na_if') > src.indexOf('drop_na') ? 'order' : 'naPercent';
      const total = n.reduce((a, b) => a + b, 0);
      if (total === 9) return 'code99';
      if (total === 6) return 'droppedTooMuch';
      // Every row kept: the percent is right only when the empty were left out of it.
      if (total === 10) return Math.abs(Number(procent[city.indexOf('Kraków')]) - 50) < 0.5 ? 'nCountsEmpty' : 'emptyAsAnswer';
      if (procent.length && procent.every((p) => Number(p) <= 1)) return 'fraction';
      return 'general';
    },
  },

  extra: {
    prompt: 'Zanim cokolwiek usuniesz, pokaż osoby, które **wypadną**: bez oceny albo z kodem 99.',
    starter: 'ankieta |>\n  ',
    check: extraCheck,
    solution: EXTRA,
    hints: [
      'Dwa warunki połączone „lub”: `is.na(ocena) | ocena == 99`.',
      'Braku nie sprawdza `== NA`. Sprawdza go `is.na()`.',
    ],
    messages: {
      onlyNA: 'To tylko osoby bez oceny. Dopisz „nie wiem”: `| ocena == 99`.',
      only99: 'To tylko „nie wiem”. Osoby bez oceny znajdzie `is.na(ocena)`.',
      naCompare: 'Tabela jest pusta: `== NA` daje NA w każdym wierszu. Braki znajduje `is.na(ocena)`.',
      andNotOr: 'Tabela jest pusta. Przecinek w `filter()` znaczy „i”, a nikt nie jest naraz bez oceny i z 99. „Lub” to `|`.',
      inSet: '`ocena == c(NA, 99)` porównuje po kolei z NA, 99, NA… a nie z „NA albo 99”. Połącz dwa warunki: `is.na(ocena) | ocena == 99`.',
      general: 'Jeszcze nie to: `filter(is.na(ocena) | ocena == 99)`.',
    },
    success: 'Dobrze. Osoby 2, 5 i 7: jedna bez oceny, dwie „nie wiem”.',
    note: 'Zobacz, kogo tracisz, zanim go stracisz. Czasem braki nie są przypadkowe.',

    nearMisses: [
      { name: 'looked only for NA', expect: 'onlyNA', code: 'ankieta |> filter(is.na(ocena))' },
      { name: 'looked only for the code', expect: 'only99', code: 'ankieta |> filter(ocena == 99)' },
      { name: 'compared with NA', expect: 'naCompare', code: 'ankieta |> filter(ocena == NA)' },
      { name: 'joined the two with a comma', expect: 'andNotOr', code: 'ankieta |> filter(is.na(ocena), ocena == 99)' },
      { name: 'joined the two with &', expect: 'andNotOr', code: 'ankieta |> filter(is.na(ocena) & ocena == 99)' },
      { name: 'compared with two values at once', expect: 'inSet', code: 'ankieta |> filter(ocena == c(NA, 99))' },
    ],

    diagnose({ value, code }) {
      if (!value || !isDataFrame(value)) return 'general';
      const src = String(code || '');
      if (/==\s*c\s*\(/.test(src)) return 'inSet';
      const ids = colOf(value, 'id').map(Number).sort((a, b) => a - b).join();
      if (ids === '5') return 'onlyNA';
      if (ids === '2,7') return 'only99';
      if (ids === '') return /==\s*NA\b/.test(src) ? 'naCompare' : 'andNotOr';
      return 'general';
    },
  },
};

export default missingData;

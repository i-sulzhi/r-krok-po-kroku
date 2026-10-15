/**
 * Lesson: if_else() and case_when() -- module 9, lecture 3 "Szybkie analizy" (D34).
 *
 * A survey holds the age; the report needs age groups. Recoding is `mutate()` with
 * a rule inside, so nothing here is a new verb: `if_else()` is one condition and two
 * values, `case_when()` is a list of conditions read from the top.
 *
 * Two things go wrong without a message. A missing age makes every condition NA, so
 * the person lands in no group at all. And `.default`, which reads like "the oldest",
 * also takes that person: someone who gave no age is counted as 50+.
 */

import { resultCheck } from './schema.js';
import { getNames, isNA, isDataFrame } from '../core/rvalue.js';

const SETUP = `# Ankieta, osiem osób. Osoba 6 nie podała wieku
ankieta <- data.frame(
  id = 1:8,
  plec = c("K", "M", "K", "M", "K", "M", "K", "M"),
  wiek = c(23, 34, 45, 29, 67, NA, 51, 38),
  ocena = c(4, 5, 3, 5, 2, 4, 1, 3)
)`;

const ORIGINAL = ['id', 'plec', 'wiek', 'ocena'];
const WANTED = { 1: 'niska', 2: 'niska', 3: 'średnia', 4: 'wysoka', 5: 'wysoka' };

const TWO = `ankieta |>
  mutate(grupa = if_else(wiek >= 40, "40+", "do 39"))`;

const THREE = `ankieta |>
  mutate(grupa = case_when(
    wiek < 30 ~ "18-29",
    wiek < 50 ~ "30-49",
    wiek >= 50 ~ "50+"
  ))`;

const IF_ELSE = 'if_else(wiek >= 40, "40+", "do 39")';

// Why the function exists (D50, simplified in D52): plain `if` decides once, for
// one person. The next scene asks the same question with the same words for every
// row. One row against eight is the whole point; no error is needed to make it.
// The one person's age gets its own name: `wiek` alone is the column in the scenes
// that follow, and a student would read `if_else(wiek >= 40, ...)` as using 45.
const ONE = 'if (wiek_osoby >= 40) "40+" else "do 39"';
const WHY = `wiek_osoby <- ankieta$wiek[3]\n${ONE}`;

/** The case_when() call inside a scene's code: what the scene opens on. */
const inner = (code) => code.slice(code.indexOf('case_when('), code.lastIndexOf(')'));

const SWAPPED = `ankieta |>
  mutate(grupa = case_when(
    wiek < 50 ~ "30-49",
    wiek < 30 ~ "18-29",
    wiek >= 50 ~ "50+"
  ))`;

// The trap and its repair side by side (D59): the same order of lines, but the middle
// group closed on both sides, so `wiek < 50` no longer reaches the young.
const CLOSED = `ankieta |>
  mutate(grupa = case_when(
    wiek >= 30 & wiek < 50 ~ "30-49",
    wiek < 30 ~ "18-29",
    wiek >= 50 ~ "50+"
  ))`;

const SWAP_AND_FIX = `# Źle: szeroki warunek stoi pierwszy
${SWAPPED}
# Dobrze: przedział z obu stron
${CLOSED}`;

const WITH_DEFAULT = `ankieta |>
  mutate(grupa = case_when(
    wiek < 30 ~ "18-29",
    wiek < 50 ~ "30-49",
    .default = "50+"
  ))`;

const SOLUTION = `ankieta |>
  mutate(zadowolenie = case_when(
    ocena <= 2 ~ "niska",
    ocena == 3 ~ "średnia",
    ocena >= 4 ~ "wysoka"
  ))`;

// For those who want more (D64): the missing age gets a group of its own, named
// first, so neither NA nor .default can hide the person.
const EXTRA = `ankieta |>
  mutate(grupa = case_when(
    is.na(wiek) ~ "brak danych",
    wiek < 30 ~ "do 29",
    wiek < 50 ~ "30-49",
    .default = "50+"
  ))`;

export const recoding = {
  id: 'recoding',
  module: 9,
  lecture: 3,
  requires: ['mutating'],
  title: 'if_else() i case_when()',
  setup: SETUP,

  scenes: [
    {
      say: 'W ankiecie jest **wiek**, a pytanie jest o grupy. Grupy trzeba zrobić.',
      picture: { kind: 'verb', question: 'Ile osób ma 40 lat lub więcej?', code: TWO },
    },
    {
      say: '`if (warunek) A else B` wybiera A albo B dla **jednej osoby**. Osoba 3 ma 45 lat, więc „40+”.',
      code: WHY,
      pick: ONE,
    },
    {
      say: '`if_else()` to ten sam `if` dla **każdego wiersza**: warunek, wartość dla TRUE, dla FALSE.',
      code: TWO,
      pick: IF_ELSE,
      tap: 'wiek >= 40',
    },
    {
      say: 'Odpowiedź: **3 osoby** mają 40+. Osoba 6 nie podała wieku, więc jej grupa to NA.',
      code: `ankieta |>\n  mutate(\n    grupa = ${IF_ELSE}\n  ) |>\n  count(grupa)`,
    },
    {
      say: 'Więcej grup: `case_when()`. Przed `~` **warunek**, po `~` **wartość**, jak `if` / `else if`.',
      code: THREE,
      pick: inner(THREE),
      tap: 'wiek < 30',
    },
    {
      say: 'Pierwszy TRUE wygrywa: `wiek < 50` zabiera młodych. Niżej naprawa: przedział **z obu stron**.',
      code: SWAP_AND_FIX,
      pick: inner(SWAPPED),
      tap: 'wiek >= 30 & wiek < 50',
    },
    {
      say: '`.default` bierze resztę. Uwaga: osoba 6, bez wieku, trafia do **„50+”**.',
      code: WITH_DEFAULT,
      pick: inner(WITH_DEFAULT),
    },
  ],

  // Habits that keep the first-TRUE rule from biting (D56): the narrowest condition
  // first, or ranges closed on both sides so the order stops mattering, missing
  // answers named first, and count() at the end to see every group.
  play: {
    say: 'Dobre nawyki: najwęższy warunek pierwszy, przedział z obu stron, braki osobno, na końcu `count()`.',
    code: 'ankieta |>\n  mutate(opinia = if_else(ocena >= 4, "dobra", "zła"))',
    chips: [
      // The same three groups without case_when(): it works, and reads inside out.
      'ankieta |> mutate(grupa = if_else(wiek < 30, "18-29", if_else(wiek < 50, "30-49", "50+")))',
      // Both ends written: the middle group listed first and nothing goes wrong.
      'ankieta |> mutate(grupa = case_when(wiek >= 30 & wiek < 50 ~ "30-49", wiek < 30 ~ "18-29", wiek >= 50 ~ "50+"))',
      'ankieta |> mutate(grupa = case_when(is.na(wiek) ~ "brak danych", wiek < 40 ~ "do 39", wiek >= 40 ~ "40+"))',
      'ankieta |> mutate(grupa = if_else(wiek >= 40, "40+", "do 39", missing = "brak danych"))',
      'ankieta |> mutate(grupa = case_when(wiek < 30 ~ "18-29", wiek < 50 ~ "30-49", wiek >= 50 ~ "50+")) |> count(grupa)',
      'ankieta |> mutate(senior = if_else(wiek >= 60, 1, 0))',
    ],
  },

  task: {
    prompt: 'Dodaj kolumnę **zadowolenie**: oceny 1–2 to „niska”, 3 to „średnia”, 4–5 to „wysoka”.',
    starter: 'ankieta |>\n  mutate(zadowolenie = case_when(\n    \n  ))',
    check: resultCheck({ expected: SOLUTION, requireCalls: ['mutate'] }),
    solution: SOLUTION,
    hints: [
      'Każda linia w `case_when()` to warunek, znak `~` i wartość w cudzysłowie. Linie dzieli przecinek.',
      'Pierwsza linia: `ocena <= 2 ~ "niska"`. Potem `ocena == 3` i `ocena >= 4`.',
    ],
    messages: {
      'missing.mutate': 'Nowa kolumna powstaje w `mutate()`. `case_when()` stoi w środku, po znaku `=`.',
      notATable: 'Wynikiem ma być cała tabela z nową kolumną.',
      noNewColumn: 'Nie ma nowej kolumny. Po lewej od `=` wpisz nazwę `zadowolenie`.',
      notText: 'Poziomy mają być tekstem: „niska”, „średnia”, „wysoka”. Wpisz je w cudzysłowie.',
      hasNA: 'Część osób ma NA, bo żaden warunek ich nie objął. Warunki muszą pokryć oceny od 1 do 5.',
      order: 'Poziomy się mieszają. R bierze pierwszy prawdziwy warunek, więc sprawdź kolejność i granice.',
      twoLevels: 'Wyszły dwa poziomy, a mają być trzy. Szerszy warunek, który stoi wyżej, zabiera węższy.',
      wrongName: 'Poziomy dobre, ale kolumna ma się nazywać `zadowolenie`.',
      spelling: 'Jedna etykieta różni się od polecenia. Pisz dokładnie: „niska”, „średnia”, „wysoka”, z polskimi literami.',
      counted: 'Kolumna jest dobra, ale tabela jest już policzona. Zadanie chce całej ankiety z nową kolumną: bez `count()`.',
      inSet: '`ocena == 1:2` porównuje po kolei z 1, 2, 1, 2… a nie z „1 albo 2”. Kilka wartości sprawdza `%in%`: `ocena %in% 1:2`.',
      general: 'Jeszcze nie to. Trzy linie: `ocena <= 2`, `ocena == 3`, `ocena >= 4`, każda z `~` i wartością.',
    },
    success: 'Dobrze. Trzy poziomy, nikt nie został bez grupy.',
    note: 'Osoby na każdym poziomie policzy `count(zadowolenie)`. Jak z takich liczb zrobić procenty, pokaże następne ćwiczenie.',

    nearMisses: [
      { name: 'put the wide condition first', expect: 'twoLevels',
        code: 'ankieta |> mutate(zadowolenie = case_when(ocena <= 3 ~ "średnia", ocena <= 2 ~ "niska", ocena >= 4 ~ "wysoka"))' },
      { name: 'set the borders one answer off', expect: 'order',
        code: 'ankieta |> mutate(zadowolenie = case_when(ocena >= 4 ~ "wysoka", ocena >= 2 ~ "średnia", ocena >= 1 ~ "niska"))' },
      { name: 'left the middle answer uncovered', expect: 'hasNA',
        code: 'ankieta |> mutate(zadowolenie = case_when(ocena < 3 ~ "niska", ocena > 3 ~ "wysoka"))' },
      { name: 'made two levels with if_else', expect: 'twoLevels',
        code: 'ankieta |> mutate(zadowolenie = if_else(ocena >= 4, "wysoka", "niska"))' },
      { name: 'used numbers instead of labels', expect: 'notText',
        code: 'ankieta |> mutate(zadowolenie = case_when(ocena <= 2 ~ 1, ocena == 3 ~ 2, ocena >= 4 ~ 3))' },
      { name: 'named the new column differently', expect: 'wrongName',
        code: 'ankieta |> mutate(poziom = case_when(ocena <= 2 ~ "niska", ocena == 3 ~ "średnia", ocena >= 4 ~ "wysoka"))' },
      // A label typed without the Polish letter once got "the levels are mixed up".
      { name: 'wrote srednia without the accent', expect: 'spelling',
        code: 'ankieta |> mutate(zadowolenie = case_when(ocena <= 2 ~ "niska", ocena == 3 ~ "srednia", ocena >= 4 ~ "wysoka"))' },
      { name: 'compared with a range instead of %in%', expect: 'inSet',
        code: 'ankieta |> mutate(zadowolenie = case_when(ocena == 1:2 ~ "niska", ocena == 3 ~ "średnia", ocena == 4:5 ~ "wysoka"))' },
      { name: 'recoded right and then counted', expect: 'counted',
        code: 'ankieta |> mutate(zadowolenie = case_when(ocena <= 2 ~ "niska", ocena == 3 ~ "średnia", ocena >= 4 ~ "wysoka")) |> count(zadowolenie)' },
      { name: 'overwrote the answers', expect: 'noNewColumn',
        code: 'ankieta |> mutate(ocena = case_when(ocena <= 2 ~ "niska", ocena == 3 ~ "średnia", ocena >= 4 ~ "wysoka"))' },
    ],

    diagnose({ value, code, result }) {
      if (!value) return 'general';
      if (!isDataFrame(value)) {
        return result?.reason === 'missing-call' ? `missing.${result.detail.name}` : 'notATable';
      }
      const names = (getNames(value)?.values || []).map(String);
      const added = names.filter((n) => !ORIGINAL.includes(n));
      if (!added.length) return 'noNewColumn';
      const col = value.values[names.indexOf(added[0])];
      const answers = value.values[names.indexOf('ocena')]?.values || [];
      if (col.type !== 'character') return 'notText';
      // `== 1:2` or `== c(1, 2)` recycles instead of meaning "1 or 2": name that first,
      // since its symptom (NA, mixed levels) points elsewhere.
      if (/==\s*(\d+\s*:\s*\d+|c\s*\()/.test(code || '')) return 'inSet';
      if (col.values.some(isNA)) return 'hasNA';
      // Recoded right and then counted: the answers are gone, so nothing to compare with.
      if (!names.includes('ocena') || col.values.length !== answers.length) return 'counted';
      const labels = Object.values(WANTED);
      if (col.values.some((v) => !labels.includes(v))) return 'spelling';
      const right = col.values.every((v, i) => v === WANTED[answers[i]]);
      if (!right) return new Set(col.values).size < 3 ? 'twoLevels' : 'order';
      if (added[0] !== 'zadowolenie') return 'wrongName';
      if (result?.reason === 'missing-call') return `missing.${result.detail.name}`;
      return 'general';
    },
  },

  extra: {
    prompt: 'Grupy wieku: `"do 29"`, `"30-49"`, `"50+"` i osobno **`"brak danych"`** dla osoby bez wieku (kolumna **grupa**).',
    starter: 'ankieta |>\n  mutate(grupa = case_when(\n    \n  ))',
    check: resultCheck({ expected: EXTRA, requireCalls: ['mutate'] }),
    solution: EXTRA,
    hints: [
      'Braki nazwij najpierw: `is.na(wiek) ~ "brak danych"` jako pierwsza linia.',
      'Potem przedziały od najmłodszych: `wiek < 30`, `wiek < 50`, a reszta to `.default = "50+"`.',
    ],
    messages: {
      'missing.mutate': 'Nowa kolumna powstaje w `mutate()`. `case_when()` stoi w środku, po `grupa =`.',
      naLeft: 'Osoba 6 ma grupę NA. Daj jej własną: `is.na(wiek) ~ "brak danych"`.',
      swept: 'Osoba 6, bez wieku, trafiła do „50+” przez `.default`. Najpierw `is.na(wiek) ~ "brak danych"`.',
      order: 'Grupy się mieszają. Pierwszy TRUE wygrywa: najwęższy warunek stawiaj wyżej.',
      naCompare: '`wiek == NA` nigdy nie daje TRUE, więc osoba 6 poszła dalej. Brak sprawdza `is.na(wiek)`.',
      labels: 'Grupy mają się nazywać dokładnie: `"do 29"`, `"30-49"`, `"50+"` i `"brak danych"`.',
      wrongName: 'Nowa kolumna ma się nazywać `grupa`: `mutate(grupa = case_when(...))`. Wieku nie nadpisuj.',
      general: 'Jeszcze nie to. Cztery linie: braki, `wiek < 30`, `wiek < 50`, `.default`.',
    },
    success: 'Dobrze. Każda osoba ma grupę, a brak wieku widać w raporcie.',
    note: '„Brak danych” to też odpowiedź w raporcie: mówi, o kim nic nie wiemy.',

    nearMisses: [
      { name: 'left the missing age as NA', expect: 'naLeft',
        code: 'ankieta |> mutate(grupa = case_when(wiek < 30 ~ "do 29", wiek < 50 ~ "30-49", wiek >= 50 ~ "50+"))' },
      { name: 'let .default take the missing age', expect: 'swept',
        code: 'ankieta |> mutate(grupa = case_when(wiek < 30 ~ "do 29", wiek < 50 ~ "30-49", .default = "50+"))' },
      { name: 'put the wide condition first', expect: 'order',
        code: 'ankieta |> mutate(grupa = case_when(is.na(wiek) ~ "brak danych", wiek < 50 ~ "30-49", wiek < 30 ~ "do 29", .default = "50+"))' },
      { name: 'checked the missing age with == NA', expect: 'naCompare',
        code: 'ankieta |> mutate(grupa = case_when(wiek == NA ~ "brak danych", wiek < 30 ~ "do 29", wiek < 50 ~ "30-49", .default = "50+"))' },
      { name: 'kept the labels from the scenes', expect: 'labels',
        code: 'ankieta |> mutate(grupa = case_when(is.na(wiek) ~ "brak danych", wiek < 30 ~ "18-29", wiek < 50 ~ "30-49", .default = "50+"))' },
      { name: 'overwrote the age', expect: 'wrongName',
        code: 'ankieta |> mutate(wiek = case_when(is.na(wiek) ~ "brak danych", wiek < 30 ~ "do 29", wiek < 50 ~ "30-49", .default = "50+"))' },
    ],

    diagnose({ value, code, result }) {
      if (!value || !isDataFrame(value)) return 'general';
      if (result?.reason === 'missing-call') return `missing.${result.detail.name}`;
      const names = (getNames(value)?.values || []).map(String);
      const grupa = value.values[names.indexOf('grupa')]?.values;
      if (!grupa) return 'wrongName';
      if (/==\s*NA\b/.test(code || '')) return 'naCompare';
      if (isNA(grupa[5])) return 'naLeft';
      if (grupa[5] === '50+') return 'swept';
      const labels = ['do 29', '30-49', '50+', 'brak danych'];
      if (grupa.some((g) => !isNA(g) && !labels.includes(g))) return 'labels';
      if (grupa[5] === 'brak danych') return 'order';
      return 'general';
    },
  },
};

export default recoding;

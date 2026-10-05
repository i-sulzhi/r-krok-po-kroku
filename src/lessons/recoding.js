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

/** The case_when() call inside a scene's code: what the scene opens on. */
const inner = (code) => code.slice(code.indexOf('case_when('), code.lastIndexOf(')'));

const SWAPPED = `ankieta |>
  mutate(grupa = case_when(
    wiek < 50 ~ "30-49",
    wiek < 30 ~ "18-29",
    wiek >= 50 ~ "50+"
  ))`;

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
      say: '`if_else()` ma trzy części: **warunek**, wartość dla TRUE, wartość dla FALSE.',
      code: TWO,
      pick: IF_ELSE,
      tap: 'wiek >= 40',
    },
    {
      say: 'Osoba 6 nie podała wieku. Warunek jest NA, więc jej **grupa też jest NA**.',
      code: `ankieta |>\n  mutate(\n    grupa = ${IF_ELSE}\n  ) |>\n  count(grupa)`,
    },
    {
      say: 'Trzy grupy: `case_when()`. Po lewej od `~` warunek, po prawej **wartość**.',
      code: THREE,
      pick: inner(THREE),
      tap: 'wiek < 30',
    },
    {
      say: 'R bierze **pierwszy** prawdziwy warunek. Tu `wiek < 50` zabiera też młodych.',
      code: SWAPPED,
      pick: inner(SWAPPED),
    },
    {
      say: '`.default` bierze resztę. Uwaga: osoba 6, bez wieku, trafia do **„50+”**.',
      code: WITH_DEFAULT,
      pick: inner(WITH_DEFAULT),
    },
  ],

  play: {
    code: 'ankieta |>\n  mutate(opinia = if_else(ocena >= 4, "dobra", "zła"))',
    chips: [
      'ankieta |> mutate(grupa = case_when(is.na(wiek) ~ "brak danych", wiek < 40 ~ "do 39", wiek >= 40 ~ "40+"))',
      'ankieta |> mutate(grupa = if_else(wiek >= 40, "40+", "do 39", missing = "brak danych"))',
      'ankieta |> mutate(grupa = if_else(wiek >= 40, "40+", "do 39")) |> count(grupa)',
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
      general: 'Jeszcze nie to. Trzy linie: `ocena <= 2`, `ocena == 3`, `ocena >= 4`, każda z `~` i wartością.',
    },
    success: 'Dobrze. Trzy poziomy, nikt nie został bez grupy.',
    note: 'Teraz `count(zadowolenie)` policzy osoby na każdym poziomie. To następne ćwiczenie.',

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
      { name: 'overwrote the answers', expect: 'noNewColumn',
        code: 'ankieta |> mutate(ocena = case_when(ocena <= 2 ~ "niska", ocena == 3 ~ "średnia", ocena >= 4 ~ "wysoka"))' },
    ],

    diagnose({ value, result }) {
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
      if (col.values.some(isNA)) return 'hasNA';
      const right = col.values.every((v, i) => v === WANTED[answers[i]]);
      if (!right) return new Set(col.values).size < 3 ? 'twoLevels' : 'order';
      if (added[0] !== 'zadowolenie') return 'wrongName';
      if (result?.reason === 'missing-call') return `missing.${result.detail.name}`;
      return 'general';
    },
  },
};

export default recoding;

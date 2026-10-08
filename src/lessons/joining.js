/**
 * Lesson: two tables with left_join() -- module 9, lecture 3 (D40).
 *
 * The question is about regions, and the survey holds only the city. The region
 * lives in another table, one row per city, and `left_join()` brings it over: every
 * person gets the columns of their own city. Nothing is computed, so a join looks
 * harmless. It is the one verb on the path that changes how many rows there are
 * without being asked to.
 *
 * Three things happen in silence. A city missing from the second table leaves the
 * person with NA, which is honest and stays visible in every later count. The same
 * person vanishes in `inner_join()`, and the table is one row shorter with no word
 * about it. And a city listed twice in the second table gives each of its people
 * twice: six respondents become eight, and every mean after that is wrong.
 *
 * So the habit taught here is one line long: after a join, count the rows.
 */

import { resultCheck } from './schema.js';
import { getNames, isNA, isDataFrame } from '../core/rvalue.js';

const SETUP = `# Ankieta: sześć osób. Miasta opisuje osobna tabela
ankieta <- data.frame(
  id = 1:6,
  miasto = c("Kraków", "Gdańsk", "Kraków", "Lublin",
             "Gdańsk", "Radom"),
  ocena = c(4, 5, 3, 4, 4, 2)
)
miasta <- data.frame(
  miasto = c("Kraków", "Gdańsk", "Lublin", "Poznań"),
  region = c("małopolskie", "pomorskie", "lubelskie",
             "wielkopolskie")
)
uczelnie <- data.frame(
  miasto = c("Kraków", "Kraków", "Gdańsk", "Lublin"),
  uczelnia = c("UJ", "AGH", "UG", "UMCS")
)`;

const JOINED = `ankieta |>
  left_join(miasta, by = "miasto")`;

const NO_PARTNER = `${JOINED} |>
  filter(is.na(region))`;

const ANSWER = `${JOINED} |>
  group_by(region) |>
  summarise(srednia = mean(ocena), n = n())`;

const INNER = `ankieta |>
  inner_join(miasta, by = "miasto")`;

const DOUBLED = `ankieta |>
  left_join(uczelnie, by = "miasto")`;

const SOLUTION = `${JOINED} |>
  count(region)`;

const PEOPLE = 6;

export const joining = {
  id: 'joining',
  module: 9,
  lecture: 3,
  requires: ['counting', 'grouping'],
  title: 'Dwie tabele: left_join()',
  setup: SETUP,

  scenes: [
    {
      say: 'Pytanie jest o **regiony**, a ankieta zna tylko miasto. Region ma inna tabela.',
      code: 'miasta',
      pick: 'miasta',
    },
    {
      say: 'Każda osoba dostaje region **swojego miasta**. Tabele łączy kolumna `miasto`.',
      code: JOINED,
      pick: JOINED,
    },
    {
      say: 'Radomia nie ma w `miasta`. Osoba 6 **zostaje**, a jej region to NA.',
      code: NO_PARTNER,
      pick: NO_PARTNER,
    },
    {
      say: 'Średnie w regionach. Wiersz NA **pokazuje**, że o jednej osobie nic nie wiemy.',
      code: ANSWER,
      pick: ANSWER,
    },
    {
      say: '`inner_join()` zostawia tylko pary. Osoba 6 **znika** bez słowa. Jest 5 wierszy.',
      code: INNER,
      pick: INNER,
    },
    {
      say: 'Kraków ma tu **dwie** uczelnie, więc każda osoba stamtąd jest dwa razy. Jest 8.',
      code: DOUBLED,
      pick: DOUBLED,
    },
  ],

  play: {
    code: 'ankieta |>\n  anti_join(miasta, by = "miasto")',
    chips: [
      'miasta |> anti_join(ankieta, by = "miasto")',
      'ankieta |> full_join(miasta, by = "miasto")',
      'ankieta |> left_join(uczelnie, by = "miasto") |> count(id)',
      'ankieta |> left_join(miasta, by = "miasto") |> count(region) |> mutate(procent = n / sum(n) * 100)',
    ],
  },

  task: {
    prompt: 'Policz, **ile osób** odpowiedziało w każdym regionie. Kolumny: `region`, `n`.',
    starter: 'ankieta |>\n  ',
    check: resultCheck({ expected: SOLUTION, requireCalls: ['left_join'], compare: { ignoreRowOrder: true } }),
    solution: SOLUTION,
    hints: [
      'Region jest w tabeli `miasta`. Dołącz ją: `left_join(miasta, by = "miasto")`.',
      'Gdy region jest już przy każdej osobie, liczy `count(region)`.',
    ],
    messages: {
      'missing.left_join': 'Region jest w tabeli `miasta`. Dołącz ją: `left_join(miasta, by = "miasto")`.',
      notATable: 'Wynikiem ma być tabela: region i liczba osób.',
      noRegion: 'Policzone jest coś innego niż regiony. Po `left_join()` idzie `count(region)`.',
      joinedOnly: 'Regiony są już przy osobach. Teraz policz: `count(region)`.',
      lostPeople: 'Razem wychodzi mniej niż 6 osób. `inner_join()` gubi osobę z Radomia, `left_join()` nie.',
      extraRegion: 'Jest wielkopolskie, a z Poznania nikt nie odpowiadał. Lewą tabelą ma być `ankieta`.',
      multiplied: 'Razem wychodzi więcej niż 6 osób: wiersze się pomnożyły. Dołącz tylko `miasta`.',
      wrongName: 'Liczby dobre, ale kolumna z liczbą osób ma się nazywać `n`.',
      general: 'Jeszcze nie to. Dwa kroki: `left_join(miasta, by = "miasto")`, potem `count(region)`.',
    },
    success: 'Dobrze. Cztery wiersze, razem sześć osób.',
    note: 'Wiersz NA to osoba z Radomia. W raporcie to „brak danych o regionie”, nie zero.',

    nearMisses: [
      { name: 'kept only the pairs', expect: 'lostPeople',
        code: 'ankieta |> inner_join(miasta, by = "miasto") |> count(region)' },
      { name: 'put the city table on the left', expect: 'extraRegion',
        code: 'miasta |> left_join(ankieta, by = "miasto") |> count(region)' },
      { name: 'kept every row of both tables', expect: 'extraRegion',
        code: 'ankieta |> full_join(miasta, by = "miasto") |> count(region)' },
      { name: 'stopped at the joined table', expect: 'joinedOnly',
        code: JOINED },
      { name: 'counted cities without joining', expect: 'missing.left_join',
        code: 'ankieta |> count(miasto)' },
      { name: 'joined, then counted cities', expect: 'noRegion',
        code: `${JOINED} |> count(miasto)` },
      { name: 'joined the universities as well', expect: 'multiplied',
        code: `${JOINED} |> left_join(uczelnie, by = "miasto") |> count(region)` },
      { name: 'named the count differently', expect: 'wrongName',
        code: `${JOINED} |> group_by(region) |> summarise(ile = n())` },
      { name: 'wrote the key without quotes', expect: 'error',
        code: 'ankieta |> left_join(miasta, by = miasto) |> count(region)' },
    ],

    diagnose({ value, result }) {
      if (!value) return 'general';
      const missing = result?.reason === 'missing-call' ? `missing.${result.detail.name}` : null;
      if (!isDataFrame(value)) return missing || 'notATable';
      const names = (getNames(value)?.values || []).map(String);
      if (!names.includes('region')) return missing || 'noRegion';
      if (names.includes('id') || names.includes('ocena')) return 'joinedOnly';
      const column = (nm) => value.values[names.indexOf(nm)].values;
      if (column('region').includes('wielkopolskie')) return 'extraRegion';
      const extra = names.filter((nm) => nm !== 'region');
      if (extra.length !== 1) return missing || 'general';
      const counts = column(extra[0]);
      if (counts.some((x) => isNA(x) || typeof x !== 'number')) return missing || 'general';
      const total = counts.reduce((a, b) => a + b, 0);
      if (total > PEOPLE) return 'multiplied';
      if (total < PEOPLE) return 'lostPeople';
      if (extra[0] !== 'n') return 'wrongName';
      return missing || 'general';
    },
  },
};

export default joining;

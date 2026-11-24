/**
 * Lesson: text in a table -- module 8, lecture 7 (D138).
 *
 * The last stringr exercise before session 7. One idea: stringr works inside dplyr, one
 * row at a time, so a column of text can be counted, filtered and summarised by group.
 *
 * The silent trap: a raw count mostly measures length. In these eleven sentences "polsk"
 * comes 3 times in the KRS debate and 2 in the energy debate, but per 100 words energy
 * leads (7.1 against 6.0). The whole day says the same: 129 against 55 hits, 6.1 against
 * 7.7 per 1000 words, because the KRS debate is almost three times as long.
 *
 * The sentences are verbatim from the Sejm transcript of 2023-12-20, and `caly` holds
 * the real totals of that day (the speakers' own words, D143; lower-cased, brackets removed, `\\bpolsk`). Numbers
 * checked with stringr 1.6.0 and dplyr 1.2.0.
 */

import { isAtomic, isDataFrame, rLength, getNames } from '../core/rvalue.js';

const SETUP = `# Zdania z dwóch debat Sejmu, 20 grudnia 2023
mowy <- data.frame(
  debata = c(rep("KRS", 7), rep("Energia", 4)),
  tekst = c(
    "Dzisiaj polski Sejm rozpocznie odbudowę praworządności.",
    "Zajmijcie się Polską, a nie pustosłowiem.",
    "A jakim państwem byłaby Polska, gdyby sędziowie sami siebie wybierali?",
    "Zaproponujcie kompleksowe reformy w formie uchwały.",
    "Dla nas ta uchwała jest początkiem procesu.",
    "Nie będzie pan mówił sędziom, jak mają orzekać.",
    "To tak jak w sprawie telewizji publicznej.",
    "Ale dzisiaj, aby ratować polskie górnictwo, musimy tę ustawę podjąć.",
    "Górnictwo dziś wymaga wsparcia, wiemy o tym wszystkim.",
    "Notyfikacja rzeczywiście jest problemem.",
    "Do takiej katastrofy doprowadziliście polskie górnictwo."
  )
)
# Te same dwie debaty w całości: trafienia „polsk” i liczba słów
caly <- data.frame(
  debata = c("KRS", "Energia"),
  hit = c(129, 55),
  slowa = c(21180, 7107)
)`;

const HIT = String.raw`str_count(tekst, "\\bpolsk")`;
const WORD = String.raw`str_count(tekst, "\\S+")`;
const FILTER = String.raw`filter(str_detect(str_to_lower(tekst), "\\bpolsk"))`;
const ROWS = `mowy |>
  mutate(tekst = str_to_lower(tekst),
         hit = ${HIT})`;
const ROWS2 = `mowy |>
  mutate(tekst = str_to_lower(tekst),
         hit = ${HIT},
         slowa = ${WORD})`;
const BY = `${ROWS2} |>\n  group_by(debata)`;
const RATE = 'summarise(na_100 = 100 * sum(hit) / sum(slowa))';
const SOLUTION = `${BY} |>\n  ${RATE}`;
const SUM_HIT = `${ROWS} |>\n  group_by(debata) |>\n  summarise(hit = sum(hit))`;
const SUM_BOTH = `${BY} |>\n  summarise(hit = sum(hit), slowa = sum(slowa))`;
const DAY = 'caly |>\n  mutate(na_1000 = 1000 * hit / slowa)';

/** The numeric columns of a table, each as {debate: value}. */
function byDebate(df) {
  const names = (getNames(df)?.values || []).map(String);
  const at = names.indexOf('debata');
  if (at < 0) return [];
  const keys = df.values[at].values.map(String);
  return df.values
    .filter((col, i) => i !== at && isAtomic(col) && col.values.every((x) => typeof x === 'number'))
    .map((col) => Object.fromEntries(keys.map((k, i) => [k, col.values[i]])));
}

const near = (a, b, tol = 0.06) => Number.isFinite(a) && Math.abs(a - b) <= tol;
const hasPair = (df, krs, energia) => byDebate(df).some((c) => near(c.KRS, krs) && near(c.Energia, energia));
const twoRows = (df) => isDataFrame(df) && df.values.length > 0 && rLength(df.values[0]) === 2;

/** One row per debate and a column with 6.0 for KRS and 7.14 for energy. */
function check({ value, code }) {
  if (!/str_count\s*\(/.test(String(code || ''))) return { ok: false, reason: 'typed' };
  if (!twoRows(value)) return { ok: false, reason: 'wrong-value' };
  return hasPair(value, 6, 100 * 2 / 28) ? { ok: true } : { ok: false, reason: 'wrong-value' };
}
check.compare = {};

export const strTable = {
  id: 'str-table',
  module: 8,
  lecture: 7,
  requires: ['str-clean'],
  title: 'Tekst w tabeli',
  setup: SETUP,

  scenes: [
    {
      say: 'Zdania z dwóch debat Sejmu. W której częściej mówi się o **Polsce**?',
      code: 'mowy',
      pick: 'mowy',
    },
    {
      say: 'W `mutate()` wzorzec działa w każdym wierszu. Nowa kolumna `hit` to liczba trafień.',
      code: ROWS,
      pick: HIT,
    },
    {
      say: '`filter()` ze `str_detect()` zostawia tylko zdania z trafieniem. Jest ich **5**.',
      code: `mowy |>\n  ${FILTER}`,
      pick: 'str_detect(str_to_lower(tekst), "\\\\bpolsk")',
    },
    {
      say: 'Sumujemy po debatach. KRS ma **3** trafienia, Energia **2**. Czyli KRS mówi o tym więcej?',
      code: SUM_HIT,
      pick: SUM_HIT,
    },
    {
      say: 'Ale KRS ma **50** słów, a Energia **28**. Dłuższy tekst ma więcej wszystkiego.',
      code: SUM_BOTH,
      pick: SUM_BOTH,
    },
    {
      say: 'Na 100 słów prowadzi **Energia**, 7.1 wobec 6.0. Sama liczba trafień wskazała źle.',
      code: SOLUTION,
      pick: SOLUTION,
    },
    {
      say: 'Cały dzień Sejmu tak samo. KRS **129** trafień, Energia 55, ale na 1000 słów 6.1 i **7.7**.',
      code: DAY,
      pick: DAY,
    },
  ],

  play: {
    say: 'Twoja kolej. Zmień wzorzec albo policz coś innego w tabeli.',
    code: `mowy |>\n  mutate(slowa = ${WORD})`,
    chips: [
      'mowy |> count(debata)',
      'mowy |> filter(str_detect(tekst, "górnictwo"))',
      'caly |> mutate(udzial = slowa / sum(slowa))',
      String.raw`mowy |> filter(str_detect(tekst, "\\bsę"))`,
    ],
  },

  task: {
    prompt: 'Policz dla każdej debaty, ile razy na 100 słów pada „polsk”, małą albo wielką literą. Kolumna: `na_100`.',
    starter: 'mowy\n',
    check,
    solution: SOLUTION,
    hints: [
      'W `mutate()` zrób kolumny `hit` i `slowa`: `str_count()` z `"\\\\bpolsk"` i z `"\\\\S+"`.',
      'Potem `group_by(debata)` i `summarise(na_100 = 100 * sum(hit) / sum(slowa))`.',
    ],
    messages: {
      typed: 'Liczby mają wyjść z tekstu. Policz trafienia i słowa przez `str_count()`.',
      raw: 'To liczby bezwzględne. KRS jest dłuższy, więc podziel trafienia przez liczbę słów.',
      capitals: 'W KRS wyszło za mało, bo „Polską” i „Polska” uciekły. Najpierw `str_to_lower(tekst)`.',
      meanRates: 'To średnia z odsetków zdań, a krótkie ważą tyle co długie. Policz `sum(hit) / sum(slowa)`.',
      groups: 'Potrzebny jest jeden wiersz na debatę. Dodaj `group_by(debata)` przed `summarise()`.',
      notTable: 'To nie jest tabela debat. Zakończ potok przez `summarise()`.',
      general: 'Jeszcze nie to. Policz trafienia i słowa, zgrupuj po debacie i podziel sumy.',
    },
    success: 'Dobrze. KRS 6.0, Energia 7.1 na 100 słów.',
    note: 'Porównując teksty różnej długości, licz na 100 albo 1000 słów. Sama liczba trafień mierzy głównie długość.',

    nearMisses: [
      { name: 'raw hits', expect: 'raw', code: `${BY} |>\n  summarise(hit = sum(hit))` },
      { name: 'capitals forgotten', expect: 'capitals', code: `mowy |>\n  mutate(hit = ${HIT},\n         slowa = ${WORD}) |>\n  group_by(debata) |>\n  ${RATE}` },
      { name: 'the mean of sentence rates', expect: 'meanRates', code: `${ROWS2} |>\n  group_by(debata) |>\n  summarise(na_100 = mean(100 * hit / slowa))` },
      { name: 'no groups', expect: 'groups', code: `${ROWS2} |>\n  ${RATE}` },
      { name: 'numbers typed in', expect: 'typed', code: 'data.frame(debata = c("KRS", "Energia"),\n           na_100 = c(6, 7.14))' },
      { name: 'one column', expect: 'notTable', code: 'mowy$debata' },
      { name: 'the table as it was', expect: 'general', code: 'mowy' },
    ],

    diagnose({ value, code, result }) {
      if (result?.reason === 'typed' && !/str_count\s*\(/.test(String(code || '')) && isDataFrame(value) && twoRows(value)) return 'typed';
      if (!isDataFrame(value)) return 'notTable';
      if (rLength(value.values[0]) === 1) return 'groups';
      if (!twoRows(value)) return 'general';
      if (hasPair(value, 3, 2)) return 'raw';
      if (hasPair(value, 2, 100 * 2 / 28)) return 'capitals';
      if (hasPair(value, (100 / 6 + 100 / 6 + 10) / 7, (10 + 100 / 6) / 4)) return 'meanRates';
      return 'general';
    },
  },
};

export default strTable;

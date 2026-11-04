/**
 * Lesson: the data before the model -- module 11, lecture 5, step zero (D101).
 *
 * One idea: before `lm()`, look at what each column is and what values it holds. The
 * dependent variable must be a number, and a number with no survey codes in it.
 *
 * The silent trap: a refusal coded 99 in the hours column. R takes it for 99 hours, the
 * plot squeezes everyone else to the bottom, and the line of the model turns round: +0.41
 * hours a year instead of -0.124. `na_if()` from exercise {ćw:missing-data} mends it.
 *
 * The table is the twenty people of `ankieta` (exercises 35-41) as a survey hands them
 * over: education in digits 1-3, one refusal (99, row 18) and one empty answer (NA, row
 * 5). The task asks for the prepared table, not for a model: `lm()` is taught from
 * exercise 35 on, and the scenes only show what it would say. Numbers checked in R
 * 4.6.2 (docs/lecture-5-design.md, section 4).
 */

import { getNames, isDataFrame, isAtomic, isNA } from '../core/rvalue.js';
import { isModel } from '../core/builtins/models.js';

const SETUP = `# Dwadzieścia osób, tak jak oddała je ankieta.
# 99 w godzinach znaczy „odmowa odpowiedzi”
badanie <- data.frame(
  wiek = c(19, 20, 21, 21, 22, 22, 23, 23, 24, 25,
           26, 28, 31, 34, 38, 43, 49, 55, 61, 67),
  plec = rep(c("K", "M"), 10),
  wyksztalcenie = c(2, 1, 3, 2, 2, 3, 1, 2, 3, 3,
                    2, 1, 3, 2, 1, 2, 3, 1, 2, 1),
  godziny = c(10, 7, 5, 6, NA, 8, 5, 6, 4, 5,
              3, 4, 3, 4, 2, 3, 2, 99, 2, 1)
)`;

const POINTS = 'ggplot(badanie, aes(x = wiek, y = godziny)) +\n  geom_point()';
const RAW = 'lm(godziny ~ wiek, data = badanie)';
const CLEAN = 'czyste <- badanie |>\n  mutate(godziny = na_if(godziny, 99))';
const CLEAN_LM = `${CLEAN}\nlm(godziny ~ wiek, data = czyste)`;
const SOLUTION = 'badanie |>\n  mutate(godziny = na_if(godziny, 99))';

// The pairs a prepared table keeps: everyone with an answer, the refusal gone.
const AGES = [19, 20, 21, 21, 22, 22, 23, 23, 24, 25, 26, 28, 31, 34, 38, 43, 49, 55, 61, 67];
const HOURS = [10, 7, 5, 6, NaN, 8, 5, 6, 4, 5, 3, 4, 3, 4, 2, 3, 2, 99, 2, 1];
const keyOf = (pairs) => pairs.map(([a, h]) => `${a}:${h}`).sort().join();
const CLEAN_PAIRS = keyOf(AGES.map((a, i) => [a, HOURS[i]]).filter(([, h]) => Number.isFinite(h) && h !== 99));

/** A column of the student's table, by name; null when it is not there. */
const colOf = (value, name) => {
  const names = (getNames(value)?.values || []).map(String);
  const at = names.indexOf(name);
  return at < 0 ? null : value.values[at].values;
};

/** What the student's value is, as far as this task is concerned. */
function judge(value) {
  if (isModel(value)) return 'model';
  if (!value) return 'general';
  if (!isDataFrame(value)) return isAtomic(value) && value.values.length === 20 ? 'column' : 'notTable';
  const wiek = colOf(value, 'wiek');
  const godz = colOf(value, 'godziny');
  if (!wiek || !godz) return 'columns';
  const pairs = wiek.map((a, i) => [Number(a), godz[i]]).filter(([, h]) => !isNA(h));
  if (pairs.some(([, h]) => Number(h) === 99)) return 'code99';
  if (pairs.length === 19 && pairs.some(([a, h]) => a === 55 && Number(h) === 0)) return 'zero';
  if (keyOf(pairs.map(([a, h]) => [a, Number(h)])) !== CLEAN_PAIRS) return 'general';
  return 'ok';
}

function check({ value }) {
  return judge(value) === 'ok' ? { ok: true } : { ok: false, reason: 'wrong-value' };
}
check.compare = {};

export const modelData = {
  id: 'model-data',
  module: 11,
  lecture: 5,
  requires: ['plot-types'],
  title: 'Zanim lm(): jakie dane?',
  setup: SETUP,

  scenes: [
    {
      say: 'Zanim policzysz model, sprawdź dane. `str()` pokazuje, **jakiego typu** jest każda kolumna.',
      code: 'str(badanie)',
      pick: 'str(badanie)',
    },
    {
      say: 'Najwięcej godzin dziennie: **99**, a doba ma 24. To kod „odmowa”, nie liczba godzin.',
      code: 'summary(badanie)',
      pick: 'summary(badanie)',
    },
    {
      say: 'Na wykresie kod 99 to jedna kropka wysoko. Wszyscy inni są ściśnięci na dole.',
      code: POINTS,
      pick: POINTS,
    },
    {
      say: 'Prosta przez punkty z kodem 99 idzie w górę: z wiekiem **więcej** godzin, +0.41 na rok.',
      code: RAW,
      pick: RAW,
    },
    {
      say: '`na_if()` zamienia kod na NA. Teraz prosta opada: **-0.124** h na rok, na 18 osobach.',
      code: CLEAN_LM,
      pick: 'lm(godziny ~ wiek, data = czyste)',
      tap: 'na_if(godziny, 99)',
    },
    {
      say: 'Model wyjaśnia **liczbę**: godziny tak, płeć nie. Cyfry wykształcenia to kategorie.',
      code: 'table(badanie$wyksztalcenie)',
      pick: 'table(badanie$wyksztalcenie)',
    },
  ],

  play: {
    say: 'Twoja kolej. Narysuj punkty po przygotowaniu albo znajdź osoby bez odpowiedzi.',
    code: `${CLEAN}\nsummary(czyste)`,
    chips: [
      'badanie |> mutate(godziny = na_if(godziny, 99)) |> ggplot(aes(x = wiek, y = godziny)) + geom_point()',
      'badanie |> filter(godziny != 99)',
      'lm(godziny ~ wiek, data = badanie |> filter(godziny != 99))',
      'badanie |> filter(godziny == 99 | is.na(godziny))',
    ],
  },

  task: {
    prompt: 'Przygotuj tabelę `badanie` do modelu: kod **99** w `godziny` to odmowa odpowiedzi. Wynikiem ma być cała tabela.',
    starter: 'badanie |>\n  ',
    check,
    solution: SOLUTION,
    hints: [
      'Kod trzeba zamienić na brak odpowiedzi, czyli NA. Robi to `na_if()`.',
      'W `mutate()`: `godziny = na_if(godziny, 99)`. Wynikiem zostaje cała tabela.',
    ],
    messages: {
      code99: 'W godzinach wciąż jest 99, a dla R to liczba. Zamień kod na NA: `na_if(godziny, 99)`.',
      zero: '0 godzin to odpowiedź, a ta osoba nie odpowiedziała. Brak to NA: `na_if(godziny, 99)`.',
      column: 'To sama kolumna. Model potrzebuje całej tabeli: zmień kolumnę w `mutate()`.',
      columns: 'W tabeli brakuje kolumn `wiek` albo `godziny`. Zostaw je obie.',
      notTable: 'Wynikiem ma być tabela, gotowa do modelu. Zacznij od `badanie |> mutate(...)`.',
      model: 'Model przyjdzie w ćwiczeniu {ćw:model-line}. Tu wynikiem ma być przygotowana tabela.',
      general: 'Jeszcze nie to: `badanie |> mutate(godziny = na_if(godziny, 99))`.',
    },
    success: 'Dobrze. Bez kodu 99 nachylenie to -0.124, a nie +0.41.',
    note: 'W ESS kody odmowy to 7777, 8888, 9999. Przed każdym modelem sprawdź `summary()`.',

    nearMisses: [
      { name: 'the table as it came', expect: 'code99', code: 'badanie' },
      { name: 'na.omit() alone', expect: 'code99', code: 'na.omit(badanie)' },
      { name: 'the refusal as zero hours', expect: 'zero', code: 'badanie |> mutate(godziny = ifelse(godziny == 99, 0, godziny))' },
      { name: 'only the column', expect: 'column', code: 'na_if(badanie$godziny, 99)' },
      { name: 'a model instead of the table', expect: 'model', code: 'lm(godziny ~ wiek, data = badanie)' },
      { name: 'the code as text', expect: 'error', code: 'badanie |> mutate(godziny = na_if(godziny, "99"))' },
      { name: 'the mean of hours', expect: 'notTable', code: 'mean(badanie$godziny, na.rm = TRUE)' },
    ],

    diagnose({ value }) {
      const verdict = judge(value);
      return verdict === 'ok' ? 'general' : verdict;
    },
  },
};

export default modelData;

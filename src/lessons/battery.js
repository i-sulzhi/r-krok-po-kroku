/**
 * Lesson: a battery of questions with pivot_longer() -- module 9, lecture 3 (D39, D70).
 *
 * Students read a wide table at once and do not see why anyone would make it long.
 * Three questions did not help (D70): a wide summary answered "which is rated
 * highest" by eye. So the battery is now six institutions, trust from 1 to 5, and
 * the question is a ranking, separately for women and men, where the answer differs:
 * women trust the Sejm least, men the media.
 *
 * The argument is the vector mechanics students already know. In the wide table the
 * institution lives only in the column names; no vector stands beside the ratings and
 * says which institution each one is about, so nothing can filter, group or arrange
 * by it, and `arrange()` on the wide summary orders the sexes. `pivot_longer()` makes
 * that vector. Then one rating is picked the way `ocena[plec == "K"]` was, and
 * `group_by(instytucja)` does it for every institution without anyone typing a name.
 *
 * The price stays what it was: a row is now a rating, not a person, and `n()` counts
 * the empty ratings too.
 */

import { resultCheck } from './schema.js';
import { getNames, isNA, isDataFrame, mkList, mkCharacter } from '../core/rvalue.js';

const SETUP = `# Zaufanie do instytucji, skala od 1 do 5
ankieta <- data.frame(
  id = 1:8,
  plec = c("K", "M", "K", "M", "K", "M", "K", "M"),
  sad = c(4, 3, 3, 4, 4, 3, 3, 3),
  policja = c(4, 4, NA, 5, 3, 4, 4, 3),
  sejm = c(2, 3, 1, 2, 2, NA, 2, 3),
  media = c(3, 2, 2, 2, 3, 1, 2, 3),
  uczelnia = c(5, 4, 4, 5, 5, 4, 4, 4),
  samorzad = c(3, 4, 4, 3, 3, 4, 3, 3)
)`;

// The wide way: one line per institution, and a ranking that cannot be made.
const WIDE = `ankieta |>
  group_by(plec) |>
  summarise(
    sad = mean(sad, na.rm = TRUE),
    policja = mean(policja, na.rm = TRUE),
    sejm = mean(sejm, na.rm = TRUE),
    media = mean(media, na.rm = TRUE),
    uczelnia = mean(uczelnia, na.rm = TRUE),
    samorzad = mean(samorzad, na.rm = TRUE)
  ) |>
  arrange(sejm)`;

const FOLD = `  pivot_longer(sad:samorzad, names_to = "instytucja",
               values_to = "zaufanie")`;

const LONG = `ankieta |>\n${FOLD}`;

// The label vector, used the way lecture 1 used one vector to pick from another.
const PICK = 'dlugo$zaufanie[dlugo$instytucja == "sejm"]';
const VECTOR = `dlugo <- ankieta |>
  pivot_longer(sad:samorzad,
               names_to = "instytucja",
               values_to = "zaufanie")
${PICK}`;

const COUNTED = `${LONG} |>
  count(instytucja)`;

const RANKED = `${LONG} |>
  group_by(instytucja) |>
  summarise(srednia = mean(zaufanie, na.rm = TRUE),
            n = sum(!is.na(zaufanie))) |>
  arrange(srednia)`;

const DROPPED = `ankieta |>
  pivot_longer(sad:samorzad, names_to = "instytucja",
               values_to = "zaufanie",
               values_drop_na = TRUE)`;

const SOLUTION = `${LONG} |>
  group_by(plec, instytucja) |>
  summarise(srednia = mean(zaufanie, na.rm = TRUE)) |>
  arrange(plec, srednia)`;

// A ranking is an order, so rows are compared in order; `group_by(instytucja, plec)`
// only moves a column, and a rounded mean is the same mean (D58).
const strict = resultCheck({ expected: SOLUTION, requireCalls: ['pivot_longer', 'summarise'], compare: { ignoreColumnOrder: true, tolerance: 0.01 } });

// The ratings given, without the empty ones: 46 of 48.
const ANSWERED = 46;

/**
 * The exercise's own advice is to put `n` beside a mean: an n of ratings is welcome,
 * in the task and in the extra one (D67).
 */
function allowN(inner) {
  const wrapped = (ctx) => {
    const v = ctx.value;
    if (v && isDataFrame(v)) {
      const names = (getNames(v)?.values || []).map(String);
      const at = names.indexOf('n');
      if (at !== -1 && v.values[at].values.reduce((a, b) => a + Number(b), 0) === ANSWERED) {
        const keep = names.map((_, i) => i).filter((i) => i !== at);
        const without = mkList(keep.map((i) => v.values[i]), { ...v.attributes, names: mkCharacter(keep.map((i) => names[i])) });
        return inner({ ...ctx, value: without });
      }
    }
    return inner(ctx);
  };
  wrapped.compare = inner.compare;
  return wrapped;
}
/**
 * Which sex comes first is not part of a ranking (D70): men above women is the same
 * answer. The student's rows are put women first, keeping their order, and compared.
 */
function eitherSexFirst(ctx) {
  const verdict = strict(ctx);
  const v = ctx.value;
  if (verdict.ok || !v || !isDataFrame(v)) return verdict;
  const sex = colOf(v, 'plec').map(String);
  // Only whole blocks may swap: a table with the sexes mixed is not two rankings.
  const blocks = sex.filter((x, i) => i === 0 || x !== sex[i - 1]);
  if (!sex.length || new Set(blocks).size !== blocks.length) return verdict;
  const order = [...sex.keys()].sort((a, b) => (sex[a] === sex[b] ? a - b : sex[a] < sex[b] ? -1 : 1));
  const moved = mkList(v.values.map((c) => ({ ...c, values: order.map((r) => c.values[r]) })), v.attributes);
  return strict({ ...ctx, value: moved });
}
eitherSexFirst.compare = strict.compare;
const check = allowN(eitherSexFirst);

/** The values of a column of the student's table, by name; [] when it is not there. */
function colOf(value, name) {
  const names = (getNames(value)?.values || []).map(String);
  const at = names.indexOf(name);
  return at < 0 ? [] : value.values[at].values;
}

// The answer, in order: women from the Sejm up, men from the media up.
const WOMEN = ['sejm', 'media', 'samorzad', 'sad', 'policja', 'uczelnia'];
const MEN = ['media', 'sejm', 'sad', 'samorzad', 'policja', 'uczelnia'];

// For those who want more (D64): the share of trust (4-5) per institution, ranked,
// with the empty ratings dropped where the long table is made.
const EXTRA = `ankieta |>
  pivot_longer(sad:samorzad, names_to = "instytucja",
               values_to = "zaufanie",
               values_drop_na = TRUE) |>
  group_by(instytucja) |>
  summarise(procent = mean(zaufanie >= 4) * 100) |>
  arrange(desc(procent))`;

export const battery = {
  id: 'battery',
  module: 9,
  lecture: 3,
  requires: ['grouping', 'crosstab'],
  title: 'Bateria pytań: pivot_longer()',
  setup: SETUP,

  scenes: [
    // The question first (D58), now one a wide table cannot answer (D70).
    {
      say: 'Sześć instytucji, skala 1–5. Którym ufamy **najmniej**? I czy kobiety tak samo jak mężczyźni?',
      picture: { kind: 'verb', question: 'Którym instytucjom ufamy najmniej?', code: RANKED },
    },
    {
      say: 'Sześć razy to samo. `arrange()` układa **wiersze**, a tu wiersze to płcie, nie instytucje.',
      code: WIDE,
      pick: WIDE,
      tap: 'arrange(sejm)',
    },
    {
      say: 'Przy każdej ocenie brakuje wektora: **której instytucji** dotyczy. `pivot_longer()` go robi.',
      code: LONG,
      pick: LONG,
    },
    {
      say: 'Teraz to zwykły wybór z wektora. Nazwy nie piszesz sam: `group_by()` zrobi to dla każdej.',
      code: VECTOR,
      pick: PICK,
    },
    {
      say: 'Wiersz to teraz **jedna ocena**, nie osoba: 48 wierszy, po 8 na instytucję.',
      code: COUNTED,
      pick: COUNTED,
    },
    {
      say: 'Jedno `group_by()` liczy **wszystkie** instytucje, a `arrange()` robi z nich ranking.',
      code: RANKED,
      pick: RANKED,
      tap: 'arrange(srednia)',
    },
    {
      say: '`values_drop_na = TRUE` usuwa puste oceny od razu. Zostaje 46 wierszy.',
      code: DROPPED,
      pick: DROPPED,
    },
  ],

  play: {
    say: 'Twoja kolej. Instytucja to teraz wartość w kolumnie: filtruj, grupuj, układaj.',
    code: `${LONG} |>\n  count(instytucja, zaufanie)`,
    chips: [
      'ankieta |> pivot_longer(sad:samorzad, names_to = "instytucja", values_to = "zaufanie") |> filter(instytucja %in% c("sejm", "media"))',
      'ankieta |> pivot_longer(sad:samorzad, names_to = "instytucja", values_to = "zaufanie") |> group_by(plec, instytucja) |> summarise(srednia = mean(zaufanie, na.rm = TRUE)) |> filter(srednia == min(srednia))',
      'ankieta |> pivot_longer(-c(id, plec), names_to = "instytucja", values_to = "zaufanie") |> count(id)',
      'ankieta |> pivot_longer(sad:samorzad, names_to = "instytucja", values_to = "zaufanie") |> count(instytucja, zaufanie) |> pivot_wider(names_from = zaufanie, values_from = n, values_fill = 0)',
    ],
  },

  task: {
    prompt: 'Ranking zaufania **osobno dla kobiet i mężczyzn**, od najniższej średniej. Kolumny: `plec`, `instytucja`, `srednia`.',
    starter: `${LONG} |>\n  `,
    check,
    solution: SOLUTION,
    hints: [
      'Grupą jest para: `group_by(plec, instytucja)`, potem `summarise()` ze średnią.',
      'W ocenach są braki, więc `na.rm = TRUE`. Na końcu `arrange(plec, srednia)`: najpierw płeć, w niej średnia.',
    ],
    messages: {
      'missing.pivot_longer': 'Zacznij od złożenia instytucji: `pivot_longer(sad:samorzad, ...)`. W szerokiej tabeli rankingu nie ułożysz.',
      'missing.summarise': 'To jeszcze pojedyncze oceny. Średnią w grupach liczy `summarise()` po `group_by()`.',
      notATable: 'Wynikiem ma być tabela: płeć, instytucja i średnia.',
      long: 'To jeszcze pojedyncze oceny. Średnią w grupach liczy `summarise()` po `group_by()`.',
      hasNA: 'Część średnich to NA, bo w ocenach są braki. Dodaj `na.rm = TRUE` w `mean()`.',
      noSex: 'Jest ranking instytucji, ale wspólny. Ma być osobno dla płci: `group_by(plec, instytucja)`.',
      noInstitution: 'Jest płeć, ale instytucje zlały się w jedną średnią. Grupuj przez obie: `group_by(plec, instytucja)`.',
      wrongName: 'Liczby dobre, ale kolumna ze średnią ma się nazywać `srednia`.',
      nCountsEmpty: '`n()` liczy też puste oceny: sejm u mężczyzn to 3 oceny, nie 4. Policz `sum(!is.na(zaufanie))`.',
      institutionName: 'Kolumna z instytucjami ma się nazywać `instytucja`: `names_to = "instytucja"`.',
      unsorted: 'Średnie dobre, ale to jeszcze nie ranking. Ułóż je: `arrange(plec, srednia)`.',
      onlyLowest: 'To odpowiedź na pytanie, kto na dole: sejm i media. Zadanie chce całego rankingu: zamiast `filter()` jest `arrange(plec, srednia)`.',
      wideAgain: 'Płcie wróciły do nazw kolumn, a ranking układa wiersze. Bez `pivot_wider()`: na końcu `arrange(plec, srednia)`.',
      mixed: 'Kobiety i mężczyźni są przemieszani. Najpierw płeć, w niej średnia: `arrange(plec, srednia)`.',
      reversed: 'Ranking idzie od najwyższej średniej, a ma od najniższej: `arrange(plec, srednia)`, bez `desc()`.',
      general: 'Jeszcze nie to. Po `pivot_longer()`: `group_by(plec, instytucja)`, `summarise(srednia = ...)`, `arrange(plec, srednia)`.',
    },
    success: 'Dobrze. Kobiety ufają najmniej sejmowi, mężczyźni mediom.',
    note: 'Najsłabszą instytucję w każdej płci da też `filter(srednia == min(srednia))`. Każda średnia to 3 albo 4 osoby.',

    nearMisses: [
      { name: 'forgot the missing ratings', expect: 'hasNA',
        code: `${LONG} |> group_by(plec, instytucja) |> summarise(srednia = mean(zaufanie)) |> arrange(plec, srednia)` },
      { name: 'one ranking for everybody', expect: 'noSex',
        code: `${LONG} |> group_by(instytucja) |> summarise(srednia = mean(zaufanie, na.rm = TRUE)) |> arrange(srednia)` },
      { name: 'grouped by sex only', expect: 'noInstitution',
        code: `${LONG} |> group_by(plec) |> summarise(srednia = mean(zaufanie, na.rm = TRUE))` },
      { name: 'stopped at the long table', expect: 'missing.summarise',
        code: LONG },
      { name: 'named the mean differently', expect: 'wrongName',
        code: `${LONG} |> group_by(plec, instytucja) |> summarise(sr = mean(zaufanie, na.rm = TRUE)) |> arrange(plec, sr)` },
      { name: 'stayed with the wide table', expect: 'missing.pivot_longer', code: WIDE },
      // The trap of the exercise: n() counts rows, and a row with no rating is a row.
      { name: 'counted ratings with n()', expect: 'nCountsEmpty',
        code: `${LONG} |> group_by(plec, instytucja) |> summarise(srednia = mean(zaufanie, na.rm = TRUE), n = n()) |> arrange(plec, srednia)` },
      { name: 'named the institution column differently', expect: 'institutionName',
        code: 'ankieta |> pivot_longer(sad:samorzad, names_to = "inst", values_to = "zaufanie") |> group_by(plec, inst) |> summarise(srednia = mean(zaufanie, na.rm = TRUE)) |> arrange(plec, srednia)' },
      { name: 'left the new name without quotes', expect: 'error',
        code: 'ankieta |> pivot_longer(sad:samorzad, names_to = instytucja, values_to = "zaufanie")' },
      { name: 'did not sort', expect: 'unsorted',
        code: `${LONG} |> group_by(plec, instytucja) |> summarise(srednia = mean(zaufanie, na.rm = TRUE))` },
      // After summarise() the table is grouped by sex, but arrange() ignores groups.
      { name: 'sorted by the mean only', expect: 'mixed',
        code: `${LONG} |> group_by(plec, instytucja) |> summarise(srednia = mean(zaufanie, na.rm = TRUE)) |> arrange(srednia)` },
      { name: 'kept only the lowest', expect: 'onlyLowest',
        code: `${LONG} |> group_by(plec, instytucja) |> summarise(srednia = mean(zaufanie, na.rm = TRUE)) |> filter(srednia == min(srednia))` },
      { name: 'spread the sexes again', expect: 'wideAgain',
        code: `${LONG} |> group_by(plec, instytucja) |> summarise(srednia = mean(zaufanie, na.rm = TRUE)) |> pivot_wider(names_from = plec, values_from = srednia)` },
      { name: 'sorted from the highest', expect: 'reversed',
        code: `${LONG} |> group_by(plec, instytucja) |> summarise(srednia = mean(zaufanie, na.rm = TRUE)) |> arrange(plec, desc(srednia))` },
    ],

    diagnose({ value, result }) {
      if (!value) return 'general';
      const missing = result?.reason === 'missing-call' ? `missing.${result.detail.name}` : null;
      if (!isDataFrame(value)) return missing || 'notATable';
      if (missing) return missing;
      const names = (getNames(value)?.values || []).map(String);
      if (names.includes('zaufanie')) return 'long';
      if (names.includes('K') && names.includes('M')) return 'wideAgain';
      const hasSex = names.includes('plec');
      const hasInst = names.includes('instytucja');
      const n = names.indexOf('n');
      if (n !== -1 && value.values[n].values.reduce((a, b) => a + Number(b), 0) > ANSWERED) return 'nCountsEmpty';
      // Another text column where `instytucja` should be: the institutions under another name.
      if (!hasInst && names.some((nm, i) => nm !== 'plec' && value.values[i].type === 'character')) return 'institutionName';
      if (hasInst && !hasSex) return 'noSex';
      if (hasSex && !hasInst) return 'noInstitution';
      if (!hasSex || !hasInst) return 'general';
      const extra = names.filter((nm) => nm !== 'plec' && nm !== 'instytucja' && nm !== 'n');
      if (extra.length !== 1) return 'general';
      const mean = value.values[names.indexOf(extra[0])].values;
      if (mean.some(isNA)) return 'hasNA';
      if (extra[0] !== 'srednia') return 'wrongName';
      // The means are right; what is left is the order of the ranking.
      const sex = colOf(value, 'plec').map(String);
      const inst = colOf(value, 'instytucja').map(String);
      const women = inst.filter((_, i) => sex[i] === 'K');
      const men = inst.filter((_, i) => sex[i] === 'M');
      if (women.join() === WOMEN[0] && men.join() === MEN[0]) return 'onlyLowest';
      const sexesInBlocks = sex.every((s, i) => i === 0 || s >= sex[i - 1]);
      if (sexesInBlocks && women.join() === [...WOMEN].reverse().join() && men.join() === [...MEN].reverse().join()) return 'reversed';
      if (!sexesInBlocks && mean.every((m, i) => i === 0 || Number(m) >= Number(mean[i - 1]))) return 'mixed';
      if (women.join() !== WOMEN.join() || men.join() !== MEN.join()) return 'unsorted';
      return 'general';
    },
  },

  extra: {
    prompt: 'Dla każdej instytucji **procent ocen 4–5**, od najwyższego. Puste oceny usuń w `pivot_longer()`. Kolumny: `instytucja`, `procent`.',
    starter: 'ankieta |>\n  ',
    check: allowN(resultCheck({ expected: EXTRA, requireCalls: ['pivot_longer'], compare: { tolerance: 0.02 } })),
    solution: EXTRA,
    hints: [
      'Złóż instytucje jak w scenach i dopisz `values_drop_na = TRUE`.',
      'Procent ufających to `mean(zaufanie >= 4) * 100` w `summarise()`, a na końcu `arrange(desc(procent))`.',
    ],
    messages: {
      'missing.pivot_longer': 'Zacznij od złożenia instytucji: `pivot_longer(sad:samorzad, ...)`.',
      hasNA: 'Część procentów to NA, bo w ocenach są braki. Dopisz `values_drop_na = TRUE` w `pivot_longer()`.',
      fraction: 'To ułamki, nie procenty: brakuje `* 100`.',
      bySex: 'Jest podział na płeć, a pytanie jest tylko o instytucje: `group_by(instytucja)`.',
      emptyAsAnswer: 'Puste oceny liczą się jak brak zaufania, więc procent jest za niski. Usuń je: `values_drop_na = TRUE`.',
      nCountsEmpty: 'Procenty dobre, ale `n` liczy też puste oceny. Usuń je w `pivot_longer()`: `values_drop_na = TRUE`.',
      wrongPercent: 'Instytucje się zgadzają, procent nie. Ufa ten, kto dał 4 albo 5: `mean(zaufanie >= 4) * 100`.',
      order: 'Procenty dobre, ale ranking ma iść od najwyższego: `arrange(desc(procent))`.',
      general: 'Jeszcze nie to: `pivot_longer()` z `values_drop_na = TRUE`, potem `group_by(instytucja)`, `summarise()` i `arrange()`.',
    },
    success: 'Dobrze. Uczelni ufają wszyscy, sejmowi i mediom nikt.',
    note: 'Średnia ze skali 1–5 to umowa: odstępy między odpowiedziami nie muszą być równe. Procent 4–5 tego nie zakłada.',

    nearMisses: [
      { name: 'kept the empty ratings', expect: 'hasNA',
        code: 'ankieta |> pivot_longer(sad:samorzad, names_to = "instytucja", values_to = "zaufanie") |> group_by(instytucja) |> summarise(procent = mean(zaufanie >= 4) * 100) |> arrange(desc(procent))' },
      { name: 'left fractions', expect: 'fraction',
        code: 'ankieta |> pivot_longer(sad:samorzad, names_to = "instytucja", values_to = "zaufanie", values_drop_na = TRUE) |> group_by(instytucja) |> summarise(procent = mean(zaufanie >= 4)) |> arrange(desc(procent))' },
      { name: 'split by sex as well', expect: 'bySex',
        code: 'ankieta |> pivot_longer(sad:samorzad, names_to = "instytucja", values_to = "zaufanie", values_drop_na = TRUE) |> group_by(plec, instytucja) |> summarise(procent = mean(zaufanie >= 4) * 100)' },
      { name: 'counted only the fives', expect: 'wrongPercent',
        code: 'ankieta |> pivot_longer(sad:samorzad, names_to = "instytucja", values_to = "zaufanie", values_drop_na = TRUE) |> group_by(instytucja) |> summarise(procent = mean(zaufanie > 4) * 100) |> arrange(desc(procent))' },
      { name: 'counted the empty ratings as distrust', expect: 'emptyAsAnswer',
        code: 'ankieta |> pivot_longer(sad:samorzad, names_to = "instytucja", values_to = "zaufanie") |> group_by(instytucja) |> summarise(procent = mean(zaufanie %in% 4:5) * 100) |> arrange(desc(procent))' },
      { name: 'put an n beside that counts the empty ones', expect: 'nCountsEmpty',
        code: 'ankieta |> pivot_longer(sad:samorzad, names_to = "instytucja", values_to = "zaufanie") |> group_by(instytucja) |> summarise(procent = mean(zaufanie >= 4, na.rm = TRUE) * 100, n = n()) |> arrange(desc(procent))' },
      { name: 'did not rank', expect: 'order',
        code: 'ankieta |> pivot_longer(sad:samorzad, names_to = "instytucja", values_to = "zaufanie", values_drop_na = TRUE) |> group_by(instytucja) |> summarise(procent = mean(zaufanie >= 4) * 100)' },
    ],

    diagnose({ value, result }) {
      if (!value || !isDataFrame(value)) return 'general';
      if (result?.reason === 'missing-call') return `missing.${result.detail.name}`;
      const names = (getNames(value)?.values || []).map(String);
      if (names.includes('plec')) return 'bySex';
      const pct = colOf(value, 'procent');
      if (!pct.length) return 'general';
      if (pct.some(isNA)) return 'hasNA';
      if (pct.every((x) => Number(x) <= 1)) return 'fraction';
      const inst = colOf(value, 'instytucja').map(String);
      if (inst.length !== 6) return 'general';
      const at = (name) => Number(pct[inst.indexOf(name)]);
      const near = (x, y) => Math.abs(x - y) < 0.5;
      // The empty rating of the police left in and counted as "not 4-5": 5 of 8, not 5 of 7.
      if (near(at('policja'), 62.5) && near(at('uczelnia'), 100)) return 'emptyAsAnswer';
      const right = near(at('uczelnia'), 100) && near(at('policja'), 500 / 7) && near(at('sad'), 37.5);
      if (right && names.includes('n')) return 'nCountsEmpty';
      if (right) return 'order';
      return 'wrongPercent';
    },
  },
};

export default battery;

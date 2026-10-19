/**
 * Lesson: a battery of questions with pivot_longer() -- module 9, lecture 3 (D39, D70, D74).
 *
 * Students read a wide table at once and do not see why anyone would make it long.
 * The argument is one they can count (D74): in the wide table each institution is its
 * own vector, so four means are four lines of `mean()`. `pivot_longer()` puts every
 * rating into one vector, `zaufanie`, with a second one beside it, `instytucja`,
 * saying which institution each rating is about. Then one line of `mean()` under
 * `group_by(instytucja)` does all four, and would do twenty.
 *
 * The question needs the long table too: a ranking, separately for women and men,
 * where the answer differs. Women trust the Sejm least, men the media, and the
 * common ranking puts the media at the bottom.
 *
 * There are no missing ratings here (D74). An empty rating in a long table is a whole
 * row that `n()` counts; that, and `values_drop_na`, are taught in the missing-data exercise.
 */

import { resultCheck } from './schema.js';
import { getNames, isDataFrame, mkList, mkCharacter } from '../core/rvalue.js';

const SETUP = `# Zaufanie do instytucji, skala od 1 do 5
ankieta <- data.frame(
  id = 1:8,
  plec = c("K", "M", "K", "M", "K", "M", "K", "M"),
  sad = c(4, 3, 3, 4, 4, 3, 3, 3),
  policja = c(4, 4, 4, 5, 3, 4, 4, 3),
  sejm = c(2, 3, 1, 2, 2, 3, 2, 4),
  media = c(3, 2, 2, 2, 3, 1, 2, 3)
)`;

// The wide way: each institution its own vector, each mean its own line.
const FOUR = `mean(ankieta$sad)
mean(ankieta$policja)
mean(ankieta$sejm)
mean(ankieta$media)`;

// The same in a pipe, as a student who stays wide would write it.
const WIDE = `ankieta |>
  group_by(plec) |>
  summarise(
    sad = mean(sad),
    policja = mean(policja),
    sejm = mean(sejm),
    media = mean(media)
  )`;

const FOLD = `  pivot_longer(sad:media, names_to = "instytucja",
               values_to = "zaufanie")`;

const LONG = `ankieta |>\n${FOLD}`;

const RANKED = `${LONG} |>
  group_by(instytucja) |>
  summarise(srednia = mean(zaufanie)) |>
  arrange(srednia)`;

const SOLUTION = `${LONG} |>
  group_by(plec, instytucja) |>
  summarise(srednia = mean(zaufanie)) |>
  arrange(plec, srednia)`;

// A ranking is an order, so rows are compared in order; `group_by(instytucja, plec)`
// only moves a column, and a rounded mean is the same mean (D58).
const strict = resultCheck({ expected: SOLUTION, requireCalls: ['pivot_longer', 'summarise'], compare: { ignoreColumnOrder: true, tolerance: 0.05 } });

// All the ratings: 8 people times 4 institutions.
const RATINGS = 32;

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
      if (at !== -1 && v.values[at].values.reduce((a, b) => a + Number(b), 0) === RATINGS) {
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

/** Both measures side by side is the note's own advice (D70): a mean beside the percent is welcome. */
function allowMean(inner) {
  const wrapped = (ctx) => {
    const v = ctx.value;
    if (v && isDataFrame(v)) {
      const names = (getNames(v)?.values || []).map(String);
      const at = names.indexOf('srednia');
      if (at !== -1) {
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

/** The values of a column of the student's table, by name; [] when it is not there. */
function colOf(value, name) {
  const names = (getNames(value)?.values || []).map(String);
  const at = names.indexOf(name);
  return at < 0 ? [] : value.values[at].values;
}

// The answer, in order: women from the Sejm up, men from the media up.
const WOMEN = ['sejm', 'media', 'sad', 'policja'];
const MEN = ['media', 'sejm', 'sad', 'policja'];
const MEANS = { 'K sejm': 1.75, 'K media': 2.5, 'K sad': 3.5, 'K policja': 3.75,
  'M media': 2, 'M sejm': 3, 'M sad': 3.25, 'M policja': 4 };

// For those who want more (D64): the share of trust (4-5) per institution, ranked.
const EXTRA = `${LONG} |>
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
    // The question first (D58), one a wide table cannot answer (D70).
    {
      say: 'Cztery instytucje, skala 1–5. Którym ufamy **najmniej**? I czy kobiety tak samo jak mężczyźni?',
      picture: { kind: 'verb', question: 'Którym instytucjom ufamy najmniej?', code: RANKED },
    },
    // Four vectors, four lines (D74): the cost students can count.
    {
      say: 'Każda instytucja to **osobny wektor**. Cztery średnie to cztery linijki.',
      code: FOUR,
      pick: 'mean(ankieta$sad)',
    },
    {
      say: 'Teraz wszystkie oceny są w **jednym wektorze** `zaufanie`. Obok `instytucja` mówi, czego dotyczą.',
      code: LONG,
      pick: LONG,
      tap: 'names_to = "instytucja"',
    },
    {
      say: 'Jedna linijka `mean()` liczy **wszystkie** instytucje. Przy dwudziestu też jedna.',
      code: RANKED,
      pick: RANKED,
      tap: 'group_by(instytucja)',
    },
  ],

  play: {
    say: 'Wiersz to teraz **jedna ocena**: 32 wiersze, 8 osób razy 4. Instytucję możesz filtrować i grupować.',
    code: `${LONG} |>\n  count(instytucja, zaufanie)`,
    chips: [
      'ankieta |> pivot_longer(sad:media, names_to = "instytucja", values_to = "zaufanie") |> filter(instytucja %in% c("sejm", "media"))',
      'ankieta |> pivot_longer(sad:media, names_to = "instytucja", values_to = "zaufanie") |> group_by(plec, instytucja) |> summarise(srednia = mean(zaufanie)) |> filter(srednia == min(srednia))',
      'ankieta |> pivot_longer(-c(id, plec), names_to = "instytucja", values_to = "zaufanie") |> count(id)',
      'ankieta |> pivot_longer(sad:media, names_to = "instytucja", values_to = "zaufanie") |> count(instytucja, zaufanie) |> pivot_wider(names_from = zaufanie, values_from = n, values_fill = 0)',
    ],
  },

  task: {
    prompt: 'Ranking zaufania **osobno dla kobiet i mężczyzn**, od najniższej średniej. Kolumny: `plec`, `instytucja`, `srednia`.',
    starter: `${LONG} |>\n  `,
    check,
    solution: SOLUTION,
    hints: [
      'Jak w ostatniej scenie, ale grupą jest para: `group_by(plec, instytucja)`.',
      'Na końcu `arrange(plec, srednia)`: najpierw płeć, w niej średnia.',
    ],
    messages: {
      'missing.pivot_longer': 'Zacznij od złożenia instytucji: `pivot_longer(sad:media, ...)`. W szerokiej tabeli rankingu nie ułożysz.',
      'missing.summarise': 'To jeszcze pojedyncze oceny. Średnią w grupach liczy `summarise()` po `group_by()`.',
      notATable: 'Wynikiem ma być tabela: płeć, instytucja i średnia.',
      long: 'To jeszcze pojedyncze oceny. Średnią w grupach liczy `summarise()` po `group_by()`.',
      noSex: 'Jest ranking instytucji, ale wspólny. Ma być osobno dla płci: `group_by(plec, instytucja)`.',
      noInstitution: 'Jest płeć, ale instytucje zlały się w jedną średnią. Grupuj przez obie: `group_by(plec, instytucja)`.',
      wrongName: 'Liczby dobre, ale kolumna ze średnią ma się nazywać `srednia`.',
      institutionName: 'Kolumna z instytucjami ma się nazywać `instytucja`: `names_to = "instytucja"`.',
      unsorted: 'Średnie dobre, ale to jeszcze nie ranking. Ułóż je: `arrange(plec, srednia)`.',
      idFolded: 'Wśród instytucji jest `id`: `-plec` złożyło też numer osoby. Wskaż oceny: `sad:media` albo `-c(id, plec)`.',
      wrongMeasure: 'Ranking jest, ale liczby to nie średnie. W `summarise()` ma stać `mean(zaufanie)`.',
      onlyLowest: 'To odpowiedź na pytanie, kto na dole: sejm i media. Zadanie chce całego rankingu: zamiast `filter()` jest `arrange(plec, srednia)`.',
      wideAgain: 'Płcie wróciły do nazw kolumn, a ranking układa wiersze. Bez `pivot_wider()`: na końcu `arrange(plec, srednia)`.',
      mixed: 'Kobiety i mężczyźni są przemieszani. Najpierw płeć, w niej średnia: `arrange(plec, srednia)`.',
      reversed: 'Ranking idzie od najwyższej średniej, a ma od najniższej: `arrange(plec, srednia)`, bez `desc()`.',
      general: 'Jeszcze nie to. Po `pivot_longer()`: `group_by(plec, instytucja)`, `summarise(srednia = ...)`, `arrange(plec, srednia)`.',
    },
    success: 'Dobrze. Kobiety ufają najmniej sejmowi, mężczyźni mediom.',
    note: 'We wspólnym rankingu na dole są media. Podział na płeć to zmienia. Każda średnia to tylko 4 osoby.',

    nearMisses: [
      { name: 'one ranking for everybody', expect: 'noSex',
        code: `${LONG} |> group_by(instytucja) |> summarise(srednia = mean(zaufanie)) |> arrange(srednia)` },
      { name: 'grouped by sex only', expect: 'noInstitution',
        code: `${LONG} |> group_by(plec) |> summarise(srednia = mean(zaufanie))` },
      { name: 'stopped at the long table', expect: 'missing.summarise',
        code: LONG },
      { name: 'named the mean differently', expect: 'wrongName',
        code: `${LONG} |> group_by(plec, instytucja) |> summarise(sr = mean(zaufanie)) |> arrange(plec, sr)` },
      { name: 'stayed with the wide table', expect: 'missing.pivot_longer', code: WIDE },
      { name: 'named the institution column differently', expect: 'institutionName',
        code: 'ankieta |> pivot_longer(sad:media, names_to = "inst", values_to = "zaufanie") |> group_by(plec, inst) |> summarise(srednia = mean(zaufanie)) |> arrange(plec, srednia)' },
      { name: 'left the new name without quotes', expect: 'error',
        code: 'ankieta |> pivot_longer(sad:media, names_to = instytucja, values_to = "zaufanie")' },
      { name: 'did not sort', expect: 'unsorted',
        code: `${LONG} |> group_by(plec, instytucja) |> summarise(srednia = mean(zaufanie))` },
      // After summarise() the table is grouped by sex, but arrange() ignores groups.
      { name: 'sorted by the mean only', expect: 'mixed',
        code: `${LONG} |> group_by(plec, instytucja) |> summarise(srednia = mean(zaufanie)) |> arrange(srednia)` },
      { name: 'kept only the lowest', expect: 'onlyLowest',
        code: `${LONG} |> group_by(plec, instytucja) |> summarise(srednia = mean(zaufanie)) |> filter(srednia == min(srednia))` },
      { name: 'spread the sexes again', expect: 'wideAgain',
        code: `${LONG} |> group_by(plec, instytucja) |> summarise(srednia = mean(zaufanie)) |> pivot_wider(names_from = plec, values_from = srednia)` },
      { name: 'folded the id as well', expect: 'idFolded',
        code: 'ankieta |> pivot_longer(-plec, names_to = "instytucja", values_to = "zaufanie") |> group_by(plec, instytucja) |> summarise(srednia = mean(zaufanie)) |> arrange(plec, srednia)' },
      { name: 'ranked by the median', expect: 'wrongMeasure',
        code: `${LONG} |> group_by(plec, instytucja) |> summarise(srednia = median(zaufanie)) |> arrange(plec, srednia)` },
      { name: 'sorted from the highest', expect: 'reversed',
        code: `${LONG} |> group_by(plec, instytucja) |> summarise(srednia = mean(zaufanie)) |> arrange(plec, desc(srednia))` },
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
      // Another text column where `instytucja` should be: the institutions under another name.
      if (!hasInst && names.some((nm, i) => nm !== 'plec' && value.values[i].type === 'character')) return 'institutionName';
      if (hasInst && !hasSex) return 'noSex';
      if (hasSex && !hasInst) return 'noInstitution';
      if (!hasSex || !hasInst) return 'general';
      if (colOf(value, 'instytucja').map(String).includes('id')) return 'idFolded';
      const extra = names.filter((nm) => nm !== 'plec' && nm !== 'instytucja' && nm !== 'n');
      if (extra.length !== 1) return 'general';
      if (extra[0] !== 'srednia') return 'wrongName';
      // The ranking is of means: any other number is the wrong measure, whatever the order.
      const mean = value.values[names.indexOf('srednia')].values;
      const sex = colOf(value, 'plec').map(String);
      const inst = colOf(value, 'instytucja').map(String);
      const keyOf = (i) => `${sex[i]} ${inst[i]}`;
      if (mean.some((m, i) => !(keyOf(i) in MEANS) || Math.abs(Number(m) - MEANS[keyOf(i)]) > 0.05)) return 'wrongMeasure';
      // The means are right; what is left is the order of the ranking.
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
    prompt: 'Dla każdej instytucji **procent ocen 4–5**, od najwyższego. Kolumny: `instytucja`, `procent`.',
    starter: `${LONG} |>\n  `,
    check: allowMean(allowN(resultCheck({ expected: EXTRA, requireCalls: ['pivot_longer'], compare: { tolerance: 0.02 } }))),
    solution: EXTRA,
    hints: [
      'Grupą jest sama instytucja: `group_by(instytucja)`.',
      'Procent ufających to `mean(zaufanie >= 4) * 100` w `summarise()`, a na końcu `arrange(desc(procent))`.',
    ],
    messages: {
      'missing.pivot_longer': 'Zacznij od złożenia instytucji: `pivot_longer(sad:media, ...)`.',
      fraction: 'To ułamki, nie procenty: brakuje `* 100`.',
      bySex: 'Jest podział na płeć, a pytanie jest tylko o instytucje: `group_by(instytucja)`.',
      wrongPercent: 'Instytucje się zgadzają, procent nie. Ufa ten, kto dał 4 albo 5: `mean(zaufanie >= 4) * 100`.',
      order: 'Procenty dobre, ale ranking ma iść od najwyższego: `arrange(desc(procent))`.',
      wrongName: 'Liczby dobre, ale kolumna ma się nazywać `procent`.',
      longShape: 'Liczby są, ale instytucja zajmuje kilka wierszy. Jeden wiersz na instytucję da `summarise(procent = mean(zaufanie >= 4) * 100)`.',
      general: 'Jeszcze nie to: po `pivot_longer()` jest `group_by(instytucja)`, `summarise()` i `arrange()`.',
    },
    success: 'Dobrze. Policji ufa 75%, mediom nikt.',
    note: 'Średnia ze skali 1–5 to umowa: odstępy między odpowiedziami nie muszą być równe. Procent 4–5 tego nie zakłada.',

    nearMisses: [
      { name: 'left fractions', expect: 'fraction',
        code: `${LONG} |> group_by(instytucja) |> summarise(procent = mean(zaufanie >= 4)) |> arrange(desc(procent))` },
      { name: 'split by sex as well', expect: 'bySex',
        code: `${LONG} |> group_by(plec, instytucja) |> summarise(procent = mean(zaufanie >= 4) * 100)` },
      { name: 'counted only the fives', expect: 'wrongPercent',
        code: `${LONG} |> group_by(instytucja) |> summarise(procent = mean(zaufanie > 4) * 100) |> arrange(desc(procent))` },
      { name: 'named the percent differently', expect: 'wrongName',
        code: `${LONG} |> group_by(instytucja) |> summarise(ufa = mean(zaufanie >= 4) * 100) |> arrange(desc(ufa))` },
      { name: 'counted trust and stopped at the pairs', expect: 'longShape',
        code: `${LONG} |> count(instytucja, ufa = zaufanie >= 4) |> group_by(instytucja) |> mutate(procent = n / sum(n) * 100)` },
      { name: 'did not rank', expect: 'order',
        code: `${LONG} |> group_by(instytucja) |> summarise(procent = mean(zaufanie >= 4) * 100)` },
    ],

    diagnose({ value, result }) {
      if (!value || !isDataFrame(value)) return 'general';
      if (result?.reason === 'missing-call') return `missing.${result.detail.name}`;
      const names = (getNames(value)?.values || []).map(String);
      if (names.includes('plec')) return 'bySex';
      const inst = colOf(value, 'instytucja').map(String);
      if (new Set(inst).size < inst.length) return 'longShape';
      const near = (x, y) => Math.abs(x - y) < 0.5;
      const rightAt = (p) => near(p[inst.indexOf('policja')], 75) && near(p[inst.indexOf('sad')], 37.5) && near(p[inst.indexOf('media')], 0);
      let pct = colOf(value, 'procent');
      // The percent under another name: the only other number column.
      const other = names.filter((nm, i) => nm !== 'instytucja' && nm !== 'n' && nm !== 'srednia' && value.values[i].type === 'double');
      if (!pct.length && other.length === 1) {
        const p = colOf(value, other[0]).map(Number);
        if (rightAt(p)) return 'wrongName';
        pct = p;
      }
      if (!pct.length || inst.length !== 4) return 'general';
      const p = pct.map(Number);
      if (p.every((x) => x <= 1)) return 'fraction';
      return rightAt(p) ? 'order' : 'wrongPercent';
    },
  },
};

export default battery;

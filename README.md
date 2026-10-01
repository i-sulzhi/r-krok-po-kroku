# R krok po kroku

An interactive, self-contained HTML trainer that teaches R to humanities students by
**drawing what the interpreter actually does** -- and by letting them point at any
piece of code to see it.

Ships as a single `dist/r-trainer.html` file: no install, no server, no internet.
The interface is in Polish, the course language. Published for students on GitHub
Pages (see *Publishing* below).

## In the lab

The course runs in a shared computer lab, so the trainer opens on **"Kim jesteś?"**:
each student types a name or nickname, and their progress, saved code and place are
kept under it, in that browser only. The next student types theirs and starts clean;
a returning student clicks their name and continues. Nothing is sent anywhere.

The teacher sees progress only when a student hands it in: **"Raport dla
prowadzącego"** in the lesson menu produces a plain-text report (per lesson:
finished and when, checks, hints, whether the solution was opened) with a check code
at the end. The student pastes it into Moodle, Teams or an e-mail. To check reports,
the teacher opens the site and clicks **"Prowadzący? Sprawdź raport studenta"** under
the names (no name needed), then pastes one report after another: each verdict appears
as soon as the text is pasted. The code stops hand edits, not a student who reads
JavaScript (D17).

After the last lesson, **"Dalej w RStudio"** (also in the menu) names what changes in
real RStudio: a script, the student's own survey read with `read.csv2()`, packages,
and R's commonest messages in English with what to do about each (D18).

## The core idea

Most R tutorials show `code -> result`. The hard parts of R for a beginner happen
*between* those two: type coercion, vector recycling, the logical mask inside `[ ]`,
factor codes under the labels, a grouped `summarise()` running once per group.

So the engine is built inside-out: a small R interpreter where every internal step
emits a trace event, and every sub-expression's value is recorded. The interface is
the code itself:

```
source -> lexer -> parser -> AST -> evaluator ==(events + values)==> stage
                                                                        ^
                         the student points at a piece of code ---------+
```

Click `20` in `oceny * 20` and the stage says a single number is a vector of length
one. Click `*` and the stage animates the eight pairs, with one line fanning out from
the reused `20` (marked `×8`). Click `mean(wiek)` inside a grouped `summarise()` and
the stage shows it ran three times, once per city, each time on that city's rows.
Every picture is drawn from what actually ran -- nothing is re-implemented in the UI.

## Why not WebR?

[WebR](https://webr.r-wasm.org/) runs the real R in WebAssembly. It was rejected as the
foundation because it is a black box: it can tell you that `c(1, "a")` is `c("1", "a")`,
but not *when and why* the double became a character, and not what each piece of an
expression was worth. It also costs ~30 MB of download, which breaks the "one file,
open it offline" requirement.

Trade-off accepted: the trainer supports a **curated subset of R**, defined by the
curriculum (`docs/curriculum.md`); unsupported syntax fails with a plain message.
Real R is still used -- as a **test oracle**: the same snippets run through the system
`Rscript` and the printed output is diffed against ours.

## A lesson

Each lesson is 2-5 **scenes**, a sandbox, and a task:

- **Scene** -- one sentence, and live code with the key expression already selected
  and the next thing to click pulsing. The student can edit the code; the picture
  follows. "Kolejność R" steps through the evaluation order, inside out.
- **Twoja kolej** -- the student's own code, plus one-click variants.
- **Zadanie** -- make R produce the goal shown next to the prompt. The student's
  result is drawn beside it with the differing cells outlined; wrong answers get a
  diagnosis of their *shape* ("one row instead of three: `group_by()` is missing").

Reading before the task: about 270 characters per lesson (it was 1 700).

## Layout

```
src/
  core/     value model, lexer, parser, environments, evaluator, printing, builtins
  trace/    trace events (events.js) and the evaluation log (evallog.js)
  ui/       shell, code box, live code, lesson view, the glossary panel ("Ściąga")
  ui/viz/   the stage and its pictures: vectors, factors, tables, elementwise,
            coercion, choosing, funnels, pipelines, dplyr verbs, regex, memory
  lessons/  curriculum content as data
  i18n/     every visible string, in Polish
test/       R-oracle differential suites + behaviour, lessons, pictures, glossary, bundle, i18n
build.mjs   bundles everything into dist/r-trainer.html
```

## Status

**Thirteen lessons**, one connected path from the first value to a defensible summary
table:

| # | Lesson | What the student sees |
|---|---|---|
| 1 | Od arkusza do wektora | the survey as a spreadsheet; one column lying down as a vector, D2 becoming [1]; `c()`, the bracket number, `length()` |
| 2 | Typy i cicha konwersja | a sheet column keeps a type per cell; in R one text cell turns the whole row amber |
| 3 | Działania na całym wektorze | `=D2*20` dragged down eight rows beside one `oceny * 20`; the reused 20 fanning out |
| 4 | Braki danych: NA | the sheet's AVERAGE silently skipping blanks beside R's NA; `na.rm` striking it out |
| 5 | Wybieranie elementów | chosen cells lifted into the result; TRUE/FALSE over every cell |
| 6 | Etykiety kategorii: factor() | a 1-5 survey scale: each answer's word stands on its digit; the codebook keeps the answer nobody chose |
| 7 | Tabela danych: data.frame | a column lit and pulled out by `$`; rows kept by a mask |
| 8 | filter() i potok | the TRUE/FALSE/NA behind every row; the NA row vanishing |
| 9 | select() | columns fading; one column is still a table, `pull()` makes a vector |
| 10 | mutate() | a column appearing; one value filling every row; an overwritten column |
| 11 | arrange() | rows moving with their origin numbers; NA sinking to the bottom |
| 12 | group_by() + summarise() | the split into coloured blocks, the collapse, `mean()` once per group |
| 13 | n() i count() | respondents are not answers -- and the counts must add up |

Verified in eleven suites (see `docs/testing.md`):

| Suite | Result |
|---|---|
| `diff-syntax` -- parse trees vs. R's own parser | 31/31 |
| `diff-eval` -- console output vs. real R, at 80 columns and narrower | 109/109 |
| `diff-paired cases-dplyr` -- our dplyr vs. base-R equivalents | 31/31 |
| `diff-paired cases-stringr` -- our stringr vs. base-R equivalents | 27/27 |
| `behaviour` -- trace payloads, evaluation log, diagnosis, Polish, robustness | 41/41 |
| `lessons` -- every scene, chip, solution and near-miss runs; text budgets | 216/216 |
| `pictures` -- every sub-expression of every lesson drawn headlessly | 1 149 + 68 goal comparisons, 0 problems |
| `glossary` -- "Ściąga": concepts found and labelled on real code, never the solution | 119/119 |
| `people` -- names keep progress apart; the report and its check code | 27/27 |
| `bundle` -- the built file boots and walks every lesson step | 75 steps + 9 shared-computer checks, 0 problems |
| `i18n-coverage` -- every key used and present, plurals inflected | 527 keys |

Plus a browser walk of the built file -- every step of every lesson and every
sub-expression on it (274 visits), every task solved through the interface -- and
visual checks at desktop, narrow-window and phone widths in both colour schemes.

```bash
node test/run-all.mjs
node build.mjs
```

The build refuses to write a bundle containing control bytes or Cyrillic text.

**Course context:** HIFSS.I4.17992.25, *Środowisko R w badaniach socjologicznych*
(Informatyka Społeczna, semester 3). The trainer covers topic 1 directly, topics 2
and 10 visually, and underpins the rest by making base-R mechanics visible
(`docs/decisions.md`, D8).

**Next:** the remaining lessons (`docs/curriculum.md` lists 40 in 8 modules) --
level order and frequency tables, functions and loops, and the stringr module.

Architecture record: `docs/decisions.md` (D1-D21).

## Publishing

`.github/workflows/pages.yml` publishes the trainer on GitHub Pages: on every push to
`main` it runs the suites that need only Node, builds `index.html` and deploys it. A
failing suite stops the deploy. The three R-oracle suites (`diff-*`) need a local R
and are run before pushing:

```bash
node test/run-all.mjs
```


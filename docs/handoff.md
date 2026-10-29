# Handoff: R krok po kroku

The one document to read when a new session picks up the trainer. It records what was
built, every change (as an index of the decision log), how the author and Claude work
together, and what was learned from 2026-08-19 to 2026-10-26.

The detail lives elsewhere and is linked, not copied: `README.md` (what the trainer is),
`docs/decisions.md` (D1-D88, one record per change), `docs/curriculum.md`,
`docs/testing.md`, and the skill `~/.claude/skills/interactive-lecture/` (the lessons
distilled so they work for any subject).

## Contents

1. Resume in a new session
2. The project on one page
3. History
4. Every change: the decision index
5. State on 2026-10-26
6. How the author and Claude work
7. Release procedure
8. Lessons learned
9. Gotchas
10. Open threads

## 1. Resume in a new session

**Where things are**

- Code: `/Users/sulzhytski/Documents/nexus/code/r_visual_trainer` (a git repo; the
  nexus root around it is not).
- Repo: `github.com/i-sulzhi/r-krok-po-kroku`, branch `main`. Commits use the noreply
  address `265264209+i-sulzhi@users.noreply.github.com` (repo-local git config). `gh`
  is logged in through the keyring.
- Live site: https://i-sulzhi.github.io/r-krok-po-kroku/ . Every push to `main` runs
  the Node suites in `.github/workflows/pages.yml` and redeploys; a failing suite stops
  the deploy.
- Local preview: `.claude/launch.json` at the nexus root has the server `r-trainer`
  (python `http.server` on port 8127). Open
  `http://localhost:8127/dist/r-trainer.html` after `node build.mjs`.

**Read in this order**

1. This file, sections 5, 6 and 9.
2. `README.md`: the exercise table and the suites.
3. The last ten records of `docs/decisions.md` (D79-D88): the current way of working
   on lecture 4.
4. Before designing an exercise: `~/.claude/skills/interactive-lecture/SKILL.md` and
   `references/pitfalls.md`.

**Check the ground before changing anything**

```bash
cd /Users/sulzhytski/Documents/nexus/code/r_visual_trainer
git status --short
git log --oneline -3
node test/run-all.mjs
node build.mjs
```

On 2026-10-26 this gave: a clean tree apart from the never-commit files (section 9),
last commit `8c85c30` (D88), all thirteen suites green. The three `diff-*` suites need
the local R (`Rscript`); dplyr, tidyr, stringr and ggplot2 are not installed in it, so
those packages are checked against base-R equivalents.

**Conversation rules in force**

- Talk to the author in Russian. Code, docs, commit messages in English. Student text
  in Polish.
- Plain style everywhere: short sentences, no em dashes, no colon-heavy "Term:
  explanation" phrasing.
- Fix only after the author says "делай" (or "да, делай все N"). Commit and push only
  after "отправляй" (typed in the wrong layout it arrives as "jnghfdkzq").

## 2. The project on one page

**What.** An interactive, single-file HTML trainer that teaches R to sociology students
by drawing what the interpreter does. The student clicks any piece of code and a picture
shows what that piece did, drawn from what actually ran. It opens offline, from disk,
with no install and no network.

**For whom.** Course HIFSS.I4.17992.25 *Środowisko R w badaniach socjologicznych*
(Informatyka Społeczna, semester 3, 30 h lab), taught by dr Ilya Sulzhytski (Polish:
Ilia Sulżycki), the author. Claude is the builder and co-author. Students work in a
shared computer lab and alone at home. The first group already knew vectors and data
frames; factors, dplyr and ggplot2 were new to them.

**How it works.**

- A custom R interpreter in JavaScript (not WebR, D1). Every internal step emits a
  trace event, and the value of every sub-expression is logged (D2, D11). Pictures are
  drawn from that log, so any code the student types gets a correct picture.
- A curated subset of R: base R, factors, data frames, dplyr, tidyr (pivots, missing
  values), joins, stringr, ggplot2 (bars, histogram, boxplot, points, lines, text,
  facets, manual scales). Anything outside it fails with a plain Polish message.
- Real R is the test oracle: the same code runs in `Rscript` and the printed output is
  compared line by line.
- Lessons are data (`src/lessons/*.js`): 2-7 scenes, a sandbox with chips, a checked
  task with diagnosed near-misses, sometimes an optional "dla chętnych" task.
- Polish only (D9). Every visible string is in `src/i18n/`.
- Students type a name on "Kim jesteś?"; progress stays in that browser. A report with
  a check code goes to the teacher; the same report restores progress on another
  computer (D17, D36). No server, for data-protection reasons.

**Size on 2026-10-26.** 32 exercises in four lectures; 88 decisions; 59 commits; 1033
i18n keys; a 1.1 MB bundle of 87 modules.

| Lecture | Exercises | Topic |
|---|---|---|
| 1. Podstawy R | 1-10 | vectors, types, NA, picking, factors (four exercises), data.frame |
| 2. dplyr | 11-17 | filter and the pipe, select, mutate, arrange, group_by + summarise, count, a question to a table |
| 3. Szybkie analizy | 18-24 | if_else / case_when, percentages, pivot_wider, pivot_longer, left_join, missing data, a question to a report |
| 4. ggplot2 | 25-32 | first plot, geom_bar vs geom_col, fill, bar order, kinds of plot, facets, a plot for a report, a plot step by step |

**Source map.**

```
src/core/      value model, lexer, parser, evaluator, printing
src/core/builtins/   base R, dplyr, tidyr, stringr, ggplot.js (plot engine)
src/trace/     trace events and the evaluation log
src/ui/        shell, code box, live code, lesson view, people, report, Ściąga
src/ui/viz/    stage pictures; focus.js (captions), plot.js (plot renderer)
src/lessons/   one file per exercise; index.js holds the order
src/i18n/      pl.js (lessons, captions), pl-ui.js (interface, plot captions)
test/          13 suites, run by test/run-all.mjs
build.mjs      one HTML file; refuses control bytes and Cyrillic
```

## 3. History

Dates are from the session transcripts and `git log`. The project became a git repo on
2026-10-01; before that, rollback points are tarballs in `.snapshots/`.

**2026-08-19 to 08-26: the engine.** The author asked for an interactive HTML trainer
for humanities students that does more than teach: it shows what R does. The syllabus
PDF set the scope. Built: the tracing interpreter, the oracle diff against real R, the
modular source with a single-file build, and Polish plus Russian texts (D1-D8). Tested
"as a student" several times.

**2026-09-24 to 09-25: the visual redesign.** The author: "less text, more
visualisation; Polish text, same context; the student should look, click the code and
understand". Russian was removed (D9), the code became the interface (D10), the engine
started logging every sub-expression (D11), and a lesson became a few scenes plus a
sandbox and a task (D12). Reading before a task fell from 1 700 to 270 characters. The
factor lesson, "too abstract", got realistic survey data (a 1-5 rating scale). The
work was then distilled into the skill `interactive-lecture`.

**2026-09-29 to 09-30: the spreadsheet anchor.** For first-time programmers, lessons
1-4 start from the survey drawn as a spreadsheet they know: a column lies down as a
vector. Em dashes left all student text, enforced by tests.

**2026-10-01: ready for the lab, and published.** The "Ściąga" glossary beside every
step (D15). The shared lab computer: saved answers are offered, not filled in (D16).
"Kim jesteś?", progress per name, and the teacher's report with a check code (D17).
A walk as a student and as a teacher found bugs the suites missed. "Dalej w RStudio"
(D18). Published on GitHub Pages. The same day the author reviewed lesson by lesson
(factors, data.frame, filter, dplyr, sandbox and tasks, Ściąga, the report), and each
review shipped (D19-D26).

**2026-10-03 to 10-05: factors, dplyr, exercises.** The group knew vectors and data
frames already, so factors got four exercises opening with a code-free questionnaire
(D27, D28). Each dplyr verb opens with its table before and after, and a closing
exercise chains them (D29). The pipe is taught as a way to read nested calls (D30).
Phone fixes (D31, D32). Units became "exercises" grouped under lectures (D33). The
oral script for the teacher was written (kept out of git). Lecture 3 began (D34).

**2026-10-06 to 10-10: lecture 3 built one exercise at a time.** A student walk of
the live site found engine faults no lesson touched (D35). The report also restores
progress on another computer (D36). Exercises 19-23: percentages, pivot_wider,
pivot_longer, left_join, a question to a report (D37-D40, D43). Optional "dla
chętnych" tasks (D41). More group_by examples (D42), a task telling group_by from
arrange (D44). Lecture texts in Polish for the teacher (`docs/wyklad-*.md`, untracked).

**2026-10-10 to 10-12: ggplot2 arrives.** Two lab meetings had gone to lectures 1 and
2, which left room for plots. Lecture 4 started with five exercises and a plot engine
(D45), plus fixes found on the live site (D46-D48) and a plot task "dla chętnych" in
exercise 23 (D49).

**2026-10-14 to 10-16: the standing review.** "Why a function exists, before how"
(D50-D53). Then the author's standing request, "check exercise N as a second-year
student", ran through exercises 18-25 (D54-D63). Lecture 3 was read as one story
(D64), got a missing-data exercise before the report (D65, D66), was read whole as a
student and an expert (D67) and walked on the live site (D68). An empty table now
prints as R prints it (D69).

**2026-10-19: the over-explaining correction.** Students understood wide tables but not
why long ones. The first rework added too much; the author's intuition was simpler:
"one grouped vector is easier than four vectors". Exercise 21 was rebuilt on that
(D70-D74). Result chips fit their code line (D75).

**2026-10-21: reflection.** The whole dialogue was analysed and the lessons went into
the skill and the memory `teaching-one-idea`. Lecture 4 was re-read with the one-idea
lens (D76); exercise 25 read as a student (D77).

**2026-10-22 to 10-26: lecture 4 grows to eight exercises.** Exercise 26 reviewed
(D78). A plot built step by step, with a strip naming what each step added (D79). A
full live walk of lecture 4 as a student, an expert, and every button (D80). Other
kinds of plot (histogram, boxplot, points, line) as exercise 29 (D81) and panels with
`facet_wrap()` as exercise 30 (D82), both at the author's request so plots are not
only bars. Settings such as `vjust = -0.5` explain themselves (D83). Why `aes()` exists
(D84). Exercise 29 reviewed (D85). In exercise 27 the same word `fill` in three, then
four, places of the code (D86, D87). In exercise 29, why `colour` and not `fill`
colours a line (D88).

## 4. Every change: the decision index

Every change to the trainer since the redesign has one record in `docs/decisions.md`:
what was decided, why, what was verified, what was left out on purpose. This index is
generated from those headings and the commit log. Work before 2026-10-01 is in the
initial commit. Read the record itself before changing what it describes; some
records are superseded in part by later ones (D7 by D9, the layout of D15 by D23, the first rework
of exercise 21 in D70 by D74).

**The engine (2026-08)**

| # | Decision | Commit |
|---|---|---|
| D1 | Own interpreter, not WebR | 679b50a (initial commit, 2026-10-01) |
| D2 | Events carry data, never prose | 679b50a (initial commit, 2026-10-01) |
| D3 | Immutable values, explicit copies | 679b50a (initial commit, 2026-10-01) |
| D4 | Eager argument evaluation | 679b50a (initial commit, 2026-10-01) |
| D5 | Verified against real R, not against intuition | 679b50a (initial commit, 2026-10-01) |
| D6 | Modular source, single-file delivery | 679b50a (initial commit, 2026-10-01) |
| D7 | Two languages, keys not sentences *(superseded in part by D9)* | 679b50a (initial commit, 2026-10-01) |
| D8 | Scope follows the syllabus, and stops where honesty requires | 679b50a (initial commit, 2026-10-01) |

**The visual redesign (2026-09-24)**

| # | Decision | Commit |
|---|---|---|
| D9 | Polish only | 679b50a (initial commit, 2026-10-01) |
| D10 | The code is the interface | 679b50a (initial commit, 2026-10-01) |
| D11 | The engine records what every sub-expression was worth | 679b50a (initial commit, 2026-10-01) |
| D12 | A lesson is a few scenes, not four text beats | 679b50a (initial commit, 2026-10-01) |
| D13 | The build keeps every module in its own scope | 679b50a (initial commit, 2026-10-01) |
| D14 | The console prints at the width of its panel | 679b50a (initial commit, 2026-10-01) |

**Ready for the lab, published (2026-10-01)**

| # | Decision | Commit |
|---|---|---|
| D15 | The grammar around a lesson is explained beside it, from its own code | 679b50a (initial commit, 2026-10-01) |
| D16 | A lab computer is shared: saved answers are offered, not filled in | 679b50a (initial commit, 2026-10-01) |
| D17 | Students say who they are; the teacher gets a report they hand in | 679b50a (initial commit, 2026-10-01) |
| D18 | A way out to RStudio, and the first mistake named correctly | 9d805cd (2026-10-01) |
| D19 | The data a lesson uses is created on screen | 036a263 (2026-10-01) |
| D20 | A mask on a table is drawn along its rows | b903b92 (2026-10-01) |
| D21 | filter() decisions live in the table's rows; texts' numbers are tested | 4770cf5 (2026-10-01) |
| D22 | The dplyr lessons, read as a beginner | 73bb678 (2026-10-01) |
| D23 | One scrolling column; the glossary's examples drawn tight | 68b1ae2 (2026-10-01) |
| D24 | Tasks and sandbox, tried with a beginner's answers | b88a7c2 (2026-10-01) |
| D25 | "Ściąga" becomes a cheat sheet | 222a184 (2026-10-01) |
| D26 | The report reads at a glance, and the teacher checks a group at once | 52f326b (2026-10-01) |

**Factors, dplyr, exercises (2026-10-03 to 10-05)**

| # | Decision | Commit |
|---|---|---|
| D27 | Factors are shown before they are typed, and get three lessons | ca69435 (2026-10-03) |
| D28 | Why `levels` exists, and a factor used inside a table | ca69435 (2026-10-03) |
| D29 | Each dplyr verb opens with its table before and after; a closing lesson chains them | fffacc7 (2026-10-04) |
| D30 | The pipe is taught as a way to read nested calls | d43518d (2026-10-04) |
| D31 | On a phone the table's frame follows the new column and shrinks with the table | 02ea302 (2026-10-04) |
| D32 | Row numbers stay in place when the table is scrolled | 19a7b48 (2026-10-04) |
| D33 | The units are exercises, grouped under two lectures | 84efb6c (2026-10-05) |

**Lecture 3 built (2026-10-05 to 10-10)**

| # | Decision | Commit |
|---|---|---|
| D34 | Lecture 3 "Szybkie analizy" starts: recoding with if_else() and case_when() | d585af8 (2026-10-05) |
| D35 | What a walk through the live site as a student found | d5b364d (2026-10-06) |
| D36 | A student's own report brings their progress to another computer | 1c88b62 (2026-10-06) |
| D37 | Exercise 19, percentages; and the verbs learn what a group is | b90aab3 (2026-10-06) |
| D38 | Exercise 20, the cross table; pivot_wider() and its picture | 0a5627c (2026-10-07) |
| D39 | Exercise 21, a battery of questions; pivot_longer() | a6bd880 (2026-10-07) |
| D40 | Exercise 22, two tables; left_join() and its family | 7330086 (2026-10-08) |
| D41 | A second task "dla chętnych" in the exercises of lecture 2 | 7330086 (2026-10-08) |
| D42 | More questions in exercise 15, group_by() and summarise() | dfa8bc2 (2026-10-09) |
| D43 | Exercise 23, from a question to a report | e65b932 (2026-10-10) |
| D44 | A task that tells group_by() from arrange() | e65b932 (2026-10-10) |

**ggplot2 arrives (2026-10-12 to 10-14)**

| # | Decision | Commit |
|---|---|---|
| D45 | ggplot2 in the trainer: lecture 4 | ced1136 (2026-10-12) |
| D46 | "Usuń moje dane" clears the page too | ced1136 (2026-10-12) |
| D47 | Where `sredni_wiek = mean(wiek)` comes from | 4ede791 (2026-10-12) |
| D48 | Groups survive the next verb; `head()` cuts a table by rows | f32ff51 (2026-10-12) |
| D49 | Exercise 23 gets a task for those who want more: draw the report | daf23a8 (2026-10-14) |

**The standing review (2026-10-14 to 10-16)**

| # | Decision | Commit |
|---|---|---|
| D50 | Why a function exists, before how it works (pilot: exercise 18) | daf23a8 (2026-10-14) |
| D51 | `if` on a column: too many answers, not a dropped column | 7aeb39d (2026-10-14) |
| D52 | The `if` scene, simplified | aa5e6d8 (2026-10-14) |
| D53 | Which functions come from a package | 8d3a56e (2026-10-14) |
| D54 | Exercise 18 read as a second-year student | 8d3a56e (2026-10-14) |
| D55 | Exercise 19 read as a second-year student | e4a0fd5 (2026-10-14) |
| D56 | Habits that keep "the first TRUE wins" from biting | e4a0fd5 (2026-10-14) |
| D57 | Exercise 20 read as a second-year student | 44b902d (2026-10-14) |
| D58 | Exercise 21 read as a second-year student | a4d16f7 (2026-10-14) |
| D59 | The trap shown with its repair | a4d16f7 (2026-10-14) |
| D60 | Exercise 22 read as a second-year student | 94d8683 (2026-10-14) |
| D61 | Exercise 23 read as a second-year student | a35eb0c (2026-10-14) |
| D62 | Exercise 24 read as a second-year student; decorated plots are answers | be27257 (2026-10-15) |
| D63 | Exercise 25 read as a second-year student | 12afed9 (2026-10-15) |
| D64 | Lecture 3 as one story: three quick repairs | 12afed9 (2026-10-15) |
| D65 | Exercise 23: missing data, before the report | 12afed9 (2026-10-15) |
| D66 | Exercise 23 read as a second-year student | d46114d (2026-10-15) |
| D67 | Lecture 3 read whole, as a student and as an expert | 785ebd6 (2026-10-15) |
| D68 | Lecture 3 walked on the live site | e4c7b3e (2026-10-15) |
| D69 | An empty table printed as no table | 3540dca (2026-10-16) |

**The over-explaining correction (2026-10-19)**

| # | Decision | Commit |
|---|---|---|
| D70 | Why a long table: a ranking the wide one cannot make | 41f9145 (2026-10-19) |
| D71 | Exercise 21 read again as a student | 4408091 (2026-10-19) |
| D72 | Exercise 20 read as a student | 74ce0a0 (2026-10-19) |
| D73 | Exercise 22 read as a student | 829cd56 (2026-10-19) |
| D74 | Exercise 21: four vectors, one line | 89d4043 (2026-10-19) |
| D75 | A result chip fits its code line | 71a4686 (2026-10-19) |

**Lecture 4 grows (2026-10-21 to 10-26)**

| # | Decision | Commit |
|---|---|---|
| D76 | Lecture 4 read with the one-idea lens | 7c10328 (2026-10-21) |
| D77 | Exercise 25 read as a second-year student | fe7e68a (2026-10-21) |
| D78 | Exercise 26 read as a second-year student | 457be54 (2026-10-22) |
| D79 | Exercise 30, a plot step by step; the strip says what each step added | 457be54 (2026-10-22) |
| D80 | Lecture 4 walked whole: as a student, as an expert, every button | 457be54 (2026-10-22) |
| D81 | Exercise 29: which plot for which question; four more kinds of plot | 457be54 (2026-10-22) |
| D82 | Exercise 30, panels: facet_wrap() | 6211022 (2026-10-23) |
| D83 | Plot settings say what they do | 6211022 (2026-10-23) |
| D84 | What aes() is for | 455a386 (2026-10-26) |
| D85 | Exercise 29 read as a second-year student | 5335379 (2026-10-26) |
| D86 | The third fill | f14c6d9 (2026-10-26) |
| D87 | The fourth fill: a fixed colour over groups | f14c6d9 (2026-10-26) |
| D88 | colour or fill on a line | 8c85c30 (2026-10-26) |

## 5. State on 2026-10-26

**Published.** Commit `8c85c30` (D88) is live; the live file's SHA-256 equals the local
`dist/r-trainer.html`. All 32 exercises were walked on the live site after their last
change, with 0 console errors.

**Exercises and their files** (`src/lessons/index.js` holds the order; numbers are
assigned at load, so a new exercise renumbers the ones after it):

| Lecture | Lesson ids in order |
|---|---|
| 1 | `vectors`, `types`, `vectorised`, `missing`, `subsetting`, `factors`, `levels`, `factorNumbers`, `tables`, `factorTable` |
| 2 | `filtering`, `selecting`, `mutating`, `arranging`, `grouping`, `counting`, `pipeline` |
| 3 | `recoding`, `percentages`, `crosstab`, `battery`, `joining`, `missingData`, `reporting` |
| 4 | `plotFirst`, `plotCount`, `plotFill`, `plotOrder`, `plotTypes`, `plotFacets`, `plotReport`, `plotBuild` |

These are the exported names; the `id` inside each file is kebab-case (`plot-types`),
and that is what `openLesson()` and `{ćw:id}` cross-references use.

**Suites** (`node test/run-all.mjs`):

| Suite | Result |
|---|---|
| syntax (parse trees vs R) | 31/31 |
| eval (console output vs R) | 150/150 |
| paired dplyr / stringr / ggplot vs base R | 154/154, 27/27, 84/84 |
| behaviour | 67/67 |
| lessons | 854/854 |
| pictures | 7 216 sub-expressions, 51 survey pictures, 43 table stages, 380 goal comparisons, 0 problems |
| plots | 227/227 (519 drawings, 163 plots from the lessons) |
| glossary | 314/314 |
| people | 46/46 |
| bundle | 242 steps, 14 extra tasks, 11 shared-computer checks, 0 problems |
| i18n | 1 033 keys, all used and present |

**Review status.** Lectures 3 and 4 were reviewed exercise by exercise "as a
second-year student" (D54-D63, D66, D71-D73, D77, D78, D85) and each as a whole, as a
student and as an expert, on the live site (D67, D68, D80). Exercise numbers in older
records are the numbers of their day: inserting the missing-data exercise (D65) and
the plot exercises (D79, D81, D82) shifted the ones after them. Lectures 1 and 2 were
reviewed lesson by lesson on 2026-10-01 to 10-04, before that review format existed.

**Files outside git, on purpose.**

- `docs/oral-script.md`, `docs/oral-script-basics.md`: the teacher's oral script
  (listed in `.git/info/exclude`). Covers lectures 1 and 2.
- `docs/wyklad-2-dplyr.md`, `docs/wyklad-2-tekst.md`, `docs/wyklad-3-analizy.md`,
  `docs/wyklad-3-tekst.md`: lecture notes and textbook-style texts in Polish for the
  teacher. Untracked; never `git add` them.
- `srodowisko-r-w-badaniach-socjologicznych-hifss-i4-17992-25-6.pdf`: the syllabus.
- `.snapshots/`: tarball rollback points from before git (gitignored).
- `dist/`: the build (gitignored; CI builds its own copy).

Lecture 4 has no teacher text yet (see section 10).

## 6. How the author and Claude work

The author is the domain expert and the final judge of pedagogy. Claude builds, reviews
first, and verifies. The author often sends short commands; this is what they mean.

| The author says | What happens |
|---|---|
| "проверь упражнение N как студент второкурсник" | Read every scene sentence, caption, chip and message of exercise N. Click the code. Type 10-20 plausible answers through the page's own check: other right routes, what lecture 1 taught (`table()`, `$`), real functions the trainer may lack, typos, the commonest slip. Report numbered findings (clear / unclear / misleading message / right answer refused / engine fault), each with a proposal. Change nothing yet. |
| "да, делай все N" / "делай" | Make exactly the proposals approved, add tests, run all suites, build, check in the local browser, write the D-record, update README if counts changed. Report, and wait. |
| "отправляй" (or "jnghfdkzq") | The release procedure (section 7), ending with a walk of the changed exercises on the live site. |
| "отправляй и сразу проверка на живом сайте" | The same; the live walk is the point. |
| "проверь лекцию как студент и как эксперт" | The whole lecture as one story: does each exercise need the one before, is anything taught twice or never. Then usability: every button, phone width. |
| "сделай текст лекции" / "обнови конспект" | Polish text for the teacher in `docs/wyklad-*.md`, plain style, every code example run through the engine. Not committed. |
| A screenshot with one line ("тут иконка наслоилась") | A visible defect: fix it, measure it in the browser, report. No proposal round. |
| "мне кажется стало сложнее", "давай подумаем как упростить" | A pedagogy change: propose the one-sentence idea and what will be cut, wait for an answer. |

**What the author asks for again and again**

- Say what a new function is for, and instead of what, before how it works.
- Show the problem before its cure: what goes wrong without `levels`, without `c()`.
- Open every exercise with a research question and a before-and-after picture.
- Show a trap together with its repair, and name the good habit in one line.
- Accept right answers written another way (rounding, extra columns, decorations,
  an equivalent function).
- Concrete survey data from sociology, not `x` and `y`.
- Few words. Basics go into the "Ściąga" glossary, not into extra scenes.
- When the author offers an intuition ("one grouped vector is easier than four"),
  build exactly that, in its plainest form.

**Language and style.** Russian with the author; English in code, docs, commits; Polish
for students. No em dashes and no colon-heavy phrasing anywhere the author or students
read. Name things, use real numbers, keep sentences short. The author is a sociologist
and teaches the course; explain engine matters in plain words.

**Autonomy.** The author has twice asked for long unattended runs ("не останавливайся
пока не дойдешь до финального результата"). Then: fix what can be fixed on the way,
keep a list, and stop with a summary at the agreed bar. Publishing still
waits for "отправляй" unless the request itself says to publish.

## 7. Release procedure

Only after "отправляй". Every step, every time.

1. **All suites and the build.** `node test/run-all.mjs` (needs local R for the three
   `diff-*` suites), then `node build.mjs`.
2. **Stage by name, never `git add .` or `-A`.** List the changed files from
   `git status --short` and add only those. The untracked teacher files and the
   syllabus PDF (section 5) must stay out.
3. **Scan the diff for secrets** before committing: `git diff --cached | grep -iE
   "(api[_-]?key|token|secret|ghp_|sk-[a-z0-9]{10}|password)"`. Abort on any hit.
4. **Commit** with a plain English subject that names the exercise and the D-record,
   ending with the attribution line the session asks for. Push to `main`.
5. **Wait for the deploy**: `gh run list --limit 1`, then `gh run watch <id>
   --exit-status`.
6. **Compare the live file with the build**: the SHA-256 of
   `curl -s https://i-sulzhi.github.io/r-krok-po-kroku/` must equal that of
   `dist/r-trainer.html`.
7. **Walk the changed exercises on the live site** in the built-in browser:
   - type a test name ("Test D88") on "Kim jesteś?";
   - drive the page through `window.app`: `openLesson(id, { step })`,
     `lessonView.goTo(n)`, `lessonView.live.select(node)`, click `.ls-chip`
     elements, type into the task textarea and call `lessonView.check()`;
   - read captions and messages as text, then look at one screenshot;
   - check the console for errors;
   - for layout changes, also at 375 px width with the chip audit (every result chip
     within its line and reachable).
8. **Clean up.** Menu "Usuń moje dane z tego komputera" → "Tak, usuń". Remove the
   anonymous keys `r-trainer.place.*:anon` and `r-trainer.progress.*:anon`. Never
   touch other projects' keys on the same origin (`liczby-z-internetu.people.v1`,
   `analiza-trendow.people.v1`). Reset the viewport if it was changed.
9. **Report** in Russian: what is live, which commit, what was checked on the live
   site, what could not be checked.

## 8. Lessons learned

The general form of these lessons is in the skill `interactive-lecture` (SKILL.md and
`references/pitfalls.md`, about 90 defects with the rule that prevents each). Here they
are as they happened in this project.

### 8.1 Pedagogy

- **One idea per exercise, and my fixes add ideas.** Twice the author said an exercise
  "got harder" after my rework: the `if` scene in exercise 18 (four lines, an error and
  a long diagnosis; D50-D52) and the battery in exercise 21 (vector picking, a subtle
  `arrange()` point, six institutions, missing ratings, sixteen near-misses; D70-D74).
  Both times the fix was the author's own plainer intuition. Before any pedagogical
  change, write the idea in one sentence and list what is cut. Count ideas afterwards.
- **A cost the learner can count beats an argument.** Four lines of `mean()` against
  one; a nested call read inside out against the same chain with `|>`; `if` for one
  person against `if_else()` for eight rows.
- **The question must need the tool.** A wide summary answered "which institution is
  trusted most" at a glance, so it could not motivate long tables. A ranking that
  differs between women and men could (D70, D74).
- **Problem before cure.** The author could not see why `levels` exists until the
  exercise showed what goes wrong without it (D28).
- **Code-free first contact.** Factors open with a questionnaire beside what R holds;
  dplyr verbs open with one table before and after (D27, D29). Students know surveys
  and spreadsheets; start there.
- **A trap is shown with its repair**, and the habit gets one line ("the narrowest
  condition first", D56, D59). A trap alone teaches the trap.
- **Right answers written another way are accepted.** A refused right answer costs
  trust: decorated plots (D62), rounding, an extra `n`, `paste0` labels (exercise 31).
  But a wrong idea that happens to look right is refused: a fixed `fill` over groups
  passed as "the same plot" until D87.
- **The same word in different places means different things.** `fill` inside
  `aes()`, in `geom_bar(fill = ...)`, in `scale_fill_manual()` and on a line (D84,
  D86-D88). Showing them side by side taught more than any sentence.
- **Moving material keeps exercises small.** Missing values moved out of exercise 21
  into the missing-data exercise; `coord_flip()` and colour scenes became chips;
  basics went to "Ściąga" instead of scenes.

### 8.2 Engine and checking

- **The trainer must behave like the real package, including where the package
  surprises.** Until D88 the engine coloured lines by `fill`, which real ggplot2 does
  not. The lessons looked fine; the engine taught a falsehood. When a lesson leans on
  a behaviour, check it against the package documentation, and say in the record when
  the package itself could not be run.
- **Probe what a beginner types, not what lessons contain.** A student walk found that
  one `=` in `filter()` and verbs ignoring `group_by()` were broken though every
  lesson passed (D35, D37). For a new verb: grouped, with NA, with a typo, with `=`
  for `==`, the column in quotes, the wrong letter case.
- **An error belongs where R raises it.** Too few colours in `scale_fill_manual()` was
  thrown while drawing and crashed the task check; R complains when the plot is
  built, so it moved to the `+` (D86).
- **Strict and lenient comparisons are different functions.** `plotsMatch` (is this
  an acceptable answer) and `plotsEqual` (is this the same plot) were once changed
  together by one edit; a plots test caught it.
- **Captions must be true in context and in both themes.** "Both lines are black" was
  true in the light theme and false in the dark one, where the ink is white (D88).
  Name colours only when the picture really has that colour.
- **Every number in a text is a tested fact.** A success message once said 4 where the
  data gave 5. Numbers in captions, messages and success lines are listed with the
  code that computes them (`FACTS` in `test/lessons.mjs`).
- **Text budgets are enforced** (`BUDGET` in `test/lessons.mjs`: title 32, scene 90, prompt 130, hint 110, message 130, success 60, note 120) and
  each overflow was a sign that a sentence carried two ideas.

### 8.3 Verification

- **Suites pass, the browser still finds things.** The pre-publish walk as a student and
  as a teacher found a solved task wiping its code and a teacher unable to reach the
  check without inventing a name (2026-10-01). A CSS class name (`gp-box`) collided
  with a container rule and only the browser showed it (renamed `gp-bp-box`). An
  overlapping table icon reached the live site and the author spotted it on a
  screenshot. Walk the built file every time pictures or layout change.
- **Mutation-check every new guard once.** Restore the old behaviour and watch the new
  test fail (D88: restoring `linesOnly ? (colourAes || fillOnly) : fillOnly` fails the
  plots test). A check that cannot fail is decoration. Run the mutation with the right
  path: a quoted wrong path once gave "0 failures" for the wrong reason.
- **The live site is checked, not assumed.** Hash equality first, then a walk of the
  changed exercises, then cleanup of the test person.
- **Look in both themes.** The dark theme exposed the colour-name caption (D88).
- **Phone width is measured, not eyeballed**: paired arrows and their cards, the facet
  thumbnail in a code chip, result chips inside their line (D75, D80).

### 8.4 Process

- **One exercise at a time, shown before the next.** A whole lecture built in one go
  repeats one mistake N times. Lecture 3 was built this way; lecture 4's first five
  exercises were not, and needed the one-idea re-read (D76).
- **Proposal, then "делай", then "отправляй".** Pedagogical changes are proposed with
  the one question that needs the author. Visible defects are fixed directly.
- **The decision log is the project's memory.** Every change gets a D-record (what,
  why, verified, left out). Sessions run out of context; the log and this handoff are
  what survive.
- **Teacher materials drift.** The oral script and lecture texts describe exercises;
  when an exercise changes, they go stale. They were refreshed on request ("обнови
  конспект"), not automatically.
- **Reflection pays.** On 2026-10-21 the author asked what was learned; the result
  (the skill update and the memory `teaching-one-idea`) changed how lecture 4 was
  reviewed.

### 8.5 My recurring mistakes, to watch for

- Adding an explanation, scene, trap or message when asked for clarity.
- A clever, true argument where the author's simple one was enough.
- Captions that are right in general and wrong here (a colour name, "alphabetical"
  where the order was set by hand, "a trap" where the conversion is correct).
- Editing two similar functions with one replacement (`plotsMatch` and `plotsEqual`).
- Throwing an error at draw time that belongs at build time.
- Trusting the scratchpad across days: it is cleared; recreate helper scripts or use
  inline `node -e`.
- Forgetting the dynamic i18n prefixes (`fx.gg.legend.`, `fx.arg.`) when adding keys
  built at run time; the i18n suite then reports them as unused or missing.

## 9. Gotchas

- **Never `git add`** `docs/wyklad-2-dplyr.md`, `docs/wyklad-2-tekst.md`,
  `docs/wyklad-3-analizy.md`, `docs/wyklad-3-tekst.md`, the syllabus PDF, or
  `docs/oral-script*.md`.
- **Never touch other projects' localStorage keys** on the same origin
  (`liczby-z-internetu.people.v1`, `analiza-trendow.people.v1`). The trainer's own
  keys start with `r-trainer.`.
- **The R oracle has no tidyverse.** dplyr, tidyr, stringr and ggplot2 are compared
  with base-R equivalents (`test/cases-*.txt`); ggplot2 behaviour that base R cannot
  express is taken from the package documentation and said so in the D-record.
- **Run the oracle under `LC_ALL=en_US.UTF-8`**, or Polish strings come back escaped
  and every comparison fails for the wrong reason.
- **The build refuses Cyrillic and control bytes.** A Russian word in a comment or a
  string stops it; that is intended (D9).
- **Adding an exercise** touches: the lesson file, `src/lessons/index.js` (order),
  `LESSON_COUNT` in `test/bundle.mjs`, the README table and counts,
  `docs/curriculum.md`, and every hand-written exercise number (use `{ćw:id}`
  cross-references instead).
- **Adding run-time i18n keys** (built from a prefix plus a value) needs the prefix
  declared in `test/i18n-coverage.mjs` (`fx.gg.legend.`, `fx.arg.`).
- **Plot comparisons**: `plotsMatch` is the lenient answer check (decorations allowed,
  bars compared by centre); `plotsEqual` is strict. Both go through `facetsAlike`.
  Edit one at a time.
- **On points and lines only `colour` paints** and gives a legend; `fill` only makes
  groups (D88). A fixed `fill` over groups is not a decoration (D87).
- **The nexus root is not a git repo.** Only this folder is. The scratchpad is cleared
  between days.
- **Test people.** Every browser check creates one; delete it through the menu and
  remove the `:anon` keys, locally and on the live site.

## 10. Open threads

- **Lab 1 in RStudio on ESS Poland** (published 2026-10-29, D89, D90): live at
  https://i-sulzhi.github.io/r-krok-po-kroku/lab/ (page, `lab.R`, `ess_polska.sav`,
  `regiony.csv`, copied to `_site/lab/` by the Pages workflow). Solved as a student
  from the page alone and once in a real RStudio; all answers match the key. The key
  `lab/lab-klucz.R` and `lab/PLAN.md` stay local (answers; the repo is public), the
  ESS download stays in `lab/data/` (gitignored, licensed). Open for the author:
  link `/lab/` directly in Moodle (the menu item sits after 32 exercises), packages
  on the lab computers. Hosting the ESS extract was settled with the author on
  2026-10-29: it stays on the site (CC BY-NC-SA 4.0 allows it; D90).

Nothing is half-done in the code: the tree is clean and the live site matches the
build. What remains is a list of possible next steps, none started.

- **Teacher text for lecture 4.** Lectures 2 and 3 have Polish lecture notes and a
  textbook-style text (`docs/wyklad-2-*`, `docs/wyklad-3-*`); lecture 4 (ggplot2) has
  neither. The lecture 3 text ends by pointing to "the next chapter".
- **The oral script** (`docs/oral-script.md`) covers lectures 1 and 2 and the report.
  It was not extended to lectures 3 and 4.
- **Lectures 1 and 2 never had the "as a second-year student" review** in its current
  form (10-20 typed answers per exercise). The format found something in every
  exercise of lectures 3 and 4.
- **Exercises 30-32 had no single-exercise review** of their own; they were covered by
  the full lecture 4 walk (D80) and later fixes.
- **The look of plots was never laid beside real ggplot2.** Colours are ggplot2's hue
  palette written out by hand, axis breaks are `pretty()` with corrections, the grey
  panel is drawn from memory (`docs/testing.md`).
- **The remaining curriculum** (`docs/curriculum.md`): level order and frequency tables,
  functions and loops, the stringr module. Not requested since lecture 4 began.
- **Deferred on purpose:** a "predict first, then see" mode for the dplyr verbs (raise
  only if the author asks); real accounts with a server (rejected for data protection,
  D36).

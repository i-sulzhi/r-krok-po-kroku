# Curriculum

Supports **HIFSS.I4.17992.25 — Środowisko R w badaniach socjologicznych**
(Informatyka Społeczna, Wydział Humanistyczny, semester 3, 30h laboratory, 2 ECTS).

## How this maps onto the syllabus

The course teaches ten packages in twelve sessions. The trainer is not a substitute
for it: students do the real work in RStudio. What the trainer covers is the layer
*underneath* those packages, which the course has no time to slow down for.

| Syllabus topic | Trainer's role |
|---|---|
| 1. Introduction: R's specifics, "zalety i ograniczenia" | **Covered directly.** Modules 1–3 below *are* this topic |
| 2. tidyverse: data manipulation | **Covered visually.** dplyr verbs are implemented and animated (module 7) |
| 10. stringr: text data | **Covered visually.** stringr is implemented; patterns show what they matched (module 8) |
| 3. RMarkdown · 4. ggplot2 · 5. linear models | Underpinned only: the data reaching them is built with the mechanics taught here |
| 6. caret · 7. QCA · 8. Shiny · 9. RCrawler/rvest · 11. sentiment · 12. topic modelling | **Out of scope, deliberately.** Real RStudio work; simulating them would teach a fiction |

The failures the trainer exists to prevent are the ones that surface *inside*
packages but originate in base R:

- `mutate(x = a / b)` produces nonsense because `a` was imported as a factor
- `summarise(mean(x))` returns NA for a whole group because of one missing answer
- `filter()` silently drops rows where the condition is NA — the respondents vanish
- a new column is filled by recycling instead of erroring

None of these are package problems, and none of them announce themselves.

## Where it fits in the course

The syllabus allocates 20 hours of independent project preparation and requires
`nieobecności wymagają wykonania ćwiczeń`. The trainer serves both: preparation
before a session, and a self-contained way to make up a missed one.

It ends by pointing out of itself. "Dalej w RStudio" (D18) is the bridge to where
the course works: a script, the student's own survey read with `read.csv2()`,
packages, and the English error messages they will meet first.

## Audience

Humanities students working alone, at home, with no instructor present.
That drives three requirements the content must meet everywhere:

1. **Nothing is assumed.** No maths notation, no programming background, no English.
2. **Every error gets a diagnosis**, not just a message. A student stuck at 11pm has
   nobody to ask, so the trainer must recognise the common mistakes by shape and say
   what went wrong in plain language.
3. **Progress is saved.** People leave and come back; a lost session is a lost student.

The order below is driven by *what breaks people's mental model*, not by what is
easiest to implement. Types come before subsetting because half of all subsetting
confusion is really type confusion.

## The glossary beside every lesson

Lessons teach one idea each, but their code leans on grammar nobody stopped to
explain. "Ściąga" (D15) explains that grammar from the code on screen, so lesson 1
can stay about the vector while `<-`, `c()`, `length()`, `$` and `:` each get a card
with their parts labelled. The concepts and where they are first met:

| Lesson | First met there |
|---|---|
| 1 | name, `<-`, function call, `#`, `$`, `:` |
| 2 | text in quotes, `TRUE`/`FALSE` |
| 3 | arithmetic, comparison |
| 4 | named argument (`na.rm = TRUE`), `&` `\|` `!`, `NA` |
| 5 | `[ ]` |
| 8 | `\|>` |

These are exactly what the packages in the syllabus are written in: a dplyr or
ggplot2 call is a function call with named arguments, chained with a pipe, and
naming a column without quotes versus a text in quotes is the first confusion in
both.

## Module 1 -- How R thinks

| # | Lesson | The thing being made visible |
|---|---|---|
| 1 | The console and the first value | `1` is a vector of length 1; the `[1]` in the output is an index, not a line number |
| 2 | Vectors with `c()` | A vector is a row of numbered cells; R counts from 1 |
| 3 | Types, and silent coercion | `c(1, "a")` becomes text. The hierarchy logical -> integer -> double -> character, one-way |
| 4 | Vectorised arithmetic | Operations apply to every cell at once; no loop needed |
| 5 | Recycling | `1:6 + c(10, 20)` reuses the short vector; the warning when lengths do not fit |
| 6 | Missing data (`NA`) | Why `mean(x)` is NA, what `na.rm = TRUE` really removes, and why `NA == NA` is NA |

## Module 2 -- Getting the part you want

| # | Lesson | The thing being made visible |
|---|---|---|
| 7 | Positions: `x[2]`, `x[c(1,3)]` | Index vectors, and why `x[0]` is empty rather than the first element |
| 8 | Dropping: `x[-1]` | A negative index removes, it does not count from the end |
| 9 | Conditions: `x[x > 5]` | The hidden logical vector; the mask is recycled to length(x) |
| 10 | Names | `x["age"]`, and why a missing name gives NA instead of an error |
| 11 | Changing values | `x[1] <- "a"` retypes the whole vector; `x[10] <- 1` grows it with NA. Copy-on-modify |

## Module 3 -- Categories

| # | Lesson | The thing being made visible |
|---|---|---|
| 12 | Factors | A factor is integer codes + a level table. Both layers shown side by side |
| 13 | Level order | Default is alphabetical, not order of appearance; how to set it deliberately |
| 14 | `as.numeric(factor)` | Why it returns codes and not your numbers -- the classic data-loss bug |
| 15 | Frequency tables | `table()` and what it silently drops (NA) |

## Module 4 -- Tables (data.frame)

| # | Lesson | The thing being made visible |
|---|---|---|
| 16 | What a data.frame is | A list of equal-length columns wearing a class; columns are vectors you already know |
| 17 | Columns: `df$x` | `$` vs `[[` vs `[`, and the shape each returns |
| 18 | Rows and filtering | `df[df$age > 30, ]` -- the comma, and the mask over rows |
| 19 | Adding and changing columns | Recycling inside a table; `df$new <- NULL` deletes |

## Module 5 -- Doing it repeatedly

| # | Lesson | The thing being made visible |
|---|---|---|
| 20 | Variables and environments | What `<-` actually does; the environment panel |
| 21 | Writing a function | Arguments, defaults, the new frame, and what the function can and cannot see |
| 22 | Argument matching | By name, by partial name, by position -- and why order stops mattering |
| 23 | Loops | `for` over a vector, and why the result must be stored somewhere |
| 24 | `sapply` instead of a loop | The same work, one line; and when sapply hands back a list instead |

## Module 6 -- Text

| # | Lesson | The thing being made visible |
|---|---|---|
| 25 | Text as data | `nchar`, `toupper`, `substr` counting from 1 and including both ends |
| 26 | Joining and splitting | `paste` vs `paste0`; `strsplit` always returns a list |
| 27 | Finding patterns | `grepl` as a filter over a text column; `gsub` for cleaning |

## Module 7 -- The tidyverse verbs (syllabus topic 2)

Reached only after module 4: every verb is shown as the base-R operation the student
has already seen, so `dplyr` reads as convenience rather than as a second language.

| # | Lesson | The thing being made visible |
|---|---|---|
| 28 | The pipe | `df |> filter(...)` is `filter(df, ...)`. Where the value flows, and why the pipe reads left to right |
| 29 | `filter()` | The same logical mask as `df[df$x > 5, ]` -- plus the crucial difference: filter drops NA rows silently |
| 30 | `select()` | Columns only; rows untouched. Renaming and `-column` |
| 31 | `mutate()` | Recycling inside a table; overwriting a column loses the original |
| 32 | `arrange()` | Rows move, data does not change; NA always sinks to the bottom |
| 33 | `group_by()` | The split -- almost invisible in RStudio, drawn here as coloured blocks |
| 34 | `summarise()` | The collapse: N rows per group become one. Why the other columns disappear |
| 35 | `n()` and counting | Group sizes, `count()`, and checking that the groups add up to the sample |

## Module 8 -- Text with stringr (syllabus topic 10)

| # | Lesson | The thing being made visible |
|---|---|---|
| 36 | `str_*` consistency | String first, pattern second -- the opposite of `grepl(pattern, x)`. Why mixing the two confuses |
| 37 | `str_detect()` as a filter | Combining it with `filter()` over a text column |
| 38 | Patterns | What the pattern actually matched, highlighted in the text. `.` is any character |
| 39 | `str_replace()` and cleaning | Whole-word vs. partial matches, and why `Krak[oó]w` hits "Krakowie" |
| 40 | `str_split()` | Returns a list, one element per input string -- and what to do with it |

## Lesson shape

**Sixteen lessons implemented** (`src/lessons/`), forming a connected path rather
than a scattering: `vectors` -> `types` -> `vectorised` -> `missing` -> `subsetting`
-> `factors` -> `levels` -> `factor-numbers` -> `tables` -> `factor-table` -> `filtering` -> `selecting` -> `mutating` -> `arranging`
-> `grouping` -> `counting`.

That order is deliberate. `subsetting` teaches the logical mask, so `filtering`
arrives as the same idea spelled shorter; `tables` has the student write filtering by
hand, so `filter()` is a convenience rather than a new language. By the time
`grouping` appears, every piece of it is already familiar.

The whole path is also one argument about missing data, made once per lesson in a
harder place each time: `missing` shows NA swallowing a mean, `filtering` shows rows
disappearing without a message, `arranging` shows NA sitting at the bottom where a
reader takes it for the smallest value, and `counting` ends by separating "how many
respondents" from "how many answers" -- the table that makes the other three visible
in a report. A student who walks the path meets the same fact five times and can no
longer mistake it for a quirk of one function.

Module 7 is written as one continuous story rather than a verb reference: each verb
is introduced as the base-R operation the student already performed by hand, and each
carries the single irreversible thing about it -- `filter()` drops NA rows silently,
`select()` hands back a table even for one column, `mutate()` overwrites a column
whose name you reuse, `arrange()` changes nothing at all.

The course starts where the learners already are: a spreadsheet. Lesson 1
(`vectors`, reworked 2026-09-29) draws the survey as an Excel sheet (letters, names
in row 1, one person per row), takes one column out so it lies down with its sheet
addresses under the R positions (D2 becomes [1]), and only then builds the same row
with `c()`. The vector is the column itself; R just prints it lying down. "A single
number is a vector" moved to `vectorised`, where recycling needs it.

Lessons 2-4 each hold one "W arkuszu" scene (`show.excel`): the same step as the
spreadsheet does it, drawn beside the R picture from the same values. They are the
three places the learner's Excel habits mislead: a column that keeps a type per
cell (R makes the whole vector text), a formula dragged down row by row (R does the
column in one expression), and AVERAGE skipping blanks without a word (R answers NA
until `na.rm` says what to do with the gaps).

Examples are concrete survey data a sociology student would meet, not abstract
letters. `factors` is the clearest case (reworked 2026-09-24): eight answers to "Jak
oceniasz zajęcia?" coded 1-5, plus the scale that says what each digit means. A
factor is then exactly that pair -- the digit stays underneath as the code, the word
sits on top, the levels are the codebook -- and the one fact that nobody chose 1
carries the rest: the bare-digit table has no row for it, `levels = 1:5` keeps it with
a zero, and without `levels` every code shifts by one, so five labels no longer fit
four levels. The task is the table a report needs: counts in words, in scale order,
zero included; the check compares the table's names, not only its counts, and the
goal is drawn as bars like the stage, so a missing or misplaced row is what lights up.

Each lesson carries its own regression suite (`task.nearMisses`): wrong-but-plausible
answers paired with the diagnosis each must produce, run by `test/lessons.mjs`.

Every lesson has the same shape since the 2026-09 redesign (decisions D10-D12), so
the student never has to learn the interface twice:

1. **Scenes** (2-5) -- ONE sentence each, plus live code with the key expression
   already selected and the next thing to click pulsing. A scene may also make the
   picture point at its one fact on arrival (`show`: a hollow row for a value the
   data lacks, a factor code already lit), so the sentence need not describe it. The stage draws what the
   selected expression did; the sentence only says where to look. The first scene
   carries the lesson's idea as a picture, not as paragraphs.
2. **Twoja kolej** -- the sandbox: the code is the student's, plus one-click variants
   ("chips") that each show one more consequence. Every chip is run by the tests.
3. **Zadanie** -- make R produce the goal shown next to the prompt. The student's
   result is drawn beside it with every differing cell outlined; the check is by
   result, with a diagnosis on failure and a hint chain rather than a straight answer.

Text has budgets, enforced by `test/lessons.mjs`: a scene sentence at most 90
visible characters, a prompt 130, a diagnosis 130. Measured per lesson, in visible
Polish characters: reading before the task went from 1 698 to 270 (6x less), and all
text including hints and diagnoses from 2 880 to 872.

Three rules the reference lesson establishes, worth keeping in the rest:

- **Judge the result, not the text.** A correct answer written in another order, or
  with counts as doubles, is correct. What *is* required is named explicitly
  (`requireCalls`), so a task about grouping cannot be passed by filtering city by
  city -- and that attempt gets its own explanation rather than "incorrect".
- **Diagnose the shape.** One row instead of three means the grouping is missing;
  an NA in the mean means `na.rm` is missing. The message names the symptom the
  student is actually looking at.
- **The data carries the lesson.** The survey in `grouping` contains exactly one
  missing answer, so `na.rm` cannot be avoided, and the closing note points at the
  gap between "how many respondents" and "how many answers the mean used" -- a real
  reporting mistake, not a syntax point.

## Diagnostics to implement

Recognised by shape, phrased as guidance. These are the errors that actually strand
a beginner:

- `Object 'x' not found` -> typo? different case? assigned with `=` inside a call?
- Using `=` where `<-` was meant, and vice versa
- `x[0]` expecting the first element
- Comparing with `=` instead of `==`
- Forgetting `na.rm = TRUE` and getting NA
- Quoting a variable name (`mean("x")`)
- Length-1 condition error in `if` when the student meant `ifelse`
- Factor arithmetic
- `$` on a plain vector

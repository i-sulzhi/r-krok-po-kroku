# Architectural decisions

Short records of choices that would be expensive to revisit. Each says what was
decided, why, and what it costs.

## D1 — Own interpreter, not WebR

**Decided:** implement a tracing interpreter for a subset of R in JavaScript.

WebR runs the real R in WebAssembly, and it was the obvious candidate. It was
rejected because the product is not "run R in a browser" but "show what R does
between the input and the output". WebR executes inside compiled C with no hooks:
it can report that `c(1, "a")` is `c("1", "a")`, but not when or why the double
became a character. It also costs ~30 MB, which breaks offline single-file delivery.

**Cost:** we support a curated subset. Unsupported syntax must fail with a clear
message (see `builtins/index.js`, `KNOWN_UNSUPPORTED`) rather than silently
misbehaving. Real R is retained as a test oracle instead.

## D2 — Events carry data, never prose

**Decided:** trace events hold structured payloads only; wording lives in a separate
explain layer.

Keeps the language of the interface (currently Russian) out of the engine, so the
trainer can be re-worded or translated without touching semantics, and so the same
event can be rendered differently in a tooltip, a caption, and a lesson.

## D3 — Immutable values, explicit copies

**Decided:** R values are frozen; every modification builds a new value.

R's copy-on-modify then falls out of the design rather than being a special case,
and each copy is an observable COPY event we can animate. We do *not* implement R's
reference-counting optimisation: we always copy. That is slower and pedagogically
more honest -- the copy is the thing worth seeing.

## D4 — Eager argument evaluation

**Decided:** function arguments are evaluated before the call, not lazily.

Real R uses promises. Laziness is invisible in beginner code and would add a layer
of indirection to every call diagram. Revisit only if a lesson needs `substitute()`
or missing-argument semantics.

## D5 — Verified against real R, not against intuition

**Decided:** correctness claims are backed by differential tests against the system
`R` binary (`test/diff-syntax.mjs`, `test/diff-eval.mjs`).

Printing rules especially are full of non-obvious behaviour (one decimal width per
vector; scientific notation chosen by *width*, not magnitude; strings left-aligned
while numbers are right-aligned). Every one of those was found by the oracle, not by
reasoning. The oracle must run under `LC_ALL=en_US.UTF-8` or Cyrillic test strings
come back as escaped bytes.

## D6 — Modular source, single-file delivery

**Decided:** develop as ES modules; ship one inlined HTML file.

Students download one file and open it -- no install, no server, no internet. The
build step (`build.mjs`) inlines everything.

## D7 — Two languages, keys not sentences *(superseded in part by D9)*

**Decided:** Polish is the default (the syllabus sets the course language), Russian is
available from a switch. Every user-visible string lives in `src/i18n/`, and errors
carry a message *key* plus parameters instead of a finished sentence.

Rendering is lazy, so switching language re-translates text that was produced before
the switch, including an error already sitting in the console.

Two consequences that are easy to get wrong later:

- **`RError` must call `super()` with no argument.** Passing the key to `super(key)`
  defines an *own* `message` property, which shadows the getter and freezes the text
  in whatever language was active when it was thrown.
- **Diagnosis matches on `error.key`, never on the rendered text.** Text matching
  worked while everything was Russian and would have failed silently in Polish.

`test/i18n-coverage.mjs` fails if the dictionaries drift apart in keys or in
placeholders, so a half-translated build cannot ship.

## D8 — Scope follows the syllabus, and stops where honesty requires

The course (HIFSS.I4.17992.25, *Środowisko R w badaniach socjologicznych*) is about
ten packages, not about base R. The trainer therefore covers:

- **Topic 1** directly -- R's specifics, "zalety i ograniczenia"
- **Topics 2 and 10** (tidyverse verbs, stringr) as the visual layer under them
- everything else *indirectly*, by teaching the base-R mechanics that leak through
  every package: coercion, recycling, NA, factors, copy-on-modify

It deliberately does **not** attempt caret, QCA, Shiny, RCrawler, sentiment or topic
modelling. Those belong in real RStudio, and simulating them would teach a fiction.
Unsupported calls say so plainly (`KNOWN_UNSUPPORTED`) rather than failing obscurely.

---

*D9-D13 were taken in the 2026-09 redesign ("less text, more visualisation; Polish
text; the student should look, click the code and understand"). Working notes:
`docs/redesign-2026-09.md`. D7 is superseded in part by D9: the key-based messages
and the plural rules stay, the second language and the switch are gone.*

## D9 — Polish only

**Decided:** the trainer speaks Polish, the course language. The Russian
dictionaries, lesson texts and the language switch are removed.

A second language doubled every text change and hid bugs: hard-coded Russian labels
shipped inside the Polish interface in three panels, a CSS `content:` string and a
default argument name -- none of them caught while both languages existed, because
each looked plausible in one of them. The build now refuses a bundle containing
Cyrillic text (regex ranges that need Cyrillic letters use `\u` escapes). The i18n
layer stays: it is still where every visible string lives, errors still carry keys,
and Polish still needs three plural forms after a number.

## D10 — The code is the interface

**Decided:** every sub-expression of every example is clickable. Pointing at a piece
of code shows, on the stage, what that piece evaluated to and how; clicking the same
place again climbs to the enclosing expression.

This replaces the global step player (a timeline of 10-20 frames, most of them name
lookups, filtered per lesson by a `focus` list). Choice is now spatial -- the student
decides what to look at by pointing at it -- and time lives inside a picture (the
cell-by-cell animation of `oceny * 20`). "Kolejność R" still walks the evaluation
order, inside out, for anyone who wants the sequence.

## D11 — The engine records what every sub-expression was worth

**Decided:** `Interpreter.eval` reports each node's value to an evaluation log
(`src/trace/evallog.js`): the value, the parent evaluation, and the window of trace
events emitted while it ran. A node evaluated many times (`mean(wiek)` inside a
grouped `summarise()`, a loop body) keeps one entry per evaluation, capped at 5 000.

The UI derives everything from the log -- hover values, the chain of a pipe, "grupa
Gdańsk · 1 z 3" -- and never re-evaluates. It is the same rule as D2: the engine
narrates, the interface draws. Only traced runs build a log; answer checking stays
fast.

## D12 — A lesson is a few scenes, not four text beats

**Decided:** a lesson is 2-5 scenes (one sentence + live code + the pre-selected
expression + the thing to click), a sandbox with one-click variants, and a task whose
goal is shown as a value beside the student's own result. The idea is carried by the
first scene's picture.

Text budgets are enforced by the lesson suite (90 visible characters per scene
sentence). Reading before the task went from about 1 700 characters per lesson to
about 270. What the paragraphs used to explain is now either in a picture or in a
one-line caption with the numbers in it.

## D13 — The build keeps every module in its own scope

**Decided:** the single-file build wraps each module in a function that takes its
imports from a registry and writes its exports back, instead of concatenating all
modules into one scope.

The old build renamed clashing private names with a regex over the whole module
text, strings included. A private function `dollar()` in the stage module turned the
caption key `'fx.dollar'` into `'fx.dollar$src_ui_viz_focus'` -- visible to students
in the built file only, with every source-level test green. Separate scopes remove
the renaming, and `test/bundle.mjs` now boots the built file headlessly and walks
every lesson, because the artefact students receive is not the code the other
suites import.

## D14 — The console prints at the width of its panel

**Decided:** printed values wrap to the number of characters that fit the console
panel (between 30 and R's default 80), measured on screen and re-measured when the
panel changes width -- R's `options("width")`, set the way RStudio sets it.

At a fixed 80 columns the factors lesson broke: a factor of survey labels
("bardzo dobrze") prints lines of 74 characters, and a console panel beside the code
is narrower, so the line was cut mid-word. RStudio never shows that, because it keeps
`width` equal to its console pane; a student moving from the trainer to RStudio should
see the same wrapping. The formatter already took a width; only the caller changed.
It is covered by the R oracle: `test/diff-eval.mjs` runs snippets under
`options(width = N)` and compares, which also caught R's rule for shortening the
`Levels:` line when it does not fit.

## D15 — The grammar around a lesson is explained beside it, from its own code

**Decided:** under each lesson step sits "Ściąga", a glossary of the R grammar present
in the code on screen: assignment, function call, `$`, `:`, quotes, comments,
operators, `NA`, named arguments, `[ ]`, the pipe (15 concepts). Each card takes its
example from that very code and labels the parts (`oceny` = nazwa, `<-` = zapisz,
`c(...)` = wartość), with the value it produced, one plain sentence, a "Czytaj:"
read-aloud line and, where honest, the spreadsheet equivalent.

Lesson 1 is about vectors, but its code already assigns, calls functions and takes a
column; a first-time programmer meets all of that in one screen, and the course has
few hours for basics before tidyverse. Adding scenes would lengthen the lesson and
would explain each piece once; the panel explains it wherever it appears, in every
lesson. Clutter is controlled by rules, not by restraint in writing:

- concepts new in the lesson (first lesson whose code uses them) are open cards;
  ones met earlier are chips that open on demand;
- the task step, whose box starts empty or unfinished, offers the lesson's concepts
  as chips, with examples from its scenes, never from the solution;
- everything met so far is one click away ("Cały słowniczek");
- the panel's size comes from the screen, not from a guess about it. The lesson
  column is split: the lesson takes the height it needs (and scrolls beyond it), the
  glossary dock takes what is left. Its bar ("Ściąga", the symbols, "2 nowe
  pojęcia") never leaves the screen; when there is no room for cards the dock shrinks
  to the bar, and a click raises it over half the column for that step. Measured
  across all 75 steps: at 1920×1080 the cards show on every step, at 1366×768 on 53,
  at 1280×720 on 39, and the bar is visible on all of them. On a phone the panel
  follows the lesson and starts folded.

The lab's monitors are unknown, which is why the layout does not assume any.

The example is live: hovering it lights the code, clicking it selects it and the
stage draws it, so the glossary leads back into the picture instead of away from it.
Concept detection runs on the parse tree (`src/ui/concepts.js`), not on regexes, so
`#` inside a string is not a comment and `|>` is found even though the parser
rewrites it into an ordinary call.

## D16 — A lab computer is shared: saved answers are offered, not filled in

*The menu's "Zacznij od nowa" described below was replaced by names in D17; the
offered-not-filled rule stands.*

**Decided:** a task always opens with its starter. If this browser holds code saved
for the task, a line above the box says so, with the time it was saved ("dziś,
10:42"), and a "Wczytaj" button loads it. The lesson menu ends with "Nowa osoba przy
komputerze?": how many lessons this computer has finished, and "Zacznij od nowa",
which after an in-page confirmation forgets progress, saved code, used hints, the
last place and the glossary preference, and opens lesson 1.

Progress lives in the browser (no accounts, no server). That was designed for a
student at home, but the course runs in a computer lab. There the next student at
the same browser opened a task with the previous student's correct answer already
typed in, saw lessons ticked as done and hints already revealed. Offering instead of
filling keeps the convenience for the student who returns to their own machine; the
time stamp lets them recognise their own code. The confirmation is part of the page
because browser dialogs are not available everywhere the trainer runs.
`test/bundle.mjs` checks the whole story on the built file: a solved task opens
clean, "Wczytaj" loads, the menu counts, the reset asks first and then forgets
everything, cancelling keeps everything.

## D17 — Students say who they are; the teacher gets a report they hand in

**Decided:** the trainer opens on "Kim jesteś?" every time. A name or nickname keeps
that person's progress, saved code and place apart from everyone else's in the same
browser; the people who used it are listed with their progress, one click to
continue. The menu says who is working and offers "Raport dla prowadzącego",
"Zmień osobę" and "Usuń moje dane z tego komputera" (confirmed in the page). The
report is plain text with a check code; the student hands it in through the
university's channels. Published as a static site on GitHub Pages.

The teacher (the author) wanted the site public, names for a group of about 15, and
some view of progress. A live dashboard would need a server and a database, keys to
keep, and students' names stored by an outside service, which is a data-protection
(RODO) question for the university, for 15 people. The report gives the teacher the
same facts with none of that: the data goes where the student sends it. Asking every
time, rather than continuing as the last person, is the point on a shared computer:
one click on your own name is cheap, someone else's progress is not.

The check code is honest about its limit: it catches a report edited by hand, not a
student who reads the JavaScript that computes it. Verification ignores what pasting
does to text (line ends, spacing, a greeting above the report), so a report that went
through an LMS still checks. Data saved before names existed belongs to nobody in
particular and is dropped once. `test/people.mjs` covers the storage and the report
(mutation-checked: shared storage, a removal that leaves progress behind, and a check
that accepts any code each fail it); `test/bundle.mjs` plays the whole lab story on
the built file.

**Revised after a walk-through before publishing (2026-10-01),** once as a student and
once as the teacher, in a real browser at 1366x768:

- *A solved task lost its code.* A success draws the task again (green star, next
  lesson), and since D16 a drawing starts from the starter. The code just checked now
  stays in the box, with no "Wczytaj" offer for it. A failed check also disappears as
  soon as the code changes: it spoke about code that is no longer there.
- *The teacher could not reach the check.* On the teacher's own computer the trainer
  opens on "Kim jesteś?", and the check lived only in a student's report dialog. A
  link under the names, "Prowadzący? Sprawdź raport studenta", opens the check without
  creating a person, and closing it returns to the names.
- *Fifteen reports in a row.* The verdict follows the pasted text: pasting the next
  report replaces the last verdict at once, no button needed.
- *Report lines read badly.* Lesson titles have colons ("Braki danych: NA"), so
  "title: state" gave two. Lines now read "title → state".
- *A year group on one computer.* Typing a name narrows the "Wracasz?" list.
- Copying falls back to the browser's older copy command before asking for Ctrl+C.

Each is covered by `test/people.mjs` or `test/bundle.mjs` and was mutation-checked.

## D18 — A way out to RStudio, and the first mistake named correctly

**Decided:** after the last lesson, and in the menu under "Dalej", a page "Dalej w
RStudio". It is a page, not a lesson. On the left are three steps: write in a script,
read your own survey with `read.csv2()`, and load packages. On the right, where the
stage usually is, are eight of R's commonest messages verbatim in English, each with
what it means and what to do. Separately, `wiek <- 23, 34` now gets its own diagnosis,
"Kilka wartości trzeba skleić w c()", with the student's own line wrapped in `c()`.
After a failed check the explanation scrolls into view.

Asked as "would this trainer have helped you as a sociology student?", the honest
answer had two gaps. First, the trainer is a closed world: the moment a student opens
RStudio with their own file, three things differ (a script, a file, packages) and
the errors are in English. The course does its real work there (curriculum), so the
bridge is one page that names exactly those differences. It is not a lesson, because
none of it can run here, and simulating files or packages would teach a fiction.
`read.csv2()` rather than `read.csv()` because a Polish Excel writes semicolons and
decimal commas; "CSV UTF-8" because Polish letters otherwise arrive broken.

Second, the first mistake almost every beginner makes, several values without
`c()`, was answered with "usually a missing comma". That is the opposite of the advice
they need. The rule matches the error key and the comma at the error's position, not
the message text (the house rule in diagnose.js), and a real missing comma keeps the general
advice. On a 1366x768 screen the explanation sat below the fold while the verdict said
it was "pod kodem"; the scroll fixes that without changing the layout.

`test/behaviour.mjs` checks the diagnosis and its fix on three shapes, and that a real
missing comma is not misnamed. `test/bundle.mjs` reaches the page from the solved last
lesson and from the menu, checks it for raw keys and em dashes, and checks that the
stage and memory return for a lesson and the sandbox. Mutation-checked: a missing
dictionary key and a lesson that forgets to restore the right column each fail it.

## D19 — The data a lesson uses is created on screen

**Decided:** a lesson's small vectors (`oceny`, `wiek`, `wiek_tekst`, `odpowiedzi`,
`skala`) are still prepared in the hidden setup, but the scene that first uses them
now opens with the lines that create them, including the setup's comment that says
what the data is ("Odpowiedzi dziesięciu osób; dwie nie odpowiedziały"). Data tables
(`ankieta`) stay as they are: lesson 1 introduces them as data read from a file.

The teacher noticed that `labels = skala` came from nowhere: the student never saw
`skala` made, only found it in "Pamięć R". Five lessons had the same gap, and every
setup carried a comment explaining the data that no student ever saw. Students
already know `<-` and `c()` from lesson 1, so seeing the lines costs nothing and
answers "where did this come from?". The lines are clickable like any code, and the
glossary meets them as known concepts. No new scenes: the lesson on selecting
elements already has five, the limit.

Two consequences were fixed with it. "Kliknij w kodzie: x" pointed at the first `x`
in the box, which is now the line creating it; it now looks inside the scene's own
expression first. And a 58-character comment was cut at the box's edge at 1366x768,
so code lines in scenes are now held to 54 characters.

The same pass reworded the factor lesson after reading it as a beginner would. Its
title was "Czynniki (factor)", which a Polish sociologist reads as factor analysis;
it is now "Etykiety kategorii: factor()", and the task note says the two are
unrelated. Scene 2 names the three ideas at once through something students know, a
survey codebook ("Jak książka kodów: każdy poziom dostaje etykietę, a cyfra zostaje
kodem"). Scene 3 now says why the shifted codes matter. Two picture captions lost
their stray colons.

`test/lessons.mjs` checks that every vector a lesson's scenes use is created in the
scene that first uses it (data frames excepted), and that code lines fit the box;
`test/bundle.mjs` checks that every "click here" mark lies inside the scene's own
expression. Mutation-checked: a scene without its data line, the old first-match tap
and the old long comment each fail.

## D20 — A mask on a table is drawn along its rows

**Decided:** a scene can ask (`show: { rows: true }`) for a condition on a table's
column, such as `ankieta$plec == "K"`, to be drawn along the table: the column lit,
the answer added beside it as one more column, one TRUE or FALSE per row, with the
same ✓ and ✗ the next scene uses for `ankieta[mask, ]`. Without the request the
comparison keeps its usual picture.

Read as a beginner would, the data.frame lesson said "a condition on a column is a
mask: one value per row", while its picture showed the recycling of `"K"` eight times,
a fan of dashed lines and no rows at all. Recycling is lesson 3's subject; here it was
noise, and the rows the sentence spoke of were missing. An opt-in keeps lesson 3's
picture where recycling is the point.

The same reading changed three texts. Scene 1 says the table is the one from lesson
1 and names it a data.frame. Scene 4 says what a beginner does not guess: the empty
place after the comma means all columns. Its caption adds that row numbers stay from
the table (3, 5, 8), which looked like a mistake. And rows picked by number
(`ankieta[1:3, ]`) are no longer captioned "rows with TRUE".

`test/bundle.mjs` checks the row picture in its scene, its absence for the same code
outside it, and the caption for rows picked by number. Mutation-checked.

## D21 — filter() decisions live in the table's rows; texts' numbers are tested

**Decided:** the `filter()` picture puts each condition in the table itself, as a
column at the end, headed by the condition's own code, one TRUE, FALSE or NA per row.
With several conditions each gets its column and a last one, "oba / i jedno, i
drugie", shows the rows that stay. Separately, every number a lesson's text states is
listed in `test/lessons.mjs` with the code that proves it on the lesson's data.

Reading the filter lesson as a beginner showed two errors no suite had caught. The
decision column was a separate stack beside the table, sized by hand; it had drifted a
row down, so TRUE stood beside a struck-out respondent, and in the very scene about
NA the NA stood beside row 6 instead of row 5. Inside the table the decision cannot
drift: it is a cell of the row it decides. And the task's success message said four
people rated above 3 and its note "4 + 3 = 7"; the data, checked in real R as well,
gives 5 and 2. Text and data are written apart, so nothing tied them together.

The same reading added one sentence: scene 1 now says that inside `filter()` a column
is written without `ankieta$`. Lesson 7 taught `$`, and only a hint mentioned the
change. The multi-condition columns make scene 4's "i jedno, i drugie" visible.

`test/bundle.mjs` checks each row's decision on scenes 1, 3 and 4 (NA on row 5, three
columns with "oba"); shifting the cells by one row fails it. The facts table covers
ten lessons, twenty numbers; the old "Cztery osoby" and a changed answer in the data
each fail it.


## D22 — The dplyr lessons, read as a beginner

**Decided:** four changes to the last five lessons. `select()` draws its result under
the table, so "one column is still a table" (and the new column order) is seen.
`mutate()` no longer says the original "disappears": the result has the new values,
the table in memory does not change; and a new last scene keeps a result under a name
with `<-`, memory showing both tables. `arrange()` lights the column the rows were
sorted by and says the number on the left is the row's place before. Grouping's note
("two answers, three respondents in Warsaw") joined the tested facts.

The mutate scene was the one that misled: the sentence and the caption said the old
values were gone while "Pamięć R" beside them still showed `ankieta` untouched. Behind
it sat a gap the whole dplyr module shared: no scene said that a verb returns a new
table and keeps nothing. In RStudio that is the first surprise ("I added a column and
it is not there"), and only one error message mentioned it. The new scene answers it
where it matters, in the verb that "adds"; the task accepts a named result too.

Grouping and counting needed nothing: their pictures already say what the sentences
say. `test/bundle.mjs` checks the select result, the two tables in memory after the
new mutate scene, and the lit sort column; mutation-checked.

## D23 — One scrolling column; the glossary's examples drawn tight

**Decided:** the lesson column scrolls as one. The glossary is no longer a dock with
its own scroll area beside the lesson's: it follows the lesson in the same column,
and its bar is held at the bottom of the column (CSS sticky) while the glossary is
out of sight. The bar brings it into view; in view, it folds or opens it. On a tall
monitor the glossary fills the space under the lesson as before. This supersedes the
split-dock layout of D15 and its squeezed and raised states.

Separately, a glossary example is drawn as one unbroken line of code. Labels hang
under their parts, placed in character widths (the code is monospaced), nudged right
when they would collide and moved to a second row only when that fails.

On a 1366x768 screen the old split showed two scroll bars, one above the other, and
which one moved what was a guess. One scrolling box removes the question. The bar
cannot leave the screen, which was D15's point; the column scrolls with scroll
padding at its bottom, so an error explanation scrolled into view is not hidden under
the bar. The labels had stretched the code to their own width: "wiek [3   ]" for
`wiek[3]`, the very spacing a beginner then copies. Labels are positioned in a slot
in the code's font, since `ch` follows the font of the element it is set on.

`test/glossary.mjs` checks, across all 160 panels, that each label starts under its
part and that labels in one row never overlap; centring without the nudge, or a
label pushed off its part, fails it. The single scroll area was measured in the
browser on six steps: only the column scrolls, the bar stays on screen, and the bar
cycles "show, fold, open".

## D24 — Tasks and sandbox, tried with a beginner's answers

**Decided:** thirty-five answers a beginner plausibly writes were run through every
task. What came back led to four kinds of change.

- *A crash.* A dplyr verb with no table (`summarise(n = count())`, or a line after a
  missing `|>`) threw a JavaScript error out of the interpreter and broke the code
  panel. Verbs now say in R's terms that they need a table, and the session turns any
  failure inside the trainer into an error on screen ("To błąd trenażera"), logged to
  the console, never a broken page.
- *Valid R called wrong.* `na.rm = T` was "object T not found", `na.omit()` was "check
  your spelling", and an unnamed `summarise(mean(wiek))` was "each result needs a
  name". In R, T and F are TRUE and FALSE, `na.omit()` exists, and dplyr names an
  unnamed column by its code. All three now behave as in R, checked against the R
  binary (`diff-eval`, `diff-paired`). `na.omit()` on a vector leaves out R's
  "na.action" attribute, a simplification noted in the code.
- *Errors named for what they are.* A pipe broken at a line's end ("Brakuje |> na
  końcu linii 2", whatever error the next line causes); a column written outside a
  verb (`plec` for `ankieta$plec`); a text value without quotes (`K` for "K"); a
  function used without parentheses (`oceny - mean`); `ankieta$x = ...` as a new
  column's name. Each comes with the student's line corrected. The session looks up a
  missing name among the tables in memory so the diagnosis can say which.
- *Seeing the difference.* A table goal and answer stood side by side and were cut
  off; the one differing cell (an NA) was outside the box. They now stand one above
  the other. Task 13's column name `respondentow` read as a misspelling and now sits
  in brackets after the word.

The sandbox had no data, so half the course could not be tried in it, lost its code
on every visit, and had no glossary. It now starts with the course's survey in memory
(said under its title), keeps each person's code (removed with their data), and has
"Ściąga", built from the same dock as the lessons (`dock.js`, extracted from the
lesson view rather than copied).

`test/behaviour.mjs` checks the diagnoses with their fixes, the three R behaviours,
and that no verb without a table escapes as an exception; `test/people.mjs` and
`test/bundle.mjs` check the sandbox's data, glossary and kept code, per person. Each
was mutation-checked.

## D25 — "Ściąga" becomes a cheat sheet

**Decided:** the glossary now says what functions do. A function's card adds one line
for that function ("group_by() dzieli tabelę na grupy według kolumny"), and a new list,
"Funkcje", gives every function met so far, one line each: 26 by the last lesson. A
task offers all the concepts its lesson's steps used, not only those the lesson
introduced. In mutate() and summarise(), `name = value` reads as a new column.

Read as a beginner would, the panel explained syntax well and functions not at all:
every function was the same card, "Czytaj: wykonaj group_by na tym, co w nawiasie",
which says nothing about grouping. For a Polish student "ściąga" is exactly the list
the panel lacked. And in a task, where no example is on screen, the panel was nearly
empty: lesson 7's task showed "Komentarz" only, while it needs `$`, `[ ]` and `==`,
because those were introduced in earlier lessons and "Z tej lekcji" took only new
ones. `sredni_wiek = mean(wiek)` was read as "set the argument", which is not what it
does in summarise().

A function counts as met in the lesson whose scenes, sandbox or chips show it, or
whose hints name it (`mean()` is needed in lesson 2's task, shown from lesson 3),
never from a solution. Five card texts were sharpened: `!=` beside `==`, `na.rm = TRUE`
beside NA, "without `$` inside filter() and mutate()" beside `$`, `[wiersze, kolumny]`
beside `[ ]`, and a named range instead of a worksheet tab for a name.

`test/glossary.mjs` checks each change and that every function the lessons show has
its line; each check was mutation-checked.

## D26 — The report reads at a glance, and the teacher checks a group at once

**Decided:** a lesson line in the report prints only what happened ("(sprawdzenia: 1)",
no "podpowiedzi: 0"), and the student's window is wide and tall enough to show the whole
report, code line included, with a line asking to send it all. The teacher's check left
the student's window; it is reached from "Kim jesteś?". Checks, hints and an opened
solution are counted up to the first success only. The check reads one report or many
pasted one under another: one gives a verdict with a short summary (date, lessons done,
lessons with an opened solution, lessons started and not finished), several give a
table, one row per person, a changed report flagged in its row.

Read as the student, the report was a wrapped text box showing five lessons of thirteen,
with the code line out of sight, and a teacher's check below that a student has no use
for. Read as the teacher, the verdict said only "nienaruszony" and the name, and a group
of fifteen meant fifteen pastes. One fact was misleading: a student who solved a task and
then opened the model solution to compare was reported as "otwarte rozwiązanie", with
no way to tell the two apart; checks after a success also kept counting.

The check code is computed from the report's own text, so the new wording does not break
reports made before it; only the first line, "Osoba:", "Kod kontrolny:" and the salt
must stay. A report from before this change is kept in `test/people.mjs` and still
checks. Each code line closes one report, which starts at the last report heading above
it, so greetings between reports do no harm; a heading with no code after it is reported
as missing its code rather than skipped.

`test/people.mjs` checks the shorter lines, the facts stopping at a success, the old
report, and a pasted group (order, verdicts, facts read back, no facts from a changed
report); `test/bundle.mjs` checks the student's window and the group table on the built
file. Each was mutation-checked.

## D27 — Factors are shown before they are typed, and get three lessons

**Decided:** a scene may have a picture instead of code (`Scene.picture`,
`viz/survey.js`). The questionnaire stands where the code would: one question, its
answers, the people who filled it in. The stage shows what R holds. Pointing at a
person or an answer lights the same thing on both sides. Three kinds: `codebook` (the
sheet keeps bare codes, the questionnaire says what they mean), `pairs` (the factor
as a table: for each person a label and a code, and beside it the levels), `order`
(the same answers counted as text and as a factor). Factors grow from one lesson to
three, each opening with such a scene: codes and labels, the order of levels, and a
factor is not a number. The course has fifteen lessons.

The teacher's first group already knew vectors and data frames from an earlier
course; factors and dplyr were new to them, and factors had one lesson with one task.
A factor is also the first thing in the course with nothing typed before it to stand
on, so the first contact is a picture, not a call. The pictures are computed, not
drawn by hand: the lesson's setup runs, the scene's factor is evaluated, and the
codes, labels and levels shown are R's own (text is counted by R's `table()`, so the
alphabetical order is R's). Memory is empty on such a scene, because nothing has run.
A lesson must still have two scenes with code: pictures prepare the code, they never
replace it.

The teacher's remark that a factor resembles a data frame, several vectors describing
one row of observations, is used in the `pairs` picture where it holds: label and
code stand side by side for each person, as two columns. It is not said as a rule,
because the levels are not a third column: they have one entry per category, not per
person. The picture shows them as a separate small table for that reason.

The second lesson's task uses another question and makes the student type the levels,
from "tak" to "nie", the reverse of the alphabet, so counting the bare text cannot
pass. A level typed differently from the data loses answers to NA; the diagnosis says
the total is not 8. The stage now captions that case itself ("Poza levels: 1 wartość.
Każda staje się NA"). The third lesson's anticipated wrong answer is the mean of the
codes (2.125 instead of 1.375), diagnosed as such. `sort()` on a factor returned bare
codes; it now returns the sorted factor, as R does.

`test/lessons.mjs` validates picture scenes and the numbers in the new texts;
`test/pictures.mjs` points at every person and answer of every picture; `test/bundle.mjs`
clicks the questionnaire in the built file; 19 oracle cases compare the new lessons'
R with real R. Each new check was mutation-checked.

## D28 — Why `levels` exists, and a factor used inside a table

**Decided:** the first factor lesson shows the problem before its cure, in three
steps instead of two: `factor(odpowiedzi)` (R has only the data, so the levels are
2, 3, 4, 5, numbered from 1), then `levels = 1:5` alone (which answers were possible:
the code equals the answer again), then `labels`. The stage says where guessed levels
came from ("Bez levels R zna tylko dane. Poziomy to: 2, 3, 4, 5...") and marks it as
a trap; the level list is headed "kod → poziom". A new lesson, "Czynnik w tabeli",
follows the data frame lesson: a survey export whose columns are codes, a column
replaced by a factor (`ankieta$wyksztalcenie <- factor(...)`), and what that buys:
a count table in words, rows chosen by label, a mean for one group. The course has
sixteen lessons. A lesson may have up to six scenes.

The teacher read the lesson and could not tell from it why `levels` is needed or why
the numbering goes wrong without it. The old order gave the cure first (levels and
labels in one call) and the failure afterwards as a warning; the reason, that R knows
the data and not the questionnaire, was never on screen. Three loose-vector lessons
also left open what a factor is for in an actual analysis.

Every run starts from the lesson's data, so each scene of the new lesson repeats the
three lines that make the factor, as the script would. The sandbox keeps those lines
above every chip (`play.keep`), so a chip is still one short line. The task's check
also looks at the table in memory: a correct count made beside the table, with the
column left as text, is the anticipated half-answer and is told so. Its reference is
built from the answers themselves, because it is computed after the student's code
has already turned the column into a factor.

Two things in the interpreter were wrong and are fixed. `table(a, b)` counted `a`
alone, a wrong answer that looked right; it is now refused, with `count(tabela, a, b)`
offered. `str()` printed a table's columns in its own layout; it now prints R's
(padded names, no length inside a table, levels cut after about 13 characters), since
`str(ankieta)` is a chip in the new lesson and the RStudio page tells students to
use it.

`test/lessons.mjs`, `test/pictures.mjs`, `test/behaviour.mjs` and `test/bundle.mjs`
check each of these, 16 more oracle cases compare the new code with real R, and each
new check was mutation-checked.

## D29 — Each dplyr verb opens with its table before and after; a closing lesson chains them

**Decided:** the six verb lessons each start with a scene without code
(`picture.kind: 'verb'`, `viz/before-after.js`): a research question in plain words,
the steps "przed" and "po", and one table that moves between them. Rows fade and
close up (filter), columns leave (select), a column grows (mutate), rows travel
(arrange), rows gather by colour and fold into one row per group (group_by,
summarise, count). It plays once on arrival, about a second and a half per stage,
and can be replayed or stepped by hand. A new closing lesson, "Od pytania do
tabeli", answers one question with four verbs in a row, typed one step at a time,
and ends with a factor made inside `mutate()`. The course has seventeen lessons.

The teacher's first group met dplyr for the first time here, as they did factors,
and asked for the result of each verb to be shown, animated, before the lesson
starts. An animation alone shows the mechanics and not the reason; a research
question alone (what worked for factors, which are a concept) does not show what a
verb does to a table, which is all a verb is. So the question sets the goal and the
motion shows the verb. The pictures that already existed drew the same things, but
only once the code was on screen.

Nothing is drawn by hand. The lesson's setup runs, `picture.code` runs with the trace
on, and the stages are read off the verbs' own events, so the rows kept, the order,
the groups and the values are R's. Every row and every cell exists once and is placed
absolutely; a stage only says where each one is and whether it shows. That is what
makes a row visibly the same row before and after, and it is why one renderer serves
a single verb and a pipeline of four. The picture's code must be typed in a later
scene of the same lesson, so the student recognises what they watched. The table is
in memory on such a scene (it stands for a file already read), unlike the survey
scenes, where nothing has run.

Each verb lesson keeps its one task: the closing lesson carries the exercise on
chaining, a different question on the same table. Its anticipated wrong answers are
counting everyone, forgetting to sort, and sorting the wrong way.

`test/pictures.mjs` shows every stage of every picture and compares the last one
with the table R returns, row for row and cell for cell; `test/lessons.mjs` checks
that the picture's code runs, fits, and is typed later; `test/bundle.mjs` clicks the
stages in the built file and checks that the animation starts on arrival and stops
when the scene is left. Each check was mutation-checked. The motion itself was
watched in a real browser; with reduced motion the stages switch without it.

## D30 — The pipe is taught as a way to read nested calls

The teacher asked why the result of `filter(ankieta, wiek > 40)` and of
`ankieta |> filter(wiek > 40)` look the same in the console and on the stage. They
look the same because they are the same call: R rewrites the pipe before it runs
anything. With one verb the pipe has nothing to show, so two scenes in a row gave one
picture and no reason for the second spelling.

**Decided:** the filter lesson introduces the pipe with two steps, not one. A scene
asks "how many people?" and nests two functions, `nrow(filter(ankieta, wiek > 40))`,
read inside out. The next scene writes the same chain with `|>`, read left to right.
The stage draws the same strip of steps and the same result for both, and the text
says so: the pipe changes the order of reading, not the result. The scene with
`filter(ankieta, wiek > 40)` stays, because the pipe hands the table over as the
first argument and the student has to have seen where that is.

The closing lesson's sandbox gains one chip: its four steps written as one nested
call. Four levels of brackets make the case without a sentence.

`test/bundle.mjs` checks that the two scenes draw the same chain of three steps and
print the same output (mutation-checked: a different condition in one of them fails).

## D31 — On a phone the table's frame follows the new column and shrinks with the table

Two faults showed at 375 px in the scenes that open the verb lessons (D29). In
`mutate()` the new column joined beyond the right edge of the frame, so the stage
"po" looked like "przed" while the caption announced a column. In the closing
lesson the last table has three rows, yet the frame kept scrollbars, because rows
and columns that have left stay in the DOM, faded, at their old places.

**Decided:** when a stage adds a column, the frame scrolls until that column's right
edge is in view, and scrolls home on a stage that adds none. The table clips what
lies outside its current size, so faded rows no longer hold the frame open. It
shrinks over 0.6 s, so rows fade before they are cut, and grows at once, so a column
that joins is never cut and the frame can scroll to it straight away. In a background
tab, which draws no frames, the scroll is instant.

`test/pictures.mjs` checks where the frame is sent (mutation-checked). The scrolling
itself was measured in a browser at 375 px: every stage of every picture, the new
column inside the frame, no scrollbars left on the short tables, the page itself
never scrolling sideways.

## D32 — Row numbers stay in place when the table is scrolled

Once the frame follows a new column (D31), the row numbers scrolled out of sight
with the left columns. They are what says a row is the same row before and after,
so they are the last thing that should leave.

**Decided:** the number of each row sticks to the frame's left edge, opaque, and the
cells pass under it. The table clips with `overflow: clip`, not `hidden`, because a
hidden box would itself become the scroller the numbers stick to. The frame has no
left padding in these scenes, so nothing shows beside the numbers.

This is layout only, so it was measured in a browser, not in the headless suites: at
375 px and at 1024 px, on all 18 stages, with the frame at rest, at its far end and
halfway, every visible row number sits on the frame's left edge.


## D33 — The units are exercises, grouped under two lectures

The trainer called its 17 units lessons ("Lekcja 3 z 17"). In the course they are
not lessons. The teacher gives two lectures, and students work through the units
after each one. Lecture 1 is everything before dplyr, lecture 2 starts with
`filter()`.

**Decided:** a unit is an exercise ("Ćwiczenie 3 z 17") everywhere a student or
the teacher reads it. The contents list groups them under "Wykład 1. Podstawy R"
(exercises 1-10) and "Wykład 2. dplyr" (11-17), and the modules stay as
subheadings. Each lesson object carries `lecture`, next to `module`.

Numbering stays 1-17 across both lectures, so saved progress, cross-references in
the texts and report lines keep their meaning. The scenes are unchanged: a student
who missed the lecture can still work alone. In the code the word stays `lesson`;
only the Polish text changed.

The report changes wording with it ("Ukończone ćwiczenia", "ukończone",
"rozpoczęte"). Its check code is a hash of the text, so reports written before
this still check. The checker reads both wordings (`rep.totalWas`, `rep.doneWas`,
`rep.startedWas`), so their facts still come out too.

`test/lessons.mjs` checks the split and that the menu order is the walking order.
`test/people.mjs` checks that a report in the lesson wording still reads. Both
were mutation-checked.

## D34 — Lecture 3 "Szybkie analizy" starts: recoding with if_else() and case_when()

After exercise 17 a student has the five verbs and the pipe, and cannot yet do what
every survey report needs: recode answers, count percentages, cross two variables,
attach a second table. Lecture 3 is the second half of syllabus topic 2, one
exercise per such question (the list is in `docs/curriculum.md`). They are built one
at a time; this record covers the first, exercise 18.

**The engine** gained `if_else()` and `case_when()`. Both refuse to mix text and
numbers in one column, as dplyr does and base `ifelse()` does not. An NA condition
claims nothing. `case_when()` is a special builtin: it receives `condition ~ value`
unevaluated and evaluates each side in the caller's data mask. Eleven reference
cases run against real R. Writing them showed that a table printed a missing text
as `NA` where R prints `<NA>`; that is fixed in `formatDataFrame`.

**The picture** (`src/ui/viz/recode.js`) is one line per row and one column per
condition, in reading order. The condition that took the row is lit and the ones
after it are blank, because R never looked at them. The caption names what went
unnoticed (`recodeTraps`): a condition that is TRUE somewhere yet got nobody, rows
no condition took, rows with no answer that `.default` took anyway. The engine
reports this in one `RECODE` event; the picture computes nothing about R itself.

**The exercise** makes the same point about missing data as the rest of the path, in
a new place: person 6 gave no age, ends in no group, and with `.default = "50+"`
is counted among the oldest.

`test/pictures.mjs` checks who took each row in all four scenes and each trap.
Swapping "first TRUE" for "last TRUE", and letting NA count as TRUE, both fail these
claims and the R reference cases.

Counts that follow the number of exercises are no longer written into the tests as
17: `test/people.mjs` reads `LESSONS.length`, `test/bundle.mjs` holds one constant.

## D35 — What a walk through the live site as a student found

On 2026-10-06 the published site was walked from "Kim jesteś?" to the report, by
clicking its buttons and typing into its editor: 18 exercises, every R step of
every scene, every sandbox chip, 81 anticipated wrong answers, the report and its
check, a second person at phone width. The exercises held. The sandbox did not:
code a beginner types on their own met four faults the lessons never touch.

**Decided:**

- `filter(wiek = 40)` stops with "Czy chodziło o `wiek == 40`?", as dplyr does. It
  used to treat the named argument as a condition that is always TRUE and hand back
  every row. One `=` for two is the commonest slip a beginner makes, and the trainer
  answered it with a plausible table.
- Group keys sort as their type: numbers as numbers (they sorted as text, so 100
  came before 5), FALSE before TRUE, a factor by its levels and not its labels, and
  a missing key last.
- `count()` knows its own settings `sort` and `name`. `count(x, sort = TRUE)` ended
  in the trainer's "internal error" message, as did a misspelt column name.
- A key of `group_by()` and `count()` may be computed or named (`wiek > 40`,
  `grupa = plec`). It joins the table as a column first, which is what dplyr does.
  One helper, `groupingKeys`, serves both verbs.
- `read.csv2()` no longer promises "an exercise about data". It points to the page
  that does show reading a file, "Dalej w RStudio".

Left as it is, on purpose: `mean()` of text is an error here and a warning with NA
in R. Exercise 2 is built on it and the RStudio page says what R itself does. Text
keys still sort by Polish rules where dplyr 1.1 uses the C locale. No exercise
groups by such text, but the sandbox can: `count(wyksztalcenie)` gives "średnie"
then "wyższe" here and the reverse in RStudio. That is open, and its own decision.

Eleven more reference cases run against real R, and three behaviour checks cover
the messages. Each fix was mutation-checked: undoing it fails a test.

The walk itself is not a suite. It ran in a browser against the live site, and its
gap is the one that let these through: the suites run the code the lessons contain,
not the code a student invents. The sandbox deserves its own list of beginner
inputs next.

## D36 — A student's own report brings their progress to another computer

Progress lives in the browser it was made in (D17). A student who works in the lab
and opens the trainer at home starts from nothing, and their progress stays on the
lab computer. The question was raised as "accounts".

Accounts would need a server, would put students' names and progress on it, and
would end both "nothing is sent" and "one file that works offline". For eighteen
exercises that is out of proportion, and it is not a decision the trainer can take
for the university.

**Decided:** the report is the carrier. It already says, per exercise, what was
done, and it already has a check code. "Kim jesteś?" gains a link, "Masz raport z
innego komputera? Przywróć postęp": the student pastes their report, and if its
code holds, continues under the name on it with the progress in it. The report
screen now tells the student to send the text to themselves as well.

- The format of the report did not change, so reports already handed in work too.
- Lines go to exercises by title, not by number. A report keeps its meaning when
  exercises are added. A title that no longer exists is left out and counted on the
  screen, never guessed.
- Bringing a report only adds (`restorePerson`): a finished exercise stays finished,
  the first finishing date stays, counts take the larger number. Pasting an old
  report after working on does no harm.
- What a report does not hold does not travel: the code saved in tasks and the
  place in an exercise.
- A report restores only under its own name. Changing the name breaks the code.
  The code stops a hand edit, not a programmer, as before; forging one gains
  nothing that forging the report itself would not.

Known limit: on a shared computer two students with the same name are one person
(D16 asks them to add an initial). A report pasted there merges into that person.

`test/people.mjs`: a report brought to a browser that never saw the student gives
back the same report, to the character; work done since is kept; a changed report
brings nothing; a report from the 13-lesson version brings what still exists.
`test/bundle.mjs` does it through the screen, after removing the student's data.
Four mutations of the merge and of the check were tried; each fails a test.

## D37 — Exercise 19, percentages; and the verbs learn what a group is

Exercise 19 is one line, `mutate(procent = n / sum(n) * 100)`, shown three times
with three wholes: everyone asked (50% say "dobra"), everyone who answered (62.5%),
everyone in that city (Kraków 66.7%). None is wrong. Each answers another question,
and the line itself never changes: what changes is the `filter()` before it and the
`group_by()` before it. The task asks for the share of answers in each city, so it
needs both.

Writing it showed that the engine did not know what a group is outside
`summarise()`. `group_by(miasto) |> mutate(p = n / sum(n))` divided by the sum of
the whole table and printed the result without a word. The same held for
`filter()`, `slice()` and `count()` on a grouped table. No exercise used them that
way, so no test saw it; a student in the sandbox would have got a plausible wrong
table.

**Decided:**

- After `group_by()`, `mutate()` and `filter()` evaluate their expressions inside
  each group (`sum(n)`, `mean(wiek)`, `n()` are the group's), `slice(1)` is the
  first row of each group, and `count()` counts inside the groups. `arrange()` still
  ignores groups, as in dplyr. One helper, `groupsOf`, serves all four.
- A grouped `mutate()` reports its groups in the trace event. The picture colours
  the rows by group and the caption says the column was worked out inside each.
- The task accepts rounded percentages (33.3 for 33.33333): rounding is not a
  misunderstanding. Its diagnosis reads which whole the numbers add up to (100 per
  city, per answer, or for the table; or 1), so "you forgot `group_by()`" and "these
  are fractions" are told apart from the values, not from the code.

Sixteen reference cases run against real R (`ave()` on the base side). Turning the
group handling off in any one of the four verbs fails them.

R prints the grouped percentages as `25.00000`, because the column holds
`66.66667` and a column is printed to a common number of digits. The trainer prints
the same. It is ugly and it is what a student will see in RStudio.

## D38 — Exercise 20, the cross table; pivot_wider() and its picture

`count(miasto, plec)` holds the answer as a list of pairs. A report shows it as a
cross table. `pivot_wider()` changes the shape and not one number, so the exercise
is about the one thing the shape does change: a pair nobody belongs to has no row
in the long table and must have a cell in the wide one. That cell is NA. For
counts it means zero and `values_fill = 0` says so. For means it means "nobody to
average", and filling it would invent an answer. The same gap is shown both ways,
and the task asks for the counts turned the other way round, gap filled.

**The engine** gained `pivot_wider(names_from, values_from, values_fill)`. New
columns and rows come in order of first appearance, as in tidyr. Two rows for one
cell are refused with "count or summarise first": tidyr would build list-columns
there, which answers nothing a first-year student asked. The arguments must be
named; a missing one, a misspelt column and a positional argument each get their
own sentence.

`summarise()` now keeps every grouping level but the last, as dplyr does. With
grouped `mutate()` in place (D37) the difference is visible: `group_by(miasto,
plec) |> summarise(n = n()) |> mutate(n / sum(n))` gives shares within a city.

Logical values in group labels and new column names read `TRUE` and `FALSE`, not
`true` and `false`. The reference cases showed it.

**The picture** (`renderPivotWider`) puts the long table above the wide one and
gives each value of `names_from` one colour: a row of the long table wears the
colour of the column it goes to, and so does that column. A cell no row went to is
hatched. The engine reports, per cell, which row fed it; the picture works nothing
out.

Six reference cases against real R (`table()` and `tapply()` on the base side) and
one behaviour check for the refusals. Four mutations were tried: a gap turned to 0
unasked, `values_fill` ignored, `summarise()` dropping all groups, a repeated cell
taken silently. The last one passed until the behaviour check was added.

## D39 — Exercise 21, a battery of questions; pivot_longer()

Three questions on one scale arrive as three columns, and every summary has to be
written three times. `pivot_longer()` folds them into two, which question and which
answer; one `group_by(pytanie)` then summarises all of them. The first scene shows
the hand-written version so the gain is seen, not asserted.

The price is what a row means. Six people become eighteen rows; from there on a row
is an answer, `count()` counts answers, and it counts the empty ones too. The
caption of the picture says it every time: "Wiersz to już nie osoba."

**The engine** gained `pivot_longer(cols, names_to, values_to, values_drop_na)`.
The columns to fold are chosen as in `select()`: `p1:p3`, `c(p1, p3)`, `-c(id,
plec)`. `select()` and `pivot_longer()` also learnt `starts_with()`,
`ends_with()`, `contains()` and `everything()`. `starts_with("p")` on this table
catches `plec` as well; folding text with numbers is refused with a sentence that
names the columns, which is the lesson a student needs at that moment.

`names_to` and `values_to` name columns that do not exist yet, so they are text in
quotes, while the columns to fold are written bare. A bare new name gets its own
message with the corrected line in it.

**The picture** (`renderPivotLonger`) mirrors exercise 20: the wide table above
with one colour per folded column, the long one below with each row wearing the
colour of the column it came from. Only the rows of the first two people are
drawn; the pattern is complete after two.

**The task** gives the folded table and asks for the mean of each question by sex.
`group_by(pytanie, plec)` is the same answer with its rows in another order, so
`valuesEqual` gained `ignoreRowOrder`, off unless a task asks for it. The picture
of goal and answer uses the same rule, so it turns green with the verdict.

Found on the way: a printed table left-aligns its row labels in R ("9 " above
"10"). The trainer right-aligned them, which only shows from ten rows up; no
reference case had that many. Fixed in `formatDataFrame`.

Seven reference cases against real R, four mutations, and a check that a success
line holds no markup (it is shown as plain text, and one had backticks).

## D40 — Exercise 22, two tables; left_join() and its family

The question is about regions and the survey holds only the city. The region lives
in a second table, one row per city, and `left_join()` brings it over. Nothing is
computed, so a join looks harmless; it is the one verb on the path that changes
the number of rows without being asked to.

The exercise shows three silent outcomes on one small survey. A city missing from
the second table leaves the person with NA: honest, and visible in every later
count. `inner_join()` drops that person, and the table is a row shorter with no
word about it. A city listed twice in the second table gives each of its people
twice: six respondents become eight. The habit taught is one line long: after a
join, count the rows.

**The engine** gained `left_join`, `inner_join`, `right_join`, `full_join`,
`semi_join` and `anti_join` as one function with a table of what each keeps. Rows
come in the order of the left table, partners in the order of the right one, and
rows the right table holds alone are appended; NA meets NA, as in dplyr. A column
name on both sides that is not a key gets `.x` and `.y`. `by` is read as
`"miasto"`, `c("a", "b")`, `c("lewa" = "prawa")`, `join_by(a)`,
`join_by(a == b)`, or by position; without it the common columns are used and the
line `Joining with ...` is printed, as R prints it.

`by = miasto` is what a student writes after a chapter of bare column names. It
gets its own message with the corrected line. A text key against a number key is
refused, as dplyr refuses it. A key repeated on both sides gives a warning, on one
side only it gives none: that is dplyr's rule, and the reason the doubled rows of
a one-to-many join are the dangerous case.

Not carried over: `suffix`, `keep`, `relationship`, `na_matches`. They are refused
by name with a sentence about what a join needs.

**The picture** (`renderJoin`) is the first with two tables in. Left and right
tables stand above, the result below, and one colour runs through a key value: a
person, the city they matched and the row they make together. What has no partner
has no colour. A left row that stays empty is flagged in the warning colour, and
its NA cell is dashed; a row that does not come along is struck out. The palette
skips the hue that sits next to the warning colour. `semi_join` and `anti_join`
draw no result table: they only keep or strike rows of the left one.

The caption (`joinCaption`) is ordered by what should worry a student first: rows
that multiplied, then left rows with no partner, and only then what the right
table held that nobody asked for.

**The task** asks how many people answered in each region. The check requires
`left_join` and ignores row order; `group_by(region) |> summarise(n = n())` is
accepted. Wrong answers are told apart by what the counts add up to: fewer than
six is `inner_join()`, more than six is a second join that multiplied rows, and a
region nobody answered from means the tables were swapped.

Left as it is: `slice(which(plec == "K")[1])` fails here, because `slice()` does
not see columns. dplyr does. Found while writing a test for this exercise.

Fifteen reference cases against real R, with the base-R side written with
`match()`; dplyr is not installed locally, so the row order of `right_join` and
`full_join` rests on dplyr's documentation, not on a run. Two behaviour checks,
twelve picture claims, twenty mutations, all caught.

## D41 — A second task "dla chętnych" in the exercises of lecture 2

Lecture 2 takes a strong student about 45 minutes and a weak one up to two hours
(an estimate from the amount of material, not a measurement). The strong ones need
something to do; the weak ones must not get more to do.

**A lesson may hold `extra`**, a second task of the same shape as `task`. It is one
more step after the task, drawn by the same screen. It has its own hints, opened
solution, saved code and goal.

**It never finishes the exercise.** Its record lives inside the exercise's own,
under `extra`, and never touches `status`. The count of finished exercises, the
menu tick and the way to the next exercise depend on the first task alone.

**It is offered late and never stands in the way.** The button "Zadanie dla
chętnych" appears on the task step only once the exercise is finished; before that
it would be one more thing to do for someone still working. "Następne ćwiczenie"
stays the main button on both steps. The step's dot is dashed and is always
reachable, so a student who wants it earlier can open it.

**The report says it only when solved**, as one more fact on the exercise's line
("zadanie dla chętnych"), so it reads as a plus and its absence as nothing. A report
brought to another computer brings it along. Attempts and hints of the extra task
are kept but not reported.

**No new material.** Each extra task joins the exercise's verb with earlier ones
and has one trap:

| Exercise | Extra task | Trap |
|---|---|---|
| filter() | men over 35 who answered | `wiek > 35` lets the NA row through |
| select() | rating at least 4, keep city and age | `select()` first removes the column the filter needs |
| mutate() | TRUE where age is above the mean, three columns | a typed number instead of `mean(wiek)` |
| arrange() | answered only, best rating first, older first on a tie | one tie in the data: without the second column the order differs |
| group_by() | people over 40 against the rest | the group is not a column yet; the NA sits in the older group |
| n(), count() | answers per city, most first | without the filter Warszawa has 3, with it 1 |
| pipeline | cities with at least two answers | `filter()` after `summarise()`; `n()` without the first filter counts respondents |

The counting task requires no call: `count(sort = TRUE)` and `group_by()` with
`sum(!is.na(ocena))` are the same answer.

Tests: every check a task gets, the extra task gets too (solution passes, starter
does not, budgets, near-misses). Three more for extra tasks only: it asks for
something else than the task (neither solution passes the other check), its
solution fits the code box, and every message is reached by a near-miss. The
bundle test solves each extra task before the task itself and checks that the
exercise stays unfinished. Twenty mutations, all caught; two survived the first
run (the way on led through the extra task; the extra step offered the first
task's saved code) and got checks of their own.

Not done: extra tasks for lectures 1 and 3; a starter with gaps for students who
fail a task twice. The second would help the weak more than this does.

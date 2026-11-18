# Lab 3: RMarkdown, the model as a report (plan)

Syllabus topic 3 (RMarkdown). Status: plan, 2026-11-16; decisions in section 11.

## 1. Place and goal

Lab 3 follows lab 2 (caret, D114, D121), as decided in `docs/lecture-6-design.md`,
section 9, item 6: "lab 2's script becomes a `.Rmd` report". Lab 2 ends with question
10, "trzy zdania do raportu", written as comments in an `.R` file. Lab 3 turns the same
analysis into a report a reader can open: text, numbers and one plot in one HTML file,
rebuilt from the data by one click (Knit).

The one idea, said on the page and repeated in the questions: **a number in a report
comes from code, not from the keyboard.** Exercise 41 already says it for one sentence;
here the whole report obeys it, and the student sees why when a changed seed rewrites
every number by itself (question 7).

No new statistics. Everything the report says the student computed in lab 2, so the
whole lab is about the form: a reproducible document.

Like lab 2, it is homework from start to finish (section 11).

## 2. Input and output

- **In:** the page `lab/lab3.html`, a starter `lab/lab3.Rmd` (YAML header, section
  headings, empty chunks, comments saying what goes where) and the data file
  `ess_polska.sav` from labs 1 and 2. The student's own `lab2_Nazwisko.R` is the
  source to copy code from; a student who did not finish lab 2 can still do lab 3,
  because every question names the code it needs.
- **Out, handed in on Moodle:** `lab3_Nazwisko.Rmd` and the knitted
  `lab3_Nazwisko.html`. The `.Rmd` shows the work; the HTML shows it knits. A report
  that does not knit is not a report (said on the page).

## 3. What the student learns

Five things, each met in a question and each named on the page:

1. **An `.Rmd` file has three kinds of content.** The YAML header between `---` lines
   (title, author, date, output), text with a few Markdown marks (`#` heading, `**bold**`,
   `-` list) and code chunks between ```` ```{r} ```` and ```` ``` ````.
2. **Knit runs the file from scratch, in a fresh R session.** Objects made in the console
   do not exist there; the working directory is the folder of the `.Rmd`. This is the
   trap behind most failed knits (section 6).
3. **Inline code**: `` `r nrow(net)` `` in a sentence puts the number in the text. With
   `round()` it prints as a reader expects.
4. **Chunk options decide what the reader sees.** `echo = FALSE` hides code and keeps the
   result; `include = FALSE` runs and hides both (setup); `message = FALSE` silences
   package messages such as caret's "Ładowanie wymaganego pakietu".
5. **A plot is a chunk.** ggplot2 from lecture 4 and exercise 42 draws the points; the
   page gives `geom_smooth(method = "lm")` for the line; `fig.cap` gives it a caption.

## 4. The report the student writes

Five sections, the shape of a short research note. The starter has the headings; every
number in the text is inline code.

| Section | Content | From lab 2 |
|---|---|---|
| Pytanie | One sentence: how well does age predict daily minutes online for a new person? | intro |
| Dane | ESS round 11, Poland; n after removing missing values, inline | Q1 |
| Metoda | 80/20 split, linear model, 5-fold cross-validation, seed 2026; one paragraph | Q2, Q3 |
| Wyniki | A table of models by error (mean only, line, curve, knn) with `knitr::kable()`; the plot of the points with the line; the forecast for a 35-year-old | Q3-Q7, Q10 |
| Wnioski | Three sentences: the chosen model, its error in minutes and the method, what it cannot do | Q10 |

Code is hidden in the report (`echo = FALSE` in the setup chunk), as in a report for a
reader; the `.Rmd` shows it to the teacher. Classification (lab 2, Q9) and more
variables (Q8) stay out: one model, told well.

## 5. Questions

> **As built (D128):** nine questions. Question 5 of the list below was split into
> models (5) and a captioned table (6); the plot and conclusions became 7 and 8, the
> hand-in 9. Every student uses an own seed, `ziarno` (the last four digits of the index
> number), set once in the setup chunk and used in every `set.seed(ziarno)`; the
> answers to the "why" questions go into a last section, "Odpowiedzi na pytania".

Eight questions, in order; each builds on the previous one and ends with a Knit. The
first knit comes in question 1, so installation problems surface before any work.

1. **Pierwszy raport.** Open `lab3.Rmd`, save it as `lab3_Nazwisko.Rmd`, press Knit.
   An HTML page with the headings opens. (Checks that rmarkdown is installed.)
2. **Nagłówek.** Fill the YAML: title, own name as author, date. Knit; where did each
   field go?
3. **Przygotowanie.** The setup chunk: `library()` lines, `read_sav()`, and
   `knitr::opts_chunk$set(echo = FALSE, message = FALSE)`, with `include = FALSE`.
   Knit; why is nothing from this chunk on the page?
4. **Dane.** The chunk making `net` (lab 2, Q1); a sentence with `` `r nrow(net)` ``
   people. Knit and compare with the number from lab 2.
5. **Model i tabela.** The split, the line with cross-validation, the mean-only error and
   the curve; a `data.frame` of models and their errors, printed with `knitr::kable()`
   and rounded to whole minutes.
6. **Wykres.** Points of `uczace` and the model line with `geom_smooth(method = "lm")`,
   axis labels in Polish, a caption in `fig.cap`. Many points overlap: `alpha` helps
   (named in the hint).
7. **Wnioski z liczbami z kodu.** Three sentences with inline numbers: the error, the
   method, the forecast for a 35-year-old. Then change `set.seed(2026)` to another number
   and knit again: which numbers in the text changed, and why did nobody have to retype
   them? Put the seed back.
8. **Oddanie.** Knit once more from a freshly restarted R (*Session → Restart R*), check
   the HTML top to bottom, hand in both files.

## 6. Traps and their messages

The page names each trap with the message the student will see. The exact wording
(Polish locale RStudio, current rmarkdown) must be copied from real knits during
verification, not guessed; the list below is what to provoke.

| Trap | What happens | Repair named on the page |
|---|---|---|
| Object made in the console only | Knit stops: `nie znaleziono obiektu 'net'`, with `Quitting from plik.Rmd:` and the lines | Every object is made in a chunk above its use |
| `library()` run in the console only | `could not find function "train"` | `library()` lines in the setup chunk |
| Data in another folder | `'ess_polska.sav' does not exist` | `.Rmd` and `.sav` in one folder; knit uses the `.Rmd`'s folder |
| `setwd()` with a full path copied from lab 2 | Knits on the student's computer only | No `setwd()` in a report |
| caret's messages and `train()` printout in the HTML | A report full of console text | `message = FALSE`; print only what the reader needs |
| Inline number unrounded | "myli się o 94.26381 minut" | `round(x)` inside `` `r ` `` |
| A chunk error | Knit stops with the line numbers of the chunk | Run the chunk alone first (green arrow), then knit |
| `install.packages()` left in the file | Knit reinstalls or fails | Install in the console, never in the report |
| Inline code inside an HTML comment | Knit runs it anyway and may fail | Write no inline code in comments |

## 7. At the lecture

Lab 3 is homework, so the lecture is the only time students see Knit next to the
teacher, including Knit failing. It shows **why** and **how it breaks**, not Markdown
syntax (that is a cheat sheet on the lab page). About 25 minutes, live in RStudio, no
slides.

> **Changed (D128):** run the live lecture from `lab/lab3-wyklad.Rmd` itself, so students
> later read exactly what they saw: step 1 is its part 2 (anatomy), step 2-3 its part 1
> (change the seed in `blad(7)`, watch 197 follow), step 4 deletes the `blad` function
> from the setup chunk and knits (the clean room), step 5 is its part 6. The demo files
> below stay as the fallback and for the typed-number scene.

The demo files are in `docs/rmd-demo/`: `raport-demo.Rmd` is the starting state with the
steps as HTML comments, `raport-demo-gotowy.Rmd` the finished report (the fallback if
the live edits go wrong). Both need `ess_polska.sav` in the same folder and the packages
haven, ggplot2 and rmarkdown. They use `lm()` and a hand-made split, as exercises 43-44
do, not caret: fewer packages, a faster knit on a lecture computer. The line is drawn
with `se = FALSE`: the grey confidence band is not taught and would draw a question.

**Knitted 2026-11-16** in WSL Ubuntu on the PC (R 4.5.2, rmarkdown 2.30, knitr 1.51,
ggplot2 4.0.2, pandoc 3.7, Polish locale). Both files knit. The numbers the lecture
will show: n = 1039, `rmse` 200.9958, so "o 201 minut"; with `set.seed(7)` 196.6 and
"o 197 minut" (step 2 and 3: a small change, but visible); the mean 231 minutes; the
forecast for a 35-year-old 251 minutes. The start state prints
`` `geom_smooth()` using formula = 'y ~ x' `` under the plot, which step 5 removes.
The rendered pages are kept next to the files (`raport-demo.html`,
`raport-demo-gotowy.html`) as the fallback for a failed knit in the room.

| Step | Minutes | What happens | What students take away |
|---|---|---|---|
| 1. Anatomy | 5 | Open `raport-demo.Rmd`: the header between `---`, text, chunks. Knit. Show where each part went in the HTML; the date comes from code. | An `.Rmd` is text plus code, and Knit turns it into a page |
| 2. The problem | 4 | Type the number from the `rmse` printout into the blank in Wnioski. Knit. Change `set.seed(2026)` to another number, Knit again: the printout changed, the sentence did not. | A number typed by hand goes stale, and nobody notices |
| 3. Inline code | 5 | Replace the typed number with `` `r round(rmse)` ``. Knit; change the seed again; Knit. The sentence follows. Put 2026 back. | A number in a report comes from code |
| 4. The clean room | 5 | In the console: `srednia <- 180`. In Wnioski: a sentence with `` `r srednia` ``. Knit fails: `nie znaleziono obiektu 'srednia'` and `Quitting from raport-demo.Rmd:67-67` (the line of the sentence). Read the message aloud. Repair: make `srednia` in a chunk (`mean(net$netustm)`). | Knit sees only what the file makes; read the message, find the line |
| 5. For the reader | 4 | In the setup chunk `echo = FALSE, message = FALSE`. Knit: the code, the printouts and the `geom_smooth()` message disappear; the text and the plot stay. | A report is for a reader; the `.Rmd` keeps the code |
| Bridge | 2 | "Lab 3 is this, with your model from lab 2." Show the lab page. | |

Steps 3 and 4 are the core; if time runs short, shorten 1 and 5, never these.

**Preparation.**
- Knit both files on the lecture computer before the lecture (rmarkdown installed,
  pandoc found, the `.sav` next to the files). Keep screenshots of both HTML pages in
  case Knit fails in the room.
- Start from a restarted R, so the console holds nothing the demo did not make.
- **Do not write inline code inside an HTML comment**: knitr runs it there too. The step
  notes in `raport-demo.Rmd` therefore say "r round(rmse) w odwrotnych apostrofach"
  instead of writing it. (Found while writing the demo: a `` `r srednia` `` in a comment
  would break the very first Knit.)

**Not shown:** Markdown syntax beyond `#`, `**` and `-`; PDF and LaTeX; themes;
parameters; bookdown; Quarto beyond one sentence that it works the same way.

**Built 2026-11-16 (D124): the lecture as an `.Rmd` and the "anatomy" page.** The author
asked for part of the topic as a lecture students can read, and for the illustration of
what happens on the way to HTML. Both are files, not trainer exercises:

- `lab/lab3-wyklad.Rmd`, knitted to `lab/lab3-wyklad.html`: the lecture is itself an R
  Markdown report and says so. Six sections follow the live steps: why (the typed 201
  against 197 after another seed, both computed in the file), the three kinds of
  content (the source shown with the `` `r ''` `` trick so knitr does not run it),
  inline code (`knitr::inline_expr()` shows the syntax; an unrounded mean shows why
  `round()`), Knit from scratch (the real `nie znaleziono obiektu` message and how to
  read `Quitting from`), chunk options in a table with a live `echo = FALSE` table, and
  what next. Base R and haven only.
- `lab/lab3-anatomia.html`, "Co robi Knit": the small `lab/lab3-przyklad.Rmd` on the
  left; a click on a part shows what became of it in knitr's `.md`, in pandoc's HTML
  and on the page, with a note and the changed values marked (`` `r nrow(net)` `` →
  1039). All three stages are the real output of one knit (`keep_md = TRUE`,
  `self_contained = FALSE`); `lab/tools/make-anatomia.py` builds the page from them by
  line ranges, so the page holds no invented character. Re-knit and rerun it when the
  example changes. The example avoids a trap found while writing it: a rounded table
  (282, 191) next to an inline difference of unrounded means (92) reads as an error.
  The example is named `lab3-przyklad.Rmd`, not `lab3-anatomia.Rmd`, because knitting
  it in `lab/` would overwrite the page.

## 8. The trainer's part

None, as decided: RMarkdown is real RStudio work, and a simulated Knit would teach a
fiction (`docs/curriculum.md`, the out-of-scope row). The trainer gets only:

- the menu link "Laboratorium 3 w RStudio" after lab 2 (`menu.lab3`);
- one sentence in the note of exercise 41, which already teaches the sentence for a
  report: in lab 3 the numbers in that sentence come from code (optional; section 11).

## 9. Files

| File | Public | Content |
|---|---|---|
| `lab/lab3.html` | yes | the page, lab 2's look (light and dark, phone width) |
| `lab/lab3.Rmd` | yes | the starter: YAML, five headings, empty chunks with comments |
| `lab/ess_polska.sav` | yes | already hosted |
| `lab/lab3-klucz.Rmd`, `lab/lab3-klucz.html` | no, `.git/info/exclude` | the solved report and its knit |
| `lab/PLAN3.md` | no | the key's numbers and the provoked messages |

`build.mjs` adds `lab3.html` and `lab3.Rmd` to `LAB_FILES`; the Pages workflow copies
them. An `.Rmd` must download, not open as text: check its MIME type on GitHub Pages and
use `download` on the link, as for `lab2.R`.

## 10. Verification

- **Where.** Windows R on this PC cannot load compiled packages (Smart App Control,
  since 2026-11-13), so R runs in **WSL Ubuntu** on the PC (set up 2026-11-16: R 4.5.2,
  caret 7.0.1, haven, dplyr, ggplot2, rmarkdown, pandoc, `pl_PL.UTF-8` for Polish
  messages). The key is knitted and the traps provoked there or on the Mac. Messages
  from Rscript in WSL can differ in detail from RStudio on Windows (for example
  "BŁĄD:" against "Błąd"); the wording copied to the page is checked once in RStudio.
- **The key.** `lab3-klucz.Rmd` knits from a restarted R; its numbers equal lab 2's key
  (n, the errors, the forecast for a 35-year-old). This also settles the open Q10 line
  of lab 2's key (259.63, computed by hand).
- **As a student.** Solve from the page and the starter only, in order; provoke every
  trap of section 6 and copy each message as RStudio prints it.
- **The page.** Phone width with no horizontal scroll, both themes, links and downloads
  live after deploy, `.Rmd` downloads rather than opens.
- **Suites.** `node test/run-all.mjs` (the bundle test knows the menu links); build.

## 11. Decisions (answered 2026-11-16)

The author took the recommendations as they stood.

1. **Homework** from start to finish, like lab 2 (D121).
2. **R Markdown** (`.Rmd`), as in the syllabus; one sentence on the page says Quarto
   (`.qmd`) works the same way.
3. **caret** in the report: lab 2 already installed it, and the report retells lab 2.
4. **HTML only.** Word would work; PDF needs LaTeX, a long install.
5. **Exercise 41's note** gets a sentence pointing to lab 3.
6. **Grading checklist** on the page, as a draft for the author to adjust: the HTML
   knits from a restarted R; every number in the text comes from inline code; the
   five sections are there; the three sentences of Wnioski say the model, its error in
   minutes with the method, and what it cannot do; no code, messages or `train()`
   printout in the HTML. No points are given on the page.

## 12. Order of work

1. ~~The author answers section 11.~~ Answered 2026-11-16.
2. On the Mac (or WSL): knit both demo files of section 7 and the key `lab3-klucz.Rmd`;
   provoke the traps, record the messages in `lab/PLAN3.md` (local).
3. The starter `lab/lab3.Rmd` and the page `lab/lab3.html` (Polish, full sentences,
   few colons; lab 2's structure: Jak pracować, Gdy utkniesz, Pobierz pliki, Pięć
   rzeczy, Pytania, Źródło danych).
4. Menu link, `LAB_FILES`, README and curriculum rows, decision entry.
5. Solve as a student from the page; fix what confuses.
6. Suites, build, push after "Отправляй", check live, handoff row.

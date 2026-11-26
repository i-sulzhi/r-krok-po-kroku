# Review of topic 7, end to end (2026-11-26)

A full pass over everything a student and an instructor meet in topic 7: trainer exercises
47-54, the lecture page `lab4-wyklad`, the page "Co widzi rvest", lab 4 with its template and
download script, and the instructor's side (timing, key, grading). Each finding says where it
is, what goes wrong, and a proposed fix. Nothing here is applied yet.

Severity: **A** a student gets a wrong result or is stuck; **B** confusing or inconsistent;
**C** polish.

## 1. Trainer, exercises 47-54 (student)

Method: every scene, hint, message and note read in order as a student; scenes 1 and 5 of 51
and the task of 54 walked in the browser (local build); 27 plausible answers that are not in
the near-miss lists run through the engine and the task checks.

What works: the order (string, pattern, cleaning, table, tokens, stop list, forms, pairs) builds
step by step, every lesson uses real sentences from the same day, and every trap is a silent
one (no error, a wrong number). All declared near-misses get their own message. Several
correct variants are accepted: `[Ss]ąd`, `str_subset()` + `length()`, `.*?`, splitting on
`" "`, `[[:punct:]]` instead of edge stripping, `stop[-4]`, two ways of picking "neo".

**1.1 (A) The engine's `summarise()` cannot use a column made earlier in the same call.** *Fixed by D153.*
Real dplyr evaluates `summarise(hit = sum(hit), slowa = sum(slowa), na_100 = 100 * hit / slowa)`
in order, so `na_100` uses the new sums. The engine reads the old column and stops with
"«na_100» zwrócił 4 wartości, a summarise() oczekuje dokładnie jednej", which tells a student
with correct R code that they forgot a summary function. Exercise 50 invites exactly this
form. Where a group has one row the old column has the right length, so the result can also
be silently wrong. `mutate()` chains correctly. Fix in the engine, with an oracle case in
`cases-dplyr.txt`.

**1.2 (B) Pattern symbols are used but never explained.** Exercises 47-48 explain `\\b`,
`\\p{L}*` and `[Ss]`, 49 explains `\\(`, `.`, `*`, `[^)]*`. Then `\\s+` (51 scene 1), `\\S+`
(49 scene 5, 50 hints), `^`, `$`, `|` and `\\p{P}` (51 scene 5), and `^sądow` (53) appear with
no word on what they mean; scene 5 of 51 only says what the whole pattern does. The picture
shows the result, not the symbols, and the glossary has no entry for pattern symbols. Lab 4
question 11 then asks the student to write `"^slowo"`, and the lecture uses `"^[0-9]"`.
Fix: one clause in 51 scene 5 ("`^` to początek słowa, `$` koniec, `|` znaczy albo") and in 53
scene 4; and a small "Wzorce" panel in the glossary listing the dozen symbols of topic 7.

**1.3 (B) Exercise 54 picks by position in the wrong vector, a likely mistake that gets only
"Jeszcze nie to".** `sasiedzi$slowo[which.max(razy[czeste])]` returns "wyboru": `which.max`
counts positions among the six frequent words and the index is then used on all nine. This
is the most natural slip after the hint "szukaj `which.max()` tylko wśród nich". Fix: a
message `position` ("`which.max()` liczy pozycję wśród wybranych słów, więc wybierz je też
z `sasiedzi$slowo`: `sasiedzi$slowo[czeste][...]`"), diagnosed by the value "wyboru".

**1.4 (B) Correct dplyr answers are rejected with the general message.** 53: `formy |>
filter(!str_detect(slowo, "^sądow")) |> summarise(n = sum(n))` gives a 1×1 table with 194.
54: `... |> filter(O11 >= 10) |> arrange(desc(razy))` shows "neo" on top. Both are sound
analysis; the student only hears "Jeszcze nie to". Fix: accept a one-cell table in 53, and in
54 add a message for a data frame ("Tabela jest dobra, ale wskaż jedno słowo, np. przez
`$slowo[1]`").

**1.5 (B) Common functions are missing in the engine:** *Fixed by D153.* `setdiff()` (52, the natural way to
drop "nie"), `n_distinct()` outside dplyr verbs (51), `slice_max()` (54, and used in the
lecture and in lab question 10), `lengths()`. A student gets "Nie znaleziono funkcji", which
reads as a typo. Fix: add the four, each with an oracle case.

**1.6 (B) Exercise 54 never says what a window is.** The setup comment speaks of "oknach" and
scene 2 of "w oknach 1 182", but the window (five words before and after, in one speech)
is defined only in the lecture, and the timing plan puts the trainer before the session.
`E11` is also named only in code. Fix: setup comment "okno to pięć słów przed „krs” i pięć
po nim"; scene 2 say "To liczba oczekiwana, `E11`."

**1.7 (C) Small text points.**
- 48 scene 5 names "Osąd" and "najrozsądniej" as dropped, but three fall out (also
  "osądzania"); the success line says three. Name all three or say "trzy fałszywe trafienia".
- 52: `mowy |> filter(!slowo %in% moja)` (a table of the right words) gets the general
  message; a short `table` message would help.
- 47 scene 6 counts "Krajowa Rada Sądownictwa" as a sentence about courts. Fine for a string
  count, and 48 and 53 come back to it, but a teacher may want to say so aloud.

## 2. Lecture page (student)

Parts 10-12 were reviewed separately (D149). This pass reads parts 1-9 and 13 and the page
as a whole, as a student who opens it before lab 4.

What works: each part shows one silent error on real output (encoding, `h2` and `p` that look
right, `NA` from a typo, rows multiplied by paragraphs, the greedy bracket, truncation before
grouping), every number is computed, and double-click notes explain each line.

**2.1 (A) "Naciśnij Knit, a dostaniesz to samo" is not true for a student before the lab.**
The page invites downloading the `.Rmd` and the page and pressing Knit. The setup chunk loads
readr and tidytext, but the install command for tidytext and stopwords is only in part 10.
A student who follows the first paragraph on a fresh computer gets "there is no package called
'tidytext'" and no page at all. With the packages, parts 10-12 still come out empty, because
`sejm_mowy.csv` exists only after lab 4. Fix: in the first paragraph, give the install line
for all six packages and say that parts 10-12 fill in once the lab table lies next to the file.

**2.2 (C) The download loop in part 7 reuses the name `plik`.** The chunk has `eval = FALSE`,
so Knit is safe, but a student who runs it with the green arrow overwrites `plik`, which parts
4-7 use for the demo page; the next chunk then reads `sejm/138.html`. Rename the loop
variable (`cel`).

**2.3 (C) Lecture `czytaj()` and lab `czytaj()` differ.** The lecture's version has four
columns; the lab's has `wlasny` and splits the chair's remarks. Part 8 explains why, so this
is intended, but a sentence at the end of part 7 ("w laboratorium dostaniesz wersję, która
oddziela też słowa marszałka, zob. część 8") would stop students from pasting the lecture's
version into the lab.

## 3. "Co widzi rvest" (student)

Six preset selectors, a free field, and the switch between `html_elements()` and
`html_element()`; each choice shows the matched code, the page, the R line and what R returns.
Tried: a class typo (`h2.mowa`), a space (`h2 .mowca`), an invalid selector (`p[`). All three
give a clear message and `NA` where R gives `NA`.

**3.1 (C) A space in a selector gets the typo message.** `h2 .mowca` means "a `.mowca` inside an
`h2`", which is a real and common mistake, but the page says "Sprawdź pisownię znacznika
i klasy". Add: "Spacja znaczy: element wewnątrz innego. Bez spacji: jeden element z tą klasą."

## 4. Lab 4 done from scratch (student)

Method: a new folder in WSL R 4.5.2 with the published `lab4.Rmd` and `pobierz_sejm.R` and the
`sejm` folder (the Moodle route; the live download was not repeated); first the empty template,
then a report filled by following every question literally, with "nauczyciel" as the student's
word. Both knit without errors; the full report takes 3 seconds and shows no code, no package
messages and no stray console output. Numbers match the key: 139 pages, 000.html without a
speaker (16.4%), 133 speeches, 40 582 words, KRS first with 61 speeches and 21 180 words.
Question 11 with `"^nauczyc"` gives 12 significant neighbours ("początkujących", "podwyżki",
"wynagrodzenia", "godność").

**4.1 (B) Question 8's table repeats the trap fixed in the lecture (D149).** The code given in
the lab cuts titles from the right at 60 characters, so the two finance points both read
"Sprawozdanie Komisji Finansów Publicznych o rządowym proj…". This is the main table of the
report, and the grading list asks for it. The key has the same line. Fix:
`str_trunc(punkt, 60, side = "left")` in the lab, the hint and the key; the hint already
explains why truncation is dangerous.

**4.2 (B) Question 11 does not warn about two kinds of neighbours that every student will
meet.** Other forms of the student's own word ("nauczyciele", "nauczycieli" next to
"nauczyc…") and numbers ("30", "33", a pay rise in per cent) are among the significant
neighbours. The question names only grammar and hyphen traces. Fix: one sentence in the
hint: "Wśród sąsiadów bywają inne formy Twojego słowa i liczby. Powiedz, co z nimi robisz."

**4.3 (C) Question 10 asks "co się zmieniło" after adding a word to `zwroty`, but the report
only shows the final table.** A student must compare in the console and describe from memory.
Fine as is, but the hint could say "porównaj w konsoli tabelę przed i po".

**4.4 (C) The template's setup comment omits stopwords.** It is right that no `library()` is
needed (the code calls `stopwords::stopwords()`), but a student who reads "Tu wpisz library()
dla rvest, dplyr, stringr, readr i tidytext" and then sees `stopwords::` may add a sixth
library line or wonder whether the package is needed at all. One phrase: "stopwords wystarczy
zainstalować".

## 5. Instructor's side

Read: the timing plan (lecture-7-design, section 4, D151), the local key `lab4-klucz.Rmd`, the
grading list on the lab page, and how students are told what to do when.

What works: the key knits end to end on the real data and answers all twelve questions with
inline numbers; the grading list names the four silent errors; a full Knit of the lecture
takes about 5 seconds, so live re-runs are cheap; the cut order in the timing plan protects
what the lab grades.

**5.1 (A) The timing plan assumes the trainer before the session, but students are told to do
it before the lab.** D151 fits 13 parts into 90 minutes by moving practice out of the room:
"the trainer exercises 47-53 come before the session". The only place a student reads this is
lab 4, step 1 ("Najpierw przejdź w trenażerze ćwiczenia 47-54"), and lab 4 is done after the
lecture. Without the exercises, parts 8-12 meet students who have never seen `str_detect()`
or a pattern. Fix: announce it at the end of session 6 and in Moodle, and add one line at the
top of the lecture page ("Przed wykładem przejdź ćwiczenia 47-54").

**5.2 (B) The instructor's data for parts 10-12 has no written route.** The live demo needs
`sejm_mowy.csv`, which is not published (the hosting question is open). The plan says the
folder "holds" it but not how to make it. Fix: "Knit `lab4-klucz.Rmd` once next to the `sejm`
folder (or the unzipped `sejm_2023-12-20.zip`); it writes `sejm_mowy.csv`." This also lets a
second instructor run the session.

**5.3 (B) No points rubric for lab 4.** The grading list has seven checks but no weights, and
questions 10-11 are open (which word is noise, which neighbours matter). Two instructors would
grade differently. Fix: a short rubric in the key: for example 4 points data and cleaning
(questions 5-7, 12), 2 the table (8), 2 own word (9), 2 keywords and neighbours (10-11), with
what counts as a full answer for 10-11. (The lab 3 checklist is still open in the same way.)

**5.4 (C) The timing plan still says "47-53".** D152 added exercise 54 after D151 was written;
lecture-7-design section 4 should say 47-54.

**5.5 (C) Questions likely from the room, with answers to have ready.**
- "Why does `unnest_tokens()` split KRS-u?" It splits on punctuation; the lecture shows the
  trace ("u", "ie"). A fix in practice: replace `-` inside words before tokenising.
- "Can I use G² with a different window?" Yes; numbers change, so the window is reported.
  Lab question 11 has the student try 2 against 5.
- "Is tf-idf meaningful with 8 points?" Only roughly: it mostly finds words unique to one
  point (lecture part 11 says so).

## 6. Summary and proposed order of fixes

Topic 7 works end to end: every exercise solves, the lecture knits with the data, the lab
knits from the template to a full report in 3 seconds, and the numbers agree across the
trainer, the lecture, the lab and the key. The findings are about what a student meets before
everything is in place, and about answers the checks do not expect.

| # | Severity | Where | Fix | Size |
|---|---|---|---|---|
| 1.1 | A | engine `summarise()` | evaluate arguments in order, with oracle cases | engine |
| 2.1 | A | lecture, first paragraph | install line for six packages; parts 10-12 need the lab table | text |
| 5.1 | A | lecture top, Moodle | "przed wykładem przejdź ćwiczenia 47-54" | text |
| 4.1 | B | lab question 8 and key | `str_trunc(punkt, 60, side = "left")` | text |
| 1.2 | B | exercises 51, 53; glossary | explain `^`, `$`, `\|`, `\\p{P}`, `\\s`, `\\S`; a "Wzorce" panel | lessons |
| 1.3 | B | exercise 54 | message for `which.max()` on a subset ("wyboru") | lesson |
| 1.4 | B | exercises 53, 54 | accept a one-cell table; message for a table answer | lessons |
| 1.5 | B | engine | `setdiff()`, `n_distinct()`, `slice_max()`, `lengths()` | engine |
| 1.6 | B | exercise 54 | define the window and `E11` in setup and scene 2 | lesson |
| 4.2 | B | lab question 11 | warn about own-word forms and numbers | text |
| 5.2 | B | lecture-7-design | how the instructor makes `sejm_mowy.csv` | doc |
| 5.3 | B | key | points rubric | doc |
| 2.2, 2.3, 3.1, 4.3, 4.4, 5.4, 1.7 | C | various | small wording | text |

Proposed order: first the three text fixes that stop a student before the lecture (2.1,
5.1, 4.1) and the lab hint 4.2, one release. Then the trainer: 1.2, 1.3, 1.4, 1.6 in the
lessons, one release. Then the engine (1.1, 1.5) with oracle cases, since it touches every
dplyr lesson and needs the full suite. The instructor documents (5.2, 5.3) can go with the
first release.

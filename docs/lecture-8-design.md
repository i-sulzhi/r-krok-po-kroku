# Lecture 8 design, part 1: from text to words

Session 8 is sentiment on the Sejm corpus from lab 4. Its first part, decided in D145, is the
step lecture 7 left out: preparing text for analysis. Lecture 7 goes from HTML to one clean
string per speech; this part goes from those strings to words that can be counted.

Numbers below were computed in WSL R 4.5.2 with tidytext 0.4.2 and stopwords 2.3 on the lab 4
table `sejm_mowy.csv` (133 speeches, 40 582 words, D143). Script: section 9.

## 1. Why this part, and why here

In real text analysis most of the work is cleaning, and lecture 7 shows only one step of it
(brackets, the chair's remarks, `str_squish()`). The author asked for the rest.

It opens session 8 rather than closing session 7 for two reasons:

- **Session 7 is full.** Its 90 minutes hold rvest and stringr (lecture-7-design, section 4).
- **Cleaning depends on the analysis that follows.** "nie" must stay for sentiment and may go
  for topics; numbers matter for the budget debates and are noise for most questions. So the
  steps are taught right before the analysis that needs them, and session 9 (topics) reuses
  them with a different stop list.

The lab 4 table is the input, so students start from their own data.

## 2. The steps, with numbers

Each step is counted before and after, the rule lecture 7 already teaches ("policz słowa
przed i po").

| Step | Code | Tokens | Distinct forms |
|---|---|---|---|
| Words split on spaces | `str_split(tekst, "\\s+")` | 40 582 | 11 383 |
| Lower case | `str_to_lower()` | 40 582 | 10 715 |
| One word per row, punctuation off | `unnest_tokens(slowo, tekst)` | 40 508 | 8 463 |
| Stop list (stopwords-iso, 356 words) | `filter(!slowo %in% stop_pl)` | 24 598 | 8 187 |
| Own list of forms of address, numbers | `filter(!slowo %in% adres, ...)` | 22 847 | 8 053 |

- **Punctuation glued to words** is the biggest single loss of distinct forms: 7 364 words end
  or start with a sign ("ustawy," "ustawy."), and splitting them off joins 2 252 forms.
- **The stop list removes 39.3% of all words.** The 50 most frequent forms alone are 31% of the
  text.
- **After the stop list the top of the list is still not content.** The first 20 words are
  "panie" 225, "ustawy" 161, "r" 144, "marszałku" 137, "sądownictwa" 135, "sędziów" 134,
  "dziękuję" 128, "krs" 122, "państwo" 116, then "wysoka" 99 and "izbo" 96. Forms of address
  and "r" (from "r.", the year) need a list of one's own.
- **After both lists the debates show through.** The top words per agenda item are KRS
  ("sądownictwa" 130, "krs" 119, "sędziów" 105), the budget law ("mld" 51, "nauczycieli" 37,
  "subwencji" 23) and energy ("węgla" 31, "notyfikacji" 25). This is the bridge to topics in
  session 9.
- **Inflection is the step that cannot be done with a list.** "sąd" and "sędzia" have 34 forms
  and 619 tokens ("sądownictwa" 135, "sędziów" 134, "sądów" 66, "sądu" 51, "sądy" 32, "sąd"
  only 13). 60.9% of the remaining forms occur once. SnowballC has no Polish stemmer, so the
  honest options are lemmatisation (udpipe, section 7) or counting forms and saying so.

## 3. What students get wrong without seeing it

Each trap is silent: the code runs and the table looks fine.

| Trap | What happens | How it is shown |
|---|---|---|
| **"nie" is a stop word** | stopwords-iso drops "nie" (616 times), "tak", "bardzo", "dobrze" and "ale". "Nie popieramy" becomes "popieramy" before sentiment is counted | `c("nie", "dobrze") %in% stop_pl`, then one sentence before and after |
| **The stop list is not neutral** | It keeps "źle", "proszę", "dziękuję", "panie" and drops "pan", "pani". Its choices were made for other texts | Read the list, do not trust it |
| **"państwo" is two words** | 116 tokens, one form. "Szanowni państwo" alone is 42 of them, and "Pozwólcie państwo" is address too, while "państwo" can also be the state. A list cannot tell them apart | Show both kinds of sentence; decide and write the decision down |
| **Hyphens split words** | `unnest_tokens()` turns "PiS-u" into "pis" and "u": 51 stray "u" tokens | The probe sentence below |
| **Abbreviations lose their dot** | "r." becomes "r" (144, second after the stop list), "art." becomes "art"; "m.in" and "2,5" survive whole | Same probe sentence |
| **Numbers are data in a budget debate** | Dropping numbers removes "2,5 mld zł"; keeping them puts "2023" among the top words | Decide per question |
| **Lower case joins what should stay apart** | "PiS" the party and "pis" become one form. Here all 60 are "PiS" in the original, but that has to be checked, not assumed | `str_count(tekst, "\\bpis\\b")` on the original text gives 0 |

The probe sentence (real forms from the corpus, built for the lecture):

```r
probe <- tibble(id = 1, tekst = "Projekt PiS-u, m.in. 2,5 mld zł. Nie popieramy tej ustawy. Art. 10 ust. 2 z 2023 r.")
probe |> unnest_tokens(slowo, tekst) |> pull(slowo)
#  projekt pis u m.in 2,5 mld zł nie popieramy tej ustawy art 10 ust 2 z 2023 r
```

**A box on dirtier text.** The Sejm transcript is unusually clean: no emoji, links, non-breaking
spaces, soft hyphens or decomposed letters (all counted: 0), and only 18 quote marks. Comments
and social media have all of them. One short block names them and the stringr calls that handle them, so
students do not take this corpus as typical.

## 4. The part, about 40 minutes

Live in RStudio on the lab 4 CSV. The second part (about 50 minutes) is sentiment and is
designed separately once the lexicon is chosen (section 8).

| Min | Step | What students take away |
|---|---|---|
| 0-5 | **Why clean?** The top 10 words of the raw text: "w", "i", "to", "nie", "na". Nothing about the debates | Counting raw words counts grammar |
| 5-15 | **One word per row.** `unnest_tokens()`, the probe sentence, before and after counts | Tokenising is already a set of decisions |
| 15-25 | **Stop words.** The list, 39% of words gone, then the top 20 still full of "panie" and "marszałku"; an own list | A stop list is borrowed; read it and add to it |
| 25-32 | **The "nie" trap.** It is on the list. For sentiment it must stay | Cleaning depends on the question |
| 32-37 | **Forms of a word.** 34 forms of "sąd" and "sędzia"; no Polish stemmer; what lemmatisation would do | Polish needs lemmas or an honest caveat |
| 37-40 | **Write it down.** A table of steps with counts, as the start of the report's method | Every step is a decision a reader must see |

If time runs short, lemmatisation is said in one sentence and shown ready in the lecture page.

## 5. The trainer

Built as exercises 51-53 (D146), appended after exercise 50 so no number in the labs moves.
The engine has stringr but no tidytext, so the exercises use `str_split()`, `str_to_lower()`
and `%in%` on short real sentences, and the lecture shows `unnest_tokens()` in RStudio.

- **51, one word per row.** A speech fragment split into words; punctuation glued to "ustawy,";
  how many distinct forms before and after. Silent trap: "PiS-u" split in two.
- **52, stop words.** A short list as a vector; `!slowo %in% stop`; then the same sentence with
  "nie" on the list. Silent trap: the meaning flips while the count looks better.
- **53, forms.** Five forms of "sąd" counted separately and together. Silent trap: the most
  frequent form is not the base form ("sąd" only 13 of 619).

The task of 52 asks for the words left rather than their number, because 10 are kept and 10
dropped. 53 also shows that `^sądow` keeps "sądów", since "ó" is not "o".

## 6. The lecture and the lab

- **Lecture page** `lab/lab5-wyklad.Rmd`, knitted and annotated like lectures 6 and 7 (double
  click on a line explains it). Part 1 is this design; part 2 is sentiment.
- **Lab 5** continues from `sejm_mowy.csv`. Its first questions are the cleaning steps with
  counts, and the cleaned word table is the input of the sentiment questions. The lab is
  designed with part 2.
- The lab 4 report stays as it is; nothing in it is redone.

## 7. Packages and machines

| Package | Use | WSL on this PC | Lab computers |
|---|---|---|---|
| tidytext 0.4.2 | `unnest_tokens()`, later sentiment joins | installed (apt `r-cran-tidytext`) | unknown |
| stopwords 2.3 | the Polish list (only source with Polish: stopwords-iso, 356 words) | installed from CRAN in `~/R/library` (no apt package) | unknown |
| udpipe | Polish lemmas | not installed; needs a model download (polish-pdb) | unknown |

- **No Polish stemmer.** SnowballC lists 26 languages, Polish is not among them.
- **udpipe needs a model file** downloaded once per machine. If the lab computers have no
  internet or no write access, the model has to be on the course page, or lemmas are shown
  only in the lecture.
- Without stopwords, the list can be a plain CSV on the course page read with `read_csv()`,
  which also makes "read the list" a natural step.

## 8. Questions for the author

1. **Which packages are on the lab computers?** tidytext, stopwords, udpipe (with the Polish
   model). This joins the open question on caret, rmarkdown and rvest.
2. **Lemmas or forms?** Lemmatising with udpipe is the right answer for Polish but adds a
   package and a model; counting forms with a caveat is simpler. The choice also depends on the
   sentiment lexicon (base forms or all forms).
3. **The sentiment lexicon** for part 2 is still open (a Polish lexicon of base forms, or a
   list built for the course).
4. **Is 40 minutes right?** Part 2 then has about 50.

## 9. Order of work

1. Author answers section 8, at least questions 1 and 2.
2. ~~Exercises 51-53~~ built (D146).
3. Design part 2 (sentiment) and lab 5 together, on the cleaned word table.
4. Lecture page `lab5-wyklad.Rmd`, annotated; review by a student pass and an expert pass, as
   for lectures 6 and 7.

To reproduce the numbers: in WSL, `.libPaths(c("~/R/library", .libPaths()))`, read
`sejm_mowy.csv`, `unnest_tokens(slowo, tekst)`, filter on
`stopwords::stopwords("pl", source = "stopwords-iso")` and on the address list `panie`,
`marszałku`, `marszałek`, `wysoka`, `izbo`, `izby`, `posłowie`, `posłanki`, `szanowni`,
`szanowny`, `państwo`, `ministrze`, `premierze`, `proszę`, `dziękuję`, then numbers
(`^[0-9]+$`).

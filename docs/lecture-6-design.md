# Lecture 6 design: a model that predicts new people (caret)

Status: draft for the author, 2026-11-09, revised the same day to a hybrid at the
author's suggestion: four exercises on the site show what is under the bonnet (42-45),
and the model is trained with caret by the student's own hands in RStudio (lab 2,
section 7), as lab 1 did for lectures 1-4. Nothing is built. Every number below was
computed in R 4.6.2 on the Windows PC; caret 7.0.1 was installed there on
2026-11-09 (question 9.1, agreed) and the lab key's numbers are in section 4.

## 1. Scope from the syllabus

Syllabus topic 6 is "Pakiet caret - machine learning w R". It comes right after topic
5, linear models, and the card again stresses "wnioskowanie i interpretację wyników".

`docs/curriculum.md` listed caret as out of scope: simulating a whole machine-learning
package in a browser would teach a fiction. That judgement still holds for caret's
hundreds of methods. It does not hold for the ideas underneath them, which are the
layer the trainer exists for (curriculum, "How this maps onto the syllabus"):

- a model is judged on people it has not seen;
- its error is one number in the units of the data;
- a model that fits its own data too well predicts new people worse;
- one split is luck, so the split is repeated (cross-validation);
- caret is the tool that does the splitting and repeating in one call.

The split between site and RStudio follows that line. The site takes the first four:
they are mechanisms, and the trainer can run them exactly (`set.seed()`, `sample()`,
`lm()`, `predict()`) and draw them. caret itself is not simulated: students meet it
where it lives, in RStudio, on the full ESS data, with a page of instructions and a
starter script like lab 1. That keeps the trainer honest (no fake caret) and gives
the topic what the syllabus names it for, training a model.

A student who runs `train()` in RStudio without these sees a table of RMSE, Rsquared
and MAE and cannot say what any of them means or why the numbers differ from
`summary(lm())`. The lecture gives them that, on the model they already know: `lm()`
from lecture 5, with age and minutes online from ESS (exercise 37).

The exercises continue the numbering: lecture 5 ends at 41, so lecture 6 is 42-45 on
the site, followed by lab 2 in RStudio.

## 2. What students get wrong without seeing it

These are the hidden mechanisms. Each one becomes an exercise or a picture.

1. **A model checked on its own data looks better than it is.** The line from exercise
   35 misses the 20 people it was built on by 94 minutes on average, and 10 new people
   by 131. Nothing in `summary()` warns about the second number.
2. **R² is not a prediction error.** R² says how much of the spread the line follows
   in the data it saw. How far a forecast for a new person lands is a different number,
   in minutes.
3. **The error has to be compared with something.** 131 minutes sounds bad or good
   depending on the alternative. Guessing the plain average for everyone misses by 138.
   The line helps, a little. Students take any model as better than none.
4. **A more flexible model is not a better one.** A curve of degree 5 follows the 20
   training people more closely than the line (R² 0.35 instead of 0.25, error 88
   minutes instead of 94) and misses the 10 new ones by 145 minutes, worse than the
   line and worse than the average. This is overfitting, and it is invisible if one
   looks only at the training data.
5. **One split is one draw.** Another `set.seed()` gives other people in the test set
   and another error (seed 7: 116 instead of 131). Cross-validation repeats the split
   and averages, so the comparison of two models does not hang on luck.
6. **`set.seed()` is not a setting of the model.** It fixes which rows the random draw
   takes, so that a result can be repeated. Students either leave it out (and get a
   different answer each time) or think the number in it matters for the result.
7. **caret's numbers are the same numbers.** `train(method = "lm")` fits the same
   `lm()`: the coefficients of its `finalModel` equal `coef(lm())` on all 30 people.
   Its RMSE is a repeated test error like that of exercise 45, on caret's own splits.
8. **caret's default is not cross-validation.** `train()` without `trControl` repeats
   a bootstrap draw 25 times. Students copy `train()` from a tutorial and report a
   number whose method they never chose. `trainControl(method = "cv", number = 5)`
   says it out loud.

## 3. The exercises

Since D115 an introduction comes first, exercise 42 "Czym jest uczenie maszynowe?"
(an interactive picture of the main ideas and terms), so the exercises below are
now 43-46 on the site. Their numbers here are those of the first plan.

Four exercises, 42 to 45, the shape of lecture 5: a research question, a picture,
scenes (at most 7), a sandbox with chips, a task judged by its result. One idea and one
silent trap each. The running question of the lecture, asked in 42:
**"How well does age predict how long a new person spends online?"** Exercise 45
ends by handing the question to lab 2: the same check, done by caret, on 1 039 people.

All five use `ess` from exercise 37 (30 Polish internet users, ESS 2023), so the
points are ones the student has seen. The split is always `set.seed(2)` and
`sample(nrow(ess), 20)`: 20 people to learn on (`uczace`), 10 to test on (`testowe`).

### 42. Czy model zgadnie nowych ludzi?

- **Idea.** A model is checked on people it did not see. The data are split once: 20
  people build the line, 10 are hidden from it.
- **Scenes.** (1) The question: we want forecasts for people outside the survey, but
  every check so far used the same people the line was built on. (2) `set.seed(2)` and
  `sample(nrow(ess), 20)` draw 20 row numbers; the picture marks them on the 30 points.
  (3) What `set.seed()` does: the same number gives the same draw, in RStudio and here;
  another number, other people. (4) `uczace <- ess[nr, ]`, `testowe <- ess[-nr, ]`:
  the minus from exercise 5 takes the rest. (5) The line is built on `uczace` only:
  `lm(minuty ~ wiek, data = uczace)`; the 10 test points are drawn hollow.
  (6) `predict(m, testowe)`: the line guesses the hidden 10, and the picture draws each
  miss as a vertical segment, as residuals were drawn in 36.
- **Silent trap.** `sample()` without `set.seed()` gives another split on every run,
  so another answer. The sandbox chip runs it twice.
- **Task.** Build the model on the 20 learning people and give the forecasts for the
  10 test people. Judged by the 10 numbers (263, 257, 244, 215, 204, 196, 164, 161,
  137, 106).
- **Wrong answers to diagnose.** Model on all of `ess` (forecasts differ: the hidden
  people leaked in); `predict(m)` without new data (20 numbers, the learning people);
  `testowe` built with `nr` instead of `-nr` (the same 20 people); no `set.seed()`.

### 43. O ile się myli?

- **Idea.** The error on new people is one number in minutes: RMSE, the root of the
  mean squared miss. It is the residual sum of squares of 36, turned back into minutes.
- **Scenes.** (1) Ten misses, one per test person: `testowe$minuty - prognoza`.
  (2) Squared, as in 36: plus and minus would cancel. (3) The mean of the squares and
  its root: `sqrt(mean((testowe$minuty - prognoza)^2))` is **131 minutes**. In words:
  for a new person the forecast is typically about two hours off. (4) The same number
  on the 20 learning people is **94**: on its own data the line looks better than it
  is. (5) Compared with no model at all: guessing the learning average, 211.5 minutes,
  for everyone misses by **138**. The line helps, by 7 minutes. (6) R² of the line on
  the learning people is 0.25: it says how much of the spread the line follows, not
  how far a forecast lands.
- **Silent trap.** Reporting the error on the learning data (94) as the error of the
  forecast.
- **Task.** Compute the error of the line on the test people. Judged by 130.56 (±0.5).
- **Wrong answers.** 94.26 (learning data); 99.36 (`sigma` from `summary()`, also the
  learning data); 109.04 (mean absolute miss, `mean(abs(...))`: a real measure, MAE,
  named in the message but not the one asked); a mean without the root (17046.08);
  the root without the square (6.88: plus and minus cancelled, as in 36); the
  learning-data line applied to all 30 people (107.73).

### 44. Za dobra krzywa

- **Idea.** A more flexible model fits its own data better and new data worse:
  overfitting.
- **Scenes.** (1) A line cannot bend. `poly(wiek, 5)` in the formula lets it bend
  four times; the picture draws the curve through the 20 learning points.
  (2) On the learning people the curve wins: R² **0.35** instead of 0.25, error
  **88** instead of 94. (3) On the hidden 10 it loses: **145** instead of 131, and
  worse than the plain average (138). (4) Why: the curve bends towards single people
  among the 20. New people do not sit in those places. (5) Rule for the report: choose
  a model by its error on new people, never by R² on its own data.
- **Silent trap.** Choosing the model with the higher R².
- **Task.** Which model forecasts new people better: the line or the curve of degree
  5? Give the test error of the better one. Judged by 130.56.
- **Wrong answers.** 87.53 (curve, learning data); 145.11 (the curve: the worse one);
  R² values (0.35, 0.25); the error on all 30 people.

### 45. Pięć razy na zmianę

- **Idea.** One split is one draw. Cross-validation splits the people into 5 parts;
  each part is the test set once; the 5 errors are averaged.
- **Scenes.** (1) Another seed, another split: with `set.seed(7)` the line misses by
  116, not 131. Which is "the" error? (2) Five folds: every person gets a number 1-5
  (`sample(rep(1:5, 6))`), shown as 5 colours on the points. (3) Fold 1 is the test,
  folds 2-5 learn; then fold 2; and so on: one picture per round, the error under it.
  (4) The mean of the 5 errors: line **104**, average-only **117**, curve **128**.
  The order is the order of exercise 44, now not hanging on one draw. (5) Every person
  was tested exactly once, and never by a model that had seen them.
- **Silent trap.** Thinking cross-validation makes the model better. It only measures
  it more fairly; the model used afterwards is still fitted on everyone.
- **Task, as built (D113).** Round 3 by hand with `filter()`, `lm()` and `predict()`
  (124.71). The rounds are shown with `sapply()`, its syntax said not to be required.
- **Task, as first planned.** Open question to the author (9.3): either the student reads the mean of
  five given errors, or the folds are a column and the student filters one fold, as
  in lecture 2, and computes its error. Loops and functions are not taught, so the
  five rounds cannot be written by the student in one go.

### After 45: the bridge to RStudio

Exercise 45 ends with a scene that shows, without running it, the caret code the lab
will use, each argument tied to an exercise: `createDataPartition()` is the split of
42, `RMSE` the error of 43, `trainControl(method = "cv", number = 5)` the folds of 45.
The menu's "Dalej" gets "Laboratorium 2 w RStudio" next to lab 1. The trainer runs no
caret code: a chip with `train(...)` answers with a message pointing to the lab.

**Python beside R (D93).** scikit-learn has the same three steps:
`train_test_split`, `mean_squared_error`, `cross_val_score(..., cv=5)`. A panel under
the sandbox of 42-45, as in 33 and 34, if the author wants it.

## 4. Data, with numbers checked in R

### `ess` (all four exercises): exercise 37, unchanged

30 Polish internet users from ESS round 11 (2023), age and minutes online per day.
The question was asked only of internet users (D100).

```r
ess <- data.frame(
  wiek = c(15, 16, 17, 20, 22, 22, 23, 23, 24, 27, 27, 27, 31, 38, 39, 40, 40, 41, 42, 45,
           48, 57, 58, 60, 64, 66, 67, 77, 79, 84),
  minuty = c(480, 300, 90, 360, 240, 120, 180, 360, 360, 500, 120, 300, 180, 300, 120,
             270, 210, 300, 60, 90, 240, 330, 120, 90, 150, 120, 300, 180, 120, 60))
```

The data are noisy: on all 30 people the line is 330.06 − 2.62 × wiek and R² is 0.20.
That is honest for a survey and it makes the lecture's point: forecasts for single
people are rough, and a flexible model chases the noise.

### The split, `set.seed(2)` (exercises 42-44)

`set.seed(2); nr <- sample(nrow(ess), 20)` gives rows
21 15 6 28 8 17 25 12 9 18 11 1 3 16 24 2 30 7 26 13 (R 4.6.2, default
Mersenne-Twister with "Rejection" sampling). The youngest (15) and the oldest (84) are
among the learning people, so no test person lies outside the learning ages: the test
error measures forecasting, not extrapolation (exercise 37 did that). With
`set.seed(7)` the 15- and 84-year-olds land in the test set and a curve forecasts
−791 minutes for the 84-year-old; that seed is used only for the "another draw" scene.

| Model | Learning people (20) | Test people (10) | R² on learning |
|---|---|---|---|
| line, `minuty ~ wiek` (315.88 − 2.66 × wiek) | 94.26 | **130.56** | 0.25 |
| learning average for everyone (211.5) | — | 137.94 | — |
| curve, `minuty ~ poly(wiek, 5)` | 87.53 | 145.11 | 0.35 |
| line with `set.seed(7)` instead | 107.2 | 115.9 | — |

Test forecasts of the line (exercise 42 task), in the order of `testowe` (ages 20, 22,
27, 38, 42, 45, 57, 58, 67, 79): 262.62, 257.30, 243.98, 214.70, 204.04, 196.06,
164.10, 161.44, 137.48, 105.53. Mean absolute miss (MAE) 109.04; `sigma` of the
learning model 99.36.

### The folds, `set.seed(2); sample(rep(1:5, 6))` (exercise 45)

Folds per row: 1 5 1 3 3 2 5 2 4 3 1 1 3 1 4 2 5 2 1 3 4 2 5 4 4 3 4 5 5 2.

| Model | Fold errors (1-5) | Mean |
|---|---|---|
| line | 147, 106, 125, 92, 52 | **104.4** |
| average only | — | 116.8 |
| curve of degree 5 | 149, 207, 137, 90, 57 | 128.2 |

Higher degrees are kept out: degree 8 has one fold at 769 minutes, because a fold
puts the oldest people in the test set and the curve shoots off. That is exercise
37's lesson again and would blur this one.

### Lab 2: the data and the key

Lab 2 uses `lab/ess_polska.sav`, already hosted for lab 1: round 11, 1 039 people with
age and minutes. The lab's expected answers, checked with caret 7.0.1 on 2026-11-09,
are kept out of this public repository, as lab 1's key is: `lab/PLAN2.md` on the
machine that built them (listed in `.git/info/exclude`). What they show, in words:
with a thousand people the curve no longer overfits, and a method chosen on one test
split (knn) loses by cross-validation.

## 5. Engine work

What the engine has today (checked 2026-11-09): `lm()`, `predict()`, `coef()`,
`summary()`, `residuals()`, `fitted()`, `sqrt()`, `mean()`, `abs()`, `rep()`,
negative indexing. What it lacks:

### R's random numbers, exactly

- `set.seed(n)` is only listed as a call that prints nothing (`src/core/eval.js`); it
  sets no state. `sample()` does not exist.
- The plan: R's default generator, written out. Mersenne-Twister (MT19937), seeded the
  way R seeds it (`set.seed()` scrambles the integer with R's own linear congruential
  step before filling the 625-word state), `unif_rand()` with R's fixup to (0, 1), and
  `sample()` with the "Rejection" sampler of R ≥ 3.6 (`R_unif_index`, bits drawn until
  the value falls under the bound). Each piece is short; together about 150 lines in a
  new `src/core/rng.js`.
- Why exact and not "any random split": the student types `set.seed(2)` in RStudio
  and must get the same 20 people, the same 130.56. A trainer whose random draw differs
  from R's teaches that results cannot be repeated, the opposite of exercise 42.
- `sample(x)`, `sample(x, size)`, `sample(n, size)` and `sample(rep(1:5, 6))` are
  enough. `replace = TRUE` and `prob =` are not used (an error says so).
- Oracle: a new block in `test/cases-eval.txt` with `set.seed()` then `sample()`,
  `runif()` and `sample()` again, for several seeds and sizes, compared with R.

### `poly()` in a formula

- Today `poly` is in `UNSUPPORTED_CALLS` of `src/core/builtins/models.js`.
- Needed: `poly(wiek, k)` with orthogonal polynomials, as R builds them (centred powers,
  QR, scaled columns), so that `coef()` prints what R prints. Fitted values and
  `predict()` on new data (which needs the `coefs` attribute R keeps for the
  normalisation) are what the lesson shows.
- Simpler alternative, if the exact coefficients are not shown anywhere: `poly(wiek,
  k, raw = TRUE)`. Same fitted values, unstable numbers at higher degrees, and not
  what tutorials write. Question 9.4.

### caret: not in the engine

caret runs only in RStudio (lab 2). The engine knows the names `train`,
`trainControl`, `createDataPartition` and `library(caret)` only to answer with one
message: this is done in RStudio, here is the lab. No caret output is imitated.

### What a student gets wrong, and what they are told

Each wrong answer of section 3 gets a diagnosis, as in lectures 3-5. New messages:
`sample()` with `replace` or `prob` (not taught), caret calls (the lab message),
`predict()` of a model built on all data when the task asked for `uczace`.

### Pictures (section 6) and oracle

The split, the misses and the folds are drawn from the values that ran, as all
pictures are. Every printed number is compared with R 4.6.2 in `diff-eval`.

## 6. Pictures

All built on the model picture of lecture 5 (`src/ui/viz/model.js`): points, line,
residual segments.

- **The split (42).** The 30 points of `ess`; learning people filled, test people
  hollow. Clicking `sample(...)` lights the drawn rows one by one in draw order, so
  "20 row numbers" becomes 20 people.
- **The forecast misses (42, 43).** The line from the learning people; for each hollow
  test point a vertical segment to the line, labelled with its miss in minutes. In 43
  the squares of 36 return on these segments, and the RMSE is drawn as a band of
  ±131 minutes around the line: "a typical forecast lands within this".
- **Two errors side by side (43, 44).** A small bar pair under the plot: learning error
  and test error, for each model clicked. 94 vs 131 for the line; 88 vs 145 for the
  curve; the average-only guess as a dashed reference at 138.
- **The curve (44).** The degree-5 curve over the age range, drawn densely so its bends
  show; the test points' misses against the curve.
- **The folds (45).** Five colours on the 30 points; a strip of five small plots, one
  per round, with the test fold hollow; the five errors under them and their mean.
- **The bridge (end of 45).** The caret code of the lab, not run, with each argument
  linked to the picture where its idea was born: split to 42, RMSE to 43, folds to 45.

## 7. Lab 2 in RStudio: training the model by hand

Built 2026-11-10 (D114): `lab/lab2.html`, `lab/lab2.R`. The questions below were the
first sketch; the page holds the final ten.

The second half of the lecture, built like lab 1 (D89, D90): a Polish page at
`lab/lab2/` (or `lab2/`), a starter script `lab2.R`, the key and plan kept local (the
repo is public), a menu link under "Dalej". Data: the ESS file already hosted for lab
1, round 11, 1 039 people (section 4), so no new data go online.

The page, in the order of lab 1:

1. **Setup.** `install.packages("caret")` before class (it pulls many packages; on the
   lab computers this must be checked in advance), `library(caret)`, `read_sav()`.
2. **What the site showed and caret now does.** One table: split (42) =
   `createDataPartition()`, error (43) = `RMSE`, overfitting (44) = comparing models,
   cross-validation (45) = `trainControl(method = "cv", number = 5)`.
3. **Questions of rising difficulty** (a first sketch, to be planned and solved in
   RStudio after the lecture is approved):
   1. Prepare the data: round 11, minutes and age without NA, numbers not labels
      (`zap_labels()` or `as.numeric()`, as in lab 1). How many people?
   2. Split 80/20 with `createDataPartition()` after `set.seed()`. How many in each?
   3. Train `lm` on the learning part with `train()` and 5-fold cross-validation.
      What is the RMSE, in words?
   4. Forecast the test part with `predict()` and compute its RMSE with `RMSE()`.
      Close to the cross-validated one?
   5. Compare with the average-only guess. Does age help, and by how many minutes?
   6. Train the curve `poly(agea, 5)` the same way. Better or worse than on the site's
      30 people, and why?
   7. Train one method that is not a line, `method = "knn"`, by changing one word.
      The check stays the same: that is what caret is for.
   8. (Home) Add sex, or a variable of the student's choice from the file, and say
      whether the cross-validated error drops.
   9. (Home) Write three sentences for a report: the model, its error on new people,
      what it cannot do.
4. **Without `trControl`** caret uses the bootstrap: one line in the page shows it and
   asks to always name the method.

What the trainer gains: no simulated package, and students leave with code that runs on
their own data. What it costs: the caret part has no clickable pictures; the site's
four exercises carry the understanding, the lab carries the practice.

## 8. Honest limits and what stays out

- **The trainer runs no caret.** Students see what caret does in 42-45 and do it in
  RStudio. The bridge scene shows caret code without running it.
- **Only regression.** Classification (a yes/no outcome, accuracy, confusion matrix)
  is the other half of caret. In the lab it can be one home question; on the site it
  would need `glm()` and new pictures. Question 9.2.
- **30 people on the site is small.** Errors move between splits (131 vs 116). That is
  shown, not hidden: it is the reason for cross-validation. The lab uses 1 039.
- **No tuning.** caret's `tuneGrid`, `preProcess` and ensembles stay out; `knn` in the
  lab runs with caret's defaults.
- **`poly()` is a means, not a topic.** It appears only as "a model that can bend",
  to show overfitting. Its coefficients are not read.

## 9. Questions for the author

1. ~~Install caret on the Windows PC?~~ Done 2026-11-09: caret 7.0.1 in the user
   library. The Mac needs it too before the lab is solved there.
2. **Classification: one home question in lab 2** (decided 2026-11-09). "Does the
   person use the internet every day?" with `method = "glm"` and a yes/no outcome;
   caret then reports Accuracy instead of RMSE. No confusion matrix.
3. **Exercise 45's task: one fold by hand** (decided). The folds come as a column
   (`fold`); the student filters folds 2-5 to learn, fold 1 to test, fits `lm()` and
   computes the error of that round with `filter()`, `lm()`, `predict()` (147 minutes
   for the line on fold 1). The scenes run the other four rounds.
4. **`poly()` exact, orthogonal as in R** (decided). `coef()` then matches RStudio.
5. **Lab 2 like lab 1** (decided): the main part in class, two or three questions at
   home, provided caret is installed on the lab computers beforehand (it pulled about
   30 packages here). If it cannot be, the lab moves home whole.
6. **RMarkdown right after lecture 6, as a lab** (decided): lab 2's script becomes a
   `.Rmd` report with the model, its error and a plot. No simulated RMarkdown in the
   trainer.

## 10. Order of work

1. ~~The author answers section 9.~~ Answered 2026-11-09; caret installed.
2. Engine: `rng.js` (`set.seed`, `sample`) with oracle cases first, since every
   exercise depends on it; then `poly()`; then the caret message.
3. Exercises one at a time, each walked as a student before the next (as in lecture
   5): 42, 43, 44, 45 with its bridge scene.
4. The four exercises walked whole as a second-year student and as an expert.
5. Lab 2: the plan and key solved in real RStudio with caret, then the page and
   script, then the lab read as a student on the files downloaded from the site (as
   D90 did for lab 1).
6. Python panels (D93) if the author wants them.

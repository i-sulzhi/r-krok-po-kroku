# Redesign 2026-09: clickable code, pictures instead of paragraphs

Working plan for the visual redesign requested on 2026-09-24:
"less text, more visualisations; Polish text, same context; the student should
look, click the code, and understand."

Pre-redesign snapshot: `.snapshots/pre-visual-redesign-2026-09-24.tar.gz`
(the project is not a git repo -- this is the undo button).

## Decisions

- **D9. Polish only.** The Russian dictionaries, lesson texts and the language
  switch are removed. The course runs in Polish; a second language doubled every
  text change and hid bugs (hard-coded Russian labels shipped inside the Polish UI:
  `value.js`, `operation.js`, `coercion.js`). The i18n layer (`t()`, plural forms)
  stays -- it is still where every visible string lives.
- **D10. The code is the interface.** Every sub-expression of an example is
  clickable. Clicking selects it; the stage shows *that* expression: its value as
  a picture, and the operation that produced it. The old global step player (dots,
  18 frames, "key steps") is replaced by (a) spatial choice -- click what you want
  to see -- and (b) per-operation animation inside the panel.
- **D11. Values of sub-expressions are recorded by the engine.** `Interpreter.eval`
  reports each node's value to an evaluation log (`trace/evallog.js`): node, value,
  trace-seq range, parent evaluation, order. Capped, so loops stay cheap. The UI
  derives everything (hover values, cascade, evaluation order) from this log -- the
  same "engine narrates, UI subscribes" rule as the trace bus.
- **D12. A lesson is a short sequence of scenes.** Each scene = one headline
  sentence (<= ~12 words) + a live code block + which expression is pre-selected +
  which one pulses as "click me". Then a sandbox with one-click variants ("chips"),
  then the task. The four text beats (idea / watch / try / task) are gone; the idea
  is carried by the first scene's picture.

## Visual vocabulary (one picture per kind of thing)

| Thing | Picture |
|---|---|
| vector | row of cells, type = colour, `[i]` under each cell, names above |
| factor | two layers: labels on top, stored codes below, level table |
| data.frame | table, header coloured by column type |
| elementwise op | operand rows -> result row, connectors, recycled cells marked |
| coercion | type ladder + before/after rows |
| subsetting | source row with mask/positions above, chosen cells lifted into result |
| aggregation (`mean`, `sum`, `length`, `max`, `min`) | cells funnel into one cell; `mean` shows sum / n |
| NA in aggregation | NA cell poisons the result; `na.rm = TRUE` drops it first (n shrinks) |
| `table()` | one bar per distinct value, counts |
| generic call | "machine": argument boxes -> function -> result |
| pipe | table thumbnails in a row, verb labels on the arrows |
| dplyr verbs | existing panels (filter/select/mutate/arrange/group/summarise) |
| assignment | value + name tag, memory box lights up |

## Architecture changes (as built)

1. `core/eval.js` -- `eval()` wraps `evalNode()` and reports enter/exit to an
   optional evaluation log; only traced runs have one.
2. `trace/evallog.js` -- the log: entries in completion order, per-node lists,
   parent/children, trace-seq windows, cap 5 000; `eventsWithin`, `ownEvents`,
   `nodeAt`, `findByText`.
3. `ui/codebox.js` -- textarea over a painted layer: ranges (selected, hovered,
   "click me", error), pointer/caret -> source offset, value chips at line ends.
4. `ui/live.js` -- code box + engine + stage + memory: fresh deterministic run per
   edit, selection that survives edits, evaluation-order stepping, console.
5. `ui/viz/focus.js` -- the stage: picks the picture per node type and its events,
   one-line caption, per-group run counter, path of enclosing expressions, and the
   chain strip for pipes and nests of calls.
6. `ui/viz/pictures.js` -- elementwise (with fan and ×N), c(), funnel, cell-by-cell
   map, choosing (mask and lifted cells), `$`, factor make/out, counting bars,
   data.frame assembly, the generic machine, assignment, goal-vs-result compare.
   `links.js` draws connectors from real element positions; `memory.js` the memory.
7. `ui/lesson.js`, `ui/app.js` -- scenes / sandbox / task; wide screen two columns,
   narrow screen moves the stage right under the code.
8. `build.mjs` -- one scope per module (D13); guards for control bytes and Cyrillic.

## Progress

- [x] evaluation log in the engine + behaviour tests
- [x] code box, live code, stage, pictures, memory
- [x] Polish-only i18n; retired player, editor, explain, operation, environment panels
- [x] lesson schema, lesson view, shell, stylesheet (light + dark, phone width)
- [x] 13 lessons rewritten; text per lesson before the task 1 698 -> 270 characters
- [x] tests: lessons (158), pictures (1 044), bundle (75 steps), i18n (336 keys), behaviour (38)
- [x] browser walk of the built file: 336 visits, 0 problems, 13 tasks solved in the UI
- [x] docs: README, curriculum, decisions D9-D13, testing (33 defects)

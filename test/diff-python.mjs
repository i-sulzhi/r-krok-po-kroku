/**
 * The Python beside R (D93): every statsmodels and scikit-learn line the sandbox shows
 * is run in real Python, and its result compared with the number on screen.
 *
 * Python is not part of the trainer, so this suite needs a Python with pandas,
 * statsmodels and scikit-learn. It uses $PYTHON, or `python`. Without those packages it
 * says it skipped, and how many lines it could not check; it does not pass silently.
 *
 * Each column runs in its own session after the setup, rows in order, as a student
 * would type them. A line's value is the value of its last line; a row with `out` is
 * compared number by number to the precision written (`outPy` where Python's answer
 * differs, such as a row counted from 0).
 */

import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LESSONS } from '../src/lessons/index.js';
import { numbersMatch } from './numbers.mjs';

const python = process.env.PYTHON || 'python';
const specs = LESSONS.filter((l) => l.play?.python).map((l) => [l.id, l.play.python]);
const total = specs.reduce((n, [, s]) => n + s.rows.length * 2, 0);

const HARNESS = String.raw`
import json, sys
spec = json.load(open(sys.argv[1], encoding="utf-8"))
try:
    import numpy as np, pandas as pd, statsmodels, sklearn
except Exception as e:
    print(json.dumps({"skip": str(e)})); sys.exit(0)

def flat(v):
    if v is None: return None
    if isinstance(v, (pd.Series, pd.DataFrame)): return [float(x) for x in np.ravel(v.values)]
    if isinstance(v, np.ndarray): return [float(x) for x in v.ravel()]
    if isinstance(v, (tuple, list)):
        out = []
        for x in v:
            f = flat(x)
            if f is None: return None
            out.extend(f)
        return out
    if isinstance(v, (bool, np.bool_)): return [float(v)]
    if isinstance(v, (int, float, np.integer, np.floating)): return [float(v)]
    return None

results = {}
for column in ("statsmodels", "sklearn"):
    ns = {}
    exec(spec["setup"], ns)
    vals = []
    for code in spec[column]:
        lines = code.split("\n")
        # The last statement may span lines: find where it starts by compiling.
        value = None
        try:
            for k in range(len(lines)):
                head, tail = "\n".join(lines[:k]), "\n".join(lines[k:])
                try:
                    compiled = compile(tail, "<row>", "eval")
                except SyntaxError:
                    continue
                exec(head, ns)
                value = eval(compiled, ns)
                break
            else:
                exec(code, ns)
            vals.append({"ok": True, "value": flat(value)})
        except Exception as e:
            vals.append({"ok": False, "error": f"{type(e).__name__}: {e}"})
    results[column] = vals
print(json.dumps(results))
`;

const dir = mkdtempSync(join(tmpdir(), 'diff-python-'));
const harness = join(dir, 'harness.py');
writeFileSync(harness, HARNESS, 'utf8');

let pass = 0;
const fails = [];
let skipped = null;
try {
  for (const [id, spec] of specs) {
    const file = join(dir, `${id}.json`);
    writeFileSync(file, JSON.stringify({
      setup: spec.setup,
      statsmodels: spec.rows.map((r) => r.statsmodels),
      sklearn: spec.rows.map((r) => r.sklearn),
    }), 'utf8');
    let out;
    try {
      out = JSON.parse(execFileSync(python, [harness, file], { encoding: 'utf8', env: { ...process.env, PYTHONUTF8: '1' } }));
    } catch (e) {
      skipped = `${python} could not run: ${String(e.message).split('\n')[0]}`;
      break;
    }
    if (out.skip) { skipped = out.skip; break; }
    for (const column of ['statsmodels', 'sklearn']) {
      spec.rows.forEach((row, i) => {
        const got = out[column][i];
        const name = `${id} ${column} row ${i + 1}: ${row[column].split('\n')[0]}`;
        if (!got.ok) { fails.push(`${name}: ${got.error}`); return; }
        const want = row.outPy ?? row.out;
        if (want == null) { pass++; return; }
        const problem = numbersMatch(want, got.value);
        if (problem) fails.push(`${name}: ${problem}`);
        else pass++;
      });
    }
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (skipped) {
  console.log(`python: skipped, ${total} lines not checked (${skipped}). Set PYTHON to a Python with pandas, statsmodels and scikit-learn.`);
  process.exit(0);
}
console.log(`python: ${pass}/${pass + fails.length} lines give the number on screen`);
for (const f of fails) console.log(`  FAIL  ${f}`);
process.exit(fails.length ? 1 : 0);

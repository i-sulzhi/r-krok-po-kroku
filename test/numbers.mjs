/**
 * Numbers written on screen against numbers computed (D93).
 *
 * `out` is what a student reads, "8.253 -0.1228" or "4.080 1.203 -0.6744 …": each
 * number is checked against the computed value at the same place, to the precision it
 * is written in. A trailing "…" means the computed values go on; without it the counts
 * must agree.
 */
export function numbersMatch(written, values) {
  if (!Array.isArray(values)) return `no numbers computed (got ${JSON.stringify(values)})`;
  const shown = String(written).match(/-?\d+(?:\.\d+)?/g) || [];
  const more = /…\s*$/.test(String(written));
  if (!more && shown.length !== values.length) return `screen shows ${shown.length} number(s), computed ${values.length}`;
  if (more && values.length <= shown.length) return `screen says more follow, computed ${values.length}`;
  for (let k = 0; k < shown.length; k++) {
    const n = Number(shown[k]);
    const decimals = (shown[k].split('.')[1] || '').length;
    const slack = 0.5 * 10 ** -decimals + 1e-9;
    if (Math.abs(values[k] - n) > slack) return `number ${k + 1}: screen ${shown[k]}, computed ${values[k]}`;
  }
  return null;
}

/**
 * Every user-visible string of the trainer lives here, in Polish.
 *
 * The course runs in Polish (decision D9): the Russian dictionaries and the language
 * switch were removed in the 2026-09 redesign, because a second language doubled
 * every text change and let hard-coded labels in the other language ship unnoticed.
 * The layer itself stays, for two reasons that have nothing to do with translation:
 *
 * - **Errors carry keys, not sentences.** An RError stores `key` + `params`, and
 *   diagnosis matches on the key -- never on the rendered wording.
 *
 * - **Plurals are grammar, not decoration.** Polish needs three forms after a number
 *   (1 wiersz / 2 wiersze / 5 wierszy), and `{n|wiersz|wiersze|wierszy}` in a
 *   template picks the right one. test/i18n-coverage.mjs rejects a counted
 *   placeholder followed by a noun that does not go through this.
 */

import { pl } from './pl.js';
import { plUI } from './pl-ui.js';

// Engine messages and interface text are separate files only for readability;
// they form one flat dictionary.
const DICT = { ...pl, ...plUI };

/**
 * Look up a key and fill in placeholders.
 *
 * @param {string} key      e.g. 'err.objectNotFound'
 * @param {Object} params   values for {placeholders}; `{n|one|few|many}` picks a plural form
 * @returns {string}
 *
 * A missing key returns the key itself rather than an empty string: silent blanks
 * hide bugs, a visible `err.someKey` in the UI does not.
 */
export function t(key, params = {}) {
  const template = DICT[key];
  if (template == null) return key;
  return fill(template, params);
}

/** True when a key exists -- for optional hints. */
export const has = (key) => DICT[key] != null;

/**
 * Fill `{name}` placeholders, plus the plural form `{count|godzina|godziny|godzin}`
 * which selects by the numeric param named before the first pipe.
 */
function fill(template, params) {
  return String(template).replace(/\{([^}]+)\}/g, (match, body) => {
    const parts = body.split('|');
    const name = parts[0].trim();
    const value = params[name];
    if (parts.length === 1) return value === undefined ? match : String(value);
    const n = Number(value);
    if (!Number.isFinite(n)) return String(value ?? '');
    return `${n} ${plural(n, parts.slice(1))}`;
  });
}

/**
 * Polish plural selection.
 *   1              -> forms[0]   (wiersz)
 *   2-4, not 12-14 -> forms[1]   (wiersze)
 *   otherwise      -> forms[2]   (wierszy)
 */
export function plural(n, forms) {
  const [one, few, many] = forms;
  if (many === undefined) return Math.abs(n) === 1 ? one : few;
  const abs = Math.abs(n);
  // Every counted placeholder is an integer; a fraction would need the genitive
  // singular ("2,5 wiersza"), which no template carries, so it gets the plain plural.
  if (!Number.isInteger(abs)) return many;
  const n10 = abs % 10;
  const n100 = abs % 100;
  if (abs === 1) return one;
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return few;
  return many;
}

/** Every key defined -- used by the coverage test. */
export const referenceKeys = () => Object.keys(DICT);
export const dictionary = () => DICT;

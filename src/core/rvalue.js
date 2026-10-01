/**
 * The R value model.
 *
 * Everything a student meets in R is represented here. Three design choices drive
 * the whole trainer:
 *
 * 1. There are no scalars. `1` is a double vector of length 1, and the UI draws it
 *    as a one-cell vector. Students who internalise this stop being surprised by
 *    vectorised arithmetic later.
 *
 * 2. Values are immutable and frozen. R's copy-on-modify is therefore not a special
 *    case we remember to implement -- it falls out of the design, and every copy is
 *    an observable event we can animate.
 *
 * 3. Type is carried explicitly, never inferred from the JS payload. `1` and `1L`
 *    are both the JS number 1; only `type` distinguishes double from integer, and
 *    that distinction is a recurring source of student confusion worth showing.
 */

/** The missing value. One singleton for all types; the vector's `type` gives it a flavour. */
export const NA = Object.freeze({ __NA__: true });

export const isNA = (x) => x === NA;

/** Atomic types, ordered by R's coercion hierarchy: lower coerces up to higher. */
export const TYPES = Object.freeze(['logical', 'integer', 'double', 'character']);

/** Human-facing type names, as `typeof()` and `class()` report them. */
export const TYPE_LABEL = Object.freeze({
  logical: 'logical',
  integer: 'integer',
  double: 'double',
  character: 'character',
});

/** What R prints for `class()` -- deliberately different from `typeof()` for doubles. */
export const TYPE_CLASS = Object.freeze({
  logical: 'logical',
  integer: 'integer',
  double: 'numeric',
  character: 'character',
});

export const typeRank = (t) => TYPES.indexOf(t);

// ---------------------------------------------------------------------------
// Constructors
// ---------------------------------------------------------------------------

/**
 * An atomic vector: the workhorse of R.
 * @param {string} type   one of TYPES
 * @param {Array} values  raw JS payload; NA singleton for missing values
 * @param {Object} attributes  R attributes (names, dim, class, levels, ...)
 */
export function mkAtomic(type, values, attributes = null) {
  if (!TYPES.includes(type)) throw new Error(`unknown atomic type: ${type}`);
  return Object.freeze({
    kind: 'atomic',
    type,
    values: Object.freeze(values.slice()),
    attributes: freezeAttrs(attributes),
  });
}

export const mkLogical   = (v, a) => mkAtomic('logical', v, a);
export const mkInteger   = (v, a) => mkAtomic('integer', v, a);
export const mkDouble    = (v, a) => mkAtomic('double', v, a);
export const mkCharacter = (v, a) => mkAtomic('character', v, a);

/** Length-1 shorthands, used constantly by builtins. */
export const dbl  = (x) => mkDouble([x]);
export const int  = (x) => mkInteger([x]);
export const chr  = (x) => mkCharacter([x]);
export const lgl  = (x) => mkLogical([x]);

/** A generic vector: elements are themselves R values. `list()`, and data.frame's spine. */
export function mkList(values, attributes = null) {
  return Object.freeze({
    kind: 'list',
    values: Object.freeze(values.slice()),
    attributes: freezeAttrs(attributes),
  });
}

/** R's NULL: the empty, typeless, zero-length value. */
export const R_NULL = Object.freeze({ kind: 'null', values: Object.freeze([]), attributes: null });

/** A user-defined function. `params` is [{name, default|null}], `body` an AST node. */
export function mkClosure(params, body, env, { name = null, src = null } = {}) {
  return Object.freeze({ kind: 'closure', params: Object.freeze(params), body, env, name, src });
}

/** A primitive implemented in JS. `fn(args, ctx) -> RValue`. */
export function mkBuiltin(name, fn, { params = null, special = false } = {}) {
  return Object.freeze({ kind: 'builtin', name, fn, params, special });
}

// ---------------------------------------------------------------------------
// Attributes
// ---------------------------------------------------------------------------

function freezeAttrs(attributes) {
  if (!attributes) return null;
  const keys = Object.keys(attributes).filter((k) => attributes[k] != null && attributes[k] !== R_NULL);
  if (keys.length === 0) return null;
  const out = {};
  for (const k of keys) out[k] = attributes[k];
  return Object.freeze(out);
}

export const getAttr = (v, name) => (v.attributes && v.attributes[name]) || null;

/** Returns a *new* value with the attribute set -- values never mutate. */
export function setAttr(v, name, value) {
  const next = { ...(v.attributes || {}) };
  if (value == null || value === R_NULL) delete next[name];
  else next[name] = value;
  return withAttrs(v, next);
}

/** Returns a new value carrying `attributes`, preserving kind/type/payload. */
export function withAttrs(v, attributes) {
  const attrs = freezeAttrs(attributes);
  if (v.kind === 'atomic') return mkAtomic(v.type, v.values.slice(), attrs);
  if (v.kind === 'list')   return mkList(v.values.slice(), attrs);
  return v;
}

/** Returns a new value with the same payload but no attributes -- what arithmetic mostly wants. */
export const stripAttrs = (v) => (v.attributes ? withAttrs(v, null) : v);

export const getNames = (v) => getAttr(v, 'names');
export const setNames = (v, names) => setAttr(v, 'names', names);

// ---------------------------------------------------------------------------
// Predicates and queries
// ---------------------------------------------------------------------------

export const isAtomic    = (v) => v.kind === 'atomic';
export const isList      = (v) => v.kind === 'list';
export const isNull      = (v) => v.kind === 'null';
export const isVector    = (v) => v.kind === 'atomic' || v.kind === 'list';
export const isFunction  = (v) => v.kind === 'closure' || v.kind === 'builtin';

export const rLength = (v) => (isVector(v) ? v.values.length : isNull(v) ? 0 : 1);

/** The class R would report, honouring an explicit `class` attribute (factor, data.frame). */
export function rClass(v) {
  const explicit = getAttr(v, 'class');
  if (explicit && explicit.values.length) return explicit.values.slice();
  if (isNull(v)) return ['NULL'];
  if (isList(v)) return ['list'];
  if (isFunction(v)) return ['function'];
  if (getAttr(v, 'dim')) return ['matrix', 'array'];
  return [TYPE_CLASS[v.type]];
}

export const hasClass = (v, cls) => rClass(v).includes(cls);
export const isFactor = (v) => hasClass(v, 'factor');
export const isDataFrame = (v) => hasClass(v, 'data.frame');

/** True when any element is NA -- drives the "missing data" highlighting in the UI. */
export const anyNA = (v) => isAtomic(v) && v.values.some(isNA);

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

let idCounter = 0;
const identities = new WeakMap();

/**
 * A stable id per value object, so the UI can animate "this same vector moved"
 * versus "a new vector was born". Assigned lazily; never part of R semantics.
 */
export function valueId(v) {
  if (v == null || typeof v !== 'object') return null;
  let id = identities.get(v);
  if (id === undefined) {
    id = `v${++idCounter}`;
    identities.set(v, id);
  }
  return id;
}

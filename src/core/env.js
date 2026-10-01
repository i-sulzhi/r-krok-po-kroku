/**
 * Environments: R's variable scopes.
 *
 * Lookup walks a chain -- local frame, then enclosing, up to global and the builtins.
 * That walk is invisible in a normal R session, which is exactly why "why can't my
 * function see this variable?" is a recurring question. Here the walk is traced:
 * every environment inspected is recorded, whether or not it held the name.
 */

import { EV } from '../trace/events.js';
import { RError } from './coerce.js';
import { isFunction } from './rvalue.js';
import { t } from '../i18n/index.js';

let envCounter = 0;

export class Env {
  /**
   * @param {Env|null} parent
   * @param {Object} opts  {name} -- a label for the UI, e.g. 'global' or 'mean()'
   */
  constructor(parent = null, { name = null, call = null, role = null } = {}) {
    this.id = `e${++envCounter}`;
    this.parent = parent;
    this.name = name || (parent ? t('env.local') : t('env.global'));
    this.call = call;               // the call that created this frame, for the UI
    // `role` lets the UI recognise the builtin environment without matching its
    // name -- the name is translated, so matching it broke the moment we added Polish.
    this.role = role;
    this.vars = new Map();
  }

  has(name) { return this.vars.has(name); }
  ownKeys() { return [...this.vars.keys()]; }

  /**
   * Find `name`, walking up the chain and recording the walk.
   * @param {Object} opts {trace, node, mustBeFunction}
   */
  lookup(name, { trace = null, node = null, mustBeFunction = false } = {}) {
    const chain = [];
    let env = this;
    while (env) {
      const hit = env.vars.has(name);
      // Calling `c(...)` when a variable `c` exists must skip the variable:
      // R searches for a *function* when the name is in call position.
      const usable = hit && (!mustBeFunction || isFunction(env.vars.get(name)));
      chain.push({ envId: env.id, envName: env.name, found: usable });
      if (usable) {
        const value = env.vars.get(name);
        trace?.emit(EV.LOOKUP, { name, node, chain, foundIn: env.id, foundInName: env.name, depth: chain.length - 1 });
        return { value, env };
      }
      env = env.parent;
    }
    trace?.emit(EV.LOOKUP, { name, node, chain, foundIn: null });
    throw new RError(mustBeFunction ? 'err.fnNotFound' : 'err.objNotFound', node, { name });
  }

  /** Look up without throwing -- used by `exists()` and by the UI's inspector. */
  tryLookup(name) {
    let env = this;
    while (env) {
      if (env.vars.has(name)) return { value: env.vars.get(name), env };
      env = env.parent;
    }
    return null;
  }

  /** `x <- value`: always writes into *this* frame. */
  define(name, value, { trace = null, node = null } = {}) {
    const existed = this.vars.has(name);
    const previous = existed ? this.vars.get(name) : null;
    this.vars.set(name, value);
    trace?.emit(EV.ASSIGN, {
      name, node, envId: this.id, envName: this.name,
      value, previous, replaced: existed, scope: 'local',
    });
    return value;
  }

  /**
   * `x <<- value`: walks up looking for an existing binding, and only falls back
   * to the global environment if nothing is found. A frequent source of surprise.
   */
  defineSuper(name, value, { trace = null, node = null } = {}) {
    let env = this.parent;
    while (env) {
      if (env.vars.has(name)) {
        const previous = env.vars.get(name);
        env.vars.set(name, value);
        trace?.emit(EV.ASSIGN, {
          name, node, envId: env.id, envName: env.name,
          value, previous, replaced: true, scope: 'super',
        });
        return value;
      }
      env = env.parent;
    }
    const root = this.root();
    root.vars.set(name, value);
    trace?.emit(EV.ASSIGN, {
      name, node, envId: root.id, envName: root.name,
      value, previous: null, replaced: false, scope: 'super-created',
    });
    return value;
  }

  remove(name) { return this.vars.delete(name); }

  root() {
    let env = this;
    while (env.parent) env = env.parent;
    return env;
  }

  /** A plain snapshot for the environment panel. */
  snapshot() {
    return {
      id: this.id,
      name: this.name,
      role: this.role,
      parentId: this.parent ? this.parent.id : null,
      bindings: [...this.vars.entries()].map(([name, value]) => ({ name, value })),
    };
  }

  /** This frame plus all enclosing ones, innermost first. */
  chainSnapshot() {
    const out = [];
    let env = this;
    while (env) { out.push(env.snapshot()); env = env.parent; }
    return out;
  }
}

/**
 * The smallest DOM that lets the picture code run under node.
 *
 * The pictures only build trees (createElement, append, attributes, classes,
 * dataset, style); layout-dependent work (connector lines, code-box geometry) is
 * deferred to requestAnimationFrame, which never fires here. That split is what
 * makes a headless sweep of every picture possible -- and it is deliberately NOT a
 * browser: it proves nothing throws and every caption is real text, not that it
 * looks right. The browser walk is still the check for that.
 */

class ShimNode {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.childNodes = [];
    this.attributes = {};
    this.dataset = {};
    this.style = { setProperty() {} };
    this.className = '';
    this.hidden = false;
    this.parentElement = null;
    this._text = '';
    const self = this;
    this.classList = {
      add: (...c) => { self.className = [...new Set([...self.className.split(' ').filter(Boolean), ...c])].join(' '); },
      remove: (...c) => { self.className = self.className.split(' ').filter((x) => !c.includes(x)).join(' '); },
      toggle: (c, on) => { if (on ?? !self.className.split(' ').includes(c)) self.classList.add(c); else self.classList.remove(c); },
      contains: (c) => self.className.split(' ').includes(c),
    };
  }

  append(...nodes) { for (const n of nodes) { if (n && typeof n === 'object') n.parentElement = this; this.childNodes.push(n); } }
  prepend(...nodes) { this.childNodes.unshift(...nodes); }
  replaceChildren(...nodes) { this.childNodes = []; this.append(...nodes); }
  removeChild(n) { this.childNodes = this.childNodes.filter((c) => c !== n); return n; }
  remove() { this.parentElement?.removeChild(this); }
  get firstChild() { return this.childNodes[0] || null; }
  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return this.attributes[k] ?? null; }
  addEventListener(type, fn) { ((this._on ||= {})[type] ||= []).push(fn); }
  removeEventListener(type, fn) { if (this._on?.[type]) this._on[type] = this._on[type].filter((f) => f !== fn); }
  /** Test hook: a click runs the element's click listeners. */
  click() { for (const fn of this._on?.click || []) fn({ currentTarget: this, target: this, preventDefault() {}, stopPropagation() {} }); }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  getBoundingClientRect() { return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }; }
  get isConnected() { return false; }

  set innerHTML(html) { this._text = String(html).replace(/<[^>]*>/g, ''); this.childNodes = []; }
  get innerHTML() { return this._text; }
  set textContent(s) { this._text = String(s); this.childNodes = []; }

  /** All text under this node, the way a student would read it. */
  get textContent() {
    return this._text + this.childNodes.map((c) => (c && typeof c === 'object' ? c.textContent : String(c ?? ''))).join('');
  }
}

/** Text nodes are nodes too: `el()` appends anything that is `instanceof Node` as is. */
class ShimText extends ShimNode {
  constructor(s) { super('#text'); this._text = String(s); this.nodeType = 3; }
}

export function installDom() {
  const listeners = {};
  globalThis.Node = ShimNode;
  globalThis.document = {
    createElement: (tag) => new ShimNode(tag),
    createElementNS: (_ns, tag) => new ShimNode(tag),
    createTextNode: (s) => new ShimText(s),
    body: new ShimNode('body'),
    getElementById: () => new ShimNode('div'),
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
    /** Test hook: fire a document event (the bundle boots on DOMContentLoaded). */
    fire(type) { for (const fn of listeners[type] || []) fn(); },
  };
  globalThis.window = globalThis;
  globalThis.requestAnimationFrame = () => 0;
  globalThis.getComputedStyle = () => ({ font: '', lineHeight: '', fontSize: '15px', paddingLeft: '0', paddingTop: '0' });
  globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
}

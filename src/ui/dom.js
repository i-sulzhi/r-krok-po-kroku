/**
 * Tiny DOM helpers.
 *
 * No framework: the trainer ships as one inlined HTML file, and a framework would
 * be most of that file's weight for a UI this small. These four functions cover
 * everything the panels need.
 */

/**
 * Create an element.
 * @param {string} tag  'div', or 'div.cls.cls2' as shorthand
 * @param {Object|string|Array} props  attributes, or children when it is not a plain object
 * @param {...(Node|string)} children
 */
export function el(tag, props, ...children) {
  const [name, ...classes] = tag.split('.');
  const node = document.createElement(name);
  if (classes.length) node.className = classes.join(' ');

  if (props != null && (typeof props !== 'object' || Array.isArray(props) || props instanceof Node)) {
    children.unshift(props);
  } else if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') node.className = [node.className, v].filter(Boolean).join(' ');
      else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
      else if (k === 'dataset') Object.assign(node.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'html') node.innerHTML = v;
      else node.setAttribute(k, v === true ? '' : String(v));
    }
  }

  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

/** Create an SVG element -- needed for the connector arrows between panels. */
export function svg(tag, props = {}, ...children) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    node.setAttribute(k, String(v));
  }
  for (const c of children.flat(Infinity)) {
    if (c == null) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

export const clear = (node) => { while (node.firstChild) node.removeChild(node.firstChild); return node; };

export const mount = (node, ...children) => { clear(node); node.append(...children.flat(Infinity).filter(Boolean)); return node; };

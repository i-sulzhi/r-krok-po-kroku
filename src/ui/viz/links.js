/**
 * Curved connectors between cells, drawn after layout.
 *
 * Several pictures say "this cell went there": a selected element lifted into the
 * result, a pair of operands feeding one result cell, a part of `c()` landing in the
 * combined vector. The shape of those lines *is* the explanation, so they are drawn
 * from real element positions rather than assumed ones -- and redrawn when the
 * stage changes size.
 */

import { svg } from '../dom.js';

const observers = new Set();

/** Stop every resize watcher -- called whenever the stage is redrawn. */
export function releaseLinks() {
  for (const o of observers) o.disconnect();
  observers.clear();
}

/**
 * @param {HTMLElement} container  positioned ancestor of all endpoints
 * @param {() => Array<{from: Element, to: Element, cls?: string}>} pairs
 *   a function, so the endpoints are looked up again on every redraw
 */
export function drawLinks(container, pairs) {
  const draw = () => {
    container.querySelector(':scope > svg.lk-layer')?.remove();
    const box = container.getBoundingClientRect();
    if (!box.width) return;
    const layer = svg('svg', {
      class: 'lk-layer', width: box.width, height: box.height,
      viewBox: `0 0 ${box.width} ${box.height}`, 'aria-hidden': 'true',
    });
    for (const p of pairs()) {
      if (!p.from || !p.to) continue;
      const a = p.from.getBoundingClientRect();
      const b = p.to.getBoundingClientRect();
      const x1 = a.left - box.left + a.width / 2;
      const y1 = a.bottom - box.top;
      const x2 = b.left - box.left + b.width / 2;
      const y2 = b.top - box.top;
      const my = (y1 + y2) / 2;
      layer.append(svg('path', {
        d: `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`,
        class: ['lk', p.cls || ''].filter(Boolean).join(' '),
      }));
    }
    container.prepend(layer);
  };
  requestAnimationFrame(draw);
  if (typeof ResizeObserver !== 'undefined') {
    let pending = false;
    const o = new ResizeObserver(() => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => { pending = false; draw(); });
    });
    o.observe(container);
    observers.add(o);
  }
}

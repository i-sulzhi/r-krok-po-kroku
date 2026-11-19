/* Injected into the knitted lecture by annotate-wyklad.py (D125): double-click a part
   of the page to see the lines of lab3-wyklad.Rmd that made it, each with a note. */
// rmarkdown's own scripts rebuild the <h2> headings on jQuery's ready, so this runs on
// window load, after them; annotations put on the old nodes would be lost.
(function () {
  if (document.readyState === 'complete') rmdAnnotateInit();
  else window.addEventListener('load', rmdAnnotateInit);
})();

function rmdAnnotateInit() {
  var BLOCKS = __BLOCKS__;
  var FILE = '__FILE__';
  var main = document.querySelector('.main-container');
  if (!main) return;

  // The rendered elements, in the order annotate-wyklad.py checked.
  var els = [];
  Array.prototype.forEach.call(main.children, function (el) {
    if (el.classList.contains('section')) Array.prototype.forEach.call(el.children, function (c) { els.push(c); });
    else els.push(el);
  });
  function matches(el, tag) {
    if (tag.indexOf('#') > 0) return el.id === tag.split('#')[1];
    return el.tagName.toLowerCase() === tag;
  }

  var k = 0, pendingHidden = [], ok = true;
  BLOCKS.forEach(function (b, i) {
    if (b.hidden) { pendingHidden.push(i); return; }
    b.tags.forEach(function (tag) {
      var el = els[k++];
      if (!el || !matches(el, tag)) { ok = false; return; }
      el.classList.add('rmd-blk');
      el.setAttribute('data-rmd', String(i));
      if (el.id === 'TOC') el.setAttribute('data-rmd-focus', 'toc:');
      pendingHidden.forEach(function (h) { el.parentNode.insertBefore(hiddenBar(h), el); });
      pendingHidden = [];
    });
  });
  if (!ok) { if (window.console) console.error('rmd annotations do not match the page'); return; }
  pendingHidden.forEach(function (h) { main.appendChild(hiddenBar(h)); });

  function hiddenBar(i) {
    var d = document.createElement('div');
    d.className = 'rmd-hidden';
    d.setAttribute('data-rmd', String(i));
    d.textContent = 'Tu stoi chunk, którego czytelnik nie widzi (wiersze ' + BLOCKS[i].from + '-' + BLOCKS[i].to +
      '). Kliknij dwa razy, żeby zobaczyć jego kod.';
    return d;
  }

  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function panel(i, focus) {
    var b = BLOCKS[i];
    var p = document.createElement('div');
    p.className = 'rmd-panel';
    var head = b.from === b.to ? 'wiersz ' + b.from : 'wiersze ' + b.from + '-' + b.to;
    var h = '<div class="rmd-head"><span>' + FILE + ', ' + head + '</span>' +
      '<button type="button" class="rmd-x" aria-label="Zamknij">×</button></div>';
    b.groups.forEach(function (g) {
      var src = '';
      for (var n = g.from; n <= g.to; n++) {
        src += '<span class="rmd-ln">' + n + '</span>' + esc(b.lines[n - b.from]) + '\n';
      }
      var lines = b.lines.slice(g.from - b.from, g.to - b.from + 1).join('\n');
      var f = focus && lines.indexOf(focus) >= 0 ? ' rmd-focus' : '';
      h += '<div class="rmd-grp' + f + '"><pre class="rmd-src">' + src.replace(/\n$/, '') + '</pre>' +
        '<p class="rmd-why">' + g.note + '</p></div>';
    });
    p.innerHTML = h;
    return p;
  }

  function toggle(el) {
    var next = el.nextElementSibling;
    if (next && next.classList.contains('rmd-panel')) { next.parentNode.removeChild(next); return false; }
    el.parentNode.insertBefore(panel(+el.getAttribute('data-rmd'), el.getAttribute('data-rmd-focus')), el.nextSibling);
    return true;
  }

  document.addEventListener('dblclick', function (ev) {
    if (ev.target.closest('.rmd-panel, .rmd-help')) return;
    var el = ev.target.closest('.rmd-blk, .rmd-hidden');
    if (!el) return;
    if (window.getSelection) window.getSelection().removeAllRanges();
    toggle(el);
  });
  document.addEventListener('click', function (ev) {
    var x = ev.target.closest('.rmd-x');
    if (x) { var p = x.closest('.rmd-panel'); p.parentNode.removeChild(p); }
  });

  // The help box with the "show everywhere" switch, under the title.
  var help = document.createElement('div');
  help.className = 'rmd-help';
  help.innerHTML = 'Ta strona to raport R Markdown. <b>Kliknij dwa razy</b> dowolny fragment, a pod nim pojawią się ' +
    'wiersze pliku <a href="' + FILE + '">' + FILE + '</a>, z których powstał, z wyjaśnieniem każdego wiersza. ' +
    'Drugi podwójny klik je chowa. Jak każda część przechodzi przez Knit, pokazuje strona ' +
    '<a href="lab3-anatomia.html">Co robi Knit</a>.<br>' +
    '<button type="button" aria-pressed="false" data-rmd-all>Pokaż kod wszędzie</button>';
  var header = document.getElementById('header');
  header.parentNode.insertBefore(help, header.nextSibling);
  help.querySelector('[data-rmd-all]').addEventListener('click', function () {
    var on = this.getAttribute('aria-pressed') !== 'true';
    this.setAttribute('aria-pressed', String(on));
    this.textContent = on ? 'Schowaj kod' : 'Pokaż kod wszędzie';
    Array.prototype.forEach.call(document.querySelectorAll('.rmd-panel'), function (p) { p.parentNode.removeChild(p); });
    if (!on) return;
    var seen = {};
    Array.prototype.forEach.call(document.querySelectorAll('.rmd-blk, .rmd-hidden'), function (el) {
      var i = el.getAttribute('data-rmd');
      if (seen[i]) return;          // the header block opens once, under the title
      seen[i] = true;
      toggle(el);
    });
  });
}

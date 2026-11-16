"""Build lab/lab3-anatomia.html: what Knit does to each part of a small .Rmd (D124).

Inputs are the real files of one knit (rmarkdown 2.30, knitr 1.51, pandoc 3.7):
  lab/lab3-przyklad.Rmd              the source
  lab/tools/anatomia.md              knitr's intermediate Markdown (keep_md = TRUE)
  lab/tools/anatomia-body.html       pandoc's HTML, the part between the header and the scripts
  lab/lab3-anatomia-wykres.png       the plot knitr drew
Knit again and rerun this script when the source changes:
  rmarkdown::render("lab3-przyklad.Rmd",
    output_options = list(keep_md = TRUE, self_contained = FALSE))
Segments are line ranges (1-based, inclusive) in each file; lines in no segment are
shown dimmed.
"""
import html
import io
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
LAB = os.path.dirname(HERE)


def lines(path):
    return io.open(path, encoding='utf-8').read().rstrip('\n').split('\n')


RMD = lines(os.path.join(LAB, 'lab3-przyklad.Rmd'))
MD = lines(os.path.join(HERE, 'anatomia.md'))
HT = lines(os.path.join(HERE, 'anatomia-body.html'))

# id, Rmd lines, md lines, html lines, marks (source, outputs), note
SEGMENTS = [
    ('yaml', (1, 6), (1, 6), (1, 9), (['`r Sys.Date()`'], ['2026-11-16']),
     'Nagłówek. knitr liczy w nim kod inline, więc w pliku .md zamiast `r Sys.Date()` stoi już '
     'data. Pandoc robi z tytułu, autora i daty górę strony.'),
    ('setup', (8, 13), (7, 9), None, ([], []),
     'Chunk z include = FALSE. knitr uruchamia kod: ładuje pakiety, wczytuje dane i tworzy net. '
     'Do pliku .md nie wpisuje jednak niczego, więc w HTML i na stronie nie ma po nim śladu. '
     'Obiekty zostają dla reszty pliku.'),
    ('dane', (15, 15), (10, 10), (12, 13), ([], []),
     'Zwykły tekst Markdown. knitr przepisuje go bez zmian. Pandoc zamienia ## w nagłówek <h2> '
     'i otwiera nową część strony.'),
    ('bold', (17, 17), (12, 12), (14, 15), (['**'], ['**', '<strong>', '</strong>']),
     'Dwie gwiazdki z obu stron to pogrubienie. W pliku .md jeszcze są, pandoc zamienia je na '
     'znacznik <strong>, a przeglądarka rysuje grubszą czcionkę.'),
    ('chunk', (19, 21), (15, 21), (16, 17), ([], ['## [1] 1039']),
     'Zwykły chunk. knitr wkleja do pliku .md kod, a pod nim wynik z ## na początku. Pandoc robi '
     'z nich dwa bloki <pre>, jeden z kodem i drugi z wynikiem.'),
    ('inline', (23, 23), (23, 23), (18, 18), (['`r nrow(net)`', '`r round(mean(net$netustm))`'], ['1039', '231']),
     'Kod inline. knitr liczy go i wstawia do zdania samą liczbę. Pandoc i przeglądarka widzą już '
     'tylko 1039 i 231 i nie wiedzą, że to był kod. Dlatego po zmianie danych wystarczy Knit.'),
    ('wyniki', (25, 25), (25, 25), (20, 21), ([], []),
     'Drugi nagłówek części. Pandoc zamyka poprzednią część i otwiera nową.'),
    ('tabela', (27, 31), (28, 31), (22, 39), (['echo = FALSE'], ['282', '191']),
     'Chunk z echo = FALSE. Kodu nie ma już nigdzie, zostaje tylko wynik. kable() wypisuje tabelę '
     'w Markdown, z kreskami |, a pandoc robi z niej tabelę HTML <table>.'),
    ('wykres', (33, 37), (33, 33), (40, 44), (['fig.cap = "Starsi spędzają w sieci mniej czasu."'], ['Starsi spędzają w sieci mniej czasu.']),
     'Chunk z wykresem. knitr rysuje wykres do pliku PNG i wstawia do .md odnośnik do obrazka, '
     'a fig.cap staje się podpisem. message = FALSE zatrzymał komunikat geom_smooth(). W raporcie '
     'do oddania obrazek jest zapisany w środku pliku HTML, więc plik działa sam.'),
    ('lista', (39, 40), (35, 36), (45, 48), (['`r sum(net$agea < 40)`'], ['456']),
     'Lista Markdown z kodem inline. Myślniki stają się punktami listy <ul> i <li>, a kod inline '
     'liczbą 456.'),
]


def line_owner(n_lines, pick):
    owner = [None] * n_lines
    for seg in SEGMENTS:
        rng = pick(seg)
        if rng:
            for i in range(rng[0] - 1, rng[1]):
                owner[i] = seg[0]
    return owner


def view(text_lines, owner, marks_for):
    """Lines as HTML, consecutive lines of one segment grouped in one span."""
    out, cur, buf = [], None, []

    def flush():
        if not buf:
            return
        body = '\n'.join(buf)
        esc = html.escape(body)
        if cur:
            for m in marks_for(cur):
                esc = esc.replace(html.escape(m), '<mark>' + html.escape(m) + '</mark>')
            out.append('<span class="seg" data-seg="%s" tabindex="0" role="button">%s</span>' % (cur, esc))
        else:
            out.append('<span class="rest">%s</span>' % esc)
    for line, own in zip(text_lines, owner):
        if own != cur:
            flush()
            buf, cur = [], own
        buf.append(line)
    flush()
    return '\n'.join(out)


marks = {s[0]: s[4] for s in SEGMENTS}
rmd_html = view(RMD, line_owner(len(RMD), lambda s: s[1]), lambda k: marks[k][0])
md_html = view(MD, line_owner(len(MD), lambda s: s[2]), lambda k: marks[k][1])
ht_html = view(HT, line_owner(len(HT), lambda s: s[3]), lambda k: marks[k][1])
notes = {s[0]: s[5] for s in SEGMENTS}

PAGE = '''
<div class="pg-seg" data-seg="yaml"><div class="pg-title">Ile czasu w sieci?</div>
<div class="pg-sub">Anna Kowalska</div><div class="pg-sub"><mark>2026-11-16</mark></div></div>
<div class="pg-seg pg-empty" data-seg="setup">(tu nic nie ma)</div>
<div class="pg-seg" data-seg="dane"><div class="pg-h2">Dane</div></div>
<div class="pg-seg" data-seg="bold"><p>Pytamy, ile minut dziennie <b>ludzie spędzają w internecie</b>.</p></div>
<div class="pg-seg" data-seg="chunk"><pre class="pg-code">nrow(net)</pre><pre class="pg-out"><mark>## [1] 1039</mark></pre></div>
<div class="pg-seg" data-seg="inline"><p>Odpowiedziało <mark>1039</mark> osób, średnio <mark>231</mark> minut.</p></div>
<div class="pg-seg" data-seg="wyniki"><div class="pg-h2">Wyniki</div></div>
<div class="pg-seg" data-seg="tabela"><table class="pg-table"><tr><th>Wiek</th><th class="r">Minuty</th></tr>
<tr><td>do 40 lat</td><td class="r"><mark>282</mark></td></tr><tr><td>40 lat i więcej</td><td class="r"><mark>191</mark></td></tr></table></div>
<div class="pg-seg" data-seg="wykres"><img src="lab3-anatomia-wykres.png" alt="Wykres: wiek i minuty w sieci, linia opada z wiekiem">
<div class="pg-cap"><mark>Starsi spędzają w sieci mniej czasu.</mark></div></div>
<div class="pg-seg" data-seg="lista"><ul><li>Młodsi są w sieci dłużej.</li><li>W grupie do 40 lat jest <mark>456</mark> osób.</li></ul></div>
'''

tpl = io.open(os.path.join(HERE, 'anatomia-template.html'), encoding='utf-8').read()
out = (tpl.replace('{{RMD}}', rmd_html).replace('{{MD}}', md_html).replace('{{HTML}}', ht_html)
          .replace('{{PAGE}}', PAGE).replace('{{NOTES}}', json.dumps(notes, ensure_ascii=False)))
assert '{{' not in out
io.open(os.path.join(LAB, 'lab3-anatomia.html'), 'w', encoding='utf-8', newline='\n').write(out)
print('segments:', len(SEGMENTS), ' bytes:', len(out.encode('utf-8')))

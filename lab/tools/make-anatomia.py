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

# Line notes (D126): a double-click on a part of the .Rmd opens these under it, like the
# lecture (annotate-wyklad.py). Absolute line numbers of lab3-przyklad.Rmd; every line of a
# segment must be covered exactly once.
C = lambda t: '<code>' + html.escape(t) + '</code>'
LINE_NOTES = {
    'yaml': [
        (1, 1, 'Trzy kreski otwierają nagłówek pliku (YAML), czyli ustawienia raportu.'),
        (2, 2, f'{C("title")}: tytuł, duży napis na górze strony.'),
        (3, 3, f'{C("author")}: autor, pod tytułem.'),
        (4, 4, f'{C("date")}: data. Stoi tu kod inline {C("`r Sys.Date()`")}, więc przy każdym Knit wpisuje się dzisiejsza.'),
        (5, 5, f'{C("output: html_document")}: z pliku powstanie strona HTML.'),
        (6, 6, 'Trzy kreski zamykają nagłówek.'),
    ],
    'setup': [
        (8, 8, f'Początek chunku. {C("setup")} to nazwa chunku, czyli jego etykieta. Nie tworzy żadnego obiektu R. Nazwę zobaczysz w komunikacie {C("Quitting from … [setup]")}, gdy w tym chunku coś pójdzie nie tak. {C("include = FALSE")} każe uruchomić kod i niczego nie pokazywać.'),
        (9, 10, f'Ładuje pakiety: {C("haven")} do plików SPSS i {C("ggplot2")} do wykresu. Muszą stać w pliku, bo Knit nie widzi pakietów z konsoli.'),
        (11, 11, f'Wczytuje dane z pliku, który leży w tym samym folderze co {C(".Rmd")}.'),
        (12, 12, 'Zostawia rundę 11 (rok 2023) i osoby, które podały minuty w sieci i wiek. Nawias kwadratowy wybiera wiersze; puste miejsce po przecinku znaczy, że zostają wszystkie kolumny.'),
        (13, 13, 'Trzy odwrotne apostrofy zamykają chunk.'),
    ],
    'dane': [(15, 15, f'{C("##")} i spacja robią nagłówek części.')],
    'bold': [(17, 17, f'Zwykłe zdanie. Dwie gwiazdki z obu stron, {C("**...**")}, robią pogrubienie.')],
    'chunk': [
        (19, 19, f'Początek chunku bez nazwy i bez ustawień; knitr sam nazwie go w rodzaju {C("unnamed-chunk-1")}. Czytelnik zobaczy i kod, i wynik.'),
        (20, 20, f'{C("nrow(net)")} liczy wiersze tabeli, czyli osoby.'),
        (21, 21, 'Koniec chunku.'),
    ],
    'inline': [(23, 23, f'Dwa kody inline. {C("`r nrow(net)`")} wstawia liczbę osób, a {C("`r round(mean(net$netustm))`")} średnią minut zaokrągloną do całości.')],
    'wyniki': [(25, 25, 'Drugi nagłówek części.')],
    'tabela': [
        (27, 27, f'{C("tabela")} to nazwa chunku, czyli jego etykieta. Nie tworzy żadnego obiektu R; obiekt tworzy dopiero {C("<-")} niżej, tu {C("grupy")}. Nazwę zobaczysz w komunikacie {C("Quitting from … [tabela]")}, gdy w tym chunku coś pójdzie nie tak. {C("echo = FALSE")} chowa kod; zostaje tylko tabela.'),
        (28, 29, f'Tabela R z dwoma wierszami: grupa wieku i średnie minuty w sieci w tej grupie. {C("net$agea < 40")} wybiera osoby poniżej 40 lat.'),
        (30, 30, f'{C("knitr::kable()")} pisze tę tabelę w Markdown; {C("digits = 0")} zaokrągla do pełnych minut.'),
        (31, 31, 'Koniec chunku.'),
    ],
    'wykres': [
        (33, 33, f'{C("wykres")} to nazwa chunku, czyli jego etykieta. Nie tworzy żadnego obiektu R. Nazwę zobaczysz w komunikacie {C("Quitting from … [wykres]")}, gdy w tym chunku coś pójdzie nie tak. {C("echo = FALSE")} chowa kod, {C("message = FALSE")} chowa komunikat pakietu, a {C("fig.cap")} to podpis pod wykresem.'),
        (34, 34, f'{C("ggplot()")} bierze tabelę {C("net")}; {C("aes()")} mówi, że wiek idzie na oś x, a minuty na oś y. Plus łączy warstwy wykresu.'),
        (35, 35, f'{C("geom_point()")} rysuje kropkę dla każdej osoby; {C("alpha = 0.3")} robi je półprzezroczyste, więc tam, gdzie jest ich wiele, kolor ciemnieje.'),
        (36, 36, f'{C("geom_smooth(method = \"lm\")")} dorysowuje prostą z {C("lm()")}; {C("se = FALSE")} wyłącza szary pas wokół niej.'),
        (37, 37, 'Koniec chunku.'),
    ],
    'lista': [
        (39, 39, 'Myślnik i spacja na początku linii robią punkt listy.'),
        (40, 40, f'Drugi punkt, z kodem inline: {C("sum(net$agea < 40)")} liczy osoby poniżej 40 lat.'),
    ],
}
for seg in SEGMENTS:
    a, b = seg[1]
    groups = LINE_NOTES[seg[0]]
    covered = sorted(l for f, t, _ in groups for l in range(f, t + 1))
    assert covered == list(range(a, b + 1)), (seg[0], covered)
assert set(LINE_NOTES) == {s[0] for s in SEGMENTS}
lines_json = {k: {'groups': [{'from': f, 'to': t, 'note': x, 'lines': RMD[f - 1:t]} for f, t, x in g]}
              for k, g in LINE_NOTES.items()}

tpl = io.open(os.path.join(HERE, 'anatomia-template.html'), encoding='utf-8').read()
out = (tpl.replace('{{RMD}}', rmd_html).replace('{{MD}}', md_html).replace('{{HTML}}', ht_html)
          .replace('{{PAGE}}', PAGE).replace('{{NOTES}}', json.dumps(notes, ensure_ascii=False))
          .replace('{{LINES}}', json.dumps(lines_json, ensure_ascii=False)))
assert '{{' not in out
io.open(os.path.join(LAB, 'lab3-anatomia.html'), 'w', encoding='utf-8', newline='\n').write(out)
print('segments:', len(SEGMENTS), ' bytes:', len(out.encode('utf-8')))

"""Make lab/lab3-wyklad.html explain itself (D125).

Double-click any part of the knitted lecture (or press "Pokaż kod wszędzie") and the
lines of lab/lab3-wyklad.Rmd that made it open underneath, each group with a note, like
a Jupyter cell switching to its source.

  1. knit:  rmarkdown::render("lab3-wyklad.Rmd", output_file = "lab3-wyklad.knit.html",
                              output_dir = "tools")       (in lab/)
  2. run:   python lab/tools/annotate-wyklad.py
     reads  lab/lab3-wyklad.Rmd and lab/tools/lab3-wyklad.knit.html
     writes lab/lab3-wyklad.html (served)

The .Rmd is cut into blocks (YAML header, chunks, fences, blank-line paragraphs). Each
block maps to its rendered element(s) in document order; the script checks the order of
tags against the knitted page and fails loudly on a mismatch. Notes are keyed by the
first line of their block, so editing the lecture's text does not shift them; a block
without a note, or a note without a block, is an error.
"""
import html
import io
import json
import os
import re
from html.parser import HTMLParser

HERE = os.path.dirname(os.path.abspath(__file__))
LAB = os.path.dirname(HERE)
RMD_PATH = os.path.join(LAB, 'lab3-wyklad.Rmd')
KNIT_PATH = os.path.join(HERE, 'lab3-wyklad.knit.html')
OUT_PATH = os.path.join(LAB, 'lab3-wyklad.html')
C = lambda s: '<code>' + html.escape(s) + '</code>'

# ---------------------------------------------------------------- notes
# key: the start of the block's first line. value: list of (from, to, note) with line
# offsets inside the block (1 = its first line), or a single note for the whole block.
NOTES = {
    '---': [
        (1, 1, 'Trzy kreski otwierają nagłówek pliku (YAML). R Markdown bierze z niego ustawienia raportu; samego nagłówka na stronie nie widać.'),
        (2, 2, f'{C("title")} to tytuł, duży napis na górze strony.'),
        (3, 3, f'{C("subtitle")} to podtytuł pod tytułem.'),
        (4, 4, f'{C("date")} to data. Nie jest wpisana ręcznie: stoi tu kod inline {C("`r Sys.Date()`")}, więc przy każdym Knit pojawia się dzisiejsza data.'),
        (5, 6, f'{C("output")} mówi, jaki raport powstanie. {C("html_document")} to strona HTML. Wcięcia pokazują, że ustawienie w następnej linii należy do tego formatu.'),
        (7, 7, f'{C("toc: true")} włącza spis treści (ang. table of contents). Pandoc zbiera wszystkie nagłówki {C("##")} z pliku i robi z nich listę odnośników pod tytułem. Numery 1-6 są wpisane w samych nagłówkach; spis treści ich nie dodaje.'),
        (8, 8, 'Trzy kreski zamykają nagłówek.'),
    ],
    '```{r setup': [
        (1, 1, f'Początek chunku. {C("r")} to język, {C("setup")} to nazwa chunku (pojawia się w komunikacie {C("Quitting from")}), a {C("include = FALSE")} każe uruchomić kod i niczego nie pokazywać. Dlatego na stronie po tym chunku zostaje tylko ta szara belka.'),
        (2, 2, f'{C("library(haven)")} ładuje pakiet do plików SPSS. Musi stać w raporcie, bo Knit nie widzi pakietów załadowanych w konsoli.'),
        (3, 3, f'Wczytuje dane z pliku, który leży w tym samym folderze co plik {C(".Rmd")}.'),
        (4, 4, 'Zostawia rundę 11 (rok 2023) i osoby, które podały wiek i minuty w sieci: 1039 osób, jak w laboratorium 2.'),
        (5, 5, f'{C("zap_labels()")} usuwa etykiety SPSS; zostają same liczby.'),
        (6, 7, f'Pusta linia i komentarz. Komentarz zaczyna się od {C("#")}, R go pomija.'),
        (8, 8, f'{C("function(ziarno)")} tworzy własną funkcję {C("blad()")}. Dzięki niej część 1 liczy pomyłkę przy dwóch ziarnach losowania jednym krótkim wywołaniem.'),
        (9, 12, f'W środku to samo co w ćwiczeniach 43 i 44: ziarno losowania, 80% osób do uczenia, prosta {C("lm()")} na nich i reszta osób jako testowe.'),
        (13, 13, 'Ostatnia linia funkcji jest jej wynikiem: RMSE, typowa pomyłka w minutach na osobach testowych.'),
        (14, 14, 'Klamra zamyka funkcję.'),
        (15, 15, 'Trzy odwrotne apostrofy zamykają chunk.'),
    ],
    'Ten tekst sam jest raportem': f'Zwykły akapit. {C("[tekst](adres)")} to odnośnik: w nawiasie kwadratowym tekst, który widać, w okrągłym plik albo strona. Słowo w odwrotnych apostrofach, tu {C("`ess_polska.sav`")}, pandoc pokazuje czcionką kodu, ale niczego nie uruchamia. Przejścia do nowej linii w środku akapitu znikają; akapit kończy dopiero pusta linia.',
    '## 1.': f'{C("##")} robi nagłówek części. Pandoc nadaje mu kotwicę z jego tekstu, a {C("toc: true")} z nagłówka pliku dopisuje go do spisu treści na górze.',
    'W laboratorium 2 model': 'Zwykły tekst bez znaczników. Trzy linie w pliku to jeden akapit na stronie.',
    '> Model myli się': f'Znak {C(">")} na początku linii robi cytat. Liczba 201 jest tu wpisana ręcznie, celowo: to przykład zdania przepisanego z konsoli.',
    'Teraz ktoś zmienia losowanie': f'{C("`set.seed(7)`")} w pojedynczych apostrofach to tylko tekst czcionką kodu. Kodem inline jest dopiero {C("`r round(blad(7))`")}: knitr wywołuje funkcję {C("blad()")} z ukrytego chunku setup, zaokrągla wynik i wstawia 197. Liczba 201 w trzeciej linii jest wpisana ręcznie, bo mówi o zdaniu z Worda.',
    'W R Markdown to samo zdanie': f'Dwa kody inline liczą pomyłkę przy dwóch ziarnach i dają 201 oraz 197. Dwie gwiazdki z obu stron, {C("**...**")}, robią pogrubienie.',
    '## 2.': f'Nagłówek części 2. Jak każdy {C("##")}, trafia też do spisu treści.',
    'Plik `.Rmd` to tekst': 'Zwykły akapit z jednym słowem czcionką kodu.',
    '````markdown': [
        (1, 1, f'Cztery odwrotne apostrofy i słowo {C("markdown")} otwierają blok, który ma być pokazany dosłownie. Cztery, a nie trzy, bo w środku stoją trzy; blok kończy się dopiero na czterech.'),
        (2, 11, f'Zawartość bloku: przykład pliku {C(".Rmd")}. Na stronie widać ją dokładnie tak, jak jest napisana, i nic z niej się nie wykonuje.'),
        (12, 12, f'{C("`r \'\'`")} przed {C("```{r}")} to sztuczka. Pusty kod inline sprawia, że knitr nie bierze tej linii za początek prawdziwego chunku; po Knit zostaje samo {C("```{r}")}.'),
        (13, 14, 'Reszta przykładu: kod chunku i trzy apostrofy, które go zamykają.'),
        (15, 15, 'Cztery apostrofy zamykają blok.'),
    ],
    '- **Nagłówek**': f'Lista. Każdy punkt zaczyna się od myślnika, a linia z wcięciem należy dalej do tego samego punktu. Zapis {C("```` ```{r} ````")}, z czterema apostrofami z obu stron, pokazuje trzy apostrofy jako kod.',
    'Co dzieje się z każdą': f'Akapit z odnośnikiem do strony {C("lab3-anatomia.html")}, która pokazuje każdy etap Knit osobno.',
    '## 3.': 'Nagłówek części 3.',
    'Liczbę wstawia się do zdania': f'Podwójne apostrofy z odstępem, {C("`` ... ``")}, pozwalają pokazać apostrofy jako kod. W środku {C("knitr::inline_expr(\"nrow(net)\")")} zwraca sam tekst {C("`r nrow(net)`")}, więc czytelnik widzi składnię, a nie wynik. Na końcu zdania stoi już prawdziwy kod inline {C("`r nrow(net)`")}, który daje 1039.',
    'Kod inline powinien zwracać': f'Pierwszy kod inline wstawia średnią bez zaokrąglenia, celowo, żeby było widać 230.8642926. Potem znów pokazana jest składnia i prawdziwy wynik z {C("round()")}: 231.',
    '## 4.': 'Nagłówek części 4.',
    'Knit nie korzysta z tego': 'Pogrubienie może objąć kilka linii: gwiazdki otwierają je w drugiej linii akapitu, a zamykają w trzeciej.',
    'Najczęstszy błąd wygląda tak': 'Zwykły akapit z nazwą obiektu czcionką kodu.',
    '```': [
        (1, 1, f'Trzy apostrofy bez {C("{r}")} otwierają zwykły blok tekstu czcionką kodu. To nie jest chunk, knitr niczego tu nie uruchamia.'),
        (2, 2, f'Pierwsza linia komunikatu: R liczył kod inline ({C("eval")}) i trafił na błąd.'),
        (3, 3, f'Co poszło nie tak: nie ma obiektu {C("srednia")}.'),
        (4, 4, f'Gdzie: plik {C("raport.Rmd")}, wiersze od 67 do 67. Komunikat skopiowano z prawdziwego Knit.'),
        (5, 5, 'Trzy apostrofy zamykają blok.'),
    ],
    'Ostatnia linijka mówi': 'Zwykły akapit; słowa czcionką kodu są tylko tekstem.',
    'Z tej samej zasady': 'Zwykły akapit; fragmenty komunikatów stoją w apostrofach, więc wyglądają jak kod.',
    '## 5.': 'Nagłówek części 5.',
    'Raport pisze się dla czytelnika': 'Zwykły akapit.',
    '| Ustawienie': [
        (1, 1, f'Wiersz nagłówka tabeli. Kolumny oddzielają kreski {C("|")}.'),
        (2, 2, 'Linia z myślnikami oddziela nagłówek od reszty. Bez niej pandoc nie rozpozna tabeli.'),
        (3, 6, 'Wiersze tabeli. Puste miejsce między dwiema kreskami to pusta komórka.'),
    ],
    'Ten chunk ma `echo = FALSE`': 'Zwykły akapit, który zapowiada tabelę z chunku poniżej.',
    '```{r grupy': [
        (1, 1, f'Początek chunku o nazwie {C("grupy")}. {C("echo = FALSE")}: kod się wykona, ale czytelnik zobaczy tylko wynik, czyli tabelę.'),
        (2, 6, f'Tworzy tabelę {C("grupy")}: dwa wiersze, dla każdej grupy wieku liczba osób i średnia minut w sieci.'),
        (7, 7, f'{C("knitr::kable()")} zamienia tabelę R w tabelę Markdown, a pandoc w tabelę HTML. {C("digits = 0")} zaokrągla do pełnych minut.'),
        (8, 8, 'Trzy apostrofy zamykają chunk.'),
    ],
    'Ustawienia dla całego raportu': 'Zwykły akapit. Kod w apostrofach to tylko tekst; w tym pliku nie jest uruchamiany.',
    '## 6.': 'Nagłówek części 6.',
    'W [laboratorium 3]': 'Akapit z odnośnikiem do strony laboratorium 3.',
    'Krótko, do zapamiętania': 'Jedno zdanie jako osobny akapit.',
    '- Knit robi z pliku': 'Lista pięciu punktów; każdy zaczyna się od myślnika.',
    '<p style=': f'Zwykły znacznik HTML wpisany w plik {C(".Rmd")}. Pandoc przepuszcza go bez zmian; {C("style")} ustawia mniejszą, szarą czcionkę.',
}

# ---------------------------------------------------------------- blocks
def blocks(lines):
    """[(kind, first, last)] with 1-based inclusive line numbers."""
    out, i, n = [], 0, len(lines)
    while i < n:
        line = lines[i]
        if not line.strip():
            i += 1
            continue
        start = i
        if i == 0 and line == '---':
            i += 1
            while lines[i] != '---':
                i += 1
            out.append(('yaml', start + 1, i + 1)); i += 1; continue
        m = re.match(r'^(`{3,})', line)
        if m:
            fence = m.group(1)
            kind = 'chunk' if line.startswith('```{r') else 'fence'
            i += 1
            while not re.match(r'^' + fence + r'\s*$', lines[i]):
                i += 1
            out.append((kind, start + 1, i + 1)); i += 1; continue
        while i < n and lines[i].strip():
            i += 1
        out.append(('para', start + 1, i))
    return out


def rendered_tag(kind, text):
    """The tag(s) the block becomes, in order."""
    if kind == 'yaml':
        return ['div#header', 'div#TOC']
    if kind == 'chunk':
        if 'include = FALSE' in text:
            return []
        return ['table']          # the one visible chunk of this lecture prints a kable table
    if kind == 'fence':
        return ['pre']
    first = text.split('\n')[0]
    if first.startswith('## '):
        return ['h2']
    if first.startswith('> '):
        return ['blockquote']
    if first.startswith('- '):
        return ['ul']
    if first.startswith('|'):
        return ['table']
    return ['p']


class Order(HTMLParser):
    """Tags of #header, #TOC, direct children of the main container and of its sections."""
    def __init__(self):
        super().__init__(); self.stack = []; self.out = []
    def handle_starttag(self, tag, attrs):
        if tag in ('br', 'img', 'hr', 'meta', 'link', 'input', 'col', 'source', 'wbr'):
            return
        a = dict(attrs)
        parent = self.stack[-1] if self.stack else None
        if parent and parent[0] == 'main':
            if a.get('id') in ('header', 'TOC'):
                self.out.append('div#' + a['id'])
            elif 'section' not in a.get('class', ''):
                self.out.append(tag)
        elif parent and parent[0] == 'section':
            self.out.append(tag)
        role = 'main' if 'main-container' in a.get('class', '') else ('section' if 'section' in a.get('class', '').split() else '')
        self.stack.append((role, tag))
    def handle_endtag(self, tag):
        if tag in ('br', 'img', 'hr', 'meta', 'link', 'input', 'col', 'source', 'wbr'):
            return
        if self.stack:
            self.stack.pop()


def main():
    rmd = io.open(RMD_PATH, encoding='utf-8').read().rstrip('\n').split('\n')
    knit = io.open(KNIT_PATH, encoding='utf-8').read()
    assert 'data-rmd-annotated' not in knit, 'run on the raw knit, not on an annotated page'

    data, expected, used = [], [], set()
    for kind, a, b in blocks(rmd):
        text = '\n'.join(rmd[a - 1:b])
        key = next((k for k in sorted(NOTES, key=len, reverse=True) if rmd[a - 1].startswith(k)), None)
        if key is None:
            raise SystemExit(f'no note for block at line {a}: {rmd[a - 1]!r}')
        if key in used and key not in ('```',):
            raise SystemExit(f'note key used twice: {key!r} (line {a})')
        used.add(key)
        note = NOTES[key]
        groups = [(a, b, note)] if isinstance(note, str) else [(a + f - 1, a + t - 1, x) for f, t, x in note]
        covered = sorted(l for f, t, _ in groups for l in range(f, t + 1))
        assert covered == list(range(a, b + 1)), f'notes of block at line {a} do not cover lines {a}-{b} exactly: {covered}'
        tags = rendered_tag(kind, text)
        expected += tags
        data.append({'from': a, 'to': b, 'tags': tags, 'hidden': not tags,
                     'lines': rmd[a - 1:b],
                     'groups': [{'from': f, 'to': t, 'note': x} for f, t, x in groups]})
    unused = set(NOTES) - used
    assert not unused, f'notes without a block: {unused}'

    main_html = knit[knit.index('<div class="container-fluid main-container">'):]
    order = Order(); order.feed(main_html)
    got = order.out
    assert got == expected, f'rendered order differs:\n got      {got}\n expected {expected}'

    style = io.open(os.path.join(HERE, 'annotate-wyklad.css'), encoding='utf-8').read()
    script = io.open(os.path.join(HERE, 'annotate-wyklad.js'), encoding='utf-8').read()
    script = script.replace('__BLOCKS__', json.dumps(data, ensure_ascii=False))
    page = knit.replace('</head>', '<style data-rmd-annotated>\n' + style + '</style>\n</head>', 1)
    page = page.replace('</body>', '<script>\n' + script + '</script>\n</body>', 1)
    io.open(OUT_PATH, 'w', encoding='utf-8', newline='\n').write(page)
    print('blocks:', len(data), ' rendered elements:', len(expected), ' hidden blocks:', sum(d['hidden'] for d in data),
          ' source lines covered:', sum(d['to'] - d['from'] + 1 for d in data), 'of', len([l for l in rmd]))


if __name__ == '__main__':
    main()

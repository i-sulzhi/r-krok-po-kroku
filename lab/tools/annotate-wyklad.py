"""Make lab/lab3-wyklad.html explain itself (D125).

Double-click any part of the knitted lecture (or press "Pokaż kod wszędzie") and the
lines of lab/lab3-wyklad.Rmd that made it open underneath, each group with a note, like
a Jupyter cell switching to its source.

  1. knit:  rmarkdown::render("lab3-wyklad.Rmd", output_file = "lab3-wyklad.knit.html",
                              output_dir = "tools")       (in lab/)
  2. run:   python lab/tools/annotate-wyklad.py [wyklad|wzor]
     reads  lab/lab3-<name>.Rmd and lab/tools/lab3-<name>.knit.html
     writes lab/lab3-<name>.html (served)

The same script annotates the example report lab3-wzor.Rmd (D130): `wzor` picks its
notes. A note entry may be {'tags': [...], 'notes': ...} to say what a chunk renders
to (a figure is a div), where the default guess would be wrong.

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

import sys

HERE = os.path.dirname(os.path.abspath(__file__))
LAB = os.path.dirname(HERE)
NAME = sys.argv[1] if len(sys.argv) > 1 else 'wyklad'
assert NAME in ('wyklad', 'wzor'), NAME
FILE = f'lab3-{NAME}.Rmd'
RMD_PATH = os.path.join(LAB, FILE)
KNIT_PATH = os.path.join(HERE, f'lab3-{NAME}.knit.html')
OUT_PATH = os.path.join(LAB, f'lab3-{NAME}.html')
C = lambda s: '<code>' + html.escape(s) + '</code>'

# ---------------------------------------------------------------- notes
# key: the start of the block's first line. value: list of (from, to, note) with line
# offsets inside the block (1 = its first line), or a single note for the whole block.
NOTES_WYKLAD = {
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
        (1, 1, f'Początek chunku. {C("r")} to język, a {C("setup")} to nazwa chunku, czyli jego etykieta. Nie tworzy żadnego obiektu R. Nazwę zobaczysz w komunikacie {C("Quitting from … [setup]")}, gdy w tym chunku coś pójdzie nie tak. {C("include = FALSE")} każe uruchomić kod i niczego nie pokazywać. Dlatego na stronie po tym chunku zostaje tylko ta szara belka.'),
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
    '- **Nagłówek**': f'Lista. Każdy punkt zaczyna się od myślnika, a linia z wcięciem należy dalej do tego samego punktu. Przed listą stoi pusta linia; bez niej punkty skleiłyby się z poprzednim zdaniem. Zapis {C("```` ```{r} ````")}, z czterema apostrofami z obu stron, pokazuje trzy apostrofy jako kod.',
    'Co dzieje się z każdą': f'Akapit z odnośnikiem do strony {C("lab3-anatomia.html")}, która pokazuje każdy etap Knit osobno.',
    '## 3.': 'Nagłówek części 3.',
    'Liczbę wstawia się do zdania': f'Podwójne apostrofy z odstępem, {C("`` ... ``")}, pozwalają pokazać apostrofy jako kod. W środku {C("knitr::inline_expr(\"nrow(net)\")")} zwraca sam tekst {C("`r nrow(net)`")}, więc czytelnik widzi składnię, a nie wynik. Na końcu zdania stoi już prawdziwy kod inline {C("`r nrow(net)`")}, który daje 1039.',
    'Kod inline powinien zwracać': f'Pierwszy kod inline wstawia średnią bez zaokrąglenia, celowo, żeby było widać 230.8642926. Potem znów pokazana jest składnia i prawdziwy wynik z {C("round()")}: 231.',
    '## 4.': 'Nagłówek części 4.',
    'Przycisk **Knit**': f'Zwykły akapit. Pogrubienie wskazuje nazwę przycisku, a nazwy plików stoją w apostrofach, więc wyglądają jak kod.',
    'Postęp budowania': 'Zwykły akapit bez znaczników.',
    'Każdy chunk ma w prawym': f'Akapit z pogrubieniem {C("**w konsoli**")}. Ostatnie zdanie prowadzi do następnej części.',
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
    '## 7.': 'Nagłówek części 7.',
    'Raport pisze się dla czytelnika': 'Zwykły akapit.',
    '| Ustawienie': [
        (1, 1, f'Wiersz nagłówka tabeli. Kolumny oddzielają kreski {C("|")}.'),
        (2, 2, 'Linia z myślnikami oddziela nagłówek od reszty. Bez niej pandoc nie rozpozna tabeli.'),
        (3, 6, 'Wiersze tabeli. Puste miejsce między dwiema kreskami to pusta komórka.'),
    ],
    '`echo = FALSE` chowa kod': f'Zwykły akapit; {C("`nrow(net)`")} i {C("`## [1] 1039`")} stoją w apostrofach, więc to tylko tekst czcionką kodu.',
    'Ten chunk ma `echo = FALSE`': 'Zwykły akapit, który zapowiada tabelę z chunku poniżej.',
    '```{r grupy': [
        (1, 1, f'Początek chunku. {C("grupy")} to nazwa chunku, czyli jego etykieta. Nie tworzy żadnego obiektu R; obiekt tworzy dopiero {C("<-")} niżej, tu {C("grupy")}. Nazwę zobaczysz w komunikacie {C("Quitting from … [grupy]")}, gdy w tym chunku coś pójdzie nie tak. {C("echo = FALSE")}: kod się wykona, ale czytelnik zobaczy tylko wynik, czyli tabelę.'),
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


NOTES_WZOR = {
    '---': [
        (1, 1, 'Trzy kreski otwierają nagłówek pliku.'),
        (2, 2, f'{C("title")}: tytuł raportu. Dobry tytuł to samo pytanie badawcze.'),
        (3, 3, f'{C("author")}: tu wpisujesz swoje imię i nazwisko.'),
        (4, 4, f'{C("date")}: data z kodu inline {C("`r Sys.Date()`")}, w cudzysłowie.'),
        (5, 5, f'{C("output: html_document")}: z pliku powstanie strona HTML.'),
        (6, 6, 'Trzy kreski zamykają nagłówek.'),
    ],
    '```{r setup': [
        (1, 1, f'{C("setup")} to nazwa chunku, czyli jego etykieta. Nie tworzy żadnego obiektu R. Nazwę zobaczysz w komunikacie {C("Quitting from … [setup]")}, gdy w tym chunku coś pójdzie nie tak. {C("include = FALSE")}: chunk wykonuje się, ale nic nie pokazuje. Na stronie stoi w jego miejscu tylko szara belka.'),
        (2, 4, 'Pakiety, których raport potrzebuje. Muszą stać tutaj, bo Knit nie widzi pakietów z konsoli.'),
        (5, 5, f'Wczytuje dane z pliku leżącego obok {C(".Rmd")}.'),
        (6, 6, f'Ustawienia całego raportu: od tej linii każdy chunk chowa kod ({C("echo = FALSE")}) i komunikaty pakietów ({C("message = FALSE")}). Dlatego niżej na stronie są tylko tabela i wykres, bez kodu.'),
        (7, 7, f'Ziarno losowania w jednym miejscu. Pod nim w laboratorium wpisujesz cztery ostatnie cyfry numeru indeksu; wszystkie {C("set.seed(ziarno)")} niżej biorą je stąd.'),
        (8, 8, 'Koniec chunku.'),
    ],
    '## Pytanie': 'Pierwsza część raportu. Nagłówek robią dwa krzyżyki i spacja.',
    'Czy z liczby lat nauki': 'Pytanie badawcze w jednym zdaniu: co przewidujesz, z czego i co sprawdzasz. Czytelnik od razu wie, na co odpowiada raport.',
    '## Dane': 'Druga część: skąd są dane i ile ich jest.',
    '```{r dane': {'tags': [], 'notes': [
        (1, 1, f'{C("dane")} to nazwa chunku, czyli jego etykieta. Nie tworzy żadnego obiektu R; obiekt tworzy dopiero {C("<-")} niżej, tu {C("net")}. Nazwę zobaczysz w komunikacie {C("Quitting from … [dane]")}, gdy w tym chunku coś pójdzie nie tak. Chunk nie ma własnych ustawień, ale {C("echo = FALSE")} z chunku setup i tak chowa kod. Nic nie wypisuje, więc na stronie zostaje po nim tylko belka.'),
        (2, 6, f'Tabela {C("net")} jak w pytaniu 1 laboratorium 2: runda 11, trzy kolumny, bez etykiet i bez braków. Każda linia tworzy coś strzałką albo przekazuje dalej potokiem; żadna nie wypisuje wyniku.'),
        (7, 7, 'Koniec chunku.'),
    ]},
    'Dane pochodzą z European': 'Akapit dla czytelnika: źródło, kogo pytano i ile osób zostało. Trzy liczby wstawia kod inline, więc po zmianie danych poprawią się same.',
    '## Metoda': 'Trzecia część: jak liczono.',
    '```{r model': {'tags': [], 'notes': [
        (1, 1, f'{C("model")} to nazwa chunku, czyli jego etykieta. Nie tworzy żadnego obiektu R; obiekt tworzy dopiero {C("<-")} niżej, tu {C("m_nauka")}. Nazwę zobaczysz w komunikacie {C("Quitting from … [model]")}, gdy w tym chunku coś pójdzie nie tak. Ten chunk też nic nie wypisuje: liczy i zapisuje wyniki pod nazwami.'),
        (2, 5, f'Losowy podział 80/20 jak w ćwiczeniu 43, z ziarnem z chunku setup. W laboratorium robi to {C("createDataPartition()")}.'),
        (6, 7, f'Dwa modele {C("lm()")}: z samymi latami nauki i z latami nauki oraz wiekiem.'),
        (8, 8, f'Mała funkcja na RMSE, typową pomyłkę w minutach na osobach testowych, jak w ćwiczeniu 44.'),
        (9, 11, f'Trzy pomyłki zapisane pod nazwami. Nie są wypisywane; tekst raportu wstawi je kodem inline, a tabela niżej zbierze je razem.'),
        (12, 12, 'Koniec chunku.'),
    ]},
    'Osoby podzieliłam losowo': 'Metoda słowami, tak żeby czytelnik mógł ją powtórzyć: jak podzielono osoby, jakie modele policzono i jak mierzono pomyłkę. Liczby osób wstawia kod inline. Ziarna tu nie ma: to cyfry indeksu, więc zostaje tylko w kodzie.',
    '## Wyniki': 'Czwarta część: tabela, wykres i krótki opis.',
    '```{r tabela': {'tags': ['table'], 'notes': [
        (1, 1, f'{C("tabela")} to nazwa chunku, czyli jego etykieta. Nie tworzy żadnego obiektu R; obiekt tworzy dopiero {C("<-")} niżej, tu {C("wyniki")}. Nazwę zobaczysz w komunikacie {C("Quitting from … [tabela]")}, gdy w tym chunku coś pójdzie nie tak. Kod chowają ustawienia z setup; wynik, czyli tabela, zostaje.'),
        (2, 5, f'Tabela R z nazwami modeli i ich pomyłkami. Pomyłki biorą się z obiektów policzonych w chunku {C("model")}.'),
        (6, 7, f'{C("knitr::kable()")} robi z niej tabelę na stronie: {C("digits = 0")} zaokrągla, {C("col.names")} daje polskie nagłówki kolumn, a {C("caption")} podpis nad tabelą.'),
        (8, 8, 'Koniec chunku.'),
    ]},
    '```{r wykres': {'tags': ['div'], 'notes': [
        (1, 1, f'{C("wykres")} to nazwa chunku, czyli jego etykieta. Nie tworzy żadnego obiektu R. Nazwę zobaczysz w komunikacie {C("Quitting from … [wykres]")}, gdy w tym chunku coś pójdzie nie tak. Od niej bierze się też nazwa pliku z obrazkiem, {C("wykres-1.png")}. {C("fig.cap")} to podpis pod wykresem.'),
        (2, 5, f'Wykres jak w ćwiczeniu 42: kropki to osoby, linia to model z samymi latami nauki. {C("alpha")} robi kropki półprzezroczyste, {C("se = FALSE")} wyłącza szary pas, {C("labs()")} daje polskie nazwy osi.'),
        (6, 6, 'Koniec chunku.'),
    ]},
    'Linia rośnie': 'Pod wykresem jedno, dwa zdania, co z niego widać. Nachylenie wstawia kod inline; zdanie mówi też, czego wykres nie obiecuje.',
    '## Wnioski': 'Piąta część: wnioski.',
    'Wybieram model z latami': f'Trzy zdania, jak wymaga laboratorium: który model i dlaczego, o ile się myli i jak to sprawdzono, czego nie potrafi. Wszystkie liczby wstawia kod inline. Po liczbach, które zmieniają się z ziarnem, stoi skrót {C("min")}: tak nie trzeba dobierać końcówki (minuta, minuty, minut).',
}
NOTES = NOTES_WZOR if NAME == 'wzor' else NOTES_WYKLAD

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
        return ['div#header', 'div#TOC'] if 'toc: true' in text else ['div#header']
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
        override = None
        if isinstance(note, dict):
            override, note = note['tags'], note['notes']
        groups = [(a, b, note)] if isinstance(note, str) else [(a + f - 1, a + t - 1, x) for f, t, x in note]
        covered = sorted(l for f, t, _ in groups for l in range(f, t + 1))
        assert covered == list(range(a, b + 1)), f'notes of block at line {a} do not cover lines {a}-{b} exactly: {covered}'
        tags = override if override is not None else rendered_tag(kind, text)
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
    script = script.replace('__BLOCKS__', json.dumps(data, ensure_ascii=False)).replace('__FILE__', FILE)
    page = knit.replace('</head>', '<style data-rmd-annotated>\n' + style + '</style>\n</head>', 1)
    page = page.replace('</body>', '<script>\n' + script + '</script>\n</body>', 1)
    io.open(OUT_PATH, 'w', encoding='utf-8', newline='\n').write(page)
    print('blocks:', len(data), ' rendered elements:', len(expected), ' hidden blocks:', sum(d['hidden'] for d in data),
          ' source lines covered:', sum(d['to'] - d['from'] + 1 for d in data), 'of', len([l for l in rmd]))


if __name__ == '__main__':
    main()

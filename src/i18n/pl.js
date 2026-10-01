/**
 * Polish dictionary -- the course language (syllabus: "języki wykładowe: polski").
 *
 * These are the sentences a student reads at eleven at night with nobody to ask, so
 * they follow three rules:
 *   - say what R refused to do, then what to do instead
 *   - never blame the reader ("nie można" rather than "źle napisałeś")
 *   - keep R's own vocabulary in code font words (NA, TRUE, factor) so the student
 *     recognises them in RStudio, but explain them in Polish on first contact
 *
 * Placeholders: {name} substitutes a value; {n|forma1|forma2|forma3} also selects a
 * Polish plural form (1 / 2-4 / 5+), matching Russian's structure.
 */

export const pl = {
  // --- Engine errors: what R refused to do, phrased as guidance ---
  'err.afterDollar': 'Po {op} oczekiwana jest nazwa elementu',
  'err.applyNeedsFn': '{fname}() oczekuje funkcji jako drugiego argumentu',
  'err.assign2dOnlyDf': 'Przypisanie w postaci x[wiersze, kolumny] <- ... działa na razie tylko dla ramek danych',
  'err.assignEmpty': 'Po prawej stronie <- nie ma żadnej wartości, więc nie ma czego przypisać',
  'err.assignNull': 'Po prawej stronie <- jest NULL. Tego nie można wpisać do wektora',
  'err.assignSimpleOnly': 'Do zwykłego wektora można wpisywać tylko proste wartości (liczby, tekst, TRUE/FALSE)',
  'err.assignTargetName': 'Po lewej stronie <- musi stać nazwa zmiennej albo jej fragment',
  'err.assignTargetShape': 'Po lewej stronie <- może stać tylko nazwa, element albo funkcja typu names(x)',
  'err.atUnsupported': 'Operator @ (sloty S4) nie jest obsługiwany przez trenażer',
  'err.backtickUnclosed': 'Niezamknięty apostrof wsteczny (`)',
  'err.badChar': 'Nierozpoznany znak: {char}',
  'err.badNumber': 'Nie udało się odczytać liczby: {text}',
  'err.badRegex': 'Nie udało się zinterpretować wyrażenia regularnego «{pattern}»: {detail}',
  'err.cannotStart': 'W tym miejscu wyrażenie nie może się zaczynać: {got}',
  'err.catList': 'cat() nie potrafi wypisać listy. Użyj print()',
  'err.cmpBadKind': 'Nie można porównywać wartości typu «{kind}»',
  'err.coerceKind': 'Nie można przekształcić {kind} na typ {to}',
  'err.condEmpty': 'Warunek jest pusty: if potrzebuje wartości TRUE albo FALSE',
  'err.condLength': 'Warunek zawiera {n|wartość|wartości|wartości}, a potrzebna jest dokładnie jedna. Być może chodziło o any(), all() albo ifelse()',
  'err.condNA': 'Warunek wynosi NA. Nie wiadomo, czy jest prawdziwy, czy fałszywy',
  'err.condNotLogical': 'Warunek musi być wartością TRUE albo FALSE',
  'err.dfColumnLength': 'Kolumna «{name}» o długości {length} nie mieści się w tabeli o {rows|wierszu|wierszach|wierszach}',
  'err.dfSet2dLater': 'Zmiana tabeli przez df[wiersze, kolumny] <- ... pojawi się w lekcji o ramkach danych',
  'err.dollarOnVector': 'Znak $ nie działa na zwykłych wektorach. Służy do list i ramek danych (data.frame); dla wektora użyj [ ] albo nazwy w cudzysłowie',
  'err.dollarOnVectorShort': 'Znak $ nie działa na zwykłych wektorach. Służy do list i ramek danych',
  'err.dotsOutside': 'Symbolu ... można używać tylko wewnątrz funkcji',
  'err.doubleNeedsIndex': 'W [[ ]] potrzebny jest indeks',
  'err.doubleNegative': 'W podwójnych nawiasach [[ ]] nie można używać indeksu ujemnego',
  'err.doubleOneIndex': 'W podwójnych nawiasach [[ ]] musi być dokładnie jeden indeks',
  'err.expected': 'Oczekiwano: {what}, a napotkano {got}',
  'err.extractNull': 'Nie można wyjąć elementu z NULL',
  'err.fnNotFound': 'Nie znaleziono funkcji «{name}». Sprawdź pisownię, bo w R wielkość liter ma znaczenie',
  'err.forNeedsIn': 'W pętli for potrzebne jest słowo in, na przykład: for (i in 1:5)',
  'err.formulaUnsupported': 'Formuły (y ~ x) nie są na razie obsługiwane przez trenażer',
  'err.index2dNeedsDf': 'Indeksowanie [wiersze, kolumny] działa na ramkach danych (data.frame)',
  'err.index2dOnlyDf': 'Indeksowanie przecinkiem [wiersze, kolumny] jest na razie dostępne tylko dla ramek danych',
  'err.indexNA': 'Indeks wynosi NA, więc nie wiadomo, o który element chodzi',
  'err.indexOutOfRange': 'Element nr {index} nie istnieje: obiekt ma długość {length}',
  'err.internalNode': 'Błąd wewnętrzny: nieznany węzeł {type}',
  'err.isNA': '{what} wynosi NA',
  'err.keywordUnexpected': 'Słowo kluczowe {kw} nie jest tu oczekiwane',
  'err.mixedSigns': 'W jednym nawiasie nie można mieszać indeksów dodatnich i ujemnych',
  'err.modifyMissing': 'Obiekt «{name}» jeszcze nie istnieje, więc nie można zmienić jego fragmentu. Najpierw utwórz go w całości, na przykład: {name} <- c()',
  'err.needNumber': '{what} musi być liczbą',
  'err.noElementNamed': 'Obiekt nie ma elementu o nazwie «{name}»',
  'err.noReplacementFn': 'Nie można przypisać do wyniku funkcji {fname}(). Po lewej stronie <- dozwolone są tylko nazwa zmiennej, jej element albo names()/class()/levels()/dim()/length()',
  'err.noSuchArg': 'Funkcja {fnName} nie przyjmuje argumentu «{name}»',
  'err.notFunction': 'To nie jest funkcja, więc nie można jej wywołać',
  'err.notSubsettable': 'Tego obiektu nie można indeksować nawiasami kwadratowymi',
  'err.objNotFound': 'Nie znaleziono obiektu «{name}». Być może zmienna nie została jeszcze utworzona albo jej nazwa jest zapisana inaczej',
  'err.opBadKind': 'Do argumentu typu «{kind}» nie można zastosować {op}',
  'err.opCannotStart': 'Operator {op} nie może rozpoczynać wyrażenia',
  'err.opOnFactor': 'Operator {op} nie działa na czynniku (factor): kategorie nie mają arytmetyki. Czynnik liczbowy zamienia się tak: as.numeric(as.character(f))',
  'err.opOnFactorScale': 'Operator {op} nie działa na czynniku (factor): kategorie nie mają arytmetyki. Numery poziomów daje as.numeric(f)',
  'err.opOnText': 'Operator {op} nie działa na tekście. Jeśli to liczby w cudzysłowie, najpierw je przekształć: as.numeric(x)',
  'err.opUnsupported': 'Operator {op} nie jest na razie obsługiwany przez trenażer',
  'err.partialAmbiguous': 'Skrócona nazwa argumentu «{name}» pasuje do kilku naraz: {candidates}',
  'err.percentUnclosed': 'Niezamknięty operator %...%',
  'err.pipeNeedsCall': 'Po prawej stronie |> musi stać wywołanie funkcji, na przykład x |> mean()',
  'err.repTimesLength': 'Długość times musi być zgodna z długością wektora',
  'err.replacementNeedsObject': '{fname}() oczekuje obiektu w nawiasie',
  'err.seqEmpty': 'Taka sekwencja jest pusta: sprawdź from, to i by',
  'err.seqZeroStep': 'Krok by nie może wynosić zero',
  'err.signalOutside': 'Polecenie break/next/return użyte poza pętlą lub funkcją',
  'err.statNeedsNumbers': '{fname}() oczekuje liczb',
  'err.statOnFactor': '{fname}() nie działa na czynniku (factor): kategorie nie mają średniej. Jeśli to naprawdę liczby: as.numeric(as.character(f))',
  'err.statOnFactorScale': '{fname}() nie działa na czynniku (factor): kategorie nie mają średniej. Numery poziomów daje as.numeric(f)',
  'err.factorLabels': 'Liczba etykiet (labels: {nlab}) nie zgadza się z liczbą poziomów ({nlev}). Każdy poziom potrzebuje dokładnie jednej etykiety',
  'err.statOnText': '{fname}() nie działa na tekście. Najpierw przekształć na liczby: as.numeric(x)',
  'err.stepBudget': 'Obliczenie trwa zbyt długo. Możliwe, że pętla nigdy się nie zakończy',
  'err.strUnclosed': 'Niezamknięty tekst',
  'err.strUnclosedQuote': 'Niezamknięty tekst: brakuje cudzysłowu zamykającego',
  'err.tooManyArgs': 'Funkcji {fnName} przekazano za dużo argumentów',
  'err.trailing': 'Nadmiarowy fragment po wyrażeniu: {got}',
  'err.unknownCompare': 'Nieznane porównanie {op}',
  'err.unknownOp': 'Nieznany operator {op}',
  'err.unknownVectorMode': 'Nieznany typ wektora: {mode}',
  'err.unsupportedFn': '{name}() nie jest obsługiwana przez trenażer. {why}',
  'err.userStop': '{msg}',
  'err.userStopBare': 'Wykonanie przerwane wywołaniem stop()',

  // --- Warnings ---
  'warn.assignPartial': 'Liczba elementów po prawej stronie ({src}) nie dzieli bez reszty liczby zmienianych pozycji ({slots})',

  // --- Deliberately unsupported functions: honest about the trainer's limits ---
  'unsup.fs': 'System plików nie jest dostępny w trenażerze',
  'unsup.ggplot': 'ggplot2 nie wchodzi w skład trenażera. Tutaj rozbieramy to, co leży pod nim',
  'unsup.install': 'Instalowanie pakietów nie jest w trenażerze potrzebne',
  'unsup.packages': 'Nie trzeba dołączać pakietów: wszystko, co jest w trenażerze, jest już dostępne',
  'unsup.plot': 'Wykresy powstają w RStudio: trenażer pokazuje, co dzieje się z danymi przed wykresem',
  'unsup.readFile': 'Wczytywanie plików pojawi się w lekcji o danych. Na razie dane wpisujemy wprost w kodzie',

  // --- Parser vocabulary: names of tokens, used inside "expected X" messages ---
  'tok.argName': 'nazwa argumentu',
  'tok.colonLeft': 'lewa strona :',
  'tok.colonRight': 'prawa strona :',
  'tok.eof': 'koniec kodu',
  'tok.loopVar': 'nazwa zmiennej pętli',
  'tok.lparen': 'nawias otwierający (',
  'tok.newline': 'znak nowej linii',
  'tok.rbrace': 'nawias klamrowy zamykający }',
  'tok.rbracket': 'nawias kwadratowy zamykający ]',
  'tok.rbracket2': 'podwójny nawias zamykający ]]',
  'tok.rparen': 'nawias zamykający )',
  'tok.rparenCall': 'nawias zamykający ) w wywołaniu funkcji',
  'tok.rparenParams': 'nawias zamykający ) na liście argumentów',

  // --- Environment names ---
  'env.base': 'funkcje bazowe R',
  'env.check': 'sprawdzenie',
  'env.global': 'środowisko globalne',
  'env.local': 'środowisko lokalne',

  // --- Value descriptions ---
  'val.function': 'funkcja',

  // --- Interface chrome ---
  'ui.errorPrefix': 'Błąd',
  'ui.warningPrefix': 'Ostrzeżenie',

  // --- tidyverse verbs ---
  'err.internal': 'Trenażer nie umiał tego wykonać. To jego błąd, nie twój. Spróbuj zapisać to inaczej.',
  'err.verbNeedsTable': '{fname}() działa na tabeli (data.frame). Przekaż tabelę jako pierwszy argument',
  'err.noSuchColumn': 'W tabeli nie ma kolumny «{name}». Dostępne: {available}',
  'err.filterLength': 'Warunek dał {length|wartość|wartości|wartości}, a tabela ma {rows|wiersz|wiersze|wierszy}. Filtr nie wie, co zrobić',
  'err.mutateNeedsName': 'W mutate() każda nowa kolumna potrzebuje nazwy: mutate(df, nowa = stara * 2)',
  'err.mutateEmpty': 'Kolumna «{name}» wyszła pusta, więc nie ma czego zapisać',
  'err.mutateLength': 'Kolumna «{name}» daje {length|wartość|wartości|wartości}, a tabela ma {rows|wiersz|wiersze|wierszy}. Powtórzenie w kółko nie wyjdzie: {rows} nie dzieli się przez {length} bez reszty',
  'err.selectShape': 'W select() podaje się nazwy kolumn: select(df, a, b) albo select(df, -c)',
  'err.renameShape': 'W rename() pisze się nowa = stara: rename(df, wiek = age)',
  'err.summariseOneValue': '«{name}» zwrócił {length|wartość|wartości|wartości}, a summarise() oczekuje dokładnie jednej na grupę. Wygląda na to, że potrzebna jest funkcja podsumowująca: mean(), sum(), n()',
  'err.nOutsideVerb': 'n() działa tylko wewnątrz summarise(), mutate() albo count()',
  'err.descOutsideArrange': 'desc() używa się tylko wewnątrz arrange(): arrange(df, desc(wiek))',
  'err.useDataFrame': 'tibble() nie ma w trenażerze. Użyj data.frame(), działa tak samo',
  'env.dataMask': 'kolumny tabeli',
  'err.tooDeep': 'Zbyt głębokie zagnieżdżenie wywołań ({depth}). Wygląda na to, że funkcja {fnName}() wywołuje samą siebie i się nie zatrzymuje. Sprawdź warunek zakończenia',
};

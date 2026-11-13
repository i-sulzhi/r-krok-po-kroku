# Laboratorium 2 w RStudio: ile czasu w sieci? Model, który przewiduje
# Imię i nazwisko:
# Zapisz ten plik jako lab2_Nazwisko.R i oddaj go w Moodle.
#
# Pod każdym pytaniem wpisz kod, a pod kodem jedno zdanie odpowiedzi w komentarzu.
# Pytania 1-6 na zajęciach, 7-10 w domu. Treść pytań:
# https://i-sulzhi.github.io/r-krok-po-kroku/lab/lab2.html

# Dane: Adapted from ESS Rounds 1-11 (European Social Survey ERIC), licencja CC BY-NC-SA 4.0.
# Plik ess_polska.sav to tylko Polska i 18 z 2747 zmiennych; wartości bez zmian.
# Pełne dane są bezpłatne na https://ess.sikt.no. Kurs nie jest związany z ESS ERIC.

# Jeśli pakiet nie jest zainstalowany, uruchom raz w konsoli:
# install.packages(c("tidyverse", "haven", "caret"))
library(haven)
library(dplyr)
library(caret)

ess <- read_sav("ess_polska.sav")


# ---- Pytanie 1. Dane ------------------------------------------------------------


# Odpowiedź:


# ---- Pytanie 2. Podział na uczące i testowe --------------------------------------


# Odpowiedź:


# ---- Pytanie 3. Prosta ze sprawdzianem krzyżowym --------------------------------


# Odpowiedź:


# ---- Pytanie 4. Prognoza dla testowych -------------------------------------------


# Odpowiedź:


# ---- Pytanie 5. Bez modelu -------------------------------------------------------


# Odpowiedź:


# ---- Pytanie 6. Krzywa -----------------------------------------------------------


# Odpowiedź:


# ---- Pytanie 7. Inna metoda (w domu) ---------------------------------------------


# Odpowiedź:


# ---- Pytanie 8. Więcej zmiennych (w domu) ----------------------------------------


# Odpowiedź:


# ---- Pytanie 9. Tak albo nie (w domu) --------------------------------------------


# Odpowiedź:


# ---- Pytanie 10. Prognoza i trzy zdania do raportu (w domu) ----------------------


# Odpowiedź:

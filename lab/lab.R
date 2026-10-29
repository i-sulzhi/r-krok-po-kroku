# Laboratorium 1 w RStudio: czy Polacy ufają Sejmowi?
# Imię i nazwisko:
# Zapisz ten plik jako lab_Nazwisko.R i oddaj go w Moodle.
#
# Pod każdym pytaniem wpisz kod, a pod kodem jedno zdanie odpowiedzi w komentarzu.
# Pytania 1-7 na zajęciach, 8-10 w domu. Treść pytań:
# https://i-sulzhi.github.io/r-krok-po-kroku/lab/

# Dane: Adapted from ESS Rounds 1-11 (European Social Survey ERIC), licencja CC BY-NC-SA 4.0.
# Plik ess_polska.sav to tylko Polska i 18 z 2747 zmiennych; wartości bez zmian.
# Pełne dane są bezpłatne na https://ess.sikt.no. Kurs nie jest związany z ESS ERIC.

# Jeśli pakiet nie jest zainstalowany, uruchom raz w konsoli:
# install.packages(c("tidyverse", "haven"))
library(haven)
library(dplyr)
library(tidyr)
library(ggplot2)

ess <- read_sav("ess_polska.sav")


# ---- Pytanie 1. Ile osób zbadano? ------------------------------------------------


# Odpowiedź:


# ---- Pytanie 2. Ile kobiet i mężczyzn? -------------------------------------------


# Odpowiedź:


# ---- Pytanie 3. Jak bardzo Polacy ufają Sejmowi? ---------------------------------


# Odpowiedź:


# ---- Pytanie 4. Czy kobiety i mężczyźni inaczej ufają policji? -------------------


# Odpowiedź:


# ---- Pytanie 5. Kto ufa Sejmowi? -------------------------------------------------


# Odpowiedź:


# ---- Pytanie 6. Zadowolenie z życia: wiek i płeć ---------------------------------


# Odpowiedź:


# ---- Pytanie 7. Której instytucji ufamy najbardziej? -----------------------------


# Odpowiedź:


# ---- Pytanie 8. Zaufanie do Sejmu w województwach: 2018 i 2023 (w domu) ----------


# Odpowiedź:


# ---- Pytanie 9. Wiek a internet (w domu) -----------------------------------------


# Odpowiedź:


# ---- Pytanie 10. Zaufanie do Sejmu od 2002 do 2023 roku (w domu) -----------------


# Odpowiedź:


# ---- Dla chętnych: wagi ----------------------------------------------------------


# Odpowiedź:

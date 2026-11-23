# Laboratorium 4: pobiera stenogram Sejmu z 20 grudnia 2023 (139 małych stron).
# Uruchom RAZ, w folderze z plikiem lab4_Nazwisko.Rmd. Trwa około 4 minut, bo między
# stronami czeka sekundę, żeby nie obciążać serwera. Gdy się przerwie, uruchom ponownie:
# pobierze tylko to, czego jeszcze nie ma.

adres <- "https://api.sejm.gov.pl/sejm/term10/proceedings/1/2023-12-20/transcripts/"
dir.create("sejm", showWarnings = FALSE)

for (nr in 0:138) {
  plik <- file.path("sejm", sprintf("%03d.html", nr))
  if (file.exists(plik)) next
  roboczy <- paste0(plik, ".tmp")
  download.file(paste0(adres, nr), roboczy, mode = "wb", quiet = TRUE)
  file.rename(roboczy, plik)
  Sys.sleep(1)
}

cat("Gotowe. W folderze sejm jest", length(list.files("sejm", pattern = "html$")), "stron.\n")

# Run each snippet in a clean R session and capture exactly what the console shows.
args <- commandArgs(trailingOnly = TRUE)
lines <- readLines(args[1])
for (ln in lines) {
  # A case may narrow the console (see diff-eval.mjs); the next one starts at 80.
  options(width = 80)
  con <- textConnection(ln)
  # Warnings are muffled rather than caught: a warning must not hide the value,
  # since our engine prints the value too.
  out <- tryCatch(
    capture.output(withCallingHandlers(
      source(con, echo = FALSE, print.eval = TRUE, local = new.env()),
      warning = function(w) invokeRestart("muffleWarning")
    )),
    error = function(e) paste0("Ошибка: ", conditionMessage(e))
  )
  close(con)
  cat("<<<CASE>>>\n")
  cat(out, sep = "\n")
  if (length(out)) cat("\n")
}

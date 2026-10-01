# Print R's own parse tree as an s-expression, for differential testing.
to_sexpr <- function(e) {
  if (is.call(e)) {
    parts <- as.list(e)
    head <- parts[[1]]
    rest <- parts[-1]
    nms <- names(parts); if (is.null(nms)) nms <- rep("", length(parts))
    argnames <- nms[-1]
    fmt <- function(i) {
      x <- rest[[i]]
      s <- if (missing(x) || (is.symbol(x) && !nzchar(as.character(x)))) "<empty>" else to_sexpr(x)
      if (nzchar(argnames[i])) paste0(argnames[i], "=", s) else s
    }
    body_parts <- if (length(rest)) vapply(seq_along(rest), fmt, "") else character(0)
    hs <- as.character(head)
    if (hs == "(") return(paste0("(paren ", body_parts[1], ")"))
    if (hs == "{") return(paste0("(block ", paste(body_parts, collapse=" "), ")"))
    if (hs %in% c("[", "[[")) return(paste0("(", hs, " ", paste(body_parts, collapse=" "), ")"))
    if (hs == "<-" || hs == "=") return(paste0("(<- ", paste(body_parts, collapse=" "), ")"))
    if (hs == "<<-") return(paste0("(<<- ", paste(body_parts, collapse=" "), ")"))
    if (hs == "if") return(paste0("(if ", paste(body_parts, collapse=" "), ")"))
    if (hs == "for") return(paste0("(for ", paste(body_parts, collapse=" "), ")"))
    if (hs == "while") return(paste0("(while ", paste(body_parts, collapse=" "), ")"))
    if (hs == "repeat") return(paste0("(repeat ", paste(body_parts, collapse=" "), ")"))
    if (hs == "~") return(paste0("(~ ", paste(body_parts, collapse=" "), ")"))
    if (hs == "$" || hs == "@") return(paste0("(", hs, " ", paste(body_parts, collapse=" "), ")"))
    # unary vs binary operators
    ops <- c("+","-","*","/","^",":","<",">","<=",">=","==","!=","&","&&","|","||","!")
    if (hs %in% ops || grepl("^%.*%$", hs)) {
      if (length(rest) == 1) return(paste0("(u", hs, " ", body_parts[1], ")"))
      return(paste0("(", hs, " ", paste(body_parts, collapse=" "), ")"))
    }
    if (hs == "function") {
      formals_list <- rest[[1]]
      ps <- character(0)
      if (length(formals_list)) {
        fn <- names(formals_list)
        ps <- vapply(seq_along(formals_list), function(i) {
          d <- formals_list[[i]]
          if (missing(d) || (is.symbol(d) && !nzchar(as.character(d)))) fn[i]
          else paste0(fn[i], "=", to_sexpr(d))
        }, "")
      }
      return(paste0("(function (", paste(ps, collapse=" "), ") ", to_sexpr(rest[[2]]), ")"))
    }
    return(paste0("(call ", to_sexpr(head), if (length(body_parts)) paste0(" ", paste(body_parts, collapse=" ")) else "", ")"))
  }
  if (is.symbol(e)) { s <- as.character(e); return(if (nzchar(s)) s else "<empty>") }
  if (is.character(e)) return(paste0('"', e, '"'))
  if (is.logical(e) && is.na(e)) return("NA")
  if (is.logical(e)) return(if (e) "TRUE" else "FALSE")
  if (is.null(e)) return("NULL")
  if (is.integer(e)) return(paste0(format(e), "L"))
  if (is.numeric(e)) return(format(e))
  deparse(e)
}
args <- commandArgs(trailingOnly = TRUE)
lines <- readLines(args[1])
for (ln in lines) {
  out <- tryCatch(to_sexpr(str2lang(ln)), error = function(e) paste0("<<ERROR>> ", conditionMessage(e)))
  cat(out, "\n", sep="")
}

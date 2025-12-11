# Copyright (C) 2025 The University of Texas MD Anderson Cancer Center
#
# This file is part of xPEDITE.
#
# xPEDITE is free software: you can redistribute it and/or modify it under the terms of the
# GNU General Public License Version 2 as published by the Free Software Foundation.
#
# xPEDITE is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
# without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
# See the GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License along with xPEDITE.
# If not, see <https://www.gnu.org/licenses/>.

library(futile.logger)

##
## Functions for basic logging via the futile.logger R package
##

#' Initialize logging
#' 
#' @param log_level One of 'TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'
#' @param log_file Desired path/name of log file
initLogging <- function(log_level,log_file=NULL) {
  flog.threshold(log_level)
  if (log_level == 'INFO' ) {
    layout <- layout.format('[~l] ~m')
  } else {
    layout <- layout.format('[~l] [~t] ~m')
  }
  flog.layout(layout)
  if (!is.null(log_file)) {
    flog.appender(appender.file(log_file))
    log_info('Writing log to file: ',log_file)
  } else {
    flog.appender(appender.console())
  }
  log_debug(paste('Set log level to ',log_level))
}


##
## Define log functions so that the main R code does NOT
## NOT have to make changes if we swap out logging packages
##
log_trace <- function(message, variable) {
  if (missing(variable)) {
    flog.trace(paste(getCaller(), message))
   } else {
    flog.trace(paste(getCaller(), message, variable))
   }
}

log_debug <- function(message, variable) {
  if (missing(variable)) {
    flog.debug(paste(getCaller(), message))
   } else {
    flog.debug(paste(getCaller(), message, variable))
   }
}

log_info <- function(message, variable) {
  if (missing(variable)) {
    flog.info(message)
   } else {
    flog.info(paste(message, variable))
   }
}

log_warn <- function(message, variable) {
  if (missing(variable)) {
    flog.warn(message)
   } else {
    flog.warn(paste(message, variable))
   }
}

log_error <- function(message, variable) {
  if (missing(variable)) {
    flog.error(message)
   } else {
    flog.error(paste(message, variable))
   }
}

log_get_current_level <- function() {
  return (flog.threshold())
}

#' Logs trace-level information about a dataframe: dimensions, first 5 row names, first 5 col names, head
#'
#' @param df dataframe to log
#' @param print_whole_dataframe If TRUE, prints the whole dataframe, otherwise just the head. Default is TRUE.
log_trace_dataframe <- function(df, print_whole_dataframe=TRUE) {
  dfName <- deparse(substitute(df))
  if (print_whole_dataframe) {
    flog.trace(paste0(getCaller(), "Dataframe: ", dfName), df, capture=TRUE)
  } else {
    n_cols_to_print <- if (ncol(df) > 4) 4 else ncol(df)
    flog.trace(paste0(getCaller(), "Dataframe: ", dfName, " (head: 6 rows, ", n_cols_to_print, " cols)"), head(df[0:n_cols_to_print]), capture=TRUE)
  }
  if (length(colnames(df)[duplicated(colnames(df))]) > 0) {
    log_warn(paste('There are duplicated colnames in ',dfName,': ',paste(colnames(df)[duplicated(colnames(df))],collapse=',')))
  }
}

#' Logs trace-level information about a list: first 5 elements, length
#' 
#' @param df dataframe to log
#' @param print_whole_list If TRUE, prints the whole list, otherwise just the head. Default is TRUE.
log_list <- function(l, print_whole_list=TRUE) {
  lName <- deparse(substitute(l))
  if (print_whole_list) {
    log_trace(paste(lName, ": ", paste(l,collapse=", "), sep=""))
  } else {
    n_elements_to_print <- if (length(l) > 4) 4 else length(l)
    log_trace(paste(lName, ": ", paste(l[1:n_elements_to_print],collapse=", "), " ...", sep=""))
  }
  log_trace(paste("  Length of", lName, ":", length(l), sep=" "))
}

#'
#' Attempt to return useful name of calling function
#'
#' Because of the interface we've constructed to the logging package, futile.logger's
#' built in  '~f' for adding the calling function to the log format doesn't work as well
#' as we'd like. So there is some gymnatics here to attempt to get more useful information.
#'
getCaller <- function() {
  tryCatch({
    if (sys.nframe() > 7) {
     callingFunction <- paste('[',substr(deparse(sys.calls()[[sys.nframe()-7]]),1,20),'...]', sep="")
    } else {
      callingFunction <- "[]"
    }
    if (startsWith(callingFunction, '[log_trace_dataframe') || startsWith(callingFunction, '[log_list')) {
      callingFunction <- paste('[',substr(deparse(sys.calls()[[sys.nframe()-8]]),1,20),'...]', sep="")
    }
    if (startsWith(callingFunction, '[doTryCatch') && sys.nframe() > 11) {
      callingFunction <- paste('[',substr(deparse(sys.calls()[[sys.nframe()-11]]),1,20),'...]', sep="")
    } else if (startsWith(callingFunction, '[doTryCatch')) {
      callingFunction <- paste('[',substr(deparse(sys.calls()[[sys.nframe()-10]]),1,20),'...]', sep="")
    }
  },
  error = function(cond) { # sometimes errors happen that I haven't taken the time to troubleshoot
    callingFunction <- "UNKNOWN"
  })
  return (callingFunction)
}


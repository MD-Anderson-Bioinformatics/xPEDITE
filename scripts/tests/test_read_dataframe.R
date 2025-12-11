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

library(testthat)
source("../process_util_script.R")
source("../futileLogging.R")

initLogging("DEBUG")

test_that("Validates read_input_file(file_path)", {
  ## For all three file types, test valid file is read OK, and that a file missing
  ## a value returns the expected error message
  for (ft in c("csv", "tsv", "xlsx")) {
    data_file <- file.path("testfiles", paste0("valid.", ft)) # valid file
    log_debug("Checking datafile: ", data_file)
    df <- read_input_file(data_file)
    expect_equal(df[2,"ID"], "210923_SQWAT_AA_2")
    data_file <- file.path("testfiles", paste0("missing_entry.", ft)) # file missing an entry
    log_debug("Checking datafile: ", data_file)
    err <- expect_error(read_input_file(data_file))
    expect_equal(err$message, paste0("Missing values in file '", basename(data_file),
       "'. Please verify input data and try again"))
   }
   ## For .csv and .tsv files, test that file
   ##  - with extra blank entries in some rows returns an error (extra_column_entry.csv/.tsv)
   ##  - with extra blank rows are removed (ghost_rows.csv/.tsv)
   ##  - with extra blank columns are removed (ghost_columns.csv/.tsv)
   ## For Excel files, the extra column or row is omitted by read_excel, so no need to test.
  for (ft in c("csv", "tsv")) {
    data_file <- file.path("testfiles", paste0("extra_column_entry.", ft)) # file with estra column in one row
    log_debug("Checking datafile: ", data_file)
    err <- expect_error(read_input_file(data_file))
    expect_equal(err$message, "more columns than column names")
    data_file <- file.path("testfiles", paste0("ghost_rows.", ft)) # file with empty row at the bottom
    log_debug("Checking datafile: ", data_file)
    df <- read_input_file(data_file)
    expect_equal(df[4,"DNA"], 0.42)
    ## make sure blank rows have been removed
    n_blank_rows <- sum(apply(df, 1, function(x) all(is.na(x))))
    expect_equal(n_blank_rows, 0)
    data_file <- file.path("testfiles", paste0("ghost_columns.", ft)) # file with empty column at the end
    log_debug("Checking datafile: ", data_file)
    df <- read_input_file(data_file)
    expect_equal(df[4,"DNA"], 0.42)
    ## make sure blank columns have been removed
    n_blank_cols <- sum(apply(df, 2, function(x) all(is.na(x))))
    expect_equal(n_blank_cols, 0)
  }
})


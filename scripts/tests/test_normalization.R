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

test_that("Validates zscore_normalization(df)", {
  df <- data.frame(matrix(sample(12), nrow=3))  ## test matrix
  calculated <- zscore_normalization(df)
  ## calculate z-normed matrix manually for comparison, with some sanity checks on the way
  row_means <- rowMeans(df)
  expect_equal(row_means[1], sum(df[1,])/4) ## sanity check
  row_sds <- apply(df, 1, sd)
  std_row_1 = sqrt(sum((df[1,] - row_means[1])^2) / 3) ## manually calculated std of row 1 for sanity check
  expect_equal(row_sds[1], std_row_1) ## sanity check
  df_centered <- df - row_means
  df_znormed <- df_centered / row_sds
  ## the real test of the zscore_normalization function:
  expect_equal(calculated, df_znormed)
})


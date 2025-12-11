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

test_that("Validates verify_sample_id_agreement(samples_df, data_df)",{
  ## Test example where sample IDs match
  samples_df <- data.frame(  ## mock of dataframe from 'pdata.csv'
    ID = c("sample1", "sample2", "sample3", "sample4"),
    Group = c("Group1", "Group1", "Group2", "Group2")
  )
  data_df <- data.frame(  ## mock of dataframe from analyzed data file
     sample1 = c(2.3, 1.1, 4.5),
     sample2 = c(6.7, 2.5, 9.0),
     sample3 = c(7.8, 4.6, 8.8),
     sample4 = c(4.5, 4.3, 4.4),
     row.names = c("compound1", "compound2", "compound3")
  )
  expect_equal(verify_sample_id_agreement(samples_df, data_df), TRUE)

  ## Test example where extra samples in analyzed data
  samples_df_missing <- data.frame(  ## mock of dataframe from 'pdata.csv', but missing an ID entry
    ID = c("sample1", "sample2", "sample4"),
    Group = c("Group1", "Group1", "Group2")
  )
  err <- expect_error(verify_sample_id_agreement(samples_df_missing, data_df))
  expect_equal(err$message, "Extra samples in analyzed data file: sample3")

  ## Test example where extra samples in sample dataframe
  data_df_missing <- data.frame( ## mock of dataframe from analyzed data file, but missing two samples
     sample1 = c(2.3, 1.1, 4.5),
     sample3 = c(7.8, 4.6, 8.8),
     row.names = c("compound1", "compound2", "compound3")
  )
  err <- expect_error(verify_sample_id_agreement(samples_df, data_df_missing))
  expect_equal(err$message, "Extra samples in sample file: sample2, sample4")
})


#!/bin/bash

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
# If not, see <https://www.gnu.org/licenses/>."

##
## This script builds the data-loader index.html file.
## It is run from scripts/pipeline_processing.R.
##
## It:
## - Sets environment variables based on the script's parameters
## - Runs webpack (via npm run build) to generate the index.html file
##
## The index.html file will be subsequently included in the final
## report when scripts/pipeline_report_template.Rmd (specifically,
## scripts/child_templates/data-loader.Rmd) is run from
## scripts/generate_report.R.
##

if [ $# -ne 4 ] ; then
  echo Usage: "$0": PDATA_PATH DATA_VALUES_PATH METADATA_PATH OUTPUT_DIR
  exit 1
fi

## Set the environment variables required by webpack to generate the data loader
## section of the report (see data-loader/webpack.config.js).
export PDATA_PATH="$1" # full path to pdata.csv file
export DATA_VALUES_PATH="$2" # full path to data_values.csv file
export METADATA_PATH="$3" # full path to metadata.json
export OUTPUT_DIR="$4" # full path to output directory for experiment data section

echo Generating experiment data loader into "$OUTPUT_DIR"
cd /workspace/data-loader
exec npm run build

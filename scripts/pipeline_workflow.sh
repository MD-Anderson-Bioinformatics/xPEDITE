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

set -e

# Create a temporary input directory and remove it when this
# script exits.
TMPINPUTDIR="$(mktemp -d)"
trap '/usr/bin/rm -rf -- "$TMPINPUTDIR"' EXIT

while getopts d:p:f:b:m:o:s:n:r:t: flag
do
    case "${flag}" in
        d) dataFolder="${OPTARG}";;
        p) pdataFile="${OPTARG}";;
        f) inputFile="${OPTARG}";;
        b) blacklist="${OPTARG}";;
        m) metaFile="${OPTARG}";;
        o) outputFile="${OPTARG}";;
        s) scriptFolder="${OPTARG}";;
        n) normalization="${OPTARG}";;
        r) reportFolder="${OPTARG}";;
    esac
done
echo "dataFolder: $dataFolder";
echo "pdataFile: $pdataFile";
echo "inputFile: $inputFile";
echo "blacklist: $blacklist";
echo "metaFile: $metaFile";
echo "outputFile: $outputFile";
echo "scriptFolder: $scriptFolder";
echo "normalization: $normalization";
echo "reportFolder: $reportFolder";

# Remove the UTF-8 representation of the Byte Order Mark (BOM)
# should it be present.  See https://en.wikipedia.org/wiki/Byte_order_mark.
sed '1s/^\xEF\xBB\xBF//' < "$dataFolder$inputFile" > "$TMPINPUTDIR/$inputFile"
sed '1s/^\xEF\xBB\xBF//' < "$dataFolder$pdataFile" > "$TMPINPUTDIR/$pdataFile"
sed '1s/^\xEF\xBB\xBF//' < "$dataFolder$metaFile" > "$TMPINPUTDIR/$metaFile"

folder="$PWD"
if  [ -z "$scriptFolder" ]
then
    folder="$PWD"
else

    folder="$scriptFolder"
fi
echo "$folder"
cd "$folder"

if [ -z "$blacklist" ]
then
    Rscript pipeline_processing.R -f "$inputFile" -m "$metaFile" -p "$pdataFile" -d "$TMPINPUTDIR/" -n "$normalization" -r "$reportFolder"
else
    # Also remove BOM character from blacklist and copy to TMPINPUTDIR if specified.
    sed '1s/^\xEF\xBB\xBF//' < "$dataFolder$blacklist" > "$TMPINPUTDIR/$blacklist"
    Rscript pipeline_processing.R -f "$inputFile" -m "$metaFile" -p "$pdataFile" -d "$TMPINPUTDIR/" -n "$normalization" -l "$blacklist" -r "$reportFolder"
fi
if [ $? -ne 0 ] ; then
  echo Pipeline processing R script failed with error code $?
  exit 1
fi

# Check pathways database and update pathway-loader if needed.
/pathways/scripts/generate_pathway_loader.sh /workspace/report-modules/pathway-loader
if [ $? -ne 0 ] ; then
  echo Pathway loader script failed with error code $?
  exit 1
fi

Rscript generate_report.R -f pipeline_report_template.Rmd -o "$outputFile" -n "$normalization" -d "$TMPINPUTDIR/" -r "$reportFolder" -t "$TMPINPUTDIR"
if [ $? -ne 0 ] ; then
  echo Generate_report R script failed with error code $?
  exit 1
fi

exit 0

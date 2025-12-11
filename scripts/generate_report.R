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

library("optparse")
library("rjson")
source('./futileLogging.R')

option_list = list(
    make_option(c("-f", "--file"), type="character", default=NULL,
              help="input RMarkdown template name", metavar="character"),
    make_option(c("-o", "--out"), type="character", default="output.html",
              help="output file name [default= %default]", metavar="character"),
    make_option(c("-d", "--dataFolder"), type="character",
              help="input data folder", metavar="character"),
    make_option(c("-n", "--normalization"), type="character", default="totalarea",
              help="normalization method", metavar="character"),
    make_option(c("-r", "--reportFolder"), type="character",
              help="report folder path", metavar="character"),
    make_option(c("-t", "--tmpFolder"), type="character", default="/tmp",
              help="folder path for temporary files", metavar="character")
);

opt_parser = OptionParser(option_list=option_list);
opt = parse_args(opt_parser);
render_report = function(opt) {
  params_list=fromJSON(file=file.path(opt$reportFolder,"metadata.json"))
  params_list[["reportFolder"]] = paste(opt$reportFolder,"/",sep='')
  params_list[["normalization"]] = opt$normalization
  rmarkdown::render(
    opt$file, params = params_list,
    output_file = file.path(opt$reportFolder,opt$out),
    intermediates_dir = opt$tmpFolder
  )
}

logfile=file.path(opt$reportFolder,"logfile.txt")
initLogging(Sys.getenv("LOG_LEVEL"), logfile)
log_info("Generating report.")
tryCatch({
  render_report(opt)
  log_info("Report generation complete.")
}, error=function(err){
  print(err)
  log_error(paste("Error generating report. See logfiles in", opt$reportFolder, sep=" "))
})


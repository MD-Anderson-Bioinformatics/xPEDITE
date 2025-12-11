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

rm(list = ls())
library(stringr)
library(rjson)
library("optparse")

source('./futileLogging.R')
source("./process_util_script.R")
source("./process_type_script.R")
source("./analysis_script.R")
library("readxl")

option_list = list(
    make_option(c("-f", "--file"), type="character", default="200609a_DrWargo_StoolSamples_ICMS_Targeted(89).csv",
              help="input data file", metavar="character"),
    make_option(c("-m", "--metadata"), type="character", default='metadata.json',
              help="input metadata file [default= %default]", metavar="character"),
    make_option(c("-p", "--pdata"), type="character", default='pdata.csv',
              help="input pdata file [default= %default]", metavar="character"),
    make_option(c("-d", "--dataFolder"), type="character",
              help="input data folder", metavar="character"),
    make_option(c("-l", "--blacklist"), type="character",
              help="row/column blasklist", metavar="character"),
    make_option(c("-n", "--normalization"), type="character", default="totalarea",
              help="normalization method", metavar="character"),
    make_option(c("-r", "--reportFolder"), type="character",
              help="report fodler path", metavar="character")
);

opt_parser = OptionParser(option_list=option_list);
opt = parse_args(opt_parser);


dataFolderPath<-opt$dataFolder
reportFolderPath<-opt$reportFolder
logfile=paste(reportFolderPath,"/logfile.txt",sep="")

initLogging(Sys.getenv("LOG_LEVEL"), logfile)

tryCatch({
  analyzeddatablackList<-c()
  if (!is.null(opt$blacklist)){
        blacklist<-fromJSON(file=paste(dataFolderPath,opt$blacklist,sep=""))
        analyzeddatablackList<-blacklist$analyzeddata
        pdatablackList<-blacklist$pdata
  }
  metadataPath <- file.path(dataFolderPath,opt$metadata)
  metadata<-fromJSON(file=metadataPath)

  metadata = get_version_number(metadata)

  #processing of pdata
  ## Note: user gets a chance to fix this file in the sample table of the study page,
  ##       and if there is missing data, an alert requires the user to fix the errors before
  ##       a report can be generated.
  log_debug(paste0("Reading data file into 'pd': ", dataFolderPath, opt$pdata))
  pd <- read_input_file(paste(dataFolderPath, opt$pdata, sep=""), header = TRUE)

  if (exists("pdatablackList") && length(pdatablackList)>0 && length(colnames(pd))>1){
    log_debug(paste0("Removing Blacklisted entries from pdata: ", paste(pdatablackList, collapse=", ")))
    pd<-pd[!(pd$ID %in% pdatablackList),]
  } else {
    log_debug("No blacklisted entries in pdata")
  }

    # batch factors
  batches <- colnames(pd %>% select(starts_with("batch_")))
  batchespd<-cbind(ID=pd$ID, pd %>% select(starts_with("batch_")))
  write.table(batchespd, paste(reportFolderPath,'/BatchData.tsv',sep=""), sep='\t', quote = FALSE)

 # Save version with batches for NGCHM covariates
  pd_original<- pd
  result=get_MajorMinor(pd,opt$normalization)
  groups_original=result$groups

 # remove batche factor
  pd<- pd %>% select(!starts_with("batch_"))


 # Get an assignment of covariates
  result=get_MajorMinor(pd,opt$normalization)
  major=result$major
  minor=result$minor
  pd=result$pd
  groups=result$groups

  print(major)
  print(minor)
  dataPath = paste(dataFolderPath,opt$file,sep="")

  # Use passed in assayType to decide how to process the data
  log_info("assayType : ", metadata["assayType"])
  outputMetadataPath <- file.path(reportFolderPath, "metadata.json")
  df_v2<-preprocess(dataPath, metadata["toolUsed"], analyzeddatablackList)
  if (metadata["assayType"]=="Standardized"){
      metadata["title"]="Report for Standardized Analysis"
  } else if (metadata["assayType"]=="HILIC-MS"){
      metadata["title"]="Report for HILIC Analysis"
  } else if (metadata["assayType"]=="C30-MS"){
      metadata["title"]="Report for Lipid Analysis"
  } else if (metadata["assayType"]=="IC-MS Non-Targeted"){
      # metadata["platform"]="ICMS (Non-Targeted)"
      metadata["title"]="Report for Non-Targeted Analysis"
      #df_v2<-aminoacid_normalization(df_v2) Disabling after meeting discussion w/ @PLLorenzi today
  } else if (metadata["assayType"]=="IC-MS Targeted"){
      #df_v2<-aminoacid_normalization(df_v2) Disabling after meeting discussion w/ @PLLorenzi today
      # Special treatment, might need to rewrite when no more about detail
      IS<-rownames(df_v2)[grep('-13C', rownames(df_v2))]
      if (length(IS)!=0){
        for(i in 1:length(IS))
        {
          IS_one<-IS[i]
          IS_one<-str_split(IS_one,'-', simplify = TRUE)[,1]
          df_v2[match(IS_one,rownames(df_v2)),]<-df_v2[match(IS_one,rownames(df_v2)),]/df_v2[match(IS[i],rownames(df_v2)),]
        }
        df_v2<-df_v2[-which(rownames(df_v2) %in% IS),]
      }
  }
  write(toJSON(metadata), outputMetadataPath)
  verify_sample_id_agreement(pd, df_v2)
  #Normalization
  log_debug(paste0("Normalizing data using method: ", opt$normalization))
  if (opt$normalization == "totalarea"){
    df_v3<-totalarea_normalization(df_v2)
  }else if(opt$normalization =="median"){
    df_v3<-median_normalization(df_v2)
  }else if (opt$normalization == "dna" && "DNA" %in% colnames(pd)){
    df_v3<-dna_normalization(df_v2,pd)
  }else if (opt$normalization == "cellCount" && "cellCount" %in% colnames(pd)){
    df_v3<-cellcount_normalization(df_v2,pd)
  }else if (opt$normalization == "tissueWeight" && "tissueWeight" %in% colnames(pd)){
    df_v3<-tissueWeight_normalization(df_v2,pd)
  }else if (opt$normalization == "no") {
    df_v3<-df_v2
  }else if (opt$normalization == "zscore") {
    df_v3 <- zscore_normalization(df_v2)
  } else {
    log_error(paste0("Normalization method '", opt$normalization, "' not supported."))
    stop(paste0("Normalization method '", opt$normalization, "' not supported."))
  }

  # Replace NA with zero
  df_v3[is.na(df_v3)] <- 0
  # Append total area
  pd<-append_totalarea(df_v2,pd)

  #reorder columns for pattern _number
  reorder=data.frame(id=as.numeric(str_extract(colnames(df_v3),"\\d+$")),names=colnames(df_v3))
  if (sum(is.na(reorder$id))==0){
    df_v3<-df_v3[,reorder[order(reorder$id),]$names]
  }

  log_info("Normalization completed.")
  dir.create(dataFolderPath, showWarnings = FALSE)
  log_debug(paste("Created dataFolderPath: ", dataFolderPath))
  # Save a table to be used in pathway module
  df_v3=df_v3[rowSums(is.na(df_v3)) != ncol(df_v3), ]
  df_v3 <- check_naming_dictionary(df_v3, metadata["toolUsed"])
  df_pathways <- df_v3 ## to be written to data_values.csv for input to pathways module
  df_v3<-df_v3[,!(colnames(df_v3) %in% c("curatedName"))]
  df_pathways <- df_pathways[!duplicated(df_pathways$refmetName),]
  rownames(df_pathways) <- df_pathways$curatedName # pathway module expects curated name as rownames
  df_pathways <- df_pathways[,!(colnames(df_pathways) %in% c("refmetName", "Primary Pathway", "curatedName"))]

  # Save data matrix and sample data to be used for report generation
  unlink(paste(reportFolderPath,"/*csv",sep=""))
  log_trace("After unlink")
  write.table(df_v3,paste(reportFolderPath,'/Preprocessed_3_noNA_ISnormalized.tsv',sep=""), sep='\t', quote = FALSE, row.names=TRUE, col.names = NA)
  log_trace("Wrote Preprocessed_3_noNA_ISnormalized.tsv")
  write.table(pd, paste(reportFolderPath,'/CovariateData.tsv',sep=""), sep='\t', quote = FALSE)
  log_trace("Wrote CovariateData.tsv")
  write.csv(df_pathways, file.path(reportFolderPath, 'data_values.csv')) # this file referenced by generate_global_variables.sh
  log_trace("Wrote data_values.tsv. This file is an input to the pathways module.")
  df_v3<-df_v3[,!(colnames(df_v3) %in% c("refmetName", "Primary Pathway"))]
  log_info("Preprocessing complete")
}, error=function(err){
    print(err)
    log_error(paste("Error during preprocessing:", err, sep=" "))
})

df<-df_v3

df<-df[,as.character(intersect(colnames(df),pd$ID))]
pd<-subset(pd,ID %in% as.character(intersect(colnames(df),pd$ID)))
pd<-pd %>% slice(match(colnames(df),ID))

# Get the type of the anaysis, multiple covariates, single covariate, duplicates or not
process_type<-get_process_type(major,minor,pd)

# Run statistical analysis based on type of the analysis
run_analysis(process_type,pd,df,major,minor,reportFolderPath)


# Generate NGCHM
tryCatch({
  log_info("Generating NGCHM.")
  log_debug(paste("reportFolderPath:", reportFolderPath, sep=" "))
  generate_NGCHM_clustering(pd_original,df, reportFolderPath,'NGCHM_clustering',groups_original,major,minor,"true")
  # Generate one NGCHM per column
  col_names=colnames(pd_original)
  col_names=col_names[col_names!="ID"]
  col_names=col_names[col_names!="DNA"]
  col_names=col_names[col_names!="cellCount"]
  col_names=col_names[col_names!="tissueWeight"]
  for (col in col_names){
    log_debug("Generating NGCHM for column: ", col)
    generate_NGCHM_clustering(pd_original,df, reportFolderPath,paste('NGCHM',col,'clustering',sep='_'),groups_original,col,"NA","false")
  }
  log_info("NGCHM generation complete.")
}, error=function(err){
    print(err)
    log_error(paste("Error during NGCHM generation:", err, sep=" "))
})

# Run the specified system command with the specified command args and log results.
#
run_system_command <- function (name, system_command, system_command_args) {
  log_debug(paste ("Running system command for", name))
  quoted_args <- lapply(system_command_args, function(arg) {
    return(shQuote(arg)) # put quotes around the argument in case it has spaces
  })
  stderr_stdout <- system2(system_command, quoted_args, stdout=TRUE, stderr=TRUE)
  if (!is.null(attr(stderr_stdout, "status")) && attr(stderr_stdout, "status") != 0) {
    log_error(paste ("Error in command for", name))
    log_error(paste("system_command:", system_command))
    log_error(paste("system_command_args:", paste(system_command_args, collapse=" ")))
    log_error(paste(stderr_stdout, collapse="\n[ERROR] "))
    log_error(paste("Exit code from", name, "command:", attr(stderr_stdout, "status")))
  } else {
    log_debug(paste ("Command for", name, "completed"))
    log_debug(paste("system_command:", system_command))
    log_debug(paste("system_command_args:", paste(system_command_args, collapse=" ")))
    log_debug(paste(gsub("error", "err", stderr_stdout, ignore.case = TRUE), collapse="\n[DEBUG] "))
  }
}

#Generate PCA for covariates
tryCatch({
  log_info("Generating PCA Plus plot.")
  generate_PCA_plus(pd,df,reportFolderPath,groups,"groups")
  # Embed the image into html file
  systemCommand = "python3"
  if (log_get_current_level() == "DEBUG" || log_get_current_level() == "TRACE") {
    systemCommandARGS = c("tsvToJSON.py", reportFolderPath, paste(groups,collapse=","), "pca_plus.html", logfile)
  } else {
    systemCommandARGS = c("tsvToJSON.py", reportFolderPath, paste(groups,collapse=","), "pca_plus.html")
  }
  run_system_command ("Embedding PCA Plus plot", systemCommand, systemCommandARGS)
}, error=function(err){
    log_error(paste("Error during PCA Plus plot generation:", err, sep=" "))
    print(err)
})

#
##Generate PCA for batches
if (length(batches)>0){
  tryCatch({
    log_info("Generating PCA Plus plot for batches.")
    generate_PCA_plus(batchespd,df,reportFolderPath,batches,"batches")
    # Embed the image into html file
    systemCommand = "python3"
    systemCommandARGS = c("tsvToJSON.py", reportFolderPath, paste(batches,collapse=","), "pca_plus_batch.html")
    run_system_command ("Embedding PCA Plus plot for batches", systemCommand, systemCommandARGS)
  }, error=function(err){
      print(err)
      log_error(paste("Error Generating PCA Plus plot for batches:", err, sep=" "))
  })
}

## Generate data loader module
system_command = "/app/scripts/generate_data_loader.sh"
system_command_args = c(file.path(dataFolderPath, opt$pdata), # full path to pdata file
                        file.path(reportFolderPath, "data_values.csv"), # full path to data_values.csv
                        file.path(reportFolderPath, "metadata.json"), # full path to metadata.json
                        file.path(reportFolderPath, "data-loader") # full path to output folder
                      )
run_system_command ("Generating data loader", system_command, system_command_args);

log_info("Pipeline Processing Done.")


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

library(data.table)
library(reshape)
library(stringr)

library(RColorBrewer)
library(dplyr)
library(tools)
library(tidyverse)
library(httr)
library(matrixStats)



library("readxl")


# adjust major, minor group,
# if no covariate, add "Group" covariate as default, use ID as value.
# if one covariate, the minor is set to NA.
# if two covariates, and one of the covariates is "Time", always set the "Time" as minor.
# if more than two covariates, set major and minor to NA, so the pipeline knows there are more than two covariates.
# @params pd : sample information
#         normalizaton: normalization method
# Returns major covariate, minor covariate, regenerated pd, list of covariates as list
# Most of the statistics analysis is done based on the assumption of two covariates, so it is important to set major and minor covariate.
get_MajorMinor<-function(pd,normalization){
    major<-"NA"
    minor<-"NA"
    col_names=colnames(pd)
    col_names=col_names[col_names!="DNA"]
    col_names=col_names[col_names!="cellCount"]
    col_names=col_names[col_names!="tissueWeight"]
    if (length(col_names)==1){
        pd["Group"]=pd$ID
        major="Group"
        groups<-c(major)
        if (normalization == "dna" && "DNA" %in% colnames(pd)){
            pd=pd[,c("ID","Group","DNA")]
        }
        if (normalization == "cellCount" && "cellCount" %in% colnames(pd)){
            pd=pd[,c("ID","Group","cellCount")]
        }
         if (normalization == "tissueWeight" && "tissueWeight" %in% colnames(pd)){
            pd=pd[,c("ID","Group","tissueWeight")]
        }
    } else if (length(col_names)==2){
        major<-col_names[2]
        groups<-c(major)
    } else if (length(col_names)==3){
        major<-col_names[2]
        minor<-col_names[3]
        groups<-c(major,minor)
        if (grepl("Time",major)|| grepl("time",major)){
            groups<-c(minor,major)
            major = groups[1]
            minor = groups[2]
        }
    } else if (length(col_names)>=4) {
        groups<-col_names
        groups=groups[col_names!="ID"]
    }
    return(list(major=major,minor=minor,pd=pd,groups=groups))
}

#' Verify the samples IDs agree in the sample and analyzed data files
#'
#' Checks that all the samples in the 'Sample File' have corresponding entries in the 'Analyzed Data File'
#' and vice versa.
#'
#' For reference:
#'     'Sample File' in our sample data is always called 'pdata.csv', its first column is sample IDs
#'     'Analyzed Data File' in our sample data are .xlsx files and have sample names as column headings.
#'
#' @param samples_df Data frame of samples from the 'Sample File' (e.g. pdata.csv)
#' @param data_df Data frame of samples from the 'Analyzed Data File' (e.g. the .xlsx, .csv, or .tsv file of data)
#' @return TRUE if no errors, otherwise error w/ message listing extra samples
verify_sample_id_agreement <- function(samples_df, data_df) {
  expected_sample_names <- samples_df$ID ## from 'pdata.csv'
  actual_sample_names <- colnames(data_df)  ## from .xlsx, .csv, or .tsv data file
  sample_diffs <- setdiff(expected_sample_names, actual_sample_names)
  if (length(sample_diffs) != 0) {
    error_message <- paste("Extra samples in sample file:", paste(sample_diffs, collapse = ", "))
    log_error(error_message)
    return(stop(error_message))
  }
  sample_diffs <- setdiff(actual_sample_names, expected_sample_names)
  if (length(sample_diffs) != 0) {
    error_message <- paste("Extra samples in analyzed data file:", paste(sample_diffs, collapse = ", "))
    log_error(error_message)
    return(stop(error_message))
  }
  return(TRUE)
}

#' Read in .xlsx, .csv, or .tsv file and return a data.frame, or error if missing data
#'
#' @param full path to file
#' @return df dataframe of file if no mssing data, otherwise error
read_input_file <- function(file_path, header = TRUE, sheet = 1, rownames = NULL) {
  log_debug(paste0("Reading data file: ", file_path))
  file_extention <- file_ext(file_path)
  if (file_extention == "xlsx") {
    df <- read_excel(file_path, sheet = sheet, col_names = TRUE, na = "")
    df <- as.data.frame(df)
  } else if (file_extention == "csv") {
    df <- read.csv(file_path, header = header, check.names = FALSE, row.names = rownames,
       na.strings = c("NA", "", " "), comment.char = "#", quote = "\"")
  } else if (file_extention == "tsv") {
    df <- read.csv(file_path, header = header, check.names = FALSE, row.names = rownames,
       na.strings = c("NA", "", " "), comment.char = "#", sep = '\t')
  } else {
    stop(paste0("Input file names should end in .xlsx, .csv, or .tsv. Cannot determine file type of: ", file_path))
  }
  # warn user about any blank rows in their data
  n_blank_rows <- sum(apply(df, 1, function(x) all(is.na(x))))
  if (n_blank_rows > 0) {
    log_warn(paste0("Removing ", n_blank_rows, " blank row(s) in data from '", basename(file_path), "'"))
  }
  # remove blank rows
  df <- df[!apply(df, 1, function(x) all(is.na(x))), ]
  # warn user about any blank columns in their data
  n_blank_cols <- sum(apply(df, 2, function(x) all(is.na(x))))
  log_debug("n_blank_cols", n_blank_cols)
  if (n_blank_cols > 0) {
    log_warn(paste0("Removing ", n_blank_cols, " blank column(s) in data from '", basename(file_path), "'"))
  }
  # remove blank columns
  df <- df[, !apply(df, 2, function(x) all(is.na(x)))]
  if (any(is.na(df))) {
    error_message = paste0("Missing values in file '", basename(file_path), "'. Please verify input data and try again")
    log_error(error_message)
    stop(error_message)
  }
  # If there is an "ID" column, we always want it to be a character
  if ("ID" %in% colnames(df) && mode(df$ID) != "character") {
    df$ID <- as.character(df$ID)
  }
  return(df)
}


#Read data based on the file type and analysis tool
# @params dataPath : input data path
#         analysisTool : analysisTool (Skyline, Trace Finder, Compounded Discoverer, or Lipid Search)
#         analyzeddatablacklist : unwanted columns
# Return data matrix with rows as compound names and columns as samples
preprocess<-function(dataPath, analysisTool, analyzeddatablackList){
    data <- read_input_file(dataPath)
    # Convert Trace Finder files (formatted with three columns - Compound, Filename, and Area) into the format the pipeline expects
    if (analysisTool == "Trace Finder") {
        tryCatch(
            {
                if (grep("Compound", colnames(data)) && grep("Filename", colnames(data)) && grep("Area", colnames(data))){
                    data<-data[,c('Compound', 'Filename', 'Area')]
                    df<-cast(data, Compound~Filename)
                    rownames(df)<-df$Compound
                    df<-subset(df, select=-c(Compound))
                    df_char<-apply(df,2, as.character)
                    df_num<-as.data.frame(apply(df_char,2, as.numeric))
                    rownames(df_num)<-rownames(df)
                    colnames(df_num)<-colnames(df)
                    data<-df_num
                } else{
                    stop("Please check input file format. It should have Compound, Filename and Area in the header.")
                }
            },
            error = function(e) {
                stop(paste("Please check analyzed data file format. It should include columns named 'Compound', 'Filename', and 'Area'. Error: ",e))
            }
        )
    } else {
        tryCatch(
            {
                rownames(data)<-data[,1]
                data=data[,c(-1)]
                data=data[,!sapply(data, function(x)all(is.na(x)))]
                df_char<-apply(data,2, as.character)
                df_num<-as.data.frame(apply(df_char,2, as.numeric))
                rownames(df_num)<-rownames(data)
                colnames(df_num)<-colnames(data)
                data<-df_num
            },
            error = function(e) {
                stop(paste("Please check analyzed data file format. It should be a matrix with samples as columns and compounds as rows. Error: ",e))
            }
        )
    }
    if (length(analyzeddatablackList)>0){
        check = which(colnames(data) %in% analyzeddatablackList)
        if (is.integer(check) && length(check) == 0L){
            data<-data
        }else{
            data<-data[ , -which(colnames(data) %in% analyzeddatablackList)]
        }
    }
    return(data)
}

##
##  Commenting out this function, but not yet removing it. (the lab suggests it
##  may be reenabled in the future)
##
# Use the value for standard aminoacid Glutamine or Lactate to normalize the data
# The name could be Glutamine[13C5] or Glutamine-[13C5] or Lactate[13C03].
#aminoacid_normalization<-function(df){
#    #normalizing by internal standard - glutamine or Lactate
#    standardName="NA"
#    df[is.na(df)] <- 0
#    if ('Glutamine' %in% rownames(df)){
#        standardName = 'Glutamine[13C5]'
#        if (standardName == 'Glutamine[13C5]'){
#            if ('Glutamine-[13C5]' %in% rownames(df)){
#                standardName='Glutamine-[13C5]'
#            }
#        }
#    } else if ('Lactate[13C03]' %in% rownames(df)){
#        standardName = 'Lactate[13C03]'
#    }
#    if (standardName != "NA" && standardName %in% rownames(df)){
#        df_norm<-mapply('/',df,df[which(rownames(df)==standardName),])
#        df_norm<-as.data.frame(df_norm)
#        rownames(df_norm)<-rownames(df)
#        df_norm<-df_norm[-which(rownames(df_norm)==standardName),]
#        return(df_norm)
#    }else{
#        return(df)
#    }
#}

# Returns total area normalized data file
totalarea_normalization<-function(df){
    #Normalizing by total peak area
    df_norm<-t(t(df)/rowSums(t(df), na.rm = TRUE))
    df_norm<-as.data.frame(df_norm)
    return(df_norm)

}

# Divide the original compound value of the sample with DNA concentration of that sample
dna_normalization<-function(df,pd){
    df<-df[,as.character(intersect(colnames(df),pd$ID))]
    pd<-subset(pd,ID %in% as.character(intersect(colnames(df),pd$ID)))
    pd<-pd %>% slice(match(colnames(df),ID))
    df_norm<-as.data.frame(sweep(as.matrix(df),2,t(pd$DNA),'/'))
    df_norm<-as.data.frame(df_norm)
    return(df_norm)
}

# Divide the original compound value of the sample with cell count of that sample
cellcount_normalization<-function(df,pd){
    df<-df[,as.character(intersect(colnames(df),pd$ID))]
    pd<-subset(pd,ID %in% as.character(intersect(colnames(df),pd$ID)))
    pd<-pd %>% slice(match(colnames(df),ID))
    df_norm<-as.data.frame(sweep(as.matrix(df),2,t(pd$cellCount),'/'))
    df_norm<-as.data.frame(df_norm)
    return(df_norm)
}

# Divide the original compound value of the sample with tissue weight of that sample
tissueWeight_normalization<-function(df,pd){
    df<-df[,as.character(intersect(colnames(df),pd$ID))]
    pd<-subset(pd,ID %in% as.character(intersect(colnames(df),pd$ID)))
    pd<-pd %>% slice(match(colnames(df),ID))
    df_norm<-as.data.frame(sweep(as.matrix(df),2,t(pd$tissueWeight),'/'))
    df_norm<-as.data.frame(df_norm)
    return(df_norm)
}

# Take the median value across all compounds for one sample, substract median from the original value
# Returns median normalized data file
median_normalization<-function(df){
    medians<-apply(df,2,median)
    df_norm<-as.data.frame(sweep(df,2,medians,"-"))
    return(df_norm)
}

#' @title Z-score normalization
#' @description
#' Z-score normalization of input dataframe
#' @param df data frame
#' @return data frame
zscore_normalization <- function(df) {
  log_trace_dataframe(df)
  row_means <- apply(df, 1, mean, na.rm = TRUE)
  row_sds <- apply(df, 1, sd, na.rm = TRUE)
  # z-score normalize
  df_centered <- sweep(df, 1, row_means, "-")
  df_norm <- sweep(df_centered, 1, row_sds, "/")
  return(df_norm)
}

# Calculate total area and NAfreq, append to pddata file
# Returns pd file with additional two columnes, one for total area, one for NA frequency
append_totalarea<-function(df,pd){
    df<-df[,as.character(intersect(colnames(df),pd$ID))]
    pd<-subset(pd,ID %in% as.character(intersect(colnames(df),pd$ID)))
    na_freq<-apply(df,2, function(x) length(which(is.na(x)))/length(x))
    totalArea<-rowSums(t(df), na.rm = TRUE)
    # pd$injection<-str_split(pd$ID, '_', simplify = TRUE)[,2]
    if (any(is.na(match(pd$ID, names(totalArea)))) || length(pd$ID)==0){
        stop("Sample IDs are not matching.")
    }
    pd$TotalArea<-totalArea[match(pd$ID, names(totalArea))]
    pd$NAfreq<-na_freq[match(pd$ID, names(na_freq))]
    return(pd)
}

# If there are serveral measurments for one specific combination of covariates, take the median value to represent the group.
# Mainly used for deltaAUC plot generation.
# @params: pd: sample meta file pdata
#          df: data file
#          major: major covariate
#          minor: minor covariate
# Return a reduced data file and a reduced sample metafile
reduceData<-function(pd,df,major,minor){
    combine=data.frame(row.names=1:nrow(df))
    combinecols = c()
    combinemajor = c()
    combineminor = c()
    for (el1 in unique(pd[[major]])){
      for (el2 in unique(pd[[minor]])){
        submatrix=subset(df,select=pd[which(pd[[major]]==el1 & pd[[minor]]==el2),]$ID)
        if (dim(submatrix)[2]!=0){
            combinecols=c(combinecols,paste(el1,el2,sep="_"))
            combinemajor=c(combinemajor,el1)
            combineminor=c(combineminor,el2)
            result=rowMedians(as.matrix(submatrix))
            combine=cbind(combine,result)
        }
      }
    }
    rownames(combine)=rownames(df)
    colnames(combine)=combinecols
    # combine<-combine %>% select(where(function(x) any(!is.na(x))))
    newpd<-cbind(combinecols,combinemajor,combineminor)
    colnames(newpd)<-c("ID",major,minor)
    newpd<-as.data.frame(newpd)
    return (list(newdf=combine,newpd=newpd))
}


#' Use curated dictionary to find Refmet Names, Curated Name, Abbreviated Name, and Primary Pathway
#'
#' This function uses a curated dictionary to find Refmet Names, Curated Name, Abbreviated Name,
#'  and Primary Pathway for the rows in the input data frame.
#'
#' The primary pathway, refmet name, and curated name are appended as new columns to the input data frame.
#'
#' The rownames of the input data frame are updated to the format `Curated Name (Abbreviated Name)`,
#' unless the Curated Name == Abbreviated Name, in which case it is just the Curated Name.
#'
#' If no standard RefMet or curated name is found, the original name is used.
#'
#' @param df A data frame where row names represent metabolite names to be matched against the curated dictionary.
#' @param analysisTool A string or vector specifying the analysis tool used (e.g., "Skyline", "Trace Finder").
#'          This is used to match the appropriate column in the curated dictionary.
#' @return A data frame with additional columns: `Primary Pathway`, `refmetName`, and `curatedName`.
#'         The row names are updated to the format `Curated Name (Abbreviated Name)`, unless the
#'         Curated Name == Abbreviated Name, then it is just the Curated Name.
check_naming_dictionary <- function(df, analysisTool) {
    refmetRownames=c()
    curatedRownames=c()
    fullRownames=c()
    primaryPathways=c()
    metabolite_names <- read.csv("/workspace/metabolite_name_dictionary/Metabolite_name_reference.tsv",
           header = TRUE, sep = "\t", stringsAsFactors = FALSE, check.names = FALSE)
    log_trace_dataframe(metabolite_names, FALSE)
    analysisTool = unlist(analysisTool)
    if (!(analysisTool %in% colnames(metabolite_names))){
        log_warn(paste("Could not find column '", analysisTool, "' in the naming dictionary.", sep=""))
    }
    missingNames=c()
    for (rowname in rownames(df)){
        tryCatch({
            if (!(rowname %in% unlist(metabolite_names[analysisTool]))){
                missingNames <- append(missingNames, rowname)
            }
        },error=function(err){
            missingNames <<- append(missingNames, rowname)
        })
        tryCatch({
            refmet_name=metabolite_names$'Refmet Name'[metabolite_names[analysisTool]==rowname]
            curated_name=metabolite_names$'Curated Name'[metabolite_names[analysisTool]==rowname]
            primary_pathway=metabolite_names$'Primary Pathway'[metabolite_names[analysisTool]==rowname]
            if (length(refmet_name) == 0 || is.null(refmet_name) || refmet_name == "-"){
                refmet_name <- rowname
                log_warn(paste("Refmet name was null for ", rowname))
            }
            if (length(curated_name) == 0 || is.null(curated_name) || curated_name == "-"){
                curated_name <- rowname
                full_name <- rowname
                log_warn(paste("Curated name was null for ", rowname))
            } else if (curated_name != metabolite_names$'Abbreviated Name'[metabolite_names[analysisTool]==rowname]){
                full_name=paste(curated_name, " (", metabolite_names$'Abbreviated Name'[metabolite_names[analysisTool]==rowname], ")", sep = "")
            } else{
                full_name=curated_name
            }
            if (length(primary_pathway) == 0 || is.null(primary_pathway) || primary_pathway == "-"){
                primary_pathway <- "-"
                log_warn(paste("Primary pathway was null for ", rowname))
            }
            refmetRownames<-append(refmetRownames,refmet_name)
            curatedRownames<-append(curatedRownames,curated_name)
            fullRownames<-append(fullRownames,full_name)
            primaryPathways<-append(primaryPathways,primary_pathway)
            log_trace(paste("name: ", rowname, " refmet: ", refmet_name, " curated: ", curated_name, " pathway: ", primary_pathway))
        },error=function(err){
           log_warn(paste("Could not find RefMet name, curated name, and/or primary pathway for: ", rowname))
           log_debug(gsub("error", "", err, ignore.case = TRUE)) # print warning message w/o log viewbox flagging report as error
           refmetRownames <<- append(refmetRownames, rowname)
           curatedRownames <<- append(curatedRownames, rowname)
           fullRownames <<- append(fullRownames, rowname)
           primaryPathways <<- append(primaryPathways, "-")
        })
    }
    # Warn if duplicated refmet names
    duplicated_refmet_names <- refmetRownames[duplicated(refmetRownames)]
    if (length(duplicated_refmet_names) > 0){
      log_warn(paste("Data has duplicated RefMet name(s): ", duplicated_refmet_names))
    }
    # Error if duplicated curated names (because we're using these as rownames)
    duplicated_curated_names <- curatedRownames[duplicated(curatedRownames)]
    if (length(duplicated_curated_names) > 0){
      log_error(paste("Data has duplicated Curated name(s): ", duplicated_curated_names))
      return(stop(paste("Data has duplicated Curated name(s): ", duplicated_curated_names)))
    }
    if (length(missingNames) > 0){
        log_warn(paste(length(missingNames), " out of ", length(rownames(df)), " compound names were not found in the naming dictionary under the '", analysisTool, "' column.", sep=""))
        log_list(missingNames)
    } else {
        log_info(paste("All compound names matched entries in the '", analysisTool, "' column of the naming dictionary.", sep=""))
    }
    df$'Primary Pathway'<-primaryPathways
    df$refmetName<-refmetRownames
    df$curatedName<-curatedRownames
    rownames(df)<-fullRownames
    return(df)
}

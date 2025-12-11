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

source("./analysis_script.R")
source("./process_util_script.R")

get_process_type<-function(major,minor,pd){
    log_trace_dataframe(pd, FALSE)
    log_trace("pd[[major]]: ", paste(pd[[major]], collapse=", "))
    log_trace("unique(pd[[major]]): ", paste(unique(pd[[major]]), collapse=", "))
    duplicates=check_duplicate(pd,major,minor)
    if (major != "NA" && minor !="NA" && length(duplicates)>0){
        type="multi_duplicates"
    }else if (major != "NA" && minor !="NA" && length(duplicates)==0){
        type="multi_no_duplicates"
    }else if (major !="NA" && minor == "NA" && length(unique(pd[[major]]))!=length(pd[[major]])){
        type="single_duplicates"
    }else if (major != "NA" && minor == "NA" && length(unique(pd[[major]])) == nrow(pd)){
        type="single_no_duplicates"
    } else if (major == "NA" && minor == "NA"){
        type="multi_variates"
    } else {
        error_msg <- "Could not determine process type."
        log_error(error_msg)
        stop(error_msg)
    }
    log_debug("Process type: ", type)
    return(type)
}

check_duplicate<-function(pd,major,minor){
    log_debug(paste0("major: '", major, "'; minor: '", minor, "'"))
    labels=unique(pd[[major]])
    log_debug(paste("Unique values of pd[[major]]:", paste(labels, collapse=", ")))
    duplicates=c()
    for (label in labels){
        pd_label<-pd[which(pd[[major]]==label),]
        if (length(unique(pd_label[[minor]])) != length(pd_label[[minor]])){
            duplicates=c(duplicates,label)
        }
    }
    log_debug("Duplicates:", paste(duplicates, collapse=", "))
    return(duplicates)
}

# run analysis based on different process_type
# process_type: multi_duplicates, multi_no_duplicates, single_duplicates, single_no_duplicates, multi_variates
# pd: pdata file
# df: data file
# major: major covariate
# minor: minor covariate
run_analysis<-function(process_type,pd,df,major,minor,reportFolderPath){
    log_debug("Running analysis for process_type: ", process_type)
    log_trace("pd: ", pd)
    log_trace_dataframe(df)
    log_trace("major: ", major)
    log_trace("minor: ", minor)
    log_trace("reportFolderPath: ", reportFolderPath)
    duplicates=check_duplicate(pd,major,minor)
    pvalsANOVAFilePath = paste(reportFolderPath,'pvals_ANOVA.csv', sep="") # process_type = multi_duplicates
    v1majorFilePath = paste(reportFolderPath,'pvals_v1_',major,'.csv',sep="") # process_type = multi_duplicates, multi_no_duplicates, single_duplicates
    v2majorFilePath = paste(reportFolderPath,'pvals_v2_',major,'.csv',sep="") # process_type = multi_duplicates, multi_no_duplicates, single_duplicates
    v1minorFilePath = paste(reportFolderPath,'pvals_v1_',minor,'.csv',sep="") # process_type = multi_duplicates
    v2minorFilePath = paste(reportFolderPath,'pvals_v2_',minor,'.csv',sep="") # process_type = multi_duplicates
    multiLinearFilePath = paste(reportFolderPath,'pvals_multi_linear.csv',sep="") # process_type = multi_variates
    if (process_type=="multi_duplicates"){
          tryCatch({
            log_info(paste("Running two-way ANOVA for minor: ", "'", minor, "' and major: '", major, "'", sep=""))
            pd_dup=pd[pd[[major]] %in% duplicates,]
            pvals_final<-run_twoway(pd_dup,df,major,minor)
            write.csv(pvals_final, pvalsANOVAFilePath)
            log_debug(paste("Wrote 2-way ANOVA to pvalsANOVAFilePath: ", pvalsANOVAFilePath))
            df_com1<-run_all_anova(pd_dup,df,minor,major)
            df_com1$FactorGroup<-paste(df_com1[[minor]], gsub('\\d+$','',rownames(df_com1)), sep='_')
            if (!all(is.na(df_com1$p.adj))){
               write.csv(df_com1, v1majorFilePath)
               log_debug(paste("Wrote ANOVA to v1majorFilePath:", v1majorFilePath))
               df_com4<-get_FDR(df_com1)
               write.csv(df_com4, v2majorFilePath)
               log_debug(paste("Wrote FDR to v2majorFilePath:", v2majorFilePath))
            }
            log_info("Twoway ANOVA complete.")
            log_info("Running ANOVA.")
            df_com2<-run_all_anova(pd_dup,df,major,minor)
            df_com2$FactorGroup<-paste(df_com2[[major]],sapply(rownames(df_com2),function(x) strsplit(x,":")[[1]][1]),sep='-')
            if (!all(is.na(df_com2$p.adj))){
              write.csv(df_com2, v1minorFilePath)
              log_debug(paste("Wrote ANOVA to v1minorFilePath:", v1minorFilePath))
              df_com3=get_FDR(df_com2)
              write.csv(df_com3, v2minorFilePath)
              log_debug(paste("Wrote FDR to v2minorFilePath: ", v2minorFilePath))
            }
            log_info("ANOVA complete.")
            if (grepl("Time",minor) || grepl("time",minor)){
                combination=expand.grid(1:length(duplicates),1:length(duplicates))
                for (row in 1:nrow(combination)){
                    if (combination[row,1]<combination[row,2]){
                        pd_dup_sub=pd[pd[[major]] %in% duplicates[c(combination[row,1],combination[row,2])],]
                        result <- reduceData(pd_dup_sub,df,major,minor)
                        log_info("Running DeltaAUC.")
                        fileName = paste("deltaAUC",duplicates[combination[row,1]],duplicates[combination[row,2]],sep="_")
                        aucoutput=paste(reportFolderPath,fileName,'.csv',sep="")
                        deltaAUC<-run_deltaAUC(result$newpd,result$newdf,major,minor)
                        write.csv(deltaAUC,aucoutput)
                        log_debug(paste("Wrote deltaAUC to aucoutput:", aucoutput))
                    }
                }
            }
        }, error=function(err){
            print(err)
            log_error(paste("Error running ANOVA:", err, sep=" "))
        })
    }else if (process_type=="multi_no_duplicates" || process_type=="single_duplicates"){
        tryCatch({
            if (length(unique(pd[[major]]))!=length(pd[[major]])){
                log_info("Running ttest.")
                df_com1<-run_multi_tests(pd,df,major)
                df_com4<-data.frame()
                if (!all(is.na(df_com1$p.adj))){
                    write.csv(df_com1,v1majorFilePath)
                    log_debug(paste("Wrote ttest to v1majorFilePath:", v1majorFilePath))
                    df_com4<-get_FDR(df_com1)
                    write.csv(df_com4, v2majorFilePath)
                    log_debug(paste("Wrote FDR to v2majorFilePath:", v2majorFilePath, sep=" "))
                }
            }
        },error=function(err){
            print(err)
            log_error(paste("Error running oneway ANOVA:", err, sep=" "))
        })
        tryCatch({
            if (length(unique(pd[[major]]))!=length(pd[[major]]) && (grepl("Time",minor) || grepl("time",minor))){
                combination=expand.grid(1:length(unique(pd[[major]])),1:length(unique(pd[[major]])))
                for (row in 1:nrow(combination)){
                    if (combination[row,1]<combination[row,2]){
                        pd_dup_sub=pd[pd[[major]] %in% unique(pd[[major]])[c(combination[row,1],combination[row,2])],]
                        result <- reduceData(pd_dup_sub,df,major,minor)
                        log_info("Running DeltaAUC.")
                        fileName = paste("deltaAUC",unique(pd[[major]])[combination[row,1]],unique(pd[[major]])[combination[row,2]],sep="_")
                        aucoutput=paste(reportFolderPath,fileName,'.csv',sep="")
                        deltaAUC<-run_deltaAUC(result$newpd,result$newdf,major,minor)
                        write.csv(deltaAUC,aucoutput)
                        log_debug(paste("Wrote deltaAUC to aucoutput:", aucoutput))
                    }
                }
            }
        },error=function(err){
            print(err)
            log_error(paste("Error running deltaAUC:", err, sep=" "))
        })
    }else if (process_type=="single_no_duplicates"){
        log_debug("No additional analysis for single_no_duplicates")
    }else if (process_type=="multi_variates"){
        tryCatch({
            log_info("Running multi variates linear model.")
            pvals_final<-run_multi_variates(pd,df)
            write.csv(pvals_final, multiLinearFilePath)
            log_debug("Wrote ANOVA for more than 2 covariates to multiLinearfilePath:", multiLinearFilePath)
        },error=function(err){
            print(err)
        })

    }
}

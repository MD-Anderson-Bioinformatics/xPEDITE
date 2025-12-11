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
# setwd("/app/scripts/tests/")
source("../process_util_script.R")
source("../process_type_script.R", chdir=T)
source("../report_function.R", chdir=T)


multi_input_path="./testfiles/test_multi_aa_targeted.xlsx"
multi_pdata_path="./testfiles/test_pdata.csv"
single_no_dup_input_path="./testfiles/single_no_covariate_HILIC_Data.xlsx"
single_no_dup_pdata_path="./testfiles/single_no_covariate_pdata.csv"

preprocess_input<-function(df,pd){
  result<-get_MajorMinor(pd,"totalarea")
  pd<-result$pd
  major<-result$major
  minor<-result$minor
  groups<-result$groups
  #df<-aminoacid_normalization(df)
  df<-totalarea_normalization(df)
  df[is.na(df)] <- 0
  df<-df[,as.character(intersect(colnames(df),pd$ID))]
  pd<-subset(pd,ID %in% as.character(intersect(colnames(df),pd$ID)))
  pd<-pd %>% slice(match(colnames(df),ID))
  return(list(pd=pd,df=df,major=major,minor=minor,groups=groups))
}

test_that("check file type", {
  expect_equal(checkType(multi_input_path),"targeted")
  expect_equal(checkType(single_no_dup_input_path),"HILIC")
})

test_that("check pre process", {
  df_num=suppressWarnings(preprocess(multi_input_path,"targeted",c()))
  expect_equal(dim(df_num)[1],32)
  expect_equal(dim(df_num)[2],41)
  df_num=suppressWarnings(preprocess(multi_input_path,"targeted",c("210923_SQWAT_AA_1","210923_SQWAT_AA_2")))
  expect_equal(dim(df_num)[2],39)
  df_num=suppressWarnings(preprocess(single_no_dup_input_path,"HILIC",c()))
  expect_equal(dim(df_num)[2],2)
})


test_that("get major group and minor group",{
  pd<-read.csv(multi_pdata_path, header = TRUE)
  #One covariate
  onepd<-pd[,c("ID","DNA")]
  result<-get_MajorMinor(onepd,"DNA")
  expect_equal(result$major,"Group")
  expect_equal(result$minor,"NA")
  expect_output(print(colnames(result$pd)),"DNA")
  expect_equal(length(result$groups),1)
  # Two covariates
  twopd<-pd[,c("ID","Treatment","Time")]
  result<-get_MajorMinor(twopd,"DNA")
  expect_equal(result$major,"Treatment")
  expect_equal(result$minor,"Time")
  expect_equal(length(result$groups),2)
  #Three covariates
  result=get_MajorMinor(pd,"DNA")
  expect_equal(result$major,"NA")
  expect_equal(result$minor,"NA")
  expect_equal(result$groups[1],"Group")
  expect_equal(length(result$groups),3)
})

test_that("check total area normalization",{
  df_before=suppressWarnings(preprocess(multi_input_path,"targeted",c()))
  df_before[is.na(df_before)] <- 0
  df_norm<-totalarea_normalization(df_before)
  expect_equal(df_norm[,1], df_before[,1]/sum(df_before[,1],na.rm=TRUE))
})

#test_that("check amino acid normalization",{
#  df_before=suppressWarnings(preprocess(multi_input_path,"targeted",c()))
#  df_before[is.na(df_before)] <- 0
#  df_after<-aminoacid_normalization(df_before)
#  expect_equal(df_before[1,1]/df_after[1,1],df_before["Glutamine[13C5]",1])
#  expect_equal(df_before[10,5]/df_after[10,5],df_before["Glutamine[13C5]",5])
#})

test_that("check DNA normalization",{
  df_before=suppressWarnings(preprocess(multi_input_path,"targeted",c()))
  df_before[is.na(df_before)] <- 0
  pd<-read.csv(multi_pdata_path, header = TRUE)
  df_after<-dna_normalization(df_before,pd)
  id=pd$ID[2]
  expect_equal(df_after[,c(id)], df_before[,c(id)]/pd[pd$ID==id,c("DNA")])
})

test_that("check median normalization",{
  df_before=suppressWarnings(preprocess(multi_input_path,"targeted",c()))
  df_before[is.na(df_before)] <- 0
  df_after<-median_normalization(df_before)
  expect_equal(df_after[,1], df_before[,1]-median(df_before[,1]))
})

test_that("check append totalarea to pdata",{
  df=suppressWarnings(preprocess(multi_input_path,"targeted",c()))
  pd<-read.csv(multi_pdata_path, header = TRUE)
  result<-append_totalarea(df,pd)
  expect_equal(length(colnames(pd))+2,length(colnames(result)))
})

test_that("check reduce data for deltaAUC plot",{
  df=suppressWarnings(preprocess(multi_input_path,"targeted",c()))
  pd<-read.csv(multi_pdata_path, header = TRUE)
  twopd<-pd[,c("ID","Group","Time")]
  input<-get_MajorMinor(twopd,"DNA")
  result<-reduceData(twopd,df, input$major,input$minor)
  expect_equal(nrow(result$newpd),ncol(result$newdf))
  group="SQWAT_1"
  time="1day"
  expect_equal(result$newdf[,c(paste(group,time,sep="_"))],rowMedians(as.matrix(df[,pd[pd$Group==group & pd$Time==time,]$ID])))
})

test_that("check multi covariates",{
  df=suppressWarnings(preprocess(multi_input_path,"targeted",c()))
  pd<-read.csv(multi_pdata_path, header = TRUE)
  preprocess<-preprocess_input(df,pd)
  multi_covariates_result<-run_multi_variates(preprocess$pd,preprocess$df)
})

test_that("check major anova",{
  df=suppressWarnings(preprocess(multi_input_path,"targeted",c()))
  pd<-read.csv(multi_pdata_path, header = TRUE)
  preprocess<-preprocess_input(df,pd[,c("ID","Group","Time")])
  anova_result<-run_twoway(preprocess$pd,preprocess$df,preprocess$major,preprocess$minor)

})

test_that("check run delta AUC",{
  df=suppressWarnings(preprocess(multi_input_path,"targeted",c()))
  pd<-read.csv(multi_pdata_path, header = TRUE)
  preprocess<-preprocess_input(df,pd[,c("ID","Group","Time")])
  deltaAUC_result<-run_deltaAUC(preprocess$pd,preprocess$df,preprocess$major,preprocess$minor)
})

test_that("check NGCHM generation",{
  df=suppressWarnings(preprocess(multi_input_path,"targeted",c()))
  pd<-read.csv(multi_pdata_path, header = TRUE)
  twopd<-pd[,c("ID","Group","Time")]
  preprocess<-preprocess_input(df,twopd)
  title="check"
  clustering="false"
  reportFolder="./"
  covariates=c()
  Sys.setenv("SHAIDYMAPGEN"='../ShaidyMapGen.jar')
  Sys.setenv("NGCHMWIDGETPATH"='../ngchmWidget-min.js')
  generate_NGCHM_clustering(pd,df,reportFolder,title, covariates, preprocess$major,preprocess$minor, clustering)
  filepath=paste("./",title,".html",sep="")
  expect_true(file.exists(filepath))
  unlink(filepath)
})

test_that("check PCA plus",{
  df=suppressWarnings(preprocess(multi_input_path,"targeted",c()))
  pd<-read.csv(multi_pdata_path, header = TRUE)
  twopd<-pd[,c("ID","Group","Time")]
  preprocess<-preprocess_input(df,twopd)
  major = preprocess$major
  minor = preprocess$minor
  reportFolderPath="./PCAPlus"
  dir.create(file.path(reportFolderPath), showWarnings = FALSE)
  generate_PCA_plus(preprocess$pd,preprocess$df,reportFolderPath,preprocess$groups,"groups")
  expect_true(file.exists(paste(reportFolderPath,"PCA",major,"ManyToMany/PCAAnnotations.tsv",sep="/")))
  expect_true(file.exists(paste(reportFolderPath,"PCA",minor,"ManyToMany/PCAAnnotations.tsv",sep="/")))
  system(paste("python3 ../tsvToJSON.py",reportFolderPath, paste(preprocess$groups,collapse=","), "pca_plus.html", sep=" "), intern=TRUE, ignore.stderr=TRUE)
  expect_true(file.exists(paste(reportFolderPath,"pca_plus.html",sep="/")))
  unlink(reportFolderPath, recursive = TRUE)
})


test_that("check process type",{
  pd<-read.csv(multi_pdata_path, header = TRUE)
  result<-get_MajorMinor(pd[,c("ID","Group","Time")],"DNA")
  process_type<-get_process_type(result$major,result$minor, result$pd)
  expect_equal(process_type,"multi_duplicates")
  result<-get_MajorMinor(pd[,c("ID","Group")],"DNA")
   process_type<-get_process_type(result$major,result$minor, result$pd)
  expect_equal(process_type,"single_duplicates")
  result<-get_MajorMinor(pd,"DNA")
   process_type<-get_process_type(result$major,result$minor, result$pd)
  expect_equal(process_type,"multi_variates")
  result<-get_MajorMinor(pd[c(1,8,18),c("ID","Group","Time")],"DNA")
   process_type<-get_process_type(result$major,result$minor, result$pd)
  expect_equal(process_type,"multi_no_duplicates")
  result<-get_MajorMinor(pd[c(1,2),c("ID","Group")],"DNA")
   process_type<-get_process_type(result$major,result$minor, result$pd)
  expect_equal(process_type,"single_no_duplicates")
})


test_that("check multi output", {
  df=suppressWarnings(preprocess(multi_input_path,"targeted",c()))
  pd<-read.csv(multi_pdata_path, header = TRUE)
  twopd = pd[,c("ID","Group","Time")]
  twopd = twopd[twopd$Time!="0day",]
  preprocess<-preprocess_input(df,twopd)
  process_type<-get_process_type(preprocess$major,preprocess$minor, preprocess$pd)
  reportFolderPath="./multi_output/"
  dir.create(file.path(reportFolderPath), showWarnings = FALSE)
  major = preprocess$major
  minor = preprocess$minor
  labels = unique(twopd[,c(major)])
  run_analysis(process_type,preprocess$pd,preprocess$df,major,minor,reportFolderPath)
  expect_true(file.exists(paste(reportFolderPath,"pvals_ANOVA.csv",sep="")))
  expect_true(file.exists(paste(reportFolderPath,"pvals_v1_",major,".csv",sep="")))
  expect_true(file.exists(paste(reportFolderPath,"pvals_v1_",minor,".csv",sep="")))
  expect_true(file.exists(paste(reportFolderPath,"pvals_v2_",major,".csv",sep="")))
  expect_true(file.exists(paste(reportFolderPath,"pvals_v1_",minor,".csv",sep="")))
  expect_true(file.exists(paste(reportFolderPath,"deltaAUC_",labels[1],"_",labels[2],".csv",sep="")))
  expect_true(file.exists(paste(reportFolderPath,"deltaAUC_",labels[1],"_",labels[3],".csv",sep="")))
  expect_true(file.exists(paste(reportFolderPath,"deltaAUC_",labels[2],"_",labels[3],".csv",sep="")))
  unlink(reportFolderPath,recursive = TRUE)
})

test_that("check single output", {
  df=suppressWarnings(preprocess(multi_input_path,"targeted",c()))
  pd<-read.csv(multi_pdata_path, header = TRUE)
  preprocess<-preprocess_input(df,pd[,c("ID","Time")])
  process_type<-get_process_type(preprocess$major,preprocess$minor, preprocess$pd)
  reportFolderPath="./single_output/"
  dir.create(file.path(reportFolderPath), showWarnings = FALSE)
  major = preprocess$major
  minor = preprocess$minor
  run_analysis(process_type,preprocess$pd,preprocess$df,major,minor,reportFolderPath)
  expect_true(file.exists(paste(reportFolderPath,"pvals_v1_",major,".csv",sep="")))
  expect_true(file.exists(paste(reportFolderPath,"pvals_v2_",major,".csv",sep="")))
  expect_true(file.exists(paste(reportFolderPath,"deltaAUC.csv",sep="")))
  unlink(reportFolderPath,recursive = TRUE)
})


test_that("check single no duplicate output", {
  df=suppressWarnings(preprocess(multi_input_path,"targeted",c()))
  pd<-read.csv(multi_pdata_path, header = TRUE)
  preprocess<-preprocess_input(df,pd[c(1,2),c("ID","Group")])
  process_type<-get_process_type(preprocess$major,preprocess$minor, preprocess$pd)
  reportFolderPath="./single_no_dup_output/"
  dir.create(file.path(reportFolderPath), showWarnings = FALSE)
  major = preprocess$major
  minor = preprocess$minor
  run_analysis(process_type,preprocess$pd,preprocess$df,major,minor,reportFolderPath)
  expect_true(file.exists(paste(reportFolderPath,"foldchange.csv",sep="")))
  unlink(reportFolderPath,recursive = TRUE)
})

test_that("check multi covariates output", {
  df=suppressWarnings(preprocess(multi_input_path,"targeted",c()))
  pd<-read.csv(multi_pdata_path, header = TRUE)
  preprocess<-preprocess_input(df,pd)
  process_type<-get_process_type(preprocess$major,preprocess$minor, preprocess$pd)
  reportFolderPath="./multi_covariates_output/"
  dir.create(file.path(reportFolderPath), showWarnings = FALSE)
  major = preprocess$major
  minor = preprocess$minor
  run_analysis(process_type,preprocess$pd,preprocess$df,major,minor,reportFolderPath)
  expect_true(file.exists(paste(reportFolderPath,"pvals_multi_linear.csv",sep="")))
  unlink(reportFolderPath,recursive = TRUE)
})




test_that("check if duplicates", {
  pd<-read.csv(multi_pdata_path, header = TRUE)
  pd$check=seq(1,nrow(pd),by=1)
  duplicates<-check_duplicate(pd,"Group","Time")
  expect_equal(length(duplicates),3)
  duplicates<-check_duplicate(pd,"Group","check")
  expect_null(duplicates)
})

test_that("check report variables", {
  pd<-read.csv(multi_pdata_path, header = TRUE)
  #One covariate
  onepd<-pd[,c("ID","Treatment")]
  result<-checkVariables(onepd)
  expect_equal(result$major,"Treatment")
  expect_equal(result$minor,"NA")
  expect_equal(length(result$groups),1)
  expect_equal(result$multicat,FALSE)
  # # Two covariates
  twopd<-pd[,c("ID","Treatment","Time")]
  result<-checkVariables(twopd)
  expect_equal(result$major,"Treatment")
  expect_equal(result$minor,"Time")
  expect_equal(length(result$groups),2)
  expect_equal(result$multicat,FALSE)
  # #Three covariates
  result=checkVariables(pd)
  expect_equal(result$major,"Group")
  expect_equal(result$minor,"Time")
  expect_equal(length(result$groups),3)
  expect_equal(result$multicat,TRUE)

})


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

library(NGCHM)
library(MBatch)
library(MBatchUtils)
library(DescTools)
library(matrixStats)
library(data.table)
library(reshape)
library(stringr)

library(RColorBrewer)
library(dplyr)
library(tools)
library(tidyverse)

Sys.setenv("SHAIDYMAPGEN"='/NGCHM/shaidymapgen/ShaidyMapGen.jar')
Sys.setenv("NGCHMWIDGETPATH"='/NGCHM/standalone/ngchmWidget-min.js')


testSignificant<-function(res,covariate,data,covariates){
  fm1<-as.formula(paste(colnames(data)[1], "~", paste(covariates,collapse="+")))
  fm2<-as.formula(paste(colnames(data)[1], "~", paste(covariates[! covariates %in% c(covariate)],collapse="+")))
  m1<-lm(fm1,data=data)
  m2<-lm(fm2,data=data)
  pvalue<-anova(m2,m1)$Pr[2]
  newres<-res[names(res)[!sapply(names(res),function(x) grepl(covariate,x,fixed = TRUE))]]
  newres<-setNames(c(newres, pvalue), c(names(newres), covariate))
  return(newres)
}

# Run ANOVA for more than two covariates
# pd: pdata file
# df: data file
# Reference: https://advstats.psychstat.org/book/mregression/catpredictor.php

run_multi_variates<-function(pd,df){
    df<-df[,as.character(intersect(colnames(df),pd$ID))]
    pd<-subset(pd,ID %in% as.character(intersect(colnames(df),pd$ID)))
    df=df[rowSums(is.na(df)) != ncol(df), ]
    multiLinear<-data.frame(row.names=1:nrow(df))
    normCols=c("cellCount","DNA","TotalArea","tissueWeight","NAfreq")
    newpd<-pd[,!(colnames(pd) %in% normCols)]
    end=dim(newpd)[2]
    newnames=""
    for(x in 1:nrow(df)){
        data<-cbind(t(df[x,]),pd[,2:end])
        colnames(data)[1]<-"value"
        fm<-as.formula(paste(colnames(data)[1], "~", paste(colnames(data)[2:end],collapse="+")))
        res<-tail(summary(lm(fm, data = data))$coefficients[,4],-1)
        covariates=colnames(data)[2:end]
        for (covariate in covariates){
            if (length(unique(pd[,covariate]))>2){
            res<-testSignificant(res,covariate,data,covariates)
            }
        }
        multiLinear<-rbind(multiLinear,res)
        newnames=names(res)
    }
    multiLinear=sapply(multiLinear,function(x) p.adjust(x,method='BH'))
    multiLinear=as.data.frame(multiLinear)
    names(multiLinear)<-newnames
    rownames(multiLinear)<-rownames(df)
    return(multiLinear)
}

# Run major ANOVA
# pd: pdata file
# df: data file
# label: value in major covariate
# major: major covariate
# minor: minor covariate

run_major_anova<-function(pd,df,label, major, minor){
    log_debug(paste("Running major ANOVA for covariate value: '", label, "'", sep=""))
    pd_label<-pd[which(pd[[major]]==label),]
    m2_label<-df[,pd_label$ID, drop=FALSE]
    pval_label=c()
    for(x in 1:nrow(m2_label)){
        log_trace(paste("ANOVA for data '", rownames(m2_label)[x], "' and independent variable '", minor, "'", sep=""))
        res<-try(summary(aov(as.numeric(m2_label[x,]) ~ pd_label[[minor]]))[[1]][,5][1])
        if(inherits(res, "try-error")){
            pval_label<-c(pval_label,NA)
            next
        }
        pval_label<-c(pval_label,res)
    }
    adj.pval_label<-p.adjust(pval_label, method='BH')
    log_trace("Returning pval_label")
    log_list(pval_label)
    return(pval_label)
}

# Run two way ANOVA
# pd: pdata file
# df: data file
# major: major covariate
# minor: minor covariate

run_twoway<-function(pd,df,major,minor){
    labels=unique(pd[[major]])
    labels=labels[!is.na(labels)]
    pvals<-data.frame(row.names=1:nrow(df))
    for (label in labels){
        pval<-run_major_anova(pd,df,label,major,minor)
        pvals<-cbind(pvals,label=pval)
    }
    names(pvals)<-labels
    twoway<-data.frame(row.names=1:nrow(df))
    for(x in 1:nrow(df)){
        log_trace(paste("Two-way ANOVA for data '", rownames(df)[x], "' and variables '",
               major, "' and '", minor, "'", sep=""))
        res<-try(summary(aov(as.numeric(df[x,])~pd[[major]]*pd[[minor]]))[[1]][,5][1:3])
        if(inherits(res, "try-error")){
            twoway<-c(twoway,NA)
            next
        }
        twoway<-rbind(twoway,res)
    }
    names(twoway)<-c(major,minor,"Interaction")
    pvals<-cbind(pvals,twoway)
    rownames(pvals)<-rownames(df)
    pvals_2<-apply(pvals, 2, p.adjust, method='fdr')
    colnames(pvals_2)<-paste0('fdr_',colnames(pvals_2), sep='' )
    pvals_final<-cbind(pvals, pvals_2)
    log_trace("Returning pvals_final")
    return(pvals_final)
}



# Run ANOVA on each combination
run_anova<-function(pd,df,label,major,minor){
    pd_a<-pd[which(pd[[major]]==label),]
    m2_a<-df[, match(pd_a$ID, colnames(df)), drop=FALSE]
    df_a <- data.frame(diff=double(), lwr=double(), upr=double(), p.adj=double(), Metabolite=character(), stringsAsFactors=FALSE)
    for(i in 1:nrow(m2_a)){
        res<-try(temp<-data.frame(cbind(TukeyHSD(aov(as.numeric(m2_a[i,]) ~ as.factor(pd_a[[minor]])))$`as.factor(pd_a[[minor]])`,'Metabolite' = as.character(rownames(m2_a)[i]))))
        if(inherits(res, "try-error")){
            df_a<-rbind(df_a, data.frame( diff=NA,lwr=NA,upr=NA,p.adj=NA,'Metabolite' = as.character(rownames(m2_a)[i])))
            next
        }
        rownames(res)<-paste(rownames(res),i,sep=":")
        df_a<-rbind(df_a, res)
    }
    df_a$p.adj <- as.numeric(df_a$p.adj) # this quantity is an argument to is.na() in `run_analysis()`.
    return(df_a)
}


# pd: pdata file
# df: data file
# major: major covariate
# minor: minor covariate

run_all_anova<-function(pd,df,major,minor){
    # Take overlap between pd$ID and colnames of df
    df<-df[,as.character(intersect(colnames(df),pd$ID))]
    pd<-subset(pd,ID %in% as.character(intersect(colnames(df),pd$ID)))
    labels=unique(pd[[major]])
    df_com1<-data.frame()
    for (label in labels){
        df_p3<-run_anova(pd,df,label,major,minor)
        df_p3[[major]]<-label
        df_com1<-rbind(df_com1,df_p3)
    }
    return(df_com1)
}


# pd: pdata file
# df: data file
# major: major covariate
# Returns NULL if test cannot be run

run_multi_tests<-function(pd,df,major){
    majorlabels = unique(pd[[major]])
    if (length(majorlabels) < 2) { # cannot run test, need at least 2 unique values of major covariate entries
      return(NULL)
    }
    df_a <- data.frame( p.adj=double(), Metabolite=character(), FactorGroup=character())
    size1=length(majorlabels)-1
    size2=length(majorlabels)
    for (i in 1:size1){
        subsize=i+1
        for (j in subsize:size2){
            pd_a<-pd[which(pd[[major]] %in% c(majorlabels[i],majorlabels[j])),]
            m2_a<-df[, match(pd_a$ID, colnames(df)), drop=FALSE]
            ## get number of times majorlabels[i] and majorlabels[j] appear in pd_a
            major_count_i <- sum(pd_a[[major]] == majorlabels[i])
            major_count_j <- sum(pd_a[[major]] == majorlabels[j])
            if (major_count_i < 2) {
              log_warn(paste("Skipping ttest for ", majorlabels[i], " and ", majorlabels[j], " because ", majorlabels[i], " has only ", major_count_i, " entries"))
              next
            }
            if (major_count_j < 2) {
              log_warn(paste("Skipping ttest for ", majorlabels[i], " and ", majorlabels[j], " because ", majorlabels[j], " has only ", major_count_j, " entries"))
              next
            }
            df_b<-run_ttest(pd_a,m2_a,major)
            df_a<-rbind(df_a, df_b)
        }
    }
    return(df_a)
}

# Simple ttest
# pd: pdata file
# df: data file
# major: major covariate

run_ttest<-function(pd,df,major){
    log_debug(paste("run_ttest with major = ", major))
    majorlabels = unique(pd[[major]])
    pd_a<-pd[which(pd[[major]]==majorlabels[1]),]
    pd_b<-pd[which(pd[[major]]==majorlabels[2]),]
    m2_a<-df[, match(pd_a$ID, colnames(df)), drop=FALSE]
    m2_b<-df[, match(pd_b$ID, colnames(df)), drop=FALSE]
    df_a <- data.frame( p.adj=double(), Metabolite=character(), FactorGroup=character())
    rownames=c()
    log_trace("Starting loop")
    for(i in 1:nrow(df)){
        pvalue<-t.test(m2_a[i,,drop=FALSE],m2_b[i,,drop=FALSE])$p.value
        res<-data.frame("p.adj"=pvalue, 'Metabolite' = as.character(rownames(df)[i]),'FactorGroup'=paste(majorlabels[1],majorlabels[2],sep="-"))
        df_a<-rbind(df_a, res)
        rownames<-c(rownames,paste(majorlabels[1],majorlabels[2],i,sep="-"))
    }
    rownames(df_a)=rownames
    return(df_a)
}



# Get False Discover Rate
# df_com: anova result

get_FDR<-function(df_com){
    df_com4<- df_com %>%
        gather(key, value, -Metabolite, -FactorGroup) %>%
        unite(new.col, c(key, FactorGroup)) %>%
        spread(new.col, value)

    rownames(df_com4)<-df_com4$Metabolite
    df_com4<-subset(df_com4,select = -Metabolite)

    colindex<-grep('p.adj', colnames(df_com4))

    FDRs<-sapply(colindex, function(x) p.adjust(df_com4[,x], method='fdr'))
    colnames(FDRs)<-colnames(df_com4)[colindex]
    colnames(FDRs)<-sub('p.adj','fdr', colnames(FDRs))
    df_com4<-cbind(df_com4, FDRs)

    groupsP<-str_split_fixed(colnames(df_com4),'_',n=2)[,2]
    df_com4<-df_com4[,order(groupsP)]
    return(df_com4)
}


deltaAUC <- function(x1, y1, x2, y2){
  firstAUC = AUC(x1, y1, method = "spline")
  secondAUC = AUC(x2, y2, method = "spline")
  if( is.na(firstAUC) || is.na(secondAUC) ){
     return(NA)
  }
  delta = secondAUC - firstAUC
  if( firstAUC != 0 ) {
     percDeltaAUC = delta / firstAUC
  } else {
     # A result can’t be computed here but because we are only interested in high deltas, this result will be filtered out down the line
     percDeltaAUC = 0
  }
  return ( c(delta, percDeltaAUC) )
}


signDeltaAUC <- function(x1, y1, x2, y2, overlapOnly = T, numBins = 1000){

    # set range of x-values based on using overlapping x-values only or full range
   if (length(x1)!=length(x2)){
        if (length(x1)-length(x2)==-1){
            x1=x2
            y1=as.data.frame(c(y2[1],y1))
        }else if (length(x1)-length(x2)==1){
            x2=x1
            y2=as.data.frame(c(y1[1],y2))
        }
   }

   # Deal with the bug when there are too few samples
   if (length(x1)==3){
       x1=c(1,2,3,4,5)
       x2=c(1,2,3,4,5)
       y1=c(y1[1],(y1[1]+y1[2])/2,y1[2],(y1[2]+y1[3])/2,y1[3])
       y2=c(y2[1],(y2[1]+y2[2])/2,y2[2],(y2[2]+y2[3])/2,y2[3])
   }

    if (length(x1)==2){
       x1=c(1,2,3,4,5)
       x2=c(1,2,3,4,5)
       y1=c(y1[1],(y1[1]+(y1[1]+y1[2])/2)/2,(y1[1]+y1[2])/2,(y1[2]+(y1[1]+y1[2])/2)/2,y1[2])
       y2=c(y2[1],(y2[1]+(y2[1]+y2[2])/2)/2,(y2[1]+y2[2])/2,(y2[2]+(y2[1]+y2[2])/2)/2,y2[2])
   }

  if(overlapOnly){
    minx = max(x1[1], x2[1])
    maxx = min(x1[length(x1)], x2[length(x2)])

    if(minx >= maxx){
      # no overlap found
      return(NA)
    }

  }else{
    minx = min(x1[1], x2[1])
    maxx = max(x1[length(x1)], x2[length(x2)])
  }

  # get sequence of x-values to use
  xvalues = seq(minx, maxx, length = numBins)

  # fit spline models
  spmodel1 = smooth.spline(x1, y1)
  spmodel2 = smooth.spline(x2, y2)

  # apply models to range of x-values
  fitVals1 = predict(spmodel1, xvalues)
  fitVals2 = predict(spmodel2, xvalues)

  # compute overall AUCs for both series
  # will be slightly different from spline method
  firstAUC = AUC(fitVals1$x, fitVals1$y, method = "trapezoid")
  secondAUC = AUC(fitVals2$x, fitVals2$y, method = "trapezoid")

  # compute overall delta AUC and percentage delta AUC
  delta = secondAUC - firstAUC

  if( firstAUC != 0 ) {
    percDeltaAUC = delta / firstAUC * 100
  } else {
    # A result can't be computed here but because we are only interested in high deltas, this result will be filtered out down the line
    percDeltaAUC = 0
  }

  # compute signed delta AUCs
  posAUC = 0
  negAUC = 0
  pos = T
  xstart = 1
  for(ii in 1:numBins){

    # compute positive and negative areas

    if(fitVals1$y[ii] < fitVals2$y[ii] && pos){

      # cross-over occurred. Compute positive area
      val1 =AUC(xvalues[xstart:ii], fitVals1$y[xstart:ii], method = "trapezoid")
      val2 =AUC(xvalues[xstart:ii], fitVals2$y[xstart:ii], method = "trapezoid")
      if (is.na(val1)){
          val1=0
      }
      if(is.na(val2)){
          val2=0
      }
      posAUC = posAUC + val1 - val2
      pos = F
      xstart = ii
    } else if(fitVals1$y[ii] >= fitVals2$y[ii] && !pos){

      # cross-over occurred. Compute negative area
      val1 =AUC(xvalues[xstart:ii], fitVals1$y[xstart:ii], method = "trapezoid")
      val2 =AUC(xvalues[xstart:ii], fitVals2$y[xstart:ii], method = "trapezoid")
      if (is.na(val1)){
          val1=0
      }
      if(is.na(val2)){
          val2=0
      }

      negAUC = negAUC - val1 + val2
      pos = T
      xstart = ii

    } else if(ii == numBins){
      val1 =AUC(xvalues[xstart:ii], fitVals1$y[xstart:ii], method = "trapezoid")
      val2 =AUC(xvalues[xstart:ii], fitVals2$y[xstart:ii], method = "trapezoid")
      if (is.na(val1)){
          val1=0
      }
      if(is.na(val2)){
          val2=0
      }

      # process last point
      diff = val1 - val2

      if(pos){
        posAUC = posAUC + diff
      }else{
        negAUC = negAUC - diff
      }

    }

  }
  # compute percentage of positive delta AUC over total signed delta AUC

  totalAUC = posAUC + negAUC
  propAUC = 0

  if(totalAUC > 0){
    propAUC = posAUC / totalAUC * 100
  }

  return (c(delta, percDeltaAUC, posAUC, negAUC, propAUC, firstAUC, secondAUC))
}


splineFit <- function(x, y, numPoints = 1000){

  # fit spline
  spmodel = smooth.spline(x, y)

  # generate "numPoints" values for x-axis between min x and max x
  xvalues = seq(x[1], x[length(x)], length = numPoints)

  # predict yvalues using the spline model
  splineVals = predict(spmodel, xvalues)

  return (splineVals)

}

#Calculate DeltaAUC
# pd: pdata file
# df: data file
# major: major covariate
# minor: minor covariate

run_deltaAUC <- function (pd,df,major,minor){
    df<-as.data.frame(df)
    pd<-as.data.frame(pd)
    labels=unique(pd[[major]])
    pd_a<-pd[which(pd[[major]]==labels[1]),]
    df_a<-df[, match(pd_a$ID, colnames(df)), drop=FALSE]
    pd_b<-pd[which(pd[[major]]==labels[2]),]
    df_b<-df[, match(pd_b$ID, colnames(df)), drop=FALSE]
    if (!is.data.frame(df_a)||!is.data.frame(df_b)){
        log_error("Cannot run deltaAUC")
        stop(" Can't run deltaAUC")
    }
    x1<-c(1:dim(df_a)[2])
    x2<-c(1:dim(df_b)[2])
    df_com1<-data.frame()
    for(i in 1:nrow(df)){
        y1<-df_a[i,]
        y2<-df_b[i,]
        if (length(y2 %>% select(where(function(x) any(!is.na(x)))))!=0 && length(y1 %>% select(where(function(x) any(!is.na(x)))))!=0 ){
            result <- signDeltaAUC(x1,y1,x2,y2)
            # result <- deltaAUC(x1,y1,x2,y2)
        }else{
            # result <- c(NaN,NaN)
            result <- c(NaN,NaN,NaN,NaN,NaN,NaN,NaN)
        }
        df_com1<-rbind(df_com1,result)
    }
    rownames(df_com1)<-rownames(df)
    # colnames(df_com1)<-c("DeltaAUC","percentDeltaAUC")
    colnames(df_com1)<-c("DeltaAUC","percentDeltaAUC", "posAUC", "negAUC", "propAUC", "firstAUC", "secondAUC")
    return (df_com1)
}


gg_color_hue <- function(n) {
        hues = seq(15, 375, length = n + 1)
        hcl(h = hues, l = 65, c = 100)[1:n]
}


# Generate covariate for NGCHM
# pd: pdata file
# covar: covariate
# coul: covariate color
generate_covar<-function(pd,covar,coul){
    cov_group<-as.character(pd[,covar])
    groups<-unique(cov_group)
    names(cov_group)<-pd$ID
    colcmap1 <- chmNewColorMap(groups,colors = gg_color_hue(length(groups)),missing.color="white")
    # colcmap1 <- chmNewColorMap(groups,colors = colorRampPalette(coul)(length(groups)),missing.color="white")
    colcovar1 <- chmNewCovariate(covar,values=cov_group,value.properties=colcmap1,type="discrete")
    return(colcovar1)
}


#Generate NGCHM
# pd: pdata file
# df: data file
# reportFolderPath
# covariates: covariates
# major: major covariate
# minor: secondary covariate
# clustering: if clustering is needed

generate_NGCHM_clustering<-function(pd,df,reportFolderPath,title, covariates, major,minor, clustering){
    if (clustering =="false"){
        if (major!="NA" && minor !="NA"){
            pd<-pd[order(pd[major],pd[minor]),]
            # if (grepl( "Time", major, fixed = TRUE)){
            #     pd<-pd[order(pd[major],pd[minor]),]
            # }else if(grepl( "Time", minor, fixed = TRUE)){
            #     pd<-pd[order(pd[minor],pd[minor]),]
            # }
        }else if (major!="NA" && minor=="NA"){
            pd <- pd[order(pd[[major]]), ]
        }
        df<-df[,pd$ID]

        # Get the number of unique values for the covar used for supervised clustering
        pd_major_unique<-unique(pd[major])
        numGaps<-nrow(pd_major_unique)
    }

    rownames(df)<-toTitleCase(rownames(df))
    df<-as.matrix(df)

    # Get a bidirectional median centered version of the data for a second layer
    colMeds_centered=sweep(df,2,colMedians(df,na.rm = T))   #column
    rowMeds_centered=sweep(colMeds_centered,1,rowMedians(colMeds_centered,na.rm = T))   #row
    df_medcentered=rowMeds_centered
    df_medcentered=df_medcentered[rowSums(is.na(df_medcentered)) != ncol(df_medcentered), ]
    df_medcentered[is.na(df_medcentered)] = 0
    df[is.na(df)] = 0
    # Classic palette BuPu, with 4 colors
    coul <- brewer.pal(4, "PuOr")
    # Add more colors to this palette :
    nc <- colorRampPalette(coul)(22)
    set.seed(7284)
    # Create a layer not median centered
    rwbmap <- chmNewColorMap(df,colors = c('blue','white','red'),
                                missing.color = "gray70")
    layer1_notCentered <- chmNewDataLayer ("Non-Centered",df,rwbmap, cuts_color = "#a6a6a6")
    # Create another layer median centered
    rwbmap_medcentered <- chmNewColorMap(df_medcentered,colors = c('blue','white','red'),
                                missing.color = "gray70")
    layer2_medcentered <- chmNewDataLayer ("Median Centered",df_medcentered,rwbmap_medcentered, cuts_color = "#a6a6a6")
    nrow = nrow(df)
    ncol = ncol(df)
    # Save unmodified pd and df
    pd_original<-pd
    df_original<-df
    # Store data for supervised clustering in format required by MBatch
    colnames(pd)[1]<-'Sample'
    cols<-c("Sample")
    cols<-append(cols,covariates)
    pd<-pd[,cols]
    metaBatchFolder=paste(reportFolderPath,'/metabatch_ngchms/',sep="")
    outputPath<-paste(reportFolderPath,'/ngchms/',sep="")
    unlink(metaBatchFolder, recursive=TRUE)
    unlink(outputPath, recursive=TRUE)
    dir.create(metaBatchFolder, showWarnings = FALSE)
    dir.create(outputPath,showWarnings = FALSE)
    BEdataPath<-paste(metaBatchFolder,'Preprocessed_3_noNA_ISnormalized_2.tsv',sep="")
    BEbatchPath<-paste(metaBatchFolder,'BatchData.tsv',sep="")
    df[is.na(df)] = 0
    write.table(df, BEdataPath, sep='\t',quote=F,row.names = T, col.names = NA)
    log_debug(paste("Wrote df to BEdataPath:", BEdataPath, sep=" "))
    write.table(pd, BEbatchPath, sep='\t',quote=F,row.names = FALSE)
    log_debug(paste("Wrote pd to BEbatchPath:", BEbatchPath, sep=" "))
    mData_pre<-mbatchLoadFiles(BEdataPath,BEbatchPath)
    # Generate dendrograms with supervised clustering by each covariate
    SupervisedClustering_Batches_Structures(theData=mData_pre, theTitle=title, theOutputPath=outputPath)
    ## If Batch Effects Package produces an error log, print error message
    if (file.exists(paste(outputPath,'/Batches/error.log',sep=""))){
      errorFile<-paste(outputPath,'/Batches/error.log',sep="")
      errorText<-readLines(errorFile)
      log_error(paste("Error from Batch Effects Package:", errorText, sep=" "))
    }
    # Generate ngchm
    if (clustering=="true" && nrow>2 && ncol>2) {
        colclust <- hclust(as.dist(1-cor(df_medcentered,use="pairwise.complete.obs")),method="ward.D2")
        rowclust <- hclust(as.dist(1-cor(t(df_medcentered),use="pairwise.complete.obs")),method="ward.D2")
        chm <- chmNew(title,layer2_medcentered,colOrder = as.dendrogram(colclust), rowOrder = as.dendrogram(rowclust))
    }else if(ncol>2){
        loadPath<-paste(outputPath,'/Batches/',major,'_uDend.RData',sep="")
        load(loadPath)
        rowclust <- hclust(as.dist(1-cor(t(df_medcentered),use="pairwise.complete.obs")),method="ward.D2")
        chm <- chmNew(title,layer2_medcentered,colGapLocations = chmTreeGaps(numGaps), colGapWidth = 1, colOrder = uDend, rowOrder = as.dendrogram(rowclust))
    }else{
        chm <- chmNew(title,layer2_medcentered,colOrder = colnames(df_medcentered), rowOrder = rownames(df_medcentered))
    }
    for (covariate in covariates){
        colcovar1<-generate_covar(pd_original,covariate,coul)
        chm <- chmAddCovariateBar(chm,'column',colcovar1, thickness=as.integer(20))
    }
    log_trace("Added covars")
    chm <- chmAddLayer(chm, layer1_notCentered)
    chmExportToHTML(chm, paste(reportFolderPath, title,".html",sep=""), overwrite = TRUE)
}

#Generate PCA plus plot
# pd: pdata file
# df: data file
# reportFolderPath
# covariates: covariates
# type: if batch factor or not, if batch factor PCA output in another folder

generate_PCA_plus<-function(pd,df,reportFolderPath, covariates, type){
    log_debug(paste("type:", type, sep=" "))
    colnames(pd)[1]<-'Sample'
    cols<-c("Sample")
    cols<-append(cols,covariates)
    pd<-pd[,cols]
    if (type == "batches") {
        metaBatchFolder=paste(reportFolderPath,'/metabatch_batches/',sep="")
        outputPath<-paste(reportFolderPath,'/PCA_batches/',sep="")
        unlink(metaBatchFolder, recursive=TRUE)
        unlink(outputPath, recursive=TRUE)
        output_file_name="pca_plus_batch.html"
    } else{
        metaBatchFolder=paste(reportFolderPath,'/metabatch/',sep="")
        outputPath<-paste(reportFolderPath,'/PCA/',sep="")
        unlink(metaBatchFolder, recursive=TRUE)
        unlink(outputPath, recursive=TRUE)
    }
    log_trace(paste("Creating metaBatchFolder:", metaBatchFolder, sep=" "))
    dir.create(metaBatchFolder, showWarnings = FALSE)
    log_trace(paste("Creating outputPath:", outputPath, sep=" "))
    dir.create(outputPath,showWarnings = FALSE)
    BEdataPath<-paste(metaBatchFolder,'Preprocessed_3_noNA_ISnormalized_2.tsv',sep="")
    BEbatchPath<-paste(metaBatchFolder,'BatchData.tsv',sep="")
    df[is.na(df)] = 0
    write.table(df, BEdataPath, sep='\t',quote=F,row.names = T, col.names = NA)
    log_debug(paste("Wrote df to BEdataPath:", BEdataPath, sep=" "))
    write.table(pd, BEbatchPath, sep='\t',quote=F,row.names = FALSE)
    log_debug(paste("Wrote pd to BEbatchPath:", BEbatchPath, sep=" "))
    mData_pre<-mbatchLoadFiles(BEdataPath,BEbatchPath)
    PCA_Regular_Structures(mData_pre, 'PCA-plus clustering',  theBatchTypeAndValuePairsToKeep = NULL, theBatchTypeAndValuePairsToRemove = NULL, theOutputPath = outputPath)
}


get_version_number<-function(metadata){
    metadata["NGCHMVIEWERVERSION"] = Sys.getenv("NGCHMVIEWERVERSION")
    metadata["NGCHMRVERSION"] = as.character(packageVersion("NGCHM"))
    metadata["MBATCHVERSION"] = as.character(packageVersion("MBatch"))
    metadata["MBATCHUTILSVERSION"] = as.character(packageVersion("MBatchUtils"))
    metadata["TEMPLATEVERSION"] = Sys.getenv("TEMPLATEVERSION")
    return(metadata)
}

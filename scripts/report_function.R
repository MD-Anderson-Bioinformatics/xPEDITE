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


generate_dataTable<-function(df){
    df_o<-formatC(as.matrix(df), format = "e", digits = 2)
    if ('metabolite' %in% colnames(df_o)){
        df_o <- df_o[,!colnames(df_o) %in% c("metabolite")]
    }
    if ('Primary Pathway' %in% colnames(df_o)){
        # Reorder primary pathway to the front
        colnames <- colnames(df_o)
        colnames <- colnames[!colnames %in% c("Primary Pathway")]
        colnames <- c("Primary Pathway",colnames)
        df_o <- df_o[, colnames]
        # Sort by primary pathway by default
        datatable(df_o, extensions = 'Buttons', options = list(
            order = c('1', 'desc'),
            dom = 'Bfrtip',
            buttons = c('copy', 'csv', 'excel'),
            scrollX = TRUE,
            scrollCollapse = TRUE)
        )
    } else{
        datatable(df_o, extensions = 'Buttons', options = list(
            dom = 'Bfrtip',
            buttons = c('copy', 'csv', 'excel'),
            scrollX = TRUE,
            scrollCollapse = TRUE)
        )
    } 
}

generate_deltaAUCtable<-function(df){
    df_o<-formatC(as.matrix(df))
    df_o <- df_o[,!colnames(df_o) %in% c("metabolite")]
    datatable(df_o, extensions = 'Buttons', options = list(
        dom = 'Bfrtip',
        buttons = c('copy', 'csv', 'excel'),
        scrollX = TRUE,
        scrollCollapse = TRUE,
        order = list(list(5, 'desc')))
    ) %>% formatPercentage(c("percentDeltaAUC"), 2)
}

generate_p1_boxplot<-function(m1,major,variable,value,textsize,xlabel,ylabel){
    gg1<-ggplot(m1, aes_string(x=variable, y=value)) +
    geom_boxplot(aes(fill=factor(!!major), color=factor(!!major)), outlier.size = 0.5,alpha=0.4)+
    xlab(xlabel)+ylab(ylabel)+
    theme_bw()+theme(axis.text.x = element_text(angle=90, size=textsize,color = 'black'),
                            axis.text.y = element_text( size=8, color = 'black'),
                            axis.title.x = element_text(size=10, face='bold'),
                            axis.title.y = element_text( size=10, face='bold'),
                            legend.text = element_text(size = 10, face = "bold"),
                    legend.title = element_blank(),
                            legend.key.size = unit(0.5, "cm"))

    gg2<-gg1 %>%
    ggplotly(width=1000, height=600) %>% add_annotations( text="<b> Group </b>", xref="paper", yref="paper",
                    x=1.02, xanchor="left",
                    y=0.8, yanchor="bottom",    # Same y as legend below
                    legendtitle=TRUE, showarrow=FALSE ) %>%
    layout( legend=list(y=0.8, yanchor="top" ) ) %>% config( displaylogo = FALSE,
        toImageButtonOptions = list(
        format = "svg",
        filename = 'Data distribution',
        res=300,
        width=1000, height=600)
    ) %>% partial_bundle(type = "cartesian")

    for (i in 1:length(unique(m1[[major]]))){
        gg2$x$data[[i]]$marker=list(fill = 'black')
    }
    log_debug(paste("Inserting box plot for major: ", major, ", variable: ", variable, ", value: ", value, sep=""))
    gg2
}

generate_p1_barPlot<-function(pd,major,ID,variable){
    gg1<-ggplot(pd, aes_string(x=ID, y=variable)) +
    geom_bar(aes(fill=factor(!!major), color=factor(!!major)),stat = 'identity',alpha=0.6)+
    xlab('Samples')+ylab(variable)+
    theme_bw()+theme(axis.text.x = element_text(angle=90, size=8,color = 'black'),
                            axis.text.y = element_text( size=10, color = 'black'),
                            axis.title.x = element_text(size=10, face='bold'),
                            axis.title.y = element_text( size=10, face='bold'),
                            legend.text = element_text(size = 10, face = "bold"),
                    plot.margin = margin(20, 10, 10, 20),
                            legend.title = element_blank())

    gg2<-gg1 %>%
    ggplotly(width=1000, height=600 ) %>% add_annotations( text="<b> Group </b>", xref="paper", yref="paper",
                    x=1.02, xanchor="left",
                    y=0.8, yanchor="bottom",    # Same y as legend below
                    legendtitle=TRUE, showarrow=FALSE ) %>%
    layout( legend=list(y=0.8, yanchor="top" ) ) %>% config(displaylogo = FALSE,
        toImageButtonOptions = list(
        format = "svg",
        filename = 'Data distribution',
        res=300,
        width=1000, height=600)
    ) %>% partial_bundle(type = "cartesian")
    log_debug(paste("Inserting bar plot for major: ", major, ", ID: ", ID, ", variable: ", variable, sep=""))
    gg2

}

generate_anova_multiclass_plot<-function(pvals, manual_run=NULL){
    pvals[[1]]<-toTitleCase(pvals[[1]])
    df<-reshape2::melt(pvals,id.vars = 1)
    df<-df[which(df$value<0.05),]
    df$Pvalue<-df$value
    df$value<-(-log(df$value,10))
    colnames(df)<-c('Metabolite', 'Treatment', 'log10P', 'P.value')
    title = sprintf("%s compounds", length(unique(df$Metabolite)))
    mypalette <- rev(rev(brewer.pal(8, "YlOrRd"))[1:4])
    g<-ggplot() +
    geom_point( aes(x = Treatment, y = Metabolite, color=log10P,P.value=P.value),data=df, size=3, alpha=0.8)+
    theme_bw() +
    xlab("") +  ylab("") +  coord_cartesian(clip = 'off') +
    scale_color_gradientn(name = "-log10 (P.value)", colors = mypalette) +
    scale_size('-log10 (P.value)')+
    ggtitle(title) +
    theme(plot.title = element_text(hjust=0.5,face = "bold"),
                panel.border=element_blank(),
                legend.position="bottom",
                axis.line = element_line(colour = "black"),
                axis.text.x = element_text(angle=90, size=10,color = 'black'),
                axis.text.y = element_text( size=6, angle=45,color = 'black'),
                axis.title.x = element_text(size=10, face='bold'),
                axis.title.y = element_text( size=10, face='bold'),
                legend.text = element_text(size = 10, face = "bold"),
                legend.title = element_text(face = "bold",hjust = 0.5, size=12))
    if (is.null(manual_run)) { ## normal code in pipeline run
      log_debug(paste("Inserting ANOVA multiclass plot. title: '", title, "'", sep=""))
      g %>%
      ggplotly(width=900, height=900, tooltip=c('Metabolite', 'Treatment', 'log10P', 'P.value')) %>% config(
        toImageButtonOptions = list(
        format = "svg",
        filename = 'Pvalues_groups_ICMS.svg',
        res=300,
        width = 800,
        height = 1000)
      ) %>% partial_bundle(type = "cartesian")
    } else { # developer run/test of single function
      log_debug(paste("Developer testing of ANOVA multiclass plot. title: '", title, "'", sep=""))
      pdf("anova_multiclass_plot.pdf")
      print(g)
      dev.off()
    }
}

generate_anova_pairwise_plot<-function(pvals){
    pvals$Metabolite<-toTitleCase(pvals$Metabolite)
    df<-pvals[which(pvals$p.adj<0.05),]
    df$log10P<-(-log(df$p.adj,10))
    mypalette <- rev(rev(brewer.pal(8, "YlOrRd"))[1:4])
    df$Treatment<-df$FactorGroup
    title =  sprintf("Pairwise groups comparison: %s compounds", length(unique(df$Metabolite)))
    g2<-ggplot() +
    geom_point( aes(x = Treatment, y = Metabolite, color=log10P, diff=diff, lwr=lwr, upr=upr, p.adj=p.adj),data=df, alpha=0.8, size=3)+
    theme_bw() + xlab("") +  ylab("") +  coord_cartesian(clip = 'off') +
    scale_color_gradientn(name = "-log10 (P.value)", colors = mypalette) +scale_size('-log10 (P.value)')+
            ggtitle(title) +
            theme(plot.title = element_text(hjust=0.5,face = "bold"),
                panel.border=element_blank(),
                legend.position="bottom",
                axis.line = element_line(colour = "black"),
                axis.text.x = element_text(angle=90, size=8,color = 'black'),
                axis.text.y = element_text( size=8, angle=45,color = 'black'),
                axis.title.x = element_text(size=10, face='bold'),
                axis.title.y = element_text( size=10, face='bold'),
                legend.text = element_text(size = 10, face = "bold"),
                legend.title = element_text(face = "bold",hjust = 0.5, size=12))


    g2 %>%
    ggplotly(width=900, height=900, tooltip=c('Treatment', 'Metabolite','log10P', 'diff', 'lwr', 'upr','p.adj')) %>% config(
        toImageButtonOptions = list(
        format = "svg",
        filename = 'Pvalues_groups2_AA.svg',
        res=300,
        width = 800,
        height = 1000)
    ) %>% partial_bundle(type = "cartesian")
}


#' Convert a Data Frame to JavaScript Variable
#'
#' This function converts a data frame in R to a JavaScript variable and returns it as an HTML script tag
#' in order to make the data available in the HTML report.
#'
#' @param x A data frame to be converted to a JavaScript variable.
#' @param var_name A character string specifying the name of the JavaScript variable. Default is "data".
#' @param ... Additional arguments passed to `jsonlite::toJSON`.
#' @return An HTML script tag containing the JavaScript variable definition.
#' @examples
#' # Example usage:
#' df <- data.frame(a = 1:3, b = c("x", "y", "z"))
#' df_to_js(df, "myData")
df_to_js <- function(x, var_name = "data", ...){
  json_data <- jsonlite::toJSON(x, digits=7, ...)
  htmltools::tags$script(paste0("var ",var_name," = ", json_data, ";"))
}

#' Convert a Boolean to JavaScript Variable
#'
#' This function converts a boolean value in R to a JavaScript variable and returns it as an HTML script tag
#' in order to make the data available in the HTML report.
#'
#' @param x A logical vector (boolean) to be converted to a JavaScript variable.
#' @param var_name A character string specifying the name of the JavaScript variable.
#' @return An HTML script tag containing the JavaScript variable definition.
#' @examples
#' # Example usage:
#' bool_to_js(TRUE, "isTrue")
#' bool_to_js(FALSE, "isFalse")
bool_to_js <- function(x, var_name) {
  if (!is.logical(x)) {
    stop("First argument of bool_to_js must be a logical vector")
  }
  htmltools::tags$script(paste0("var ", var_name, " = ", tolower(as.character(x)), ";"))
}

# Process pdata file to determine major covariate, minor covariate, if there are duplicates, if there are more than two covariates
checkVariables<-function(pd){
  log_trace_dataframe(pd)
  single=TRUE
  multicat=FALSE
  normCols=c("cellCount","DNA","TotalArea","tissueWeight","NAfreq")
  newpd<-pd[,!(colnames(pd) %in% normCols)]
  if (dim(newpd)[2]>3){
        multicat=TRUE
        groups=tail(colnames(newpd))[-1]
        major=groups[1]
        minor=groups[2]
        if (grepl("Time",major) || grepl("time",major)){
            major = groups[2]
            minor = groups[1]
        }
        single=FALSE
  }else if (dim(newpd)[2]==3){
        groups<-colnames(newpd)[2:3]
        major=groups[1]
        minor=groups[2]
        if (grepl("Time",major) || grepl("time",major)){
            major = groups[2]
            minor = groups[1]
        }
        groups = c(major,minor)
        # note: backticks are used here to handle column names with spaces (e.g. 'sample 1', 'sample 2')
        pdtable=dcast(newpd[,2:3],as.formula(paste("`", major,"`~`",minor, "`",sep='')),value.var = minor, fun.aggregate = length)
        rownames(pdtable)=as.vector(t(pdtable[major]))
        pdtable=pdtable[-which(colnames(pdtable)==major)]
        single=all(pdtable<=1)
  }else if (dim(newpd)[2]==2){

        major=colnames(newpd)[2]
        minor="NA"
        if (length(unique(newpd[[major]]))!=length(newpd[[major]])){
            single=FALSE
        }
        groups=colnames(newpd)[2]
  }
  for (col in colnames(pd)){
      if (col %in% normCols ){
          newpd<-cbind(newpd,pd[col])
      }
  }
  log_list(major)
  log_list(minor)
  log_trace(single)
  log_list(groups)
  log_trace(multicat)
  return(list(major=major,minor=minor,single=single,groups=groups,multicat=multicat))
}

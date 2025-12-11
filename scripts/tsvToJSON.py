import csv
import json
import base64
import os
import sys
import re
import shutil

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

'''
This script is used for embeding PCAplus plot into HTML file.
folder = ReportFolder Path
covariates = covariates
output_file_name = output html file name
'''

def generate_ascii(covariate):
    '''
        Generate base64 of the image
    '''
    logme("Generating ascii for " + str(covariate))
    batchFile = folder + "/metabatch/BatchData.tsv"
    pcaAnnoFile = folder + "/PCA/" + covariate + "/ManyToMany/PCAAnnotations.tsv"
    pcaValueFile = folder + "/PCA/" + covariate + "/ManyToMany/PCAValues.tsv"
    if covariate.startswith("batch_"):
        batchFile = folder + "/metabatch_batches/BatchData.tsv"
        pcaAnnoFile = folder + "/PCA_batches/" + covariate + "/ManyToMany/PCAAnnotations.tsv"
        pcaValueFile = folder + "/PCA_batches/" + covariate + "/ManyToMany/PCAValues.tsv"
    alldata = {}
    for inputFile in [batchFile, pcaAnnoFile, pcaValueFile]:
        key = inputFile.split("/")[-1].replace(".tsv", "")
        with open(inputFile) as file:
            reader = csv.DictReader(file, delimiter="\t")
            data = list(reader)
            alldata[key] = data
    outputJSON = json.dumps({"data": alldata})
    message_bytes = outputJSON.encode('ascii')
    base64_bytes = base64.b64encode(message_bytes)
    message = base64_bytes.decode('ascii')
    # outputFile = open(folder + "/PCA/" + covariate + "/allPCA.json", "w")
    # outputFile.write(json.dumps(outputJSON))
    # outputFile.close()
    logme("Ascii generated for " + str(covariate))
    return message

def logme(message):
  if len(sys.argv) > 4:
    logfile = sys.argv[4]
    with open(logfile, 'a', encoding='utf-8') as lf:
      lf.write("[tsvToJSON.py log] " + message + "\n")
  return

folder = sys.argv[1]
covariates = sys.argv[2].split(",")
output_file_name=sys.argv[3]
if "batch" in output_file_name:
  pca_type = "batch"
else:
  pca_type = "group"
logme("Writing tsvToJSON output to: " + output_file_name)

# shutil.copyfile("/app/scripts/pca-plot-all.js",folder+"/pca-plot-all.js")
messageBlock=""
embedBlock=""
divBlock=""
eachHeight = 100/len(covariates)
# Generate base64 and calculate correct value to be put into pca-template
for idx,covariate in enumerate(covariates):
    message = generate_ascii(covariate)
    messageBlock += "var base64_plot_"+str(idx)+"='" + message + "'"+"\n"
    embedBlock += "embedPCAplus ('#iFrameDiv"+str(idx)+"_"+pca_type+"', 'base64', base64_plot_"+str(idx)+",'"+covariate+"');"+"\n"
    divBlock +="<DIV id='iFrameDiv"+str(idx)+"_"+pca_type+"' style='width:100%;height:"+str(eachHeight)+"%'></DIV>"+"\n"
totalHeight = "<DIV style='width:100%;height:"+str(600*len(covariates))+"px'>"
logme("Generated ascii for all covariates")

## Read pca-plot-all.js and make base64
with open('pca-plot-all.js', 'r') as f:
  pca_plot_all = f.read()
pca_plot_all_base64 =  base64.b64encode(pca_plot_all.encode('ascii')).decode('ascii')
pca_plot_all_line = '\t\t\t\tS(`src="data:text/javascript;base64,' + pca_plot_all_base64 + '"`);'
logme("Encoded pca-plot-all.js")

# Update the tag in pca-template file, replace with values after calculation
dirPath = os.path.dirname(os.path.realpath(__file__))
with open(os.path.join(folder,output_file_name),"w") as output:
    with open(os.path.join(dirPath,"pca-template.html"),"r") as f:
        # content=f.read()
        for line in f:
            if "base64_plot_ascii" in line:
                newline=line.strip().replace("base64_plot_ascii", messageBlock)
                output.write(newline + "\n")
            elif "embedBlock" in line:
                newline = line.strip().replace("embedBlock", embedBlock)
                output.write(newline + "\n")
            elif "divBlock" in line:
                newline = line.strip().replace("divBlock", divBlock)
                output.write(newline + "\n")
            elif "base64-pca-plot-all" in line:
                newline = line.strip().replace("base64-pca-plot-all", pca_plot_all_line)
                output.write(newline + "\n")
            # newline = newline.replace("covariatekey_input",
            #                           "params.covariateKey = '"+ covariate +"';")
            elif "totalHeight" in line:
                newline = line.strip().replace("totalHeight", totalHeight)
                output.write(newline + "\n")
            else:
                output.write(line)
        # content.replace("var base64_plot=", "var bas64_plot='" + message + "'")
        # print(content)

logme("Finished writing " + output_file_name)


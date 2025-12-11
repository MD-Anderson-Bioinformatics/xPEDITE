/*

Copyright (C) 2025 The University of Texas MD Anderson Cancer Center

This file is part of xPEDITE.

xPEDITE is free software: you can redistribute it and/or modify it under the terms of the
GNU General Public License Version 2 as published by the Free Software Foundation.

xPEDITE is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with xPEDITE.
If not, see <https://www.gnu.org/licenses/>.

*/

const fs = require('fs');
const schema = require("./schema")
const mongoose = require('mongoose');
const utils = require('./utils')
const log = require('./log')(__filename);
const path = require('path');
var spawn = require('child_process').spawn


const {
    execSync
} = require('child_process')


Report = mongoose.model("Report", schema.ReportSchema);
let reportsFolder = "/reports/"

class ReportOB {
    constructor(props) {
        this.name = props.name
        this.study_name = props.study_name
        this.normalization = props.normalization
        this.covariates = props.covariates
        this.samples = props.samples
        this.study = props.study
        this.reportfile_name = props.reportfile_name,
        this.assay_type = props.assay_type
        this.tool_used = props.tool_used
        this.datafile = props.datafile
        this.generated_by_user = props.generated_by_user
        this.reportFolder = props.reportFolder
        this.outputName = this.name + ".html"
    }

    moveCovariates(groups) {
        let checkList = ["DNA"]
        for (let covariate of checkList) {
            if (groups.includes(covariate)) {
                const index = groups.indexOf(covariate);
                if (index > -1) {
                    groups.splice(index, 1);
                }
                groups.push(covariate)
            }
        }
        return groups
    }


    /*
        Get covariates for pdata file
    */
    async getColumes(samples) {
        let groups = []
        samples.forEach((sample) => {
            Object.keys(sample._doc).forEach((key) => {
                if (!groups.includes(key)) {
                    groups.push(key)
                }
            })
        })
        let removeList = ["_id", "study_id", "__v", "group", "last_modified", "sample_type", "assay_type", "sample_id"]
        if (this.covariates.length > 0) {
            for (let covariate of this.covariates) {
                removeList.push(covariate)
            }
        }

        removeList.forEach((removeItem) => {
            groups = utils.removeFromArray(groups, removeItem)
        })
        groups = this.moveCovariates(groups)
        log.debug("covariates " + groups)
        return groups
    }

    /*
        Generate pdata (meta data table) file to be passed into report generation
    */
    async generatePdata() {
        execSync(`cp "/app/scripts/blacklist.json" "${path.join(this.study.studyFolder)}"`)
        utils.addToBlackList(this.study.studyFolder + "/blacklist.json", this.samples)
        let samples = await this.study.getSamples()
        let groups = await this.getColumes(samples)
        let pdata = ""
        for (let group of groups) {
            pdata += group + ","
        }
        pdata = pdata.replace("cust_sampleid", "ID").slice(0, -1)
        pdata = pdata + "\n"
        for (let sample of samples) {
            let line = ""
            for (let label of groups) {
                line += sample._doc[label] + ","
            }
            line = line.slice(0, -1)
            pdata += line + "\n"
        }
        fs.writeFileSync(this.study.studyFolder + '/pdata.csv', pdata)
    }


    generateReport() {
        return new Promise((resolve, reject) => {
            let command = '/app/scripts/pipeline_workflow.sh';
            let args = ['-d', this.study.studyFolder, '-p', 'pdata.csv', '-f', this.datafile, '-m', 'metadata.json', 
                  '-n', this.normalization, '-o', this.outputName, '-b', 'blacklist.json', '-s', '/app/scripts/', 
                  '-r', this.reportFolder];
            log.info("Command generating report: " + command + " " + args.join(" "));
            let running = spawn(command, args);
            let stdoutFile = this.reportFolder + "stdout.log";
            let stderrFile = this.reportFolder + "stderr.log";
            let stdoutStream = fs.createWriteStream(stdoutFile, {
                flags: 'a'
            })
            let stderrStream = fs.createWriteStream(stderrFile, {
                flags: 'a'
            })
            running.stdout.on('data', function(data) {
                stdoutStream.write(data.toString())
            });
            running.stderr.on('data', function(data) {
                stderrStream.write(data.toString())
            });
            running.on('close', (exitCode) => {
                stdoutStream.end()
                stderrStream.end()
                log.info("Stdout for " + this.name + ": " + stdoutFile);
                if (`${exitCode}` != 0) {
                   log.error("Nonzero exit code for " + this.name + ":" + `${exitCode}`);
                   log.error("Stderr file location: " + stderrFile);
                   reject("Error generating report " + this.name);
                } else if (fs.existsSync(this.reportFolder + this.outputName)) {
                    if (!fs.existsSync(reportsFolder + this.study_name)) {
                        fs.mkdirSync(reportsFolder + this.study_name);
                        execSync(`cp /app/scripts/pca-plot-all.js "${path.join(reportsFolder, this.study_name)}"`)
                    }
                    const stdout = execSync(`cp "${path.join(this.reportFolder, this.outputName)}" "${path.join(reportsFolder, this.study_name)}"`)
                    log.debug(stdout)
                    resolve(exitCode)
                } else {
                    log.error("Report file '" + this.reportFolder + this.outputName + "' not found.");
                    reject("Report output file not generated.")
                }
            })
        })
    }

    async saveReport() {
        log.info("Adding report to databse: " + this.name);
        let onestudy = await this.study.getStudy()
        let newReport = new Report({
            study_id: onestudy._id,
            reportfile_name: this.outputName,
            template_version: process.env.TEMPLATEVERSION,
            assay_type: this.assay_type,
            tool_used: this.tool_used,
            datafile: this.datafile,
            generated_by_user: this.generated_by_user
        })
        return await newReport.save()
    }

    async deleteReport() {
        return new Promise((resolve, reject) => {
            log.info("Deleting report: " + this.name);
            Report.deleteOne({
                "reportfile_name": this.outputName
            }, async(err, d) => {
                if (err) log.error(err)
                log.debug(d.deletedCount)
            })
            let filePath = reportsFolder + this.study_name + "/" + this.outputName
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath)
                fs.rmdir(this.reportFolder, {
                    recursive: true
                }, async(err) => {
                    if (err) throw err;
                    log.info("Deleted report folder: " + this.reportFolder);
                    let reportFiles = await this.study.getReports()
                    let successfulReportFiles = await this.study.getSuccessfulReports()
                    if (successfulReportFiles.length == 0) {
                        this.study.updateStatus("Data is ready")
                    }
                    resolve(reportFiles)
                });
            } else {
                reject('Report does not exist')
            }

        })
    }

    // Get the name of the datafile used to generate the report
    async getDatafileName() {
        let report = await Report.findOne({
            reportfile_name: this.reportfile_name
        }).exec()
        if (report == null) {
          return null;
        }
        let datafile = report.datafile
        return datafile
    }

    // Update the status of the report
    async updateStatus(message) {
        let report = await Report.findOneAndUpdate({
            reportfile_name: this.reportfile_name
        }, { status: message }).exec();
        return report
    }

    // Get the report from the database
    async getReport() {
        let report = await Report.findOne({
            reportfile_name: this.name + ".html"
        }).exec()
        return report
    }
}

module.exports = {
    ReportOB: ReportOB
}

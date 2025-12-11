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
const csv = require('csv-parser');
const log = require('./log')(__filename);

Study = mongoose.model('Study', schema.StudySchema);
Sample = mongoose.model("Sample", schema.SampleSchema);

// imports for validating pdata.csv files
const pdataValidate = require('./pdataValidate');


class StudyOB {
    constructor(props) {
        this.name = props.name;
        this.studyFolder = "/data/" + this.name + "/"
        if (!fs.existsSync(this.studyFolder)) {
            fs.mkdirSync(this.studyFolder);
        }
    }

    getInputData() {
        let inputFileName = this.name + ".csv"
        if (fs.existsSync(this.studyFolder + this.name + ".xlsx")) {
            inputFileName = this.name + ".xlsx"
        }
        return inputFileName
    }

    async getStudy() {
        let study = await Study.findOne({
            study_name: this.name
        }).exec();
        return study
    }


    async saveStudy(studyInfo) {
        let newStudy = new Study({
            // study_name: req.body.studyname,
            study_name: this.name,
            pi_firstname: studyInfo.pifirst,
            pi_lastname: studyInfo.pilast,
            pi_email: studyInfo.piemail,
            pi_phone: studyInfo.piphone,
            submitter_firstname: studyInfo.submitterfirst,
            submitter_lastname: studyInfo.submitterlast,
            submitter_email: studyInfo.submitteremail,
            submitter_phone: studyInfo.submitterphone,
            sample_type: studyInfo.sample_type
        })
        return await newStudy.save()
    }

    /*
        Save user uploaded sample data  file
    */
    saveUploadedPdata(uploadPath) {
        return new Promise(async(resolve, reject) => {
		const validMD = new pdataValidate();
		try
		{
			log.info("saveUploadedPdata - calling validatePdata");
			validMD.validatePdata(uploadPath);
			if (validMD.reportErrors.length > 0)
			{
				log.info("saveUploadedPdata - One or more errors found in the uploaded pdata.csv file");
				// build string from error values
				let errorExplanationString = "";
				for (let errorString of validMD.reportErrors)
				{
					// built to display HTML
					errorExplanationString = errorExplanationString + errorString + "\n";
				}
				errorExplanationString = errorExplanationString + validMD.reportMessage;
				throw errorExplanationString;
			}
			log.info("saveUploadedPdata - Uploaded pdata.csv file validated successfully.");
		}
		catch (theError)
		{
			log.error(theError);
			reject(theError);
		}


            let onestudy = await this.getStudy()
            // use cleansed file
            var readStream = fs.createReadStream(validMD.tempPathPdata)
                .pipe(csv())
                .on('data', async(row) => {
                    let sampleJSON = {
                        study_id: onestudy._id,
                        sample_id: ""
                    }
                    try {
                        // row = row.replace(/[\u200B-\u200D\uFEFF]/g, '');
                        Object.keys(row).forEach((key) => {
                            if (key.includes("ID") || key.includes("sample")) {
                                // if ("ID" in key) {
                                sampleJSON["cust_sampleid"] = row[key].trim()
                            } else {
                                sampleJSON[key] = row[key].trim()
                            }
                        })
                        if (!sampleJSON["cust_sampleid"] || sampleJSON["cust_sampleid"].trim().length === 0) {
                            log.error("sampleJSON[cust_sampleid] is undefined or empty in " + validMD.tempPathPdata)
                            readStream.destroy()
                            throw "In pdata.csv file: Customer sample id is missing for at least one entry."
                        } else {
                            sampleJSON["sample_id"] = this.name + "_" + sampleJSON["cust_sampleid"]
                            let newSample = new Sample(sampleJSON)
                            newSample.save()
                        }
                    } catch (error) {
                        log.error(error)
                        await Study.remove({
                            study_name: this.name
                        })
                        fs.rmdir("/data/" + this.name, {
                            recursive: true
                        }, (err) => {
                            if (err) throw err;
                            console.log(`dir deleted!`);
                        });
                        reject(error);
                    }
                })
                .on('end', () => {
                    log.info('Successfully processed: ' + uploadPath);
                    resolve(this.name)
                });

        })
    }


    /*
        Save user manually input data
    */
    saveSubmitedPdata(info) {
        return new Promise(async(resolve, reject) => {
            let numsamples = info.numSamples;
            let onestudy = await this.getStudy()
            try {
                for (let i = 0; i < numsamples; i++) {
                    let sampleJSON = {
                        study_id: onestudy._id
                    }
                    sampleJSON["sample_id"] = this.name + "_" + info["cust_sampleid_" + i]
                        //sampleJSON["sample_id"] = study.study_name + "_" + sampleJSON["cust_sampleid"]
                    let regex = new RegExp(".*_" + i + "$")
                    Object.keys(info).forEach((key) => {
                        if (regex.test(key)) {
                            // console.log(key, info[key])
                            sampleJSON[key.replace("_" + i, "")] = info[key].trim()
                        }
                    })
                    let newSample = new Sample(sampleJSON)
                    await newSample.save().then(sample => console.log(sample.sample_id))
                }
                resolve(this.name)
            } catch (error) {
                await Study.remove({
                    study_name: this.name
                })
                fs.rmdir("/data/" + this.name, {
                    recursive: true
                }, (err) => {
                    if (err) throw err;
                    console.log(`dir deleted!`);
                });
                reject({
                    "error": error
                })
            }
        })
    }

    async updateStatus(message) {
        let study = await Study.findOneAndUpdate({
            study_name: this.name
        }, { status: message }).exec();
        return study
    }


    /*
        Generate meta data for report
    */
    async generateMetaData(body) {
        let study = await this.getStudy()
        let metadata = {
            "title": process.env.REPORT_TITLE,
            "author": process.env.REPORT_AUTHOR,
            "PI": study.pi_firstname + " " + study.pi_lastname,
            "studyNumber": study.study_name,
            "institution": process.env.REPORT_INSTITUTION,
            "samples": study.sample_type,
            "assayType": body.assay_type,
            "toolUsed": body.tool_used,
            "normalization": body.normalization
        }
        fs.writeFileSync(this.studyFolder + '/metadata.json', JSON.stringify(metadata))
        return metadata
    }

    // Get a list of all reports including failed ones, sorted by time generated (most recently genererated reports first)
    async getReports() {
        let studyDir = this.name
        let reportfiles = fs.readdirSync("/data/" + studyDir + "/").filter(fn => !(fn.endsWith('.csv') || fn.endsWith('.xlsx') || fn.endsWith('.xls') || fn.endsWith('.json')));
        let aTime = 0
        let bTime = 0
        reportfiles.sort(function(a, b) {
            if (fs.existsSync("/data/" + studyDir + "/" + a + "/logfile.txt")) {
                aTime = fs.statSync("/data/" + studyDir + "/" + a + "/logfile.txt").mtime.getTime()
            }
            else {
                aTime = fs.statSync("/data/" + studyDir + "/" + a).mtime.getTime()
            }
            if (fs.existsSync("/data/" + studyDir + "/" + b + "/logfile.txt")) {
                bTime = fs.statSync("/data/" + studyDir + "/" + b + "/logfile.txt").mtime.getTime()
            }
            else {
                bTime = fs.statSync("/data/" + studyDir + "/" + b).mtime.getTime()
            }
            return bTime - aTime;
        });
        return reportfiles
    }

    // Get a list of all successful reports, sorted by time generated
    async getSuccessfulReports() {
        let studyDir = this.name
        let reportsPath = "/reports/" + studyDir + "/"
        let reportfiles = []
        if (fs.existsSync(reportsPath)) {
            reportfiles = fs.readdirSync(reportsPath).filter(fn => fn.endsWith('.html'));
            reportfiles.sort(function(a, b) {
                return fs.statSync(reportsPath + a).mtime.getTime() - 
                    fs.statSync(reportsPath + b).mtime.getTime();
            });
        }
        return reportfiles
    }

    async getSamples() {
        let onestudy = await this.getStudy()
        let samples = await Sample.find({
            study_id: onestudy._id
        }).sort("_id").exec()
        return samples

    }

    getColumes(samples) {
        let columes = []
        samples.forEach((sample) => {
            Object.keys(sample._doc).forEach((key) => {
                if (!columes.includes(key)) {
                    columes.push(key)
                }
            })
        })
        let removeList = ["_id", "study_id", "__v", "group", "last_modified"]
        removeList.forEach((removeItem) => {
            columes = utils.removeFromArray(columes, removeItem)
        })
        return columes
    }

    async getStudyDetail() {
        let onestudy = await this.getStudy()
        let samples = await this.getSamples()
        let allkeys = this.getColumes(samples)
        let reports = await this.getReports()
        let successfulReports = await this.getSuccessfulReports()
        let message = "Input file is not ready. Please upload input file."
        var uploadedFiles = fs.readdirSync("/data/" + this.name + "/").filter(fn => fn != "pdata.csv" && fn != "pdata_all.csv" && (fn.endsWith('.csv') || fn.endsWith('xlsx')));

        if (uploadedFiles.length > 0) {
            message = "Input data for generation of report is ready."
            if (successfulReports.length == 0) {
                await this.updateStatus("Data is ready")
            } else {
                await this.updateStatus("Report generated")
            }
        } else {
            this.updateStatus("Submitted")
        }
        return {
            study: onestudy,
            message: message,
            allkeys: allkeys,
            samples: samples,
            reportfiles: reports,
            uploadedFiles: uploadedFiles
        }
    }

}

module.exports = {
    StudyOB: StudyOB
}

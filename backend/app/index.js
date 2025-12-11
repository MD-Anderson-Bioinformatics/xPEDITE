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

const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const fs = require('fs');
const archiver = require('archiver');

const util = require('util');
const exec = util.promisify(require('child_process').exec);
const fileUpload = require('express-fileupload');
const schema = require("./schema")
const log = require('./log')(__filename);

const axios = require('axios');

var express = require('express'),
    path = require('path'),
    app = express();


const authenticate = require('./shaidy-authenticate').shaidyAuthenticator;

const utils = require('./utils')
const studymodel = require("./study.js")
const reportmodel = require("./report.js")
const authorized_group = process.env.AUTHORIZED_GROUP
if (authorized_group) {
  log.info("Authorized group for pipeline access: " + authorized_group);
}

if (process.env.NODE_TLS_REJECT_UNAUTHORIZED == '0') {
  log.warn("Server allowing self-signed certificates. This is for DEVELOPMENT ONLY!");
} else {
  log.info("Server NOT allowing self-signed certificates.");
}

/* Connect to MongoDB and keep retrying if connection fails
 * (sometimes MongoDB container takes a bit longer to start up)
 */
const connectWithRetry = () => {
  const mongoUrl =  'mongodb://mongo:27017/expressmongo';
  mongoose.connect(mongoUrl, {
    useNewUrlParser: true
  })
  .then(() => {
    log.info('Connected to mongoDB. URL: ' + mongoUrl);
  })
  .catch((err) => {
    log.error('mongoDB connection failed. Trying again in 5 seconds..', err.toString());
    setTimeout(connectWithRetry, 5000);
  });
}

connectWithRetry();

const requiredENVs = ["URL_PATHNAME", "REPORT_TITLE", "REPORT_AUTHOR", "REPORT_INSTITUTION"];

requiredENVs.forEach((enVar) => {
  if (!process.env[enVar]) {
    log.error(`Required environment variable ${enVar} not set. Exiting.`);
    process.exit(1);
  }
})

let rootPath = "/" + process.env.URL_PATHNAME;
log.debug("rootPath: " + rootPath);

Study = mongoose.model('Study', schema.StudySchema);
Sample = mongoose.model("Sample", schema.SampleSchema);
Report = mongoose.model("Report", schema.ReportSchema);
let reportsFolder = "/reports/"

if (!fs.existsSync(reportsFolder)) {
    fs.mkdirSync(reportsFolder);
}

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
    extended: false
}));
app.use(rootPath, express.static(path.join(__dirname, 'views')));
app.use(rootPath, express.static(path.join(__dirname, '../reports')));
app.use(rootPath + '/show', [authenticate, express.static(path.join(__dirname, '../reports'))]);
app.use(fileUpload());
app.use((req, res, next) => {
  res.append('X-Frame-Options', 'DENY');
  next();
});

app.get("/index", (req, res) => {
    log.debug("GET /index");
    log.debug("Redirecting to /index");
    res.redirect(rootPath + "/index")
});

app.get("/admin", (req, res) => {
    log.debug("GET /admin");
    log.debug("Redirecting to /admin");
    res.redirect(rootPath + "/admin")
});


/**Make an authenticate request to ldap-jwt and return token to client
 */
app.post(rootPath + "/authenticate", (req, res) => {
    const authURL = process.env.LDAP_JWT_HOST + '/ldap-jwt/authenticate';
    const authData = {
            username: req.body.username,
            password: req.body.password,
    }
    if (authorized_group) {
      authData.authorized_groups = [authorized_group]
    }
    return axios.post(authURL, authData)
        .then(userInfo => {
            if (!userInfo) {
                throw new Error('Failed to get ldapjwt user profile for ' + token);
            }
            // userInfo.data is response from LDAP-JWT server
            log.debug("userInfo.data: " + JSON.stringify(userInfo.data));
            log.info("User logged in: " + userInfo.data.full_name);
            res.cookie("token", userInfo["data"]["token"], {
                httpOnly: true
            }).json({
                token: userInfo["data"]["token"],
                full_name: userInfo["data"]["full_name"],
                mail: userInfo["data"]["mail"]
            });
        })
        .catch(function(error) {
            if (error.response !== undefined && error.response.status == 401) {
                log.error("Authentication error " + error.response.status + ": " + error.response.data.error);
                res.status(401).send("Authentication error");
                return;
            } else if (error.response != undefined) {
                log.error(error.response.status)
                log.error(error.response.data.error)
            }
            res.status(401).send("Login error.")
        })
})


/*
    Logout
*/

app.post(rootPath + "/logout", authenticate, (req, res) => {
    var token = ""
    res.cookie("token", token, {
        httpOnly: true
    }).json({
        token: token,
        full_name: "abc",
        mail: "abc@123.com"
    });
    log.info("User logged out: " + req.user.full_name);
})


app.get("/login", (req, res) => {
    log.debug("GET /login");
    log.debug("Redirecting to /login");
    res.redirect(rootPath + "/login")
});

app.get(rootPath + "/index", (req, res) => {
    log.debug("GET /index");
    log.debug("Rendering /index");
    res.render("index", {
     rootPath: rootPath
    });
});

app.get(rootPath + "/admin", authenticate, async(req, res) => {
    log.debug("GET /admin")
    let studies = await Study.find({
            "status": {
                "$nin": ["Removed", "Archived"]
            }
        }).sort({
            'last_modified': -1
        }).exec()
    log.debug("Rendering study_table");
    res.render("study_table", {
        studies: studies,
        user: req.user.full_name,
        type: "All",
        rootPath: rootPath
    });
})

/*
    Get removed studies
    Return rendered study_table page
*/
app.get(rootPath + "/admin/removed", authenticate, async(req, res) => {
    log.debug("GET: /admin/removed");
    let studies = await Study.find({
        "status": "Removed"
    }).sort({
        'last_modified': -1
    }).exec()
    log.debug(studies)
    log.debug("Rendering study_table");
    res.render("study_table", {
        studies: studies,
        user: req.user.full_name,
        type: "Removed",
        rootPath: rootPath
    });
})


/*
    Get archived studies
    Return rendered study_table page
*/
app.get(rootPath + "/admin/archived", authenticate, async(req, res) => {
    log.debug("GET: /admin/archived");
    let studies = await Study.find({
        "status": "Archived"
    }).sort({
        'last_modified': -1
    }).exec()
    log.debug(studies)
    res.render("study_table", {
        studies: studies,
        user: req.user.full_name,
        type: "Archived",
        rootPath: rootPath
    });
})

app.get(rootPath + "/login", (req, res) => {
    log.debug("GET /login");
    res.render("login", {
     rootPath: rootPath
    });
})

app.get(rootPath + '/authenticators', function(req, res) {
    log.debug("GET /authenticators");
    const auth = require('./shaidy-authenticate').getShaidyAuthenticators();
    res.status(200).json(auth);
});

/*
    Check the status of report generation
    Params:
        req.query.studyName

    Return get all reports for study
*/
app.get(rootPath + '/get_reports', authenticate, getReports)

async function getReports(req, res) {
    log.debug("GET /get_reports");
    let study = new studymodel.StudyOB({
        "name": req.query.studyName
    })
    study.getReports()
        .then(function(reportfiles) {
            res.status(200).send(JSON.stringify(reportfiles));
        })
}

/*
    Generate report
    Params:
        req.body.studyName,
        req.body.reportName,
        req.body.normalization,
        req.body.covariates,
        req.body.samples,
        req.body.assay_type,
        req.body.tool_used,
        eq.body.datafile,

    Return 200, then front end will query for report generation status
*/
app.post(rootPath + '/generate_report', authenticate, generateReport)

async function generateReport(req, res) {
    let reportFolder = "/data/" + req.body.studyName + "/" + req.body.reportName + "/"
    let report
    let study
    try {
      log.info("User " + req.user.user_name + " attempting to generate report in: " + reportFolder);
      if (fs.existsSync(reportFolder)) {
        res.status(500).send("Duplicate report name.");
        return
      } else {
         fs.mkdirSync(reportFolder)
      }
      study = new studymodel.StudyOB({
          "name": req.body.studyName
      })
      report = new reportmodel.ReportOB({
          "name": req.body.reportName,
          "study_name": req.body.studyName,
          "normalization": req.body.normalization,
          "covariates": JSON.parse(req.body.covariates),
          "samples": JSON.parse(req.body.samples),
          "study": study,
          "assay_type": req.body.assay_type,
          "tool_used": req.body.tool_used,
          "datafile": req.body.datafile,
          "generated_by_user": req.user.user_name,
          "reportFolder": reportFolder
      })
      log.info("User " + req.user.user_name + " generating report: " + report.name);
      await report.saveReport()
      await study.generateMetaData(req.body)
      await report.generatePdata()
      res.status(200).send("Generating report");
      report.generateReport()
          .then(async() => {
              await study.updateStatus("Report generated")
              await report.getReport().then(report => {
                  let newReport = new reportmodel.ReportOB({
                      "name": req.body.reportName,
                      "study_name": req.body.studyName,
                      "study": study,
                      "reportfile_name": report.reportfile_name
                  })
                  newReport.updateStatus("Generated")
                  log.info("User " + req.user.user_name + " generated report: " + report.name);
              })
              fs.appendFileSync(reportFolder + 'logfile.txt', 'Report saved.');
          })
          .catch((err) => {
              log.error("Error generating report '" + req.body.reportName + "'");
              log.error(err);
              fs.appendFileSync(reportFolder + 'logfile.txt', 'Error generating report.');
              fs.appendFileSync(reportFolder + 'logfile.txt', err);
          });
    } catch (err) {
      log.error(err);
      if (err.code === 'EEXIST') { // e.g. trying to create a report named 'pdata.csv'
        res.status(500).send("Invalid report name.");
        return;
      }
      res.status(500).send("Unspecified error")
      return;
    }
}

/*
    Show report in webpage
    Params:
        req.query.studyName
        req.query.reportName
    Return HTML report
*/
app.get(rootPath + '/show_report', authenticate, showReport)

function showReport(req, res) {
    log.debug("GET /show_reports");
    let reportName = req.query.reportName + ".html"
    let shortReportName = req.query.reportName
    let studyName = req.query.studyName
    try {
        if (fs.existsSync(reportsFolder + studyName + "/" + reportName)) {
            res.status(200).send(studyName + "/" + reportName);;
        } else {
            res.status(400).send("The report doesn't exist: " + shortReportName)
        }
    } catch (err) {
        log.error(err)
        res.status(500).send(error)
    }
}


/*
    Download report
    Params:
        req.query.studyName
        req.query.reportName
*/
app.get(rootPath + '/download_report', authenticate, downloadReport)

function downloadReport(req, res) {
    log.debug("GET /download_report");
    let reportName = req.query.reportName + ".html"
    let studyName = req.query.studyName
    let filePath = reportsFolder + studyName + "/" + reportName
    try {
        if (fs.existsSync(filePath)) {
            res.download(filePath, reportName);
        } else {
            res.status(400).send("The report doesn't exist.")
        }
    } catch (err) {
        log.error(err)
        res.status(500).send(err)
    }
}

/*
    Download logs
    Params:
        req.query.studyName
        req.query.reportName
*/
app.get(rootPath + '/download_logs', authenticate, downloadLogs)

async function downloadLogs(req, res) {
    log.debug("GET /download_logs");
    let reportName = req.query.reportName
    let studyName = req.query.studyName
    let dataFolder = '/data/'
    let reportFolder = dataFolder + studyName + "/" + reportName + "/"
    let filePath = reportFolder + "logs.zip"

    // create a file to stream archive data to.
    let output = fs.createWriteStream(filePath);
    let archive = archiver('zip', {
        zlib: { level: 9 } // Sets the compression level.
    });
    // listen for all archive data to be written
    output.on('close', function() {
        log.debug(archive.pointer() + ' total bytes');
        log.debug('archiver has been finalized and the output file descriptor has closed.');
        try {
            if (fs.existsSync(filePath)) {
                res.download(filePath, "logs.zip");
            } else {
                res.status(400).send("The report doesn't exist.")
            }
        } catch (err) {
            log.error(err)
            res.status(500).send(err)
        }
    });
    // catch warnings (ie stat failures and other non-blocking errors)
    archive.on('warning', function(err) {
        if (err.code === 'ENOENT') {
            log.warn(err);
        } else {
            throw err;
        }
    });
    // catch this error explicitly
    archive.on('error', function(err) {
        throw err;
    });
    // pipe archive data to the file
    archive.pipe(output);

    // get the name of the datafile used to generate the report
    let study = new studymodel.StudyOB({
        "name": studyName
    })
    let report = new reportmodel.ReportOB({
        "name": reportName,
        "study_name": studyName,
        "study": study,
        "reportfile_name": reportName + ".html"
    })
    datafile = await report.getDatafileName()

    // append files
    archive.file(reportFolder + 'logfile.txt', { name: 'logfile.txt' });
    archive.file(reportFolder + 'stderr.log', { name: 'stderr.log' });
    archive.file(reportFolder + 'stdout.log', { name: 'stdout.log' });
    archive.file(reportFolder + 'metadata.json', { name: 'metadata.json' });
    archive.file(dataFolder + studyName + '/pdata.csv', { name: 'pdata.csv' });
    archive.file(dataFolder + studyName + '/' + datafile, { name: datafile });
    // finalize the archive (ie we are done appending files but streams have to finish yet)
    archive.finalize();
}

/*
    Remove report
    Params:
        req.query.studyName
        req.query.reportName
    Return list of reports after deletion
*/
app.delete(rootPath + '/remove_report', authenticate, deleteReport)

async function deleteReport(req, res) {

    let study = new studymodel.StudyOB({
        "name": req.query.studyName
    })
    let report = new reportmodel.ReportOB({
        "name": req.query.reportName,
        "study_name": req.query.studyName,
        "study": study
    })
    report.deleteReport()
        .then((reportFiles) => {
            res.status(200).send(reportFiles);
        })
        .catch((err) => {
            log.error(err)
            res.status(500).send(err);
        })

}

/*
    Check the status of report generation
    Params:
        req.query.studyName
        req.query.reportFolder
    Return status of report generation in log file
*/
app.get(rootPath + "/check_status", authenticate, checkStatus)

function checkStatus(req, res) {
    log.debug("GET /check_status");
    let studyName = req.query.studyName
    let reportFolder = req.query.reportFolder
    let outFile = "/data/" + studyName + "/" + reportFolder + "/logfile.txt"
    if (fs.existsSync(outFile)) {
        fs.readFile(outFile, (err, data) => {
            res.status(200).send(data)
        })
    } else {
        res.status(200).send("Starting...")
    }

}

/*
    Get study info
    Params:
        req.query.studyName
    Return rendered study page
*/
app.get(rootPath + "/search_study/:studyName", authenticate, search_study)

async function search_study(req, res, studyName) {
    log.debug("GET /search_study/:studyName");
    try {
        let study = new studymodel.StudyOB({
            "name": req.params.studyName
        })

        log.info("study " + study.name + " accessed by " + req.user.user_name)
        let studyDetail = await study.getStudyDetail()
        res.render("study", {
          studyDetail: studyDetail,
          rootPath: rootPath
        })
    } catch (err) {
        log.error(err)
        res.status(500).send("error")
    }

}

/*
    Submit analyzed data
    Params:
      req.files.analyzedFile;
      req.body.studyName
    Return file name 200 if file is uploaded
*/
app.post(rootPath + "/submit_data", authenticate, submit_data)

async function submit_data(req, res) {
    log.debug("Submitting data");
    if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).send('No files were uploaded.');
    }
    let analyzedFile = req.files.analyzedFile;
    let studyName = req.body.studyName
    log.debug("analyzedFile: " + analyzedFile);
    log.debug("studyName: " + studyName);
    let study = new studymodel.StudyOB({
        "name": studyName
    })
    let dataFolder = '/data/' + studyName
    if (!fs.existsSync(dataFolder)) {
        fs.mkdirSync(dataFolder);
    }
    let uploadPath = dataFolder + '/' + analyzedFile.name;
    log.debug(uploadPath)
    analyzedFile.mv(uploadPath, async function(err) {
        if (err)
            return res.status(500).send(err);
        await study.updateStatus("Data is ready")
        res.status(200).send(analyzedFile.name)

    });
}

/*
    Submit sample data related to the study
    Could be an uploaded file or through params in the body
    Return success page or error page
*/
app.post(rootPath + '/submit_study', submit_study)

async function submit_study(req, res) {
    log.debug("POST /submit_study");
    try {
        let study = new studymodel.StudyOB({
            "name": req.body.pilast + "_" + utils.getDate()
        })
        log.info("Submitting new study: " + study.name);
        study.saveStudy(req.body)
            .then(() => {
                // Check to see if the sample info is submitted as file or in the params.
                if (req.files) {
                    if (Object.keys(req.files).length === 0) {
                        return res.status(500).send('No files were uploaded.');
                    }
                    let sampleFile = req.files.sampleFile;
                    let uploadPath = study.studyFolder + sampleFile.name;
                    sampleFile.mv(uploadPath, async function(err) {
                        if (err) {
                            log.error(err)
                            res.status(500).send(err);
                        }
                        study.saveUploadedPdata(uploadPath)
                            .then((studyname) => {
                                res.render("success", {
                                    "study_name": studyname,
                                    rootPath: rootPath
                                });
                            })
                            .catch((error) => {
                                log.error(error)
                                res.render("error", {
                                    "errormessage": error,
                                    rootPath: rootPath
                                })
                            })
                    });
                } else {
                    study.saveSubmitedPdata(req.body)
                        .then((studyname) => {
                            res.render("success", {
                                "study_name": studyname,
                                rootPath: rootPath
                            });
                        })
                        .catch((error) => {
                            log.error(error)
                            res.render("error", {
                                "errormessage": error,
                                rootPath: rootPath
                            })
                        })
                }
            })
        .catch((error) => {
            log.error(error)
            res.render("error", { "errormessage": error, rootPath: rootPath })
        })
    } catch (error) {
        log.error(error)
        res.render("error", {
            "errormessage": error,
            rootPath: rootPath
        })
    }

}

/*
    Permanent remove a study, all the files in the specified study page and relevant 
    reports will be removed. The files can't be recovered.
    Params:
        req.query.studyName
    Return study_table page with study removed
*/
app.delete(rootPath + "/perm_remove_study", authenticate, perm_remove_study)

async function perm_remove_study(req, res) {
    let studyName = req.query.studyName
    let onestudy = await Study.findOne({
        study_name: studyName
    }).exec();
    await Study.deleteOne({
        "study_name": studyName
    }, async(err, d) => {
        if (err) log.error(err)
        if (d.deletedCount == 1) {
            let studies = await Study.find({}).sort({
                'last_modified': -1
            }).exec()
            fs.rmdir(reportsFolder + studyName, {
                recursive: true
            }, (err) => {
                if (err) {
                    log.error(err)
                    throw err;
                }
                let regex = new RegExp("^" + studyName, "g")
                fs.readdirSync(reportsFolder)
                    .filter(f => regex.test(f))
                    .map(f => fs.unlinkSync(reportsFolder + f))
                log.warn(`reports deleted!`);
            });
            fs.rmdir("/data/" + studyName, {
                recursive: true
            }, (err) => {
                if (err) {
                    log.error(err)
                    throw err;
                }
                log.warn(`dir deleted!`);
            });
            res.render("study_table", {
                studies: studies,
                user: req.user.full_name,
                rootPath: rootPath
            });
        } else {
            res.status(400).send("Record doesn't exist or already deleted")
        }
    });
    await Sample.deleteMany({
        "study_id": mongoose.Types.ObjectId(onestudy._id)
    }, async(err, d) => {
        if (err) log.error(err)
        log.debug(d.deletedCount)
    })
    await Report.deleteMany({
        "study_id": mongoose.Types.ObjectId(onestudy._id)
    }, async(err, d) => {
        if (err) log.error(err)
        log.debug(d.deletedCount)
    })

}

/*
    Soft remove the study by modify the status, the removed study could be recovered
    Params:
        req.query.studyName
    Return study_table page with study soft removed

*/
app.delete(rootPath + "/remove_study", authenticate, remove_study)

async function remove_study(req, res) {
    //"Soft remove" the study by modify the status label
    let study = new studymodel.StudyOB({
        "name": req.query.studyName
    })
    await study.updateStatus("Removed")

    let studies = await Study.find({
        "status": {
            "$ne": "Removed"
        }
    }).sort({
        'last_modified': -1
    }).exec()
    log.debug(studies)
    res.render("study_table", {
        studies: studies,
        user: req.user.full_name,
        type: "All",
        rootPath: rootPath
    });

}

/*
    Archive study
    Params:
        req.query.studyName
    Return study_table with archived study removed
*/

app.get(rootPath + "/archive_study", authenticate, archive_study)

async function archive_study(req, res) {
    log.debug("GET /archive_study");
    let study = new studymodel.StudyOB({
        "name": req.query.studyName
    })
    await study.updateStatus("Archived")

    let studies = await Study.find({
        "status": {
            "$ne": "Archived"
        }
    }).sort({
        'last_modified': -1
    }).exec()
    log.debug(studies)
    res.render("study_table", {
        studies: studies,
        user: req.user.full_name,
        type: "All",
        rootPath: rootPath
    });

}

/*
    Recover study from removed or archived state
    Params:
        req.query.studyName
    Return study_table with study recovered
*/

app.get(rootPath + "/recover_study", authenticate, recover_study)

async function recover_study(req, res) {
    log.debug("GET /recover_study");
    let study = new studymodel.StudyOB({
        "name": req.query.studyName
    })

    let successfulReports = await study.getSuccessfulReports()
    if (successfulReports.length > 0) {
        await study.updateStatus("Report generated")
    } else {
        await study.updateStatus("Data is ready")
    }
    let studies = await Study.find({
        "status": {
            "$nin": ["Removed", "Archived"]
        }
    }).sort({
        'last_modified': -1
    }).exec()
    log.debug(studies)
    res.render("study_table", {
        studies: studies,
        user: req.user.full_name,
        type: "All",
        rootPath: rootPath
    });

}

/*
    Update sample information
    Params:
        req.body
    Return 200
*/

app.post(rootPath + '/update_sample', authenticate, update_sample)

async function update_sample(req, res) {
    log.debug("update sample info")
    let numsamples = req.body.numSamples;
    let numNewheaders = req.body.numNewheaders
    let extras = []
    try {
        for (let i = 0; i < numNewheaders; i++) {
            extras.push(req.body["extra" + i])
        }
        for (let i = 0; i <= numsamples; i++) {
            let filter = {}
            let update = {}
            Object.keys(req.body).forEach((key) => {
                if (key == "sample_id_" + i) {
                    filter["sample_id"] = req.body[key]
                }
                for (let extra of extras) {
                    if (key == extra + "_" + i) {
                        update[extra] = req.body[key]
                    }
                }
            })
            if (Object.keys(update).length !== 0 && Object.keys(filter).length !== 0) {
                log.debug(filter, update)
                await Sample.findOneAndUpdate(filter, update);
            }
        }
        res.status(200).send("Updated")
    } catch (err) {
        log.error(err)
        res.status(500).send(err);
    }
}

const port = 3000;
app.listen(port, () => {
  log.info('Server running...');
});


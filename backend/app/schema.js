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



// DB schema
const StudySchema = new mongoose.Schema({
    study_name: {
        type: String,
        required: true,
        unique: true
    },
    pi_firstname: {
        type: String,
        required: true
    },
    pi_lastname: {
        type: String,
        required: true
    },
    pi_email: {
        type: String,
        required: true
    },
    pi_phone: {
        type: String
    },
    submitter_firstname: {
        type: String,
        required: true
    },
    submitter_lastname: {
        type: String,
        required: true
    },
    submitter_email: {
        type: String,
        required: true
    },
    submitter_phone: {
        type: String
    },
    timecourse: {
        type: Boolean
    },
    submit_date: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        default: "Submitted"
    },
    last_modified: {
        type: Date,
        default: Date.now
    },
    sample_type: {
        type: String
    }
});



const SampleSchema = new mongoose.Schema({
    study_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Study'
    },
    sample_id: {
        type: String
    },
    cust_sampleid: {
        type: String,
        required: true
            // unique: true
    },
    filePath: {
        type: String
    },
    last_modified: {
        type: Date,
        default: Date.now
    }
}, { strict: false });

const ReportSchema = new mongoose.Schema({
    study_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Study'
    },
    reportfile_name: {
        type: String,
        required: true
    },
    generated_by_user: {
        type: String,
        required: true
    },
    generation_time: {
        type: Date,
        default: Date.now
    },
    template_version: {
        type: String
    },
    assay_type: {
        type: String,
        // required: true
    },
    tool_used: {
        type: String,
        required: true
    },
    datafile: {
        type: String,
        required: true
    },
    status: {
        type: String,
        default: "Failed"
    },

})


Study = mongoose.model('Study', StudySchema);
Sample = mongoose.model("Sample", SampleSchema);
Report = mongoose.model("Report", ReportSchema);

StudySchema.pre("deleteOne", function(next) {
    const res1 = Sample.deleteMany({ study_id: this._id }).exec();
    const res2 = Report.deleteMany({ study_id: this._id }).exec();
    console.log(res1.deletedCount)
    console.log(res2.deletedCount)
    next();
})


module.exports = {
    StudySchema: StudySchema,
    SampleSchema: SampleSchema,
    ReportSchema: ReportSchema
}

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

const path = require('path');
const dataForge = require('data-forge');
require('data-forge-fs');

/**
 * Function that checks whether a row contains empty values or not.
 * The function iterates over all the properties (or attributes) of the given row object and checks each attribute for empty values.
 * The method treats the following as empty: Empty string (""), undefined, and null
 *
 * @param {object} theRow - The row to be evaluated for empty values.
 * Each attribute of this object represents a cell in a row.
 * Rows come from a dataForge.DataFrame via the where function.
 *
 * @returns {boolean} - Returns 'true' if the row contains any non-empty cells, 'false' otherwise.
 */
const doesRowContainEmptyValue = (theRow) => {
{
	const attributeArray = Object.keys(theRow);
	for (let key of attributeArray)
	{
		const cell = theRow[key];
		if ((cell !== "") && (cell !== undefined) && (cell !== null))
		{
			return true;
		}
	}
	return false;
}};

/**
 * PdataValidate is a class that provides functionalities to process and validate dataframes.
 * Pdata refers to metadata which is read from a pdata.csv file and then validated.
 *
 * @constructor Initializes new instance of PdataValidate class.
 *
 * @property {Array} reportErrors - An array to store errors found during validation.
 * @property {Array} reportWarnings - An array to store warnings found during validation.
 * @property {String} reportMessage - A string to store the message after validation.
 * @property {Array} pdataColumnsAvailable -  An array to keep track of available columns in the data.
 * @property {Number} numberOfRowsRead - A number representing the count of rows read from the dataframe.
 * @property {Number} numberOfRowsUsable - A number representing the count of rows usable after validation.
 * @property {String} tempPathPdata - A string to store the temporary path for the validated pdata_all.csv.
 *
 * @method buildCSV(thePdataDF, theOutFile) - Method to build the final CSV.
 * @param {DataFrame} thePdataDF - The dataForge.DataFrame to be written to the file.
 * @param {String} theOutFile - The name of the output file.
 *
 * @method validateDataset(thePdata) - Method to validate the provided dataframe.
 * @param {DataFrame} thePdata - The dataForge.DataFrame to be validated.
 *
 * @method validatePdata(theFile) - Method to validate the provided data.
 * @param {String} theFile - The name of the file containing data to be read and validated.
 */
class PdataValidate
{
	/**
	 * Constructor
	 * The PdataValidate class provides functionalities to process and validate pandas dataframes loaded from CSV files.
	 * It mainly focuses on validating different aspects of the dataframe and stores any errors or warnings encountered during the validation.
	 * It can also build a CSV output of the validated dataframe.
	 */
	constructor()
	{
		//
		this.reportErrors = [];
		this.reportWarnings = [];
		this.reportMessage = "";
		// pdata column headers
		this.pdataColumnsAvailable = [];
		// information about pdata
		this.numberOfRowsRead = -1;
		this.numberOfRowsUseable = -1;
		//
		this.tempPathPdata = "";
	}

	/**
	 * The `buildCSV` method writes a dataForge.DataFrame to a CSV file.
	 * It also populates the list of available columns.
	 *
	 * @param {DataFrame} thePdataDF - The DataFrame object from dataForge which is to be written to CSV.
	 * @param {String} theOutFile - The output file name (along with the path) where DataFrame will be written to.
	 */
	buildCSV(thePdataDF, theOutFile)
	{
		// ... is an ES6 convenience to spread iterable out, this makes a shallow copy
		this.pdataColumnsAvailable = [...thePdataDF.getColumnNames()];
		// ignore warning as this accepts all PapaParse options
		thePdataDF.asCSV({quotes: true}).writeFileSync(theOutFile);
	}

	/**
	 * `validateDataset` method takes a dataForge.DataFrame (`thePdata`) and performs a series of checks for data validity.
	 * The following are the checks it performs:
	 *
	 * - Removal of rows in `thePdata` that contain all empty or null values.
	 * - Checks if the column labeled 'ID' exists in the data.
	 * - Checks if the 'ID' column is the first column.
	 * - Checks that all values in the 'ID' column are unique and non-empty.
	 * - Validates header names in `thePdata`. They should not contain any leading or trailing whitespace, or contain tabs.
	 * - Checks if column headers are unique.
	 * - Checks that there is more than one column in `thePdata`.
	 *
	 * If any of the checks fail, the method adds an error message to the `reportErrors` array.
	 * Any warnings detected (like removal of rows with empty values) are added to the `reportWarnings` array.
	 * On successful validation, a success message is set in `reportMessage`.
	 *
	 * @param {dataForge.DataFrame} thePdata - The dataForge.DataFrame instance to be validated.
	 */
	validateDataset(thePdata)
	{
		// remove empty rows is performed when dataframe is read
		// but we still need to check for rows without values in them (such as, "", "", "")
		var temp = thePdata;
		this.numberOfRowsRead = thePdata.count();
		var isValid = true;
		thePdata = thePdata.where( doesRowContainEmptyValue );
		this.numberOfRowsUseable = thePdata.count();
		if (this.numberOfRowsRead !== this.numberOfRowsUseable)
		{
			this.reportWarnings.push("WARN: One or more all empty rows were removed. Read " + this.numberOfRowsRead + " rows and kept " + this.numberOfRowsUseable + ".");
		}
		// check column ID exists
		if (!thePdata.hasSeries('ID'))
		{
			isValid = false;
			this.reportErrors.push("ERROR: The column 'ID' does not exist in the file. This is a required column.");
		}
		// check column ID is first
		const firstColumnName = thePdata.getColumnNames()[0];
		if("ID"!==firstColumnName)
		{
			isValid = false;
			this.reportErrors.push("ERROR: The first column should be 'ID'. This is required.");
		}
		// check that ID rows are all populated and unique
		// Check if column 0 (column with name 'ID' in our case) contains duplicates
		const idValues = thePdata.getSeries('ID').toArray();
		const uniqueIdValues = new Set(idValues);
		if (idValues.length !== uniqueIdValues.size)
		{
			isValid = false;
			this.reportErrors.push("ERROR: The 'ID' column contains duplicate values. Values should be unique.");
		}
		// Check if column 0 contains empty strings
		if (idValues.some(id => id === ""))
		{
			isValid = false;
			this.reportErrors.push("ERROR: The 'ID' column contains empty strings. It should not contain empty strings.");
		}
		// check that header names do not contain tabs
		const colNames = thePdata.getColumnNames();
		if (colNames.some(id => id.includes('\t')))
		{
			isValid = false;
			this.reportErrors.push("ERROR: One or more column headers contain tabs. Headers should not contain tabs.");
		}
		// check that there are no duplicated column names
		if (new Set(colNames).size < colNames.length)
		{
			isValid = false;
			this.reportErrors.push("ERROR: The column headers should not contain duplicates.");
		}
		// check there is more than one column
		const colCount = thePdata.getColumnNames().length;
		if(colCount<2)
		{
			isValid = false;
			this.reportErrors.push("ERROR: At least two columns are required. Found " + colCount + ".");
		}
		// set OK message
		if (0 !== this.reportErrors.length)
		{
			this.reportMessage = this.reportErrors.length + " ERRORS found. Please remediate the pdata.csv and try again.";
		}
		else if (0 !== this.reportWarnings.length)
		{
			this.reportMessage = this.reportWarnings.length + " warnings found.";
		}
		else
		{
			this.reportMessage = "No problems found.";
		}
	}

	/**
	 * The `validatePdata` method reads from the provided pdata.csv file, validates the dataset and builds a new CSV file.
	 * The new CSV file has empty lines removed. It also has lines that are only empty strings removed.
	 * It also sets the path for the newly built CSV file for future use.
	 *
	 * @param {String} theFile - The name of the file containing pdata to be read and validated.
	 */
	validatePdata(theFile)
	{
		// read, dropping empty lines
		const pdata = dataForge.readFileSync(theFile).parseCSV({skipEmptyLines: true});
		this.validateDataset(pdata);
		this.buildCSV(pdata, path.join(path.dirname(theFile), "pdata_all.csv"));
		this.tempPathPdata = (path.join(path.dirname(theFile), "pdata_all.csv"));
	}
}

module.exports = PdataValidate;

/*
MIT License

Copyright (c) 2025 The University of Texas MD Anderson Cancer Center

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the 'Software'), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

// Adds the Metabolite data type to window.$PIPE.dataTypes.

// Input Name reference data. Table in CSV/TSV format.
const nameKeyTable = require("/workspace/metabolite_name_dictionary/Metabolite_name_reference.tsv");

// Return the type of data represented by this table.
// By default, returns the singular lower-case version of the type name.
// If options.plural is truthy, return the plural form.
// If options.capitalize is truthy, return with the first letter(s) capitalized.
//
function getCompoundType(options = {}) {
  const suffix = options.plural ? "s" : "";
  return (options.capitalize ? "M" : "m") + "etabolite" + suffix;
}

// Add this data type.
window.$PIPE.addDataType({
  // Name of this compound type. Equals getCompoundType().
  getCompoundType,
  // Data table from a TSV or CSV file:
  nameKeyTable,
  // Column used to name compounds in the data:
  compoundNamesColumn: "Curated Name",
  // Column used to name compounds in the pathway diagrams:
  displayNamesColumn: "Abbreviated Name",
  // Columns whose values must be unique:
  uniqueColumnNames: [
    "Compound Discoverer",
    "Refmet Name",
    "Curated Name",
    "Abbreviated Name",
    "Skyline",
  ],
  // Columns that can contain a dash to mean a purposefully omitted value.
  dashAllowedColumnNames: ["Compound Discoverer", "Skyline"],
});

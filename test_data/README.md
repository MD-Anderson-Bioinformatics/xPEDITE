# Data for Development Testing

The code for generating reports makes decisions based on the "process type" of the input data.
The process type is determined by the function `get_process_type()` in the script `process_type_script.R`.
There are 5 such "process types":

1. multi\_duplicates
2. multi\_no\_duplicates
3. single\_duplicates
4. single\_no\_duplicates
5. multi\_variates

The subdirectories here with these 5 names contain example data for the specified process type.
Within each subdirectory there is:

- pdata.csv: example pdata file for the process type
- analyzed\_data.csv: corresponding analyzed data file
- README

For some process types, there is an additional "pdata\_time-series.csv" file where one of the covariates
is time. This is helpful for testing some aspects of the report.

**NOTE:** The file format of the analyzed data files is suitable for all Analysis Tools other than "Trace Finder".

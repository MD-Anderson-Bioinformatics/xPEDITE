This directory contains a 'Rosetta Stone' file giving
the names of compounds in various naming systems:

1. Primary Pathway
   - The primary pathway this compound is associated with. Curated by the xPEDITE team.
2. Compound Discoverer
   - Compound names to expect in files from the Compound Discoverer software.
3. Trace Finder
   - Compound names to expect in files from the Trace Finder software.
4. Skyline
   - Compound names to expect in files from the Skyline software.
5. Refmet Name
   - https://www.metabolomicsworkbench.org/databases/refmet/index.php
6. Curated Name
   - Names curated for use by xPEDITE team.
7. Abbreviated Name
   - Shortened versions of the curated names for use in the pathway diagrams.

During preprocessing, the pipeline translates everything to
the 'Curated Name' and appends the 'Abbreviated Name' in
parentheses if it is different. All sections display the
compound names in this format, except for the pathway diagrams
which show only the 'Abbreviated Name'.

The 'Primary Pathway' is included in tables in the report to
allow sorting compounds by it.


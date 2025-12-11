# Process Type: multi\_no\_duplicates

"multi\_no\_duplicates" means:

- Exactly 2 covariates
  - First will be the 'major', second the 'minor', see function `get_MajorMinor()`
- For at all of the major covariate values, there no are duplicate values for any of the minor covariate values.
  - See `get_process_type()` and `check_duplicate()`

The 'pdata\_time-series.csv' file uses Time as the second covariate.

## Examples to illustrate:

This is `multi_no_duplicates` because there are no duplicate minor covariate values for any major covariate value:

| ID | major | minor |
| -- | ----- | ----- |
| s1 | A     | a     |
| s2 | A     | b     |
| s3 | A     | c     |
| s4 | A     | d     |
| s5 | B     | a     |
| s6 | B     | b     |

This is NOT `multi_no_duplicates` because for major covariate value 'A', there are duplicate
minor covariate values 'a' and 'b'. This is `multi_duplicates`:

| ID | major | minor |
|----|-------|-------|
| s1 | A     | a     |
| s2 | A     | a     |
| s3 | A     | b     |
| s4 | A     | b     |
| s5 | B     | a     |
| s6 | B     | b     |


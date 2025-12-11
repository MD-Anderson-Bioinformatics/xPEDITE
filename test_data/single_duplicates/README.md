# Process Type: single\_duplicates

"single\_duplicates" means:

- Only one covariate
  - This will be the 'major' covariate, see function `get_MajorMinor()`
- For at least one covariate value, there is more than one sample.
  - See function `get_process_type()`

## Example to illustrate

This is `single_duplicate` because there is more than one of the major covariate value 'A'.

| ID  | major |
| --- | ----- |
| s1  | A     |
| s2  | A     |
| s3  | B     |
| s4  | C     |

This is NOT `single_duplicate` because there is only one of each of the major covariate values.

| ID  | major |
| --- | ----- |
| s1  | A     |
| s2  | B     |
| s3  | C     |
| s4  | D     |


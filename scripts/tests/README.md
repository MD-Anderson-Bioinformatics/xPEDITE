This directory has basic tests for the R code.

Coverage is not complete.

Formal testing structure has not yet been implemented. For now, tests must be run
manually in the mp\_backend docker container. Here is an example:

Docker exec into running container:

```bash
docker exec -it mp_backend /bin/bash
```

In the container, cd to test directory and start an R session:

```bash
root@mp_backend:/app/$ cd scripts/tests/
root@mp_backend:/app/scripts/tests/$ R
```

In the R session, run the tests manually. For example:

```R
> source('test_data_validation.R')
```


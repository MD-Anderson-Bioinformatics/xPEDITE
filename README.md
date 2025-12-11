# xPEDITE

Multi-omics (x) PipelinE for Dataset Integration and Translational Exploration (xPEDITE) is a
web-based platform to generate interactive HTML data reports

## Setup Instructions

The following are basic setup instructions.

### 1. Acquire Accessory Docker Images

xPEDITE uses several other images:

1. NG-CHM (ngchm): available from [docker hub](https://hub.docker.com/r/ngchm/ngchm)
2. Pathways Visualization (pathwaysviz): available on GitHub
   - Follow build instructions: [https://github.com/MD-Anderson-Bioinformatics/sbgnviz_pathway](https://github.com/MD-Anderson-Bioinformatics/sbgnviz_pathway)

### 2. Configure Authentication

Authentication is configured by a required JSON-formatted `.authenticators` file that
is mounted to the container at run time.

**Example .authenticators for no authentication** (where every user is 'Guest User'):    
(note the ":" as part of the key):

```json
{
  "default:": "none"
}
```

**Example .authenticators for [LDAP-JWT](https://github.com/MD-Anderson-Bioinformatics/ldap-jwt) authentication**    
(note the ":" as part of the "default:" key):

```json
{
  "ldapjwt": {
    "name": "ldapjwt",
    "type": "ldapjwt",
    "spec": {
      "href": "https://<host name of LDAP-JWT server>/ldap-jwt/",
      "clientID":"<client ID of LDAP-JWT server>"
    }
  },
  "default:":"ldapjwt"
}
```

There are two required environment variables related to this file: `AUTHENTICATORS_PATH_HOST`
(the path to .authenticators on the host machine) and `AUTHENTICATORS_PATH` (the path to .authenticators
inside the container). See defaults in docker-compose.yml.

### 3. Build Images and Start Containers

If using LDAP-JWT authentication: set appropriate values for environment
variables `LDAP_JWT_HOST` and optional `AUTHORIZED_GROUP` before running docker compose.

```bash
docker compose build
docker compose up
```

### 4. Upload pdata File

Visit [https://localhost:9433/xPEDITE/index](https://localhost:9433/xPEDITE/index). Fill out the form, and upload a
pdata.csv file. Examples are provided in the test\_data directory.

Upon form submission, a new study will be created. Each study has exactly one
pdata.csv file, but can have multiple analyzed data files.

### 5. Upload Analyzed Data File

If using authentication, visit [https://localhost:9433/xPEDITE/login](https://localhost:9433/xPEDITE/login) to log in.

Visit [https://localhost:9433/xPEDITE/admin](https://localhost:9433/xPEDITE/admin) to view a table of existing studies.

For a given study, click the 'Select' button to go to that study's page.

On that study's page, click the check box to upload an analyzed data file. Examples are provided in the
test\_data directory.

### 5. Generate Report

On that same study's page, select appropriate options from the rest of the dropdowns and click
the 'Generate Report' button.

## Copyright and License information

This project contains code and templates under multiple licenses:

- **.Rmd, javascript, and HTML files**: MIT
  - scripts/pipeline\_report\_template.Rmd
  - scripts/child\_templates/*
  - scripts/js/dynamicANOVA.js
  - scripts/js/dynamicVolcano.js
  - scripts/js/plotMetabolites.js
  - scripts/js/Smooth.js
  - module\_sources/*
- **Third-party libraries in /scripts/resources**: as noted
  - The license and copyright information is as shown in these files
- **Everything else**: GPLv2

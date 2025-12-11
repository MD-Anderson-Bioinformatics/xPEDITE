# Copyright (C) 2025 The University of Texas MD Anderson Cancer Center
# 
# This file is part of xPEDITE.
#
# xPEDITE is free software: you can redistribute it and/or modify it under the terms of the
# GNU General Public License Version 2 as published by the Free Software Foundation.
#
# xPEDITE is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
# without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
# See the GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License along with xPEDITE.
# If not, see <https://www.gnu.org/licenses/>.

##  Two build targets:
##      - prod: for production deployments
##      - development: has extra packages useful for development


####
##  *** START of node-base ***
####

FROM node:22.4.1-bookworm-slim AS node-base

## Install openssh-client and openssh-server before ssh
## because otherwise ssh installs the version with CVE-2021-41617
RUN apt-get update && \
    apt-get install -y  --no-install-recommends \
      openssh-client \
      openssh-server && \
    apt-get install -y \
      apt-transport-https \
      build-essential \
      ca-certificates \
      cmake \
      cargo \
      curl \
      g++ \
      gdal-bin \
      git \
      gnupg \
      gsfonts \
      libc-dev \
      libcurl4-openssl-dev \
      libfontconfig1-dev \
      libfribidi-dev \
      libgdal-dev \
      libharfbuzz-dev \
      libmagick++-dev \
      libsodium-dev \
      libssl-dev \
      libudunits2-dev \
      libv8-dev \
      libxml2-dev \
      libxslt-dev \
      make \
      pandoc \
      r-base=4.2.2.20221110-2 \
      r-base-dev=4.2.2.20221110-2 \
      software-properties-common \
      ssh \
      zip && \
    curl -fsSL https://packages.adoptium.net/artifactory/api/gpg/key/public | apt-key add - && \
    echo "deb https://packages.adoptium.net/artifactory/deb $(awk -F= '/^VERSION_CODENAME/{print$2}' /etc/os-release) main" | tee /etc/apt/sources.list.d/adoptium.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends temurin-17-jdk && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

####
##  *** END of node-base ***
####

####
##  *** START of rlibs-base ***
####

FROM node-base AS rlibs-base

WORKDIR /app

# directory `scripts` contains the R code for the pipeline
# Copy in just the parts needed for renv (so that if other code changes,
# docker cache is not invalidated)
COPY scripts/.Rprofile /app/scripts/.Rprofile
COPY scripts/renv.lock /app/scripts/renv.lock
COPY scripts/renv/activate.R /app/scripts/renv/activate.R
COPY scripts/renv/settings.json /app/scripts/renv/settings.json

RUN R -e "install.packages('renv', repos = c(CRAN = 'https://cloud.r-project.org'))" && \
    R CMD javareconf && \
    cd scripts && \
    Rscript -e "renv::restore();"

####
##  *** END of rlibs-base ***
####

####
##  *** START of modules-base ***
####
##

FROM node-base AS modules-base

## The sources of all modules within the package:
ADD module-sources /module-sources

# Modules installed from /module-sources:
ARG LOCAL_SOURCES="data-loader metabolite_name_dictionary"

# The following module(s) are compiled at container build time:
ARG STATIC_MODULES="metabolite_name_dictionary"
# The following module(s) are compiled at report generation time:
ARG DYNAMIC_MODULES="data-loader"

ARG ALL_MODULES="$STATIC_MODULES $DYNAMIC_MODULES"

# Create /workspace and its package.json listing ALL_MODULES:
RUN mkdir /workspace && \
    M='' && \
    for module in $ALL_MODULES ; do \
      echo Including $module ; \
      if [ "X$M" != X ] ; then M="$M, " ; fi ; \
      M="$M"' "'$module'"' ; \
    done && \
    echo '{\n  "name": "xpedite",\n  "workspaces": [' $M ']\n}' > /workspace/package.json

# Copy all the modules into /workspace and npm install them.
RUN for resource in $LOCAL_SOURCES ; do \
     echo Copying $resource && \
     cp -r /module-sources/$resource /workspace/$resource ; \
    done && \
    cd /workspace && \
    npm install --force && \
    npm cache clean --force

# Generate static modules
RUN for module in $STATIC_MODULES ; do \
      echo Compiling module $module && \
      cd /workspace/$module && \
      mkdir -p /workspace/report-modules/$module && \
      OUTPUT_DIR=/workspace/report-modules/$module npm run build ; \
    done

####
##  *** END of modules-base ***
####


FROM node-base AS prod

ARG NODE_UID=1001
ARG NODE_USER=nodeuser
ARG NODE_GID=1001
ARG NODE_GRP=nodegroup

COPY --from=modules-base /usr/local/lib/node_modules /usr/local/lib/node_modules
COPY --from=modules-base /workspace /workspace
COPY --from=modules-base /module-sources /module-sources

## Copy in the website node app
COPY backend/app /app

## The scripts directory contains the R code for the pipeline
COPY ../scripts /app/scripts
COPY --from=rlibs-base /app/scripts/renv.lock /app/scripts/renv.lock
COPY --from=rlibs-base /app/scripts/renv /app/scripts/renv
COPY --from=rlibs-base /app/scripts/.cache /app/scripts/.cache

# Define where to save the pathway-loader section generated by the
# pathways cotainer.
ARG PATHWAY_LOADER=/workspace/report-modules/pathway-loader

##
## Install node packages
## Create ${NODE_USER} user
## and final fixups.
##
RUN cd /app && npm install --omit=dev && \
    npm cache clean --force && \
    useradd -l -u ${NODE_UID} -r ${NODE_USER} -m -d /home/${NODE_USER} && \
    groupadd -g ${NODE_GID} ${NODE_GRP} && \
    usermod -g ${NODE_GRP} ${NODE_USER} && \
    mkdir -p /data/ && \
    mkdir -p /reports/ && \
    mkdir -p ${PATHWAY_LOADER} && \
    chown -R ${NODE_USER}:${NODE_GRP} /home/${NODE_USER} ${PATHWAY_LOADER} /data /reports /app && \
    R CMD javareconf

EXPOSE 3000

USER ${NODE_USER}
WORKDIR /app

CMD ["npm", "start"]

####
##  *** END of prod ***
####


FROM prod AS development

USER root

RUN apt-get update && apt-get install -y vim jq && \
    npm install && \
    mkdir -p /etc/skel   && \
    printf 'PS1="\033[1;32m\u@xpedite_backend:\w/$\033[0m "\nalias ls="ls --color=auto"\nalias vi=vim\n' >> /etc/skel/.bashrc && \
        printf "syntax on\n:set hlsearch\n:set ruler\n:set ts=2\n:set list\n:set listchars=tab:<>\ninoremap jj <ESC>" >> /etc/skel/.vimrc && \
    cp /etc/skel/.bashrc /root/  && \
    cp /etc/skel/.vimrc  /root/  && \
    cp /etc/skel/.bashrc /home/${NODE_USER}/  && \
    cp /etc/skel/.vimrc  /home/${NODE_USER}/

CMD ["npm", "run", "startDev"]

USER ${NODE_USER}


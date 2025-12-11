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

##
## Dockerfile for mongodb container
##
## Followed mongodb installation instructions
## https://www.mongodb.com/docs/manual/tutorial/install-mongodb-on-debian/
##
FROM debian:bullseye-slim

ENV MONGO_MAJOR 7.0

RUN apt-get update && \
    apt-get install -y gnupg curl gosu && \
    curl -fsSL https://pgp.mongodb.com/server-${MONGO_MAJOR}.asc | \
    gpg -o /usr/share/keyrings/mongodb-server-${MONGO_MAJOR}.gpg \
    --dearmor && \
    echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-${MONGO_MAJOR}.gpg ] http://repo.mongodb.org/apt/debian bullseye/mongodb-org/${MONGO_MAJOR} main" | \
        tee /etc/apt/sources.list.d/mongodb-org-${MONGO_MAJOR}.list && \
    apt-get update && \
    apt-get install -y mongodb-org && \
    mkdir -p /data/db /data/configdb && \
    chown -R mongodb:mongodb /data/db /data/configdb

COPY docker-entrypoint.sh /usr/local/bin/

ENTRYPOINT ["docker-entrypoint.sh"]

VOLUME ["/data/db", "/data/configdb"]

EXPOSE 27017

USER mongodb

CMD ["mongod"]


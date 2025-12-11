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
## nginx proxy image
##

FROM nginx:alpine3.18-slim

ARG NGINX_UID=1001
ARG NGINX_GID=1001
ARG NGINX_GRP=nginx_grp

COPY default.conf /etc/nginx/conf.d/default.conf
COPY ldap-jwt.conf.template /ldap-jwt.conf.template
COPY nginx-logrotate /etc/logrotate.d/nginx
COPY docker-entrypoint.sh /docker-entrypoint.sh

RUN apk update && apk add --no-cache logrotate openssl shadow && \
     groupadd -g ${NGINX_GID} ${NGINX_GRP} && \
     usermod -u ${NGINX_UID} -g ${NGINX_GRP} nginx && \
     mkdir -p /etc/ssl/certs/ && \
     cd /etc/ssl/certs/ && \
     openssl req -x509 -nodes -newkey rsa:4096 -keyout key.pem -out cert.pem -sha256  -days 3650 \
         -subj "/C=US/ST=Texas/L=Houston/O=MDA/OU=BCB/CN=nginx"  && \
    touch /var/run/nginx.pid && \
    mkdir -p /etc/nginx/snippets && \
    mkdir /logs && \
    chown -R nginx:nginx /var/cache/nginx \
                         /var/run \
                         /var/log/nginx \
                         /etc/ssl/certs \
                         /etc/nginx/conf.d \
                         /etc/nginx/snippets \
                         /var/run/nginx.pid \
                         /logs \
                         /docker-entrypoint.sh && \
    chmod u+x /docker-entrypoint.sh

USER nginx

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]


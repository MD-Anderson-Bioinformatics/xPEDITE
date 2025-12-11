#!/bin/sh

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

set -e

if [ -n "${LDAP_JWT_HOST}" ]; then
  echo "Configuring for LDAP-JWT authentication"
  envsubst '${LDAP_JWT_HOST} ${URL_PATHNAME}' < /ldap-jwt.conf.template > /etc/nginx/snippets/ldap-jwt.conf
else
  echo "No authentication configured"
  # make sure there's an empty file so nginx doesn't crash on a failed include
  touch /etc/nginx/snippets/ldap-jwt.conf
fi

exec "$@"

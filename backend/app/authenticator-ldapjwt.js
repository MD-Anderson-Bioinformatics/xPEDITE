/*

Copyright (C) 2025 The University of Texas MD Anderson Cancer Center

This file is part of xPEDITE.

xPEDITE is free software: you can redistribute it and/or modify it under the terms of the
GNU General Public License Version 2 as published by the Free Software Foundation.

xPEDITE is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with xPEDITE.
If not, see <https://www.gnu.org/licenses/>.

*/

"use strict";

const log = require("./log")(__filename);

/* Authentication module for 'ldapjwt'.
 *
 * An ldapjwt authentication specification must include the following:
 *
 *  {
 *      href: 'YOUR-LDAPJWT-SERVER-URL/',
 *      clientID: 'YOUR-CLIENT-ID',
 *  }
 *
 *  Notes:
 *  - Replace YOUR-LDAP-SERVER-URL and YOUR-CLIENT-ID by your values.
 */
log.debug("Starting ldap-jwt authenticator");

const axios = require('axios');

/* Return true iff the given authenticator specification meets our
 * requirements.
 */
exports.isValidAuthenticator = function(config) {

    /* Verify that field f is included in config and is a non-empty string. */
    function badField(f) {
        return !config.hasOwnProperty(f) || typeof config[f] !== 'string' || config[f].length === 0;
    }

    if (!config) {
        log.warn('Ldapjwt specification is missing.');
        return false;
    }

    /* Config must contain valid strings for each of the following. */
    const requiredFields = ['href', 'clientID'];
    const missingFields = requiredFields.filter(badField);
    if (missingFields.length > 0) {
        log.warn('Ldapjwt configuration missing required field(s): ' + missingFields.join(' '));
        log.warn(config);
        return false;
    }

    if (config.href.substr(config.href.length - 1) !== '/') {
        log.warn('Ldapjwt href must end in a /');
        log.warn(config);
        return false;
    }

    log.debug('Ldapjwt configuration is valid');
    return true;
};

/* Given the authenticator config and an accessToken return a promise for
 * the user's profile.
 */
exports.getProfile = function(conf, accessToken) {
    log.debug("Top of getProfile");
    log.debug('Attempting to validate accessToken: ' + accessToken);
    if (!conf || !conf.href || !conf.clientID) {
        log.warn('Ldapjwt: bad authenticator specification:');
        log.warn(conf);
        return Promise.reject(new Error('Ldapjwt: bad authenticator specification'));
    }
    let verifyURL = conf.href + 'verify';
    log.debug("Making post request to verify URL: " + verifyURL);
    log.debug("accessToken: " + accessToken);
    return axios.post(verifyURL, {
            token: accessToken
        })
        .then(userInfo => {
            if (!userInfo) {
                log.error('Failed to get ldapjwt user profile for ' + token);
                throw new Error('Failed to get ldapjwt user profile for ' + token);
            }
            if (userInfo.data.aud !== conf.clientID) {
                log.debug('userInfo.data.aud !== conf.clientID');
                log.debug('userInfo.data:');
                log.debug(userInfo.data);
                log.debug('conf:');
                log.debug(conf);
                throw new Error('Ldapjwt user profile clientID ' + userInfo.data.aud +
                    ' does not match the required clientID ' + conf.clientID);
            }
            if (!userInfo.data.name) userInfo.data.name = userInfo.data.full_name;
            log.debug('Ldapjwt.getProfile returning:');
            log.debug(JSON.stringify(userInfo.data, null, 10));
            return userInfo.data;
        })
        .catch(err => {
            log.error("Error in verifying token: ")
            log.error(err);
        });
};

/* Ldapjwt returns the expiry date as profile.exp.
 */
exports.isStillValid = function(spec, profile) {
    return profile.exp && Date.now() < profile.exp ? profile : null;
};



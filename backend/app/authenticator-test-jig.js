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
const log = require('./log')(__filename);

/* Authentication module for 'test-jig'.
 *
 * It is impossible to authenticate using this module.  It is provided
 * so that an authenticator spec can be provided if needed, but you
 * don't want to authenticate anyone.
 */

log.debug('Starting with test-jig authenticator !!!');
log.debug("   ...better if this weren't loaded unless configured to use.");

/* Return true iff the given authenticator specification meets our
 * requirements.
 */
exports.isValidAuthenticator = function(config) {
    /* It doesn't matter what you specify. */
    return true;
};

/* Given the authenticator config and an accessToken return a promise for
 * the user's profile.
 */
/*
 	The profile dui currently uses has:
{
  "exp": 1558370618735,
  "aud": "7747ye4FBRRSMbGafKLVOJnvNh-7Vk3rbwdCQjjzzD79_EEqoNh13xoARdtGI2EfF5SErWqgyJnEMxzCq9_Ktw",
  "user_name": "cwakefield",
  "full_name": "Wakefield,Chris",
  "mail": "cwakefield@mdanderson.org"
}
*/
exports.getProfile = function(conf, accessToken) {
    //return Promise.reject (new Error('Impossible to authenticate access token ' + accessToken));
    return Promise.resolve({
        user_name: "cwakefield",
        full_name: "Wakefield,Chris",
        mail: "cwakefield@mdanderson.org"
    });
    // Eventually add a "exp" member
}

/* Always valid?
 */
exports.isStillValid = function(spec, profile) {
    return profile;
    // Eventually check if expired
};

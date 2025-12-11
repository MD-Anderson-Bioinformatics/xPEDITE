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

const fs = require('fs');



function addToBlackList(blacklistPath, samples) {
    let data = fs.readFileSync(blacklistPath);
    let content = JSON.parse(data);
    for (let sample of samples) {
        content.analyzeddata.push(sample)
        content.pdata.push(sample)
    }
    fs.writeFileSync(blacklistPath, JSON.stringify(content))
}


function removeFromArray(array, item) {
    const index = array.indexOf(item);
    if (index > -1) {
        array.splice(index, 1);
    }
    return array
}

function getDate() {
    var today = new Date();
    var dd = String(today.getDate()).padStart(2, '0');
    var mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
    var yyyy = today.getFullYear();
    var hour = today.getHours()
    var min = today.getMinutes()
    var sec = today.getSeconds()
    return mm + dd + yyyy + "_" + hour + min + sec
}

module.exports = {
    addToBlackList: addToBlackList,
    removeFromArray: removeFromArray,
    getDate: getDate
}
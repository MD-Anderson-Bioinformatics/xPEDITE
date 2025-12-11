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

var GroupModal = (function() {
    var changeGroupNum = function() {
        let numSubGroup = $("#numSubGroup").val()
        $(".inputModalSubGroup").remove()
        for (let i = 0; i < numSubGroup; i++) {
            let input = document.createElement("input")
            input.setAttribute('id', 'sub_' + i)
            input.setAttribute('class', "inputModalSubGroup")
            $("#groupModalBody").append(input)
        }
    }

    var saveGroup = function() {
        let groupType = $("#groupType").val()
        if (groupType == "Other") {
            groupType = $("#otherGroup").val()
        }
        let i = 0
        if ($(`#${groupType}_sub`).length > 0) {
            $(`#${groupType}_sub`).remove()
            $("input[id^=" + groupType + "_sub]").remove()
        }
        if ($(".inputModalSubGroup").length > 0) {
            let groupTypeElement = document.createElement('p')
            groupTypeElement.setAttribute('class', "sample_group")
            groupTypeElement.setAttribute('id', `${groupType}_sub`)
            groupTypeElement.append(groupType)
            $("#sampleGroupDisplay").append(groupTypeElement)
            $(".inputModalSubGroup").each(function() {
                console.log($(this).val())
                let input = document.createElement("input")
                input.setAttribute('id', groupType + '_sub_' + i)
                input.setAttribute('class', "inputSubGroup")
                input.setAttribute('value', $(this).val())
                $("#sampleGroupDisplay").append(input)
                i = i + 1
            })
        }
        $("#inputSampleButton").click()
    }

    var bindFunctions = function() {
        $("#numSubGroup").bind("keyup", changeGroupNum)
        $("#saveGroup").on('click', saveGroup)
        $("#groupType").change(function() {

            $(".inputModalSubGroup").remove()
            if ($(this).val() == "Other") {
                $("#otherGroupdiv").show()
            } else {
                $("#otherGroupdiv").hide()
            }
        })
    }

    var init = function() {
        bindFunctions();
    };

    return {
        init: init
    }
})();
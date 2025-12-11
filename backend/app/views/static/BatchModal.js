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

var BatchModal = (function() {

    var changeBatchNum = function() {
        let numSubBatch = $("#numSubBatch").val()
        $(".inputModalSubBatch").remove()
        for (let i = 0; i < numSubBatch; i++) {
            let input = document.createElement("input")
            input.setAttribute('id', 'batch_' + i)
            input.setAttribute('class', "inputModalSubBatch")
            $("#batchModalBody").append(input)
        }
    }

    var saveBatch = function() {
        let batchType = $("#batchType").val()
        if (groupType == "Other") {
            batchType = $("#otherBatch").val()
        }
        let i = 0

        if ($(`#${batchType}_sub`).length > 0) {
            $(`#${batchType}_sub`).remove()
            $("input[id^=" + batchType + "_sub]").remove()
        }
        if ($(".inputModalSubBatch").length > 0) {
            let batchTypeElement = document.createElement('p')
            batchTypeElement.setAttribute('class', "sample_batch")
            batchTypeElement.setAttribute('id', `${batchType}_sub`)
            batchTypeElement.append(batchType)
            $("#sampleBatchDisplay").append(batchTypeElement)

            $(".inputModalSubBatch").each(function() {
                let input = document.createElement("input")
                input.setAttribute('id', batchType + '_sub_' + i)
                input.setAttribute('class', "inputSubBatch")
                input.setAttribute('value', $(this).val())
                $("#sampleBatchDisplay").append(input)
                i = i + 1
            })
        }
        $("#inputSampleButton").click()
    }

    var bindFunctions = function() {

        $("#numSubBatch").bind("keyup", changeBatchNum)
        $("#saveBatch").on('click', saveBatch)
        $("#batchType").change(function() {
            $("#numSubBatch").val(0)
            $(".inputModalSubBatch").remove()
            if ($(this).val() == "Other") {
                $("#otherBatchdiv").show()
            } else {
                $("#otherBatchdiv").hide()
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
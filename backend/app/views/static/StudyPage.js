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

var StudyPage = (function() {
    let rootPath = "/" + window.location.pathname.split('/')[1];
    // Determine success status of reports and display information appropriately
    document.addEventListener('DOMContentLoaded', function() {
       if (!window.location.pathname.includes("search_study")) return; //return early if not search_study page
                     // because this script is loaded by header.ejs, and is used on study.ejs and in custom.js.
                     // But on other pages this event listener causes errors due to missing elements (e.g. #generated_reports).
                     // TODO: cleanup when this script is loaded so we don't need to check for pathname
        let selectedReport = {
            reportName: $("#generated_reports").val(),
            studyName: $("#studyNameID").html().trim(),
        }
        $.get(rootPath + '/show_report', selectedReport).done(function(fileName, status) {
            enableAllButtons();
        }).fail(function() {
            // then there are either no reports or report selected in dropdown is failed
            document.getElementById("generated_reports").options.length == 0 ? disableAllButtons() : setFailedReportButtons();
        })
        markFailedReports();
        document.getElementById('generated_reports').addEventListener('change', function () {
            $("#runStatus").hide()
            $("#status").text("") // clear so text doesn't flash on screen when next report started
            markFailedReports();
            setButtonsForSelectedReport();
        });
    });

   function setButtonsForSelectedReport() {
            let selectedReport = {
                reportName: $("#generated_reports").val(),
                studyName: $("#studyNameID").html().trim(),
            }
            $.get(rootPath + '/show_report', selectedReport).done(function(fileName, status) {
                enableAllButtons();
            }).fail(function() {
                setFailedReportButtons();
            })
   }

   // Appends ' (FAILED)' to failed report names in the dropdown.
   // This function makes a request for each report, which is inefficient.
   // TODO: refactor to make a single request for all reports in the study
   let markFailedReports = function() {
       for (let i = 0; i < $("#generated_reports")[0].options.length; i++) {
           let reportData = {
               reportName: $("#generated_reports")[0].options[i].value,
               studyName: $("#studyNameID").html().trim(),
           }
           $.get(rootPath + '/show_report', reportData).done().fail(function(data) {
               let shortReportName = data.responseText.split(": ")[1]
               let option = document.querySelector('select#generated_reports option[value="'+ shortReportName + '"]')
               // Remove ' (FAILED)' to prevent ' (FAILED) (FAILED)' from appearing in dropdown
               if (option) option.text = option.text.replace(" (FAILED)", "") + " (FAILED)"
           })
       }
   };

    var showReport = function() {
        let data = {
            reportName: $("#generated_reports").val(),
            studyName: $("#studyNameID").html().trim(),
        }
        $.get(rootPath + '/show_report', data)
            .done(function(fileName, status) {
                var getUrl = window.location;
                var baseUrl = getUrl.protocol + "//" + getUrl.host + rootPath + "/show/" + fileName;

                var client = new HttpClient();
                var studyName = fileName.split("/")[0]
                client.get(baseUrl, function(response) {
                    let addition = '<input type="button" name="' + studyName + '" class="btn btn-primary btn-sm padbutton" id="back_to_project" value="Back to project" style="margin-left:10px" />'
                    document.open();
                    document.write(addition + response);
                    document.write('<script>$("#back_to_project").on("click", (event)=>{let study_name = event.target.name;$.ajax({statusCode: {401: function () {window.location = window.location.protocol + "//" + window.location.hostname + ":" + window.location.port + "/" + window.location.pathname.split("/")[1] + "/login"}},url: "/" + window.location.pathname.split("/")[1] + "/search_study/" + study_name, type:"GET",success: function (result) {document.open();document.write(result);document.close();}});}); document.documentElement.scrollTop = 0;</script>')
                    document.close();
                });
            }).fail(function(data) {
                if (data.responseText == "authentication required") {
                    window.location.href = window.location.protocol + "//" + window.location.hostname + ":" + window.location.port + rootPath + "/login"
                }
            })
    }

    var downloadReport = function() {
        let uri = rootPath + '/download_report?reportName=' + $("#generated_reports").val() + "&studyName=" + $("#studyNameID").html().trim()
        let anchor = document.createElement("a");
        document.body.appendChild(anchor);

        fetch(uri, {})
            .then(response => response.blob())
            .then(blobby => {
                let objectUrl = window.URL.createObjectURL(blobby);
                anchor.href = objectUrl;
                anchor.download = $("#generated_reports").val() + ".html";
                anchor.click();
                window.URL.revokeObjectURL(objectUrl);
            });
    }

    var downloadLogs = function() {
        let uri = rootPath + '/download_logs?reportName=' + $("#generated_reports").val() + "&studyName=" + $("#studyNameID").html().trim()
        let anchor = document.createElement("a");
        document.body.appendChild(anchor);

        fetch(uri, {})
            .then(response => response.blob())
            .then(blobby => {
                let objectUrl = window.URL.createObjectURL(blobby);
                anchor.href = objectUrl;
                anchor.download = $("#generated_reports").val() + "_logs.zip";
                anchor.click();
                window.URL.revokeObjectURL(objectUrl);
            });
    }

    var removeReport = function() {
        var reportName = $("#generated_reports").val()
        var result = confirm("Want to remove  report " + reportName + "?");
        if (result) {
            $.ajax({
                statusCode: {
                    400: function(error) {
                        console.log(error.responseText)
                        alert(error.responseText);
                    },
                    401: function() {
                        window.location = window.location.protocol + "//" + window.location.hostname + ":" + window.location.port + "/login"
                    }
                },
                url: rootPath + '/remove_report' + '?' + $.param({
                    "studyName": $("#studyNameID").html().trim(),
                    "reportName": reportName
                }),
                type: 'DELETE',
                success: function(reports) {
                    console.log(reports)
                    updateReportOptions(reports)
                    if (reports.length > 0) $("#generated_reports").val(reports[0])
                }
            });
        }
    }


    var copyColume = function() {

        var btn = $(this);
        btn.prop("disabled", true);
        var colData = "";
        $(btn.data("target")).each(function() {
            colData += $(this).text().trim() + "\n";
        });
        console.log(colData)

        Utils.copyToClipboard(colData.trim());

        var btn_txt = btn.html();

        btn.html("Copied");

        setTimeout(function() {
            btn.html(btn_txt);
            btn.prop("disabled", false);
        }, 1500);

    }


    let statusCheckTimer;
    function generateReport(reportName) {
        var cols = document.querySelectorAll(".colheader")
        var rows = document.querySelectorAll(".adminrow")
        let covariates = []
        let samples = []
        $.each(cols, function(k, value) {
            if (!value.checked) {
                covariates.push($(this).parent().text().trim())
            }
        })
        $.each(rows, function(k, value) {
            if (!value.checked) {
                samples.push($(this).parent().next().next().text().trim())
            }
        })
        let data = {
            studyName: $("#studyNameID").html().trim(),
            normalization: $('#normalization_method').val(),
            reportName: reportName,
            covariates: JSON.stringify(covariates),
            samples: JSON.stringify(samples),
            assay_type: $('#assay_type').val(),
            tool_used: $('#tool_used').val(),
            datafile: $('#uploaded_files').val()
        }
        $("#spinwheel").show()
        $.ajax({
            statusCode: {
                500: function(data) {
                    clearInterval(statusCheckTimer);
                    $("#runStatus").hide()
                    $("#spinwheel").hide()
                    if (data.responseText == "Duplicate report name.") {
                        alert("This report name already exists. Please use another name.")
                    } else if (data.responseText == "Invalid report name.") {
                        alert("Invalid report name. Please use another name.")
                    } else {
                        alert("Report generation error. Please try a different name or contact support.");
                    }
                },
                200: async function() {
                    userHasScrolled = false; // keep track of whether user has scrolled #status code block
                    await checkStatus(reportName); // Check status immediately
                    statusCheckTimer = setInterval(async () => {
                        await checkStatus(reportName)
                    }, 2000); // Then set up interval for subsequent checks
                },
                401: function() {
                    clearInterval(statusCheckTimer);
                    window.location = window.location.protocol + "//" + window.location.hostname + ":" + window.location.port + "/login"
                }
            },
            url: rootPath + "/generate_report",
            type: 'POST',
            dataType: 'json',
            data: data
        });
    }


    var generate_Report = function() {
        let currentTime = Utils.getDateTime()
        let defaultName = $("#studyNameID").html().trim() + "_" + $('#normalization_method').val() + "_" + currentTime
        $("#reportNameInput").val(defaultName);
        $("#reportNameModal").modal('show').on('shown.bs.modal', function() {
          $("#reportNameInput").select(); // to make it easy for user to edit the default name
        });
        $("#reportNameInput").off('keypress').on('keypress', function(e) { // save report if user presses Enter key
          if (e.which === 13) { // code for Enter key
            e.preventDefault();
            $("#saveReportName").click();
          }
        });
        $("#saveReportName").off('click').on('click', function() {
          let reportName = $("#reportNameInput").val().trim();
          // regex allow alphanumeric, underscores, hyphens, periods, and spaces (but cannot start or end with space).
          // Also, words in the report name must start with an alphanumeric character.
          if (!reportName || !/^[a-zA-Z0-9][a-zA-Z0-9_\-.]*(?:[ ][a-zA-Z0-9][a-zA-Z0-9_\-.]*)*$/.test(reportName)) {
            $("#reportNameInput").addClass('is-invalid');
            return;
          }
          $("#reportNameModal").modal('hide');
          $("#runStatus").show();
          updateSampleInfo(reportName, generateReport);
        });
        $("#reportNameInput").on('input', function() {
          $(this).removeClass('is-invalid');
        });
    }

    var update_SampleInfo = function() {
        updateSampleInfo(null, null)
    }

    var updateSampleInfo = function(reportName, callback) {
        var frm = $('#adminSampleForm');
        var elements = document.querySelectorAll(".newColumn")
        var newheaders = document.querySelectorAll(".newHeader")
        var checkempty = true
        for (var i = 0, element; element = elements[i++];) {
            if (element.value === "")
                checkempty = false
        }
        if (checkempty) {
            $(".sampleID").each((i, obj) => {
                $("input[name='sample_id_" + i + "']").remove()
                $("<input />").attr("type", "hidden")
                    .attr("name", "sample_id_" + (i))
                    .attr("value", $(obj).html().trim())
                    .appendTo(frm);
            })
            $("input[name='numNewheaders']").remove()
            $("<input />").attr("type", "hidden")
                .attr("name", "numNewheaders")
                .attr("value", newheaders.length)
                .appendTo(frm);
            let index = 0
            for (let newheader of newheaders) {
                $("input[name='extra" + index + "']").remove()
                $("<input />").attr("type", "hidden")
                    .attr("name", "extra" + index)
                    .attr("value", newheader.innerHTML.split("<")[0].trim())
                    .appendTo(frm);
                index += 1
            }

            $.ajax({
                type: frm.attr('method'),
                url: rootPath + frm.attr('action'),
                data: frm.serialize(),
                success: function(data) {
                    if (callback != null) callback(reportName)
                },
                statusCode: {
                    401: function() {
                        window.location = window.location.protocol + "//" + window.location.hostname + ":" + window.location.port + "/login"
                    },
                    200: function(message) {
                        console.log(message)
                    },
                    500: function(error) {
                        console.log(error)
                    }
                },
            });
        } else {
            alert("New column can't be empty or zero.")
        }
    }

    var delete_SampleInfo = function() {
        console.log("close this");
        var removeIDs = [];
        [...document.querySelectorAll('#adminSampleTable th')].forEach((ele, i) => {
            var chkbox = ele.querySelector("input")
            if (chkbox != null && true == chkbox.checked) {
                removeIDs.push(i)
            }
        })
        removeIDs.reverse().forEach((i) => {
            $('#adminSampleTable tr').find(`td:eq(${i}),th:eq(${i})`).remove();
        })
    }


    var showMessage = function(message) {
        $("#status").text(message)
        if (!userHasScrolled) { // then scroll to bottom of #status code block
          $("#status").scrollTop($("#status")[0].scrollHeight);
        }
        $("#runStatus").addClass("ok_status");
        $("#runStatus").removeClass("error_status");
        if (message.toLowerCase().includes("error")) {
          $("#runStatus").addClass("error_status");
          $("#runStatus").removeClass("ok_status");
        }
    }

    let userHasScrolled = false; // keep track of whether user has scrolled #status code block
    var checkStatus = async function(reportName) {
        $("#status").on("wheel", function() { // this detects if user is scrolling
           userHasScrolled = true;
           // if user has scrolled to bottom, reset the flag so that the next message will scroll to bottom
           if ($("#status")[0].scrollHeight - $("#status").scrollTop() - $("#status").outerHeight() < 1) {
             userHasScrolled = false;
           }

        });
        let data = {
            studyName: $("#studyNameID").html().trim(),
            reportFolder: reportName,
        }
        let response = await fetch(rootPath + "/check_status?" + new URLSearchParams(data), {
            method: 'GET',
            withCredentials: true,
            credentials: 'include',
        });
        if (response.status != 200) {
            showMessage(response.statusText);
            return;
        }
        let message = await response.text();
        showMessage(message);
        if (message.includes("Report saved") || message.toLowerCase().includes('error')) { // report generated or failed
            clearInterval(statusCheckTimer);
            $("#spinwheel").hide()
            if (message.includes("Report saved")) {
                $("#runStatus").hide() // only hide status if success
                $("#status").text("") // clear so text doesn't flash on screen when next report is started
            }
            $.ajax({
                type: "GET",
                url: rootPath + "/get_reports",
                data: data,
                success: function(reports) {
                  reports = JSON.parse(reports)
                  // most recent report is first in the list, and will be selected by default
                  updateReportOptions(reports)
                  markFailedReports();
                  setButtonsForSelectedReport();
                }
            });
        }
    }


    var updateReportOptions = function(reports) {
        $("#generated_reports").html('')
        $.each(reports, function(key, value) {
            $("#generated_reports").append('<option value="' + value + '">' + value + '</option>');
        });

    }

    var headerChecking = function(event) {
        var elements = document.querySelectorAll(".colheader")
        let covariates = []
        $.each(elements, function(k, value) {
            if (value.checked) {
                covariates.push($(this).parent().text().trim())
            }
        })
        console.log(covariates)
    }


    var checkheaders = function(event) {
        headerChecking(event)
    }


    var checkall = function() {
        console.log(("#checkall").checked)
        if ($("#checkall").is(":checked")) {
            $(".adminrow").prop('checked', true);
        } else {
            $(".adminrow").prop('checked', false);
        }
    }

    var adminrow = function() {
        var rows = document.querySelectorAll(".adminrow")
        $.each(rows, function(k, value) {
            if (!value.checked) {
                $("#checkall").prop('checked', false);
            }
        })

    }


    var submitData = function(e) {
        if ($("input[name='studyName']").length == 0) {
            $("<input />").attr("type", "hidden")
                .attr("name", "studyName")
                .attr("value", $("#studyNameID").html().trim())
                .appendTo(this);
        }
        e.preventDefault(); // avoid to execute the actual submit of the form.

        var form = $(this);
        var url = form.attr('action');
        var formData = new FormData(this);
        $.ajax({
            type: "POST",
            url: rootPath + url,
            data: formData,
            async: false,
            success: function(fileName) {
                $("#analyzedFileReady").text("The file with the name '" + fileName + "' has been uploaded successfully.")
                var exists = 0 != $('#uploaded_files option[value="' + fileName + '"]').length;
                if (!exists) {
                    $('#uploaded_files').append(`<option value="${fileName}">
                                        ${fileName}
                                    </option>`);
                }
                $("#uploaded_files").val(fileName)
                $("#generateReport").show()
            },
            statusCode: {
                401: function() {
                    window.location = window.location.protocol + "//" + window.location.hostname + ":" + window.location.port + "/login"
                }
            },
            cache: false,
            contentType: false,
            processData: false
        });
        return true;
    }

    var backAllStudies = function() {
        window.location.href = window.location = window.location.protocol + "//" + window.location.hostname + ":" + window.location.port + rootPath + '/admin/'

    }



    var bindFunctions = function() {
        $("#back_all_studies").on('click', backAllStudies)
        $("#showReport").on("click", showReport)
        $("#downloadReport").on('click', downloadReport)
        $("#downloadLogs").on('click', downloadLogs)
        $("#removeReport").off().on('click', removeReport)
        $(".CopyColumn").on('click', copyColume)
        $("#generateReport").off().on('click', generate_Report)
        $("#updateSampleInfo").on('click', update_SampleInfo)
        $("#adminSampleTable thead").on('click', ".colheader", checkheaders)
        $("#checkall").on('click', checkall)
        $(".adminrow").on('click', adminrow)
        $("#uploadanalyzedForm").on('submit', submitData)
        $("#analyzedFile").on('click', function() {
            $("#analyzedFile").val('');
        });
        $("#addGroupInfo").click(() => {
            Utils.add_table_column("adminSampleTable", "group")
        })
        $("#addBatchInfo").click(() => {
            Utils.add_table_column("adminSampleTable", "batch")
        })
        $("#deleteSampleColumn").on('click', delete_SampleInfo)

        $("#uploadanalyzedFile").click(() => {
            if (!$("#uploadanalyzedFile").is(":checked")) {
                $("#uploadanalyzedFileSection").hide()
            } else {
                $("#uploadanalyzedFileSection").show()
            }
        })


        $("#checkall").click(() => {
            console.log(("#checkall").checked)
            if ($("#checkall").is(":checked")) {
                $(".adminrow").prop('checked', true);
            } else {
                $(".adminrow").prop('checked', false);
            }
        })

        $(".adminrow").click(() => {
            var rows = document.querySelectorAll(".adminrow")
            $.each(rows, function(k, value) {
                if (!value.checked) {
                    $("#checkall").prop('checked', false);
                }
            })

        })
    }

    var init = function() {
        bindFunctions();
    };

    function enableAllButtons() {
      document.getElementById("showReport").removeAttribute("disabled")
      document.getElementById("downloadReport").removeAttribute("disabled")
      document.getElementById("downloadLogs").removeAttribute("disabled")
      document.getElementById("removeReport").removeAttribute("disabled")
    }

    /* for failed reports, we want to disable the show and download report buttons,
       but enable the download logs and remove report buttons. */
    function setFailedReportButtons() {
      document.getElementById("showReport").setAttribute("disabled", "disabled")
      document.getElementById("downloadReport").setAttribute("disabled", "disabled")
      document.getElementById("downloadLogs").removeAttribute("disabled")
      document.getElementById("removeReport").removeAttribute("disabled")
    }

    function disableAllButtons() {
      document.getElementById("showReport").setAttribute("disabled", "disabled")
      document.getElementById("downloadReport").setAttribute("disabled", "disabled")
      document.getElementById("downloadLogs").setAttribute("disabled", "disabled")
      document.getElementById("removeReport").setAttribute("disabled", "disabled")
    }

    return {
        init: init
    }


})();

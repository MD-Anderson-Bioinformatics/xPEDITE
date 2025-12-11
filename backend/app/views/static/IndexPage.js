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

  var IndexPage = (function() {
      var initiateInputTable = function() {
          $("#table-gen").show()
          var tableBody = $("#resultTableBody");
          var rowNum = parseInt($("#numSamples").val(), 10);
          var resultHtml = '';
          $("#inputSampleButton").html("Update Samples")

          for (var i = 0; i < rowNum; i++) {
              resultHtml += ["<tr>",
                  '<td><input type="checkbox" name="chk"/></td>', ['<td><input class="order-form-input customer-id" name="cust_sampleid_', i, '" type="name" placeholder="Customer sample ID"></td>'].join(""),
                  '</tr>'
              ].join("\n");
          }
          tableBody.html(resultHtml);

          resetHeader()

          if (document.getElementById("timecourse").checked == true) {
              add_timepoint_column(rowNum)
          }

          if ($(".sample_group").length == 0) {
              $(".group_header").remove()
          }

          if ($(".sample_batch").length == 0) {
              $(".batch_header").remove()
          }

          if ($(".sample_group").length > 0 || $(".sample_batch").length > 0) {
              add_group_column()
          }
      }


      var initaiteTimePoints = function() {
          if (!checkIncreasing()) {
              return alert("Input values are not monotonically increasing!")
          }
          resetHeader()

          if ($("#resultTable").is(':visible') && $("#tm_1").is(':visible')) {
              add_timepoint_column(parseInt($("#numSamples").val(), 10))
          } else if ($("#resultTable").is(':visible') && !$(".inputTimePoints").is('visible')) {
              insertTimePointsInput()
              add_timepoint_column(parseInt($("#numSamples").val(), 10))
          } else {
              $(".inputTimePoints").remove()
              insertTimePointsInput()
          }
      }

      var check_existing_column = function(headerName) {
          let headers = []
          $("#resultTable > thead >tr >th").each(function() {
              headers.push($(this).text())
          })
          var headerpos = headers.indexOf(headerName)
          if (headerpos > 0) {
              $('#resultTable tr').find(`td:eq(${headerpos}),th:eq(${headerpos})`).remove();
          }
      }

      var resetHeader = function() {
          $(".sample_group").each(function(oIndex, outerElement) {
              let groupName = $(outerElement).text()
              check_existing_column(groupName)
          })
          $(".sample_batch").each(function(oIndex, outerElement) {
              let batchName = $(outerElement).text()
              check_existing_column(batchName)
          })
          check_existing_column("TimePoints")
      }


      var insertTimePointsInput = function() {
          let numTimePoints = $("#numTimePoints").val()
          let maxTime = $("#maxTime").val()
          let interval = maxTime / (numTimePoints - 1)
          for (let i = 0; i < numTimePoints; i++) {
              const input = document.createElement("input")
              input.setAttribute('id', 'tm_' + i)
              input.setAttribute('value', i * interval)
              input.setAttribute('class', "inputTimePoints")
              $("#timePoints").append(input)
          }
      }

      var checkIncreasing = function() {
          let inputValues = []
          $(".inputTimePoints").each(function() {
              console.log($(this).val())
              inputValues.push($(this).val())
          })
          if (inputValues.length > 2) {
              for (var i = inputValues.length; i--; i > 0) {
                  console.log(i)
                  if (inputValues[i] - inputValues[i - 1] < 0) {
                      $(".inputTimePoints").remove()
                      return false
                  }
              }
          }
          return true
      }


      var add_timepoint_column = function(rowNum) {
          let defaultMap = {}
          $(".inputTimePoints").each(function() {
              if ($("#timeType").val() != "other") {
                  defaultMap[$(this).attr("id")] = $(this).val() + $("#timeType").val()
              } else {
                  defaultMap[$(this).attr("id")] = $(this).val()
              }
          });
          console.log(defaultMap)
          let defaultValues = []
          let numAtEachPoint = Math.round(rowNum / $("#numTimePoints").val())
          let count = -1
          let defaultValue = 0
          for (var i = 0; i < rowNum; i++) {
              if (i % numAtEachPoint == 0) {
                  count += 1
                  defaultValue = defaultMap["tm_" + count]
              }
              defaultValues.push(defaultValue)
          }
          Utils.addColumn("TimePoints", "resultTable", defaultValues, "group_header")
      }

      var add_group_column = function() {

          $(".sample_group").each(function(oIndex, outerElement) {
              let groupName = $(outerElement).text()
              let options = []
              $('input[id^="' + groupName + '_sub"]').each(function(iIndex, innerElement) {
                  options.push($(innerElement).val())
              })
              add_Selection_Column(groupName, "group_header", options)
          })

          $(".sample_batch").each(function(oIndex, outerElement) {
              let batcgName = $(outerElement).text()
              let options = []
              $('input[id^="' + batcgName + '_sub"]').each(function(iIndex, innerElement) {
                  options.push($(innerElement).val())
              })
              add_Selection_Column(batcgName, "batch_header", options)
          })

      }

      var add_Selection_Column = function(newheader, columnType, options) {
          //Add Batch or Group columns
          let tableID = "resultTable"
          var tr = document.getElementById(tableID).tHead.children[0],
              th = document.createElement('th');
          th.innerHTML = newheader + "<input type='checkbox' name='colheader' style='float:right'></input>";
          th.className += columnType
          tr.appendChild(th);
          [...document.querySelectorAll(`#${tableID} tbody tr`)].forEach((row, i) => {
              const input = document.createElement("select")
              input.setAttribute('class', 'form-control')
              if (columnType.includes("batch")) {
                  input.setAttribute('name', `batch_${newheader}_${i}`)
              } else if (columnType.includes("group")) {
                  input.setAttribute('name', `${newheader}_${i}`)
              }
              options.forEach((option) => {
                  var optionElement = document.createElement("option")
                  optionElement.setAttribute("value", option)
                  optionElement.innerHTML = option
                  input.appendChild(optionElement)
              })
              const cell = document.createElement("td")
              cell.appendChild(input)
              row.appendChild(cell)
          });
      }


      var addRow = function() {
          var table = document.getElementById("resultTableBody");
          var rowCount = table.rows.length;
          var row = table.insertRow(rowCount);
          var colCount = table.rows[0].cells.length;
          for (var i = 0; i < colCount; i++) {
              var newcell = row.insertCell(i);
              let n = rowCount + 1;
              newcell.innerHTML = table.rows[0].cells[i].innerHTML.replace("_1", "_" + n);
          }
          $("#numSamples").val(rowCount + 1)
      }


      var deleteColumn = function() {
          console.log("close this");
          var removeIDs = [];
          [...document.querySelectorAll('#resultTable th')].forEach((ele, i) => {
              var chkbox = ele.querySelector("input")
              if (chkbox != null && true == chkbox.checked) {
                  removeIDs.push(i)
              }
          })
          removeIDs.reverse().forEach((i) => {
              $('#resultTable tr').find(`td:eq(${i}),th:eq(${i})`).remove();
          })

      }

      var deleteRow = function() {
          try {
              var table = document.getElementById("resultTableBody");
              var rowCount = table.rows.length;
              for (var i = 0; i < rowCount; i++) {
                  var row = table.rows[i];
                  var chkbox = row.cells[0].childNodes[0];
                  if (null != chkbox && true == chkbox.checked) {
                      if (rowCount <= 1) {
                          alert("Cannot delete all the rows.");
                          break;
                      }
                      table.deleteRow(i);
                      rowCount--;
                      i--;
                      $("#numSamples").val(rowCount)
                  }
              }
          } catch (e) {
              alert(e);
          }
      }

      var bindFunctions = function() {
          $("#inputSampleButton").on("click", initiateInputTable)
          $("#initTimePoints").on("click", initaiteTimePoints)
          $("#addRow").on("click", addRow)
              //   $("#addGroupColumn").click(() => {
              //       Utils.add_table_column("resultTable", "group")
              //   })
              //   $("#addBatchColumn").click(() => {
              //       Utils.add_table_column("resultTable", "batch")
              //   })
          $("#deleteColumn").on('click', deleteColumn)
          $("#deleteRow").on('click', deleteRow)


          $('#numSamples').bind('keyup', function() {
              $('#inputSampleButton').removeAttr('disabled')
          });

          $('#numTimePoints , #maxTime').bind('keyup', function() {
              if ($("#numTimePoints").val() != '' && $("#maxTime").val() != "") {
                  $("#initTimePoints").removeAttr("disabled")
                  $(".inputTimePoints").remove()
              }
          });
          $("#timecourse").click(() => {
              if (!$("#timecourse").is(":checked")) {
                  $("#timePoints").hide()
              } else {
                  $("#timePoints").show()
              }
          })
          $("#uploadFile").click(() => {
              if (!$("#uploadFile").is(":checked")) {
                  $("#uploadFileSection").hide()
                  $("#manualInput").show()
                  $("#customFile").val('')
              } else {
                  $("#uploadFileSection").show()
                  $("#manualInput").hide()
                  $("#table-gen").hide()
              }
          })
          $("#timeType").change(function() {
              console.log($(this).val())
              if ($(this).val() == "other") {
                  $("#otherUnitdiv").show()
              } else {
                  $("#otherUnitdiv").hide()
              }
          })
          $("#samePI").change(function() {
              console.log("checked")
              if (this.checked) {
                  $("#submitterfirst").val($("#pifirst").val())
                  $("#submitterlast").val($("#pilast").val())
                  $("#submitteremail").val($("#piemail").val())
                  $("#submitterphone").val($("#piphone").val())
              } else {
                  $("#submitterfirst").val("")
                  $("#submitterlast").val("")
                  $("#submitteremail").val("")
                  $("#submitterphone").val("")
              }
          });
      };

      var init = function() {
          bindFunctions();
      };


      return {
          init: init
      }


  })();
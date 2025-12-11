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

var Utils = (function() {
    var getDateTime = function() {
        var d = new Date(),
            month = '' + (d.getMonth() + 1),
            day = '' + d.getDate(),
            year = d.getFullYear();
        var seconds = d.getSeconds();
        var minutes = d.getMinutes();
        var hour = d.getHours();

        if (month.length < 2)
            month = '0' + month;
        if (day.length < 2)
            day = '0' + day;
        return [hour, minutes, seconds, month, day, year].join('-');
    }


    var addColumn = function(newheader, tableID, defaultValues, columnType) {
        var tr = document.getElementById(tableID).tHead.children[0],
            th = document.createElement('th');
        th.setAttribute("class", "newHeader")

        th.className += ` ${columnType}_header sample_${columnType}`

        if (columnType != null && columnType.includes("batch")) {
            newheader = "batch_" + newheader
        }

        if (tableID == "resultTable") {
            th.innerHTML = newheader + "<input type='checkbox' style='float:right'></input>";
        } else if (tableID == "adminSampleTable") {
            if (newheader != "DNA" && newheader != "cellCount" && newheader != "tissueWeight") {
                $(".colheader").removeAttr("checked")
                th.innerHTML = newheader + "<input type='checkbox' class='colheader' style='float:right' checked></input>";
            } else {
                th.innerHTML = newheader
            }
        }

        tr.appendChild(th);
        [...document.querySelectorAll(`#${tableID} tbody tr`)].forEach((row, i) => {
            const input = document.createElement("input")
            input.setAttribute('type', 'text')
            input.setAttribute('class', 'order-form-input')
            input.setAttribute('class', 'newColumn')

            input.setAttribute('name', newheader + "_" + i)

            if (defaultValues != null && i < defaultValues.length) {
                input.setAttribute('value', defaultValues[i])
            }
            i = i + 1;
            const cell = document.createElement("td")
            cell.appendChild(input)
            row.appendChild(cell)
        });
    }

    var add_table_column = function(tableID, columnType) {
        var newColumnName;
        let message = `Please enter new ${columnType} column name:`
        var colName = prompt(message, "Col1");
        if (colName == null || colName == "") {
            return;
        } else {
            newColumnName = colName;
            addColumn(newColumnName, tableID, null, columnType)
        }
    }

    var hasColumn = function(tblSel, content) {
        var ths = document.querySelectorAll(tblSel + ' th');
        return Array.prototype.some.call(ths, function(el) {
            return el.textContent.trim() === content.trim();
        });
    };

    var pasteIntoTable = function(e) {
        var $this = $(this);
        $.each(e.originalEvent.clipboardData.items, function(i, v) {
            if (v.type === 'text/plain') {
                v.getAsString(function(text) {
                    var x = $this.closest('td').index(),
                        y = $this.closest('tr').index() + 1,
                        obj = {};
                    text = text.trim('\r\n');
                    $.each(text.split('\r\n'), function(i2, v2) {
                        $.each(v2.split('\t'), function(i3, v3) {
                            var row = y + i2,
                                col = x + i3;
                            obj['cell-' + row + '-' + col] = v3;
                            $this.closest('table').find('tr:eq(' + row + ') td:eq(' + col + ') input').val(v3);
                        });
                    });

                });
            }
        });
        return false;
    }


    var copyToClipboard = function(text) {
        if (window.clipboardData && window.clipboardData.setData) {
            // IE specific code path to prevent textarea being shown while dialog is visible.
            return clipboardData.setData("Text", text);
        } else if (document.queryCommandSupported && document.queryCommandSupported("copy")) {
            var textarea = document.createElement("textarea");
            textarea.textContent = text;
            textarea.style.position = "fixed"; // Prevent scrolling to bottom of page in MS Edge.
            document.body.appendChild(textarea);
            textarea.select();
            try {
                return document.execCommand("copy"); // Security exception may be thrown by some browsers.
            } catch (ex) {
                console.warn("Copy to clipboard failed.", ex);
                return false;
            } finally {
                document.body.removeChild(textarea);
            }
        }
    }



    var bindFunctions = function() {
        $('.pastableTable').on('paste', 'input', pasteIntoTable)


    }


    var init = function() {
        bindFunctions();
    };

    return {
        getDateTime: getDateTime,
        addColumn: addColumn,
        add_table_column: add_table_column,
        hasColumn: hasColumn,
        copyToClipboard: copyToClipboard,
        init: init
    }
})();
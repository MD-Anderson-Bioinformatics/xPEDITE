/*
MIT License

Copyright (c) 2025 The University of Texas MD Anderson Cancer Center

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the 'Software'), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

(function () {
  sortedValues = [] // needed for search integration of data table and waterfall plot
  sortedNames = [] // needed for search integration of data table and waterfall plot
  const foldChangeCutDefault = 1.5;
  const pvalueCutDefault = 1.3; // this is actually the -log_10 cutoff, corresponding to p-value = 0.05
  const customColors = {
     'red': '#ff3300', // upregulated
     'blue': '#0066ff', // downregulated
     'gray': '#cccccc', // not significant
     'lightred': '#ffcccc', // upregulated tooltip hover
     'lightblue': '#cce0ff', // downregulated tooltip hover
     'lightgray': '#f0f0f0', // not significant tooltip hover
     'border': '#969696', // border color for hover
  };
  initializeDropdowns();
  initializeSliders();
  if (groups.length == 1) { /* remove "Limit comparison" dropdown if there is only one covariate */
    $("#groupselectlimit").hide();
    $("#selectlimitlabel").hide();
  }

  makeTableAndPlot();

  /** If fold change, create fold change datatable. If volcano plot, create volcano plot and datatable */
  function makeTableAndPlot() {
    $("#volcanoDataTableDiv").show();
    $("#volcanoDiv").empty();
    let {compareCovariate, g1Name, g2Name, limitIn} = getCurrentDropdownValues();
    let foldChange = getFoldChange(compareCovariate, g1Name, g2Name, limitIn);
    if (foldChange.length == 0) { /* if foldChange is empty, then we cannot make the table or plot */
        $("#volcanoDiv")
          .append("<p style='margin-top:20px;'><b>The selections do not contain enough samples to calculate fold change.</b></p>")
          .append("<p>(No fold change data can be shown.)</p>");
        $("#volcanoDataTableDiv").hide();
        $("#slidersForVolcanoPlot").hide();
        return;
    }
    foldChange.forEach((compound) => {
      compound["primaryPathway"] = primaryPathwayDict.filter((line) => line[0] == compound["id"])[0][1];
    });
    if (showFoldChangeOnly) { /* the only have Fold Change Data Table. So create it and return. */
      drawWaterfall(foldChange);
      generateDataTable(foldChange, [], g1Name, g2Name);
      return;
    } else { /* we have both Fold Change Data Table and Volcano Plot */
      let pvalues = getPvalues(compareCovariate, g1Name, g2Name, limitIn);
      /* if there are no p-values, just make the fold change table */
      if ( pvalues.length == 0 || pvalues.filter((pvalue) => isNaN(pvalue.pvalue) == false).length == 0) {
        generateDataTable(foldChange, [], g1Name, g2Name);
        $("#volcanoDiv")
          .append("<p style='margin-top:20px;width:500px;'><b>The selections do not contain enough samples to calculate p-values.</b></p>")
          .append("<p>Only the fold change is shown in the table below.</p>")
          .append("<p>(No volcano plot can be shown.)</p>");
        $("#slidersForVolcanoPlot").hide();
        return;
      }
      generateDataTable(foldChange, pvalues, g1Name, g2Name);
      drawVolcano(foldChange, pvalues);
    }
  }

  /** Generate jquery data table */
  function generateDataTable(foldChange, pvalues, g1Name, g2Name) {
    if ($.fn.DataTable.isDataTable("#volcanoDataTable")) {
      /* if the datatable already exists, destroy it */
      $("#volcanoDataTable").DataTable().clear().destroy();
      $("#volcanoDataTable thead").remove(); /* needed explicitly because variable number of columns in fold chage vs. volcano */
      $("#volcanoDataTable tbody").remove();
    }
    let pvalueDict = {};
    pvalues.forEach((pvalue) => {
      pvalueDict[pvalue["id"]] = {
        original: pvalue["originalpvalue"],
        log10: pvalue["pvalue"]
      };
    });
    let volcanoData = foldChange.map((one) => {
      if (one["id"] in pvalueDict) {
        one["pvalue"] = pvalueDict[one["id"]]["original"];
        one["log10pvalue"] = pvalueDict[one["id"]]["log10"];
      }
      one["g1"] = one["g1"].toFixed(10);
      one["g2"] = one["g2"].toFixed(10);
      return one;
    });
    let columns = [
      {
        title: "Compound Name",
        data: "id",
      },
      {
        title: "Primary Pathway",
        data: "primaryPathway",
      },
      {
        title: g1Name,
        data: "g1",
      },
      {
        title: g2Name,
        data: "g2",
      },
      {
        title: "log<sub>2</sub>(fold change)",
        data: "foldChange",
        defaultContent: "",
      },
    ];
    let initialOrderByColumn = 3; /* sort by log2(fold change) */
    if (pvalues.length > 0) { /* then we have p-value columns */
      columns.push(
        {
          title: "adjusted pvalue",
          data: "pvalue",
        },
        {
          title: "-log<sub>10</sub>(pvalue)",
          data: "log10pvalue",
          defaultContent: "",
        },
      );
      initialOrderByColumn = 4; /* sort by adjusted pvalue */
    }
    let volcanoDataTable = $("#volcanoDataTable").DataTable({
      data: volcanoData,
      bDestroy: true,
      columns: columns,
      order: [[initialOrderByColumn, "asc"]],
      dom: "Bfrtip",
      buttons: [
        "copy",
        {
          extend: "excelHtml5",
          title: "Volcano_data_export",
        },
        {
          extend: "csvHtml5",
          title: "Volcano_data_export",
        },
      ],
    });
    // Zoom to compound on click in corresponding row in data table
    $('#volcanoDataTable tbody').on('click', 'tr', function() {
        const data = volcanoDataTable.row(this).data();
        if (data) {
            const index = sortedNames.findIndex(name => name === data.id);
            if (index !== -1) {
                const pointData = {
                    curveNumber: 0,
                    pointNumber: index,
                    x: sortedValues[index],
                    text: sortedNames[index]
                };
                const padding = 10
                Plotly.relayout('volcanoDiv', {
                  'xaxis.range': [index - padding, index + padding]
                }).then(() => {
                  Plotly.Fx.hover('volcanoDiv', [pointData]);
                });
            }
        }
    });
  } /* end function generateDataTable */

  function drawWaterfall(foldChange) {
    let {compareCovariate, g1Name, g2Name, limitIn} = getCurrentDropdownValues();
    let fcValues = foldChange.map((line) => line.foldChange);
    let names = foldChange.map((line) => line.id);
    const sortedIndices = fcValues
        .map((value, index) => ({ value, index }))
        .sort((a, b) => b.value - a.value)  // descending order
        .map(item => item.index);
    sortedValues = sortedIndices.map(i => fcValues[i]);
    sortedNames = sortedIndices.map(i => names[i]);
    const trace = {
      x: sortedNames,
      y: sortedValues,
      type: 'bar',
      marker: {
          color: sortedValues.map(value => value >= 0 ? customColors.red : customColors.blue), // Red for upregulated, blue for downregulated
      },
      text: sortedNames,
      textposition: 'none',
      hovertemplate: '%{text}<br>%{y}<extra></extra>',
      hoverlabel: {
        bgcolor: sortedValues.map(value => value >= 0 ? customColors.lightred : customColors.lightblue), // Light red for upregulated, light blue for downregulated
        bordercolor: customColors.border,
        font: {
            color: 'black',
            size: 14
        }
       }
    };
    const layout = {
        title: 'log<sub>2</sub>(Fold Change) for ' + compareCovariate + ': ' + g1Name + ' vs. ' + g2Name + (limitIn ? ' (limit in ' + limitIn + ')' : ''),
        xaxis: {
            title: 'Compound',
            zeroline: true,
            zerolinecolor: customColors.border,
            zerolinewidth: 1,
            gridcolor: '#bdbdbd',
            gridwidth: 1,
            rangeslider: {
                visible: true,
                thickness: 0.15
            },
            tickmode: 'array',
            tickvals: sortedNames,
            ticktext: sortedNames.map(label => 
               label.length > 20 ? label.substring(0, 20) + '...' : label
            ),
            range: [-1, 19]
        },
        yaxis: {
            title: 'log<sub>2</sub>(Fold Change)',
        },
        showlegend: false,
        margin: {l: 100, r: 20, t: 50, b: 40}
    };
    Plotly.newPlot('volcanoDiv', [trace], layout);
    document.getElementById('volcanoDiv').on('plotly_relayout', function(eventdata) {
        // Remove any active tooltips
        Plotly.Fx.unhover('volcanoDiv');
    });
  } /* end function drawWaterfall */

  /** Generate volcano plot */
  function drawVolcano(foldChange, pvalues) {
    let {compareCovariate, g1Name, g2Name, limitIn} = getCurrentDropdownValues();
    let {foldChangeCut, pvalueCut} = getCurrentCutoffValues();
    let plotdiv = document.getElementById("volcanoDiv");
    $(plotdiv).empty();
    let xvals = foldChange.map((line) => line.foldChange);
    let yvals = pvalues.map((line) => line.pvalue);
    let names = foldChange.map((line) => line.id);
    let plotTitle = "Volcano Plot: " + g1Name + " vs. " + g2Name;
    if (limitIn != undefined) {
      plotTitle = "Volcano Plot: " + g1Name + " vs. " + g2Name + " (limit in " + limitIn + ")";
    }
    const getColor = (xval, yval, isHover = false) => {
      if (xval > foldChangeCut && yval > pvalueCut) {
        return isHover ? customColors.lightred : customColors.red; // upregulated
      } else if (xval < -1 * foldChangeCut && yval > pvalueCut) {
        return isHover ? customColors.lightblue : customColors.blue; // downregulated
      } else {
        return isHover ? customColors.lightgray : customColors.gray; // not significant
      }
    };
    var trace1 = {
      x: xvals,
      y: yvals,
      mode: "markers",
      type: "scatter",
      text: names,
      textposition: "top center",
      textfont: {
        family: "Raleway, sans-serif",
      },
      marker: {
        size: 12,
        color: xvals.map((xval, index) => getColor(xval, yvals[index])),
      },
      hovertemplate: '%{text}<br>%{y}<extra></extra>',
      hoverlabel: {
        bgcolor: xvals.map((xval, index) => getColor(xval, yvals[index], true)),
        bordercolor: customColors.border,
        font: {
            color: 'black',     // Black text
            size: 14            // Text size
        }
       }
    };
    var data = [trace1];
    var layout = {
      title: {
        text: plotTitle,
        font: { size: 22 },
      },
      width: 600,
      height: 600,
      shapes: [
        {
          type: "line",
          xref: "paper",
          x0: 0,
          y0: pvalueCut,
          x1: 1,
          y1: pvalueCut,
          line: {
            color: "#ea9999",
            width: 2,
            dash: "dot",
          },
        },
        {
          type: "line",
          yref: "paper",
          x0: foldChangeCut,
          y0: 0,
          x1: foldChangeCut,
          y1: 1,
          line: {
            color: "#ea9999",
            width: 2,
            dash: "dot",
          },
        },
        {
          type: "line",
          yref: "paper",
          x0: -1 * foldChangeCut,
          y0: 0,
          x1: -1 * foldChangeCut,
          y1: 1,
          line: {
            color: "#ea9999",
            width: 2,
            dash: "dot",
          },
        },
      ],
      xaxis: {
        title: {
          text: "log<sub>2</sub>(Fold Change)",
          font: {
            size: 18,
          },
        },
        range: [Math.min(xvals), Math.max(xvals)],
      },
      yaxis: {
        title: {
          text: "-log<sub>10</sub>(p-value)",
          font: {
            size: 18,
          },
        },
        range: [0, Math.max(yvals)],
      },
    };
    var config = {
      toImageButtonOptions: {
        format: "svg", // one of png, svg, jpeg, webp
        filename: "Volcano",
        height: 600,
        width: 600,
        scale: 1, // Multiply title/legend/axis/canvas sizes by this factor
      },
    };
    Plotly.newPlot(plotdiv, data, layout, config);
    plotdiv.on("plotly_click", function (metadata) {
      let metaName = metadata.points[0].text;
      $("#plotShow").empty();
      drawPlot(metaName, 0);
    });
    $("#slidersForVolcanoPlot").show();
  } /* end function drawVolcano */

  function getAverage(array) {
    let reduced = [];
    array.reduce(function (res, value) {
      if (!res[value.id]) {
        res[value.id] = {
          id: value.id,
          area: 0,
          count: 0,
        };
        reduced.push(res[value.id]);
      }
      res[value.id].area += value.area;
      res[value.id].count += 1;
      return res;
    }, {});
    const result = Object.keys(reduced).map(function (k) {
      const item = reduced[k];
      return {
        id: item.id,
        area: item.area / item.count,
      };
    });
    return result;
  }

  function getFoldChange(compareCovariate, g1Name, g2Name, limitIn) {
    let limitCovariate = groups.filter((group) => group != compareCovariate)[0];
    let g1 = alldata
      .filter((line) => line[compareCovariate] == g1Name)
      .filter((line) => {
        if (typeof limitCovariate != "undefined") { // then filter by limitIn
          return(line[limitCovariate] == limitIn);
        } else { // don't filter by limitIn
          return(line);
        }
      })
      .map((line) => {
        return {
          id: line.metabolite,
          area: line.value,
        };
      });
    let g2 = alldata
      .filter((line) => line[compareCovariate] == g2Name)
      .filter((line) => {
        if (typeof limitCovariate != "undefined") { // then filter by limitIn
          return(line[limitCovariate] == limitIn);
        } else { // don't filter by limitIn
          return(line);
        }
      })
      .map((line) => {
        return {
          id: line.metabolite,
          area: line.value,
        };
      });
    if (g1.length == 0 || g2.length == 0) { /* not enough samples to calculate fold change */
      return [];
    }
    let g1Average = getAverage(g1);
    let g2Average = getAverage(g2);
    const foldChange = Object.keys(g1Average).map(function (k) {
      return {
        id: g1Average[k].id,
        foldChange: Math.log2(g1Average[k].area / g2Average[k].area),
        g1: g1Average[k].area,
        g2: g2Average[k].area,
      };
    });
    return foldChange;
  }

  function getPvalues(compareCovariate, g1Name, g2Name, limitIn) {
    let pvalues;
    if (groups.length == 2 && compareCovariate == groups[0]) {
      pvalues = pvalsmajor
        .filter(
          (line) =>
            (line[["1"]].includes(g1Name + "-" + g2Name) ||
              line[["1"]].includes(g2Name + "-" + g1Name)) &&
            line.FactorGroup.includes(limitIn),
        )
        .map((line) => {
          return {
            id: line.Metabolite,
            pvalue: -Math.log10(line["p.adj"]),
            originalpvalue: line["p.adj"],
          };
        });
    } else if (groups.length == 2 && compareCovariate == groups[1]) {
      pvalues = pvalsminor
        .filter(
          (line) =>
            (line[["1"]].includes(g1Name + "-" + g2Name) ||
              line[["1"]].includes(g2Name + "-" + g1Name)) &&
            line.FactorGroup.includes(limitIn),
        )
        .map((line) => {
          return {
            id: line.Metabolite,
            pvalue: -Math.log10(line["p.adj"]),
            originalpvalue: line["p.adj"],
          };
        });
    } else {
      pvalues = pvalsmajor
        .filter(
          (line) =>
            line[["1"]].includes(g1Name + "-" + g2Name) ||
            line[["1"]].includes(g2Name + "-" + g1Name),
        )
        .map((line) => {
          return {
            id: line.Metabolite,
            pvalue: -Math.log10(line["p.adj"]),
            originalpvalue: line["p.adj"],
          };
        });
    }
    return pvalues;
  }

  function initializeDropdowns() {
    /* initialize the covariate dropdown */
    $.each(groups, function (i, value) {
      $("#covarselect").append($("<option>").text(value).attr("value", value));
    });
    /* initialize the group dropdowns and set the default values */
    $.each(batches[groups[0]], function (i, value) {
      $("#groupselect1").append($("<option>").text(value).attr("value", value));
      $("#groupselect2").append($("<option>").text(value).attr("value", value));
    });
    $("#groupselect1").val(batches[groups[0]][0]);
    $("#groupselect2").val(batches[groups[0]][1]);
    disableSameChoices();
    if (groups.length == 1) {
      return;
    }
    /* initialize the "Limit comparison" dropdown */
    $.each(batches[groups[1]], function (i, value) {
      $("#groupselectlimit").append(
        $("<option>").text(value).attr("value", value),
      );
    });
  }

  /** In the second dropdown, disable the value that is selected in the first dropdown and vice versa. */
  function disableSameChoices() {
    $("#groupselect1 option").each(function() {
      $(this).prop("disabled", false);
    });
    $("#groupselect2 option").each(function() {
      $(this).prop("disabled", false);
    });
    $("#groupselect1 option").each(function() {
      if ($(this).val() == $("#groupselect2").val()) {
        $(this).prop("disabled", true);
      }
    });
    $("#groupselect2 option").each(function() {
      if ($(this).val() == $("#groupselect1").val()) {
        $(this).prop("disabled", true);
      }
    });
  }

  /** Change handlers for "Select groups to compare" dropdowns */
  $("#groupselect1").on("change", () => {
    disableSameChoices();
    makeTableAndPlot();
  });
  $("#groupselect2").on("change", () => {
    disableSameChoices();
    makeTableAndPlot();
  });
  /** Click hander to swap selected entries in #groupselect1 and #groupselect2 */
  $("#swapDropdownValues").on("click", () => {
    $("#groupselect1 option").each(function() {
      $(this).prop("disabled", false);
    });
    $("#groupselect2 option").each(function() {
      $(this).prop("disabled", false);
    });
    // swap the selected values
    let temp = $("#groupselect1").val();
    $("#groupselect1").val($("#groupselect2").val());
    $("#groupselect2").val(temp);
    disableSameChoices()
    makeTableAndPlot();
  })

  function initializeSliders() {
    $("#foldchangeSlider").slider({
      value: foldChangeCutDefault,
      min: 1,
      max: 5,
      step: 0.1,
      slide: attachFoldChangeSlider,
      stop: attachFoldChangeSlider,
      animate: "fast",
    });
    $("#pvalueSlider").slider({
      value: pvalueCutDefault,
      min: 0.5,
      max: 5,
      step: 0.1,
      slide: attachPvalueSlider,
      stop: attachPvalueSlider,
      animate: "fast",
    });
    function attachFoldChangeSlider() {
      let foldChangeCut = $("#foldchangeSlider").slider("value");
      let pvalueCut = $("#pvalueSlider").slider("value");
      $("#foldChangeCut").val(foldChangeCut);
      makeTableAndPlot();
    }
    function attachPvalueSlider() {
      let pvalueCut = $("#pvalueSlider").slider("value");
      let foldChangeCut = $("#foldchangeSlider").slider("value");
      $("#pvalueCut").val(pvalueCut);
      makeTableAndPlot();
    }
  } /* end function initializeSliders */

  /** Change handler for "Covariate" dropdown */
  $("#covarselect").change(() => {
    $("#groupselect1").empty();
    $("#groupselect2").empty();
    $("#groupselectlimit").empty();
    $.each(batches[$("#covarselect").val()], function (i, value) {
      $("#groupselect1").append($("<option>").text(value).attr("value", value));
      $("#groupselect2").append($("<option>").text(value).attr("value", value));
    });
    $.each(
      batches[$("#covarselect option:not(:selected)").val()],
      function (i, value) {
        $("#groupselectlimit").append(
          $("<option>").text(value).attr("value", value),
        );
      },
    );
    $("#groupselect1").val(batches[$("#covarselect").val()][0]);
    $("#groupselect2").val(batches[$("#covarselect").val()][1]);
    disableSameChoices();
    makeTableAndPlot();
  });

  /** Change handler for "Limit comparison" dropdown */
  $("#groupselectlimit").change(() => {
    makeTableAndPlot();
  });

  /** Change handlers for "-log_10(p-value)" input box*/
  $("#pvalueCut").change(() => {
    let {foldChangeCut, pvalueCut} = getCurrentCutoffValues();
    $("#pvalueSlider").slider("value", pvalueCut);
    $("#foldchangeSlider").slider("value", foldChangeCut);
    makeTableAndPlot();
  });

  /** Change handlers for "log2(Fold Change)" input box*/
  $("#foldChangeCut").change(() => {
    let {foldChangeCut, pvalueCut} = getCurrentCutoffValues();
    $("#pvalueSlider").slider("value", pvalueCut);
    $("#foldchangeSlider").slider("value", foldChangeCut);
    makeTableAndPlot();
  });

  /** Click handler for "Reset Sliders" button. Button is only visible when sliders are visible. */
  $("#resetVolcano").click(() => {
    $("#foldChangeCut").val(foldChangeCutDefault);
    $("#foldchangeSlider").slider("value", foldChangeCutDefault);
    $("#pvalueCut").val(pvalueCutDefault);
    $("#pvalueSlider").slider("value", pvalueCutDefault);
    makeTableAndPlot();
  });

  function getCurrentDropdownValues() {
    let compareCovariate = $("#covarselect").val();
    let g1Name = $("#groupselect1").val();
    let g2Name = $("#groupselect2").val();
    let limitIn = $("#groupselectlimit").val();
    return {compareCovariate, g1Name, g2Name, limitIn};
  }

  function getCurrentCutoffValues() {
    if (showFoldChangeOnly) {
      let foldChangeCut = foldChangeCutDefault;
      let pvalueCut = pvalueCutDefault;
      return {foldChangeCut, pvalueCut};
    }
    let foldChangeCut = $("#foldChangeCut").val();
    let pvalueCut = $("#pvalueCut").val();
    return {foldChangeCut, pvalueCut};
  }
})();

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

$("#searchClasses").append('<input type="text" id="searchClass" name="searchClass" placeholder="Search...">');
$("#searchClasses").append('<button id="searchButton">Search</button></br>');
$("#searchClasses").append('<select id="searchCompounds" multiple size=5></select>');
$("#searchClasses").append("</br></br>");

// curatedNameDict elements are: [ <systematic name>, <curated name> ]
curatedNames = curatedNameDict.map((names) => names[1]);
$.each(curatedNameDict, function (i, elem) {
  // display the curated name in dropdown; use the systematic name as value
  $("#searchCompounds").append($("<option>").text(elem[1]).attr("value", elem[0]));
});
// Select the first compound by default
$(function () {
  $("#searchCompounds")[0].selectedIndex = 0;
  let metaName = $("#searchCompounds").val();
  drawPlot(metaName, 0);
  updatePlotDisplay(metaName);
});

/*
    Two ways to show individual compound plots
    By type in the input field
    By clicking on the dropdown list

 */
$("#searchClass").autocomplete({
  source: curatedNames,
  autoFocus: true
});

/*
    When search by typing compound name, click on "Search" button to show the plot
 */
$("#searchButton").click(function (e) {
  $("#plotShow").empty();
  let metaName = $("#searchClass").val();
  $("#searchCompounds").val(metaName);
  drawPlot(metaName, 0);
  updatePlotDisplay(metaName);
});

/*
     Draw plot for selected compound, multiple compounds could be selected
 */
$("#searchCompounds").change(function () { // onchange of dropdown
  var metaNames = $(this).val(); // val() returns the systematic names (not the curated names)
  $("#plotShow").empty();
  let index = 0;
  for (var metaName of metaNames) {
    drawPlot(metaName, index);
    index = index + 1;
    updatePlotDisplay(metaName);
  }
});

// This #downloadPlots click handler was commented out in 82518d32.
// Apparently we don't want to remove it just yet.
/*
     Download plot button to download individual plot to ppt with PptxGenJS()
     https: //gitbrent.github.io/PptxGenJS/
 */
/*$('#downloadPlots').click(async function() {
     $("#downloadspinner").show()
     let pres = new PptxGenJS();
     $("#plotShow").append('<div id="plotly_div" style="display:none"></div>')
     for (var metaName of curatedNames) {
        //console.log(metaName)
		 // TODO: placeholder this code does not work, so passing an empty string to get_layout isn't really a problem
         var data = get_data(metaName, groups)
         var layout = get_layout(metaName, "")
         let gd = await Plotly.newPlot(
             "plotly_div",
             data.data,
             layout
         )
         let slide = pres.addSlide();
         let dataURL = await Plotly.toImage(gd, {
             format: 'png',
             width: 800,
             height: 600
         })
         slide.addText(metaName, {
             x: 0.8,
             y: 0.6,
             w: 6.0,
             h: 0.3,
             color: "0088CC"
         });
         slide.addImage({
             data: dataURL,
             x: 0.5,
             y: 1.0,
             w: 6,
             h: 4
         });
     }
     pres.writeFile({
         fileName: "Plots-Of-Individual-Compounds.pptx"
     });
     $("#downloadspinner").hide()
 });*/

function twoscatter(batch, metaValue, color, major, minor) {
  var group1 = metaValue.filter((line) => {
    return line[major] == batch;
  });
  var trace1 = {
    y: group1.map((line) => line.value),
    x: group1.map((line) => line[minor]),
    name: batch,
    marker: {
      color: color
    },
    mode: "lines+markers"
  };
  return trace1;
}

/**
 * Creates a violin plot trace for a given batch of data.
 *
 * @param {string} batch - The batch identifier to filter the data.
 * @param {Array<Object>} metaValue - The array of data objects to be plotted.
 * @param {string} color - The color to be used for the plot.
 * @param {string} major - The key in metaValue object to filter the data by the major grouping.
 * @param {string} [minor=undefined] - The optional key in metaValue object to filter the data by the minor grouping.
 * @returns {Object} The trace object for the violin plot.
 */
function violinTrace(batch, metaValue, color, major, minor = undefined) {
  let group1 = metaValue.filter((line) => {
    return line[major] == batch;
  });
  let trace = {
    y: group1.map((line) => line.value),
    name: major + " - " + batch,
    marker: {
      color: makeDarkerShade(color, 0.4)
    },
    type: "violin",
    pointpos: 0,
    points: "all",
    box: {
      visible: true
    },
    line: {
      color: color
    },
    meanline: {
      visible: true
    },
    jitter: 0.3,
    opacity: 0.8,
    width: 0.5
  };
  if (minor != undefined) {
    trace.x = group1.map((line) => line[minor]);
    trace.name = batch;
    trace.legendgroup = batch;
    trace.sclegroup = batch;
    trace.width = 0;
  }
  return trace;
}

function oneBar(batch, metaValue, color, major) {
  var data = [
    {
      x: batch.map((ele) => ele.toString()),
      y: metaValue.map((line) => line.value),
      type: "bar"
    }
  ];
  return data;
}

/**
 * Generates a darker shade of a given hex color by a specified percentage.
 *
 * @param {string} hexColor - The hex color code to darken (e.g., "#RRGGBB").
 * @param {number} percentage - The percentage by which to darken the color (e.g., 0.2 for 20%).
 * @returns {string} The darker shade of the given hex color in hex format.
 */
const makeDarkerShade = (hexColor, percentage) => {
  if (!/^#[0-9A-F]{6}$/i.test(hexColor)) {
    console.log("Invalid Hex Color");
    return "#000000";
  }
  const red = parseInt(hexColor.slice(1, 3), 16);
  const green = parseInt(hexColor.slice(3, 5), 16);
  const blue = parseInt(hexColor.slice(5, 7), 16);
  const shadeR = Math.round(Math.max(0, red - red * percentage));
  const shadeG = Math.round(Math.max(0, green - green * percentage));
  const shadeB = Math.round(Math.max(0, blue - blue * percentage));
  return '#' + [shadeR, shadeG, shadeB].map(x => x.toString(16).padStart(2, '0')).join('')
};

/**
 * Generates the layout configuration for a Plotly plot based on the given metabolite name and optional covariates.
 *
 * @param {string} metaName - The name of the metabolite to generate the layout for.
 * @param {string} [covariatesShown] - Optional covariates to include in the plot title.
 * @returns {Object} The layout configuration object for the Plotly plot.
 */
function get_layout(metaName, covariatesShown) {
  var names3 = refmetNameDict.filter((line) => line[0] == metaName);
  if (names3 != undefined && names3.length != 0) {
    refmetName = names3[0][1];
  }
  let names = curatedNameDict.filter((line) => line[0] == metaName);
  let curatedName = names[0][1];
  let metaboliteLink = '<a href="https://www.metabolomicsworkbench.org/databases/refmet/refmet_details.php?REFMET_NAME=' +
    refmetName + '" target="_blank">' + curatedName + "</a>";
  if (refmetName.includes("_null") || refmetName == "-") {
    metaboliteLink = '<a href="https://www.google.com/search?q=' + metaName + '" target="_blank">' + metaName + "</a>";
  }
  let useTitle = metaboliteLink;
  if (typeof covariatesShown !== "undefined") {
    useTitle = covariatesShown + " for " + metaboliteLink;
  }
  var layout = {
    yaxis: {
      title: "Intensity",
      zeroline: false,
      showexponent: "all",
      exponentformat: "e"
    },
    xaxis: {
      type: "category"
    },
    title: useTitle
  };
  layout["violinmode"] = "group";
  return layout;
}

function count_appearance(metaValue, type) {
  var stat = {};
  batches[type].forEach((val) => {
    var numsamples = metaValue.filter((value) => value[type] == val).length;
    if (!(numsamples in stat)) {
      stat[numsamples] = [];
    }
    stat[numsamples].push(val);
  });
  return stat;
}

function update_metaValue(metaValue, majorstat, minorstat, major, minor) {
  var majorgroup = majorstat[Object.keys(majorstat)[0]];
  var minorgroup = minorstat[Object.keys(minorstat)[0]];
  var majorvalue = majorstat[Object.keys(majorstat)[1]][0];
  var minorvalue = minorgroup[0];
  var minorrecords = metaValue.filter((value) => value[major] == majorvalue && value[minor] == minorvalue);
  var value = median(minorrecords.map((line) => line.value));
  var record = minorrecords[0];
  majorgroup.forEach((group) => {
    var newrecord = JSON.parse(JSON.stringify(record));
    newrecord["value"] = value;
    newrecord[major] = group;
    metaValue.push(newrecord);
  });

  metaValue.sort((a, b) => (a[minor] > b[minor] ? 1 : b[minor] > a[minor] ? -1 : 0));
  return metaValue;
}

function get_data(metaName, subGroups) {
  let metaValue = alldata.filter(function (oneline) {
    return oneline.metabolite == metaName;
  });

  var colors = ["#3D9970", "#FF4136", "#FF851B"];
  var data;
  var major = subGroups[0];
  var minor = subGroups[1];
  var majorbatch = batches[major];
  var majorstat = count_appearance(metaValue, major);
  if (minor != undefined) {
    var minorstat = count_appearance(metaValue, minor);
    if (Object.keys(majorstat).length > 1 && Object.keys(minorstat).length > 1 && minor == "Time") {
      // When there is time covariate, use median value to draw line plot
      metaValue = update_metaValue(metaValue, majorstat, minorstat, major, minor);
    }
  }
  metaValue.sort(function(a, b) {return majorbatch.indexOf(a[major]) - majorbatch.indexOf(b[major]);});
  // If there are combination of two covariates (major, minor)
  if (subGroups.length == 2) {
    if (single == "true") {
      // If only one sample, draw scatter plots
      data = majorbatch.map((batch, index) => {
        return twoscatter(batch, metaValue, mulcolors[index], major, minor);
      });
    } else {
      // If there are repetitive measures, draw violin plot
      data = majorbatch.map((batch, index) => {
        return violinTrace(batch, metaValue, mulcolors[index], major, minor);
      });
    }
  } else if (subGroups.length == 1) {
    // If there is only one covariate
    if (metaValue.length == majorbatch.length) {
      // If there is only one sample for each condition, draw bar plot
      data = oneBar(majorbatch, metaValue, mulcolors, major);
    } else {
      // If there are multiple measures for one condition, draw box plot
      data = majorbatch.map((batch, index) => {
        return violinTrace(batch, metaValue, mulcolors[index], major);
      });
    }
  }
  return {
    data,
    metaValue
  };
}

function drawPlot(metaName, index) {
  $("#searchCompounds").val(metaName);
  $("#searchClass").val(metaName);
  //$("#downloadPlots").show(); // this was commented out in 82518d3. Apparently we don't want to remove it just yet.
  var subGroups = groups;
  var data;
  var layout;
  // Generate plots based on number of covariates
  // if more than two covariates, show several plots in one row
  // if two covariates, check to see if one of the variables is Time, if yes, need to show deltaAUC plot
  if (multicat == "true") {
    var multindex = 0;
    let metaValue = alldata.filter(function (oneline) {
      return oneline.metabolite == metaName;
    });

    // Generate box plot for each covariate
    $("#plotShow").append('<div id="multplot' + multindex + '"></div>');
    groupdata = [];
    groups.forEach((group) => {
      var majorbatch = batches[group];
      data = majorbatch.map((batch, index) => {
        let retVal = violinTrace(batch, metaValue, mulcolors[index], group);
        return retVal;
      });
      groupdata = groupdata.concat(data);
    });
    var layout = {
      yaxis: {
        title: "Intensity",
        zeroline: false,
        showexponent: "all",
        exponentformat: "e"
      },
      xaxis: {
        showticklabels: true,
        type: "category",
        tickangle: 45
      },
      showlegend: false,
      title: metaName,
      boxmode: "group"
    };
    var config = {
      toImageButtonOptions: {
        format: "svg", // one of png, svg, jpeg, webp
        filename: metaName + " BoxPlot",
        height: 600,
        width: 1000,
        scale: 1 // Multiply title/legend/axis/canvas sizes by this factor
      }
    };

    // Generate violin plot for each covariate vs time combination
    Plotly.newPlot(document.getElementById("multplot" + index), groupdata, layout, config);
    $("#plotShow").append('<div id="rowplot"></div>');

    if (groups.includes("Time")) {
      groups.forEach((group) => {
        if (group != "Time") {
          subGroups = [group, "Time"];
          data = get_data(metaName, subGroups);
          layout = get_layout(metaName, group);
          var config = {
            toImageButtonOptions: {
              format: "svg", // one of png, svg, jpeg, webp
              filename: metaName + " Violin",
              height: 600,
              width: 1000,
              scale: 1 // Multiply title/legend/axis/canvas sizes by this factor
            }
          };
          if (single != "true") {
            multindex += 1;
            $("#plotShow").append('<div id="multplot' + multindex + '" style="width:33%;float:left"></div>');
            Plotly.newPlot(document.getElementById("multplot" + multindex), data.data, layout, config);
            $("#multplot" + multindex)
              .detach()
              .appendTo("#rowplot");
          }
        }
      });
    }
    // Generate violin plot for other combination of covariates
    var newGroups = [...groups];
    var timeIndex = newGroups.indexOf("Time");
    if (timeIndex > -1) {
      newGroups.splice(timeIndex, 1);
    }
    for (var i = 0; i < newGroups.length; i++) {
      for (var j = i + 1; j < newGroups.length; j++) {
        multindex += 1;
        $("#plotShow").append('<div id="multplot' + multindex + '" style="width:33%;float:left"></div>');
        subGroups = [newGroups[i], newGroups[j]];
        data = get_data(metaName, subGroups);
        layout = get_layout(metaName, newGroups[i] + " VS " + newGroups[j]);
        var config = {
          toImageButtonOptions: {
            format: "svg", // one of png, svg, jpeg, webp
            filename: metaName + " Violin",
            height: 600,
            width: 1000,
            scale: 1 // Multiply title/legend/axis/canvas sizes by this factor
          }
        };
        Plotly.newPlot(document.getElementById("multplot" + multindex), data.data, layout, config);
        $("#multplot" + multindex)
          .detach()
          .appendTo("#rowplot");
      }
    }
  } else if (subGroups.length == 2 && (subGroups[1].includes("Time") || subGroups[1].includes("time"))) {
    // If there is time series data, draw violin plot and deltaAUC plot.
    $("#plotShow").append('<div id="visplot' + index + '"></div>');
    // Multiple Time Series Groups
    data = get_data(metaName, subGroups);
    layout = get_layout(metaName);
    var config = {
      toImageButtonOptions: {
        format: "svg", // one of png, svg, jpeg, webp
        filename: metaName + " Violin",
        height: 600,
        width: 1000,
        scale: 1 // Multiply title/legend/axis/canvas sizes by this factor
      }
    };
    drawAUCPlot(data.metaValue, metaName, document.getElementById("visplot" + index));
    if (single != "true") {
      $("#plotShow").append('<div id="visplotmore' + index + '"></div>');
      let xorder = [...new Set(alldata.map((line) => line[subGroups[1]]))];
      Plotly.newPlot(document.getElementById("visplotmore" + index), data.data, layout, config);
    }
  } else {
    // Draw violin plot only
    $("#plotShow").append('<div id="visplot' + index + '"></div>');
    // Multiple Groups
    data = get_data(metaName, subGroups);
    layout = get_layout(metaName);
    var config = {
      toImageButtonOptions: {
        format: "svg", // one of png, svg, jpeg, webp
        filename: metaName + " Violin",
        height: 600,
        width: 1000,
        scale: 1 // Multiply title/legend/axis/canvas sizes by this factor
      }
    };
    Plotly.newPlot(document.getElementById("visplot" + index), data.data, layout, config);
  }
  $("#pathways").css("clear", "both");
}

function updatePlotDisplay(metaName) {
  var names = curatedNameDict.filter((line) => line[0] == metaName);
  var curatedName = names[0][1];
  $("#searchClass").val(curatedName); // display curated name in search box
  var names2 = refmetNameDict.filter((line) => line[0] == metaName);
  var refmetName = names2[0][1];
  refmetName = refmetName.replaceAll(" ", "%20");
  // show pubchem_cid for selected compound
  $.ajax({
    statusCode: {},
    url: `https://www.metabolomicsworkbench.org/rest/refmet/name/${refmetName}/all/json/`,
    type: "GET",
    success: function (result) {
      if (result.hasOwnProperty("pubchem_cid")) {
        $("#PubChemID").text(`PubChem ID:${result["pubchem_cid"]}`);
      } else {
        $("#PubChemID").text("");
      }
    }
  });
}

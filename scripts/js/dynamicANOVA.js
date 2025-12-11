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

var dynamicANOVA = function(anovapvals, dynamicdivid) {
    const customColors = {
     'blue': '#0066ff', // point color
     'lightblue': '#cce0ff', // tooltip hover color
     'border': '#969696', // border color for hover
    };
    var anovapvals = anovapvals
    var inputid = "input_" + dynamicdivid
    var sliderid = "slider_" + dynamicdivid
    var anovadiv = "pairwiseanova_" + dynamicdivid
    if (single != "empty") {
        $("#" + dynamicdivid).append("<label for='" + inputid + "'>p-value cutoff: </label>" +
         '<input type="text" id="' + inputid + '" name="' + inputid + '" value="0.05">' +
         '&nbsp;&nbsp;<span>(Only data with p-value less than this will be shown in the graph)</span>' +
         '<div id="' + sliderid + '"></div>' +
         '<div class="row" id="' + anovadiv + '"></div>'
        )
        $("#" + anovadiv).append(
            '<div id = "viz_' + dynamicdivid + '" class="col-xs-2"> </div>'
        )
    }
    $("#" + inputid).css("width", "5em");
    $("#" + inputid).css("margin-left", "0.5em");
    drawCircleLegend(dynamicdivid)

    //draw legend for annova plot with fixed size circle
    function drawCircleLegend(dynamicdivid) {
        var sampleSVG = d3.select("#viz_" + dynamicdivid)
            .append("svg")
            .attr("width", 90)
            .attr("height", 400);
        var legendData = [{
            "y": 40,
            "r": 4,
            "label": "5e-2"
        }, {
            "y": 100,
            "r": 8,
            "label": "5e-4"
        }, {
            "y": 160,
            "r": 12,
            "label": "5e-6"
        }, {
            "y": 220,
            "r": 16,
            "label": "5e-7"
        }, {
            "y": 280,
            "r": 20,
            "label": "5e-8"
        }]

        var elem = sampleSVG.selectAll("g")
            .data(legendData)
        var elemEnter = elem.enter()
            .append("g")
            .attr("transform", function(d) {
                return "translate(40," + d.y + ")"
            })

        var circle = elemEnter.append("circle")
            .attr("r", function(d) {
                return d.r
            })
            .attr("stroke", customColors.blue)
            .attr("fill", customColors.blue)
        elemEnter.append("text")
            .attr("dy", function(d) {
                return 35
            })
            .text(function(d) {
                return d.label
            })

    }

    function sortFactorGroup(a, b) {
      if ( a["FactorGroup"] < b["FactorGroup"] ) return 1;
      if ( a["FactorGroup"] > b["FactorGroup"] ) return -1;
      return 0;
    }
    function sortpadj(a, b) {
      if ( a["p.adj"] < b["p.adj"] ) return 1;
      if ( a["p.adj"] > b["p.adj"] ) return -1;
      return 0;
    }

    function drawANOVA(pvalcut) {
        let plotdiv = document.getElementById(anovadiv)
        let pvalsfilter = anovapvals.filter((pval) => pval["p.adj"] != 0 && pval["p.adj"] < pvalcut)
        if (multicat == "true") {
            let newanovapvals = []
            anovapvals.forEach((row) => {
                for (const key in row) {
                    let newrow = {}
                    newrow["Metabolite"] = row["1"]
                    if (key != "1") {
                        newrow["p.adj"] = row[key]
                        newrow["FactorGroup"] = key
                    }
                    newanovapvals.push(newrow)
                }
            })
            pvalsfilter = newanovapvals.filter((pval) => pval["p.adj"] != 0 && pval["p.adj"] < pvalcut)
        }
        pvalsfilter.sort(sortpadj);
        pvalsfilter.sort(sortFactorGroup);
        let metabolites = pvalsfilter.map((pval) => pval.Metabolite) // x-axis values
        let values = pvalsfilter.map((pval) => -Math.log10(pval["p.adj"]) * 5) // size of the point
        let newYvals = pvalsfilter.map((pval) => pval.FactorGroup.replace(':','')) // y-axis values
        var trace1 = {
            mode: "markers",
            marker: {
                size: values,
                color: customColors.blue,
            },
            hoverlabel: {
              bgcolor: customColors.lightblue,
              bordercolor: customColors.border,
              font: {
                  color: 'black',
                  size: 14
              }
            },
            hovertemplate: '<b>Adjusted pvalue</b>: %{text}' +
                '<br><b>Comparison Group</b>: %{y}' +
                '<br><b>Compound Name</b>: %{x}<br><extra></extra>',
            text: pvalsfilter.map((pval) => 
                         typeof pval["p.adj"] === "number" ? pval["p.adj"].toExponential(2) : pval["p.adj"]
                   ),
            x: metabolites,
            y: newYvals
        }
        const uniqueYvals = newYvals.filter((value, index, self) => self.indexOf(value) === index);
        let myheight = uniqueYvals.length * 20 + 500;
        var layout = {
            xaxis: {
                rangeslider: {
                    visible: true,
                    thickness: 0.15
                },
                title: "Compounds",
                tickmode: "array",
                tickvals: metabolites,
                ticktext: metabolites.map(label => 
                   label.length > 20 ? label.substring(0, 20) + '...' : label
                ),
                range: [-1, 19]
            },
            hovermode: 'closest',
            margin: {
                t: 50,
                r: 100,
                b: 100,
                l: 200
            },
            title: "ANOVA Results<br><span style='font-size:12px;color:#0f0f0f;'>(← use range slider below to pan →)</span>",
            yaxis: {
                automargin: true,
                tickmode: "array",
                tickvals: newYvals,
                ticktext: newYvals,
                title: {
                  text: "Comparison Groups",
                  standoff: 30
                },
                tickfont: {
                    size: 12,
                    color: 'black'
                },
                dtick: 1
            },
            showlegend: false,
            height: myheight,
            width: 1000,
            autosize: false
        }
        var config = {
            scrollZoom: true,
            displayModeBar: true,
            modeBarButtons: [['zoom2d', 'pan2d', 'resetScale2d', 'toImage']]
        }
        Plotly.react(plotdiv, [trace1], layout, config);
        plotdiv.on('plotly_click', function(metadata) {
            let metaName = metadata.points[0].y
            $('#plotShow').empty()
            drawPlot(metaName, 0)
        })
        $("#" + anovadiv + " .plot-container").addClass("col-xs-10")
    }
    $("#" + inputid).change(updatePvalueFromInput);
    function updatePvalueFromInput() {
        let pvalue = $("#" + inputid).val()
        drawANOVA(pvalue)
        $("#" + sliderid).slider("value", pvalue);
    }
    $('#' + sliderid).slider({
        min: 0.001,
        max: 0.10,
        step: 0.001,
        value: 0.05,
        create: attachSlider,
        slide: attachSlider,
        stop: attachSlider
    })
    $("#" + sliderid).css("width", "45%");
    $("#" + sliderid).css("margin-left", "5%");
    $("#" + sliderid).css("margin-right", "5%");
    $("#" + sliderid).css("margin-top", "10px");
    $("#" + sliderid).css("margin-bottom", "10px");
    function attachSlider() {
        let pvalue = $('#' + sliderid).slider("value");
        $("#" + inputid).val(pvalue);
        drawANOVA(pvalue)
    }
}
if (typeof pvalsmajor != "undefined") {
    dynamicANOVA(pvalsmajor, "pairmajor")
}
if (typeof pvalsminor != "undefined") {
    dynamicANOVA(pvalsminor, "pairminor")
}

if (typeof pvalsmulti != "undefined") {
    dynamicANOVA(pvalsmulti, "multilinear")
}

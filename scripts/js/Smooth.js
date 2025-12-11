/*
Smooth.js version 0.1.7

Turn arrays into smooth functions.

Copyright 2012 Spencer Cohen
Licensed under MIT license (see "Smooth.js MIT license.txt")
*/

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

/*Constants (these are accessible by Smooth.WHATEVER in user space)
 */

(function() {
    var AbstractInterpolator, CubicInterpolator, Enum, LinearInterpolator, NearestInterpolator, PI, SincFilterInterpolator, Smooth, clipClamp, clipMirror, clipPeriodic, defaultConfig, getColumn, getType, isValidNumber, k, makeLanczosWindow, makeScaledFunction, makeSincKernel, normalizeScaleTo, shallowCopy, sin, sinc, v, validateNumber, validateVector,
        __hasProp = Object.prototype.hasOwnProperty,
        __extends = function(child, parent) {
            for (var key in parent) {
                if (__hasProp.call(parent, key)) child[key] = parent[key];
            }

            function ctor() {
                this.constructor = child;
            }
            ctor.prototype = parent.prototype;
            child.prototype = new ctor;
            child.__super__ = parent.prototype;
            return child;
        };

    Enum = {
        /*Interpolation methods
         */
        METHOD_NEAREST: 'nearest',
        METHOD_LINEAR: 'linear',
        METHOD_CUBIC: 'cubic',
        METHOD_LANCZOS: 'lanczos',
        METHOD_SINC: 'sinc',
        /*Input clipping modes
         */
        CLIP_CLAMP: 'clamp',
        CLIP_ZERO: 'zero',
        CLIP_PERIODIC: 'periodic',
        CLIP_MIRROR: 'mirror',
        /* Constants for control over the cubic interpolation tension
         */
        CUBIC_TENSION_DEFAULT: 0,
        CUBIC_TENSION_CATMULL_ROM: 0
    };

    defaultConfig = {
        method: Enum.METHOD_CUBIC,
        cubicTension: Enum.CUBIC_TENSION_DEFAULT,
        clip: Enum.CLIP_CLAMP,
        scaleTo: 0,
        sincFilterSize: 2,
        sincWindow: void 0
    };

    /*Index clipping functions
     */

    clipClamp = function(i, n) {
        return Math.max(0, Math.min(i, n - 1));
    };

    clipPeriodic = function(i, n) {
        i = i % n;
        if (i < 0) i += n;
        return i;
    };

    clipMirror = function(i, n) {
        var period;
        period = 2 * (n - 1);
        i = clipPeriodic(i, period);
        if (i > n - 1) i = period - i;
        return i;
    };

    /*
    Abstract scalar interpolation class which provides common functionality for all interpolators

    Subclasses must override interpolate().
    */

    AbstractInterpolator = (function() {

        function AbstractInterpolator(array, config) {
            this.array = array.slice(0);
            this.length = this.array.length;
            if (!(this.clipHelper = {
                    clamp: this.clipHelperClamp,
                    zero: this.clipHelperZero,
                    periodic: this.clipHelperPeriodic,
                    mirror: this.clipHelperMirror
                }[config.clip])) {
                throw "Invalid clip: " + config.clip;
            }
        }

        AbstractInterpolator.prototype.getClippedInput = function(i) {
            if ((0 <= i && i < this.length)) {
                return this.array[i];
            } else {
                return this.clipHelper(i);
            }
        };

        AbstractInterpolator.prototype.clipHelperClamp = function(i) {
            return this.array[clipClamp(i, this.length)];
        };

        AbstractInterpolator.prototype.clipHelperZero = function(i) {
            return 0;
        };

        AbstractInterpolator.prototype.clipHelperPeriodic = function(i) {
            return this.array[clipPeriodic(i, this.length)];
        };

        AbstractInterpolator.prototype.clipHelperMirror = function(i) {
            return this.array[clipMirror(i, this.length)];
        };

        AbstractInterpolator.prototype.interpolate = function(t) {
            throw 'Subclasses of AbstractInterpolator must override the interpolate() method.';
        };

        return AbstractInterpolator;

    })();

    NearestInterpolator = (function(_super) {

        __extends(NearestInterpolator, _super);

        function NearestInterpolator() {
            NearestInterpolator.__super__.constructor.apply(this, arguments);
        }

        NearestInterpolator.prototype.interpolate = function(t) {
            return this.getClippedInput(Math.round(t));
        };

        return NearestInterpolator;

    })(AbstractInterpolator);

    LinearInterpolator = (function(_super) {

        __extends(LinearInterpolator, _super);

        function LinearInterpolator() {
            LinearInterpolator.__super__.constructor.apply(this, arguments);
        }

        LinearInterpolator.prototype.interpolate = function(t) {
            var k;
            k = Math.floor(t);
            t -= k;
            return (1 - t) * this.getClippedInput(k) + t * this.getClippedInput(k + 1);
        };

        return LinearInterpolator;

    })(AbstractInterpolator);

    CubicInterpolator = (function(_super) {

        __extends(CubicInterpolator, _super);

        function CubicInterpolator(array, config) {
            this.tangentFactor = 1 - Math.max(0, Math.min(1, config.cubicTension));
            CubicInterpolator.__super__.constructor.apply(this, arguments);
        }

        CubicInterpolator.prototype.getTangent = function(k) {
            return this.tangentFactor * (this.getClippedInput(k + 1) - this.getClippedInput(k - 1)) / 2;
        };

        CubicInterpolator.prototype.interpolate = function(t) {
            var k, m, p, t2, t3;
            k = Math.floor(t);
            m = [this.getTangent(k), this.getTangent(k + 1)];
            p = [this.getClippedInput(k), this.getClippedInput(k + 1)];
            t -= k;
            t2 = t * t;
            t3 = t * t2;
            return (2 * t3 - 3 * t2 + 1) * p[0] + (t3 - 2 * t2 + t) * m[0] + (-2 * t3 + 3 * t2) * p[1] + (t3 - t2) * m[1];
        };

        return CubicInterpolator;

    })(AbstractInterpolator);

    sin = Math.sin, PI = Math.PI;

    sinc = function(x) {
        if (x === 0) {
            return 1;
        } else {
            return sin(PI * x) / (PI * x);
        }
    };

    makeLanczosWindow = function(a) {
        return function(x) {
            return sinc(x / a);
        };
    };

    makeSincKernel = function(window) {
        return function(x) {
            return sinc(x) * window(x);
        };
    };

    SincFilterInterpolator = (function(_super) {

        __extends(SincFilterInterpolator, _super);

        function SincFilterInterpolator(array, config) {
            SincFilterInterpolator.__super__.constructor.apply(this, arguments);
            this.a = config.sincFilterSize;
            if (!config.sincWindow) throw 'No sincWindow provided';
            this.kernel = makeSincKernel(config.sincWindow);
        }

        SincFilterInterpolator.prototype.interpolate = function(t) {
            var k, n, sum, _ref, _ref2;
            k = Math.floor(t);
            sum = 0;
            for (n = _ref = k - this.a + 1, _ref2 = k + this.a; _ref <= _ref2 ? n <= _ref2 : n >= _ref2; _ref <= _ref2 ? n++ : n--) {
                sum += this.kernel(t - n) * this.getClippedInput(n);
            }
            return sum;
        };

        return SincFilterInterpolator;

    })(AbstractInterpolator);

    getColumn = function(arr, i) {
        var row, _i, _len, _results;
        _results = [];
        for (_i = 0, _len = arr.length; _i < _len; _i++) {
            row = arr[_i];
            _results.push(row[i]);
        }
        return _results;
    };

    makeScaledFunction = function(f, baseScale, scaleRange) {
        var scaleFactor, translation;
        if (scaleRange.join === '0,1') {
            return f;
        } else {
            scaleFactor = baseScale / (scaleRange[1] - scaleRange[0]);
            translation = scaleRange[0];
            return function(t) {
                return f(scaleFactor * (t - translation));
            };
        }
    };

    getType = function(x) {
        return Object.prototype.toString.call(x).slice('[object '.length, -1);
    };

    validateNumber = function(n) {
        if (isNaN(n)) throw 'NaN in Smooth() input';
        if (getType(n) !== 'Number') throw 'Non-number in Smooth() input';
        if (!isFinite(n)) throw 'Infinity in Smooth() input';
    };

    validateVector = function(v, dimension) {
        var n, _i, _len;
        if (getType(v) !== 'Array') throw 'Non-vector in Smooth() input';
        if (v.length !== dimension) throw 'Inconsistent dimension in Smooth() input';
        for (_i = 0, _len = v.length; _i < _len; _i++) {
            n = v[_i];
            validateNumber(n);
        }
    };

    isValidNumber = function(n) {
        return (getType(n) === 'Number') && isFinite(n) && !isNaN(n);
    };

    normalizeScaleTo = function(s) {
        var invalidErr;
        invalidErr = "scaleTo param must be number or array of two numbers";
        switch (getType(s)) {
            case 'Number':
                if (!isValidNumber(s)) throw invalidErr;
                s = [0, s];
                break;
            case 'Array':
                if (s.length !== 2) throw invalidErr;
                if (!(isValidNumber(s[0]) && isValidNumber(s[1]))) throw invalidErr;
                break;
            default:
                throw invalidErr;
        }
        return s;
    };

    shallowCopy = function(obj) {
        var copy, k, v;
        copy = {};
        for (k in obj) {
            if (!__hasProp.call(obj, k)) continue;
            v = obj[k];
            copy[k] = v;
        }
        return copy;
    };

    Smooth = function(arr, config) {
        var baseDomainEnd, dimension, i, interpolator, interpolatorClass, interpolators, k, n, properties, smoothFunc, v;
        if (config == null) config = {};
        properties = {};
        config = shallowCopy(config);
        properties.config = shallowCopy(config);
        if (config.scaleTo == null) config.scaleTo = config.period;
        if (config.sincFilterSize == null) {
            config.sincFilterSize = config.lanczosFilterSize;
        }
        for (k in defaultConfig) {
            if (!__hasProp.call(defaultConfig, k)) continue;
            v = defaultConfig[k];
            if (config[k] == null) config[k] = v;
        }
        if (!(interpolatorClass = {
                nearest: NearestInterpolator,
                linear: LinearInterpolator,
                cubic: CubicInterpolator,
                lanczos: SincFilterInterpolator,
                sinc: SincFilterInterpolator
            }[config.method])) {
            throw "Invalid method: " + config.method;
        }
        if (config.method === 'lanczos') {
            config.sincWindow = makeLanczosWindow(config.sincFilterSize);
        }
        if (arr.length < 2) throw 'Array must have at least two elements';
        properties.count = arr.length;
        smoothFunc = (function() {
            var _i, _j, _len, _len2;
            switch (getType(arr[0])) {
                case 'Number':
                    properties.dimension = 'scalar';
                    if (Smooth.deepValidation) {
                        for (_i = 0, _len = arr.length; _i < _len; _i++) {
                            n = arr[_i];
                            validateNumber(n);
                        }
                    }
                    interpolator = new interpolatorClass(arr, config);
                    return function(t) {
                        return interpolator.interpolate(t);
                    };
                case 'Array':
                    properties.dimension = dimension = arr[0].length;
                    if (!dimension) throw 'Vectors must be non-empty';
                    if (Smooth.deepValidation) {
                        for (_j = 0, _len2 = arr.length; _j < _len2; _j++) {
                            v = arr[_j];
                            validateVector(v, dimension);
                        }
                    }
                    interpolators = (function() {
                        var _results;
                        _results = [];
                        for (i = 0; 0 <= dimension ? i < dimension : i > dimension; 0 <= dimension ? i++ : i--) {
                            _results.push(new interpolatorClass(getColumn(arr, i), config));
                        }
                        return _results;
                    })();
                    return function(t) {
                        var interpolator, _k, _len3, _results;
                        _results = [];
                        for (_k = 0, _len3 = interpolators.length; _k < _len3; _k++) {
                            interpolator = interpolators[_k];
                            _results.push(interpolator.interpolate(t));
                        }
                        return _results;
                    };
                default:
                    throw "Invalid element type: " + (getType(arr[0]));
            }
        })();
        if (config.clip === 'periodic') {
            baseDomainEnd = arr.length;
        } else {
            baseDomainEnd = arr.length - 1;
        }
        config.scaleTo || (config.scaleTo = baseDomainEnd);
        properties.domain = normalizeScaleTo(config.scaleTo);
        smoothFunc = makeScaledFunction(smoothFunc, baseDomainEnd, properties.domain);
        properties.domain.sort();
        /*copy properties
         */
        for (k in properties) {
            if (!__hasProp.call(properties, k)) continue;
            v = properties[k];
            smoothFunc[k] = v;
        }
        return smoothFunc;
    };

    for (k in Enum) {
        if (!__hasProp.call(Enum, k)) continue;
        v = Enum[k];
        Smooth[k] = v;
    }

    Smooth.deepValidation = true;

    (typeof exports !== "undefined" && exports !== null ? exports : window).Smooth = Smooth;

}).call(this);


function calcDeltaAUC () {
    if (deltaAUCall.length != 0) {
	$("#aucDiv").append("<label for='aucselect'>Groups</label><select id='aucselect'></select></br>")
	$("#aucDiv").append("<table id='aucTable'><thead><tr><th>Compound name</th><th>Primary Pathway</th><th>&Delta;AUC</th><th>1<sup>st</sup>AUC</th><th>2<sup>nd</sup>AUC</th><th>&percnt;&Delta;AUC</th><th>propAUC</th><th>+AUC</th><th>-AUC</th></tr></thead></table><div id='aucplot'></div>")
	$.each(Object.keys(deltaAUCall), function(i, value) {
	    $('#aucselect').append($('<option>').text(value).attr('value', value));
	});
	updateDeltaAUC(deltaAUCall[$("#aucselect").val()])

	function updateDeltaAUC(deltaData) {
	    deltaData.forEach((compound) => {
		compound["primaryPathway"] = primaryPathwayDict.filter((line) => line[0] == compound["_row"])[0][1];
	      });
	    var aucTable = $('#aucTable').DataTable({
		data: deltaData,
		"bDestroy": true,
		columns: [{
			data: '_row'
		    },
		    {
			data: 'primaryPathway'
		    },
		    {
			data: 'DeltaAUC'
		    },
		    {
			data: 'firstAUC'
		    },
		    {
			data: 'secondAUC'
		    },
		    {
			data: 'percentDeltaAUC'
		    },
		    {
			data: 'propAUC'
		    },
		    {
			data: 'posAUC'
		    },
		    {
			data: 'negAUC'
		    }
		],
		order: [
		    [6, "desc"],
		    [5, "desc"]
		],
		dom: 'Bfrtip',
		buttons: [
		    'copy', {
			extend: 'excelHtml5',
			title: 'TimeSeries_deltaAUC_data_export'
		    }, {
			extend: 'csvHtml5',
			title: 'TimeSeries_deltaAUC_data_export'
		    }
		]

	    });
	    aucTable.$('tr').tooltip({
		"delay": 0,
		"track": true,
		"fade": 250
	    });
	}

	$("#aucselect").change(() => {
	    $('#autTable').dataTable().fnDestroy();
	    var deltaGroup = $("#aucselect").val()
	    updateDeltaAUC(deltaAUCall[deltaGroup])
	})

	$('#aucTable tbody tr').each(function() {
	    this.setAttribute('title', "Click to view plot.");
	})




	$('#aucTable').on('click', 'tr', function() {
	    let metaName = $(this).children('td:first-child').text()
	    $("#searchCompounds").val(metaName);
	    $("#searchClass").val(metaName);
	    $('#plotShow').empty()
	    drawPlot(metaName, 0)
		// console.log(metaName)
		// let plotdiv = document.getElementById('aucplot')
		// drawAUCPlot(metaName, plotdiv)
	});
    }
}

function median(values) {
    // if (values.length === 0) throw new Error("No inputs");
    if (values.length === 0) return 0;
    if (values.length === 1) return values[0];

    values.sort(function(a, b) {
        return a - b;
    });

    var half = Math.floor(values.length / 2);

    if (values.length % 2)
        return values[half];

    return (values[half - 1] + values[half]) / 2.0;
}

function drawAUCPlot(metaValue, metaName, plotdiv) {
    var major = groups[0]
    var minor = groups[1]
    var majorbatch = batches[major]
    const sortAlphaNum = (a, b) => a.toString().localeCompare(b.toString(), 'en', { numeric: true })
    var minorbatch = batches[minor].sort(sortAlphaNum)
    var checknumber = minorbatch.every(function(element) {
        return typeof element === 'number';
    });
    if (checknumber) {
        minorbatch.sort(function(a, b) {
            return a - b;
        });
    }
    // var minorbatch = batches[minor].sort()
    var xlabels = []
    var numvalues


    var reduce = majorbatch.map((batch, index) => {
        var group = metaValue.filter((line) => {
            return line[major] == batch
        })
        return minorbatch.map((time) => {
            var timevalues = group.filter((line) => {
                return line[minor] == time
            })
            var times = timevalues.map((line) => line.value)
            var medianvalue = median(times)
            var medianObject = {
                "metabolite": metaName,
                "value": medianvalue
            }
            medianObject[major] = batch
            medianObject[minor] = time
            return medianObject
        })
    })
    var reduceData = [].concat.apply([], reduce);

    var trace1 = majorbatch.map((batch, index) => {
        var group1 = reduceData.filter((line) => {
            return line[major] == batch
        })
        let values = group1.map((line) => line.value)
        var trace = {
            x: Array(group1.length).fill().map((element, index) => index + 1),
            y: values,
            mode: "markers",
            name: batch,
            marker: {
                color: mulcolors[index]
            }
        }
        return trace
    })


    var trace2 = majorbatch.map((batch, index) => {
        var group1 = reduceData.filter((line) => {
            return line[major] == batch
        })
        let values = group1.map((line) => line.value)
        numvalues = values.length
        let smooth = Smooth(values, { scaleTo: [1, numvalues] })
        let interval = numvalues / 200
        let yvalue = []
        let xvalue = []
        xlabels = group1.map((line) => line[minor])
        for (let i = 1; i <= numvalues; i = i + interval) {
            xvalue.push(i)
            yvalue.push(smooth(i))
        }
        var trace = {
            y: yvalue,
            x: xvalue,
            name: batch,
            mode: 'lines',
            marker: {
                color: mulcolors[index]
            }
        };
        return trace
    })
    var data = []
    trace1.forEach((one) => data.push(one))
    trace2.forEach((one) => data.push(one))
    let start = 1
    let stop = numvalues + 1
    let xvals = Array(Math.ceil(stop - start)).fill(start).map((x, y) => x + y)
    var layout = {
        title: metaName,
        yaxis: {
            title: 'Intensity',
            zeroline: false,
            showexponent: 'all',
            exponentformat: 'e'
        },
        xaxis: {
            tickvals: xvals,
            ticktext: xlabels
        },
        boxmode: 'group'
    };
    var config = {
        toImageButtonOptions: {
          format: 'svg', // one of png, svg, jpeg, webp
          filename: metaName + ' deltaAUC',
          height: 600,
          width: 1000,
          scale: 1 // Multiply title/legend/axis/canvas sizes by this factor
        }
    }
    Plotly.newPlot(plotdiv, data, layout, config);

}

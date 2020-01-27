// modules are defined as an array
// [ module function, map of requires ]
//
// map of requires is short require name -> numeric require
//
// anything defined in a previous bundle is accessed via the
// orig method which is the require for previous bundles
parcelRequire = (function (modules, cache, entry, globalName) {
  // Save the require from previous bundle to this closure if any
  var previousRequire = typeof parcelRequire === 'function' && parcelRequire;
  var nodeRequire = typeof require === 'function' && require;

  function newRequire(name, jumped) {
    if (!cache[name]) {
      if (!modules[name]) {
        // if we cannot find the module within our internal map or
        // cache jump to the current global require ie. the last bundle
        // that was added to the page.
        var currentRequire = typeof parcelRequire === 'function' && parcelRequire;
        if (!jumped && currentRequire) {
          return currentRequire(name, true);
        }

        // If there are other bundles on this page the require from the
        // previous one is saved to 'previousRequire'. Repeat this as
        // many times as there are bundles until the module is found or
        // we exhaust the require chain.
        if (previousRequire) {
          return previousRequire(name, true);
        }

        // Try the node require function if it exists.
        if (nodeRequire && typeof name === 'string') {
          return nodeRequire(name);
        }

        var err = new Error('Cannot find module \'' + name + '\'');
        err.code = 'MODULE_NOT_FOUND';
        throw err;
      }

      localRequire.resolve = resolve;
      localRequire.cache = {};

      var module = cache[name] = new newRequire.Module(name);

      modules[name][0].call(module.exports, localRequire, module, module.exports, this);
    }

    return cache[name].exports;

    function localRequire(x){
      return newRequire(localRequire.resolve(x));
    }

    function resolve(x){
      return modules[name][1][x] || x;
    }
  }

  function Module(moduleName) {
    this.id = moduleName;
    this.bundle = newRequire;
    this.exports = {};
  }

  newRequire.isParcelRequire = true;
  newRequire.Module = Module;
  newRequire.modules = modules;
  newRequire.cache = cache;
  newRequire.parent = previousRequire;
  newRequire.register = function (id, exports) {
    modules[id] = [function (require, module) {
      module.exports = exports;
    }, {}];
  };

  var error;
  for (var i = 0; i < entry.length; i++) {
    try {
      newRequire(entry[i]);
    } catch (e) {
      // Save first error but execute all entries
      if (!error) {
        error = e;
      }
    }
  }

  if (entry.length) {
    // Expose entry point to Node, AMD or browser globals
    // Based on https://github.com/ForbesLindesay/umd/blob/master/template.js
    var mainExports = newRequire(entry[entry.length - 1]);

    // CommonJS
    if (typeof exports === "object" && typeof module !== "undefined") {
      module.exports = mainExports;

    // RequireJS
    } else if (typeof define === "function" && define.amd) {
     define(function () {
       return mainExports;
     });

    // <script>
    } else if (globalName) {
      this[globalName] = mainExports;
    }
  }

  // Override the current require with this new one
  parcelRequire = newRequire;

  if (error) {
    // throw error from earlier, _after updating parcelRequire_
    throw error;
  }

  return newRequire;
})({"scripts/taxibooking.js":[function(require,module,exports) {
//Change navigation icon style
navToggle = function navToggle(navIcon) {
  return navIcon.classList.toggle("crossIcon");
};

var navButton = document.getElementById("navToggle");
var zoomOut = document.getElementById("zoomOutDiv");

navButton.onclick = function () {
  navToggle(this);
};

navButton.addEventListener("mouseenter", function () {
  return zoomOut.classList.add("navInnerContainer-hover");
});
navButton.addEventListener("mouseleave", function () {
  return zoomOut.classList.remove("navInnerContainer-hover");
}); //Autocomplete the address fields using google Autocomplete places API

function initAutocomplete() {
  // Find pickup lacation
  pickUpLocation = new google.maps.places.Autocomplete(pickUpLocationInput, {
    //Return only geocoding results and restrict to UK address
    types: ["geocode"],
    componentRestrictions: {
      country: ["gb"]
    }
  }); // Find dropoff lacation

  dropOffLocation = new google.maps.places.Autocomplete(dropOffLocationInput, {
    //Return only geocoding results and restrict to UK address
    types: ["geocode"],
    componentRestrictions: {
      country: ["gb"]
    }
  });
}

var pickUpLocationInput = document.getElementById("pickUpLocation");
var dropOffLocationInput = document.getElementById("dropOffLocation");
var pickUpBgColor = document.getElementById("inputPickContainer");
var dropOffBgColor = document.getElementById("inputDropContainer");
var pickUpValidationMsg = document.getElementById("pickUpAddressValid");
var dropOffValidationMsg = document.getElementById("dropOffAddressValid");

changePickBgBlue = function changePickBgBlue() {
  pickUpBgColor.classList.remove("changeBgPurple");
  pickUpBgColor.classList.add("changeBgBlue");
};

changeDropBgBlue = function changeDropBgBlue() {
  dropOffBgColor.classList.remove("changeBgPurple");
  dropOffBgColor.classList.add("changeBgBlue");
};

changePickBgPurple = function changePickBgPurple() {
  pickUpValidationMsg.innerHTML = "Please enter a valid address";
  pickUpBgColor.classList.remove("changeBgBlue");
  pickUpBgColor.classList.add("changeBgPurple");
  pickUpLocationInput.classList.add("changeBorderPurple");
};

changeDropBgPurple = function changeDropBgPurple() {
  dropOffValidationMsg.innerHTML = "Please enter a valid address";
  dropOffBgColor.classList.remove("changeBgBlue");
  dropOffBgColor.classList.add("changeBgPurple");
  dropOffLocationInput.classList.add("changeBorderPurple");
};

removePickBgPurple = function removePickBgPurple() {
  pickUpValidationMsg.innerHTML = "";
  pickUpBgColor.classList.remove("changeBgPurple");
  pickUpBgColor.classList.remove("changeBgBlue");
  pickUpLocationInput.classList.remove("changeBorderPurple");
};

removeDropBgPurple = function removeDropBgPurple() {
  dropOffValidationMsg.innerHTML = "";
  dropOffBgColor.classList.remove("changeBgPurple");
  dropOffBgColor.classList.remove("changeBgBlue");
  dropOffLocationInput.classList.remove("changeBorderPurple");
}; //Change input textbox background color


pickUpLocationInput.addEventListener("focus", function () {
  return changePickBgBlue();
});
pickUpLocationInput.addEventListener("focusout", function () {
  if (pickUpValidationMsg !== "") {
    removePickBgPurple();
  }
});
dropOffLocationInput.addEventListener("focus", function () {
  return changeDropBgBlue();
});
dropOffLocationInput.addEventListener("focusout", function () {
  if (dropOffValidationMsg !== "") {
    removeDropBgPurple();
  }
}); //Find distance between 2 addresses using google API distance matrix service

document.getElementById("getQuote").addEventListener("click", function () {
  // Validate input address
  pickUpLocationInput.value === "" ? changePickBgPurple() : removePickBgPurple();
  dropOffLocationInput.value === "" ? changeDropBgPurple() : removeDropBgPurple();
  getDistance();
}); //Find the distance

function getDistance() {
  var service = new google.maps.DistanceMatrixService();
  service.getDistanceMatrix({
    origins: [pickUpLocationInput.value],
    destinations: [dropOffLocationInput.value],
    travelMode: google.maps.TravelMode.DRIVING,
    unitSystem: google.maps.UnitSystem.METRIC,
    durationInTraffic: true,
    avoidHighways: false,
    avoidTolls: false
  }, function (response, status) {
    if (status !== google.maps.DistanceMatrixStatus.OK) {
      alert("Error:", status);
    } else {
      // Get value in metres and convert to kilometres
      var distanceMetre = response.rows[0].elements[0].distance.value; // Round kilometres to 2nd decimel point

      document.getElementById("distanceKm").innerHTML = (distanceMetre / 1000).toFixed(2) + " " + "Kilometres"; // Change metres to miles

      var distanceMile = distanceMetre / 1000 * 0.621371; // Round miles to 2nd decimel point

      document.getElementById("distanceMile").innerHTML = distanceMile.toFixed(2) + " " + "Miles"; // Find the time duration

      var duration = response.rows[0].elements[0].duration.text;
      document.getElementById("duration").innerHTML = duration; // Find departure address

      var depatureFullAddress = response.originAddresses[0];
      document.getElementById("depatureFullAddress").innerHTML = depatureFullAddress; // Find arrival address

      var arrivalFullAddress = response.destinationAddresses[0];
      document.getElementById("arrivalFullAddress").innerHTML = arrivalFullAddress;
    }

    document.getElementById("journeyDetailsDisplayId").style.display = "block";
  });
} //Clear textbox on times button click


document.getElementById("clearButtonPick").addEventListener("click", function () {
  return pickUpLocationInput.value = "";
});
document.getElementById("clearButtonDrop").addEventListener("click", function () {
  return dropOffLocationInput.value = "";
}); //Change button BG color on mouse over

var mouseEvent = document.getElementById("getQuote");
var btnBgColorCng = document.getElementById("getQuoteBtnCId");
mouseEvent.addEventListener("mouseenter", function () {
  return btnBgColorCng.style.backgroundColor = "rgba(15, 172, 243, 0.4)";
});
mouseEvent.addEventListener("mouseleave", function () {
  return btnBgColorCng.style.backgroundColor = "rgba(15, 172, 243, 0.2)";
});
},{}],"../../AppData/Roaming/npm/node_modules/parcel-bundler/src/builtins/hmr-runtime.js":[function(require,module,exports) {
var global = arguments[3];
var OVERLAY_ID = '__parcel__error__overlay__';
var OldModule = module.bundle.Module;

function Module(moduleName) {
  OldModule.call(this, moduleName);
  this.hot = {
    data: module.bundle.hotData,
    _acceptCallbacks: [],
    _disposeCallbacks: [],
    accept: function (fn) {
      this._acceptCallbacks.push(fn || function () {});
    },
    dispose: function (fn) {
      this._disposeCallbacks.push(fn);
    }
  };
  module.bundle.hotData = null;
}

module.bundle.Module = Module;
var checkedAssets, assetsToAccept;
var parent = module.bundle.parent;

if ((!parent || !parent.isParcelRequire) && typeof WebSocket !== 'undefined') {
  var hostname = "" || location.hostname;
  var protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  var ws = new WebSocket(protocol + '://' + hostname + ':' + "60557" + '/');

  ws.onmessage = function (event) {
    checkedAssets = {};
    assetsToAccept = [];
    var data = JSON.parse(event.data);

    if (data.type === 'update') {
      var handled = false;
      data.assets.forEach(function (asset) {
        if (!asset.isNew) {
          var didAccept = hmrAcceptCheck(global.parcelRequire, asset.id);

          if (didAccept) {
            handled = true;
          }
        }
      }); // Enable HMR for CSS by default.

      handled = handled || data.assets.every(function (asset) {
        return asset.type === 'css' && asset.generated.js;
      });

      if (handled) {
        console.clear();
        data.assets.forEach(function (asset) {
          hmrApply(global.parcelRequire, asset);
        });
        assetsToAccept.forEach(function (v) {
          hmrAcceptRun(v[0], v[1]);
        });
      } else if (location.reload) {
        // `location` global exists in a web worker context but lacks `.reload()` function.
        location.reload();
      }
    }

    if (data.type === 'reload') {
      ws.close();

      ws.onclose = function () {
        location.reload();
      };
    }

    if (data.type === 'error-resolved') {
      console.log('[parcel] ✨ Error resolved');
      removeErrorOverlay();
    }

    if (data.type === 'error') {
      console.error('[parcel] 🚨  ' + data.error.message + '\n' + data.error.stack);
      removeErrorOverlay();
      var overlay = createErrorOverlay(data);
      document.body.appendChild(overlay);
    }
  };
}

function removeErrorOverlay() {
  var overlay = document.getElementById(OVERLAY_ID);

  if (overlay) {
    overlay.remove();
  }
}

function createErrorOverlay(data) {
  var overlay = document.createElement('div');
  overlay.id = OVERLAY_ID; // html encode message and stack trace

  var message = document.createElement('div');
  var stackTrace = document.createElement('pre');
  message.innerText = data.error.message;
  stackTrace.innerText = data.error.stack;
  overlay.innerHTML = '<div style="background: black; font-size: 16px; color: white; position: fixed; height: 100%; width: 100%; top: 0px; left: 0px; padding: 30px; opacity: 0.85; font-family: Menlo, Consolas, monospace; z-index: 9999;">' + '<span style="background: red; padding: 2px 4px; border-radius: 2px;">ERROR</span>' + '<span style="top: 2px; margin-left: 5px; position: relative;">🚨</span>' + '<div style="font-size: 18px; font-weight: bold; margin-top: 20px;">' + message.innerHTML + '</div>' + '<pre>' + stackTrace.innerHTML + '</pre>' + '</div>';
  return overlay;
}

function getParents(bundle, id) {
  var modules = bundle.modules;

  if (!modules) {
    return [];
  }

  var parents = [];
  var k, d, dep;

  for (k in modules) {
    for (d in modules[k][1]) {
      dep = modules[k][1][d];

      if (dep === id || Array.isArray(dep) && dep[dep.length - 1] === id) {
        parents.push(k);
      }
    }
  }

  if (bundle.parent) {
    parents = parents.concat(getParents(bundle.parent, id));
  }

  return parents;
}

function hmrApply(bundle, asset) {
  var modules = bundle.modules;

  if (!modules) {
    return;
  }

  if (modules[asset.id] || !bundle.parent) {
    var fn = new Function('require', 'module', 'exports', asset.generated.js);
    asset.isNew = !modules[asset.id];
    modules[asset.id] = [fn, asset.deps];
  } else if (bundle.parent) {
    hmrApply(bundle.parent, asset);
  }
}

function hmrAcceptCheck(bundle, id) {
  var modules = bundle.modules;

  if (!modules) {
    return;
  }

  if (!modules[id] && bundle.parent) {
    return hmrAcceptCheck(bundle.parent, id);
  }

  if (checkedAssets[id]) {
    return;
  }

  checkedAssets[id] = true;
  var cached = bundle.cache[id];
  assetsToAccept.push([bundle, id]);

  if (cached && cached.hot && cached.hot._acceptCallbacks.length) {
    return true;
  }

  return getParents(global.parcelRequire, id).some(function (id) {
    return hmrAcceptCheck(global.parcelRequire, id);
  });
}

function hmrAcceptRun(bundle, id) {
  var cached = bundle.cache[id];
  bundle.hotData = {};

  if (cached) {
    cached.hot.data = bundle.hotData;
  }

  if (cached && cached.hot && cached.hot._disposeCallbacks.length) {
    cached.hot._disposeCallbacks.forEach(function (cb) {
      cb(bundle.hotData);
    });
  }

  delete bundle.cache[id];
  bundle(id);
  cached = bundle.cache[id];

  if (cached && cached.hot && cached.hot._acceptCallbacks.length) {
    cached.hot._acceptCallbacks.forEach(function (cb) {
      cb();
    });

    return true;
  }
}
},{}]},{},["../../AppData/Roaming/npm/node_modules/parcel-bundler/src/builtins/hmr-runtime.js","scripts/taxibooking.js"], null)
//# sourceMappingURL=/taxibooking.95445d1a.js.map
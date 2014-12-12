require("sdk/preferences/service").set("javascript.options.strict", false);

var { XMLHttpRequest } = require('sdk/net/xhr');
var { Cc, Ci, Cu } = require('chrome')
var timers = require('sdk/timers');
var system = require('sdk/system');
var util = require('./dht/util.js');
var crypto = require('vendor/crypto-browserify.js');
var Peer = require('./dht/peer.js');
var SeedyServer = require('./seedy-server.js');
var constants = require('./constants.js');
var PublicKeyCache = require('./public-key-cache.js');

// var url = 'http://localhost:5001/'
// XMLHttpRequest.open()

// /*
setThemeToRed();

if (!('port' in system.staticArgs)) {
    throw 'numeric "port" is required in --static-args';
}
var port = system.staticArgs['port'];

if (!('isSeed' in system.staticArgs)) {
    throw 'boolean "isSeed" is required in --static-args';
}
var isSeed = system.staticArgs['isSeed'];

// We use "role" to uniquely identify the node to the origin server, so
// that we can selectively block one node during the demo
if (!('role' in system.staticArgs)) {
    throw 'string "role" is required in --static-args';
}
var role = system.staticArgs['role'];

// We use "isGullible" to toggle whether or not we verify content during
// the demo
var isGullible = false;
if ('isGullible' in system.staticArgs) {
    isGullible = system.staticArgs['isGullible'];
}

// We use "isGoogleDown" to simulate not being able to connect to google
var isGoogleDown = false;
if ('isGoogleDown' in system.staticArgs) {
    isGoogleDown = system.staticArgs['isGoogleDown'];
}

// We use "isEvil" to control whether a node should lie about all content
// it's asked to fetch
var isEvil = false;
if ('isEvil' in system.staticArgs) {
    isEvil = system.staticArgs['isEvil'];
}

var pps = Cc["@mozilla.org/network/protocol-proxy-service;1"]
          .getService(Ci.nsIProtocolProxyService);

var addonProxy = pps.newProxyInfo("http", "127.0.0.1", port, 0, -1, null);
var BYPASS_PROXY_SUFFIX = constants.BYPASS_PROXY_SUFFIX;
var filter = {
    applyFilter: function(pps, uri, proxy) {
        // Ignore random google stuff included with firefox
        if (uri.host.indexOf('google.com') !== -1 && uri.path.indexOf('/ocsp') !== -1) {
            return proxy;
        }

        // Ignore favicons
        if (uri.path.indexOf('favicon.ico') !== -1) {
            return proxy;
        }

        // ignore safebrowsing stuff for now, crowding up my logs
        if (uri.scheme === 'https') {
            return proxy;
        }

        if (uri.spec.indexOf(BYPASS_PROXY_SUFFIX) === -1) { // TODO: actually check for suffix only
            console.log('   > proxy addon for ' + uri.spec);
            return addonProxy;
        } else {
            console.log('   > proxy default for ' + uri.spec);
            return proxy;
        }
    }
};

pps.registerFilter(filter, 0);


function setThemeToRed() {
    var lightweightTheme = {
        id: "example-01",
        name: "Third Planet",
        headerURL: require("sdk/self").data.url('themes/red.png'),
        headerURL: require("sdk/self").data.url('themes/red.png'),
        textcolor: "#fff",
        accentcolor: "#6b6b6b"
    };

    var LightweightThemeManager = Cu.import("resource://gre/modules/LightweightThemeManager.jsm").LightweightThemeManager;
    LightweightThemeManager.themeChanged(lightweightTheme);
};

function setThemeToBlue() {
    var lightweightTheme = {
        id: "example-02",
        name: "Foxkeh Boom",
        headerURL: require("sdk/self").data.url('themes/blue.png'),
        headerURL: require("sdk/self").data.url('themes/blue.png'),
        textcolor: "#bcf",
        accentcolor: "#8888FF"
    };

    var LightweightThemeManager = Cu.import("resource://gre/modules/LightweightThemeManager.jsm").LightweightThemeManager;
    LightweightThemeManager.themeChanged(lightweightTheme);
};

// Set up machines for our demo


SEED_ID = 'AA00AA';
SEED_PORT = 5050;
var seedPeer = new Peer(SEED_ID, 'localhost', SEED_PORT, true);

var publicKeyCache = new PublicKeyCache();
var seedyServer = new SeedyServer(publicKeyCache, role, isGullible, isGoogleDown, isEvil);

if (system.staticArgs['isSeed'] === true) {
  setThemeToRed();
  if (!seedyServer.startServer(SEED_PORT)) {
    throw "Couldn't start the seed. " +
          "There's probably another server running on port " + SEED_PORT;
  }
  console.log('########## SeedyServer now running on localhost:' + port);
  var dhtServer = seedyServer.startDht(SEED_ID, true);
} else {
  setThemeToBlue();
  if (!seedyServer.startServer(system.staticArgs['port'])) {
    throw "Couldn't start the server. " +
          "There's probably another server running on port " + SEED_PORT;
  }
  console.log('########## SeedyServer now running on localhost:' + port);
  var id = '00BB00';
  var dhtServer = seedyServer.startDht(id, false, [seedPeer]);
}
// */

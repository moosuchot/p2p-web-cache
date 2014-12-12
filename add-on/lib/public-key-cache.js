var url = require('sdk/url');
var Request = require('sdk/request').Request;
var constants = require('./constants.js');

var PublicKeyCache = module.exports = function PublicKeyCache() {
    this._hostnameToKey = {};

    /* for debugging: */
    // var self = this;
    // require('sdk/timers').setInterval(function() {
    //     console.log('========~~~~~~~~~~~~============ Public key cache', self._hostnameToKey);
    // }, 2000);
};

const SSL_ONLY = false; // Setting this to false for the demo, for a real release this should be true!

PublicKeyCache.prototype.keyForUrl = function(theUrl, cb) {
    console.log('theURL', theUrl);
    var parsed = url.URL(theUrl);
    var hostname = parsed.hostname;
    var port = parsed.port;
    if (!SSL_ONLY) {
        if (port !== null) {
            hostname += ':' + port;
        }
    }
    return this.keyForHostname(hostname, cb);
};

PublicKeyCache.prototype.keyForHostname = function(hostname, cb) {
    var hostnameToKey = this._hostnameToKey;
    if (hostname in hostnameToKey) {
        var key = hostnameToKey[hostname].key;
        console.log('Found cached key for ' + hostname);
        cb(key);
    } else {
        var protocol = SSL_ONLY ? 'https://' : 'http://';
        var urlToFetch = protocol + hostname + '/public-key.txt';
        urlToFetch += constants.BYPASS_PROXY_SUFFIX;
        console.log('fetching', urlToFetch);
        try {
            var req = Request({
                url: urlToFetch,
                onComplete: function(response) {
                    var key = null;
                    if (response.status === 200) {
                        console.log('200');
                        var key = response.text;
                    }

                    // Store null keys so we don't keep requesting keys from servers that don't have any
                    // TODO: TTL
                    // TODO: lru
                    hostnameToKey[hostname] = {
                        key: key
                    };
                    cb && cb(key);
                }
            });
            req.get();
        } catch (e) {
            console.log('Error in keyForHostname: ', e, e.stack);
        }
    }

};

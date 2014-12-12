var HttpApp = require('./http-app');
var Server = require('./dht/server.js');
var { XMLHttpRequest } = require('sdk/net/xhr');
var { nsHttpServer } = require('vendor/httpd.js');
var constants = require('./constants.js');
var timers = require('sdk/timers');
var verifier = require('./verifier.js');

var BYPASS_PROXY_SUFFIX = constants.BYPASS_PROXY_SUFFIX;
console.log('BYPASS_PROXY_SUFFIX', BYPASS_PROXY_SUFFIX);
var MILLIS_UNTIL_DHT = constants.MILLIS_UNTIL_DHT;

var BAD_SIG_WARNING = '<body style="font-family:georgia">' +
                      '<h1 style="background-color:yellow; padding:12px; display:inline-block; box-shadow: inset 0 0 1px rgba(0, 0, 0, 0.5)">' +
                          '!!! Warning !!!</h1>' +
                      '<div>The signature sent by the peer could not be verified with the origin\'s public key.</div>' +
                      '</body>';

var SeedyServer = function(publicKeyCache, role, isGullible, isGoogleDown, isEvil) {

    var httpServer = this._httpServer = new nsHttpServer();
    var httpApp = this._httpApp = new HttpApp();
    this._publicKeyCache = publicKeyCache;
    this._role = role;
    this._isGullible = isGullible;
    this._isGoogleDown = isGoogleDown;
    this._isEvil = isEvil;

    this._setUpPathHandlers(httpServer, httpApp);
};

// Returns `true` if the server was able to start
SeedyServer.prototype.startServer = function(port) {
    try {
        this._httpServer.start(port);
        this._port = port;
        this._serverRunning = true;

        return true;
    } catch(e) {
        console.log('Server unable to start: ', e);
    }

    return false;
};

SeedyServer.prototype.startDht = function(id, isSeed, seeds) {
    if (!this._serverRunning) {
        throw new Error('You must call `startServer` before calling `startDht` (and it must succeed!)');
    }
    var dhtServer = this._dhtServer = new Server(id, this._port, isSeed, seeds, this._httpApp, this._isEvil);
    return dhtServer;
};

SeedyServer.prototype._setUpPathHandlers = function(httpServer, httpApp) {
    var publicKeyCache = this._publicKeyCache;
    var role = this._role;
    var isGullible = this._isGullible;
    var isGoogleDown = this._isGoogleDown;

    httpServer.registerPathHandler('/seedy', function(req, res) {
        // Proxy requests to the layer that notifies the DHT server.
        try {
            httpApp.handleRequest(req, res);
        } catch(e) {
            console.log('Error:', e, e.stack);
        }
    });

    var self = this;
    httpServer._handler._catchAllHandler = function(request, response) {
        var dhtServer = self._dhtServer;
        console.log('In proxy handler');
        response.processAsync();
        var host = request.host;
        if (request.port) {
            host += ':' + request.port;
        }
        var uri = request.scheme + "://" + host + request.path;
        var seedyUri = uri + '?cache='+(Math.random()*1000000); // TODO: actually parse the existing uri to make sure we deal with existing query params
        seedyUri += BYPASS_PROXY_SUFFIX;
        console.log('>> Requesting with XHR: ', seedyUri);

        // Prime the public key cache, just in case this request times out
        try {
            publicKeyCache.keyForUrl(uri, function (key) {
                // Great success - we cached a public key!
            });
        } catch(e) {
            console.log('ERROR:', e, e.stack);
        }

        var responseReceived = false;

        try {
            // If we don't hear back from the origin server within MILLIS_UNTIL_DHT,
            // that means it may be overloaded and so we set a timeout to contact Kademlia
            var timeout = timers.setTimeout(function () {
                console.log("Entered the catchAllHandler timeout function");
                if (responseReceived) {
                    console.log('Already got response from origin server');
                    return;
                }

                // Step 1: try and retrieve the public key
                publicKeyCache.keyForUrl(uri, function(publicKey) {
                    /* <DEMO-STUFF>
                        Normally if we don't have a public key for a host, we wouldn't
                        attempt to use the DHT for its content at all.
                        However, for the demo, we want to force gullible peers
                        to use the DHT to illustrate them getting bad content,
                        so we fake their public key here.
                       </DEMO-STUFF>
                     */
                    if (isGullible) {
                        console.log("Faking a publicKey for gullible peer");
                        publicKey = 'abc';
                    }

                    if (publicKey === null) {
                        // We didn't have the publicKey, so we have no way to
                        // verify p2p content. Give up on using the DHT.
                        console.log("No public key for " + uri + "; not using the DHT");
                        return;
                    }
                    console.log("SeedyServer had a publickey for " + uri);

                    // Step 2: ask the DHT if it has the content
                    try {
                        dhtServer.get(uri, function (err, pageText, signature) {
                            if (err) {
                                console.log('DHT did not have content for ' + uri);
                                // response.write('did not have content');
                                // response.finish();
                                // DHT didn't have the content. Send a fetch message so that
                                // the content will be stored in the DHT.
                                dhtServer.fetch(uri, function fetchCb(fetchedPageText, fetchedSignature) {
                                    console.log('Received FETCH, with pageText', fetchedPageText);
                                    console.log('              , with signature', fetchedSignature);
                                    console.log('                public key', publicKey);
                                    var contentVerified;
                                    if (isGullible) {
                                        contentVerified = true;
                                    } else {
                                        contentVerified = verifier.verify(publicKey, fetchedPageText, fetchedSignature);
                                    }

                                    if (contentVerified) {
                                        console.log('We are writing ', fetchedPageText.length, ' bytes');
                                        response.write(fetchedPageText);
                                        console.log('response.finish()');
                                        response.finish();
                                    } else {
                                        response.write(BAD_SIG_WARNING);
                                        response.finish();
                                    }
                                });
                            } else {
                                console.log('Received GET: DHT *DID* have content for ' + uri);
                            }

                            responseReceived = true;

                            try {
                                var contentVerified;
                                if (isGullible) {
                                    contentVerified = true;
                                } else {
                                    contentVerified = verifier.verify(publicKey, pageText, signature);
                                }

                                if (contentVerified) {
                                    console.log('Content verified, about to response.write ' + pageText.length + ' bytes');
                                    response.write(pageText);
                                    response.finish();
                                } else {
                                    response.write(BAD_SIG_WARNING);
                                    response.finish();
                                }
                            } catch (e) {
                                console.log('Error in verifier stuff: ', e, e.message, e.stack);
                            }
                        });
                    } catch (e) {
                        console.log('Error in DHT get: ', e, e.message, e.stack);
                    }
                });
            }, MILLIS_UNTIL_DHT);
        } catch (e) {
            console.log("error in catchAllHandler setTimeout block", e, e.stack);
        }

        //console.log('About to issue XHR request to ' + seedyUri);
        var xhr = new XMLHttpRequest();
        // Mimetype hack is required to get exactly the bytes from the original call
        xhr.overrideMimeType("text/plain; charset=x-user-defined");
        xhr.onreadystatechange = function() {
/*
            console.log('====================');
            console.log('  XHR READY STATE CHANGE');
            console.log('  State:', xhr.readyState, 'Status:', xhr.status);
            console.log('____________________');
*/

            if (xhr.readyState === 4) { // Complete
                if (xhr.status === 200) {
                    console.log('200 from XHR request!', seedyUri);
                    // We got a response from the origin server. Keep it if we
                    // haven't already heard from the DHT
                    if (responseReceived) {
                        console.log('Already have DHT result; returning');
                        return;
                    }
                    responseReceived = true;
                    timers.clearTimeout(timeout);
                    // console.log('200!', xhr.responseText);
                    // console.log('response headers', xhr.getAllResponseHeaders());
                    response.setStatusLine(request.httpVersion, 200, "OK");
                    // console.log('setting content type to', xhr.getResponseHeader('Content-Type'));
                    response.setHeader("Content-Type", xhr.getResponseHeader('Content-Type'), false);
                    // response.setHeader("Content-Length", xhr.getResponseHeader('Content-Length'), false);
                    body = xhr.response;
                    response.write(body);
                    response.finish();
                } else {
                    console.log('Received XHR response from origin server with status=' + xhr.status);
                }
            }
        };
        xhr.open('get', seedyUri, true);
        xhr.setRequestHeader('x-seedyn-role', role);
        console.log('/*****/ checking host', host);
        console.log('checking path', path);

        var path = request.path;
        console.log('checking path AGAIN', path);
        if (isGoogleDown && host.indexOf('google.com') !== -1 && (path === undefined || path === '/' || path === '')) {
            /* DEMO-SPECIFIC
             * We want to show a specific peer not being able to connect to google.com,
             * so that we can force him to use the DHT (and get 'malicious' content).
             * We fake that by not sending the request here.
             */
             console.log("!!DEMO!! Blocking google.com");
            return;
        } else {
            xhr.send(null);
        }
    };
};

SeedyServer.BYPASS_PROXY_SUFFIX = BYPASS_PROXY_SUFFIX;

module.exports = SeedyServer;

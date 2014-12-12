var Class = require('./class');
var Peer = require('./peer');
var util = require('./util');
var KBuckets = require('./kbuckets');
var timers = require('sdk/timers');
var Store = require('./store');
var Shortlists = require('./shortlists');
var { XMLHttpRequest } = require('sdk/net/xhr');

// Necessary to allow a request to leave the browser, and not be
// sent to the nsHttpServer instead.
var SIGNATURE_HEADER = require('../constants.js').SIGNATURE_HEADER;

// The number of nodes in which an object is cached.
var REPLICATION_FACTOR = require('../constants.js').REPLICATION_FACTOR;

// Although Kademlia's distance metric is not based on the physical separation
// of the machines, running fetches in parallel (the degree of parallelization
// is determined by ALPHA) helps increase the liklihood that the first value
// returned is from a relatively short path.
var ALPHA = 3;

// the max number of contacts stored in a bucket
var K = 20;

var NUM_BUCKETS = 160;
var PING_TIMEOUT = 1000;
var SHORTLIST_TIMEOUT = 5000;
var NUM_IDS_FOUND = SHORTLIST_LENGTH = 5;

// Prefix log with the port of the logging server
function log(server, msg) {
  console.log(server._host.getPort() + '  ' + msg);
}

function not(thing) {
  return thing === null || thing === undefined;
}

function tobool(value) {
  return value === 'true' || value === true;
}


var Server = module.exports = Class.extend({
  init: function(id, port, isSeed, seeds, httpApp, isEvil) {
    this._host = new Peer(id, 'localhost', port, isSeed);
    this._kbuckets = new KBuckets(id, K, NUM_BUCKETS);
    this._shortlists = new Shortlists(SHORTLIST_LENGTH);
    this._store = new Store();
    this._isEvil = isEvil;

    var thiz = this;
    httpApp.setListener(function(req, res) {
      var id = req.getHeader('id');
      var ip = req.getHeader('ip');
      var port = parseInt(req.getHeader('port'), 10);
      var isSeed = tobool(req.getHeader('isSeed'));
      var command = req.getHeader('command');

      if (not(id) || not(ip) || not(isSeed) || not(command)) {
        var err = 'The message is missing an id, ip, port, isSeed, or command';
        if (command) {
          err += ' from command ' + command;
        }
        throw err;
      }

      thiz.updatePeer(id, ip, port, isSeed);

      if (command == 'ping') {
        thiz.handlePing(req, res);
      } else if (command == 'findValue') {
        thiz.handleFind(req, res);
      } else if (command == 'findNode') {
        thiz.handleFind(req, res);
      } else if (command == 'store') {
        thiz.handleStore(req, res);
      } else if (command == 'fetch') {
        thiz.handleFetch(req, res);
      } else {
        throw 'Unexpected command: ' + command;
      }
    });

    if (!isSeed) {
      var seedIndex = 0;

      function shortlistTimeoutCB() {
        if (thiz._kbuckets.count() < 2) {
          // try another seed
          seedIndex++;
          if (seedIndex >= seeds.length) {
             // This is the case only when one peer is the first
             // to contact all seeds. This doesn't matter in practice.
             log(thiz, 'None of the seeds introduced me to peers ' +
                       'because I was the first peer to contact ' +
                       'all seeds.');
          } else {
            bootstrap(seedIndex);
          }
        } else {
          log(thiz, 'Done bootstrapping. I know of '
                    + thiz._kbuckets.count() + ' peers');
        }
      }

      function successCB(xhr) {
        var b = JSON.parse(xhr.responseText);
        for (var i = 0; i < b.nodes.length; i++) {
          var peer = new Peer(b.nodes[i].id,
                              b.nodes[i].ip,
                              parseInt(b.nodes[i].port, 10),
                              tobool(b.nodes[i].isSeed));
          thiz._kbuckets.add(peer, thiz);
          log(thiz, 'I\'m introduced to ' + b.nodes[i].port);

          // also add to the shortlist so that the timeout gets reset
          thiz._shortlists.add(thiz._host.getId(), peer);
        }
      }

      function bootstrap(seedIndex) {
        thiz._kbuckets.add(seeds[seedIndex], thiz);
        thiz._shortlists.addList(thiz._host.getId(), shortlistTimeoutCB,
                                 SHORTLIST_TIMEOUT);
        thiz.doFind(seeds[seedIndex], thiz._host.getId(), 'node', successCB);
      }

      bootstrap(seedIndex);
    }
  },

  getId: function() {
    return this._host.getId();
  },

  getPort: function() {
    return this._host.getPort();
  },

  // Client API (just get and fetch)
  //
  // `foundValueCB` is a function that takes three parameters:
  //   `err`, `pageText`, and `signature`
  // if (err), that means the content could not be found.
  //
  // Whenever we send an iterative FIND_VALUE, we store the value
  // at the closest node to the value, if we didn't find the value there.
  // Because we run ALPHA number of FIND_VALUE requests in parallel, it's
  // possible we'll get the value from a further node first, so we may
  // send unnecessary STORE requests. That doesn't matter to us right now.
  //
  get: function(url, foundValueCB) {
    var key = util.hash(url);
    var self = this;

    var value = this._store.get(key);
    if (value) {
      foundValueCB(null, value.pageText, value.signature);
    } else {
      var thiz = this;
      function shortlistTimeoutCB() {
        // first check if the value was stored on this server during the
        // lookup process
        var value = thiz._store.get(key);
        if (value !== null) {
          foundValueCB(null, value.pageText, value.signature);
        } else {
          foundValueCB('not found');
        }
        return;
      }

      this._shortlists.addList(key, shortlistTimeoutCB, SHORTLIST_TIMEOUT);

      function successCB(xhr) {
        if (xhr.getResponseHeader('command') == 'foundValue') {
          var closestPeer = thiz._kbuckets.closestPeers(key, 1)[0];
          if (closestPeer.getId() == xhr.getResponseHeader('id')) {
            thiz._shortlists.setClosestNodeHasValue(key, true);
            foundValueCB(null, xhr.responseText,
                         xhr.getResponseHeader('signature'));
            return;
          } else if (!thiz._shortlists.closestNodeHasValue(key)) {
            // store the value in the closest node that has
            // the value, which is shortlist[0]
            log(thiz, 'The value was not found in the peer closest to ' +
                      'the key, so I\'m sending that peer ' +
                      closestPeer.getPort() + ' a store message');
            // avoid sending the store message to this peer multiple times
            thiz._shortlists.setClosestNodeHasValue(key, true);
            thiz.doStore(closestPeer, key, xhr.responseText,
                         xhr.getResponseHeader('signature'));
            foundValueCB(null, xhr.responseText,
                         xhr.getResponseHeader('signature'));
            return;
          }
        } else {
          var b = JSON.parse(xhr.responseText);
          for (var i = 0; i < parseInt(b.nodes.length, 10); i++) {
            var peer = new Peer(b.nodes[i].id,
                                b.nodes[i].ip,
                                parseInt(b.nodes[i].port, 10),
                                tobool(b.nodes[i].isSeed));
            thiz._kbuckets.add(peer, thiz);
            if (thiz._shortlists.add(key, peer)) {
              thiz.doFind(peer, key, 'value', successCB);
            }
          }
        }
      }

      var peers = this._kbuckets.closestPeers(key, ALPHA);
      for (var i = 0; i < peers.length; i++) {
        if (peers[i].getId() != this._host.getId()) {
          this.doFind(peers[i], key, 'value', successCB);
        }
      }
    }
  },

  // `successCB` is a function that has two parameters:
  // pageText and signature
  //
  // This function should be called after get returns 'not found'
  //
  // A 'fetch' command is sent to the closest peer (ideally
  // closest ALPHA peers, but let's keep it simple for now) with
  // and id closest to the hash of the url. This peer then
  // requests the content located at that url. After receiving the
  // content, this peer responds with the content, and then stores
  // the content in REPLICATION_FACTOR other closest peers.
  fetch: function(url, successCB) {
    this.send(this._kbuckets.closestPeers(util.hash(url))[0],
              {
                command: 'fetch',
                url: url
              },
              '',
              function(xhr) {
                // Note that we cannot pass http text in JSON, because
                // our JSON parser fails on bad characters.
                successCB(xhr.responseText,
                          xhr.getResponseHeader('signature'));
              });
  },

  handleFetch: function(req, res) {
    var url = req.getHeader('url');
    var thiz = this;

    function successCB(xhr) {
      var key = util.hash(url);
      var signature = xhr.getResponseHeader(SIGNATURE_HEADER);
      if (not(signature)) {
        log(thiz, 'The signature was not returned in an HTTP header from ' +
                  'the origin server');
      }

      if (thiz._isEvil) {
        console.log("We're evil, so faking a signature now");
        signature = "trustme";
      }

      thiz._store.put(key, xhr.responseText, signature);
      thiz.replicate(key, xhr.responseText, signature);
      thiz.respond(res, {'signature': signature}, xhr.responseText);
    }

    // BEGIN DEMO
    // Hey, let's be malicious and serve the wrong content! Muahahahaaaa!
    if (this._isEvil) {
      console.log('!!!DEMO!!! Being MALICIOUS');
      thiz.respond(res, {'signature': 'LOLIMEVIL'}, '<html><body><input type="text" value="g00g" style="width:200px; height:40px; font-size:22px; display:inline-block; margin-right:8px; height:58px"></input><div style="border: 1px solid hsl(0, 0%, 86%); border-color: hsla(0, 0%, 0%, 0.1); color: hsl(0, 0%, 27%)!important; font-size: 22px;background: -moz-linear-gradient(center top , #F5F5F5, #F1F1F1) repeat scroll 0% 0% transparent; height:40px; line-height:40px; font-family:arial; padding:8px; display:inline-block; position:absolute;top: 8px;left: 216px;">i\'m feeling pwned</div></body></html>');
      return;
    }
    // END DEMO

    // Get the content from the the origin server
    this.send(null, {}, '', successCB, null, 'GET',
              url + '#bypass-seedy-proxy', true);
  },

  replicate: function(key, pageText, signature) {
    var peers = this._kbuckets.closestPeers(key, REPLICATION_FACTOR - 1);
    // find the closest machine id (next, the closest N machine IDs)
    // send the STORE to that peer (or N peers)
    for (var i = 0; i < peers.length; i++) {
      if (peers[i].getId() == this._host.getId()) {
        this._store.put(key, pageText, signature);
      } else {
        this.doStore(peers[i], key, pageText, signature);
      }
    }
  },

  doStore: function(peer, key, pageText, signature) {
    var headers = {command: 'store',
                   key: key,
                   signature: signature};
    this.send(peer, headers, pageText);
  },

  handleStore: function(req, res) {
    var key = req.getHeader('key');
    var pageText = req.body;
    var signature = req.getHeader('signature');
    if (typeof key != 'string' ||
        typeof pageText != 'string' ||
        typeof signature != 'string') {
      log(this, 'The store message is malformed');
    } else {
      this._store.put(req.getHeader('key'), pageText,
                      req.getHeader('signature'));
    }
  },

  doPing: function(peer, successCB, timeoutCB) {
    this.send(peer, {command: 'ping'}, '', successCB, timeoutCB);
  },

  handlePing: function(req, res) {
    this.respond(res, {command: 'pong'});
  },

  // `targetType` is 'node' or 'value'
  doFind: function(peer, id, targetType, successCB) {
    var headers = {key: id,
                   targetType: targetType};
    if (targetType == 'node') {
      headers.command = 'findNode';
    } else {
      headers.command = 'findValue';
    }
    this.send(peer, headers, '', successCB);
  },

  // a peer asked us to find something
  // findNode always returns the "up-to-N" closest peers to the target id,
  // even if this server has a node with the actual target id as a peer.
  handleFind: function(req, res) {
    if (req.getHeader('targetType') == 'value') {
      var value = this._store.get(req.getHeader('key'));
      if (not(value)) {
        this.findElsewhere(req, res);
        // the target does not exist in the store
      } else {
        log(this, 'I have the value that ' + req.getHeader('port') +
                  ' is asking for.');
        this.respond(res, {command: 'foundValue', signature: value.signature},
                           value.pageText);
      }
    } else {
      this.findElsewhere(req, res);
    }
  },

  findElsewhere: function(req, res) {
    var body = {nodes: []};
    // It's alright to ask seeds for the content, because although they
    // don't cache content, they might know peers close to the content.
    var peers = this._kbuckets.closestPeers(
      req.getHeader('key'), NUM_IDS_FOUND);
    for (var i = 0; i < peers.length; i++) {
      if (peers[i].getId() != req.getHeader('id')) {
        var peerTuple = {id: peers[i].getId(),
                         ip: peers[i].getIP(),
                         port: peers[i].getPort(),
                         isSeed: peers[i].isSeed()};
        log(this, 'responding to ' + req.getHeader('port') +
                  ' with node ' + peers[i].getPort());
        body.nodes.push(peerTuple);
      }
    }
    this.respond(res, {'Content-type': 'application/json'}, JSON.stringify(body));
  },

  updatePeer: function(id, ip, port, isSeed) {
    if (not(id) || not(ip)
        || typeof(port) != 'number'
        || typeof(isSeed) != 'boolean') {
      throw 'The message is missing an id, ip, port, or isSeed';
    }

    var peer = this._kbuckets.get(id);
    if (not(peer)) {
      peer = new Peer(id, ip, port, isSeed);
      this._kbuckets.add(peer);
      return peer;
    } else {
      return this._kbuckets.update(peer);
    }
  },

  respond: function(res, headers, body) {
    res.setHeader('id', this._host.getId());
    res.setHeader('ip', this._host.getIP());
    res.setHeader('port', this._host.getPort().toString());
    res.setHeader('isSeed', this._host.isSeed().toString());

    for (var key in headers) {
      res.setHeader(key, headers[key]);
    }

    res.write(body || '');
    res.finish();
  },

  send: function(peer, headers, body, successCB, timeoutCB, httpMethod, url, forceRaw) {
    if ('command' in headers) {
      log(this, 'sending ' + headers.command);
    }

    if (not(url)) {
      url = 'http://' + peer.getIP() + ':' + peer.getPort();
      url += '/seedy?cache='+(Math.random()*1000000);
      url += '#bypass-seedy-proxy';
    }

    var xhr = new XMLHttpRequest();
    if (timeoutCB) {
      var timeout = timers.setTimeout(function() {
        xhr.abort();
        timeoutCB();
      }, PING_TIMEOUT); // the only message that uses a timeout is ping.
    }
    if (url) {
      xhr.overrideMimeType('text/plain; charset=x-user-defined');
    }

    var self = this;
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) { // Complete
        if (xhr.status === 200) {
          if (not(url)) {
            self.updatePeer(xhr.getResponseHeader('id'),
                            xhr.getResponseHeader('ip'),
                            parseInt(xhr.getResponseHeader('port'), 10),
                            tobool(xhr.getResponseHeader('isSeed')));
          }
          if (successCB) {
            successCB(xhr);
          }
        } else {
          log(self, "Send request failed. " +
              "status=" + xhr.status +
              ", body=" + (xhr.responseText ? xhr.responseText.toString() : ""));
        }
      }
    };

    if (httpMethod == 'GET') {
      if (url.indexOf('http://') != 0) {
        url = 'http://' + url;
      }
      xhr.open('GET', url);
    } else {
      xhr.open('POST', url);
    }
    xhr.setRequestHeader('id', this._host.getId());
    xhr.setRequestHeader('ip', this._host.getIP());
    xhr.setRequestHeader('port', this._host.getPort());
    xhr.setRequestHeader('isSeed', this._host.isSeed());
    for (var key in headers) {
      xhr.setRequestHeader(key, headers[key]);
    }
    xhr.send(body);
  }
});

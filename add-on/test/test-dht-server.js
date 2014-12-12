/*
In this test, "server" refers to dhtServer. This test only tests the
functionality of the dhtServer and not the seedyServer
*/

var util = require('./dht/util.js');
var Peer = require('./dht/peer.js');
var SeedyServer = require('./seedy-server.js');
var verifier = require('./verifier.js');
var PublicKeyCache = require('./public-key-cache.js');
var REPLICATION_FACTOR = require('./constants.js').REPLICATION_FACTOR;

var timers = require('sdk/timers');

ORIGIN_SERVER = 'localhost:5001';

STARTUP_TIMEOUT = 8000;
STORE_TIMEOUT = 5000;

NUM_SERVERS = 4;
NUM_SEEDS = 1;

seedServers = [];
seedPeers = [];
servers = [];
serverPeers = [];

exports['test bootstrap'] = function(assert, done) {
  for (var i = 0; i < NUM_SEEDS; i++) {
    var port = 3000 + i;
    var seedyServer = new SeedyServer();
    if (!seedyServer.startServer(port)) {
      throw "Couldn't start SeedyServer on port " + port +
            ". There's probably another server running on that port already.";
    }
    var id = util.generateId();
    seedServers.push(seedyServer.startDht(id, true));
    seedPeers.push(new Peer(id, 'localhost', port, true));
  }

  for (var i = 0; i < NUM_SERVERS; i++) {
    var port = 2000 + i;
    var seedyServer = new SeedyServer();
    if (!seedyServer.startServer(port)) {
      throw "Couldn't start SeedyServer on port " + port +
            ". There's probably another server running on that port already."
    }
    var id = util.generateId();
    servers.push(seedyServer.startDht(id, false, seedPeers));
    serverPeers.push(new Peer(id, 'localhost', port, false));
  }

  // wait for the servers to bootstrap
  timers.setTimeout(function() {
    assert.equal(servers[0]._kbuckets.get(
      seedPeers[0].getId()).getId(),
      seedPeers[0].getId(), "the seed is in the bucket's seedPeers");

    var closestPeers = servers[NUM_SERVERS - 1]._kbuckets.closestPeers(
      util.hash('just a random id'), NUM_SERVERS);

    // make sure the seed told this peer about some peers
    assert.ok(closestPeers.length > 1, 'the seed server introduced other peers');
    done();
  }, STARTUP_TIMEOUT);
};

function getServerWithId(id) {
  for (var i = 0; i < servers.length; i++) {
    if (servers[i].getId() == id) {
      return servers[i];
    }
  }
  for (var i = 0; i < seedServers.length; i++) {
    if (seedServers[i].getId() == id) {
      return seedServers[i];
    }
  }

}

// Whenever we send an iterative FIND_VALUE, we store the value
// at the closest node to the value, if we didn't find the value there.

// Here I set up a scenario in which a peer does not contain a value
// that is closest to its id, because the peer joins later.

exports['test store'] = function(assert, done) {
  var key = 'christmas';
  var pageText = 'fake pageText';
  var signature = 'fake signature';

  // I don't use server[0]. That server was the first to contact
  // a seed, so it might not know about other peers yet.
  var closestPeer = servers[1]._kbuckets.closestPeers(
    util.hash('christmas'), 1)[0]
  var closestServer = getServerWithId(closestPeer.getId());
  // store the value on all servers except itself and the server with
  // the id that's closest to the key.
  for (var i = 0; i < NUM_SERVERS; i++) {
    if (serverPeers[i].getId() != closestServer.getId() &&
        serverPeers[i].getId() != servers[1].getId()) {
      servers[1].doStore(serverPeers[i], util.hash(key), pageText, signature);
    }
  }

  // wait for the servers to store the value
  timers.setTimeout(function() {
    servers[1].get(key, function(err, pageText, signature) {
      if (err) {
        assert.ok(false,
          'The pageText and signature should be returned to servers[1]');
      } else {
        // wait for the store command to be received by the closest peer
        // to the key
        timers.setTimeout(function() {
          closestServer.get(key, function(err, pText, sig) {
            if (err) {
              assert.ok(false,
                'The pageText and signature should have been stored in the ' +
                'peer with the id closest to the key, after server[1] found ' +
                'the value, but not from this peer.');
            } else {
              assert.equal(pageText, pText,
                 'The pageText should be stored in the closest node');
              assert.equal(signature, sig,
                 'The signature should be stored in the closest node');
            }
            done();
          });
        }, STORE_TIMEOUT);
      }
    });
  }, STORE_TIMEOUT);
};

exports['test fetch and replicate'] = function(assert, done) {
  var fetcher = servers[2];
  // Minor detail: the fetcher might be the closest peer to the key,
  // but for now we just have the closest peer the the key that the fetcher
  // knows store the key.
  var numPeersThatHaveStoredTheValue = 0;

  var closestPeers = fetcher._kbuckets.closestPeers(
    util.hash(ORIGIN_SERVER), REPLICATION_FACTOR);
  var closestServer = getServerWithId(closestPeers[0].getId());

  var thiz = this;
  function getValueFromClosestPeers() {
    for (var i = 0; i < REPLICATION_FACTOR; i++) {
      closestServer.get(ORIGIN_SERVER, function(err, pageText, signature) {
        if (err) {
          assert.ok(false, ORIGIN_SERVER +
                    ' should be replicated to this peer');
        } else {
          var publicKeyCache = new PublicKeyCache();
          var publicKey = publicKeyCache.keyForHostname(ORIGIN_SERVER,
            function(publicKey) {
              var valid = verifier.verify(publicKey, pageText, signature);
              assert.ok(valid, 'peers should return valid content');
              if (valid) {
                ++numPeersThatHaveStoredTheValue;
              }
            }
          );
        }
      });
      // wait to get all the values
      timers.setTimeout(function() {
        assert.equal(REPLICATION_FACTOR, numPeersThatHaveStoredTheValue,
          'The content should have replicated to ' + REPLICATION_FACTOR +
          ' peers. It was replicated to ' + numPeersThatHaveStoredTheValue);
        done();
      }, STORE_TIMEOUT);
    }
  }

  fetcher.get(ORIGIN_SERVER, function(err, pageText, signature) {
    if (err) {
      fetcher.fetch(ORIGIN_SERVER, function(pageText, signature) {
        var publicKeyCache = new PublicKeyCache();
        var publicKey = publicKeyCache.keyForHostname(ORIGIN_SERVER,
          function(publicKey) {
            var valid = verifier.verify(publicKey, pageText, signature);
            assert.ok(valid, 'content should be authentic');

            // Now make sure that content was replicated in the
            // closest REPLICATION_FACTOR many peers
            // First wait to allow the 'store' message to reach
            // the peers
            timers.setTimeout(function() {
              getValueFromClosestPeers();
            }, 2*STORE_TIMEOUT); // Don't `get` too soon, or more
            // fetch requests will be kicked off. If you see a second
            // `fetch` command sent (in the console output), increase
            // this timeout.
          });
      });
    } else {
      assert.ok(false, ORIGIN_SERVER +
        ' should not have been found already in the DHT');
    }
  });
}


require("sdk/test").run(exports);

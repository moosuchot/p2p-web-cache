var KBuckets = require('./dht/kbuckets.js');
var Peer = require('./dht/peer.js');
var util = require('./dht/util.js');

var K = 20; // the max number of contacts stored in a bucket
var NUM_BUCKETS = 160;
var ID = util.generatePredictableId(1);

exports['test init'] = function(assert) {
  var kBuckets = new KBuckets(ID, K, NUM_BUCKETS);
  assert.equal(kBuckets._hostId, ID, 'assigns _hostId');
  assert.equal(kBuckets._K, K, 'assigns _K');
  assert.equal(kBuckets._numBuckets, NUM_BUCKETS, 'assigns _numBuckets');

  assert.equal(kBuckets._buckets.length, NUM_BUCKETS, 'assigns _buckets');
  for (var i = 0; i < NUM_BUCKETS; i++) {
    // using 'assert' here spams stdout - throw is quieter
    if (kBuckets._buckets[i].length !== 0) {
      throw '_buckets[' + i + '] did not have 0 length!';
    }
  }
};

exports['test add'] = function(assert) {
  var kBuckets = new KBuckets(ID, K, NUM_BUCKETS);
  assert.equal(kBuckets.count(), 0, 'kBuckets are empty initially');
  var peer = new Peer(util.generateId(), '1.2.3.4', 2000);
  kBuckets.add(peer, null);
  assert.equal(kBuckets.count(), 1), 'adds a new peer if the bucket isn\'t full';
};

// TODO: need a server here to test responsive/unresponsive pings
// it('does not add a new peer if the old peers are responsive', function () {
//   var kBuckets = new KBuckets(ID, K, NUM_BUCKETS);
//   // Fill up the bucket.
//   var id = util.generatePredictableId(159);
//   for (var i = 0; i < 20; i++) {
//     id = util.incrementId(id);
//     var peer = new Peer(id, '1.2.3.4', 2000);
//     kBuckets.add(peer);
//   }

//   var unlucky = new Peer(util.incrementId(id), '1.2.3.4', 2000);
// });

exports['test get'] = function(assert) {
  var kBuckets = new KBuckets(ID, K, NUM_BUCKETS);
  var id = util.generateId();
  var peer = new Peer(id, '1.2.3.4', 2000);
  kBuckets.add(peer, null);
  var result = kBuckets.get(id);
  assert.equal(peer, result, 'returns a peer that exists in a bucket');

  result = kBuckets.get(util.incrementId(id));
  assert.deepEqual(result, null, 'returns null for an id that does not exist');
};

require("sdk/test").run(exports);

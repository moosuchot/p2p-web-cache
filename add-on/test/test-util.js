var util = require('./dht/util.js');
var Peer = require('./dht/peer.js');
var bigInt = require('./dht/vendor/big-integer/BigInteger.min.js');

exports['test bucketIndex'] = function(assert) {
  assert.equal(util.bucketIndex('a', 'a'), 0, 'util.bucketIndex("a","a") == 0');
  assert.equal(util.bucketIndex('0', '1'), 0, 'util.bucketIndex("0","1") == 0');
  assert.equal(util.bucketIndex('0', '3'), 1, 'util.bucketIndex("0","3") == 1');
  assert.equal(util.bucketIndex('0', '7'), 2, 'util.bucketIndex("0","7") == 2');
  assert.equal(util.bucketIndex('F', 'F0'), 7, 'util.bucketIndex("F", "F0") == 7');
};

exports['test generatePredictableId'] = function(assert) {
  var one = util.generatePredictableId(1);
  assert.equal(bigInt(one, 16).toJSNumber(), 1, 'util.generatePredictableId(1) == 1');
  var seven = util.generatePredictableId(3);
  assert.equal(bigInt(seven, 16).toJSNumber(), 7, 'util.generatePredicableId(3) == 7');
};

exports['test incrementId'] = function(assert) {
  var id = util.generateId();
  var big = bigInt(id, 16);
  var bigger = bigInt(util.incrementId(id), 16);
  assert.ok(bigger.eq(big.add(1)), "util.incrementId(id) == (id + 1)");
};

exports['test insertSorted'] = function(assert) {
  var sorted = [0, 2, 3];
  util.insertSorted(1, sorted, function (x, y) {
    return ((x <= y) ? -1 : 1);
  });
  for (var i = 0; i <= 3; i++) {
    assert.equal(sorted[i], i, 'sorted[i] == i');
  }
};

exports['test compareById'] = function(assert) {
  var id = util.generatePredictableId(3);
  var peerA = new Peer(util.generatePredictableId(5), '1.1.1.1', 1234);
  var peerB = new Peer(util.generatePredictableId(10), '2.2.2.2', 5678);
  assert.equal(util.compareById(peerA, peerB, id), -1, 'returns -1 if peerA closer than peerB');
  assert.equal(util.compareById(peerB, peerA, id), 1, 'returns 1 if peerA further than peerB');
};

require("sdk/test").run(exports);

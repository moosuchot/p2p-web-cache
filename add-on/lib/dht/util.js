var crypto = require('../vendor/crypto-browserify.js');
var bigInt = require('./vendor/big-integer/BigInteger.js');

var util = module.exports = {
  // a and b are hex strings. Returns a bigInt
  xor: function(a, b) {
    a = bigInt(a, 16);
    b = bigInt(b, 16);
    var res = a.xor(b);
    return res;
  },

  // returns index of the host bucket into which peer should be assigned
  // Bucket i stores peers with distances s.t. 2^i <= dist < 2^(i+1).
  bucketIndex: function(hostId, peerId) {
    if (hostId === peerId) {
      return 0;
    }

    hId = bigInt(hostId, 16);
    pId = bigInt(peerId, 16);
    dist = hId.xor(pId);

    // This is a poor man's base-2 logarithm to find the appropriate i
    var idx = 0;
    while (dist.divide(2).neq(0)) {
      dist = dist.divide(2);
      idx++;
    }
    return idx;
  },

  // Note that any id generated must be in hex
  // Returns 2^n - 1 as a hex string
  generatePredictableId: function(n) {
    var id = 0;
    for (var i = 0; i < n; i++) {
      id += Math.pow(2, i);
    }
    return id.toString(16);
  },

  // Note that any id generated must be in hex
  generateId: function() {
    currentTime = (new Date()).valueOf().toString();
    random = Math.random().toString()
    return crypto.createHash('sha1').update(currentTime + random).digest('hex');
  },

  // Returns a hex string id that is 1 higher than the id passed in
  incrementId: function (original) {
    var oldId = bigInt(original, 16);
    var newId = oldId.add(1);
    return newId.toString(16);
  },

  hash: function(stuff) {
    return crypto.createHash('sha1').update(stuff).digest('hex');
  },

  // Test which of A and B are closer to id
  compareById: function(peerA, peerB, id) {
    var distA = this.xor(id, peerA.getId());
    var distB = this.xor(id, peerB.getId());
    if (distA.lt(distB)) {
      return -1;
    } else {
      return 1;
    }
  },

  insertSorted: function(element, sortedArray, compareFunction) {
    sortedArray.push(element);
    sortedArray.sort(compareFunction);
  },

};

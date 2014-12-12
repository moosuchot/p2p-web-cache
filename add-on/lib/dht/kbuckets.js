var util = require('./util');
var Class = require('./class');

/* A kBucket is an order list of peers, sorted by time last seen:
 *   ...          Least recently seen ---> Most recently seen
 *   buckets[i]:  [Peer0, Peer1, Peer2,     ...      , PeerK]
 *   ...
 *
 * Bucket i holds up to K peers with distances from the host that satisfy
 *   2^i <= dist < 2^(i+1)
 *
 * Don't place the host itself or a into the kbucket, because
 * the purpose of the kbucket is to be able to fetch the closest peers
 * to an id for the sake of answering a FIND_NODE or FIND_VALUE.
 * The requester clearly already knows its node id, and if the host has
 * stored the value, it returns it without consulting the kbuckets.
 */
var KBuckets = module.exports = Class.extend({
  init: function(hostId, K, numBuckets) {
    this._hostId = hostId;
    this._K = K;
    this._numBuckets = numBuckets;

    // We "pre-split" our buckets here by intializing all numBuckets at once,
    // instead of just a single one as the paper describes.
    this._buckets = [];
    for (var i = 0; i < numBuckets; i++) {
      this._buckets.push([]);
    }
  },

  count: function() {
    var total = 0;
    for (var i = 0; i < this._numBuckets; i++) {
      for (var j = 0; j < this._buckets[i].length; j++) {
        total += 1;
      }
    }
    return total;
  },

  add: function(peer, host) {
    var i = util.bucketIndex(this._hostId, peer.getId());

    // don't add it if it's already in the bucket
    for (var j = 0; j < this._buckets[i].length; j++) {
      if (this._buckets[i][j].getId() == peer.getId()) {
        return;
      }
    }

    // Possible optimizations:  (Paper S4.1)
    //   - 'replacement cache' when a bucket is full
    //   - exponential backoff for unresponsive peers
    //   - flag stale contacts if kbucket not full
    if (this._buckets[i].length < this._K) {
      this._buckets[i].push(peer);
    } else {
      // The bucket is full. We ping the first guy in the list
      // (the least recently seen peer), and if he doesn't respond, he's out!
      var successCB = function(res, peer) {
        if (res.body.command != 'pong') {
          this._buckets[0] = peer;
        } else {
          // don't add the new peer to the bucket
        }
      }

      var timeoutCB = function() {
        this._buckets[0] = peer;
      }

      host.doPing(this._bucket[0], successCB, timeoutCB);
    }
  },

  remove: function(peer) {
    var i = util.bucketIndex(this._hostId, peer.getId());
    for (var j = 0; j < this._buckets[i].length; j++) {
      if (this._buckets[i][j].getId() == peer.getId()) {
        this._buckets[i].splice(j, 1);
      }
    }
  },

  // This function is called after the host receives communication from
  // this peer. We move the peer to the last position in the bucket to
  // maintain the most-recently seen ordering.
  update: function(peer) {
    this.remove(peer);
    this.add(peer);
    return peer;
  },

  // Returns a peer with this id if the bucket list contains it; else null
  get: function(id) {
    var i = util.bucketIndex(this._hostId, id);
    for (var j = 0; j < this._buckets[i].length; j++) {
      if (this._buckets[i][j].getId() == id) {
        return this._buckets[i][j];
      }
    }
    return null;
  },

  // returns the `n` closest peers to `id`
  closestPeers: function(id, n) {
    var compareFunction = function(peerA, peerB) {
      return util.compareById(peerA, peerB, id);
    }

    closest = [];
    for (var i = 0; i < this._numBuckets; i++) {
      var bucket = this._buckets[i];
      for (var j = 0; j < bucket.length; j++) {
        util.insertSorted(bucket[j], closest, compareFunction);
        if (closest.length > n) {
          closest.pop();
        }
      }
    }
    return closest;
  },
});

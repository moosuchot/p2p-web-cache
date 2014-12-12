var Class = require('./class');
var util = require('./util');
var timers = require('sdk/timers');


var Shortlists = module.exports = Class.extend({
  // `shortlistsLength` is the max number of peers in each shortlist
  init: function(shortlistLength) {
    this._shortlists = {};
    this._shortlistLength = shortlistLength;
  },

  _resetTimeout: function(id) {
    var s = this._shortlists[id];
    timers.clearTimeout(s.timeout);
    var thiz = this;
    s.timedOut = false;
    s.timeout = timers.setTimeout(function() {
      s.timeoutCB();
      s.timedOut = true;
    }, s.timeoutLength);
  },

  exists: function(id) {
    return id in this._shortlists;
  },

  addList: function(targetId, timeoutCB, timeoutLength) {
    if (targetId in this._shortlists && this._shortlists[targetId] !== null) {
      return;
    }
    if (!(targetId in this._shortlists)) {
      this._shortlists[targetId] = {list: [],
                                    closestNodeHasValue: false};
    }
    this._shortlists[targetId].timeoutCB = timeoutCB;
    this._shortlists[targetId].timeoutLength = timeoutLength;
    this._resetTimeout(targetId);
  },

  // Add the peer to the shortlist if its id is one of the closest
  // to the targetId, and it's not already on the shortlist.
  add: function(targetId, peer) {
    if (this._shortlists[targetId].timedOut) {
      // the peer responded too late. The timeout callback has already been hit.
      return
    }
    var list = this._shortlists[targetId].list;

    // check if the peer is already added to the shortlist
    for (var i = 0; i < list.length; i++) {
      if (list[i].getId() == peer.getId()) {
        return;
      }
    }

    var compareFunction = function(peerA, peerB) {
      return util.compareById(peerA, peerB, targetId);
    }

    util.insertSorted(peer, list, compareFunction);
    this._resetTimeout(targetId);
  },

  get: function(id) {
    return this._shortlists[id].list;
  },

  closestNodeHasValue: function(id) {
    return this._shortlists[id].closestNodeHasValue;
  },

  setClosestNodeHasValue: function(id, bool) {
    this._shortlists[id].closestNodeHasValue = bool;
    // This makes sure the shortlistTimeoutCBB doesn't get called
    // after the closest node to the key returns the value.
    timers.clearTimeout(this._shortlists[id].timeout);
  },
});

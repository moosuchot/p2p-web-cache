var Class = require('./class');

var Peer = module.exports = Class.extend({
  init: function(id, ip, port, isSeed) {
    if (typeof isSeed != 'boolean') {
      throw "wrong isSeed type: " + typeof(isSeed);
    }
    if (typeof port != 'number') {
      throw "wrong port type: " + typeof(port);
    }

    this._id = id;
    this._ip = ip;
    this._port = port;
    this._isSeed = isSeed;

    return this._isSeed;
  },
  getIP: function() {
    return this._ip;
  },
  getPort: function() {
    return this._port;
  },
  getId: function() {
    return this._id;
  },
  isSeed: function() {
    return this._isSeed;
  },
  toString: function() {
    return "Peer<id=" + this._id.slice(0,6) +
           ", host=" + this._ip +
           ", port=" + this._port + ">";
  }
});

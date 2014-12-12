var Class = require("./class");

var Store = module.exports = Class.extend({
  init: function() {
    this._inMemory = {};
  },

  put: function(key, pageText, signature, callback) {
    if (typeof pageText != 'string') {
      throw 'pageText should be a string. Its type is ' + typeof(pageText);
    }
    if (typeof signature != 'string') {
      console.log("signature: ", signature);
      throw 'signature should be a string. Its type is ' + typeof(signature);
    }
    this._inMemory[key] = {pageText: pageText, signature: signature};
  },

  remove: function(key) {
    delete this._inMemory[key];
  },

  get: function(key) {
    if (key in this._inMemory) {
      // Likewise, this returns a dictionary having "content" and "signature"
      return this._inMemory[key];
    } else {
      return null;
    }
  },
});

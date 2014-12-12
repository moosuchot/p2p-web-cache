// const { components, CC, Cc, Ci, Cr, Cu } = require("chrome");
// Cu.import("resource://gre/modules/XPCOMUtils.jsm");
var { CC, Cu } = require('chrome')

const BinaryInputStream = CC("@mozilla.org/binaryinputstream;1",
                             "nsIBinaryInputStream",
                             "setInputStream");

const NetUtil = Cu.import("resource://gre/modules/NetUtil.jsm");


// This class is a express-like interface that
// we pass to our DHT to abstract out that
// that we're using the httpd.js server.
var HttpApp = function() {
  this._listenerCB = null;
};

HttpApp.prototype.setListener = function(listenerCB) {
    this._listenerCB = listenerCB;
};

HttpApp.prototype.handleRequest = function(req, res) {
    res.processAsync();

    var bodyInputStream = req.bodyInputStream;
    var binaryStream = new BinaryInputStream(bodyInputStream);
    // See: https://developer.mozilla.org/en-US/Add-ons/
    //        Code_snippets/File_I_O#Binary_File

    req['body'] = binaryStream.readBytes(binaryStream.available());
    var cb = this._listenerCB;
    cb && cb(req, res);
};

module.exports = HttpApp;

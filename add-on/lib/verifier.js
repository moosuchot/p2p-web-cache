
var crypto = require('vendor/crypto-browserify.js');

var util = module.exports = {
  verify: function(publicKey, pageText, signature) {
    if (typeof publicKey != 'string') {
      throw 'The publicKey must be a string. Its type is ' + typeof(publicKey);
    }
    if (typeof pageText != 'string') {
      throw 'The pageText must be a string. Its type is ' + typeof(pageText);
    }
    if (typeof signature != 'string') {
      throw 'The signature must be a string. Its type is ' + typeof(signature);
    }
    var verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(new verifier.Buffer(pageText));
    var isValid = verifier.verify(publicKey, signature, 'base64');
    if (!isValid) {
      console.log('Bad signature.');
      console.log('publicKey:', publicKey);
      console.log('signature:', signature);
      console.log('pageText:' + pageText + 'END');
    }
    return isValid;
  },
};

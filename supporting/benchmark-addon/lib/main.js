require("sdk/preferences/service").set("javascript.options.strict", false);

var Benchmark = require('./vendor/benchmark.js');
var crypto = require('./vendor/crypto-browserify.js');
module.crypto = crypto;

var chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghiklmnopqrstuvwxyz';
var randomstring = {
    generate: function(length) {
        length = length ? length : 32;

        var string = '';

        for (var i = 0; i < length; i++) {
            var randomNumber = Math.floor(Math.random() * chars.length);
            string += chars.substring(randomNumber, randomNumber + 1);
        }

        return string;
    }
}

var data = [];
var signatures = {};
var verified = [];

data.push(randomstring.generate(8));
data.push(randomstring.generate(512));
data.push(randomstring.generate(2 * 1024));
data.push(randomstring.generate(4 * 1024)); // 4k
data.push(randomstring.generate(8 * 1024)); // 8k
data.push(randomstring.generate(16 * 1024)); // 16k
data.push(randomstring.generate(32 * 1024)); // 32k
data.push(randomstring.generate(64 * 1024)); // 64k
data.push(randomstring.generate(128 * 1024)); // 128k
data.push(randomstring.generate(512 * 1024)); // 512k
data.push(randomstring.generate(1024 * 1024)); // 1mb
data.push(randomstring.generate(4 * 1024 * 1024)); // 4mb

var rsa = {
    "public": "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyXCKi2x1gubHlU6Xd24I\nkpN/raJJkXVVBFZxkcVX28MYaQgSArTJxjtSpDJaka9cWCgWd2bGfj1bN1wgFV1g\nhCaTOWT2yAUtD8Ptco5oIiUtWASDnKlSdPSyKypqDUhCmnx9N/gdoqLQrhOCsQNJ\nUB47BBCY76I3mTH083bI2CrsiCbS58xnAPc/+Cfww7sc3iuTP5taSODL5iLV7Pd+\nFIsxKQeE7kveYJginvgGI/fwlbTolpqpjn10udLKHiCFf3Kpbgjnh4/jpqMqsivJ\nqyEO3didJGq4PMyrnzyfvn8JMW6TQu3Q6pW0yI+iWyUjqSD3ryOLc7Q21m2CA02v\nPQIDAQAB\n-----END PUBLIC KEY-----\n",
    "private": "-----BEGIN RSA PRIVATE KEY-----\nMIIEogIBAAKCAQEAyXCKi2x1gubHlU6Xd24IkpN/raJJkXVVBFZxkcVX28MYaQgS\nArTJxjtSpDJaka9cWCgWd2bGfj1bN1wgFV1ghCaTOWT2yAUtD8Ptco5oIiUtWASD\nnKlSdPSyKypqDUhCmnx9N/gdoqLQrhOCsQNJUB47BBCY76I3mTH083bI2CrsiCbS\n58xnAPc/+Cfww7sc3iuTP5taSODL5iLV7Pd+FIsxKQeE7kveYJginvgGI/fwlbTo\nlpqpjn10udLKHiCFf3Kpbgjnh4/jpqMqsivJqyEO3didJGq4PMyrnzyfvn8JMW6T\nQu3Q6pW0yI+iWyUjqSD3ryOLc7Q21m2CA02vPQIDAQABAoIBAHQ0FdgkMw3Wb5/z\n/HCK6ysTJ35UtjfRBcBA1bcProU54GUGoM0q2ZMfOac63QBZtt2sEnnCshK09l/T\nJzbr7PePATMEyU/NnJcRoXKKMAwyghvaTsoa61RIrFc2WoNbAgD4e4vD9+SQI+2n\nl6bhjHNJXSYVJQRoAcbACNxB087Ovi++z4noTlOmptDDPjqiCq5ZNAN4XbCwveUT\nS6SwGi+P9Q7M84SPWED4GgdAIJ6+chYwfrey4WjCMPLI04nNe/7y6c7paPwt/MUX\nsUpcS7/X5q6Fs8IbXs96H56EXzH48TAboS9FKGYMmdeyld5NVohSpfIH2OqOVypB\n9rj15AkCgYEA45Z/ZGcfKpxz9RSFqfddNzUVC+dRPcRarb+GEnjGOyZKbew3GptA\n/seVghKPT/PKf0dc+W8rsu9NySIv7jrTVTYR++9w2tGEKL+pZ4u+qGkpurac1m0U\nxlwsI9lITsahBp1XyMo54WqDymjIR3im9jmCwFWIeQjxwtA2dGTKFwcCgYEA4pZe\nX3qR56fM72zIG8YKWyfIKt6zD3gB5S1qlRxGLd+0/xrxhn8sNdmNjmRVssvtIrns\nerKu+QjuaM5Zx5izYlaFhcnDDH9JHP/Ib86k/koGxww2hQxdDHFW4IdRoNdq7ch7\nDZ/P7klq/MbdIoN0aE8X/dDFPOXsTWxVdrgC0psCgYBo5S6mGhl1TFLtvJ22rvpZ\nva+LovwA2gVpW4Lx9JR5IrbfXyYurywPwfGY1/ERyq2kaEHj/WdIu59Aeu9Yf+hz\nt84mLj/3uuWM2nm77d7cREwlcJFtCy2uF0GI7Fa1aDtDjzWsp/hxeuRvYEgfGO7r\nQaqP91xFXOgBAHJ4xxOV9QKBgGSW6JJucXNr1Ni9bCCYTGSnRn9xmgBWAFFjVhuY\nD7exxkIyDeLtdgz55ZO/CyRyz3VJIKhfxrmbs2snoEexjIEtc90u8r4Li8Op8ath\nC3IwHs4ip9ls4anybuUCbcR/nWKuS6KCveZFBY/uIKF/xh/AbSAqnEUqtTqxy0cG\n7YndAoGAIBraZGIt+Ktq96aWlwKG9zrckLC128UyuawxRFx4/Hdl9iR1pjsUw5rO\nR4ZoxgehkYur3OLGsIdfPz83aCc2DQjFswrQNdFXu1TlCqBwMTShRpIk3Fn6F0Hb\nFKRf34tauy9Mifq5EVF+OuTy67viuT1hM7LBntTqNFE/yXwGsLo=\n-----END RSA PRIVATE KEY-----\n"
};

var suite = new Benchmark.Suite();

for (var i = 0, len = data.length; i < len; i++) {
  var datum = data[i];
  suite.add('verify' + datum.length, {
    setup: 'var datum = ' + JSON.stringify(datum) + ';' +
           'var signature = this.crypto.createSign("RSA-SHA256").update(datum).sign(this.rsa.private, "base64");',
    fn: function() {
      var verifier = this.crypto.createVerify('RSA-SHA256');
      verifier.update(datum);
      var valid = verifier.verify(this.rsa.public, signature, 'base64');
    },
    crypto: crypto,
    rsa: rsa
  });
}

// add listeners
suite.on('cycle', function(event) {
  console.log(String(event.target));
})
.on('complete', function() {
  console.log('Fastest is ' + this.filter('fastest').pluck('name'));
})
.on('error', function(err) {
  console.log('error', err);
})
// run async
.run({ 'async': false });


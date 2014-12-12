var chai = require('chai');
var Server = require('../server.js');
var request = require('request');
var expect = chai.expect;
var path = require('path');
var crypto = require('crypto');

var privateKey = require('fs').readFileSync(path.join(__dirname, '../keys/private.pem')).toString();
var publicKey = require('fs').readFileSync(path.join(__dirname, '../keys/public.pem')).toString();

var port = 5001;

describe('Server', function() {
    var server;
    before(function() {
        // Start up server, though we don't shut it down so this will work only once
        server = new Server(port, privateKey);
    });

    it('sets the right request header', function(done) {
        request('http://localhost:5001/', function(error, response, body) {
            // apparently the request library lowercases all headers
            expect('X-CACHE-SIGNATURE'.toLowerCase() in response.headers).to.be.true;
            done();
        });
    });

    it('sends a valid signature for the index page', function(done) {
        request('http://localhost:5001/', function(error, response, body) {
            var signature = new Buffer(response.headers['x-cache-signature'], 'base64');

            var verifier = crypto.createVerify('RSA-SHA256');
            verifier.update(body);
            var valid = verifier.verify(publicKey, signature);
            expect(valid).to.be.true;

            // Now let's try one that shouldn't verify with this signature
            var anotherVerifier = crypto.createVerify('RSA-SHA256');
            anotherVerifier.update('abc');
            var validAgain = anotherVerifier.verify(publicKey, signature);
            expect(validAgain).to.be.false;

            // And let's try another, but with a bad signature
            var yetAnotherVerifier = crypto.createVerify('RSA-SHA256');
            yetAnotherVerifier.update(body);
            var validYetAgain = yetAnotherVerifier.verify(publicKey, signature + 'a');
            expect(validYetAgain).to.be.false;

            done();
        });
    });

    it('sends a valid signature for the image', function(done) {
        request('http://localhost:5001/images/a-shaq-a-cat.gif', function(error, response, body) {
            console.log('response headers', response.headers);
            var signature = new Buffer(response.headers['x-cache-signature'], 'base64');
            require('fs').writeFileSync('image-test.gif', body);
            console.log('signature', response.headers['x-cache-signature']);

            var verifier = crypto.createVerify('RSA-SHA256');
            verifier.update(body);
            var valid = verifier.verify(publicKey, signature);
            expect(valid).to.be.true;

            done();
        });
    });
});
